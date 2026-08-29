"""Engagement routes — likes and comments on story clusters."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.routes.auth import get_current_user
from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/engage", tags=["Engagement"])


# ---------- Request/Response Models ---------- #


class LikeResponse(BaseModel):
    liked: bool
    like_count: int


class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: str
    text: str
    created_at: str
    user_id: str
    user_name: str


# ---------- Routes ---------- #


@router.post("/like/{cluster_id}", response_model=LikeResponse)
async def toggle_like(cluster_id: str, user: dict = Depends(get_current_user)):
    """Toggle like on a story cluster. Returns new liked state + count."""
    try:
        liked = supabase_service.toggle_like(user["id"], cluster_id)
        count = supabase_service.get_like_count(cluster_id)
        return LikeResponse(liked=liked, like_count=count)
    except Exception as e:
        logger.error(f"Toggle like error: {e}")
        raise HTTPException(status_code=500, detail="Could not update like")


@router.get("/like/{cluster_id}", response_model=LikeResponse)
async def get_like_status(
    cluster_id: str, user: dict = Depends(get_current_user)
):
    """Get whether the current user has liked this cluster + total count."""
    liked = supabase_service.user_has_liked(user["id"], cluster_id)
    count = supabase_service.get_like_count(cluster_id)
    return LikeResponse(liked=liked, like_count=count)


@router.get("/comments/{cluster_id}", response_model=list[CommentOut])
async def get_comments(cluster_id: str):
    """Get all comments for a story cluster (public)."""
    comments = supabase_service.get_comments(cluster_id)
    return [CommentOut(**c) for c in comments]


@router.post(
    "/comments/{cluster_id}",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    cluster_id: str,
    body: CommentIn,
    user: dict = Depends(get_current_user),
):
    """Add a comment to a story cluster."""
    try:
        comment = supabase_service.add_comment(
            user["id"], cluster_id, body.text
        )
        return CommentOut(**comment)
    except Exception as e:
        logger.error(f"Add comment error: {e}")
        raise HTTPException(status_code=500, detail="Could not add comment")


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str, user: dict = Depends(get_current_user)
):
    """Delete your own comment."""
    success = supabase_service.delete_comment(user["id"], comment_id)
    if not success:
        raise HTTPException(
            status_code=404, detail="Comment not found or not owned by you"
        )
