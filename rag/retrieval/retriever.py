"""ChromaDB vector store with hybrid BM25 + dense retrieval and RRF merging."""

import gc
import logging
import random
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi

from rag.config import settings
from rag.ingestion.library import delete_source_pages

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None
_last_store_mtime: float = 0.0

# In-memory BM25 corpus — rebuilt from ChromaDB on first use or after ingestion
_bm25_corpus: list[tuple[str, str, dict]] = []  # (id, text, metadata)
_bm25_index: BM25Okapi | None = None


def _store_mtime() -> float:
    """
    Latest mtime across the ChromaDB sqlite store and its WAL file (or 0.0).

    The Celery worker writes from another process; in WAL mode those writes land
    in chroma.sqlite3-wal before being checkpointed into chroma.sqlite3, so the
    main db's mtime alone can miss worker writes. Watching both files makes the
    staleness check in _get_collection reliable.
    """
    base = Path(settings.chroma_persist_dir)
    best = 0.0
    for name in ("chroma.sqlite3", "chroma.sqlite3-wal"):
        try:
            best = max(best, (base / name).stat().st_mtime)
        except OSError:
            pass
    return best


def _reset_handle() -> None:
    """
    Close and drop the cached ChromaDB client/collection and BM25 corpus.

    The old client MUST be released before opening a new one: chromadb's rust
    backend keeps per-process segment state, and a second PersistentClient
    created while the first is still alive fails vector queries with
    "Error creating hnsw segment reader: Nothing found on disk". We close it
    explicitly, drop all references, and run a GC pass to flush any cycles.
    """
    global _client, _collection, _last_store_mtime, _bm25_corpus, _bm25_index
    client = _client
    _client = None
    _collection = None
    if client is not None:
        try:
            client.close()
        except Exception:
            logger.debug("Error closing ChromaDB client", exc_info=True)
    del client
    gc.collect()
    _last_store_mtime = 0.0
    _bm25_corpus = []
    _bm25_index = None


def _get_collection() -> chromadb.Collection:
    """
    Return the ChromaDB collection, reopening it when the store changed on disk.

    Ingestion runs in a separate Celery worker process, so the API process must
    not keep a long-lived handle: ChromaDB caches collection->segment metadata
    in-process, and a stale handle fails vector queries with "Error creating
    hnsw segment reader: Nothing found on disk". Comparing the sqlite file mtime
    detects worker writes cheaply (one stat per call); reopening also reloads the
    BM25 corpus so keyword search sees newly ingested documents too.
    """
    global _client, _collection, _last_store_mtime, _bm25_corpus, _bm25_index
    mtime = _store_mtime()
    if _collection is None or mtime != _last_store_mtime:
        _reset_handle()
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name=settings.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        # Re-stat after creation so the recorded baseline is the file we actually created.
        _last_store_mtime = _store_mtime()
        logger.debug("Opened ChromaDB collection (mtime %s)", _last_store_mtime)
    return _collection


def _load_corpus_from_chroma() -> None:
    """Rebuild the BM25 corpus from all documents currently in ChromaDB."""
    global _bm25_corpus, _bm25_index
    collection = _get_collection()
    if collection.count() == 0:
        return
    result = collection.get(include=["documents", "metadatas"])
    _bm25_corpus = list(zip(result["ids"], result["documents"], result["metadatas"]))
    _bm25_index = None  # invalidate so it rebuilds on next use
    logger.info("Loaded %d docs into BM25 corpus from ChromaDB", len(_bm25_corpus))


def _get_bm25() -> BM25Okapi:
    global _bm25_index, _bm25_corpus
    if not _bm25_corpus:
        _load_corpus_from_chroma()
    if _bm25_index is None:
        tokenized = [text.lower().split() for _, text, _ in _bm25_corpus]
        _bm25_index = BM25Okapi(tokenized)
    return _bm25_index


