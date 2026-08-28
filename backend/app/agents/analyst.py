"""Analyst Agent — Clusters articles by story and categorizes them."""

import logging
import uuid
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class AnalystAgent:
    """
    Takes raw articles from Scout Agent.
    Uses Gemini to cluster same-story articles and categorize them.
    Optimized: 2 Gemini calls total (1 clustering + 1 batch categorization).
    """

    def __init__(self):
        logger.info("Analyst Agent initialized")

    async def analyze(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Main analysis: cluster via Gemini → batch categorize."""
        if not articles:
            return {"clusters": [], "new_articles": 0}

        # Step 1: Cluster articles using Gemini (1 call)
        clusters = await self._cluster_with_gemini(articles)

        # Step 2: Categorize ALL clusters in one call
        await self._categorize_batch(clusters)

        logger.info(f"Analyst Agent: {len(clusters)} clusters from {len(articles)} articles")
        return {"clusters": clusters, "new_articles": len(articles)}

    async def _cluster_with_gemini(self, articles: List[Dict]) -> List[Dict]:
        """Use Gemini to group articles about the same story together."""
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
                idx = num - 1
                if 0 <= idx < len(articles):
                    group_articles.append(articles[idx])
            if group_articles:
                cluster = self._new_cluster(group_articles)
                cluster["topic"] = group.get("topic", "")
                clusters.append(cluster)

        return clusters

    async def _categorize_batch(self, clusters: List[Dict]) -> None:
        """Categorize ALL clusters in a single Gemini call."""
        from app.models.sources import CATEGORIES

        # Build numbered list of cluster topics/titles
        cluster_list = []
        for i, cluster in enumerate(clusters):
            titles = [a["title"] for a in cluster["articles"][:3]]
            topic = cluster.get("topic", "")
            cluster_list.append(f"{i+1}. Topic: {topic}\n   Headlines: {'; '.join(titles)}")

        categories_str = ", ".join(CATEGORIES)

        prompt = f"""Categorize each numbered news story into exactly ONE of these categories: {categories_str}.

Stories:
{chr(10).join(cluster_list)}

Return ONLY valid JSON in this exact format:
{{"categories": [{{"cluster": 1, "category": "Politics"}}, {{"cluster": 2, "category": "Economy"}}]}}

Rules:
- Every cluster number must appear exactly once
- Use only categories from the provided list
- Do not add any explanation, only return JSON"""

        result = await gemini_service.generate_json(prompt)

        if result and "categories" in result:
            for item in result["categories"]:
                idx = item.get("cluster", 0) - 1
                cat = item.get("category", "Politics")
                if 0 <= idx < len(clusters):
                    # Validate category name
                    for valid_cat in CATEGORIES:
                        if valid_cat.lower() in cat.lower():
                            clusters[idx]["category"] = valid_cat
                            break
                    else:
                        clusters[idx]["category"] = "Politics"
        else:
            logger.warning("Batch categorization failed, using default")
            for cluster in clusters:
                cluster["category"] = "Politics"

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
