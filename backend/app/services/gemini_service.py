import logging
import asyncio
import time
from typing import Optional, List

import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiService:
    """Handles all Gemini API calls with rate limiting."""

    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")
        self._last_call_time = 0.0
        self._call_count = 0
        logger.info("Gemini service initialized")

    async def _rate_limit(self):
        """Simple rate limiter: ensure we don't exceed RPM limit."""
        now = time.time()
        elapsed = now - self._last_call_time
        if elapsed < settings.gemini_delay_between_calls:
            wait_time = settings.gemini_delay_between_calls - elapsed
            logger.debug(f"Rate limiting: waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        self._last_call_time = time.time()

    async def generate_text(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """Generate text using Gemini with retry logic."""
        await self._rate_limit()
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)
                self._call_count += 1
                return response.text.strip() if response.text else None
            except Exception as e:
                logger.warning(f"Gemini call attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # exponential backoff
        logger.error(f"Gemini text generation failed after {max_retries} attempts")
        return None

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding vector for text."""
        await self._rate_limit()
        try:
            result = genai.embed_content(
                model="models/embedding-001",
                content=text,
            )
            self._call_count += 1
            return result["embedding"]
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
                import json
                return json.loads(response)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Gemini JSON response: {response[:200]}")
        return None

    def get_call_count(self) -> int:
        """Get total API calls made this session."""
        return self._call_count


# Singleton instance
gemini_service = GeminiService()
