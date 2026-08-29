import logging

from fastapi import APIRouter, Depends, HTTPException

from app.routes.auth import get_current_user
from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    """Get current user's preferences."""
    prefs = supabase_service.get_user_preferences(user["id"])
    if not prefs:
        # Return defaults if no preferences exist yet
        return {
            "user_id": user["id"],
            "categories": [],
            "language": "en",
            "notification_enabled": True,
            "sports_interests": [],
        }
    return prefs


@router.put("/preferences")
async def update_preferences(
    request: dict,
    user: dict = Depends(get_current_user),
):
    """Update user's preferences."""
    prefs = supabase_service.upsert_user_preferences(
        user_id=user["id"],
        categories=request.get("categories", []),
        language=request.get("language", "en"),
        notification_enabled=request.get("notification_enabled", True),
        sports_interests=request.get("sports_interests", []),
    )
    return prefs
