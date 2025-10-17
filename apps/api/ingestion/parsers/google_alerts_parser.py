"""Google Alerts RSS parser."""

import aiohttp
import feedparser
import re
from datetime import datetime, timezone
from typing import Any

from ingestion.models import NormalizedPost
from ingestion.parsers.base import BaseParser


class GoogleAlertsParser(BaseParser):
    """
    Parser for Google Alerts RSS feeds.
    
    Google Alerts can be configured to send RSS feeds for specific search terms.
    This parser handles the RSS format that Google Alerts generates.
    """

    def __init__(self, max_posts: int = 100):
        """Initialize Google Alerts parser."""
        self.max_posts = max_posts

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch and parse Google Alerts posts.

        Args:
            source_config: Must contain 'rss_url' or 'alert_id' and 'search_terms'

        Returns:
            List of normalized posts
        """
        rss_url = source_config.get("rss_url")
        alert_id = source_config.get("alert_id")
        search_terms = source_config.get("search_terms", [])

        if not rss_url and not alert_id:
            raise ValueError("Google Alerts source must have rss_url or alert_id")

        if rss_url:
            return await self._fetch_from_url(rss_url, source_config.get("name", "google_alerts"))
        
        # If alert_id is provided, we could potentially construct the RSS URL
        # Note: This would require knowing the user's Google Alerts RSS URL format
        print(f"Google Alerts: alert_id {alert_id} requires manual RSS URL configuration")
        return []

    async def _fetch_from_url(self, rss_url: str, source_name: str) -> list[NormalizedPost]:
        """Fetch posts from a Google Alerts RSS URL."""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "User-Agent": "Shomer/1.0 (Community Safety Monitor)"
                }
                
                async with session.get(rss_url, headers=headers, timeout=30) as response:
                    if response.status != 200:
                        print(f"Failed to fetch Google Alerts RSS: {response.status}")
                        return []
                    
                    content = await response.text()
                    
            # Parse RSS feed
            feed = feedparser.parse(content)
            
            if not feed.entries:
                print(f"No entries found in Google Alerts RSS")
                return []
            
            posts = []
            for entry in feed.entries[:self.max_posts]:
                post = self._parse_google_alert(entry, source_name)
                if post:
                    posts.append(post)
            
            print(f"Google Alerts: Fetched {len(posts)} posts from {source_name}")
            return posts
            
        except Exception as e:
            print(f"Error fetching Google Alerts RSS from {rss_url}: {e}")
            return []

    def _parse_google_alert(self, entry: dict[str, Any], source_name: str) -> NormalizedPost:
        """Parse a Google Alerts RSS entry into normalized format."""
        # Extract text content from summary, removing HTML
        summary = entry.get("summary", "")
        text = re.sub(r'<[^>]+>', '', summary).strip()
        
        # Parse published date
        published_at = datetime.now(timezone.utc)
        if entry.get("published_parsed"):
            try:
                published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            except (ValueError, TypeError):
                pass
        
        # Extract source domain from link
        link = entry.get("link", "")
        domain = None
        if link:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(link)
                domain = parsed.netloc
            except:
                pass
        
        # Extract snippet from summary (Google Alerts often includes a snippet)
        snippet = ""
        if "..." in text:
            snippet = text.split("...")[0].strip()
        
        return NormalizedPost(
            source=f"google_alerts:{source_name}",
            url=link,
            title=entry.get("title", ""),
            text=text,
            published_at=published_at,
            author=domain,  # Use domain as author since Google Alerts doesn't have authors
            metadata={
                "platform": "google_alerts",
                "domain": domain,
                "snippet": snippet,
                "rss_entry": True,
                "alert_source": source_name,
            },
        )


# Example configuration for Google Alerts:
"""
To set up Google Alerts RSS feeds:

1. Go to https://www.google.com/alerts
2. Create a new alert with your search terms
3. Choose "RSS" as the delivery method
4. Copy the RSS URL and add it to your feeds.yaml

Example feeds.yaml configuration:
feeds:
  google_alerts:
    enabled: true
    sources:
      - name: community_safety
        rss_url: "https://www.google.com/alerts/feeds/12345678901234567890/12345678901234567890"
        search_terms: ["community safety", "threat", "emergency"]
        enabled: true
      - name: local_news
        rss_url: "https://www.google.com/alerts/feeds/09876543210987654321/09876543210987654321"
        search_terms: ["local news", "incident", "police"]
        enabled: true
"""
