"""Ingestion package for pulling content from external sources."""

from .models import NormalizedPost
from .manager import FeedManager

__all__ = ["NormalizedPost", "FeedManager"]

