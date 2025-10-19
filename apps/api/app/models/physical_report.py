"""Physical report model for community incident reporting."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base

class PhysicalReportSeverity(str, Enum):
    """Physical report severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class PhysicalReportStatus(str, Enum):
    """Physical report status."""
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"

class PhysicalReport(Base):
    """Physical report model for community incident reporting."""

    __tablename__ = "physical_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    severity = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default=PhysicalReportStatus.OPEN.value, index=True)
    reporter_email = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


