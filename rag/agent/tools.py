import json
from langchain_core.tools import tool
from rag.pipelines.rag import answer
from rag.pipelines.research import discover

@tool
def search_local_library(question: str) -> str:
    """
    Search the user's local vector database for answers.
    Use this tool when the user asks a question about documents they have already uploaded or ingested.
    """
    try:
        # Call the existing RAG pipeline
        result = answer(question)
        if not result["context_found"]:
            return "I searched the local library, but couldn't find any relevant context."
        
        # We return a formatted string for the agent's memory
        return f"Local Library Search Results:\n{result['answer']}"
    except Exception as e:
        return f"Error searching local library: {str(e)}"

@tool
def search_arxiv_for_papers(topic: str) -> str:
    """
    Search the internet (arXiv) for new, undiscovered research papers.
    Use this tool when the user asks to find new papers, or if the local library does not have the answer.
    """
    try:
        # Call the existing discovery pipeline
        result = discover(topic, limit=5)
        papers = result.get("papers", [])
        
        if not papers:
            return f"No papers found on arXiv for the topic: {topic}"
            
        # Format the papers nicely so Claude can read them
        formatted_papers = []
        for p in papers:
            formatted_papers.append(
                f"Title: {p['title']}\n"
                f"Authors: {', '.join(p['authors'])}\n"
                f"Year: {p['year']}\n"
                f"Abstract: {p['abstract'][:300]}...\n"
                f"---"
            )
        return "Found the following new papers on arXiv:\n\n" + "\n".join(formatted_papers)
    except Exception as e:
        return f"Error searching arXiv: {str(e)}"
