from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.models.schemas import PaginatedResponse, ClusterResponse, QueryRequest, QueryResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def get_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
):
    """Get paginated news feed, optionally filtered by category."""
    # TODO: Connect to Supabase service
    return {
        "data": [],
        "pagination": {"page": page, "limit": limit, "total": 0},
    }


@router.get("/{cluster_id}", response_model=ClusterResponse)
async def get_news_detail(cluster_id: str):
    """Get full story detail with sources and bias analysis."""
    # TODO: Connect to Supabase service
    raise HTTPException(status_code=404, detail="Not implemented yet")


@router.get("/personalized", response_model=PaginatedResponse)
async def get_personalized_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get news feed filtered by user's category preferences."""
    # TODO: Connect to Supabase + user preferences
    return {
        "data": [],
        "pagination": {"page": page, "limit": limit, "total": 0},
    }


@router.get("/trending", response_model=PaginatedResponse)
async def get_trending_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get stories sorted by trend score."""
    # TODO: Connect to Supabase service
    return {
        "data": [],
        "pagination": {"page": page, "limit": limit, "total": 0},
    }


@router.get("/breaking", response_model=PaginatedResponse)
async def get_breaking_news():
    """Get current breaking news."""
    # TODO: Connect to Supabase service
    return {
        "data": [],
        "pagination": {"page": 1, "limit": 10, "total": 0},
    }


@router.post("/query", response_model=QueryResponse)
async def query_news(request: QueryRequest):
    """RAG: Ask a natural language question about the news."""
    # TODO: Connect to ChromaDB + Gemini service
    return {
        "question": request.question,
        "answer": "RAG query not implemented yet. This will be built in Prompt 9.",
        "sources": [],
        "official_data": None,
    }
