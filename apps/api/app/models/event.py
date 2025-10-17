"""Event model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Text

from app.db.base import Base


class Event(Base):
    """Event model for risk scoring."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    event_time = Column(DateTime, nullable=True, index=True)
    risk_score = Column(Float, nullable=True, index=True)
    recommendations = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

