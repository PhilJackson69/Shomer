"""Incident schemas."""
from datetime import datetime

from pydantic import BaseModel


class IncidentBase(BaseModel):
    """Base incident schema."""

    title: str
    description: str
    severity: str = "medium"
    status: str = "open"
    location: str | None = None
    source: str | None = None


class IncidentCreate(IncidentBase):
    """Incident creation schema."""

    expires_at: datetime | None = None


class IncidentUpdate(BaseModel):
    """Incident update schema."""

    title: str | None = None
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    location: str | None = None
    source: str | None = None
    expires_at: datetime | None = None


class Incident(IncidentBase):
    """Incident schema."""

    id: int
    created_at: datetime
    updated_at: datetime | None
    resolved_at: datetime | None
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class IncidentList(BaseModel):
    """Incident list response schema."""

    incidents: list[Incident]
    total: int
    page: int
    page_size: int
    total_pages: int

