"""Token schemas."""
from pydantic import BaseModel


class Token(BaseModel):
    """Token schema."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Token refresh request schema."""
    
    refresh_token: str


class TokenPayload(BaseModel):
    """Token payload schema."""

    sub: str | None = None

