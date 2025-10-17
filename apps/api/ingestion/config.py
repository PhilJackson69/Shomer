"""Configuration for ingestion system."""

from pathlib import Path
from typing import Any

import yaml


class IngestionConfig:
    """Configuration manager for ingestion feeds."""

    def __init__(self, config_path: str = "feeds.yaml"):
        """Initialize config from YAML file."""
        self.config_path = Path(config_path)
        self._config: dict[str, Any] = {}
        self.load()

    def load(self) -> None:
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            # Create default config
            self._config = self._default_config()
            self.save()
        else:
            with open(self.config_path, "r") as f:
                self._config = yaml.safe_load(f) or {}

    def save(self) -> None:
        """Save configuration to YAML file."""
        with open(self.config_path, "w") as f:
            yaml.dump(self._config, f, default_flow_style=False, sort_keys=False)

    def _default_config(self) -> dict[str, Any]:
        """Return default configuration."""
        return {
            "version": "1.0",
            "settings": {
                "risk_threshold": 50.0,  # Minimum risk score to create incident
                "rate_limit_per_minute": 60,  # Max requests per minute
                "worker_timeout": 300,  # Worker timeout in seconds
                "max_posts_per_feed": 100,  # Max posts to fetch per feed
            },
            "feeds": {
                "rss": {
                    "enabled": True,
                    "sources": [
                        {
                            "name": "example_news",
                            "url": "https://example.com/rss",
                            "enabled": False,
                        }
                    ],
                },
                "reddit": {
                    "enabled": False,
                    "sources": [
                        {
                            "name": "worldnews",
                            "subreddit": "worldnews",
                            "enabled": False,
                        }
                    ],
                },
                "web": {
                    "enabled": False,
                    "sources": [],
                },
            },
        }

    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a setting value."""
        return self._config.get("settings", {}).get(key, default)

    def get_feeds(self, feed_type: str) -> list[dict[str, Any]]:
        """Get all feeds of a specific type."""
        feeds = self._config.get("feeds", {}).get(feed_type, {})
        if not feeds.get("enabled", False):
            return []
        return [f for f in feeds.get("sources", []) if f.get("enabled", False)]

    def get_all_enabled_feeds(self) -> dict[str, list[dict[str, Any]]]:
        """Get all enabled feeds grouped by type."""
        result = {}
        for feed_type in ["rss", "reddit", "web"]:
            feeds = self.get_feeds(feed_type)
            if feeds:
                result[feed_type] = feeds
        return result

    def enable_feed(self, feed_type: str, feed_name: str) -> bool:
        """Enable a specific feed."""
        feeds = self._config.get("feeds", {}).get(feed_type, {})
        sources = feeds.get("sources", [])
        for source in sources:
            if source.get("name") == feed_name or source.get("subreddit") == feed_name:
                source["enabled"] = True
                self.save()
                return True
        return False

    def disable_feed(self, feed_type: str, feed_name: str) -> bool:
        """Disable a specific feed."""
        feeds = self._config.get("feeds", {}).get(feed_type, {})
        sources = feeds.get("sources", [])
        for source in sources:
            if source.get("name") == feed_name or source.get("subreddit") == feed_name:
                source["enabled"] = False
                self.save()
                return True
        return False

    def add_feed(self, feed_type: str, feed_config: dict[str, Any]) -> bool:
        """Add a new feed."""
        if feed_type not in ["rss", "reddit", "web"]:
            return False

        if "feeds" not in self._config:
            self._config["feeds"] = {}
        if feed_type not in self._config["feeds"]:
            self._config["feeds"][feed_type] = {"enabled": True, "sources": []}

        self._config["feeds"][feed_type]["sources"].append(feed_config)
        self.save()
        return True

    def remove_feed(self, feed_type: str, feed_name: str) -> bool:
        """Remove a feed."""
        feeds = self._config.get("feeds", {}).get(feed_type, {})
        sources = feeds.get("sources", [])
        original_len = len(sources)

        feeds["sources"] = [
            s
            for s in sources
            if s.get("name") != feed_name and s.get("subreddit") != feed_name
        ]

        if len(feeds["sources"]) < original_len:
            self.save()
            return True
        return False

