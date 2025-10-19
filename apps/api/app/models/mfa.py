"""MFA (Multi-Factor Authentication) models."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserMFA(Base):
    """User MFA configuration and settings."""
    __tablename__ = "user_mfa"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    enabled = Column(Boolean, default=False, nullable=False)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret_hash = Column(String(255), nullable=True)  # Hashed TOTP secret
    webauthn_enabled = Column(Boolean, default=False, nullable=False)
    recovery_codes_hash = Column(Text, nullable=True)  # JSON array of hashed recovery codes
    backup_codes_used = Column(Text, nullable=True)  # JSON array of used backup codes
    last_totp_used = Column(String(10), nullable=True)  # Last used TOTP code (for replay protection)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="mfa_settings")
    webauthn_credentials = relationship("WebAuthnCredential", back_populates="user_mfa", cascade="all, delete-orphan")


class WebAuthnCredential(Base):
    """WebAuthn credentials for hardware security keys."""
    __tablename__ = "webauthn_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_mfa_id = Column(Integer, ForeignKey("user_mfa.id"), nullable=False)
    credential_id = Column(String(255), unique=True, nullable=False, index=True)
    public_key = Column(Text, nullable=False)  # Base64 encoded public key
    counter = Column(Integer, default=0, nullable=False)
    name = Column(String(100), nullable=True)  # User-friendly name for the credential
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user_mfa = relationship("UserMFA", back_populates="webauthn_credentials")


class MFAAttempt(Base):
    """MFA verification attempts for security monitoring."""
    __tablename__ = "mfa_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    attempt_type = Column(String(20), nullable=False)  # 'totp', 'recovery', 'webauthn'
    success = Column(Boolean, nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    failure_reason = Column(String(100), nullable=True)  # 'invalid_code', 'replay_attack', etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")


class MFACohortMember(Base):
    """MFA rollout cohort membership for staged deployment."""
    __tablename__ = "mfa_cohort_members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who added user
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String(500), nullable=True)  # Optional notes about why user was added

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    added_by_user = relationship("User", foreign_keys=[added_by])