"""Writer Agent — Generates neutral factual summaries."""

import logging
from typing import List, Dict, Any

from app.services.llm_service import llm_service
from app.utils.text import strip_html_tags

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

        # Apply summaries+titles to clusters, with strong fallbacks so a card
        # never ships with a completely blank headline.
        succeeded = 0
        for i, cluster in enumerate(clusters):
            result = all_summaries.get(i, {})
            summary = strip_html_tags(result.get("summary") or "").strip()
            title = strip_html_tags(result.get("title") or "").strip()

            # Fallback 1: derive title from first article headline
            if not title:
                first_article_title = (cluster.get("articles", [])[0].get("title") if cluster.get("articles") else None) or ""
                title = first_article_title.strip()

            # Fallback 2: derive title from first sentence of summary
            if not title and summary:
                title = summary.split(".")[0].strip()

            # Fallback 3: generic but informative title using category
            if not title:
                title = f"{cluster.get('category', 'News')} story"

            # Fallback 4: derive summary from first article content if Gemini gave none
            if not summary and cluster.get("articles"):
                first_summary = strip_html_tags(
                    cluster["articles"][0].get("summary") or cluster["articles"][0].get("content") or ""
                ).strip()
                if first_summary:
                    summary = first_summary[:280] + ("..." if len(first_summary) > 280 else "")

            cluster["summary"] = summary
            cluster["title"] = title

            if summary or title:
                succeeded += 1
                logger.info(f"  Cluster {i+1} [{cluster.get('category', '?')}]: {cluster['title']}")
                logger.info(f"    Summary: {cluster['summary'][:80]}...")
            else:
                logger.warning(f"  Cluster {i+1} [{cluster.get('category', '?')}]: failed")

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

        prompt = f"""For EACH numbered news story below, write:
1. A compelling, attention-grabbing headline (8-15 words, news-style)
2. A 2-3 sentence factual summary

Rules for headlines:
- Must be specific and informative (not generic)
- Use active voice
- Include key names/places when relevant
- Write like a Sri Lankan newspaper headline

Rules for summaries:
1. Only include facts reported by the sources.
2. No opinions, predictions, or editorial commentary.
3. No emotionally charged language.
4. Attribute claims to their sources.
5. Use neutral, objective language.

{stories_text}

Return ONLY valid JSON in this exact format:
{{"stories": [{{"story": 1, "title": "Headline text here", "summary": "The summary text here."}}, {{"story": 2, "title": "Another headline", "summary": "Another summary."}}]}}

Rules:
- Every story number must appear exactly once
- Do not add any explanation, only return JSON"""

        result = await llm_service.generate_json(prompt)
        summaries = {}

        if result and "stories" in result:
            for item in result["stories"]:
                local_idx = item.get("story", 0) - 1
                global_idx = local_idx + start_offset
                text = item.get("summary", "").strip()
                title = item.get("title", "").strip()
                if (text or title) and 0 <= local_idx < len(clusters):
                    summaries[global_idx] = {"summary": text, "title": title}
        elif result and "summaries" in result:
            # Backward compat: old format with only summaries
            for item in result["summaries"]:
                local_idx = item.get("story", 0) - 1
                global_idx = local_idx + start_offset
                text = item.get("summary", "").strip()
                title = item.get("title", "").strip()
                if (text or title) and 0 <= local_idx < len(clusters):
                    summaries[global_idx] = {"summary": text, "title": title}
        else:
            logger.warning(f"Batch summarization failed for offset {start_offset}")

        return summaries
