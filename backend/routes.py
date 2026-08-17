"""FastAPI routes for the document Q&A service."""

import logging
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.config import settings
from rag.ingestion.loader import SUPPORTED_EXTENSIONS
from rag.ingestion.library import load_source_pages
from rag.pipelines.rag import answer, answer_stream, ingest_document
from rag.tasks import process_document_task, process_paper_task
from rag.pipelines.research import discover, ingest_paper, summarize_recent_work
from rag.retrieval.retriever import collection_count, delete_source, list_sources
from rag.sources import arxiv
from rag.sources.base import Paper
from rag.selfimprove import run_self_eval
from rag.agent.graph import app as agent_app
from langchain_core.messages import AIMessage, HumanMessage
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
    # Optional: restrict retrieval to a single document (the "ask about this
    # paper" flow in the Library). Backward compatible — omitted = whole corpus.
    source: str | None = None


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
    """Remove all chunks for the given document (path-based; legacy form)."""
    return _delete_source(filename)


@app.delete("/documents")
def delete_document_by_name(name: str):
    """Remove all chunks for the given document.

    Query-param variant: source names are paper titles that can contain
    slashes, which a path segment cannot carry.
    """
    if not name.strip():
        raise HTTPException(status_code=400, detail="name cannot be empty")
    return _delete_source(name)


def _delete_source(name: str) -> dict:
    """Shared delete logic: Chroma chunks + saved extracted text."""
    count = delete_source(name)
    return {"filename": name, "chunks_deleted": count}


@app.get("/documents/text")
def document_text(name: str):
    """Return the saved full text (pages) of an ingested source for reading.

    Query param (not a path segment) because source names are paper titles
    that can contain slashes and other characters.
    """
    if not name.strip():
        raise HTTPException(status_code=400, detail="name cannot be empty")
    data = load_source_pages(name)
    if data is None:
        raise HTTPException(status_code=404, detail="No saved text for this document")
    return data


@app.post("/ingest", response_model=IngestResponse)
async def ingest(file: UploadFile):
    """Upload and ingest a document (PDF, DOCX, or TXT)."""
    ext = Path(file.filename or "").suffix.lower()
    if not file.filename or ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Supported: {supported}")

    # Stage the file where the Celery worker can reach it (shared volume in Docker).
    # We use only the basename to prevent path traversal from a malicious filename.
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = upload_dir / Path(file.filename).name
    try:
        content = await file.read()
        tmp_path.write_bytes(content)

        # Dispatch the background task to Celery
        task = process_document_task.delay(str(tmp_path))

        # NOTE: do NOT unlink tmp_path here — the background worker still needs to
        # read it. The worker deletes it when it finishes.
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
        result = answer(request.question, source=request.source)
    except Exception as e:
        logger.error("Answer generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return result


@app.post("/ask_stream")
def _ask_stream_events(request: QuestionRequest):
    """Stream answer events (sources / text / error) as SSE-formatted strings.

    Extracted from the route so tests can iterate the generator directly.
    """
    try:
        for chunk in answer_stream(request.question, source=request.source):
            yield f"data: {json.dumps(chunk)}\n\n"
    except Exception as e:
        logger.error("Streaming Answer generation failed: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"


@app.post("/ask_stream")
def ask_stream(request: QuestionRequest):
    """Answer a question using the ingested documents, streaming the response."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    return StreamingResponse(_ask_stream_events(request), media_type="text/event-stream")


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


class IngestArxivRequest(BaseModel):
    arxiv_id: str


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


@app.post("/research/ingest_arxiv")
def research_ingest_arxiv(request: IngestArxivRequest):
    """Fetch a paper by its exact arXiv ID and queue it for ingestion (Async).

    The one-click "Save" on a search-result card needs only the ID the card
    already carries — no need to reconstruct the full paper dict client-side
    (authors are a list server-side, not the display string).
    """
    if not request.arxiv_id.strip():
        raise HTTPException(status_code=400, detail="arxiv_id cannot be empty")
    try:
        paper = arxiv.fetch_by_id(request.arxiv_id.strip())
        task = process_paper_task.delay(paper.to_dict())
        return {"title": paper.title, "arxiv_id": request.arxiv_id, "task_id": task.id, "status": "Processing"}
    except Exception as e:
        logger.error("arXiv ingest failed for %s: %s", request.arxiv_id, e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Self-improvement (SimRAG-style) ---

class SelfEvalRequest(BaseModel):
    num_samples: int | None = None
    top_k: int | None = None
    questions_per_chunk: int | None = None


@app.post("/selfimprove/run")
def selfimprove_run(request: SelfEvalRequest):
    """Run the SimRAG-style self-evaluation loop over the library.

    The model generates questions from sampled chunks, we check how often
    retrieval surfaces the exact source chunk (hit rate), and the report
    includes the worst queries plus an LLM suggestion for what to change.
    """
    try:
        return run_self_eval(
            num_samples=request.num_samples,
            top_k=request.top_k,
            questions_per_chunk=request.questions_per_chunk,
        )
    except Exception as e:
        logger.error("Self-eval failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Agent endpoints ---

class AgentChatRequest(BaseModel):
    message: str
    # Tier-0 conversation memory: prior turns as [{role: "user"|"assistant", content}].
    # Optional so existing clients sending only {message} keep working.
    history: list[dict] = []


# Cap on how much prior conversation we replay into the graph state. Bounding
# this is the same instinct as the soft tool budget (rag/agent/graph.py): memory
# that grows unbounded becomes a cost and latency tax on every request.
MAX_HISTORY_MESSAGES = 20


def build_agent_inputs(message: str, history: list[dict] | None = None) -> dict:
    """Build the graph state from the new message plus prior conversation turns.

    Only human/assistant text is replayed. Tool events are display-only in the
    UI, and reconstructing LangChain ToolMessages without exact tool_call_ids is
    fragile; the assistant's text already summarizes what it found (e.g. the
    numbered paper list), which is what references like "the first and second"
    resolve against. Unknown roles and empty/non-string content are skipped so a
    buggy or malicious client can't crash state seeding.
    """
    msgs = []
    for turn in (history or [])[-MAX_HISTORY_MESSAGES:]:
        role = turn.get("role")
        content = turn.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        if role == "assistant":
            msgs.append(AIMessage(content=content))
        elif role == "user":
            msgs.append(HumanMessage(content=content))
        # unknown roles: skip
    msgs.append(HumanMessage(content=message))
    return {"messages": msgs}


@app.post("/agent/chat")
def agent_chat(request: AgentChatRequest):
    """Chat with the ReAct agent, which can autonomously use tools."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    try:
        # Seed the graph state with prior turns + the new message (Tier-0 memory)
        inputs = build_agent_inputs(request.message, request.history)
        
        # Invoke runs the entire graph cycle until it reaches END
        # Updated recursion limit to 50 from 5
        result = agent_app.invoke(inputs, config={"recursion_limit": 50})
        
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
        # Seed the graph state with prior turns + the new message (Tier-0 memory)
        inputs = build_agent_inputs(request.message, request.history)
        try:
            async for event in agent_app.astream_events(inputs, version="v2", config={"recursion_limit": 50}):
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