def _retrieve_bm25(query: str, n: int, source: str | None = None) -> list[tuple[str, str, dict]]:
    """Return top n (id, text, metadata) tuples by BM25 keyword score.

    When source is given, only chunks of that document are scored — used by the
    "ask about this paper" flow so a question can't leak context from other docs.
    """
    if not _bm25_corpus and _get_collection().count() == 0:
        return []
    bm25 = _get_bm25()
    scores = bm25.get_scores(query.lower().split())
    indices = [i for i in range(len(scores)) if scores[i] > 0]
    if source is not None:
        indices = [i for i in indices if _bm25_corpus[i][2].get("source") == source]
    top_indices = sorted(indices, key=lambda i: scores[i], reverse=True)[:n]
    return [
        (_bm25_corpus[i][0], _bm25_corpus[i][1], _bm25_corpus[i][2])
        for i in top_indices
    ]


def chunk_id(metadata: dict) -> str:
    """Stable chunk id used across ingest / retrieve / self-evaluation.

    Must match the ids written by add_chunks() so a retrieved chunk can be
    compared against a known ground-truth chunk by id.
    """
    return f"{metadata['source']}_p{metadata['page']}_c{metadata.get('chunk', 0)}"


def random_chunks(n: int) -> list[dict]:
    """Sample n random chunks (id, text, metadata) — used by the SimRAG-style
    self-evaluation loop to pick ground-truth passages from the library."""
    collection = _get_collection()
    if collection.count() == 0:
        return []
    result = collection.get(include=["documents", "metadatas"])
    triples = list(zip(result["ids"], result["documents"], result["metadatas"]))
    k = min(n, len(triples))
    return [
        {"id": id_, "text": text, "metadata": meta}
        for id_, text, meta in random.sample(triples, k)
    ]


def add_chunks(chunks: list[dict]) -> None:
    """
    Store embedded chunks in ChromaDB and extend the BM25 corpus.

    Args:
        chunks — output from embedder.embed_chunks() (must have "embedding" key)
    """
    global _bm25_corpus, _bm25_index
    if not chunks:
        logger.warning("add_chunks called with empty list")
        return

    collection = _get_collection()

    ids = [f"{c['metadata']['source']}_p{c['metadata']['page']}_c{c['metadata']['chunk']}" for c in chunks]
    embeddings = [c["embedding"] for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]

    collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)

    # Extend BM25 corpus and invalidate index so it rebuilds on next query
    _bm25_corpus.extend(zip(ids, documents, metadatas))
    _bm25_index = None

    logger.info("Upserted %d chunks into collection '%s'", len(chunks), settings.collection_name)


