"""Admin dashboard API — provides all monitoring data in one call."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.services.supabase_service import supabase_service
from app.services.pipeline_service import pipeline
from app.services.gemini_service import gemini_service
from app.models.sources import FEED_SOURCES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def get_dashboard():
    """Get all admin dashboard data: pipeline, stats, sources, users, engagement."""

    # 1. Pipeline status
    pipeline_status = pipeline.get_status()
    last_run = pipeline_status.get("last_run_stats", {})

    # 2. Article / cluster counts
    article_count = _safe_count("articles")
    cluster_count = _safe_count("clusters")
    unclustered = _safe_count("articles", filter_null_cluster=True)

    # 3. User stats
    user_count = _safe_count("user_profiles")
    pref_count = _safe_count("user_preferences")

    # 4. Source health — per-source article counts
    source_health = _get_source_health()

    # 5. Recent pipeline runs (last 5)
    recent_runs = _get_recent_runs()

    # 6. Per-source fetch stats
    per_source_stats = _get_per_source_stats()

    # 7. Engagement stats
    engagement = _get_engagement_stats()

    # 8. Gemini API usage
    gemini_calls = gemini_service.get_call_count()

    # 9. Error log (from pipeline runs)
    error_log = _get_error_log()

    # 10. Category breakdown
    category_breakdown = _get_category_breakdown()

    return {
        "pipeline": {
            "is_running": pipeline_status.get("is_running", False),
            "last_run_at": pipeline_status.get("last_run_at"),
            "last_run": last_run,
        },
        "counts": {
            "articles": article_count,
            "clusters": cluster_count,
            "unclustered_articles": unclustered,
            "users": user_count,
            "users_with_preferences": pref_count,
        },
        "source_health": source_health,
        "recent_runs": recent_runs,
        "per_source_stats": per_source_stats,
        "engagement": engagement,
        "gemini": {
            "total_calls": gemini_calls,
        },
        "errors": error_log,
        "category_breakdown": category_breakdown,
        "configured_feeds": [
            {"name": f["name"], "url": f["url"], "priority": f["priority"]}
            for f in FEED_SOURCES
        ],
    }


def _safe_count(table: str, filter_null_cluster: bool = False) -> int:
    """Get row count for a table, returns 0 on error."""
    try:
        query = supabase_service.client.table(table).select("id", count="exact")
        if filter_null_cluster:
            query = query.is_("cluster_id", "null")
        result = query.execute()
        return result.count or 0
    except Exception as e:
        logger.debug(f"Count query failed for {table}: {e}")
        return 0


def _get_source_health() -> list[dict]:
    """Check each configured feed source and return health info."""
    sources = []
    for feed in FEED_SOURCES:
        try:
            result = supabase_service.client.table("articles").select(
                "id", count="exact"
            ).eq("source_name", feed["name"]).execute()
            count = result.count or 0

            # Get most recent article date
            latest = supabase_service.client.table("articles").select(
                "published_at"
            ).eq("source_name", feed["name"]).order(
                "published_at", desc=True
            ).limit(1).execute()
            latest_date = latest.data[0]["published_at"] if latest.data else None

            sources.append({
                "name": feed["name"],
                "priority": feed["priority"],
                "article_count": count,
                "latest_article": latest_date,
                "status": "healthy" if count > 0 else "no_articles",
            })
        except Exception as e:
            sources.append({
                "name": feed["name"],
                "priority": feed["priority"],
                "article_count": 0,
                "latest_article": None,
                "status": "error",
                "error": str(e),
            })
    return sources


def _get_recent_runs() -> list[dict]:
    """Get the last 5 pipeline runs."""
    try:
        result = supabase_service.client.table("pipeline_runs").select(
            "id, started_at, completed_at, articles_fetched, clusters_created, clusters_updated, errors, status"
        ).order("started_at", desc=True).limit(5).execute()
        return result.data or []
    except Exception as e:
        logger.debug(f"Failed to fetch recent runs: {e}")
        return []


def _get_per_source_stats() -> list[dict]:
    """Get article counts per source name."""
    try:
        result = supabase_service.client.table("articles").select(
            "source_name"
        ).execute()
        counts: dict[str, int] = {}
        for row in (result.data or []):
            name = row.get("source_name", "Unknown")
            counts[name] = counts.get(name, 0) + 1
        return [
            {"source": name, "count": count}
            for name, count in sorted(counts.items(), key=lambda x: -x[1])
        ]
    except Exception as e:
        logger.debug(f"Failed to fetch per-source stats: {e}")
        return []


def _get_engagement_stats() -> dict:
    """Get engagement metrics: total likes, comments, top stories."""
    stats = {"total_likes": 0, "total_comments": 0, "top_stories": []}

    # Total likes
    try:
        result = supabase_service.client.table("likes").select(
            "cluster_id", count="exact"
        ).execute()
        stats["total_likes"] = result.count or 0
    except Exception:
        pass

    # Total comments
    try:
        result = supabase_service.client.table("comments").select(
            "id", count="exact"
        ).execute()
        stats["total_comments"] = result.count or 0
    except Exception:
        pass

    # Top liked stories
    try:
        like_rows = supabase_service.client.table("likes").select("cluster_id").execute()
        like_counts: dict[str, int] = {}
        for row in (like_rows.data or []):
            cid = row["cluster_id"]
            like_counts[cid] = like_counts.get(cid, 0) + 1

        top_ids = sorted(like_counts, key=like_counts.get, reverse=True)[:5]
        if top_ids:
            clusters = supabase_service.client.table("clusters").select(
                "id, title, summary, category"
            ).in_("id", top_ids).execute()
            stats["top_stories"] = [
                {
                    "id": c["id"],
                    "title": c.get("title") or c.get("summary", "")[:80],
                    "category": c.get("category", ""),
                    "likes": like_counts.get(c["id"], 0),
                }
                for c in (clusters.data or [])
            ]
    except Exception:
        pass

    return stats


def _get_error_log() -> list[dict]:
    """Get errors from recent pipeline runs."""
    try:
        result = supabase_service.client.table("pipeline_runs").select(
            "id, started_at, errors, status"
        ).not_("errors", "is", "null").order(
            "started_at", desc=True
        ).limit(10).execute()
        errors = []
        for run in (result.data or []):
            run_errors = run.get("errors")
            if run_errors:
                if isinstance(run_errors, list):
                    for err in run_errors:
                        errors.append({
                            "run_id": run["id"],
                            "started_at": run["started_at"],
                            "error": str(err),
                        })
                else:
                    errors.append({
                        "run_id": run["id"],
                        "started_at": run["started_at"],
                        "error": str(run_errors),
                    })
        return errors
    except Exception as e:
        logger.debug(f"Failed to fetch error log: {e}")
        return []


def _get_category_breakdown() -> list[dict]:
    """Get cluster counts per category."""
    try:
        result = supabase_service.client.table("clusters").select("category").execute()
        counts: dict[str, int] = {}
        for row in (result.data or []):
            cat = row.get("category", "Unknown")
            counts[cat] = counts.get(cat, 0) + 1
        return [
            {"category": cat, "count": count}
            for cat, count in sorted(counts.items(), key=lambda x: -x[1])
        ]
    except Exception:
        return []
