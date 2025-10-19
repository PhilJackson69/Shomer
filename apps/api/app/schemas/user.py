"""User schemas."""
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    username: str
    full_name: str | None = None


class UserCreate(UserBase):
    """User creation schema."""

    password: str


class UserLogin(BaseModel):
    """User login schema."""

    username: str
    password: str


class User(UserBase):
    """User schema."""

    id: int
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    """User response with token."""

    user: User
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

