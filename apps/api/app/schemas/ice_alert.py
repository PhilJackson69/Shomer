"""ICE Alert schemas for request/response validation."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ICEAlertSubmit(BaseModel):
    """Schema for submitting a new ICE alert."""

    location: str = Field(..., min_length=3, max_length=500, description="Location description (no specific addresses)")
    description: str = Field(..., min_length=10, max_length=2000, description="Alert description (no personal info)")
    severity: str = Field(..., description="Severity: rumor, verified, or active")
    source: str = Field(..., min_length=3, max_length=200, description="Source of information")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude coordinate")
    
    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        """Validate severity is one of the allowed values."""
        allowed = ["rumor", "verified", "active"]
        if v.lower() not in allowed:
            raise ValueError(f"Severity must be one of: {', '.join(allowed)}")
        return v.lower()
    
    @field_validator("description", "location")
    @classmethod
    def check_no_personal_info(cls, v: str) -> str:
        """Basic check for personal information (enhanced in service layer)."""
        # Check for common PII patterns
        prohibited_patterns = [
            "license plate",
            "badge number",
            "officer name",
            "vehicle plate",
            "social security",
            "ssn",
        ]
        v_lower = v.lower()
        for pattern in prohibited_patterns:
            if pattern in v_lower:
                raise ValueError(f"Description/location cannot contain personal information like '{pattern}'")
        return v


class ICEAlertUpdate(BaseModel):
    """Schema for updating an ICE alert (moderator only)."""

    location: Optional[str] = Field(None, min_length=3, max_length=500)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    severity: Optional[str] = None
    source: Optional[str] = Field(None, min_length=3, max_length=200)
    verified: Optional[bool] = None
    approved: Optional[bool] = None
    rejection_reason: Optional[str] = None
    
    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        """Validate severity if provided."""
        if v is None:
            return v
        allowed = ["rumor", "verified", "active"]
        if v.lower() not in allowed:
            raise ValueError(f"Severity must be one of: {', '.join(allowed)}")
        return v.lower()


class ICEAlertResponse(BaseModel):
    """Schema for ICE alert response (sanitized for public)."""

    id: int
    location: str
    description: str
    severity: str
    source: str
    verified: bool
    approved: bool
    confidence_score: Optional[float] = None
    expires_at: datetime
    broadcast_sent: bool
    created_at: datetime
    
    # Optional coordinates (may be approximated for privacy)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    class Config:
        from_attributes = True


class ICEAlertDetailResponse(BaseModel):
    """Schema for detailed ICE alert response (moderator view)."""

    id: int
    location: str
    description: str
    severity: str
    source: str
    verified: bool
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    confidence_score: Optional[float] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    approved: bool
    rejection_reason: Optional[str] = None
    expires_at: datetime
    archived: bool
    archived_at: Optional[datetime] = None
    broadcast_sent: bool
    broadcast_at: Optional[datetime] = None
    broadcast_count: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    metadata: Optional[dict] = None
    
    class Config:
        from_attributes = True


class ICEAlertListResponse(BaseModel):
    """Schema for paginated list of ICE alerts."""

    alerts: list[ICEAlertResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class ICEAlertNearbyQuery(BaseModel):
    """Schema for nearby alerts query parameters."""

    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    radius: float = Field(10.0, ge=0.1, le=100, description="Search radius in kilometers")
    severity: Optional[str] = Field(None, description="Filter by severity")
    include_expired: bool = Field(False, description="Include expired alerts")
    
    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        """Validate severity if provided."""
        if v is None:
            return v
        allowed = ["rumor", "verified", "active"]
        if v.lower() not in allowed:
            raise ValueError(f"Severity must be one of: {', '.join(allowed)}")
        return v.lower()


class ICEAlertBroadcastRequest(BaseModel):
    """Schema for broadcasting an ICE alert."""

    alert_id: int = Field(..., description="ID of alert to broadcast")
    channels: list[str] = Field(..., description="Channels: sms, email, push")
    message_template: Optional[str] = Field(None, description="Custom message template")
    
    @field_validator("channels")
    @classmethod
    def validate_channels(cls, v: list[str]) -> list[str]:
        """Validate channels."""
        allowed = ["sms", "email", "push"]
        for channel in v:
            if channel not in allowed:
                raise ValueError(f"Invalid channel: {channel}. Must be one of: {', '.join(allowed)}")
        return v


class ICEAlertBroadcastResponse(BaseModel):
    """Schema for broadcast operation response."""

    success: bool
    message: str
    alert_id: int
    broadcast_count: int
    channels_used: list[str]
    errors: Optional[list[str]] = None


class ICEAlertStats(BaseModel):
    """Schema for ICE alert statistics."""

    total_alerts: int
    alerts_verified: int
    alerts_active: int
    alerts_rumor: int
    alerts_expired: int
    verification_rate: float
    avg_confidence_score: Optional[float] = None
    total_broadcasts: int
    total_recipients: int
    

class ICEAlertFeedResponse(BaseModel):
    """Schema for public ICE alert feed."""

    alerts: list[ICEAlertResponse]
    total: int
    last_updated: datetime
    disclaimer: str = (
        "These alerts are community-submitted and human-reviewed. "
        "They represent reported activity and should be treated as informational. "
        "Always prioritize your safety and know your rights."
    )

