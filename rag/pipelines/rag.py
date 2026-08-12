"""End-to-end RAG pipeline: ingest PDFs and answer questions."""

import logging
from pathlib import Path

from typing import Iterator
from rag.config import settings
from rag.ingestion.chunker import chunk_pages
from rag.ingestion.embedder import embed_chunks, embed_texts
from rag.ingestion.loader import load_document, load_documents_from_dir, load_pdf, load_pdfs_from_dir
from rag.llm import complete, complete_stream
from rag.retrieval.relevance import corrective_retrieve
from rag.retrieval.retriever import add_chunks, retrieve
from langsmith import traceable

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a precise document assistant. Answer questions using only the provided context.
If the answer is not in the context, say "I don't have enough information in the provided documents to answer that."
Always cite your sources by mentioning the document name and page number."""

RAG_PROMPT_TEMPLATE = """CONTEXT:
{context}

QUESTION:
{question}

INSTRUCTIONS:
Answer using only the context above. Cite sources as (source, page N). If the answer is not in the context, say so."""


def _generate_hypothetical_answer(question: str) -> str:
    """
    HyDE: generate a hypothetical document passage that would answer the question.

    Embedding this passage instead of the raw question dramatically improves
    retrieval because the generated text uses the same vocabulary as the document.
    Uses the cheap/fast Claude model to keep this step inexpensive.
    """
    hypothetical = complete(
        question,
        system=(
            "Write a concise, factual passage from a technical document that directly "
            "answers the given question. Use formal, document-like language. "
            "Do not say 'Based on' or reference yourself."
        ),
        model=settings.fast_model,
        max_tokens=256,
    )
    logger.info("HyDE passage (first 120 chars): %s", hypothetical[:120])
    return hypothetical


def _retrieve_hybrid(question: str, top_k: int | None = None) -> list[dict]:
    """HyDE -> embed -> hybrid retrieve for one question.

    Shared by the plain path and the CRAG corrective loop (each reformulated
    query goes through its own HyDE pass so the new wording drives retrieval).
    """
    hypothetical = _generate_hypothetical_answer(question)
    query_embedding = embed_texts([hypothetical])[0]
    return retrieve(query_embedding, query_text=question, top_k=top_k)


@traceable
def ingest_document(path: str | Path) -> int:
    """
    Load, chunk, embed, and store a single document (PDF, DOCX, or TXT).

    Returns:
        number of chunks stored
    """
    logger.info("Ingesting %s", path)
    pages = load_document(path)
    chunks = chunk_pages(pages)
    chunks = embed_chunks(chunks)
    add_chunks(chunks)
    return len(chunks)


def ingest_pdf(path: str | Path) -> int:
    """Ingest a PDF. Kept for backward compatibility — delegates to ingest_document."""
    return ingest_document(path)


def ingest_directory(directory: str | Path) -> int:
    """Ingest all supported documents from a directory. Returns total chunks stored."""
    pages = load_documents_from_dir(directory)
    chunks = chunk_pages(pages)
    chunks = embed_chunks(chunks)
    add_chunks(chunks)
    return len(chunks)


@traceable
def answer(question: str) -> dict:
    """
    Answer a question using retrieved document context.

    Args:
        question — natural language question

    Returns:
        {
            "answer": str,
            "sources": list[dict],   # retrieved chunks with metadata and scores
            "context_found": bool,
        }
    """
    logger.info("Query: %s", question)

    # 1+2. Retrieve relevant chunks (hybrid dense + BM25). When relevance
    # evaluation is enabled, the CRAG corrective loop judges the chunks and
    # reformulates + re-retrieves if the first pass missed.
    if settings.relevance_eval_enabled:
        retrieved = corrective_retrieve(
            question, _retrieve_hybrid, top_chunks=settings.top_k
        )
    else:
        retrieved = _retrieve_hybrid(question)

    if not retrieved:
        logger.warning("No relevant context found for query")
        return {
            "answer": "I don't have enough information in the provided documents to answer that.",
            "sources": [],
            "context_found": False,
        }

    # 3. Build context block with citations
    context_lines = []
    for i, chunk in enumerate(retrieved, 1):
        meta = chunk["metadata"]
        context_lines.append(
            f"[{i}] Source: {meta['source']}, Page {meta['page']}\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_lines)

    # 4. Generate answer with Claude
    prompt = RAG_PROMPT_TEMPLATE.format(context=context, question=question)
    answer_text = complete(prompt, system=SYSTEM_PROMPT, model=settings.llm_model, max_tokens=1024)
    logger.info("Answer generated (%d chars)", len(answer_text))

    return {
        "answer": answer_text,
        "sources": [
            {"source": c["metadata"]["source"], "page": c["metadata"]["page"], "score": round(c["score"], 3)}
            for c in retrieved
        ],
        "context_found": True,
    }


@traceable
def answer_stream(question: str) -> Iterator[dict]:
    """
    Answer a question using retrieved document context, yielding the response incrementally.

    Yields:
        {"type": "sources", "data": list[dict]}
        {"type": "text", "data": str}
    """
    logger.info("Query (Stream): %s", question)

    # 1+2. Retrieve relevant chunks (CRAG corrective loop when enabled)
    if settings.relevance_eval_enabled:
        retrieved = corrective_retrieve(
            question, _retrieve_hybrid, top_chunks=settings.top_k
        )
    else:
        retrieved = _retrieve_hybrid(question)

    if not retrieved:
        logger.warning("No relevant context found for query")
        yield {
            "type": "error",
            "data": "I don't have enough information in the provided documents to answer that."
        }
        return

    # Yield sources first so the UI can display them immediately
    sources = [
        {"source": c["metadata"]["source"], "page": c["metadata"]["page"], "score": round(c["score"], 3), "text": c["text"]}
        for c in retrieved
    ]
    yield {"type": "sources", "data": sources}

    # 3. Build context block with citations
    context_lines = []
    for i, chunk in enumerate(retrieved, 1):
        meta = chunk["metadata"]
        context_lines.append(
            f"[{i}] Source: {meta['source']}, Page {meta['page']}\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_lines)

    # 4. Generate answer with Claude and yield chunks
    prompt = RAG_PROMPT_TEMPLATE.format(context=context, question=question)
    for text_chunk in complete_stream(prompt, system=SYSTEM_PROMPT, model=settings.llm_model, max_tokens=1024):
        yield {"type": "text", "data": text_chunk}
