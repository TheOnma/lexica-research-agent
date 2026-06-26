"""Research pipeline: discover papers, summarize recent work, ingest into the library.

Sits beside the document-Q&A pipeline (rag.pipelines.rag) and reuses the same
chunk -> embed -> store path so discovered papers become answerable via /ask.
"""

import logging

from rag.config import settings
from rag.ingestion.chunker import chunk_pages
from rag.ingestion.embedder import embed_chunks
from rag.ingestion.loader import load_document
from rag.llm import complete
from rag.retrieval.retriever import add_chunks
from rag.sources import arxiv, find_papers
from rag.sources.base import Paper

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """You are a research literature assistant. Write a concise \
synthesis of the recent work on the user's topic using ONLY the numbered papers \
provided. Cite claims with bracketed numbers like [1] or [2, 3] that refer to those \
papers. CRITICAL: never cite a number that is not in the provided list, and never \
invent papers, authors, findings, or results. If the papers don't cover something, \
say so rather than guessing. Group related work and highlight trends and disagreements."""


def discover(topic: str, limit: int = 10) -> dict:
    """Find recent, relevant papers for a research topic."""
    papers = find_papers(topic, limit=limit)
    return {"papers": [p.to_dict() for p in papers]}


def _author_label(authors: list[str]) -> str:
    if not authors:
        return "Unknown"
    return authors[0] + (" et al." if len(authors) > 1 else "")


def summarize_recent_work(topic: str, papers: list[Paper]) -> dict:
    """Synthesize a grounded 'recent work' summary citing only the given papers.

    Returns the summary plus the reference list so callers can render real,
    clickable citations and verify the [i] markers map to actual papers.
    """
    references = [
        {
            "index": i,
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "year": p.year,
            "url": p.url,
        }
        for i, p in enumerate(papers, 1)
    ]
    if not papers:
        return {"summary": "No papers were found for this topic.", "references": []}

    context = "\n\n".join(
        f"[{i}] {p.title} ({_author_label(p.authors)}, {p.year or 'n.d.'})\n{p.abstract}"
        for i, p in enumerate(papers, 1)
    )
    prompt = (
        f"TOPIC: {topic}\n\nPAPERS:\n{context}\n\n"
        "Write the recent-work synthesis now, citing with [i] markers."
    )
    summary = complete(prompt, system=SUMMARY_SYSTEM_PROMPT, model=settings.llm_model, max_tokens=1024)
    return {"summary": summary, "references": references}


def _paper_label(paper: Paper) -> str:
    """Human-readable source label used for citations in the /ask flow."""
    year = f" ({paper.year})" if paper.year else ""
    return f"{paper.title}{year}"


def ingest_paper(paper: Paper) -> dict:
    """Pull a paper's full text (arXiv PDF) or abstract into the ChromaDB library."""
    if paper.external_ids.get("ArXiv"):
        path = arxiv.download_pdf(paper)
        pages = load_document(path)
    else:
        # No reliable full text — fall back to the abstract as a single page.
        pages = [{"text": paper.abstract, "metadata": {"source": _paper_label(paper), "page": 1}}]

    label = _paper_label(paper)
    for page in pages:
        page["metadata"]["source"] = label

    chunks = chunk_pages(pages)
    chunks = embed_chunks(chunks)
    add_chunks(chunks)
    logger.info("Ingested paper '%s' (%d chunks)", paper.title, len(chunks))
    return {"title": paper.title, "chunks_stored": len(chunks)}
