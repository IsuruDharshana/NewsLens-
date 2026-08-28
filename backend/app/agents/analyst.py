"""Analyst Agent — Clusters articles by story and categorizes them."""

import logging
from typing import List, Dict, Any, Optional

import numpy as np

from app.services.gemini_service import gemini_service
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AnalystAgent:
    """
    Takes raw articles from Scout Agent.
    Generates embeddings, clusters similar stories,
    assigns categories, and calculates trend scores.
    """

    def __init__(self):
        self.cluster_centroids: Dict[str, List[float]] = {}
        logger.info("Analyst Agent initialized")

    async def analyze(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Main analysis: embed → cluster → categorize → score."""
        if not articles:
            return {"clusters": [], "new_articles": 0}

        # Step 1: Generate embeddings
        texts = [f"{a['title']}. {a.get('content', '')[:200]}" for a in articles]
        embeddings = await gemini_service.generate_embeddings_batch(texts)

        # Step 2: Cluster articles
        clusters = await self._cluster_articles(articles, embeddings)

        # Step 3: Categorize clusters
        for cluster in clusters:
            if not cluster.get("category"):
                cluster["category"] = await self._categorize(cluster)

        logger.info(f"Analyst Agent: {len(clusters)} clusters from {len(articles)} articles")
        return {"clusters": clusters, "new_articles": len(articles)}

    async def _cluster_articles(
        self,
        articles: List[Dict],
        embeddings: List[Optional[List[float]]],
    ) -> List[Dict]:
        """Group articles by semantic similarity."""
        clusters: List[Dict] = []

        for i, (article, embedding) in enumerate(zip(articles, embeddings)):
            if embedding is None:
                # No embedding — create standalone cluster
                clusters.append(self._new_cluster([article]))
                continue

            # Check against existing cluster centroids
            best_match = None
            best_score = 0.0

            for cluster_id, centroid in self.cluster_centroids.items():
                score = self._cosine_similarity(embedding, centroid)
                if score > best_score and score >= settings.similarity_threshold:
                    best_score = score
                    best_match = cluster_id

            if best_match:
                # Add to existing cluster
                for cluster in clusters:
                    if cluster.get("id") == best_match:
                        cluster["articles"].append(article)
                        break
            else:
                # Create new cluster
                new_cluster = self._new_cluster([article])
                new_cluster["embedding"] = embedding
                clusters.append(new_cluster)
                self.cluster_centroids[new_cluster["id"]] = embedding

        # Remove temp embedding field before returning
        for cluster in clusters:
            cluster.pop("embedding", None)

        return clusters

    def _new_cluster(self, articles: List[Dict]) -> Dict:
        """Create a new cluster from articles."""
        import uuid
        return {
            "id": str(uuid.uuid4()),
            "articles": articles,
            "source_count": len(articles),
            "category": None,
            "is_breaking": False,
            "trend_score": 0.0,
        }

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        a_arr, b_arr = np.array(a), np.array(b)
        norm_a, norm_b = np.linalg.norm(a_arr), np.linalg.norm(b_arr)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))

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
