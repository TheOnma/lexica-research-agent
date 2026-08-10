# Lexica — An Autonomous AI Research Assistant

A local-first research copilot: upload your own documents and ask grounded, cited questions — and let a LangGraph agent autonomously search [arXiv](https://arxiv.org) and [Semantic Scholar](https://www.semanticscholar.org/), pull papers into your library, and synthesize answers you can verify line-by-line.

---

## Features

**Agent workspace** (`/chat`)
- **LangGraph ReAct agent** — the agent decides whether to search your local library, search arXiv/Semantic Scholar, or ingest a paper, and streams every tool call live into the UI (with abort support)
- **Live tool execution** — see each tool run as it happens: *"Searching arXiv for research papers…"*, then clickable paper cards rendered inline
- **Streaming SSE** — answers stream token-by-token; click any citation to jump to the exact paragraph in your local PDF

**Grounded local RAG**
- **Multi-format upload** — PDF, Word (.docx), and plain text (.txt), ingested asynchronously via a Celery worker
- **Hybrid retrieval** — dense vector search (OpenAI embeddings) + BM25 keyword search, merged with Reciprocal Rank Fusion (RRF)
- **HyDE** — a hypothetical answer is generated and embedded before retrieval to close the vocabulary gap between question and document
- **Citation grounding** — the model answers only from retrieved context; below the answer, every source links back to document + page + extracted text

**Paper discovery**
- **arXiv + Semantic Scholar** search, cross-source de-duplication/merging, ranked by citation impact and recency
- **Grounded literature summaries** — a synthesis that cites *only* the returned papers (a guard rejects invented citations)
- **One-click ingest** — pull any discovered paper's full text into your library so the Q&A flow can use it

**Both**
- Polished Next.js UI — landing page + 3-panel workspace, light/dark theme, drag-and-drop upload, recent-conversation history (localStorage)
- **CLI** — ingest and query documents from the terminal
- **Persistent storage** — ChromaDB on disk, nothing lost between restarts

---

## Tech Stack

| Layer | Choice |
|---|---|
| Agent orchestration | LangGraph (ReAct loop) + `langchain-anthropic` |
| LLM | Claude (Anthropic) — `claude-sonnet-4-6` (answers/synthesis/agent), `claude-haiku-4-5` (HyDE) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| Paper sources | arXiv API + Semantic Scholar Academic Graph API |
| Vector store | ChromaDB (local, persistent) |
| Keyword search | BM25 (`rank-bm25`) |
| Async ingestion | Celery + Redis broker |
| API | FastAPI + uvicorn (`:8000`) |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + pnpm (`:3000`) |

---

## Project Structure

```
research-agent/
├── rag/
│   ├── config.py              # Settings via pydantic-settings + .env
│   ├── llm.py                 # Claude wrapper (complete / complete_stream)
│   ├── celery_app.py          # Celery app (Redis broker) + task imports
│   ├── tasks.py               # Background tasks: process_document / process_paper
│   ├── ingestion/
│   │   ├── loader.py          # PDF, DOCX, TXT loaders
│   │   ├── chunker.py         # Recursive character splitter
│   │   └── embedder.py        # OpenAI embeddings
│   ├── retrieval/
│   │   └── retriever.py       # ChromaDB + BM25 + RRF hybrid retrieval
│   ├── sources/               # Paper discovery
│   │   ├── base.py            # Normalized Paper type + cross-source dedup
│   │   ├── arxiv.py           # arXiv search + PDF download
│   │   ├── semantic_scholar.py# Search + citations/references/recommendations
│   │   └── __init__.py        # find_papers: merge + de-dupe + rank
│   ├── pipelines/
│   │   ├── rag.py             # Ingest + answer pipeline (HyDE, citations, streaming)
│   │   └── research.py        # discover / summarize_recent_work / ingest_paper
│   └── agent/
│       ├── tools.py           # search_local_library, search_arxiv_for_papers, ingest_arxiv_paper
│       └── graph.py           # LangGraph ReAct agent graph
├── backend/
│   └── routes.py              # FastAPI: /ingest, /ask, /documents, /research/*, /agent/*
├── frontend/                  # Next.js 16 app (pnpm)
│   └── src/
│       ├── app/               # / (landing), /chat (workspace), layout, globals.css
│       ├── components/        # ThemeProvider, ThemeToggle, ui/icons
│       └── lib/api.ts         # Fetch wrappers for all API endpoints
├── evals/                     # Q&A harness + research citation-grounding eval
├── tests/                     # Mocked unit tests (pytest) — no network required
├── main.py                    # CLI entry point (serve / ingest / ask)
├── Dockerfile                 # API + worker image
├── docker-compose.yml         # redis + api + worker + frontend
├── .env.example               # Copy to .env and fill in keys
└── requirements.txt
```

---

## Quick Start

> **Prerequisites:** Docker (for Option A) or Python 3.11+ / Node 20+ / Redis (for Option B). You need an [Anthropic](https://console.anthropic.com/) API key and an [OpenAI](https://platform.openai.com/) API key.

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/TheOnma/research-agent.git
cd research-agent

cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY and OPENAI_API_KEY

docker compose up --build
```

Then open:

- **UI:** http://localhost:3000
- **API:** http://localhost:8000 — interactive docs at http://localhost:8000/docs

This starts four containers: `redis`, `api`, `worker` (Celery), and `frontend`. Uploads and the ChromaDB store live in `./data/` on the host, shared by the API and worker so async ingestion works across containers.

### Option B — Manual

**1. Backend**

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # add your API keys
```

**2. Redis + Celery worker**

Uploads and paper ingestion are processed asynchronously — without a running Redis + worker, uploads will hang and time out.

```bash
# start Redis (any Redis ≥ 5; e.g. with Homebrew:)
redis-server

# in a terminal, from the project root:
source .venv/bin/activate
celery -A rag.celery_app.celery_app worker --loglevel=info
```

**3. API server** (second terminal)

```bash
source .venv/bin/activate
python main.py serve
# API running at http://localhost:8000
```

**4. Frontend** (third terminal)

```bash
cd frontend
pnpm install
pnpm dev
# UI running at http://localhost:3000
```

---

## Environment Variables

See `.env.example`. All fields:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Generation, synthesis, agent reasoning |
| `OPENAI_API_KEY` | ✅ | — | Embeddings |
| `S2_API_KEY` | — | — | Optional: Semantic Scholar key for higher rate limits |
| `REDIS_URL` | — | `redis://localhost:6379/0` | Celery broker + result backend |
| `UPLOAD_DIR` | — | `/tmp/uploads` | Staging dir for uploads; must be shared between API and worker |
| `CHROMA_PERSIST_DIR` | — | `./data/chroma` | ChromaDB persistent directory |
| `LLM_MODEL` / `FAST_MODEL` / `EMBEDDING_MODEL` | — | see defaults | Optional model overrides |

> ⚠️ The app constructs its API clients at import time (see `rag/config.py`, `rag/agent/graph.py`), so it will fail to boot without at least the two keys above — even for endpoints that don't use them.

---

## Using the App

1. **Upload documents** — drag & drop (or click) PDF/DOCX/TXT files into the left panel. Ingestion is async: the UI polls the task until the worker finishes.
2. **Ask anything** — type in the composer. The LangGraph agent runs tools live: searching your library, searching arXiv, and ingesting papers. Tool outputs (e.g. found papers) render as cards mid-stream.
3. **Verify** — click any numbered citation in an answer to open the source panel with the extracted paragraph.
4. **Research** — ask the agent to find papers on a topic; it searches arXiv/Semantic Scholar, and you can have it ingest a paper directly into the library.
5. **Conversations** — sessions are saved to `localStorage`; reopen them from the sidebar.

---

## CLI

```bash
# Ingest a single file (PDF, DOCX, TXT)
python main.py ingest path/to/document.pdf

# Ingest an entire directory
python main.py ingest path/to/documents/

# Ask a question
python main.py ask "What are the key findings?"

# Ask and print the raw retrieved context chunks
python main.py ask "What are the key findings?" --show-context
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service status and total chunk count |
| `GET` | `/documents` | List all ingested document names |
| `DELETE` | `/documents/{filename}` | Remove a document and all its chunks |
| `POST` | `/ingest` | Upload + queue ingestion (multipart/form-data, async via Celery) |
| `GET` | `/task/{task_id}` | Poll a Celery task's status/result |
| `POST` | `/ask` | Answer a question (`{"question": "..."}`) |
| `POST` | `/ask_stream` | Same, as an SSE stream of sources + text chunks |
| `POST` | `/research/discover` | Find papers for a topic (`{"topic": "...", "limit": 10}`) |
| `POST` | `/research/summarize` | Grounded summary (`{"topic": "...", "papers": [...]}`) |
| `POST` | `/research/ingest` | Add a discovered paper to the library (`{"paper": {...}}`) |
| `POST` | `/agent/chat` | One-shot chat with the ReAct agent (`{"message": "..."}`) |
| `POST` | `/agent/chat_stream` | Agent chat as SSE (`tool_start` / `tool_end` / `text` events) |

Interactive docs: http://localhost:8000/docs

---

## Running Tests & Lint

**Backend** — the unit tests in `tests/test_research.py` are fully mocked (no network, no keys):

```bash
source .venv/bin/activate
pytest tests/test_research.py -v
```

> `tests/test_integration.py` requires a real OpenAI key and network access, and ingests into an isolated test collection — run it separately if you want.

**Frontend**:

```bash
cd frontend
pnpm install
npx tsc --noEmit      # typecheck
pnpm lint             # eslint
```

**CI** — a GitHub Actions workflow (`.github/workflows/ci.yml`) runs the mocked pytest suite, `tsc --noEmit`, and `eslint` on every push/PR to `main`.

**Evals** — `evals/` contains a Q&A harness and a citation-grounding eval for the research pipeline:

```bash
python evals/run_evals.py          # Q&A harness
python evals/eval_research.py      # citation-grounding eval (needs keys)
```

---

## How It Works

```
Upload              ┌─────────────┐   chunk   ┌──────────┐   embed   ┌───────────┐
PDF/DOCX/TXT  ─────▶│ Celery task │──────────▶│  Chunker │──────────▶│ Embedder  │
                    └─────────────┘           └──────────┘           └─────┬─────┘
                                                                            │ store
                                                                     ┌──────▼─────┐
                                                                     │  ChromaDB  │
                                                                     └──────┬─────┘
                                                                            │
Query         ┌──────────┐  HyDE  ┌──────────┐ hybrid  ┌──────────┐       │
"What is...?" │ Question │───────▶│  Embed   │────────▶│ Retrieve │◀──────┘
              └──────────┘        └──────────┘         └─────┬────┘
                                                              │ top-k chunks
                                                       ┌──────▼──────┐
                                                       │   Claude    │
                                                       │  (answer)   │
                                                       └─────────────┘
```

- **Retrieval** fuses dense cosine similarity with BM25 via Reciprocal Rank Fusion. If nothing clears the relevance threshold, the model says it doesn't have enough information instead of hallucinating.
- **Research** runs a parallel flow: a topic query hits arXiv + Semantic Scholar, results are de-duped and merged, and a synthesis is written citing only those papers — then any chosen paper is downloaded, chunked, embedded, and stored in the same ChromaDB library, so it becomes answerable through the Q&A flow.
- **The agent** (LangGraph) layers decision-making on top: given a message it can call `search_local_library`, `search_arxiv_for_papers`, and `ingest_arxiv_paper`, looping until it has enough to answer — with every step streamed to the UI.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Uploads hang, then "Task failed"/timeout | Celery worker or Redis isn't running — start both (see Quick Start). Check with `docker compose ps` or `redis-cli ping`. |
| `pydantic_settings.ValidationError` on boot | Missing `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env`. |
| Frontend can't reach the API | The browser resolves `NEXT_PUBLIC_API_URL` — set it if the API isn't on `127.0.0.1:8000` (Docker sets it automatically). |
| Newly uploaded docs don't appear in answers | Ingestion runs in the Celery worker while queries run in the API process; the retriever detects on-disk ChromaDB changes and reopens automatically, so this should be self-healing. If it persists, restart the API container. |
