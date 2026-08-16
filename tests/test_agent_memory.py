"""
Unit tests for the Tier-0 conversation buffer (agent history seeding).

Mocks LangGraph so these run offline with no keys. Covers the graph-input
helper and both agent routes: prior turns must be seeded in order, the new
message appended last, history capped, and malformed turns skipped.

The dummy ANTHROPIC_API_KEY/OPENAI_API_KEY env vars mirror what CI sets — the
route module instantiates the LLM client at import time, but never calls it.
"""

import asyncio
import os

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")

from langchain_core.messages import AIMessage, HumanMessage  # noqa: E402

import backend.routes as routes  # noqa: E402
from backend.routes import AgentChatRequest, build_agent_inputs  # noqa: E402


# --- helper: build_agent_inputs ---


def test_build_inputs_no_history():
    inputs = build_agent_inputs("hello")
    msgs = inputs["messages"]
    assert len(msgs) == 1
    assert isinstance(msgs[0], HumanMessage)
    assert msgs[0].content == "hello"


def test_build_inputs_seeds_history_in_order():
    history = [
        {"role": "user", "content": "find papers"},
        {"role": "assistant", "content": "1. Bidirectional RAG 2. SKILL-RAG"},
        {"role": "user", "content": "save the first and second"},
    ]
    msgs = build_agent_inputs("yes", history)["messages"]

    assert [type(m) for m in msgs] == [HumanMessage, AIMessage, HumanMessage, HumanMessage]
    assert [m.content for m in msgs] == [h["content"] for h in history] + ["yes"]


def test_build_inputs_skips_malformed_turns():
    history = [
        {"role": "assistant"},            # no content
        {"role": "system", "content": "x"},  # unknown role
        {"content": "y"},                 # no role
        {"role": "user", "content": ""},  # empty content
        {"role": "user", "content": 42},  # non-string content
        {"role": "user", "content": "ok"},
    ]
    msgs = build_agent_inputs("hi", history)["messages"]
    assert [m.content for m in msgs] == ["ok", "hi"]


def test_build_inputs_caps_history():
    history = [{"role": "user", "content": f"msg-{i}"} for i in range(50)]
    msgs = build_agent_inputs("final", history)["messages"]
    assert len(msgs) == routes.MAX_HISTORY_MESSAGES + 1
    # oldest kept = 50 - MAX_HISTORY_MESSAGES
    assert msgs[0].content == f"msg-{50 - routes.MAX_HISTORY_MESSAGES}"
    assert msgs[-1].content == "final"


# --- route wiring: does the route actually seed the graph state? ---


class FakeAgentApp:
    """Minimal stand-in for the compiled LangGraph app."""

    def __init__(self):
        self.captured = None

    def invoke(self, inputs, config=None):
        self.captured = inputs
        return {"messages": [AIMessage(content="ok")]}

    async def astream_events(self, inputs, version="v2", config=None):
        self.captured = inputs
        yield {"event": "on_chat_model_stream", "data": {"chunk": AIMessage(content="streamed")}}


def test_agent_chat_seeds_history(monkeypatch):
    fake = FakeAgentApp()
    monkeypatch.setattr(routes, "agent_app", fake)

    req = AgentChatRequest(
        message="yes",
        history=[
            {"role": "user", "content": "find papers"},
            {"role": "assistant", "content": "here they are"},
        ],
    )
    resp = routes.agent_chat(req)

    assert resp == {"response": "ok"}
    msgs = fake.captured["messages"]
    assert [m.content for m in msgs] == ["find papers", "here they are", "yes"]


def test_agent_chat_without_history_is_unchanged(monkeypatch):
    fake = FakeAgentApp()
    monkeypatch.setattr(routes, "agent_app", fake)

    resp = routes.agent_chat(AgentChatRequest(message="hello"))
    assert resp == {"response": "ok"}
    msgs = fake.captured["messages"]
    assert len(msgs) == 1
    assert msgs[0].content == "hello"


def test_agent_chat_stream_seeds_history(monkeypatch):
    fake = FakeAgentApp()
    monkeypatch.setattr(routes, "agent_app", fake)

    req = AgentChatRequest(
        message="save the first and second to my local library",
        history=[
            {"role": "user", "content": "find papers about self improving rag"},
            {"role": "assistant", "content": "1. Bidirectional RAG 2. SKILL-RAG"},
        ],
    )

    async def run():
        resp = await routes.agent_chat_stream(req)
        data = ""
        async for part in resp.body_iterator:
            data += part
        return data

    data = asyncio.run(run())

    assert "streamed" in data
    msgs = fake.captured["messages"]
    assert [m.content for m in msgs] == [
        "find papers about self improving rag",
        "1. Bidirectional RAG 2. SKILL-RAG",
        "save the first and second to my local library",
    ]
