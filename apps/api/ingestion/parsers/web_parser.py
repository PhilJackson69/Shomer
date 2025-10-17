"""Generic web page parser via RSS (allow list only)."""

from typing import Any

from ingestion.models import NormalizedPost
from ingestion.parsers.base import BaseParser
from ingestion.parsers.rss_parser import RSSParser


class WebParser(BaseParser):
    """
    Parser for generic web pages via RSS feeds.

    This is essentially an alias for RSSParser but with explicit
    allow-list checking for security.
    """

    def __init__(self, max_posts: int = 100, allow_list: list[str] | None = None):
        """
        Initialize web parser.

        Args:
            max_posts: Maximum posts to fetch
            allow_list: List of allowed domains (e.g., ["example.com", "news.org"])
        """
        self.max_posts = max_posts
        self.allow_list = allow_list or []
        self._rss_parser = RSSParser(max_posts=max_posts)

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch web content via RSS feed.

        Args:
            source_config: Must contain 'name' and 'url'

        Returns:
            List of normalized posts
        """
        url = source_config.get("url", "")

        # Check allow list
        if self.allow_list and not self._is_allowed(url):
            raise ValueError(f"URL {url} not in allow list")

        # Use RSS parser for actual fetching
        return await self._rss_parser.fetch(source_config)

    def _is_allowed(self, url: str) -> bool:
        """Check if URL is in allow list."""
        from urllib.parse import urlparse

        try:
            domain = urlparse(url).netloc
            # Remove www. prefix for comparison
            domain = domain.replace("www.", "")

            for allowed_domain in self.allow_list:
                allowed_domain = allowed_domain.replace("www.", "")
                if domain == allowed_domain or domain.endswith(f".{allowed_domain}"):
                    return True
        except Exception:
            return False

        return False

