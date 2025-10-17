"""RSS/Atom feed parser."""

import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
import feedparser
from dateutil import parser as date_parser

from ingestion.models import NormalizedPost
from ingestion.parsers.base import BaseParser


class RSSParser(BaseParser):
    """Parser for RSS and Atom feeds."""

    def __init__(self, max_posts: int = 100):
        """Initialize RSS parser."""
        self.max_posts = max_posts

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch and parse RSS feed.

        Args:
            source_config: Must contain 'name' and 'url'

        Returns:
            List of normalized posts
        """
        name = source_config.get("name", "unknown")
        url = source_config.get("url")

        if not url:
            raise ValueError(f"RSS source {name} missing URL")

        # Fetch feed content
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status != 200:
                    raise Exception(f"Failed to fetch RSS feed: HTTP {response.status}")
                content = await response.text()

        # Parse feed
        feed = feedparser.parse(content)

        posts = []
        for entry in feed.entries[: self.max_posts]:
            try:
                post = self._parse_entry(name, entry)
                if post:
                    posts.append(post)
            except Exception as e:
                print(f"Error parsing RSS entry: {e}")
                continue

        return posts

    def _parse_entry(self, source_name: str, entry: Any) -> NormalizedPost | None:
        """Parse a single RSS entry."""
        # Extract title
        title = entry.get("title", "").strip()
        if not title:
            return None

        # Extract URL
        url = entry.get("link", "").strip()
        if not url:
            return None

        # Extract text content
        text = self._extract_text(entry)

        # Extract publish date
        published_at = self._extract_date(entry)

        # Extract author
        author = entry.get("author", None)

        # Build metadata
        metadata = {
            "feed_title": entry.get("feed", {}).get("title"),
            "categories": [cat.get("term") for cat in entry.get("tags", [])],
        }

        return NormalizedPost(
            source=f"rss:{source_name}",
            url=url,
            title=title,
            text=self._truncate_text(text),
            published_at=published_at,
            author=author,
            metadata=metadata,
        )

    def _extract_text(self, entry: Any) -> str:
        """Extract text content from entry."""
        # Try multiple fields
        if "content" in entry and entry.content:
            content = entry.content[0].get("value", "")
        elif "summary" in entry:
            content = entry.get("summary", "")
        elif "description" in entry:
            content = entry.get("description", "")
        else:
            content = ""

        # Strip HTML tags
        content = self._strip_html(content)
        return content.strip()

    def _strip_html(self, text: str) -> str:
        """Remove HTML tags from text."""
        # Simple HTML tag removal
        text = re.sub(r"<[^>]+>", " ", text)
        # Clean up whitespace
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _extract_date(self, entry: Any) -> datetime:
        """Extract publish date from entry."""
        # Try multiple date fields
        date_str = entry.get("published") or entry.get("updated") or entry.get("created")

        if date_str:
            try:
                dt = date_parser.parse(date_str)
                # Ensure timezone aware
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                pass

        # Fallback to now
        return datetime.now(timezone.utc)

