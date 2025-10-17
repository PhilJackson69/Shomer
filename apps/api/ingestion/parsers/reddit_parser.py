"""Reddit feed parser using RSS feeds."""

import aiohttp
import feedparser
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

from ingestion.models import NormalizedPost
from ingestion.parsers.base import BaseParser


class RedditParser(BaseParser):
    """
    Parser for Reddit public content using RSS feeds.
    
    Uses Reddit's public RSS feeds which don't require API keys.
    Limited to ~25 most recent posts per subreddit.
    """

    def __init__(self, max_posts: int = 100):
        """Initialize Reddit parser."""
        self.max_posts = max_posts

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch and parse Reddit posts from RSS.

        Args:
            source_config: Must contain 'subreddit' and optionally 'search_query'

        Returns:
            List of normalized posts
        """
        subreddit = source_config.get("subreddit")
        search_query = source_config.get("search_query")

        if not subreddit:
            raise ValueError("Reddit source missing subreddit")

        # Use Reddit RSS feed
        rss_url = f"https://www.reddit.com/r/{subreddit}/.rss"
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "User-Agent": "Shomer/1.0 (Community Safety Monitor)"
                }
                
                async with session.get(rss_url, headers=headers, timeout=30) as response:
                    if response.status != 200:
                        print(f"Failed to fetch Reddit RSS for r/{subreddit}: {response.status}")
                        return []
                    
                    content = await response.text()
                    
            # Parse RSS feed
            feed = feedparser.parse(content)
            
            if not feed.entries:
                print(f"No entries found in Reddit RSS for r/{subreddit}")
                return []
            
            posts = []
            for entry in feed.entries[:self.max_posts]:
                # Filter by search query if provided
                if search_query:
                    search_text = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
                    if search_query.lower() not in search_text:
                        continue
                
                post = self._parse_reddit_post(subreddit, entry)
                if post:
                    posts.append(post)
            
            print(f"Reddit RSS: Fetched {len(posts)} posts from r/{subreddit}")
            return posts
            
        except Exception as e:
            print(f"Error fetching Reddit RSS for r/{subreddit}: {e}")
            return []

    def _parse_reddit_post(
        self, subreddit: str, entry: dict[str, Any]
    ) -> NormalizedPost:
        """
        Parse a Reddit RSS entry into normalized format.
        """
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
        
        # Extract author from link or summary
        author = None
        link = entry.get("link", "")
        if "/u/" in link:
            match = re.search(r'/u/([^/]+)', link)
            if match:
                author = match.group(1)
        
        return NormalizedPost(
            source=f"reddit:{subreddit}",
            url=link,
            title=entry.get("title", ""),
            text=text,
            published_at=published_at,
            author=author,
            metadata={
                "subreddit": subreddit,
                "rss_entry": True,
                "reddit_id": entry.get("id"),
            },
        )


# Example usage with Reddit RSS (limited to 25 posts):
"""
import aiohttp
import feedparser

async def fetch_reddit_rss(subreddit: str) -> list[NormalizedPost]:
    url = f"https://www.reddit.com/r/{subreddit}/.rss"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers={"User-Agent": "Shomer/1.0"}) as response:
            content = await response.text()
    
    feed = feedparser.parse(content)
    posts = []
    
    for entry in feed.entries:
        posts.append(NormalizedPost(
            source=f"reddit:{subreddit}",
            url=entry.link,
            title=entry.title,
            text=strip_html(entry.summary),
            published_at=parse_date(entry.published),
            author=entry.author
        ))
    
    return posts
"""

