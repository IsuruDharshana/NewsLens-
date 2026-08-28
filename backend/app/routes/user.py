from fastapi import APIRouter

from app.models.schemas import UserPreferencesUpdate, UserPreferencesResponse

router = APIRouter()


@router.put("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(request: UserPreferencesUpdate):
    """Update user's category interests and notification settings."""
    # TODO: Connect to Supabase service
    return {
        "user_id": "not_implemented",
        "categories": request.categories,
        "notification_enabled": request.notification_enabled,
    }
