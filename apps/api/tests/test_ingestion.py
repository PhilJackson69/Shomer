"""Tests for ingestion system."""

import asyncio
from datetime import datetime, timezone

import pytest

from ingestion.config import IngestionConfig
from ingestion.models import NormalizedPost
from ingestion.parsers import RSSParser
from ingestion.rate_limiter import RateLimiter


class TestNormalizedPost:
    """Tests for NormalizedPost model."""

    def test_valid_post(self):
        """Test creating a valid post."""
        post = NormalizedPost(
            source="rss:test",
            url="https://example.com/post",
            title="Test Post",
            text="Test content",
            published_at=datetime.now(timezone.utc),
        )

        assert post.source == "rss:test"
        assert post.url == "https://example.com/post"
        assert post.title == "Test Post"

    def test_missing_source_error(self):
        """Test that missing source raises error."""
        with pytest.raises(ValueError, match="source is required"):
            NormalizedPost(
                source="",
                url="https://example.com/post",
                title="Test",
                text="Content",
                published_at=datetime.now(timezone.utc),
            )

    def test_missing_url_error(self):
        """Test that missing URL raises error."""
        with pytest.raises(ValueError, match="url is required"):
            NormalizedPost(
                source="rss:test",
                url="",
                title="Test",
                text="Content",
                published_at=datetime.now(timezone.utc),
            )

    def test_missing_title_error(self):
        """Test that missing title raises error."""
        with pytest.raises(ValueError, match="title is required"):
            NormalizedPost(
                source="rss:test",
                url="https://example.com/post",
                title="",
                text="Content",
                published_at=datetime.now(timezone.utc),
            )

    def test_with_metadata(self):
        """Test post with metadata."""
        metadata = {"category": "news", "tags": ["tech", "ai"]}
        post = NormalizedPost(
            source="rss:test",
            url="https://example.com/post",
            title="Test",
            text="Content",
            published_at=datetime.now(timezone.utc),
            metadata=metadata,
        )

        assert post.metadata == metadata


class TestIngestionConfig:
    """Tests for IngestionConfig."""

    def test_default_config(self, tmp_path):
        """Test default configuration."""
        config_path = tmp_path / "test_feeds.yaml"
        config = IngestionConfig(str(config_path))

        # Check default settings
        assert config.get_setting("risk_threshold") == 50.0
        assert config.get_setting("rate_limit_per_minute") == 60

        # Check default feeds structure
        assert "rss" in config._config["feeds"]
        assert "reddit" in config._config["feeds"]
        assert "web" in config._config["feeds"]

    def test_enable_disable_feed(self, tmp_path):
        """Test enabling and disabling feeds."""
        config_path = tmp_path / "test_feeds.yaml"
        config = IngestionConfig(str(config_path))

        # Add a test feed
        config.add_feed("rss", {"name": "test_feed", "url": "https://example.com/rss", "enabled": False})

        # Enable it
        assert config.enable_feed("rss", "test_feed")

        # Check it's enabled
        feeds = config.get_feeds("rss")
        test_feed = next((f for f in feeds if f["name"] == "test_feed"), None)
        assert test_feed is not None

        # Disable it
        assert config.disable_feed("rss", "test_feed")

        # Check it's disabled
        feeds = config.get_feeds("rss")
        test_feed = next((f for f in feeds if f["name"] == "test_feed"), None)
        assert test_feed is None

    def test_add_remove_feed(self, tmp_path):
        """Test adding and removing feeds."""
        config_path = tmp_path / "test_feeds.yaml"
        config = IngestionConfig(str(config_path))

        # Add feed
        feed_config = {"name": "new_feed", "url": "https://example.com/feed", "enabled": True}
        assert config.add_feed("rss", feed_config)

        # Verify it was added
        feeds = config._config["feeds"]["rss"]["sources"]
        assert any(f["name"] == "new_feed" for f in feeds)

        # Remove feed
        assert config.remove_feed("rss", "new_feed")

        # Verify it was removed
        feeds = config._config["feeds"]["rss"]["sources"]
        assert not any(f["name"] == "new_feed" for f in feeds)

    def test_get_all_enabled_feeds(self, tmp_path):
        """Test getting all enabled feeds."""
        config_path = tmp_path / "test_feeds.yaml"
        config = IngestionConfig(str(config_path))

        # Add and enable some feeds
        config.add_feed("rss", {"name": "feed1", "url": "https://example.com/1", "enabled": True})
        config._config["feeds"]["rss"]["enabled"] = True
        config.enable_feed("rss", "feed1")

        enabled_feeds = config.get_all_enabled_feeds()

        assert "rss" in enabled_feeds
        assert len(enabled_feeds["rss"]) > 0


