"""CRAG-style retrieval evaluation (Corrective RAG, arXiv:2401.15884).

Retrieval quality is controlled in two tiers:
  * cheap lexical filters already run in discovery (rag/sources) — recall
  * this module is the *expensive* precision signal: an LLM judge scores each
    retrieved chunk for whether it can actually answer the query.

When the judge is unsure (AMBIGUOUS) or everything is off-topic (INCORRECT) we
run the corrective loop from the CRAG paper: reformulate the query and retrieve
again, instead of silently generating from irrelevant context. The verdict
bands mirror CRAG's confidence mapping: score >= 0.6 -> correct (use the
chunk), 0.3-0.6 -> ambiguous (transform/retry), < 0.3 -> incorrect (drop).
"""

import json
import logging
from enum import Enum

from rag.config import settings
from rag.llm import complete

logger = logging.getLogger(__name__)


class Verdict(str, Enum):
    """CRAG verdict for a retrieved chunk."""

    CORRECT = "correct"
    AMBIGUOUS = "ambiguous"
    INCORRECT = "incorrect"


def verdict_for(score: float) -> Verdict:
    """Map a judge score to the CRAG verdict bands (from settings)."""
    if score >= settings.relevance_threshold_correct:
        return Verdict.CORRECT
    if score >= settings.relevance_threshold_ambiguous:
        return Verdict.AMBIGUOUS
    return Verdict.INCORRECT


def _extract_json(raw: str) -> dict:
    """Pull the first JSON object out of a model response (robust to prose)."""
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return json.loads(raw[start:end + 1])


def evaluate_chunks(query: str, chunks: list[dict], max_chunks: int = 5) -> list[dict]:
    """LLM-judge each chunk's relevance to the query, in a single cheap call.

    Args:
        query: the user's question.
        chunks: output of retriever.retrieve() (dicts with text/metadata).
        max_chunks: cap the number judged (keeps the prompt small/cheap).

    Returns:
        The chunks annotated with verdict/relevance/reason. The judge fails
        OPEN (everything scored 1.0) so a judge hiccup can never make
        retrieval *worse* than not having an evaluator at all.
    """
    if not chunks:
        return []
    judged = chunks[:max_chunks]

    numbered = "\n\n".join(
        f"[{i}] {c['metadata'].get('source', '?')} p.{c['metadata'].get('page', '?')}: "
        f"{c['text'][:500]}"
        for i, c in enumerate(judged, 1)
    )
    prompt = (
        "You are a strict retrieval judge. For each chunk, decide how well it "
        "answers the QUESTION on a 0-1 scale (0 = useless, 1 = fully answers).\n\n"
        f"QUESTION: {query}\n\nCHUNKS:\n{numbered}\n\n"
        "Reply with ONLY a JSON object, no prose:\n"
        '{"scores": [{"index": 1, "score": 0.9, "reason": "one short phrase"}]}'
    )

    raw = complete(prompt, model=settings.fast_model, max_tokens=1024)
    try:
        data = _extract_json(raw)
        scores = {int(s["index"]): s for s in data.get("scores", [])}
    except Exception:
        logger.warning("Relevance judge returned unparseable JSON; failing open", exc_info=True)
        scores = {}

    annotated = []
    for i, chunk in enumerate(judged, 1):
        entry = scores.get(i)
        if entry:
            try:
                score = max(0.0, min(1.0, float(entry.get("score", 1.0))))
            except (TypeError, ValueError):
                score = 1.0
            reason = str(entry.get("reason", ""))
        else:
            score, reason = 1.0, ""
        annotated.append({
            **chunk,
            "verdict": verdict_for(score).value,
            "relevance": score,
            "reason": reason,
        })
    return annotated


def reformulate_query(query: str, judged: list[dict]) -> str:
    """Ask the LLM for a better search query when the first pass missed.

    Gives the judge's per-chunk feedback so the rewrite targets what was wrong
    (vocabulary mismatch, too vague, wrong level of specificity).
    """
    problems = "\n".join(
        f"- [{c['metadata'].get('source', '?')} p.{c['metadata'].get('page', '?')}] "
        f"score {c['relevance']:.2f} ({c['verdict']}) — {c.get('reason', '')}"
        for c in judged
    )
    prompt = (
        "The retrieval for the question below returned weak or off-topic chunks.\n\n"
        f"QUESTION: {query}\n\nJUDGE FEEDBACK:\n{problems}\n\n"
        "Write ONE improved search query — different words, synonyms, more specific "
        "terms — that would find the right information. Reply with only the query text."
    )
    improved = complete(prompt, model=settings.fast_model, max_tokens=128).strip()
    return improved or query


def corrective_retrieve(
    query: str,
    retrieve_fn,
    max_rounds: int | None = None,
    top_chunks: int = 5,
) -> list[dict]:
    """CRAG corrective loop: retrieve -> judge -> reformulate & re-retrieve.

    Args:
        query: the user's question.
        retrieve_fn: callable(query) -> list of chunks (retriever.retrieve()
            shaped dicts). The caller owns how retrieval works (HyDE, hybrid,
            etc.); this function only decides whether to retry.
        max_rounds: how many retrieve+judge rounds at most.
        top_chunks: how many chunks to judge per round.

    Returns:
        Chunks of the best round, annotated with verdict/relevance/reason.
    """
    rounds = max_rounds or settings.relevance_eval_max_rounds
    best: list[dict] | None = None
    best_rank: tuple[int, float] = (-1, -1.0)

    current_query = query
    for _ in range(rounds):
        chunks = retrieve_fn(current_query) or []
        if not chunks:
            break

        judged = evaluate_chunks(current_query, chunks, max_chunks=top_chunks)
        rank = _round_rank(judged)
        if rank > best_rank:
            best, best_rank = judged, rank

        # Stop early: the top chunk is good enough to answer from.
        if judged and judged[0]["verdict"] == Verdict.CORRECT.value:
            break

        next_query = reformulate_query(current_query, judged)
        logger.info("CRAG: %s verdict, reformulating '%s' -> '%s'",
                    judged[0]["verdict"], current_query[:60], next_query[:60])
        if next_query == current_query:
            break  # the model had nothing better; stop rather than loop
        current_query = next_query

    if best is None:
        return []
    logger.info("CRAG: returning round with %s top chunk (mean relevance %.2f)",
                best[0]["verdict"], sum(c["relevance"] for c in best) / len(best))
    return best


def _round_rank(judged: list[dict]) -> tuple[int, float]:
    """Rank a round by (top-chunk verdict, mean relevance) for comparison."""
    top = {"correct": 2, "ambiguous": 1, "incorrect": 0}[judged[0]["verdict"]]
    mean = sum(c["relevance"] for c in judged) / len(judged)
    return top, mean
