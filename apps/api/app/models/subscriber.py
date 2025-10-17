"""Subscriber model."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.base import Base


class Subscriber(Base):
    """Subscriber model for SMS/email alerts."""

    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=True, index=True)
    phone = Column(String, nullable=True, index=True)
    name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    subscribed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    unsubscribed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

