"""Subscriber schemas."""
from datetime import datetime

from pydantic import BaseModel, EmailStr


class SubscriberBase(BaseModel):
    """Base subscriber schema."""

    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = None


class SubscriberCreate(SubscriberBase):
    """Subscriber creation schema."""

    pass


class SubscriberUpdate(BaseModel):
    """Subscriber update schema."""

    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = None
    is_active: bool | None = None


class Subscriber(SubscriberBase):
    """Subscriber schema."""

    id: int
    is_active: bool
    subscribed_at: datetime
    unsubscribed_at: datetime | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}

