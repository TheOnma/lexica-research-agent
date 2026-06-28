"""Shared types for paper-source clients (arXiv, Semantic Scholar)."""

import re
from dataclasses import asdict, dataclass, field


@dataclass
class Paper:
    """A research paper normalized across sources."""

    id: str                       # canonical id: arxiv id, else DOI, else S2 paperId
    title: str
    authors: list[str]
    year: int | None
    abstract: str
    url: str
    source: str                   # "arxiv" | "semantic_scholar"
    pdf_url: str | None = None
    citation_count: int = 0
    external_ids: dict = field(default_factory=dict)  # e.g. {"DOI": ..., "ArXiv": ...}

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def dedup_key(self) -> str:
        """A stable key for de-duplicating the same paper seen from two sources.

        Prefer a strong identifier (arXiv id or DOI); fall back to a normalized
        title so the same paper from arXiv and Semantic Scholar collapses.
        """
        arxiv_id = self.external_ids.get("ArXiv") or (
            self.id if self.source == "arxiv" else None
        )
        if arxiv_id:
            return f"arxiv:{_normalize_arxiv_id(arxiv_id)}"
        doi = self.external_ids.get("DOI")
        if doi:
            return f"doi:{doi.lower()}"
        return f"title:{_normalize_title(self.title)}"


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def _normalize_arxiv_id(arxiv_id: str) -> str:
    """Strip URL prefixes and version suffixes from an arXiv id (e.g. 2304.01234v2)."""
    arxiv_id = arxiv_id.rsplit("/", 1)[-1]
    return re.sub(r"v\d+$", "", arxiv_id)
