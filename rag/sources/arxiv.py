"""arXiv source client: topic search + PDF download.

Wraps the `arxiv` PyPI package and normalizes results to the shared Paper type.
"""

import logging
import re
import tempfile
from pathlib import Path

import arxiv
import requests

from rag.sources.base import Paper

logger = logging.getLogger(__name__)

_client = arxiv.Client()

_STOPWORDS = {"a", "an", "the", "on", "of", "and", "or", "for", "in", "to", "with", "into", "about", "from", "using", "use"}


def _topic_terms(topic: str) -> set[str]:
    """Content words of a topic, e.g. 'self improving rag' -> {'self', 'improving', 'rag'}."""
    return {w for w in re.findall(r"[a-z0-9]+", topic.lower()) if len(w) > 2 and w not in _STOPWORDS}


def _arxiv_query(topic: str) -> str:
    """Build a precise arXiv query: exact phrase OR'd with keyword ANDs.

    A bare multi-word topic is treated as fuzzy free text by the arXiv API and
    returns loosely-related results. Quoted phrases + field prefixes + boolean
    operators behave like a real search.
    """
    phrase = f'all:"{topic.strip()}"'
    keywords = " AND ".join(f'all:"{t}"' for t in sorted(_topic_terms(topic)))
    return f"({phrase}) OR ({keywords})"


def _to_paper(result: arxiv.Result) -> Paper:
    """Normalize a single arXiv Result to a Paper (shared by search + id fetch)."""
    arxiv_id = result.get_short_id()
    return Paper(
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


def search_arxiv(query: str, max_results: int = 10) -> list[Paper]:
    """Search arXiv for the most relevant papers on a topic."""
    search = arxiv.Search(
        query=_arxiv_query(query),
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    return [_to_paper(r) for r in _client.results(search)]


def fetch_by_id(arxiv_id: str) -> Paper:
    """Fetch exactly one paper by its arXiv ID (used by ingest — cannot grab the wrong paper)."""
    result = next(_client.results(arxiv.Search(id_list=[arxiv_id])))
    return _to_paper(result)


def download_pdf(paper: Paper) -> Path:
    """Download a paper's PDF to a temp file and return the path.

    arXiv >= 4.0 removed the library's PDF-download helpers entirely
    (Result.download_pdf never existed on the Result object, and the module-
    level helper was dropped), so we fetch the PDF directly from the URL the
    API provides. Plain HTTP also makes this immune to future arxiv API churn
    — the version pin is `arxiv>=2.1.0`, so a fresh clone may resolve any 2.x.
    """
    pdf_url = paper.pdf_url
    if not pdf_url:
        arxiv_id = paper.external_ids.get("ArXiv") or paper.id
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
    tmp_dir = Path(tempfile.mkdtemp(prefix="arxiv_"))
    filename = f"{paper.id.replace('/', '_')}.pdf"
    path = tmp_dir / filename
    resp = requests.get(
        pdf_url,
        headers={
            "User-Agent": "Mozilla/5.0 (research-agent; +https://github.com/TheOnma/research-agent)"
        },
        timeout=60,
    )
    resp.raise_for_status()
    path.write_bytes(resp.content)
    logger.info("Downloaded %s -> %s", paper.id, path)
    return path
