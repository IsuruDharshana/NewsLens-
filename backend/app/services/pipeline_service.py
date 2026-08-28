"""
Pipeline Orchestrator — Wires Scout → Analyst → Writer → Verifier together.
Stores results in Supabase at each stage.
"""

import logging
from datetime import datetime, timezone
from typing import Dict

from app.agents.scout import ScoutAgent
from app.agents.analyst import AnalystAgent
from app.agents.writer import WriterAgent
from app.agents.verifier import VerifierAgent
from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    """Runs the full news processing pipeline: fetch → cluster → summarize → verify."""

    def __init__(self):
        self.scout = ScoutAgent()
        self.analyst = AnalystAgent()
        self.writer = WriterAgent()
        self.verifier = VerifierAgent()
        self.is_running = False
        self.last_run_at: datetime | None = None
        self.last_run_stats: dict = {}

    async def run(self) -> dict:
        """Execute the full pipeline. Returns stats dict."""
        if self.is_running:
            logger.warning("Pipeline is already running, skipping...")
            return {"status": "skipped", "reason": "already_running"}

        self.is_running = True
        errors = []
        stats = {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "articles_fetched": 0,
            "articles_stored": 0,
            "clusters_created": 0,
            "clusters_updated": 0,
            "errors": [],
        }

        run_id = await supabase_service.create_pipeline_run()

        try:
            # ── Step 1: SCOUT — Fetch articles from RSS feeds ──
            logger.info("═══ PIPELINE STEP 1: SCOUT AGENT ═══")
            raw_articles = await self.scout.fetch_all()
            stats["articles_fetched"] = len(raw_articles)
            logger.info(f"Scout fetched {len(raw_articles)} articles")

            if not raw_articles:
                logger.info("No new articles found. Pipeline complete.")
                stats["status"] = "completed"
                stats["message"] = "No new articles"
                await self._finish_run(run_id, stats)
                return stats

            # Store raw articles in Supabase
            stored_ids = []
            for article in raw_articles:
                article_id = await supabase_service.insert_article(article)
                if article_id:
                    stored_ids.append(article_id)
            stats["articles_stored"] = len(stored_ids)
            logger.info(f"Stored {len(stored_ids)} new articles in Supabase")

            # Build lookup: source_url -> article_id (for linking clusters later)
            self._url_to_id: Dict[str, str] = {}
            for article in raw_articles:
                aid = await self._find_article_id(article.get("source_url"))
                if aid:
                    self._url_to_id[article["source_url"]] = aid

            # ── Step 2: ANALYST — Cluster and categorize ──
            logger.info("═══ PIPELINE STEP 2: ANALYST AGENT ═══")
            analysis = await self.analyst.analyze(raw_articles)
            clusters = analysis.get("clusters", [])
            logger.info(f"Analyst produced {len(clusters)} clusters")

            # ── Step 3: WRITER — Generate neutral summaries ──
            logger.info("═══ PIPELINE STEP 3: WRITER AGENT ═══")
            clusters = await self.writer.write_summaries(clusters)
            summarized = sum(1 for c in clusters if c.get("summary"))
            logger.info(f"Writer summarized {summarized}/{len(clusters)} clusters")

            # ── Step 4: VERIFIER — Bias detection and confidence ──
            logger.info("═══ PIPELINE STEP 4: VERIFIER AGENT ═══")
            clusters = await self.verifier.verify(clusters)
            breaking_count = sum(1 for c in clusters if c.get("is_breaking"))
            logger.info(f"Verifier found {breaking_count} breaking stories")

            # ── Step 5: STORE — Persist clusters and link articles ──
            logger.info("═══ PIPELINE STEP 5: STORING RESULTS ═══")
            for cluster in clusters:
                cluster_id = await supabase_service.create_cluster({
                    "summary": cluster.get("summary"),
                    "source_count": cluster.get("source_count", 0),
                    "category": cluster.get("category", "Politics"),
                    "is_breaking": cluster.get("is_breaking", False),
                    "confidence_score": cluster.get("confidence_score", 0.0),
                    "trend_score": cluster.get("trend_score", 0.0),
                    "bias_analysis": cluster.get("bias_analysis"),
                    "official_source_data": cluster.get("official_source_data"),
                    "published_at": datetime.now(timezone.utc).isoformat(),
                })

                if cluster_id:
                    stats["clusters_created"] += 1
                    # Link articles to their cluster
                    for article in cluster.get("articles", []):
                        # Find the stored article ID by source_url
                        article_id = await self._find_article_id(article.get("source_url"))
                        if article_id:
                            await supabase_service.update_article_cluster(article_id, cluster_id)

                    # Store per-article bias data
                    for article in cluster.get("articles", []):
                        article_id = await self._find_article_id(article.get("source_url"))
                        if article_id:
                            # Find matching bias result from verifier
                            bias_label = "neutral"
                            bias_explanation = ""
                            for a in cluster.get("articles", []):
                                if a.get("source_url") == article.get("source_url"):
                                    bias_label = a.get("bias_label", "neutral")
                                    bias_explanation = a.get("bias_explanation", "")
                                    break
                            # Bias was set on cluster level, use neutral as default per-article
                            await supabase_service.update_article_bias(
                                article_id, bias_label, bias_explanation
                            )

            stats["status"] = "completed"
            stats["completed_at"] = datetime.now(timezone.utc).isoformat()
            stats["gemini_calls"] = self.analyst.__class__.__name__  # placeholder

            logger.info(
                f"═══ PIPELINE COMPLETE ═══\n"
                f"  Articles fetched: {stats['articles_fetched']}\n"
                f"  Articles stored:  {stats['articles_stored']}\n"
                f"  Clusters created: {stats['clusters_created']}\n"
                f"  Breaking stories: {breaking_count}"
            )

        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            stats["status"] = "failed"
            stats["errors"].append(str(e))
            errors.append(str(e))

        finally:
            self.is_running = False
            self.last_run_at = datetime.now(timezone.utc)
            self.last_run_stats = stats
            await self._finish_run(run_id, stats)

        return stats

    async def _find_article_id(self, source_url: str) -> str | None:
        """Find an article ID by its source URL. Uses cache first."""
        # Check cache first
        if hasattr(self, '_url_to_id') and source_url in self._url_to_id:
            return self._url_to_id[source_url]
        try:
            result = supabase_service.client.table("articles").select("id").eq("source_url", source_url).limit(1).execute()
            if result.data:
                aid = result.data[0]["id"]
                if hasattr(self, '_url_to_id'):
                    self._url_to_id[source_url] = aid
                return aid
        except Exception as e:
            logger.debug(f"Could not find article by URL: {source_url}")
        return None

    async def _finish_run(self, run_id: str | None, stats: dict):
        """Mark pipeline run as completed in Supabase."""
        if run_id:
            await supabase_service.complete_pipeline_run(run_id, {
                "articles_fetched": stats.get("articles_fetched", 0),
                "clusters_created": stats.get("clusters_created", 0),
                "clusters_updated": stats.get("clusters_updated", 0),
                "errors": stats.get("errors") or None,
            })

    def get_status(self) -> dict:
        """Get current pipeline status."""
        return {
            "is_running": self.is_running,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "last_run_stats": self.last_run_stats,
        }


# Singleton instance
pipeline = PipelineOrchestrator()
