"""NLP schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class TextScoreRequest(BaseModel):
    """Request for text scoring."""

    text: str = Field(..., min_length=1, description="Text to analyze")
    timestamp: datetime | None = Field(
        None, description="Timestamp of the text (defaults to now)"
    )
    detected_locations: list[str] | None = Field(
        None, description="List of detected location names"
    )
    user_id: str | None = Field(None, description="User identifier for history lookup")
    previous_warnings: int = Field(0, ge=0, description="Number of previous warnings")
    previous_incidents: int = Field(
        0, ge=0, description="Number of previous incidents"
    )


class TextScoreResponse(BaseModel):
    """Response from text scoring."""

    # Classification results
    threat_prob: float = Field(..., ge=0, le=1, description="Threat probability (0-1)")
    hate_prob: float = Field(
        ..., ge=0, le=1, description="Hate speech probability (0-1)"
    )
    risk_factors: list[str] = Field(..., description="Detected risk factors")

    # Risk score results
    risk_score: float = Field(..., ge=0, le=100, description="Overall risk score (0-100)")
    risk_level: str = Field(..., description="Risk level: LOW, MEDIUM, HIGH, CRITICAL")
    breakdown: dict[str, float] = Field(..., description="Score breakdown by component")

