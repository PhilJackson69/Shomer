"""
Evidence submission model with chain-of-custody tracking.

This module implements secure evidence handling with cryptographic hashing,
immutable audit trails, and chain-of-custody documentation.
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class EvidenceStatus(str, Enum):
    """Status of evidence in the system."""
    PENDING = "pending"  # Newly submitted, awaiting review
    VERIFIED = "verified"  # Hash verified, metadata confirmed
    SEALED = "sealed"  # Locked for legal proceedings
    ARCHIVED = "archived"  # Long-term storage
    DESTROYED = "destroyed"  # Securely deleted per retention policy


class EvidenceType(str, Enum):
    """Type of evidence submitted."""
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    OTHER = "other"


class ChainOfCustodyAction(str, Enum):
    """Actions in chain of custody."""
    SUBMITTED = "submitted"  # Initial submission
    RECEIVED = "received"  # Acknowledged by system
    VERIFIED = "verified"  # Hash/integrity verified
    ACCESSED = "accessed"  # Viewed/downloaded
    TRANSFERRED = "transferred"  # Transferred to authority
    SEALED = "sealed"  # Locked for legal proceedings
    EXPORTED = "exported"  # Chain-of-custody PDF generated
    ARCHIVED = "archived"  # Moved to long-term storage
    DESTROYED = "destroyed"  # Securely deleted


class Evidence(Base):
    """
    Evidence submission with cryptographic integrity.
    
    Each piece of evidence is:
    - Hashed on submission (SHA-256)
    - Timestamped (submission and server receipt)
    - Linked to incident/tip
    - Tracked through chain-of-custody
    - Exportable with full audit trail
    """
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference number for tracking
    reference_number = Column(String(50), unique=True, index=True, nullable=False)
    
    # Type and status
    evidence_type = Column(String(20), nullable=False)  # EvidenceType enum
    status = Column(String(20), default=EvidenceStatus.PENDING, nullable=False)
    
    # File information
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Encrypted storage path
    file_size = Column(Integer, nullable=False)  # Bytes
    mime_type = Column(String(100), nullable=False)
    
    # Cryptographic integrity
    sha256_hash = Column(String(64), nullable=False, index=True)  # File hash
    md5_hash = Column(String(32), nullable=True)  # Additional verification
    
    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)  # ["weapon", "vehicle", etc.]
    location = Column(String(500), nullable=True)
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False)  # Submitter's timestamp
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # Server timestamp
    verified_at = Column(DateTime, nullable=True)  # When hash was verified
    sealed_at = Column(DateTime, nullable=True)  # When sealed for legal
    
    # Relationships
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    tip_id = Column(Integer, ForeignKey("tips.id"), nullable=True, index=True)
    submitted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Chain of custody
    custody_chain = relationship(
        "ChainOfCustody",
        back_populates="evidence",
        cascade="all, delete-orphan",
        order_by="ChainOfCustody.timestamp"
    )
    
    # Relationships
    incident = relationship("Incident", back_populates="evidence")
    tip = relationship("Tip", back_populates="evidence")
    submitted_by = relationship("User")
    
    # Legal hold flag
    legal_hold = Column(Boolean, default=False, nullable=False)
    legal_hold_reason = Column(Text, nullable=True)
    legal_hold_until = Column(DateTime, nullable=True)
    
    # Retention
    retention_until = Column(DateTime, nullable=True)
    auto_delete = Column(Boolean, default=True, nullable=False)
    
    # EXIF/Metadata (if removed from photo/video)
    original_metadata = Column(JSON, nullable=True)  # Stripped EXIF data
    metadata_removed = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self):
        return f"<Evidence(ref={self.reference_number}, type={self.evidence_type}, status={self.status})>"


class ChainOfCustody(Base):
    """
    Immutable chain-of-custody log.
    
    Every action on evidence is recorded here with:
    - Who performed the action
    - When it occurred
    - What was done
    - Why (if applicable)
    - IP address and system info for audit
    """
    __tablename__ = "chain_of_custody"

    id = Column(Integer, primary_key=True, index=True)
    
    # Evidence reference
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    
    # Action details
    action = Column(String(50), nullable=False)  # ChainOfCustodyAction enum
    action_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action_by_name = Column(String(255), nullable=True)  # For non-users (e.g., "System")
    
    # Timestamp (immutable)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Details
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Audit trail
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    
    # System verification
    hash_verified = Column(Boolean, nullable=True)  # Was integrity checked?
    hash_match = Column(Boolean, nullable=True)  # Did hash match?
    
    # Transfer information (if transferred to external party)
    transferred_to = Column(String(255), nullable=True)  # Organization/person
    transfer_method = Column(String(100), nullable=True)  # "secure_email", "in_person", etc.
    transfer_receipt = Column(String(500), nullable=True)  # Receipt/confirmation number
    
    # Metadata snapshot (for forensics)
    evidence_status_at_time = Column(String(20), nullable=True)
    metadata_snapshot = Column(JSON, nullable=True)
    
    # Relationships
    evidence = relationship("Evidence", back_populates="custody_chain")
    action_by_user = relationship("User")
    
    def __repr__(self):
        return f"<ChainOfCustody(evidence_id={self.evidence_id}, action={self.action}, timestamp={self.timestamp})>"


class EvidenceAccessLog(Base):
    """
    Detailed access log for evidence viewing/downloading.
    
    Separate from chain-of-custody for detailed forensic tracking.
    """
    __tablename__ = "evidence_access_log"

    id = Column(Integer, primary_key=True, index=True)
    
    # Evidence reference
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    
    # Access details
    accessed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    access_type = Column(String(50), nullable=False)  # "view", "download", "export", "print"
    
    # Timestamp
    accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Audit information
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Justification (optional, for sensitive evidence)
    reason = Column(Text, nullable=True)
    authorized_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    evidence = relationship("Evidence")
    accessed_by = relationship("User", foreign_keys=[accessed_by_user_id])
    authorized_by = relationship("User", foreign_keys=[authorized_by_user_id])
    
    def __repr__(self):
        return f"<EvidenceAccessLog(evidence_id={self.evidence_id}, user_id={self.accessed_by_user_id}, type={self.access_type})>"

