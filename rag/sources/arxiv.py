"""arXiv source client: topic search + PDF download.

Wraps the `arxiv` PyPI package and normalizes results to the shared Paper type.
arXiv gives search, abstracts, and PDF links but no citation graph — citation
data comes from Semantic Scholar (see semantic_scholar.py).
"""

import logging
import tempfile
from pathlib import Path

import arxiv
import httpx

from rag.sources.base import Paper

logger = logging.getLogger(__name__)

_client = arxiv.Client()


def search_arxiv(query: str, max_results: int = 10) -> list[Paper]:
    """Search arXiv for the most recent relevant papers on a topic."""
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    papers: list[Paper] = []
    for result in _client.results(search):
        arxiv_id = result.get_short_id()
        papers.append(
            Paper(
                id=arxiv_id,
                title=result.title.strip(),
                authors=[a.name for a in result.authors],
                year=result.published.year if result.published else None,
                abstract=result.summary.strip(),
                url=result.entry_id,
                source="arxiv",
                pdf_url=result.pdf_url,
                external_ids={"ArXiv": arxiv_id},
            )
        )
    logger.info("arXiv search '%s' returned %d papers", query, len(papers))
    return papers


def download_pdf(paper: Paper) -> Path:
    """Download a paper's PDF to a temp file and return the path.

    Fetches the PDF directly over HTTP rather than via the arxiv package, whose
    download API changed across versions (Result.download_pdf was removed in 4.0).

    Raises ValueError if no PDF url can be resolved.
    """
    arxiv_id = paper.external_ids.get("ArXiv") or paper.id
    pdf_url = paper.pdf_url or (f"https://arxiv.org/pdf/{arxiv_id}" if arxiv_id else None)
    if not pdf_url:
        raise ValueError(f"Paper {paper.id} has no PDF url")

    tmp_dir = Path(tempfile.mkdtemp(prefix="arxiv_"))
    path = tmp_dir / f"{arxiv_id.replace('/', '_')}.pdf"
    with httpx.stream("GET", pdf_url, follow_redirects=True, timeout=60.0) as resp:
        resp.raise_for_status()
        with open(path, "wb") as f:
            for chunk in resp.iter_bytes():
                f.write(chunk)
    logger.info("Downloaded %s -> %s", arxiv_id, path)
    return path
