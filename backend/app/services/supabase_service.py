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

    # --- Auth ---

    def register_user(self, email: str, password: str, name: str) -> dict:
        """Register a new user via Supabase Auth. Returns tokens + user info."""
        response = self.client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"name": name}},
        })
        user = response.user
        session = response.session

        # Create user profile row
        try:
            self.client.table("user_profiles").insert({
                "id": user.id,
                "name": name,
                "email": email,
            }).execute()
        except Exception as e:
            logger.warning(f"Profile insert (may already exist): {e}")

        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user_id": user.id,
            "name": name,
        }

    def login_user(self, email: str, password: str) -> dict:
        """Login a user via Supabase Auth. Returns tokens + user info."""
        response = self.client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
        user = response.user
        session = response.session

        # Fetch name from profile
        name = None
        try:
            profile = self.client.table("user_profiles").select("name").eq("id", user.id).single().execute()
            if profile.data:
                name = profile.data.get("name")
        except Exception:
            pass

        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user_id": user.id,
            "name": name,
        }

    def get_user_from_token(self, token: str) -> dict | None:
        """Validate a JWT token and return user info."""
        try:
            response = self.client.auth.get_user(token)
            user = response.user
            if not user:
                return None

            name = None
            try:
                profile = self.client.table("user_profiles").select("name").eq("id", user.id).single().execute()
                if profile.data:
                    name = profile.data.get("name")
            except Exception:
                pass

            return {
                "id": user.id,
                "email": user.email,
                "name": name,
            }
        except Exception as e:
            logger.debug(f"Token validation failed: {e}")
            return None

    # --- User Preferences ---

    def get_user_preferences(self, user_id: str) -> dict | None:
        """Get a user's preferences."""
        try:
            result = self.client.table("user_preferences").select("*").eq("user_id", user_id).single().execute()
            return result.data
        except Exception:
            return None

    def upsert_user_preferences(
        self,
        user_id: str,
        categories: list[str],
        language: str = "en",
        notification_enabled: bool = True,
        sports_interests: list[str] = None,
    ) -> dict:
        """Create or update user preferences."""
        data = {
            "user_id": user_id,
            "categories": categories,
            "language": language,
            "sports_interests": sports_interests or [],
            "notification_enabled": notification_enabled,
        }
        try:
            # Try upsert
            result = self.client.table("user_preferences").upsert(data).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            logger.error(f"Error upserting preferences: {e}")
        return data

    # --- Pipeline Runs ---

    # --- Likes ---

    def toggle_like(self, user_id: str, cluster_id: str) -> bool:
        """Toggle like. Returns True if liked, False if unliked."""
        try:
            # Check if already liked
            existing = self.client.table("likes").select("user_id").eq(
                "user_id", user_id
            ).eq("cluster_id", cluster_id).execute()

            if existing.data:
                # Unlike
                self.client.table("likes").delete().eq(
                    "user_id", user_id
                ).eq("cluster_id", cluster_id).execute()
                return False
            else:
                # Like
                self.client.table("likes").insert({
                    "user_id": user_id,
                    "cluster_id": cluster_id,
                }).execute()
                return True
        except Exception as e:
            logger.error(f"Error toggling like: {e}")
            raise

    def get_like_count(self, cluster_id: str) -> int:
        """Get total likes for a cluster."""
        try:
            result = self.client.table("likes").select(
                "user_id", count="exact"
            ).eq("cluster_id", cluster_id).execute()
            return result.count or 0
        except Exception:
            return 0

    def user_has_liked(self, user_id: str, cluster_id: str) -> bool:
        """Check if a user has liked a cluster."""
        try:
            result = self.client.table("likes").select("user_id").eq(
                "user_id", user_id
            ).eq("cluster_id", cluster_id).execute()
            return bool(result.data)
        except Exception:
            return False

    # --- Comments ---

    def get_comments(self, cluster_id: str, limit: int = 50) -> list[dict]:
        """Get comments for a cluster with user info."""
        try:
            result = self.client.table("comments").select(
                "id, text, created_at, user_id, user_profiles(name)"
            ).eq("cluster_id", cluster_id).order(
                "created_at", desc=False
            ).limit(limit).execute()
            comments = []
            for c in (result.data or []):
                profile = c.get("user_profiles", {})
                comments.append({
                    "id": c["id"],
                    "text": c["text"],
                    "created_at": c["created_at"],
                    "user_id": c["user_id"],
                    "user_name": profile.get("name", "Anonymous") if profile else "Anonymous",
                })
            return comments
        except Exception as e:
            logger.error(f"Error fetching comments: {e}")
            return []

    def add_comment(self, user_id: str, cluster_id: str, text: str) -> dict:
        """Add a comment to a cluster."""
        try:
            result = self.client.table("comments").insert({
                "user_id": user_id,
                "cluster_id": cluster_id,
                "text": text,
            }).execute()
            if result.data:
                row = result.data[0]
                return {
                    "id": row["id"],
                    "text": row["text"],
                    "created_at": row["created_at"],
                    "user_id": row["user_id"],
                    "user_name": "You",
                }
            return {}
        except Exception as e:
            logger.error(f"Error adding comment: {e}")
            raise

    def delete_comment(self, user_id: str, comment_id: str) -> bool:
        """Delete a comment (only if owned by user)."""
        try:
            self.client.table("comments").delete().eq(
                "id", comment_id
            ).eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting comment: {e}")
            return False

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
            from datetime import datetime, timezone
            self.client.table("pipeline_runs").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "articles_fetched": stats.get("articles_fetched", 0),
                "clusters_created": stats.get("clusters_created", 0),
                "clusters_updated": stats.get("clusters_updated", 0),
                "errors": stats.get("errors"),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.error(f"Error completing pipeline run: {e}")


# Lazy singleton — created on first access, not at import time
_supabase_service_instance: SupabaseService | None = None


def get_supabase_service() -> SupabaseService:
    """Get or create the SupabaseService singleton."""
    global _supabase_service_instance
    if _supabase_service_instance is None:
        _supabase_service_instance = SupabaseService()
    return _supabase_service_instance


# Backward-compatible alias for existing imports
supabase_service = None  # type: ignore


class _SupabaseProxy:
    """Proxy that lazily initializes SupabaseService on first attribute access."""

    def __getattr__(self, name):
        return getattr(get_supabase_service(), name)


supabase_service = _SupabaseProxy()  # type: ignore
