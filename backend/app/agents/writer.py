"""Writer Agent — Generates neutral factual summaries."""

import logging
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

WRITER_PROMPT = """Write a 2-3 sentence factual summary of this news story.

Rules:
1. Only include facts reported by the sources.
2. No opinions, predictions, or editorial commentary.
3. No emotionally charged language.
4. Attribute claims to their sources.
5. Use neutral, objective language.

Headlines from different sources:
{headlines}

Source names: {sources}

Write the summary:"""


class WriterAgent:
    """
    Takes clustered articles from Analyst Agent.
    Generates neutral factual summaries using Gemini.
    """

    def __init__(self):
        logger.info("Writer Agent initialized")

    async def write_summaries(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate summaries for each cluster."""
        for cluster in clusters:
            summary = await self._summarize_cluster(cluster)
            cluster["summary"] = summary
            if summary:
                logger.info(f"  Cluster '{cluster['id'][:8]}...': {summary[:80]}...")
            else:
                logger.warning(f"  Cluster '{cluster['id'][:8]}...': summary generation failed")
        return clusters

    async def _summarize_cluster(self, cluster: Dict) -> str | None:
        """Generate a neutral summary for a single cluster."""
        articles = cluster.get("articles", [])
        if not articles:
            return None

        headlines = "\n".join(f"- {a['title']}" for a in articles[:8])
        source_names = ", ".join(set(a["source_name"] for a in articles))

        prompt = WRITER_PROMPT.format(headlines=headlines, sources=source_names)
        return await gemini_service.generate_text(prompt)
