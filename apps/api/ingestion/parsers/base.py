"""Base parser interface."""

from abc import ABC, abstractmethod
from typing import Any

from ingestion.models import NormalizedPost


class BaseParser(ABC):
    """Base class for feed parsers."""

    @abstractmethod
    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch and parse posts from a source.

        Args:
            source_config: Source configuration dict

        Returns:
            List of normalized posts
        """
        pass

    def _truncate_text(self, text: str, max_length: int = 5000) -> str:
        """Truncate text to maximum length."""
        if len(text) <= max_length:
            return text
        return text[:max_length] + "..."

