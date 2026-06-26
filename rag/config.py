from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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

    # RAG settings
    chunk_size: int = 512
    chunk_overlap: int = 64
    top_k: int = 5
    relevance_threshold: float = 0.3


settings = Settings()
