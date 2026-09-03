"""Groq LLM provider implementation using open-weight models."""

import json
import logging
import re
import time
from typing import List, Optional

from groq import AsyncGroq

from app.config import get_settings
from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class GroqProvider(LLMProvider):
    """Groq provider: fast, free-tier-friendly inference for text tasks.

    Note: Groq does not provide embedding models. Embeddings fall back to the
    configured embedding provider (default: Gemini).
    """

    MODEL = "llama-3.1-8b-instant"  # fast, cheap, good enough for headlines/summaries
    FAST_JSON_MODEL = "llama-3.1-8b-instant"
    TRANSLATION_MODEL = "llama-3.1-8b-instant"

    def __init__(self):
        api_key = settings.groq_api_key
        if not api_key:
            logger.warning("GROQ_API_KEY not set; Groq provider will fail")
        self.client = AsyncGroq(api_key=api_key)
        self._call_count = 0
        self._last_call_time = 0.0
        logger.info(f"Groq provider initialized (model={self.MODEL})")

    @property
    def name(self) -> str:
        return "groq"

    async def _rate_limit(self):
        """Groq free tier: 30 RPM for most models."""
        now = time.time()
        elapsed = now - self._last_call_time
        if elapsed < 2.0:  # 2s between calls = 30 RPM max
            wait_time = 2.0 - elapsed
            logger.debug(f"Groq rate limiting: waiting {wait_time:.1f}s")
            time.sleep(wait_time)
        self._last_call_time = time.time()

    async def generate_text(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        await self._rate_limit()
        for attempt in range(max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=1024,
                )
                self._call_count += 1
                content = response.choices[0].message.content
                return content.strip() if content else None
            except Exception as e:
                logger.warning(f"Groq text attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await self._sleep(2 ** attempt)
        logger.error("Groq text generation failed after retries")
        return None

    async def generate_json(self, prompt: str, max_retries: int = 3) -> Optional[dict]:
        json_prompt = (
            f"{prompt}\n\nRespond ONLY with valid JSON. "
            "No markdown, no explanation, no code fences."
        )
        for attempt in range(max_retries):
            text = await self.generate_text(json_prompt)
            if text:
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    # Try to extract JSON from markdown/code fences
                    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
                    if match:
                        try:
                            return json.loads(match.group(1))
                        except json.JSONDecodeError:
                            pass
                    logger.warning(f"Groq JSON parse failed (attempt {attempt + 1})")
            if attempt < max_retries - 1:
                await self._sleep(1)
        logger.error("Groq JSON generation failed after retries")
        return None

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Groq does not support embeddings. Return None so callers can fall back."""
        logger.debug("Groq does not support embeddings; returning None")
        return None

    async def translate_to_sinhala_batch(self, texts: List[str]) -> List[Optional[str]]:
        if not texts:
            return []

        indexed = [(i, t) for i, t in enumerate(texts) if t and t.strip()]
        if not indexed:
            return [None] * len(texts)

        numbered = "\n".join(f"{idx + 1}. {t}" for idx, (_, t) in enumerate(indexed))
        prompt = f"""You are a professional Sri Lankan news translator. Translate the following English news summaries into native Sinhala.

Rules:
- Use natural, journalistic Sinhala as written by Sri Lankan newspaper reporters
- Use proper Sinhala grammar and sentence structure (not word-for-word translation)
- Keep proper nouns in their common Sinhala forms
- Maintain factual tone — do not add opinions or change meaning
- Use formal written Sinhala (ලිඛිත සිංහල), not colloquial spoken Sinhala
- Return ONLY the numbered translations, one per line, matching the input numbering

Translate these {len(indexed)} summaries:
{numbered}"""

        result = await self.generate_text(prompt)
        if not result:
            return [texts[i] if texts[i] else None for i in range(len(texts))]

        output = [None] * len(texts)
        for line in result.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            match = re.match(r"^(\d+)[.)]\s*(.+)", line)
            if match:
                orig_idx = int(match.group(1)) - 1
                translated = match.group(2).strip()
                if orig_idx < len(indexed):
                    actual_idx = indexed[orig_idx][0]
                    output[actual_idx] = translated

        for i in range(len(texts)):
            if output[i] is None and texts[i]:
                output[i] = texts[i]

        return output

    def get_call_count(self) -> int:
        return self._call_count

    async def _sleep(self, seconds: float):
        """Async-friendly sleep (replaces asyncio.sleep for consistency)."""
        import asyncio
        await asyncio.sleep(seconds)
