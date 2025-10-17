"""ICE Alert model for community safety notifications."""
from datetime import datetime, timedelta
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.alert import ICESeverity


class ICEAlert(Base):
    """
    ICE Alert model for tracking immigration enforcement activity.
    
    This model stores community-submitted reports of ICE activity with
    human moderation and verification workflows.
    """

    __tablename__ = "ice_alerts"

    id = Column(Integer, primary_key=True, index=True)
    
    # Location information
    location = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    
    # Alert content
    description = Column(Text, nullable=False)
    severity = Column(String, nullable=False, default=ICESeverity.RUMOR.value, index=True)
    source = Column(String, nullable=False)  # e.g., "community member", "verified partner"
    
    # Verification and moderation
    verified = Column(Boolean, default=False, nullable=False, index=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    confidence_score = Column(Float, nullable=True)  # 0.0 to 1.0
    
    # Moderation
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    approved = Column(Boolean, default=False, nullable=False, index=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Lifecycle management
    expires_at = Column(DateTime, nullable=False, index=True)  # Auto-expire after 48h
    archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_at = Column(DateTime, nullable=True)
    
    # Broadcast tracking
    broadcast_sent = Column(Boolean, default=False, nullable=False)
    broadcast_at = Column(DateTime, nullable=True)
    broadcast_count = Column(Integer, default=0)  # Number of recipients
    
    # Metadata
    metadata = Column(JSONB, nullable=True)  # Additional structured data
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by], backref="ice_alerts_created")
    verifier = relationship("User", foreign_keys=[verified_by], backref="ice_alerts_verified")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="ice_alerts_reviewed")
    
    def __init__(self, **kwargs):
        """Initialize ICE alert with auto-expiration."""
        super().__init__(**kwargs)
        if not self.expires_at:
            # Default 48 hour expiration
            self.expires_at = datetime.utcnow() + timedelta(hours=48)
    
    @property
    def is_expired(self) -> bool:
        """Check if alert has expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_active(self) -> bool:
        """Check if alert is active (approved, not expired, not archived)."""
        return self.approved and not self.is_expired and not self.archived
    
    def __repr__(self):
        return f"<ICEAlert(id={self.id}, location='{self.location}', severity='{self.severity}', verified={self.verified})>"

