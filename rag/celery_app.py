import os
from celery import Celery

# We use the REDIS_URL environment variable if provided, otherwise default to localhost.
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize the Celery app
# The first argument 'research_agent' is the name of the Celery module.
# broker: Where Celery sends messages (tasks) to be queued.
# backend: Where Celery stores the results of those tasks once completed.
celery_app = Celery(
    "research_agent",
    broker=redis_url,
    backend=redis_url
)

# Optional: Configuration for Celery to serialize data in JSON format
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Ensure the worker knows about our tasks without any extra flags.
    imports=["rag.tasks"],
)
