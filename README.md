# Research Agent

A research assistant built on a local RAG (Retrieval-Augmented Generation) core. Upload your own documents and ask grounded, cited questions about them — **and** discover recent papers on any research topic from arXiv and Semantic Scholar, get a literature summary cited to real papers, and pull chosen papers into your library to query.

---

## Features

**Library Q&A**
- **Multi-format upload** — ingest PDF, Word (.docx), and plain text (.txt) files
- **Hybrid retrieval** — combines dense vector search (OpenAI embeddings) with BM25 keyword search, merged via Reciprocal Rank Fusion (RRF)
- **HyDE** — generates a hypothetical answer before retrieval to improve semantic matching
- **Source citations** — every answer links back to the document and page it came from

**Research** *(new)*
- **Paper discovery** — search arXiv + Semantic Scholar by topic, de-duped and ranked by citation impact and recency
- **Grounded literature summary** — a "recent work" synthesis that cites only the returned papers (no invented citations), with numbered, linked references
- **One-click ingest** — add any discovered paper's full text to your library so the Q&A flow can use it

**Both**
- **React UI** — Library Q&A / Research tabs, sidebar document manager, drag-and-drop upload
- **CLI** — ingest and query documents from the terminal
- **Persistent storage** — ChromaDB stores embeddings on disk so nothing is lost between restarts

---

## Tech Stack

| Layer | Choice |
|---|---|
| LLM | Claude (Anthropic) — `claude-sonnet-4-6` (synthesis/answers), `claude-haiku-4-5` (HyDE) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| Paper sources | arXiv API + Semantic Scholar Academic Graph API |
| Vector store | ChromaDB (local, persistent) |
| Keyword search | BM25 (rank-bm25) |
| API | FastAPI + uvicorn |
| Frontend | React 18 + Vite + Tailwind CSS |

---

## Project Structure

```
research-agent/
├── rag/
│   ├── config.py              # Settings via pydantic-settings + .env
│   ├── llm.py                 # Provider-agnostic Claude wrapper (complete)
│   ├── ingestion/
│   │   ├── loader.py          # PDF, DOCX, TXT loaders
│   │   ├── chunker.py         # Recursive character splitter (512 / 64 overlap)
│   │   └── embedder.py        # OpenAI embeddings
│   ├── retrieval/
│   │   └── retriever.py       # ChromaDB + BM25 + RRF hybrid retrieval
│   ├── sources/               # Paper discovery
│   │   ├── base.py            # Normalized Paper type + cross-source dedup
│   │   ├── arxiv.py           # arXiv search + PDF download
│   │   ├── semantic_scholar.py# Search + citations/references/recommendations
│   │   └── __init__.py        # find_papers: merge + de-dupe + rank
│   └── pipelines/
│       ├── rag.py             # Ingest + answer pipeline (HyDE, citations)
│       └── research.py        # discover / summarize_recent_work / ingest_paper
├── backend/
│   └── routes.py              # FastAPI routes: /ingest, /ask, /documents, /research/*
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Layout + Library/Research tab toggle
│   │   ├── api.js             # Fetch wrappers for all API endpoints
│   │   └── components/
│   │       ├── Sidebar.jsx        # Upload zone + document list
│   │       ├── Chat.jsx           # Message bubbles + typing indicator
│   │       ├── InputBar.jsx       # Question input
│   │       └── ResearchPanel.jsx  # Topic search, paper cards, grounded summary
│   └── package.json
├── evals/                     # Q&A harness + research citation-grounding eval
├── tests/                     # Integration + research unit tests (pytest)
├── main.py                    # CLI entry point
└── requirements.txt
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key (generation) and an OpenAI API key (embeddings)

### 1. Clone and create a virtual environment

```bash
git clone https://github.com/TheOnma/research-agent.git
cd research-agent

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file with:

```
ANTHROPIC_API_KEY=sk-ant-...     # generation, synthesis, HyDE
OPENAI_API_KEY=sk-...            # embeddings
S2_API_KEY=                      # optional: Semantic Scholar key for higher rate limits
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the App

Open two terminals:

**Terminal 1 — Backend**
```bash
source .venv/bin/activate
python main.py serve
# API running at http://localhost:8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# UI running at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Using the Web UI

**Library Q&A tab**
1. **Upload a document** — drag and drop or click the upload zone in the left sidebar. Supported: PDF, DOCX, TXT.
2. **Ask a question** — type in the input bar and press Enter or click Ask →.
3. **Read the answer** — Rose responds using only your documents. Sources (filename + page) are shown below each answer.
4. **Remove a document** — click the ✕ button next to any document in the sidebar to delete it from the knowledge base.

**Research tab**
1. **Enter a topic** — e.g. "retrieval-augmented generation" and click Find papers.
2. **Browse results** — paper cards show title, authors, year, citation count, and a link.
3. **Summarize recent work** — generate a grounded synthesis whose [i] citations all map to the listed references.
4. **Add to library** — click `+ Library` on any paper to ingest its full text, then switch to the Q&A tab to ask about it.

---

## Using the CLI

```bash
# Ingest a single file
python main.py ingest path/to/document.pdf
python main.py ingest path/to/report.docx
python main.py ingest path/to/notes.txt

# Ingest an entire directory
python main.py ingest path/to/documents/

# Ask a question
python main.py ask "What are the key findings?"

# Ask and see the retrieved context chunks
python main.py ask "What are the key findings?" --show-context
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service status and total chunk count |
| `GET` | `/documents` | List all ingested document names |
| `DELETE` | `/documents/{filename}` | Remove a document and all its chunks |
| `POST` | `/ingest` | Upload and ingest a document (multipart/form-data) |
| `POST` | `/ask` | Answer a question (`{"question": "..."}`) |
| `POST` | `/research/discover` | Find papers for a topic (`{"topic": "...", "limit": 10}`) |
| `POST` | `/research/summarize` | Grounded summary (`{"topic": "...", "papers": [...]}`) |
| `POST` | `/research/ingest` | Add a discovered paper to the library (`{"paper": {...}}`) |

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## How It Works

```
Upload              ┌─────────────┐   chunk   ┌──────────┐   embed   ┌───────────┐
PDF/DOCX/TXT  ─────▶│   Loader    │──────────▶│  Chunker │──────────▶│ Embedder  │
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

**Retrieval** uses Reciprocal Rank Fusion to merge dense cosine similarity results with BM25 keyword results. If the best match scores below the relevance threshold (0.3), the system returns "I don't have enough information" rather than hallucinating.

**Research** runs a parallel flow: a topic query hits arXiv + Semantic Scholar, results are de-duped and ranked, Claude writes a synthesis cited only to those papers, and any chosen paper is downloaded, chunked, embedded, and stored in the same ChromaDB library — so discovered papers become answerable through the Q&A flow above.
