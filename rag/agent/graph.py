"""LangGraph ReAct agent with a bounded tool budget.

Why a budget: the model can happily call tools forever (re-searching the same
topic). LangGraph's recursion_limit is a hard crash when exceeded — ugly. So we
give the agent a *soft* budget: after MAX_ITERATIONS tool rounds we strip any
pending tool call, tell it to answer now, and switch to a plain (tool-less)
model call. The recursion_limit in routes.py is just a safety net above that.
"""

import logging
from typing import TypedDict, Annotated, Sequence

from langchain_core.messages import AIMessage, HumanMessage, BaseMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_anthropic import ChatAnthropic

from rag.config import settings
from rag.agent.tools import search_local_library, search_arxiv_for_papers, ingest_arxiv_paper

logger = logging.getLogger(__name__)

# One tool round = agents -> tools -> agent = 3 graph super-steps.
MAX_ITERATIONS = 8 # soft budget: max tool calls per request

SYSTEM_PROMPT = """You are Lexica, a precise AI research assistant. You can search the user's local
library of uploaded documents, and search arXiv for new papers.

Rules:
1. If the question concerns the user's own documents, search_local_library first.
2. If the user wants new papers or outside knowledge, search_arxiv_for_papers.
3. STOP calling tools as soon as you have enough to answer — usually ONE search.
   Never re-run the same search hoping for different results.
4. If a search returns nothing useful, say so and answer from your own knowledge. Do not loop.
5. NEVER call ingest_arxiv_paper unless the user explicitly asked you to save or download the paper.
6. Cite papers with title, year, and URL.
7. You are limited to {max_iterations} tool calls per request — budget them.
"""

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    iterations: int # number of tool rounds used so far (plain int, no reducer) 


tools = [search_local_library, search_arxiv_for_papers, ingest_arxiv_paper]
llm = ChatAnthropic(
    model_name=settings.llm_model, 
    temperature=0, 
    api_key=settings.anthropic_api_key
)
llm_with_tools = llm.bind_tools(tools)
tool_node = ToolNode(tools)

# 3. Define the Nodes
def call_model(state: AgentState):
    """Run the LLM. Over budget: strip pending tool calls and force a final answer."""
    messages = list(state["messages"])
    over_budget = state.get("iterations", 0) >= MAX_ITERATIONS
    
    if over_budget:
        # Anthropic rejects an AIMessage that declares tool_calls without a
        # following ToolMessage — drop the pending call, keep the reasoning.
        if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
            messages[-1] = AIMessage(content=messages[-1].content)
        messages.append(HumanMessage(
            content="[budget] You have used all your tool calls for this request. "
                    "Answer now using what you already know or found."
        ))
        model = llm  # no tools bound -> it cannot call tools
    else:
        model = llm_with_tools

    response = model.invoke([SystemMessage(content=SYSTEM_PROMPT.format(max_iterations=MAX_ITERATIONS))] + messages)

    return {"messages": [response]}

def route_after_agent(state: AgentState) -> str:
    """Send to tools if the model asked for tools and we have budget left, else END."""
    last = state["messages"][-1]
    wants_tools = isinstance(last, AIMessage) and bool(last.tool_calls)
    if wants_tools and state.get("iterations", 0) < MAX_ITERATIONS:
        return "tools"
    return END
    
def bump_iterations(state: AgentState) -> dict:
    """Count this tool round (runs right after the tools node),"""
    return {"iterations": state.get("iterations", 0) + 1}

# Build the Graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.add_node("tick", bump_iterations)

# Set the entry point
workflow.set_entry_point("agent")


workflow.add_conditional_edges(
    "agent",
    route_after_agent,
)

# After the tools run, always return to the agent so it can read the tool's output
workflow.add_edge("tools", "tick")
workflow.add_edge("tick", "agent")
# Compile the graph into an executable application
app = workflow.compile()
