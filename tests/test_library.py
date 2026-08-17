"""
Unit tests for the extracted-text library (rag/ingestion/library.py).

Pure file I/O — no keys, no network, runs offline in CI.
"""

import os

# Settings has required API-key fields; the module import instantiates it.
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")

from rag.ingestion import library  # noqa: E402
from rag.config import settings  # noqa: E402


def _patch_library_dir(tmp_path, monkeypatch):
    """Point the library at a temp dir so tests don't touch ./data."""
    monkeypatch.setattr(settings, "library_dir", str(tmp_path))


def test_sanitize_source_removes_unsafe_chars():
    assert library.sanitize_source("SKILL-RAG: Self-Improving / RAG (2025)") == \
        "SKILL-RAG_ Self-Improving _ RAG (2025)"


def test_sanitize_source_empty_falls_back():
    assert library.sanitize_source("   ") == "unnamed"
    assert library.sanitize_source("///") == "unnamed"


def test_save_load_round_trip(tmp_path, monkeypatch):
    _patch_library_dir(tmp_path, monkeypatch)
    pages = [{"page": 1, "text": "hello"}, {"page": 2, "text": "world"}]
    path = library.save_source_pages("My Paper: Intro", pages)

    assert path is not None and path.exists()
    data = library.load_source_pages("My Paper: Intro")
    assert data == {"source": "My Paper: Intro", "pages": [
        {"page": 1, "text": "hello"},
        {"page": 2, "text": "world"},
    ]}


def test_save_skips_empty_pages_and_returns_none(tmp_path, monkeypatch):
    _patch_library_dir(tmp_path, monkeypatch)
    assert library.save_source_pages("Empty", []) is None
    assert library.save_source_pages("", [{"page": 1, "text": "x"}]) is None
    # pages whose text is blank are filtered out of the payload
    path = library.save_source_pages("Some", [{"page": 1, "text": ""}])
    assert path is not None
    assert library.load_source_pages("Some")["pages"] == []


def test_load_missing_returns_none(tmp_path, monkeypatch):
    _patch_library_dir(tmp_path, monkeypatch)
    assert library.load_source_pages("Nope") is None


def test_delete_removes_file(tmp_path, monkeypatch):
    _patch_library_dir(tmp_path, monkeypatch)
    library.save_source_pages("Doc", [{"page": 1, "text": "x"}])
    assert library.delete_source_pages("Doc") is True
    assert library.load_source_pages("Doc") is None
    assert library.delete_source_pages("Doc") is False  # idempotent



# --- delete route wiring (query-param variant used by the UI) ---

def test_delete_route_calls_delete_source(monkeypatch):
    import backend.routes as routes

    calls = {}

    def fake_delete_source(name):
        calls["name"] = name
        return 5

    monkeypatch.setattr(routes, "delete_source", fake_delete_source)
    resp = routes.delete_document_by_name("Some Paper: Title (2025)")

    assert resp == {"filename": "Some Paper: Title (2025)", "chunks_deleted": 5}
    assert calls["name"] == "Some Paper: Title (2025)"


def test_delete_route_rejects_empty_name(monkeypatch):
    import backend.routes as routes
    from fastapi import HTTPException

    monkeypatch.setattr(routes, "delete_source", lambda name: 0)
    try:
        routes.delete_document_by_name("   ")
        raise AssertionError("expected HTTPException")
    except HTTPException as e:
        assert e.status_code == 400


# --- scoped "ask about this paper" (source filter on /ask and /ask_stream) ---

def test_ask_passes_source_scope(monkeypatch):
    import backend.routes as routes

    captured = {}

    def fake_answer(question, source=None):
        captured["question"] = question
        captured["source"] = source
        return {"answer": "ok", "sources": [], "context_found": True}

    monkeypatch.setattr(routes, "answer", fake_answer)
    resp = routes.ask(routes.QuestionRequest(question="what is it", source="My Paper (2025)"))

    assert resp["answer"] == "ok"
    assert captured == {"question": "what is it", "source": "My Paper (2025)"}


def test_ask_without_source_is_none(monkeypatch):
    import backend.routes as routes

    captured = {}

    def fake_answer(question, source=None):
        captured["source"] = source
        return {"answer": "ok", "sources": [], "context_found": True}

    monkeypatch.setattr(routes, "answer", fake_answer)
    routes.ask(routes.QuestionRequest(question="hi"))
    assert captured["source"] is None


def test_ask_stream_yields_sources_event_with_scope(monkeypatch):
    import backend.routes as routes

    captured = {}

    def fake_answer_stream(question, source=None):
        captured["source"] = source
        yield {"type": "sources", "data": [{"source": "P", "page": 1}]}
        yield {"type": "text", "data": "hello"}

    monkeypatch.setattr(routes, "answer_stream", fake_answer_stream)
    events = list(routes._ask_stream_events(routes.QuestionRequest(question="q", source="P")))

    assert captured["source"] == "P"
    assert 'data: {"type": "sources"' in events[0]


# --- one-click save: /research/ingest_arxiv dispatches by ID only ---

def test_ingest_arxiv_dispatches_task(monkeypatch):
    import backend.routes as routes

    class FakePaper:
        title = "A Paper"

        def to_dict(self):
            return {"id": "2310.11511", "title": "A Paper"}

    class FakeTask:
        id = "task-123"

        def delay(self, paper_dict):
            self.captured = paper_dict
            return self

    captured = {}

    def fake_fetch(aid):
        captured["aid"] = aid
        return FakePaper()

    fake_task = FakeTask()
    monkeypatch.setattr(routes.arxiv, "fetch_by_id", fake_fetch)
    monkeypatch.setattr(routes, "process_paper_task", fake_task)

    resp = routes.research_ingest_arxiv(routes.IngestArxivRequest(arxiv_id="2310.11511"))

    assert captured["aid"] == "2310.11511"
    assert fake_task.captured == {"id": "2310.11511", "title": "A Paper"}
    assert resp == {"title": "A Paper", "arxiv_id": "2310.11511", "task_id": "task-123", "status": "Processing"}


def test_ingest_arxiv_rejects_empty_id():
    import backend.routes as routes
    from fastapi import HTTPException

    try:
        routes.research_ingest_arxiv(routes.IngestArxivRequest(arxiv_id="  "))
        raise AssertionError("expected HTTPException")
    except HTTPException as e:
        assert e.status_code == 400
