"""Persist the extracted full text of ingested sources so users can read them.

ChromaDB stores embedded *chunks*; the original document text is otherwise
discarded after ingest. This module keeps the extracted pages per source as a
JSON file on the shared volume — the worker writes it at ingest time, and the
API serves it through GET /documents/text so the UI can show a readable,
page-numbered copy of any document in the library.
"""

import json
import logging
import re
from pathlib import Path

from rag.config import settings

logger = logging.getLogger(__name__)

# Characters that break filenames (esp. Windows) — paper titles are full of
# colons/slashes ("SKILL-RAG: ...", "Self-Improving RAG/Graph ...").
_UNSAFE = re.compile(r'[\\/:*?"<>|]')


def sanitize_source(name: str) -> str:
    """Turn a source name into a safe filename stem ('' or all-unsafe -> 'unnamed')."""
    stem = _UNSAFE.sub("_", name).strip()
    if not stem.strip("_"):
        return "unnamed"
    return stem[:160]


def source_path(source: str) -> Path:
    """Path to the saved-text JSON file for a source name."""
    return Path(settings.library_dir) / f"{sanitize_source(source)}.json"


def save_source_pages(source: str, pages: list[dict]) -> Path | None:
    """Persist extracted pages [{page, text}, ...] for a source. Returns the
    path written, or None when there are no pages to save."""
    if not source or not pages:
        logger.info("No pages to save for source %r", source)
        return None
    path = source_path(source)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": source,
        "pages": [
            {"page": p.get("page", i + 1), "text": p.get("text", "")}
            for i, p in enumerate(pages)
            if p.get("text")
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    logger.info("Saved extracted text for %r (%d pages) -> %s", source, len(payload["pages"]), path)
    return path


def load_source_pages(source: str) -> dict | None:
    """Return the saved {source, pages} payload for a source, or None."""
    path = source_path(source)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Could not read saved text for %r: %s", source, e)
        return None


def delete_source_pages(source: str) -> bool:
    """Remove the saved-text file for a source. Returns True if one existed."""
    path = source_path(source)
    if path.exists():
        path.unlink()
        logger.info("Deleted saved text for %r", source)
        return True
    return False
