"""SimRAG-style self-evaluation loop (arXiv:2410.17952).

SimRAG shows a model can improve itself by generating its own synthetic
question-answer data from unlabeled text and fine-tuning on it. We can't
fine-tune Claude here, but the same generate -> evaluate -> improve loop is
valuable as a *retrieval quality audit* of the user's library:

  1. generate  sample random chunks from the library
  2. generate  the model writes questions each chunk should answer
  3. evaluate  we retrieve for each question and check the exact ground-truth
               chunk surfaces in the top-k
  4. improve   the report exposes hit rate, the worst queries, and an LLM
               summary of the failure pattern + what to change (chunk size,
               HyDE prompt, query-reformulation habits)

Trigger it from the API: POST /selfimprove/run (see backend/routes.py).
"""

import json
import logging

from langsmith import traceable

from rag.config import settings
from rag.ingestion.embedder import embed_texts
from rag.llm import complete
from rag.retrieval.retriever import chunk_id, random_chunks, retrieve

logger = logging.getLogger(__name__)


def generate_questions(chunk_text: str, n: int = 3) -> list[str]:
    """Ask the model for n questions the chunk answers — the 'generate' step.

    Returns [] on any parsing failure so one bad chunk can't kill the run.
    """
    prompt = (
        f"Write {n} diverse, answerable questions for which the following passage "
        "is the ground-truth answer. They should be the kind a user would actually "
        "ask, phrased naturally (not with document jargon).\n\n"
        f"PASSAGE:\n{chunk_text[:1500]}\n\n"
        'Reply with ONLY a JSON array of strings, no prose: ["question 1", "question 2"]'
    )
    raw = complete(prompt, model=settings.fast_model, max_tokens=256)
    try:
        start, end = raw.find("["), raw.rfind("]")
        if start == -1 or end == -1:
            raise ValueError("no JSON array in model output")
        questions = json.loads(raw[start:end + 1])
        return [str(q).strip() for q in questions if str(q).strip()][:n]
    except Exception:
        logger.warning("Self-eval: unparseable question list; skipping chunk", exc_info=True)
        return []


def _chunk_surfaced(query: str, ground_truth_id: str, top_k: int) -> bool:
    """Did retrieval surface the exact ground-truth chunk in its top-k?

    Exact chunk-id matching is the strict measure (SimRAG-style: did the exact
    passage surface), which is why the comparison uses retriever.chunk_id()
    rather than just page-level agreement.
    """
    embedding = embed_texts([query])[0]
    hits = retrieve(embedding, query_text=query, top_k=top_k)
    return any(chunk_id(h["metadata"]) == ground_truth_id for h in hits)


@traceable
def run_self_eval(
    num_samples: int | None = None,
    top_k: int | None = None,
    questions_per_chunk: int | None = None,
) -> dict:
    """Run the generate -> evaluate -> improve loop over random library chunks.

    Args:
        num_samples: how many chunks to sample (default settings.selfeval_num_samples).
        top_k: retrieval window used for the hit check.
        questions_per_chunk: questions generated per sampled chunk.

    Returns:
        Report dict with hit_rate, per-question results, worst queries, and an
        LLM suggestion for what to change.
    """
    num_samples = num_samples or settings.selfeval_num_samples
    top_k = top_k or settings.selfeval_top_k
    q_per = questions_per_chunk or settings.selfeval_questions_per_chunk

    samples = random_chunks(num_samples)
    if not samples:
        return {"status": "empty_library", "message": "Ingest some documents first."}

    results = []
    for s in samples:
        for q in generate_questions(s["text"], q_per):
            results.append({
                "question": q,
                "source": s["metadata"].get("source"),
                "page": s["metadata"].get("page"),
                "chunk": s["id"],
                "surfaced": _chunk_surfaced(q, s["id"], top_k),
            })

    total = len(results)
    hits = sum(1 for r in results if r["surfaced"])
    hit_rate = hits / total if total else 0.0
    missed = [r for r in results if not r["surfaced"]]

    report = {
        "status": "ok",
        "samples": len(samples),
        "questions": total,
        "hit_rate": round(hit_rate, 3),
        "top_k": top_k,
        "results": results,
        "worst_queries": [r["question"] for r in missed[:5]],
        "suggestions": _suggest_improvements(missed) if missed
        else "No failures — retrieval surfaced every ground-truth chunk.",
    }
    logger.info("Self-eval: %d/%d questions surfaced their chunk (%.0f%%)",
                hits, total, hit_rate * 100)
    return report


def _suggest_improvements(missed: list[dict]) -> str:
    """The 'improve' step: let the model explain the failure pattern."""
    examples = "\n".join(
        f"- Q: {m['question']}  (source: {m['source']})" for m in missed[:5]
    )
    prompt = (
        "A RAG system failed to retrieve the right chunk for the following user "
        "questions. In 3-5 sentences, what is the most likely failure pattern "
        "(vocabulary mismatch, need for query reformulation, chunking problem) "
        "and what concrete change would fix it?\n\n" + examples
    )
    return complete(prompt, model=settings.fast_model, max_tokens=256)
