"""Verifier Agent — Cross-references, bias detection, confidence scoring."""

import logging
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class VerifierAgent:
    """
    Takes summarized clusters from Writer Agent.
    Cross-references sources, detects bias, and scores confidence.
    Optimized: 1 batched bias call instead of ~50 individual calls.
    """

    def __init__(self):
        logger.info("Verifier Agent initialized")

    async def verify(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run full verification on all clusters."""
        # Step 1: Batch bias detection for ALL articles across all clusters
        all_bias_results = await self._detect_bias_batch(clusters)

        # Step 2: Apply bias results, confidence, and breaking detection per cluster
        article_idx = 0
        for cluster in clusters:
            articles = cluster.get("articles", [])

            # Collect bias results for this cluster's articles
            cluster_bias_results = []
            for article in articles:
                result = all_bias_results.get(article_idx, {
                    "label": "neutral",
                    "explanation": "Analysis unavailable",
                })
                # Store per-article bias on the article dict (used by pipeline)
                article["bias_label"] = result.get("label", "neutral")
                article["bias_explanation"] = result.get("explanation", "")
                cluster_bias_results.append({
                    "source_name": article.get("source_name"),
                    "label": result.get("label", "neutral"),
                    "explanation": result.get("explanation", ""),
                })
                article_idx += 1

            cluster["bias_analysis"] = self._aggregate_bias(cluster_bias_results)
            cluster["confidence_score"] = self._calculate_confidence(cluster)
            cluster["is_breaking"] = self._is_breaking_news(cluster)

            logger.info(
                f"  Cluster [{cluster.get('category', '?')}]: "
                f"confidence={cluster['confidence_score']:.2f}, "
                f"breaking={cluster['is_breaking']}"
            )
        return clusters

    async def _detect_bias_batch(self, clusters: List[Dict]) -> Dict[int, Dict]:
        """Detect bias for ALL articles in one Gemini call. Returns {global_index: result}."""
        # Build numbered list of all articles
        articles_list = []
        idx = 0
        for cluster in clusters:
            for article in cluster.get("articles", []):
                title = article.get("title", "")
                source = article.get("source_name", "")
                content = article.get("content", "")[:200]
                articles_list.append(
                    f"{idx+1}. [{source}] {title}\n   {content}"
                )
                idx += 1

        total_articles = len(articles_list)
        if total_articles == 0:
            return {}

        articles_text = "\n".join(articles_list)

        prompt = f"""Analyze the tone and framing of each numbered news article below.

Classify each as exactly ONE of:
- "neutral" — balanced, factual reporting
- "pro_government" — favorable framing toward government/authority
- "critical" — critical or opposition framing
- "sensationalist" — emotionally charged, exaggerated language

Articles:
{articles_text}

Return ONLY valid JSON in this exact format:
{{"results": [{{"article": 1, "label": "neutral", "explanation": "Straight factual reporting"}}, {{"article": 2, "label": "critical", "explanation": "Critical framing of policy"}}]}}

Rules:
- Every article number from 1 to {total_articles} must appear exactly once
- Use only the four labels listed above
- Keep explanations to one short sentence
- Do not add any explanation, only return JSON"""

        result = await gemini_service.generate_json(prompt)
        bias_map = {}

        if result and "results" in result:
            for item in result["results"]:
                article_num = item.get("article", 0) - 1  # Convert to 0-based
                if 0 <= article_num < total_articles:
                    bias_map[article_num] = {
                        "label": item.get("label", "neutral"),
                        "explanation": item.get("explanation", ""),
                    }
            logger.info(f"Bias detection: analyzed {len(bias_map)}/{total_articles} articles")
        else:
            logger.warning("Batch bias detection failed")

        return bias_map

    def _aggregate_bias(self, bias_results: List[Dict]) -> Dict:
        """Aggregate individual bias labels into a summary."""
        counts = {"neutral": 0, "pro_government": 0, "critical": 0, "sensationalist": 0}
        for result in bias_results:
            label = result.get("label", "neutral")
            if label in counts:
                counts[label] += 1
        return counts

    def _calculate_confidence(self, cluster: Dict) -> float:
        """
        Calculate confidence score (0.0 to 1.0) based on:
        - Number of sources (more = higher confidence)
        - Source diversity (different outlets = higher)
        - Bias agreement (all neutral = higher)
        """
        source_count = cluster.get("source_count", 0)
        bias = cluster.get("bias_analysis", {})

        # Source count weight (0.4): max confidence at 5+ sources
        count_score = min(source_count / 5.0, 1.0)

        # Diversity weight (0.3): unique source names
        articles = cluster.get("articles", [])
        unique_sources = len(set(a.get("source_name", "") for a in articles))
        diversity_score = min(unique_sources / 3.0, 1.0)

        # Bias agreement weight (0.3): more neutral = higher confidence
        total_bias = sum(bias.values()) if bias else 0
        neutral_ratio = bias.get("neutral", 0) / max(total_bias, 1)
        agreement_score = neutral_ratio

        confidence = (
            0.4 * count_score +
            0.3 * diversity_score +
            0.3 * agreement_score
        )
        return round(confidence, 2)

    def _is_breaking_news(self, cluster: Dict) -> bool:
        """Detect if this cluster is breaking news."""
        articles = cluster.get("articles", [])
        if cluster.get("source_count", 0) < 4:
            return False

        # Check for breaking keywords in headlines
        breaking_keywords = [
            "breaking", "just in", "urgent", "alert",
            "power cut", "earthquake", "flood", "tsunami",
            "curfew", "state of emergency",
        ]
        for article in articles:
            title = article.get("title", "").lower()
            if any(kw in title for kw in breaking_keywords):
                return True

        # High source count in short time = likely breaking
        if cluster.get("source_count", 0) >= 6:
            return True

        return False
