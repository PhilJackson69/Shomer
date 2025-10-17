"""Alert model."""
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class AlertType(str, Enum):
    """Alert types."""

    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"
    BOTH = "both"


class AlertStatus(str, Enum):
    """Alert status."""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class AlertCategory(str, Enum):
    """Alert category for classification."""

    SECURITY = "SECURITY"
    COMMUNITY = "COMMUNITY"
    ICE_ALERT = "ICE_ALERT"
    OTHER = "OTHER"


class ICESeverity(str, Enum):
    """ICE alert severity levels."""

    RUMOR = "rumor"
    VERIFIED = "verified"
    ACTIVE = "active"


class Alert(Base):
    """Alert model for tracking sent notifications."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    
    # Channel and recipient info
    channel = Column(String, nullable=False, index=True)  # sms, email, push
    recipient = Column(String, nullable=False)  # phone, email, device token
    
    # Message content
    subject = Column(String, nullable=True)  # Email subject or push title
    message = Column(Text, nullable=False)  # Message body
    
    # Status tracking
    status = Column(String, default=AlertStatus.PENDING.value, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)
    
    # Metadata
    metadata = Column(JSONB, nullable=True)  # Additional data (severity, provider response, etc.)
    
    # Category classification
    category = Column(String, default=AlertCategory.OTHER.value, nullable=False, index=True)
    
    # Legacy fields for backward compatibility
    title = Column(String, nullable=True)
    alert_type = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    recipients_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

