"""Tip model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base


class Tip(Base):
    """Tip model for community submissions."""

    __tablename__ = "tips"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    submitter_email = Column(String, nullable=True)
    submitter_phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="new", nullable=False, index=True)  # new, escalated, under_investigation, resolved
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    
    # Additional fields for retention and media processing
    contact_info = Column(Text, nullable=True)  # Consolidated contact information
    metadata = Column(JSONB, nullable=True)  # File hashes, EXIF metadata, purge info
    
    # Relationships
    evidence = relationship("Evidence", back_populates="tip", lazy="dynamic")

