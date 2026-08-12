"""Unified paper discovery across arXiv and Semantic Scholar."""

import logging
import re
from datetime import date
from math import log1p

from rag.sources import arxiv, semantic_scholar
from rag.sources.base import Paper

logger = logging.getLogger(__name__)

_STOPWORDS = {"a", "an", "the", "on", "of", "and", "or", "for", "in", "to", "with", "into", "about", "from", "using", "use"}


def _topic_terms(topic: str) -> set[str]:
    """Content words of the topic, e.g. 'self improving rag' -> {'self','improving','rag'}."""
    return {w for w in re.findall(r"[a-z0-9]+", topic.lower()) if len(w) > 2 and w not in _STOPWORDS}


def _lexically_relevant(paper: Paper, terms_: set[str]) -> bool:
    """Cheap recall gate: keep a paper only if at least one topic word appears in its title or abstract.

    Uses word-boundary matching so 'rag' doesn't match 'fragmented'. This is a lax,
    fast filter that kills blatantly irrelevant hits (a 2014 quantum-physics paper
    has none of {self, improving, rag}); precision comes from the sources + ranking.
    """
    if not terms_:
        return True
    haystack = f"{paper.title} {paper.abstract}".lower()
    return any(re.search(rf"\b{re.escape(t)}\b", haystack) for t in terms_)


def _score(paper: Paper) -> float:
    """Recency-weighted impact.

    log1p(citations) alone lets old, highly-cited, irrelevant papers dominate.
    Multiplying by an exponential decay (weight halves every ~3 years) lets recent
    work win — right for 'find me the LATEST papers'.
    """
    impact = log1p(paper.citation_count)
    if paper.year and paper.year >= 2000:
        age = date.today().year - paper.year
        recency = 2.0 * (0.5 ** (age / 3.0))
    else:
        recency = 0.1
    return impact * recency


def _merge(primary: Paper, secondary: Paper) -> Paper:
    """Combine two records of the same paper, filling gaps from the secondary."""
    primary.abstract = primary.abstract or secondary.abstract
    primary.pdf_url = primary.pdf_url or secondary.pdf_url
    primary.year = primary.year or secondary.year
    primary.citation_count = max(primary.citation_count, secondary.citation_count)
    primary.external_ids = {**secondary.external_ids, **primary.external_ids}
    return primary


def find_papers(topic: str, limit: int = 10) -> list[Paper]:
    """Search both sources for a topic, filter, de-dupe, and rank."""
    terms_ = _topic_terms(topic)
    found: list[Paper] = []
    for fetch in (
        lambda: arxiv.search_arxiv(topic, max_results=limit),
        lambda: semantic_scholar.search_papers(topic, limit=limit),
    ):
        try:
            found.extend(fetch())
        except Exception as e:  # one source failing shouldn't kill discovery
            logger.warning("Paper source failed: %s", e)

    # Drop obviously-irrelevant results before merging/ranking — but only when the
    # topic gives us >=2 content words. A single-term gate cannot discriminate
    # (a paper titled "Retrieval Augmented Generation" does not contain the word
    # "rag") and would wrongly delete everything, so it only makes things worse.
    if len(terms_) >= 2:
        found = [p for p in found if _lexically_relevant(p, terms_)]

    by_key: dict[str, Paper] = {}
    for paper in found:
        key = paper.dedup_key
        if key in by_key:
            _merge(by_key[key], paper)
        else:
            by_key[key] = paper

    ranked = sorted(by_key.values(), key=_score, reverse=True)
    logger.info("find_papers('%s') -> %d unique papers", topic, len(ranked))
    return ranked[:limit]
