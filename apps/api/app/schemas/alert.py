"""Alert schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class AlertSendRequest(BaseModel):
    """Request to send an alert."""

    title: str = Field(..., description="Alert title")
    body: str = Field(..., description="Alert body/message")
    severity: str = Field(
        "medium",
        description="Alert severity: low, medium, high, critical",
    )
    channels: list[str] = Field(
        ...,
        description="Channels to use: sms, email, push",
        min_length=1,
    )
    audience_filter: dict[str, list[str]] = Field(
        ...,
        description="Mapping of channel to list of recipients",
    )


class AlertChannelResult(BaseModel):
    """Result for a single recipient in a channel."""

    success: bool
    recipient: str | None = None
    message: str | None = None
    error: str | None = None


class AlertSendResponse(BaseModel):
    """Response from alert send operation."""

    success: bool
    message: str
    results: dict[str, list[AlertChannelResult]]
    total_sent: int
    total_failed: int


class AlertResponse(BaseModel):
    """Alert record response."""

    id: int
    channel: str
    recipient: str
    subject: str | None
    message: str
    status: str
    sent_at: datetime | None
    created_at: datetime
    metadata: dict | None = None

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """List of alerts response."""

    alerts: list[AlertResponse]
    total: int
    page: int
    page_size: int
