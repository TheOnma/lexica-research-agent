"""Unified paper discovery across arXiv and Semantic Scholar."""

import logging

from rag.sources import arxiv, semantic_scholar
from rag.sources.base import Paper

logger = logging.getLogger(__name__)


def _merge(primary: Paper, secondary: Paper) -> Paper:
    """Combine two records of the same paper, filling gaps from the secondary."""
    primary.abstract = primary.abstract or secondary.abstract
    primary.pdf_url = primary.pdf_url or secondary.pdf_url
    primary.year = primary.year or secondary.year
    primary.citation_count = max(primary.citation_count, secondary.citation_count)
    primary.external_ids = {**secondary.external_ids, **primary.external_ids}
    return primary


def _score(paper: Paper) -> float:
    """Rank blend: citation impact (log-damped) plus a recency bonus."""
    from math import log1p

    impact = log1p(paper.citation_count)
    recency = (paper.year - 2000) / 10 if paper.year else 0
    return impact + recency


def find_papers(topic: str, limit: int = 10) -> list[Paper]:
    """Search both sources for a topic, de-dupe, and rank.

    arXiv contributes recent preprints + PDF links; Semantic Scholar contributes
    citation counts and broader coverage. Results are de-duped by arXiv id / DOI /
    normalized title, with metadata merged across sources.
    """
    found: list[Paper] = []
    for fetch in (
        lambda: arxiv.search_arxiv(topic, max_results=limit),
        lambda: semantic_scholar.search_papers(topic, limit=limit),
    ):
        try:
            found.extend(fetch())
        except Exception as e:  # one source failing shouldn't kill discovery
            logger.warning("Paper source failed: %s", e)

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
