import logging
from typing import Optional, List, Dict, Any

from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SupabaseService:
    """Handles all database operations via Supabase."""

    def __init__(self):
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
        logger.info("Supabase client initialized")

    # --- Articles ---

    async def insert_article(self, article: Dict[str, Any]) -> Optional[str]:
        """Insert a new article. Returns article ID or None if duplicate."""
        try:
            result = self.client.table("articles").insert(article).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            if "duplicate" in str(e).lower():
                logger.debug(f"Duplicate article skipped: {article.get('source_url')}")
                return None
            logger.error(f"Error inserting article: {e}")
        return None

    async def get_articles_without_cluster(self) -> List[Dict]:
        """Get articles that haven't been clustered yet."""
        try:
            result = self.client.table("articles").select("*").is_("cluster_id", "null").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching unclustered articles: {e}")
            return []

    async def update_article_cluster(self, article_id: str, cluster_id: str):
        """Assign an article to a cluster."""
        try:
            self.client.table("articles").update({"cluster_id": cluster_id}).eq("id", article_id).execute()
        except Exception as e:
            logger.error(f"Error updating article cluster: {e}")

    async def update_article_bias(self, article_id: str, bias_label: str, bias_explanation: str):
        """Update bias analysis for an article."""
        try:
            self.client.table("articles").update({
                "bias_label": bias_label,
                "bias_explanation": bias_explanation,
            }).eq("id", article_id).execute()
        except Exception as e:
            logger.error(f"Error updating article bias: {e}")

    async def get_articles_by_cluster(self, cluster_id: str) -> List[Dict]:
        """Get all articles in a cluster."""
        try:
            result = self.client.table("articles").select("*").eq("cluster_id", cluster_id).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching cluster articles: {e}")
            return []

    # --- Clusters ---

    async def create_cluster(self, cluster: Dict[str, Any]) -> Optional[str]:
        """Create a new cluster. Returns cluster ID."""
        try:
            result = self.client.table("clusters").insert(cluster).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            logger.error(f"Error creating cluster: {e}")
        return None

    async def update_cluster(self, cluster_id: str, updates: Dict[str, Any]):
        """Update a cluster's summary, scores, etc."""
        try:
            self.client.table("clusters").update(updates).eq("id", cluster_id).execute()
        except Exception as e:
            logger.error(f"Error updating cluster: {e}")

    async def get_clusters(
        self,
        page: int = 1,
        limit: int = 20,
        category: Optional[str] = None,
        is_breaking: bool = False,
        order_by: str = "published_at",
        ascending: bool = False,
    ) -> tuple[List[Dict], int]:
        """Get paginated clusters with optional filters."""
        try:
            query = self.client.table("clusters").select("*", count="exact")
            if category:
                query = query.eq("category", category)
            if is_breaking:
                query = query.eq("is_breaking", True)
            query = query.order(order_by, desc=not ascending)
            query = query.range((page - 1) * limit, page * limit - 1)
            result = query.execute()
            total = result.count or 0
            return result.data or [], total
        except Exception as e:
            logger.error(f"Error fetching clusters: {e}")
            return [], 0

    async def get_cluster_by_id(self, cluster_id: str) -> Optional[Dict]:
        """Get a single cluster with all its data."""
        try:
            result = self.client.table("clusters").select("*").eq("id", cluster_id).single().execute()
            return result.data
        except Exception as e:
            logger.error(f"Error fetching cluster: {e}")
            return None

    # --- Pipeline Runs ---

    async def create_pipeline_run(self) -> Optional[str]:
        """Create a new pipeline run record."""
        try:
            result = self.client.table("pipeline_runs").insert({
                "status": "running"
            }).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            logger.error(f"Error creating pipeline run: {e}")
        return None

    async def complete_pipeline_run(self, run_id: str, stats: Dict[str, Any]):
        """Mark a pipeline run as completed with stats."""
        try:
            self.client.table("pipeline_runs").update({
                "status": "completed",
                "completed_at": "now()",
                "articles_fetched": stats.get("articles_fetched", 0),
                "clusters_created": stats.get("clusters_created", 0),
                "clusters_updated": stats.get("clusters_updated", 0),
                "errors": stats.get("errors"),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.error(f"Error completing pipeline run: {e}")


# Singleton instance
supabase_service = SupabaseService()
