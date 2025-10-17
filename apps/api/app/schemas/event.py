"""Event schemas."""
from datetime import datetime

from pydantic import BaseModel


class EventBase(BaseModel):
    """Base event schema."""

    title: str
    description: str | None = None
    location: str | None = None
    time: datetime | None = None


class EventCreate(EventBase):
    """Event creation schema."""

    pass


class EventScore(BaseModel):
    """Event score response schema."""

    score: float
    recommendations: list[str]


class Event(EventBase):
    """Event schema."""

    id: int
    event_time: datetime | None
    risk_score: float | None
    recommendations: list[str] | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}

