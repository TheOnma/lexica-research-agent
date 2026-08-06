"""ChromaDB vector store with hybrid BM25 + dense retrieval and RRF merging."""

import logging

import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi

from rag.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None

# In-memory BM25 corpus — rebuilt from ChromaDB on first use or after ingestion
_bm25_corpus: list[tuple[str, str, dict]] = []  # (id, text, metadata)
_bm25_index: BM25Okapi | None = None


def _get_collection() -> chromadb.Collection:
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name=settings.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
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


def _retrieve_bm25(query: str, n: int) -> list[tuple[str, str, dict]]:
    """Return top n (id, text, metadata) tuples by BM25 keyword score."""
    if not _bm25_corpus and _get_collection().count() == 0:
        return []
    bm25 = _get_bm25()
    scores = bm25.get_scores(query.lower().split())
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:n]
    return [
        (_bm25_corpus[i][0], _bm25_corpus[i][1], _bm25_corpus[i][2])
        for i in top_indices
        if scores[i] > 0
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


def retrieve(query_embedding: list[float], query_text: str = "", top_k: int | None = None) -> list[dict]:
    """
    Hybrid retrieval: dense cosine similarity + BM25 keyword search, merged with RRF.

    Dense retrieval finds semantically similar chunks. BM25 finds exact keyword
    matches. Reciprocal Rank Fusion (RRF) combines both rankings so that chunks
    appearing high in either list score well.

    Args:
        query_embedding — embedded query vector (ideally a HyDE hypothetical passage)
        query_text      — original query text used for BM25 keyword search
        top_k           — number of results (defaults to settings.top_k)

    Returns:
        list of {"text": str, "metadata": dict, "score": float}
        deduplicated by (source, page), sorted by RRF score descending
    """
    collection = _get_collection()
    if collection.count() == 0:
        return []
    
    k = top_k or settings.top_k
    n_candidates = min(k * 3, collection.count())

    # --- Dense retrieval ---
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_candidates,
        include=["documents", "metadatas", "distances"],
    )

    RRF_K = 60
    dense_items: dict[str, dict] = {}
    for rank, (text, meta, dist) in enumerate(zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    )):
        score = 1.0 - dist
        if score < settings.relevance_threshold:
            continue
        id_ = f"{meta['source']}_p{meta['page']}_c{meta.get('chunk', 0)}"
        dense_items[id_] = {"text": text, "metadata": meta, "dense_score": score, "dense_rank": rank}

    # --- BM25 retrieval ---
    bm25_items: dict[str, dict] = {}
    if query_text:
        for bm25_rank, (id_, text, meta) in enumerate(_retrieve_bm25(query_text, n_candidates)):
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
    return len(ids)
