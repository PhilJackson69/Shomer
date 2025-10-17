"""Twitter/X feed parser using RSS feeds and third-party services."""

import aiohttp
import feedparser
import re
from datetime import datetime, timezone
from typing import Any

from ingestion.models import NormalizedPost
from ingestion.parsers.base import BaseParser


class TwitterParser(BaseParser):
    """
    Parser for Twitter/X content using RSS feeds and third-party services.
    
    Options:
    1. RSS feeds from third-party services (nitter.net, etc.)
    2. Twitter API v2 (requires API keys)
    3. Web scraping (fragile, not recommended)
    """

    def __init__(self, max_posts: int = 100):
        """Initialize Twitter parser."""
        self.max_posts = max_posts

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        """
        Fetch and parse Twitter posts.

        Args:
            source_config: Must contain 'username' or 'hashtag' or 'search_query'

        Returns:
            List of normalized posts
        """
        username = source_config.get("username")
        hashtag = source_config.get("hashtag")
        search_query = source_config.get("search_query")

        if not any([username, hashtag, search_query]):
            raise ValueError("Twitter source must have username, hashtag, or search_query")

        posts = []

        # Try different RSS sources
        if username:
            posts.extend(await self._fetch_user_tweets(username))
        
        if hashtag:
            posts.extend(await self._fetch_hashtag_tweets(hashtag))
            
        if search_query:
            posts.extend(await self._fetch_search_tweets(search_query))

        return posts[:self.max_posts]

    async def _fetch_user_tweets(self, username: str) -> list[NormalizedPost]:
        """Fetch tweets from a specific user using RSS."""
        # Use nitter.net RSS (if available) or other RSS services
        rss_urls = [
            f"https://nitter.net/{username}/rss",
            f"https://nitter.1d4.us/{username}/rss",
            f"https://nitter.kavin.rocks/{username}/rss",
        ]
        
        for rss_url in rss_urls:
            try:
                posts = await self._fetch_rss_tweets(rss_url, f"twitter:@{username}")
                if posts:
                    print(f"Twitter RSS: Fetched {len(posts)} tweets from @{username}")
                    return posts
            except Exception as e:
                print(f"Failed to fetch from {rss_url}: {e}")
                continue
        
        print(f"No Twitter RSS feeds available for @{username}")
        return []

    async def _fetch_hashtag_tweets(self, hashtag: str) -> list[NormalizedPost]:
        """Fetch tweets with a specific hashtag."""
        # Remove # if present
        hashtag = hashtag.lstrip('#')
        
        rss_urls = [
            f"https://nitter.net/hashtag/{hashtag}/rss",
            f"https://nitter.1d4.us/hashtag/{hashtag}/rss",
        ]
        
        for rss_url in rss_urls:
            try:
                posts = await self._fetch_rss_tweets(rss_url, f"twitter:#{hashtag}")
                if posts:
                    print(f"Twitter RSS: Fetched {len(posts)} tweets for #{hashtag}")
                    return posts
            except Exception as e:
                print(f"Failed to fetch from {rss_url}: {e}")
                continue
        
        print(f"No Twitter RSS feeds available for #{hashtag}")
        return []

    async def _fetch_search_tweets(self, search_query: str) -> list[NormalizedPost]:
        """Fetch tweets matching a search query."""
        # URL encode the search query
        import urllib.parse
        encoded_query = urllib.parse.quote(search_query)
        
        rss_urls = [
            f"https://nitter.net/search/rss?q={encoded_query}",
            f"https://nitter.1d4.us/search/rss?q={encoded_query}",
        ]
        
        for rss_url in rss_urls:
            try:
                posts = await self._fetch_rss_tweets(rss_url, f"twitter:search:{search_query}")
                if posts:
                    print(f"Twitter RSS: Fetched {len(posts)} tweets for search '{search_query}'")
                    return posts
            except Exception as e:
                print(f"Failed to fetch from {rss_url}: {e}")
                continue
        
        print(f"No Twitter RSS feeds available for search '{search_query}'")
        return []

    async def _fetch_rss_tweets(self, rss_url: str, source_name: str) -> list[NormalizedPost]:
        """Fetch tweets from an RSS feed."""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "User-Agent": "Shomer/1.0 (Community Safety Monitor)"
                }
                
                async with session.get(rss_url, headers=headers, timeout=30) as response:
                    if response.status != 200:
                        raise Exception(f"HTTP {response.status}")
                    
                    content = await response.text()
                    
            # Parse RSS feed
            feed = feedparser.parse(content)
            
            if not feed.entries:
                return []
            
            posts = []
            for entry in feed.entries:
                post = self._parse_twitter_post(entry, source_name)
                if post:
                    posts.append(post)
            
            return posts
            
        except Exception as e:
            print(f"Error fetching Twitter RSS from {rss_url}: {e}")
            return []

    def _parse_twitter_post(self, entry: dict[str, Any], source_name: str) -> NormalizedPost:
        """Parse a Twitter RSS entry into normalized format."""
        # Extract text content, removing HTML
        summary = entry.get("summary", "")
        text = re.sub(r'<[^>]+>', '', summary).strip()
        
        # Parse published date
        published_at = datetime.now(timezone.utc)
        if entry.get("published_parsed"):
            try:
                published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            except (ValueError, TypeError):
                pass
        
        # Extract author from link or title
        author = None
        title = entry.get("title", "")
        if ":" in title:
            author = title.split(":")[0].strip()
        
        # Extract tweet ID from link
        link = entry.get("link", "")
        tweet_id = None
        if "/status/" in link:
            match = re.search(r'/status/(\d+)', link)
            if match:
                tweet_id = match.group(1)
        
        return NormalizedPost(
            source=source_name,
            url=link,
            title=title,
            text=text,
            published_at=published_at,
            author=author,
            metadata={
                "platform": "twitter",
                "tweet_id": tweet_id,
                "rss_entry": True,
            },
        )


# Alternative implementation using Twitter API v2 (requires API keys):
"""
import tweepy

class TwitterAPIParser(BaseParser):
    def __init__(self, bearer_token: str, max_posts: int = 100):
        self.max_posts = max_posts
        self.client = tweepy.Client(bearer_token=bearer_token)

    async def fetch(self, source_config: dict[str, Any]) -> list[NormalizedPost]:
        # Implementation using Twitter API v2
        # Requires proper authentication and rate limiting
        pass
"""
