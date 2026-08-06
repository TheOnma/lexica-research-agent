import logging
import os
from rag.celery_app import celery_app
from rag.pipelines.rag import ingest_document
from rag.pipelines.research import ingest_paper
from rag.sources.base import Paper

logger = logging.getLogger(__name__)

@celery_app.task(name="tasks.process_document")
def process_document_task(file_path: str):
    """
    Background task to ingest a document.
    This runs asynchronously in the Celery worker, freeing up the API.
    """
    logger.info("Starting background processing for: %s", file_path)
    try:
        # We call the original function here, but now it runs in a separate process!
        chunks_stored = ingest_document(file_path)
        logger.info("Finished processing. %d chunks stored.", chunks_stored)
        return {"status": "success", "chunks_stored": chunks_stored, "file_path": file_path}
    except Exception as e:
        logger.error("Error processing document: %s", e)
        # Re-raise the exception so Celery marks the task as failed
        raise e
    finally:
        # Clean up the temporary file now that we are done with it
        if os.path.exists(file_path):
            os.remove(file_path)

@celery_app.task(name="tasks.process_paper")
def process_paper_task(paper_dict: dict):
    """
    Background task to download and ingest a research paper.
    """
    logger.info("Starting background processing for paper: %s", paper_dict.get("title"))
    try:
        paper = Paper(**paper_dict)
        result = ingest_paper(paper)
        logger.info("Finished processing paper.")
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error("Error processing paper: %s", e)
        raise e
