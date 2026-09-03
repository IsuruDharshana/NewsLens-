"""
Unified LLM service.

Agents and routes import `llm_service` from this module. The actual provider
(Gemini, Groq, etc.) is chosen via the LLM_PROVIDER env var. Embeddings always
fall back to Gemini unless explicitly disabled, because most alternative
providers don't offer embedding models.
"""

import logging
from typing import List, Optional

from app.config import get_settings
from app.services.llm_provider import LLMProvider
from app.services.gemini_service import gemini_service as _gemini_service
from app.services.groq_provider import GroqProvider

logger = logging.getLogger(__name__)
settings = get_settings()


def _create_provider() -> LLMProvider:
    """Factory: create the configured text-generation provider."""
    provider_name = (settings.llm_provider or "gemini").lower().strip()

    if provider_name == "groq":
        logger.info("Using Groq as primary LLM provider")
        return GroqProvider()

    if provider_name not in ("gemini", "google"):
        logger.warning(f"Unknown LLM_PROVIDER '{provider_name}', falling back to Gemini")

    logger.info("Using Gemini as primary LLM provider")
    # Wrap the existing GeminiService so it satisfies LLMProvider
    return _GeminiProviderAdapter()


class _GeminiProviderAdapter(LLMProvider):
    """Adapter that exposes the existing GeminiService through LLMProvider."""

    def __init__(self):
        self._service = _gemini_service

    @property
    def name(self) -> str:
        return "gemini"

    async def generate_text(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        return await self._service.generate_text(prompt, max_retries=max_retries)

    async def generate_json(self, prompt: str, max_retries: int = 3) -> Optional[dict]:
        return await self._service.generate_json(prompt)

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        return await self._service.generate_embedding(text)

    async def translate_to_sinhala_batch(self, texts: List[str]) -> List[Optional[str]]:
        return await self._service.translate_to_sinhala_batch(texts)

    def get_call_count(self) -> int:
        return self._service.get_call_count()


class LLMService:
    """High-level service used by agents and routes.

    Handles provider selection and embedding fallback logic transparently.
    """

    def __init__(self):
        self.primary = _create_provider()
        # Embeddings: use Gemini unless the primary provider supports them.
        self.embedding_provider: LLMProvider = self.primary
        if self.primary.name != "gemini":
            self.embedding_provider = _GeminiProviderAdapter()
            logger.info("Using Gemini as embedding fallback")

    async def generate_text(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        return await self.primary.generate_text(prompt, max_retries=max_retries)

    async def generate_json(self, prompt: str, max_retries: int = 3) -> Optional[dict]:
        return await self.primary.generate_json(prompt, max_retries=max_retries)

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        result = await self.embedding_provider.generate_embedding(text)
        if result is None and self.embedding_provider.name != "gemini":
            # Last resort: try Gemini directly
            logger.warning("Embedding provider returned None, falling back to Gemini")
            result = await _gemini_service.generate_embedding(text)
        return result

    async def translate_to_sinhala_batch(self, texts: List[str]) -> List[Optional[str]]:
        return await self.primary.translate_to_sinhala_batch(texts)

    def get_call_count(self) -> int:
        return self.primary.get_call_count()

    @property
    def provider_name(self) -> str:
        return self.primary.name


# Singleton used by the rest of the app
llm_service = LLMService()
