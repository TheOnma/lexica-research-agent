"""arXiv source client: topic search + PDF download.

Wraps the `arxiv` PyPI package and normalizes results to the shared Paper type.
arXiv gives search, abstracts, and PDF links but no citation graph — citation
data comes from Semantic Scholar (see semantic_scholar.py).
"""

import logging
import tempfile
from pathlib import Path

import arxiv

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

    Raises ValueError if the paper has no PDF url.
    """
    if not paper.pdf_url:
        raise ValueError(f"Paper {paper.id} has no PDF url")
    arxiv_id = paper.external_ids.get("ArXiv") or paper.id
    result = next(_client.results(arxiv.Search(id_list=[arxiv_id])))
    tmp_dir = Path(tempfile.mkdtemp(prefix="arxiv_"))
    filename = f"{arxiv_id.replace('/', '_')}.pdf"
    path = Path(result.download_pdf(dirpath=str(tmp_dir), filename=filename))
    logger.info("Downloaded %s -> %s", arxiv_id, path)
    return path
