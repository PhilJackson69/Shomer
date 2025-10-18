"""Digital incident model for Reddit content analysis."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base

class DigitalIncidentSeverity(str, Enum):
    """Digital incident severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class DigitalIncident(Base):
    """Digital incident model for storing analyzed Reddit content."""

    __tablename__ = "digital_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    text = Column(Text, nullable=False)
    score = Column(Float, nullable=False)
    severity = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, default="reddit")
    subreddit = Column(String, nullable=True)
    author = Column(String, nullable=True)
    url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