class TestRateLimiter:
    """Tests for RateLimiter."""

    @pytest.mark.asyncio
    async def test_rate_limiter_basic(self):
        """Test basic rate limiting."""
        limiter = RateLimiter(max_calls=3, period=1.0)

        # First 3 calls should be immediate
        start = asyncio.get_event_loop().time()

        await limiter.acquire()
        await limiter.acquire()
        await limiter.acquire()

        elapsed = asyncio.get_event_loop().time() - start
        assert elapsed < 0.1  # Should be nearly instant

    @pytest.mark.asyncio
    async def test_rate_limiter_blocks(self):
        """Test that rate limiter blocks when limit exceeded."""
        limiter = RateLimiter(max_calls=2, period=0.5)

        # First 2 calls should be immediate
        await limiter.acquire()
        await limiter.acquire()

        # Third call should block
        start = asyncio.get_event_loop().time()
        await limiter.acquire()
        elapsed = asyncio.get_event_loop().time() - start

        assert elapsed >= 0.4  # Should have waited ~0.5 seconds

    @pytest.mark.asyncio
    async def test_rate_limiter_reset(self):
        """Test rate limiter reset."""
        limiter = RateLimiter(max_calls=2, period=1.0)

        await limiter.acquire()
        await limiter.acquire()

        limiter.reset()

        # Should be able to call again immediately
        start = asyncio.get_event_loop().time()
        await limiter.acquire()
        elapsed = asyncio.get_event_loop().time() - start

        assert elapsed < 0.1


class TestRSSParser:
    """Tests for RSS parser."""

    def test_strip_html(self):
        """Test HTML stripping."""
        parser = RSSParser()

        html = "<p>This is <strong>bold</strong> text with <a href='#'>links</a>.</p>"
        clean = parser._strip_html(html)

        assert "<" not in clean
        assert ">" not in clean
        assert "bold" in clean
        assert "links" in clean

    def test_truncate_text(self):
        """Test text truncation."""
        parser = RSSParser()

        short_text = "Short text"
        assert parser._truncate_text(short_text, 100) == short_text

        long_text = "A" * 200
        truncated = parser._truncate_text(long_text, 100)
        assert len(truncated) <= 103  # 100 + "..."
        assert truncated.endswith("...")


class TestIngestionIntegration:
    """Integration tests for ingestion system."""

    def test_config_persistence(self, tmp_path):
        """Test that config changes persist."""
        config_path = tmp_path / "test_feeds.yaml"

        # Create config and add feed
        config1 = IngestionConfig(str(config_path))
        config1.add_feed("rss", {"name": "persistent_feed", "url": "https://example.com", "enabled": True})

        # Load new config instance
        config2 = IngestionConfig(str(config_path))

        # Verify feed exists
        feeds = config2._config["feeds"]["rss"]["sources"]
        assert any(f["name"] == "persistent_feed" for f in feeds)

    @pytest.mark.asyncio
    async def test_rate_limiter_concurrent(self):
        """Test rate limiter with concurrent requests."""
        limiter = RateLimiter(max_calls=5, period=1.0)

        async def make_request():
            await limiter.acquire()
            return True

        # Make 10 concurrent requests
        start = asyncio.get_event_loop().time()
        tasks = [make_request() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        elapsed = asyncio.get_event_loop().time() - start

        # All should succeed
        assert all(results)

        # Should have taken at least 1 second (5 immediate + 5 after period)
        assert elapsed >= 0.9

