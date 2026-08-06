"""FastAPI routes for the document Q&A service."""

import logging
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.ingestion.loader import SUPPORTED_EXTENSIONS
from rag.pipelines.rag import answer, answer_stream, ingest_document
from rag.tasks import process_document_task, process_paper_task
from rag.pipelines.research import discover, ingest_paper, summarize_recent_work
from rag.retrieval.retriever import collection_count, delete_source, list_sources
from rag.sources.base import Paper
from rag.agent.graph import app as agent_app
from langchain_core.messages import HumanMessage
from celery.result import AsyncResult
from rag.celery_app import celery_app

logger = logging.getLogger(__name__)

app = FastAPI(title="Research Agent", description="RAG-powered research agent.")

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
    task_id: str | None = None
    chunks_stored: int | None = None
    status: str | None = None


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
        
        # Dispatch the background task to Celery
        task = process_document_task.delay(str(tmp_path))
        
        # We DO NOT unlink tmp_path here, because the background worker needs to read it!
        # The worker will delete it when it finishes.
    except Exception as e:
        logger.error("Ingestion failed for %s: %s", file.filename, e)
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

    return {"filename": file.filename, "task_id": task.id, "status": "Processing"}


@app.get("/task/{task_id}")
def get_task_status(task_id: str):
    """Check the status of a Celery background task."""
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.state,
        "result": result.result if result.ready() else None
    }


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


@app.post("/ask_stream")
def ask_stream(request: QuestionRequest):
    """Answer a question using the ingested documents, streaming the response."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    def event_generator():
        try:
            for chunk in answer_stream(request.question):
                # Format exactly as Server-Sent Events (SSE): "data: {...}\n\n"
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error("Streaming Answer generation failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
    """Pull a discovered paper into the library so /ask can use it (Async)."""
    try:
        # Dispatch the paper ingestion to Celery background worker
        task = process_paper_task.delay(request.paper)
        return {"title": request.paper.get("title"), "task_id": task.id, "status": "Processing"}
    except Exception as e:
        logger.error("Paper ingestion failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Agent endpoints ---

class AgentChatRequest(BaseModel):
    message: str

@app.post("/agent/chat")
def agent_chat(request: AgentChatRequest):
    """Chat with the ReAct agent, which can autonomously use tools."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    try:
        # We pass a HumanMessage into the graph state
        inputs = {"messages": [HumanMessage(content=request.message)]}
        
        # Invoke runs the entire graph cycle until it reaches END
        result = agent_app.invoke(inputs)
        
        # The result state contains the entire message history.
        # We return the content of the very last message.
        final_message = result["messages"][-1].content
        return {"response": final_message}
    except Exception as e:
        logger.error("Agent chat failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.post("/agent/chat_stream")
async def agent_chat_stream(request: AgentChatRequest):
    """Stream chat with the ReAct agent."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async def generate():
        inputs = {"messages": [HumanMessage(content=request.message)]}
        try:
            async for event in agent_app.astream_events(inputs, version="v2", config={"recursion_limit": 5}):
                kind = event["event"]
                
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if chunk.content:
                        # Anthropic can return content as a list of dicts sometimes for tool calls, 
                        # but text chunks are strings or have string content.
                        if isinstance(chunk.content, str):
                            yield f"data: {json.dumps({'type': 'text', 'content': chunk.content})}\n\n"
                        elif isinstance(chunk.content, list):
                            for item in chunk.content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    yield f"data: {json.dumps({'type': 'text', 'content': item['text']})}\n\n"
                
                elif kind == "on_tool_start":
                    yield f"data: {json.dumps({'type': 'tool_start', 'tool': event['name'], 'input': event['data'].get('input')})}\n\n"
                    
                elif kind == "on_tool_end":
                    # Tool output is generally a string from our tools
                    output = event['data'].get('output')
                    if hasattr(output, "content"):
                        output = output.content
                    yield f"data: {json.dumps({'type': 'tool_end', 'tool': event['name'], 'output': output})}\n\n"
                    
        except Exception as e:
            logger.error("Agent stream failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
