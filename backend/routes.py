"""FastAPI routes for the document Q&A service."""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.ingestion.loader import SUPPORTED_EXTENSIONS
from rag.pipelines.rag import answer, ingest_document
from rag.pipelines.research import discover, ingest_paper, summarize_recent_work
from rag.retrieval.retriever import collection_count, delete_source, list_sources
from rag.sources.base import Paper

logger = logging.getLogger(__name__)

app = FastAPI(title="Document Q&A", description="RAG-powered document question answering")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response models ---

class QuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    answer: str
    sources: list[dict]
    context_found: bool


class IngestResponse(BaseModel):
    filename: str
    chunks_stored: int


class StatusResponse(BaseModel):
    status: str
    total_chunks: int


# --- Routes ---

@app.get("/health", response_model=StatusResponse)
def health():
    """Check service health and collection size."""
    return {"status": "ok", "total_chunks": collection_count()}


@app.get("/documents")
def documents():
    """List all ingested document names."""
    return {"documents": list_sources()}


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    """Remove all chunks for the given document from the collection."""
    count = delete_source(filename)
    return {"filename": filename, "chunks_deleted": count}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(file: UploadFile):
    """Upload and ingest a document (PDF, DOCX, or TXT)."""
    from pathlib import Path as _Path
    ext = _Path(file.filename or "").suffix.lower()
    if not file.filename or ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Supported: {supported}")

    tmp_path = Path(f"/tmp/{file.filename}")
    try:
        content = await file.read()
        tmp_path.write_bytes(content)
        chunks_stored = ingest_document(tmp_path)
    except Exception as e:
        logger.error("Ingestion failed for %s: %s", file.filename, e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return {"filename": file.filename, "chunks_stored": chunks_stored}


@app.post("/ask", response_model=QuestionResponse)
def ask(request: QuestionRequest):
    """Answer a question using the ingested documents."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        result = answer(request.question)
    except Exception as e:
        logger.error("Answer generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return result


# --- Research endpoints ---

class DiscoverRequest(BaseModel):
    topic: str
    limit: int = 10


class SummarizeRequest(BaseModel):
    topic: str
    papers: list[dict]  # the paper dicts returned by /research/discover


class IngestPaperRequest(BaseModel):
    paper: dict  # a single paper dict returned by /research/discover


@app.post("/research/discover")
def research_discover(request: DiscoverRequest):
    """Find recent, relevant papers for a research topic (arXiv + Semantic Scholar)."""
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    try:
        return discover(request.topic, limit=request.limit)
    except Exception as e:
        logger.error("Discovery failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/research/summarize")
def research_summarize(request: SummarizeRequest):
    """Summarize recent work, citing only the supplied papers."""
    try:
        papers = [Paper(**p) for p in request.papers]
        return summarize_recent_work(request.topic, papers)
    except Exception as e:
        logger.error("Summarization failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/research/ingest")
def research_ingest(request: IngestPaperRequest):
    """Pull a discovered paper into the library so /ask can use it."""
    try:
        paper = Paper(**request.paper)
        return ingest_paper(paper)
    except Exception as e:
        logger.error("Paper ingestion failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e
