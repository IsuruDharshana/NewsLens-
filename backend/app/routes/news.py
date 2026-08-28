from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.models.schemas import PaginatedResponse, ClusterResponse, ClusterListItem, QueryRequest, QueryResponse, SourceInfo
from app.services.supabase_service import supabase_service

router = APIRouter()


def _cluster_to_list_item(cluster: dict) -> dict:
    """Convert a cluster DB row to a ClusterListItem response."""
    return {
        "id": cluster["id"],
        "summary": cluster.get("summary"),
        "source_count": cluster.get("source_count", 0),
        "category": cluster.get("category", "Politics"),
        "is_breaking": cluster.get("is_breaking", False),
        "confidence_score": cluster.get("confidence_score", 0.0),
        "trend_score": cluster.get("trend_score", 0.0),
        "top_sources": [],  # populated separately if needed
        "published_at": cluster.get("published_at"),
    }


@router.get("", response_model=PaginatedResponse)
async def get_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
):
    """Get paginated news feed, optionally filtered by category."""
    clusters, total = await supabase_service.get_clusters(
        page=page, limit=limit, category=category
    )
    return {
        "data": [_cluster_to_list_item(c) for c in clusters],
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
    return {
        "data": [_cluster_to_list_item(c) for c in clusters],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/breaking", response_model=PaginatedResponse)
async def get_breaking_news():
    """Get current breaking news."""
    clusters, total = await supabase_service.get_clusters(
        page=1, limit=10, is_breaking=True
    )
    return {
        "data": [_cluster_to_list_item(c) for c in clusters],
        "pagination": {"page": 1, "limit": 10, "total": total},
    }


@router.get("/{cluster_id}", response_model=ClusterResponse)
async def get_news_detail(cluster_id: str):
    """Get full story detail with sources and bias analysis."""
    cluster = await supabase_service.get_cluster_by_id(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Story not found")

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
