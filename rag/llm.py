"""Provider-agnostic LLM wrapper.

A single place that knows how to talk to the chat/completion model so the rest
of the codebase stays provider-neutral. Currently backed by Claude via the
Anthropic SDK; embeddings still go through OpenAI (see rag.ingestion.embedder)
because Anthropic has no embeddings endpoint.
"""

import logging

from anthropic import Anthropic

from rag.config import settings

logger = logging.getLogger(__name__)

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def complete(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    max_tokens: int = 1024,
) -> str:
    """
    Generate a completion for a single user prompt.

    Args:
        prompt: the user message.
        system: optional system prompt (Anthropic takes this as a top-level arg,
            not a message).
        model: model id; defaults to settings.llm_model.
        max_tokens: output cap.

    Returns:
        The model's text response.
    """
    client = _get_client()
    response = client.messages.create(
        model=model or settings.llm_model,
        max_tokens=max_tokens,
        system=system or "",
        messages=[{"role": "user", "content": prompt}],
    )
    return next((block.text for block in response.content if block.type == "text"), "")
