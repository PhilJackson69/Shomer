"""Data models for ingestion system."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class NormalizedPost:
    """Normalized post from any source."""

    source: str  # e.g., "rss:cnn", "reddit:worldnews"
    url: str
    title: str
    text: str
    published_at: datetime
    author: str | None = None
    metadata: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        """Validate required fields."""
        if not self.source:
            raise ValueError("source is required")
        if not self.url:
            raise ValueError("url is required")
        if not self.title:
            raise ValueError("title is required")
        if not isinstance(self.published_at, datetime):
            raise ValueError("published_at must be a datetime")


@dataclass
class IngestionResult:
    """Result of an ingestion run."""

    feed_name: str
    success: bool
    posts_fetched: int
    posts_scored: int
    incidents_created: int
    errors: list[str]
    duration_seconds: float
    timestamp: datetime

