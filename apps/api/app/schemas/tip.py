"""Tip schemas."""
from datetime import datetime

from pydantic import BaseModel


class TipBase(BaseModel):
    """Base tip schema."""

    content: str
    submitter_email: str | None = None
    submitter_phone: str | None = None
    location: str | None = None


class TipCreate(TipBase):
    """Tip creation schema."""

    expires_at: datetime | None = None


class Tip(TipBase):
    """Tip schema."""

    id: int
    image_url: str | None
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}

