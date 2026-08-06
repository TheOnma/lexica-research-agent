import json
from langchain_core.tools import tool
from rag.pipelines.rag import answer
from rag.pipelines.research import discover
from rag.tasks import process_paper_task

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
        
        # Return JSON string so the UI can parse it
        sources = [
            {"source": s["source"], "page": s["page"], "text": s.get("text", "")}
            for s in result.get("sources", [])
        ]
        return json.dumps({
            "answer": result['answer'],
            "sources": sources
        })
    except Exception as e:
        return json.dumps({"error": str(e)})

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
            
        # Format the papers nicely so Claude can read them and UI can render them
        formatted_papers = []
        for p in papers:
            formatted_papers.append({
                "title": p['title'],
                "authors": ', '.join(p['authors']),
                "year": p['year'],
                "abstract": p['abstract'][:300] + "...",
                "url": p['url']
            })
        return json.dumps({"papers": formatted_papers})
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def ingest_arxiv_paper(title: str) -> str:
    """
    Download and ingest a paper from arXiv into the user's local library by its exact title.
    Use this tool when the user asks to save, download, or add a paper to their workspace.
    """
    try:
        # Re-fetch the paper by exact title to get the full dictionary
        result = discover(title, limit=1)
        papers = result.get("papers", [])
        if not papers:
            return json.dumps({"error": f"Could not find paper with title: {title}"})
            
        paper_dict = papers[0]
        # Dispatch the Celery task
        task = process_paper_task.delay(paper_dict)
        return json.dumps({
            "message": f"Successfully started ingesting '{paper_dict['title']}'. It will be available shortly.",
            "task_id": task.id
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
