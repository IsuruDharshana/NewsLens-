"""Analyst Agent — Clusters articles by story and categorizes them."""

import json
import logging
import uuid
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class AnalystAgent:
    """
    Takes raw articles from Scout Agent.
    Uses Gemini to cluster same-story articles and categorize them.
    """

    def __init__(self):
        logger.info("Analyst Agent initialized")

    async def analyze(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Main analysis: cluster via Gemini → categorize."""
        if not articles:
            return {"clusters": [], "new_articles": 0}

        # Step 1: Cluster articles using Gemini
        clusters = await self._cluster_with_gemini(articles)

        # Step 2: Categorize each cluster
        for cluster in clusters:
            cluster["category"] = await self._categorize(cluster)

        logger.info(f"Analyst Agent: {len(clusters)} clusters from {len(articles)} articles")
        return {"clusters": clusters, "new_articles": len(articles)}

    async def _cluster_with_gemini(self, articles: List[Dict]) -> List[Dict]:
        """Use Gemini to group articles about the same story together."""
        # Build numbered list of headlines with source
        numbered_list = "\n".join(
            f"{i+1}. [{a['source_name']}] {a['title']}"
            for i, a in enumerate(articles)
        )

        prompt = f"""Group these news headlines by topic. Articles about the SAME story or closely related events should be in the same group.

Headlines:
{numbered_list}

Return ONLY valid JSON in this exact format:
{{"groups": [{{"topic": "brief topic description", "article_numbers": [1, 3, 5]}}, {{"topic": "another topic", "article_numbers": [2, 4]}}]}}

Rules:
- Each article number must appear in exactly one group
- Groups with only 1 article are fine
- Group articles that cover the same event or story
- Do not add any explanation, only return JSON"""

        result = await gemini_service.generate_json(prompt)

        if not result or "groups" not in result:
            logger.warning("Gemini clustering failed, creating individual clusters")
            return [self._new_cluster([a]) for a in articles]

        clusters = []
        for group in result["groups"]:
            group_articles = []
            for num in group.get("article_numbers", []):
                idx = num - 1  # Convert to 0-based index
                if 0 <= idx < len(articles):
                    group_articles.append(articles[idx])
            if group_articles:
                cluster = self._new_cluster(group_articles)
                cluster["topic"] = group.get("topic", "")
                clusters.append(cluster)

        return clusters

    def _new_cluster(self, articles: List[Dict]) -> Dict:
        """Create a new cluster from articles."""
        return {
            "id": str(uuid.uuid4()),
            "articles": articles,
            "source_count": len(articles),
            "category": None,
            "is_breaking": False,
            "trend_score": 0.0,
        }

    async def _categorize(self, cluster: Dict) -> str:
        """Use Gemini to categorize a cluster of articles."""
        titles = [a["title"] for a in cluster["articles"][:5]]
        prompt = (
            f"Categorize this news story into exactly ONE of these categories: "
            f"Politics, Economy, Sports, Technology, Health, Education, Environment, Entertainment.\n\n"
            f"Headlines:\n" + "\n".join(f"- {t}" for t in titles) +
            f"\n\nRespond with ONLY the category name, nothing else."
        )
        result = await gemini_service.generate_text(prompt)
        if result:
            from app.models.sources import CATEGORIES
            for cat in CATEGORIES:
                if cat.lower() in result.lower():
                    return cat
        return "Politics"  # default fallback
