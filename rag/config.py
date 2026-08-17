from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # API keys
    openai_api_key: str          # used for embeddings (Anthropic has no embeddings endpoint)
    anthropic_api_key: str       # used for generation / synthesis / agent reasoning
    s2_api_key: str = ""         # optional Semantic Scholar key for higher rate limits

    # LLM (Claude via Anthropic SDK)
    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-6"   # answer generation + literature synthesis
    fast_model: str = "claude-haiku-4-5"   # cheap/fast steps (HyDE)

    # Embeddings (OpenAI)
    embedding_model: str = "text-embedding-3-small"

    # Vector store
    chroma_persist_dir: str = "./data/chroma"
    collection_name: str = "documents"

    # Where uploaded files are staged before the Celery worker ingests them.
    # The API process writes here and the worker reads from here, so in Docker
    # both containers must share this directory (see docker-compose.yml).
    upload_dir: str = "/tmp/uploads"

    # Extracted full text of every ingested source, one JSON file per document
    # (pages keyed by number). The worker writes it at ingest time; the API
    # serves it so users can read a source in full — not just the retrieved
    # chunks. Must live on the shared volume like chroma/ and uploads/.
    library_dir: str = "./data/library"

    # RAG settings
    chunk_size: int = 512
    chunk_overlap: int = 64
    top_k: int = 5
    relevance_threshold: float = 0.3

    # CRAG-style retrieval evaluation (Corrective RAG, arXiv:2401.15884)
    # An LLM judge scores each retrieved chunk; on weak verdicts we reformulate
    # the query and re-retrieve instead of generating from bad context.
    relevance_eval_enabled: bool = True
    relevance_eval_max_rounds: int = 2        # original + one reformulation round
    relevance_threshold_correct: float = 0.6  # score >= this -> verdict "correct"
    relevance_threshold_ambiguous: float = 0.3  # score >= this -> "ambiguous", else "incorrect"

    # SimRAG-style self-evaluation (POST /selfimprove/run, arXiv:2410.17952)
    # The model writes questions its own library should answer, then we measure
    # how often retrieval surfaces the ground-truth chunk (hit rate).
    selfeval_num_samples: int = 5
    selfeval_top_k: int = 3
    selfeval_questions_per_chunk: int = 3


settings = Settings()
