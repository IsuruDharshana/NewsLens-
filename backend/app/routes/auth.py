from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

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
    user_id: str
    message: str


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new user."""
    # TODO: Connect to Supabase Auth
    return {
        "access_token": "not_implemented",
        "user_id": "not_implemented",
        "message": "Auth not implemented yet. Will be built in Prompt 12.",
    }


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login an existing user."""
    # TODO: Connect to Supabase Auth
    return {
        "access_token": "not_implemented",
        "user_id": "not_implemented",
        "message": "Auth not implemented yet. Will be built in Prompt 12.",
    }
