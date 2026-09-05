"""
Abstract LLM provider interface.

All agents and routes should call through LLMService so the underlying
provider (Gemini, Groq, OpenAI, etc.) can be swapped via configuration.
"""

from abc import ABC, abstractmethod
from typing import List, Optional


class LLMProvider(ABC):
    """Unified interface for text generation, embeddings, and translation."""

    @abstractmethod
    async def generate_text(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """Generate plain text from a prompt."""
        pass

    @abstractmethod
    async def generate_json(self, prompt: str, max_retries: int = 3) -> Optional[dict]:
        """Generate a JSON object from a prompt."""
        pass

    @abstractmethod
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate an embedding vector for the given text."""
        pass

    @abstractmethod
    async def translate_to_sinhala_batch(self, texts: List[str]) -> List[Optional[str]]:
        """Translate a batch of English texts to Sinhala."""
        pass

    @abstractmethod
    def get_call_count(self) -> int:
        """Return the number of API calls made this session."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/metrics."""
        pass
