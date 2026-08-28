import logging
import asyncio
import json
import time
from typing import Optional, List

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiService:
    """Handles all Gemini API calls with rate limiting. Uses the new google-genai SDK."""

    MODEL = "gemini-3.6-flash"
    EMBEDDING_MODEL = "text-embedding-004"

    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self._last_call_time = 0.0
        self._call_count = 0
        logger.info(f"Gemini service initialized (model={self.MODEL})")

    async def _rate_limit(self):
        """Simple rate limiter: ensure we don't exceed RPM limit."""
        now = time.time()
        elapsed = now - self._last_call_time
        if elapsed < settings.gemini_delay_between_calls:
            wait_time = settings.gemini_delay_between_calls - elapsed
            logger.debug(f"Rate limiting: waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        self._last_call_time = time.time()

    async def generate_text(self, prompt: str, max_retries: int = 5) -> Optional[str]:
        """Generate text using Gemini with retry logic."""
        await self._rate_limit()
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        )
                    ),
                )
                self._call_count += 1
                return response.text.strip() if response.text else None
            except Exception as e:
                error_str = str(e)
                is_rate_limit = "429" in error_str or "RESOURCE_EXHAUSTED" in error_str
                if is_rate_limit and attempt < max_retries - 1:
                    # Extract retry delay from error message if available
                    import re
                    match = re.search(r"retry in ([\d.]+)s", error_str)
                    wait = float(match.group(1)) + 1.0 if match else 15.0
                    logger.info(f"Rate limited (429). Waiting {wait:.0f}s before retry {attempt + 2}")
                    await asyncio.sleep(wait)
                    self._last_call_time = time.time()  # reset rate limiter
                elif attempt < max_retries - 1:
                    logger.warning(f"Gemini call attempt {attempt + 1} failed: {e}")
                    await asyncio.sleep(2 ** attempt)
                else:
                    logger.warning(f"Gemini call attempt {attempt + 1} failed: {e}")
        logger.error(f"Gemini text generation failed after {max_retries} attempts")
        return None

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding vector for text."""
        await self._rate_limit()
        try:
            response = self.client.models.embed_content(
                model=self.EMBEDDING_MODEL,
                contents=text,
            )
            self._call_count += 1
            return response.embeddings[0].values
        except Exception as e:
            logger.error(f"Gemini embedding failed: {e}")
            return None

    async def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        results = []
        for text in texts:
            embedding = await self.generate_embedding(text)
            results.append(embedding)
        return results

    async def generate_json(self, prompt: str) -> Optional[dict]:
        """Generate JSON response using Gemini."""
        json_prompt = f"{prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        response = await self.generate_text(json_prompt)
        if response:
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Gemini JSON response: {response[:200]}")
        return None

    def get_call_count(self) -> int:
        """Get total API calls made this session."""
        return self._call_count


# Lazy singleton — created on first access, not at import time
_gemini_service_instance: GeminiService | None = None


def get_gemini_service() -> GeminiService:
    """Get or create the GeminiService singleton."""
    global _gemini_service_instance
    if _gemini_service_instance is None:
        _gemini_service_instance = GeminiService()
    return _gemini_service_instance


class _GeminiProxy:
    """Proxy that lazily initializes GeminiService on first attribute access."""

    def __getattr__(self, name):
        return getattr(get_gemini_service(), name)


gemini_service = _GeminiProxy()  # type: ignore
