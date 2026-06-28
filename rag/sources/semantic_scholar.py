"""Semantic Scholar Academic Graph client.

Provides keyword search plus the citation-graph endpoints (references, citations,
recommendations) that the future literature-map milestone needs. The API is free
and works without a key; an optional key (settings.s2_api_key) raises rate limits.
"""

import logging

import httpx

from rag.config import settings
from rag.sources.base import Paper

logger = logging.getLogger(__name__)

_BASE = "https://api.semanticscholar.org/graph/v1"
_REC_BASE = "https://api.semanticscholar.org/recommendations/v1"
_FIELDS = "title,abstract,year,authors,externalIds,citationCount,url,openAccessPdf"
_TIMEOUT = 20.0


def _headers() -> dict:
    return {"x-api-key": settings.s2_api_key} if settings.s2_api_key else {}


def _to_paper(item: dict) -> Paper | None:
    """Normalize a Semantic Scholar paper object to a Paper, or None if unusable."""
    if not item or not item.get("title"):
        return None
    external = item.get("externalIds") or {}
    pdf = (item.get("openAccessPdf") or {}).get("url")
    paper_id = external.get("ArXiv") or external.get("DOI") or item.get("paperId", "")
    return Paper(
        id=paper_id,
        title=item["title"].strip(),
        authors=[a.get("name", "") for a in (item.get("authors") or [])],
        year=item.get("year"),
        abstract=(item.get("abstract") or "").strip(),
        url=item.get("url", ""),
        source="semantic_scholar",
        pdf_url=pdf,
        citation_count=item.get("citationCount") or 0,
        external_ids=external,
    )


def _get(url: str, params: dict | None = None) -> dict:
    resp = httpx.get(url, params=params, headers=_headers(), timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def search_papers(query: str, limit: int = 10) -> list[Paper]:
    """Keyword search over the Semantic Scholar corpus."""
    data = _get(
        f"{_BASE}/paper/search",
        params={"query": query, "limit": limit, "fields": _FIELDS},
    )
    papers = [p for p in (_to_paper(i) for i in data.get("data", [])) if p]
    logger.info("Semantic Scholar search '%s' returned %d papers", query, len(papers))
    return papers


def _paper_id_param(paper: Paper) -> str:
    """Build the id Semantic Scholar accepts (prefers ARXIV:/DOI: prefixes)."""
    if paper.external_ids.get("ArXiv"):
        return f"ARXIV:{paper.external_ids['ArXiv']}"
    if paper.external_ids.get("DOI"):
        return f"DOI:{paper.external_ids['DOI']}"
    return paper.id


def get_references(paper: Paper, limit: int = 50) -> list[Paper]:
    """Papers that the given paper cites (its bibliography)."""
    data = _get(
        f"{_BASE}/paper/{_paper_id_param(paper)}/references",
        params={"limit": limit, "fields": _FIELDS},
    )
    return [p for p in (_to_paper(i.get("citedPaper", {})) for i in data.get("data", [])) if p]


def get_citations(paper: Paper, limit: int = 50) -> list[Paper]:
    """Papers that cite the given paper."""
    data = _get(
        f"{_BASE}/paper/{_paper_id_param(paper)}/citations",
        params={"limit": limit, "fields": _FIELDS},
    )
    return [p for p in (_to_paper(i.get("citingPaper", {})) for i in data.get("data", [])) if p]


def recommendations(paper: Paper, limit: int = 20) -> list[Paper]:
    """Papers recommended as similar to the given paper."""
    data = _get(
        f"{_REC_BASE}/papers/forpaper/{_paper_id_param(paper)}",
        params={"limit": limit, "fields": _FIELDS},
    )
    return [p for p in (_to_paper(i) for i in data.get("recommendedPapers", [])) if p]
