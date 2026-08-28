"""Writer Agent — Generates neutral factual summaries."""

import logging
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class WriterAgent:
    """
    Takes clustered articles from Analyst Agent.
    Generates neutral factual summaries using Gemini.
    Optimized: 1-2 batched calls instead of 1 per cluster.
    """

    def __init__(self):
        logger.info("Writer Agent initialized")

    async def write_summaries(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate summaries for ALL clusters in batched calls."""
        if not clusters:
            return clusters

        # Try to do all clusters in one call; fall back to batches if too many
        batch_size = 10  # max clusters per summary call
        all_summaries = {}

        for start in range(0, len(clusters), batch_size):
            batch = clusters[start:start + batch_size]
            summaries = await self._summarize_batch(batch, start_offset=start)
            all_summaries.update(summaries)

        # Apply summaries to clusters
        succeeded = 0
        for i, cluster in enumerate(clusters):
            summary = all_summaries.get(i)
            cluster["summary"] = summary
            if summary:
                succeeded += 1
                logger.info(f"  Cluster {i+1} [{cluster.get('category', '?')}]: {summary[:80]}...")
            else:
                logger.warning(f"  Cluster {i+1} [{cluster.get('category', '?')}]: summary failed")

        logger.info(f"Writer Agent: {succeeded}/{len(clusters)} summaries generated")
        return clusters

    async def _summarize_batch(
        self, clusters: List[Dict], start_offset: int = 0
    ) -> Dict[int, str]:
        """Summarize a batch of clusters in one Gemini call. Returns {global_index: summary}."""
        # Build the batch prompt
        stories = []
        for i, cluster in enumerate(clusters):
            articles = cluster.get("articles", [])
            headlines = "; ".join(a["title"] for a in articles[:5])
            sources = ", ".join(set(a["source_name"] for a in articles))
            stories.append(
                f"Story {i+1} (sources: {sources}):\n  Headlines: {headlines}"
            )

        stories_text = "\n\n".join(stories)

        prompt = f"""Write a 2-3 sentence factual summary for EACH numbered news story below.

Rules:
1. Only include facts reported by the sources.
2. No opinions, predictions, or editorial commentary.
3. No emotionally charged language.
4. Attribute claims to their sources.
5. Use neutral, objective language.

{stories_text}

Return ONLY valid JSON in this exact format:
{{"summaries": [{{"story": 1, "summary": "The summary text here."}}, {{"story": 2, "summary": "Another summary."}}]}}

Rules:
- Every story number must appear exactly once
- Each summary should be 2-3 sentences
- Do not add any explanation, only return JSON"""

        result = await gemini_service.generate_json(prompt)
        summaries = {}

        if result and "summaries" in result:
            for item in result["summaries"]:
                local_idx = item.get("story", 0) - 1
                global_idx = local_idx + start_offset
                text = item.get("summary", "").strip()
                if text and 0 <= local_idx < len(clusters):
                    summaries[global_idx] = text
        else:
            logger.warning(f"Batch summarization failed for offset {start_offset}")

        return summaries
