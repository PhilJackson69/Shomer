"""Ingestion schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class FeedConfig(BaseModel):
    """Feed configuration."""

    name: str = Field(..., description="Feed name")
    url: str | None = Field(None, description="Feed URL (for RSS/web)")
    subreddit: str | None = Field(None, description="Subreddit name (for Reddit)")
    search_query: str | None = Field(None, description="Search query (for Reddit)")
    enabled: bool = Field(True, description="Whether feed is enabled")


class FeedListResponse(BaseModel):
    """Response with list of feeds."""

    feed_type: str
    feeds: list[FeedConfig]


class FeedStatusUpdate(BaseModel):
    """Request to update feed status."""

    enabled: bool = Field(..., description="Enable or disable feed")


class IngestionResultResponse(BaseModel):
    """Ingestion result."""

    feed_name: str
    success: bool
    posts_fetched: int
    posts_scored: int
    incidents_created: int
    errors: list[str]
    duration_seconds: float


class IngestionRunResponse(BaseModel):
    """Response from ingestion run."""

    success: bool
    feeds_processed: int
    total_posts_fetched: int
    total_posts_scored: int
    total_incidents_created: int
    results: list[IngestionResultResponse]


class IngestionJobResponse(BaseModel):
    """Response when job is enqueued."""

    job_id: str
    status: str
    message: str