def retrieve(query_embedding: list[float], query_text: str = "", top_k: int | None = None, source: str | None = None) -> list[dict]:
    """
    Hybrid retrieval: dense cosine similarity + BM25 keyword search, merged with RRF.

    Dense retrieval finds semantically similar chunks. BM25 finds exact keyword
    matches. Reciprocal Rank Fusion (RRF) combines both rankings so that chunks
    appearing high in either list score well.

    Args:
        query_embedding — embedded query vector (ideally a HyDE hypothetical passage)
        query_text      — original query text used for BM25 keyword search
        top_k           — number of results (defaults to settings.top_k)
        source          — restrict retrieval to a single document (exact match on
                          the source metadata field); used by "ask about this paper"

    Returns:
        list of {"text": str, "metadata": dict, "score": float}
        deduplicated by (source, page), sorted by RRF score descending
    """
    collection = _get_collection()
    if collection.count() == 0:
        return []

    k = top_k or settings.top_k
    n_candidates = min(k * 3, collection.count())

    # Restrict dense search to one document when scoped (Chroma where filter).
    query_where = {"source": source} if source is not None else None

    # --- Dense retrieval ---
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_candidates,
            include=["documents", "metadatas", "distances"],
            where=query_where,
        )
    except Exception:
        # Defensive: the worker can rewrite HNSW segments between our open and
        # this query (e.g. a WAL checkpoint race that slips past the mtime check).
        # Drop the local reference BEFORE reopening — _reset_handle closes the
        # old client, and chroma fails if two clients are alive at once.
        logger.warning("Dense query failed; reopening ChromaDB and retrying once", exc_info=True)
        del collection
        _reset_handle()
        collection = _get_collection()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_candidates,
            include=["documents", "metadatas", "distances"],
            where=query_where,
        )

    RRF_K = 60
    dense_items: dict[str, dict] = {}
    for rank, (text, meta, dist) in enumerate(zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    )):
        score = 1.0 - dist
        if score < settings.relevance_threshold:
            continue
        id_ = chunk_id(meta)
        dense_items[id_] = {"text": text, "metadata": meta, "dense_score": score, "dense_rank": rank}

    # --- BM25 retrieval ---
    bm25_items: dict[str, dict] = {}
    if query_text:
        for bm25_rank, (id_, text, meta) in enumerate(_retrieve_bm25(query_text, n_candidates, source)):
            bm25_items[id_] = {"text": text, "metadata": meta, "bm25_rank": bm25_rank}

    # --- RRF merge ---
    all_ids = set(dense_items.keys()) | set(bm25_items.keys())
    merged: dict[str, dict] = {}
    for id_ in all_ids:
        d_rank = dense_items[id_]["dense_rank"] if id_ in dense_items else n_candidates
        b_rank = bm25_items[id_]["bm25_rank"] if id_ in bm25_items else n_candidates
        rrf_score = 1.0 / (RRF_K + d_rank) + 1.0 / (RRF_K + b_rank)

        # Prefer dense item for text/metadata (has similarity score); fall back to BM25
        item = dense_items.get(id_) or bm25_items.get(id_)
        merged[id_] = {"text": item["text"], "metadata": item["metadata"], "score": rrf_score}

    # --- Deduplicate by (source, page): keep best RRF score per page ---
    seen: dict[tuple, dict] = {}
    for item in merged.values():
        key = (item["metadata"]["source"], item["metadata"]["page"])
        if key not in seen or item["score"] > seen[key]["score"]:
            seen[key] = item

    retrieved = sorted(seen.values(), key=lambda x: x["score"], reverse=True)[:k]
    logger.info(
        "Retrieved %d unique-page chunks (dense=%d, bm25=%d, after RRF+dedup)",
        len(retrieved), len(dense_items), len(bm25_items),
    )
    return retrieved


def collection_count() -> int:
    """Return the number of documents in the collection."""
    return _get_collection().count()


def list_sources() -> list[dict]:
    """Return a sorted list of unique source document names with page and chunk counts."""
    collection = _get_collection()
    if collection.count() == 0:
        return []
    result = collection.get(include=["metadatas"])
    
    docs = {}
    for m in result["metadatas"]:
        source = m.get("source")
        if not source:
            continue
        page = m.get("page", 1)
        if source not in docs:
            docs[source] = {"name": source, "chunks": 0, "pages": set()}
        docs[source]["chunks"] += 1
        docs[source]["pages"].add(page)
        
    final_docs = []
    for source in sorted(docs.keys()):
        final_docs.append({
            "name": source,
            "chunks": docs[source]["chunks"],
            "pages": len(docs[source]["pages"])
        })
    return final_docs


def delete_source(source: str) -> int:
    """
    Delete all chunks for the given source document from ChromaDB and BM25 corpus.

    Returns:
        number of chunks deleted
    """
    global _bm25_corpus, _bm25_index
    collection = _get_collection()
    result = collection.get(where={"source": source}, include=[])
    ids = result["ids"]
    if ids:
        collection.delete(ids=ids)
        _bm25_corpus = [(id_, text, meta) for id_, text, meta in _bm25_corpus
                        if meta.get("source") != source]
        _bm25_index = None
        logger.info("Deleted %d chunks for source '%s'", len(ids), source)
    delete_source_pages(source)
    return len(ids)
