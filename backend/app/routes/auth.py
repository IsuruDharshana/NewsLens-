import logging

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    email: str
    name: Optional[str] = None
    message: str


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract and validate user from Authorization header. Returns user info dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    try:
        user = supabase_service.get_user_from_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new user via Supabase Auth."""
    try:
        result = supabase_service.register_user(
            email=request.email,
            password=request.password,
            name=request.name,
        )
        return {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user_id": result["user_id"],
            "email": request.email,
            "name": request.name,
            "message": "Registration successful. Please check your email to confirm your account.",
        }
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower() or "already_exists" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=f"Registration failed: {error_msg}")


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login an existing user via Supabase Auth."""
    try:
        result = supabase_service.login_user(
            email=request.email,
            password=request.password,
        )
        return {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "user_id": result["user_id"],
            "email": request.email,
            "name": result.get("name"),
            "message": "Login successful",
        }
    except Exception as e:
        error_msg = str(e)
        if "invalid" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Invalid email or password")
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Login failed")


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    return {
        "user_id": user["id"],
        "email": user.get("email"),
        "name": user.get("name"),
    }
