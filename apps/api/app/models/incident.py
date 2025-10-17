"""Incident model."""
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class IncidentSeverity(str, Enum):
    """Incident severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, Enum):
    """Incident status."""

    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Incident(Base):
    """Incident model."""

    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)
    severity = Column(String, default=IncidentSeverity.MEDIUM.value, nullable=False, index=True)
    status = Column(String, default=IncidentStatus.OPEN.value, nullable=False, index=True)
    location = Column(String, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    
    # Relationships
    evidence = relationship("Evidence", back_populates="incident", lazy="dynamic")

