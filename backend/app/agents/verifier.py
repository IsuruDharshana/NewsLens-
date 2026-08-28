"""Verifier Agent — Cross-references, bias detection, confidence scoring."""

import logging
from typing import List, Dict, Any

from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

BIAS_PROMPT = """Analyze the tone and framing of this news article headline and snippet.

Classify as exactly ONE of:
- "neutral" — balanced, factual reporting
- "pro_government" — favorable framing toward government/authority
- "critical" — critical or opposition framing
- "sensationalist" — emotionally charged, exaggerated language

Article:
Headline: {title}
Source: {source}
Content: {content}

Respond ONLY with valid JSON:
{{"label": "one_of_the_four_labels", "explanation": "one sentence explanation"}}"""


class VerifierAgent:
    """
    Takes summarized clusters from Writer Agent.
    Cross-references sources, detects bias, and scores confidence.
    """

    def __init__(self):
        logger.info("Verifier Agent initialized")

    async def verify(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run full verification on all clusters."""
        for cluster in clusters:
            # Bias detection per source
            bias_results = await self._detect_bias(cluster)
            cluster["bias_analysis"] = self._aggregate_bias(bias_results)

            # Confidence scoring
            cluster["confidence_score"] = self._calculate_confidence(cluster)

            # Breaking news detection
            cluster["is_breaking"] = self._is_breaking_news(cluster)

            logger.info(
                f"  Cluster '{cluster['id'][:8]}...': "
                f"confidence={cluster['confidence_score']:.2f}, "
                f"breaking={cluster['is_breaking']}"
            )
        return clusters

    async def _detect_bias(self, cluster: Dict) -> List[Dict]:
        """Detect bias for each article in the cluster."""
        results = []
        articles = cluster.get("articles", [])

        for article in articles[:5]:  # Limit to 5 per cluster to save API calls
            prompt = BIAS_PROMPT.format(
                title=article.get("title", ""),
                source=article.get("source_name", ""),
                content=article.get("content", "")[:300],
            )
            response = await gemini_service.generate_json(prompt)
            if response:
                results.append({
                    "source_name": article.get("source_name"),
                    "label": response.get("label", "neutral"),
                    "explanation": response.get("explanation", ""),
                })
            else:
                results.append({
                    "source_name": article.get("source_name"),
                    "label": "neutral",
                    "explanation": "Analysis unavailable",
                })
        return results

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
