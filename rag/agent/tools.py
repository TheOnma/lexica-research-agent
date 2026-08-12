import json
from langchain_core.tools import tool
from rag.pipelines.rag import answer
from rag.pipelines.research import discover
from rag.sources import arxiv
from rag.tasks import process_paper_task


@tool
def search_local_library(question: str) -> str:
    """Search the user's local vector database for answers.
    Use this tool when the user asks a question about documents they have already uploaded or ingested."""
    try:
        result = answer(question)
        if not result["context_found"]:
            return "I searched the local library, but couldn't find any relevant context."
        sources = [
            {"source": s["source"], "page": s["page"], "text": s.get("text", "")}
            for s in result.get("sources", [])
        ]
        return json.dumps({"answer": result['answer'], "sources": sources})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def search_arxiv_for_papers(topic: str) -> str:
    """Search arXiv for new, undiscovered research papers on a topic.
    Use this when the user wants to find papers, or when the local library cannot answer."""
    try:
        result = discover(topic, limit=5)
        papers = result.get("papers", [])
        if not papers:
            return f"No papers found on arXiv for the topic: {topic}"
        formatted_papers = []
        for p in papers:
            formatted_papers.append({
                "title": p['title'],
                "authors": ', '.join(p['authors']),
                "year": p['year'],
                "abstract": (p['abstract'] or '')[:800] + "...",  # more room to explain
                "arxiv_id": p.get('id'),   # exact ID so the agent can ingest the RIGHT paper
                "url": p['url'],
            })
        return json.dumps({"papers": formatted_papers})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def ingest_arxiv_paper(arxiv_id: str) -> str:
    """Download and ingest a paper into the user's local library by its EXACT arXiv ID.

    Only use this tool when the user explicitly asked to save, download, or add a paper
    to their workspace. The arxiv_id is the 'id' field of a search_arxiv_for_papers result,
    e.g. '2310.11511'."""
    try:
        paper = arxiv.fetch_by_id(arxiv_id)
        task = process_paper_task.delay(paper.to_dict())
        return json.dumps({
            "message": f"Started ingesting '{paper.title}' ({paper.year}). It will be searchable shortly.",
            "task_id": task.id,
        })
    except Exception as e:
        return json.dumps({"error": f"Could not ingest arXiv:{arxiv_id}: {e}"})
