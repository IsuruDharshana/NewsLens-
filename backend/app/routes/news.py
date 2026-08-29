import logging

from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional

from app.models.schemas import PaginatedResponse, ClusterResponse, ClusterListItem, QueryRequest, QueryResponse, SourceInfo
from app.services.supabase_service import supabase_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _cluster_to_list_item(cluster: dict, engagement: dict | None = None) -> dict:
    """Convert a cluster DB row to a ClusterListItem response."""
    eng = engagement or {}
    return {
        "id": cluster["id"],
        "title": cluster.get("title"),
        "summary": cluster.get("summary"),
        "source_count": cluster.get("source_count", 0),
        "category": cluster.get("category", "Politics"),
        "is_breaking": cluster.get("is_breaking", False),
        "confidence_score": cluster.get("confidence_score", 0.0),
        "trend_score": cluster.get("trend_score", 0.0),
        "top_sources": [],  # populated separately if needed
        "like_count": eng.get("like_count", 0),
        "comment_count": eng.get("comment_count", 0),
        "published_at": cluster.get("published_at"),
    }


async def _maybe_translate_summaries(clusters: list[dict], lang: str | None) -> list[dict]:
    """If lang=si, translate all cluster summaries to Sinhala in one batched call."""
    if lang != "si" or not clusters:
        return clusters

    summaries = [c.get("summary", "") or "" for c in clusters]
    if not any(s.strip() for s in summaries):
        return clusters

    try:
        translated = await gemini_service.translate_to_sinhala_batch(summaries)
        for i, t in enumerate(translated):
            if t:
                clusters[i]["summary"] = t
    except Exception as e:
        logger.warning(f"Sinhala translation failed, falling back to English: {e}")

    return clusters


@router.get("", response_model=PaginatedResponse)
async def get_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    lang: Optional[str] = None,
):
    """Get paginated news feed, optionally filtered by category. Pass lang=si for Sinhala summaries."""
    clusters, total = await supabase_service.get_clusters(
        page=page, limit=limit, category=category
    )
    clusters = await _maybe_translate_summaries(clusters, lang)
    # Fetch engagement counts for all clusters in one batch
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    return {
        "data": [_cluster_to_list_item(c, engagement.get(c["id"])) for c in clusters],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/trending", response_model=PaginatedResponse)
async def get_trending_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get stories sorted by trend score."""
    clusters, total = await supabase_service.get_clusters(
        page=page, limit=limit, order_by="trend_score"
    )
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    return {
        "data": [_cluster_to_list_item(c, engagement.get(c["id"])) for c in clusters],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/breaking", response_model=PaginatedResponse)
async def get_breaking_news(lang: Optional[str] = None):
    """Get current breaking news. Pass lang=si for Sinhala summaries."""
    clusters, total = await supabase_service.get_clusters(
        page=1, limit=10, is_breaking=True
    )
    clusters = await _maybe_translate_summaries(clusters, lang)
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    return {
        "data": [_cluster_to_list_item(c, engagement.get(c["id"])) for c in clusters],
        "pagination": {"page": 1, "limit": 10, "total": total},
    }


@router.get("/{cluster_id}", response_model=ClusterResponse)
async def get_news_detail(cluster_id: str, lang: Optional[str] = None):
    """Get full story detail with sources and bias analysis. Pass lang=si for Sinhala summary."""
    cluster = await supabase_service.get_cluster_by_id(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Story not found")

    # Translate summary if needed
    if lang == "si" and cluster.get("summary"):
        try:
            translated = await gemini_service.translate_to_sinhala_batch([cluster["summary"]])
            if translated and translated[0]:
                cluster["summary"] = translated[0]
        except Exception as e:
            logger.warning(f"Sinhala translation failed: {e}")

    # Fetch all articles in this cluster for source info
    articles = await supabase_service.get_articles_by_cluster(cluster_id)
    sources = [
        SourceInfo(
            name=a["source_name"],
            url=a["source_url"],
            bias_label=a.get("bias_label"),
        ).model_dump()
        for a in articles
    ]

    return {
        "id": cluster["id"],
        "title": cluster.get("title"),
        "summary": cluster.get("summary"),
        "source_count": cluster.get("source_count", 0),
        "category": cluster.get("category", "Politics"),
        "is_breaking": cluster.get("is_breaking", False),
        "confidence_score": cluster.get("confidence_score", 0.0),
        "trend_score": cluster.get("trend_score", 0.0),
        "official_source_data": cluster.get("official_source_data"),
        "bias_analysis": cluster.get("bias_analysis"),
        "sources": sources,
        "published_at": cluster.get("published_at"),
        "created_at": cluster.get("created_at"),
    }


@router.get("/personalized", response_model=PaginatedResponse)
async def get_personalized_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get news feed filtered by user's category preferences."""
    # TODO: Read user preferences from Supabase and filter
    # For now, return all news
    clusters, total = await supabase_service.get_clusters(page=page, limit=limit)
    return {
        "data": [_cluster_to_list_item(c) for c in clusters],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.post("/query", response_model=QueryResponse)
async def query_news(request: QueryRequest):
    """RAG: Ask a natural language question about the news."""
    # TODO: Connect to ChromaDB + Gemini service (Prompt 9)
    return {
        "question": request.question,
        "answer": "RAG query will be implemented in a future update.",
        "sources": [],
        "official_data": None,
    }
