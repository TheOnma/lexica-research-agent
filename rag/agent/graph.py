from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_anthropic import ChatAnthropic

from rag.config import settings
from rag.agent.tools import search_local_library, search_arxiv_for_papers

# 1. Define the State
# The state is simply a list of messages (user inputs, AI responses, and tool results).
# `add_messages` ensures new messages are appended rather than overwriting the state.
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

# 2. Initialize the Tools and the LLM
tools = [search_local_library, search_arxiv_for_papers]
llm = ChatAnthropic(
    model_name=settings.llm_model, 
    temperature=0, 
    api_key=settings.anthropic_api_key
)
# We "bind" the tools to the LLM so it knows they exist and can output tool calls.
llm_with_tools = llm.bind_tools(tools)

# 3. Define the Nodes
def call_model(state: AgentState):
    """Node that calls the LLM with the current conversation history."""
    messages = state["messages"]
    
    # We can inject a system prompt at runtime to guide the agent
    system_prompt = SystemMessage(content="""You are a brilliant AI Research Assistant. 
You can search the user's local library of PDFs, or search the arXiv internet database for new papers.
Always use your tools to find factual information. Do not guess.""")
    
    response = llm_with_tools.invoke([system_prompt] + messages)
    # We return a dict because it gets merged into the AgentState
    return {"messages": [response]}

# The ToolNode automatically executes the python function if the LLM requests it.
tool_node = ToolNode(tools)

# 4. Build the Graph
workflow = StateGraph(AgentState)

# Add our two nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

# Set the entry point
workflow.set_entry_point("agent")

# We use the pre-built `tools_condition` edge.
# If the agent's output has a tool_call, it goes to "tools".
# If the agent's output is just text, it goes to END.
workflow.add_conditional_edges(
    "agent",
    tools_condition,
)

# After the tools run, always return to the agent so it can read the tool's output
workflow.add_edge("tools", "agent")

# Compile the graph into an executable application
app = workflow.compile()
