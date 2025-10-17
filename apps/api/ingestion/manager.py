"""Feed manager for coordinating ingestion."""

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.incident import Incident
from ingestion.config import IngestionConfig
from ingestion.models import IngestionResult, NormalizedPost
from ingestion.parsers import RSSParser, RedditParser, WebParser, TwitterParser, GoogleAlertsParser
from ingestion.rate_limiter import RateLimiter
from shomer_nlp import score_text
from shomer_nlp.risk_scorer import RiskScorer


class FeedManager:
    """Manages feed ingestion with rate limiting and scoring."""

    def __init__(
        self,
        config: IngestionConfig | None = None,
        db: Session | None = None,
    ):
        """
        Initialize feed manager.

        Args:
            config: Ingestion configuration
            db: Database session for creating incidents
        """
        self.config = config or IngestionConfig()
        self.db = db
        self.risk_scorer = RiskScorer()

        # Initialize parsers
        max_posts = self.config.get_setting("max_posts_per_feed", 100)
        self.parsers = {
            "rss": RSSParser(max_posts=max_posts),
            "reddit": RedditParser(max_posts=max_posts),
            "web": WebParser(max_posts=max_posts),
            "twitter": TwitterParser(max_posts=max_posts),
            "google_alerts": GoogleAlertsParser(max_posts=max_posts),
        }

        # Rate limiter
        rate_limit = self.config.get_setting("rate_limit_per_minute", 60)
        self.rate_limiter = RateLimiter(max_calls=rate_limit, period=60)

    async def run_all(self) -> list[IngestionResult]:
        """
        Run ingestion for all enabled feeds.

        Returns:
            List of ingestion results
        """
        results = []
        all_feeds = self.config.get_all_enabled_feeds()

        for feed_type, feeds in all_feeds.items():
            for feed_config in feeds:
                try:
                    result = await self.run_feed(feed_type, feed_config)
                    results.append(result)
                except Exception as e:
                    print(f"Error running feed {feed_type}/{feed_config.get('name')}: {e}")
                    results.append(
                        IngestionResult(
                            feed_name=f"{feed_type}:{feed_config.get('name', 'unknown')}",
                            success=False,
                            posts_fetched=0,
                            posts_scored=0,
                            incidents_created=0,
                            errors=[str(e)],
                            duration_seconds=0.0,
                            timestamp=datetime.now(timezone.utc),
                        )
                    )

        return results

    async def run_feed(
        self, feed_type: str, feed_config: dict[str, Any]
    ) -> IngestionResult:
        """
        Run ingestion for a single feed.

        Args:
            feed_type: Type of feed (rss, reddit, web)
            feed_config: Feed configuration

        Returns:
            Ingestion result
        """
        start_time = time.time()
        feed_name = f"{feed_type}:{feed_config.get('name', feed_config.get('subreddit', 'unknown'))}"
        errors = []

        try:
            # Get parser
            parser = self.parsers.get(feed_type)
            if not parser:
                raise ValueError(f"Unknown feed type: {feed_type}")

            # Rate limit
            await self.rate_limiter.acquire()

            # Fetch posts
            posts = await parser.fetch(feed_config)
            posts_fetched = len(posts)

            # Score and process posts
            posts_scored = 0
            incidents_created = 0

            for post in posts:
                try:
                    # Rate limit
                    await self.rate_limiter.acquire()

                    # Score post
                    scored, incident_created = await self._process_post(post)
                    if scored:
                        posts_scored += 1
                    if incident_created:
                        incidents_created += 1

                except Exception as e:
                    errors.append(f"Error processing post {post.url}: {e}")

            duration = time.time() - start_time

            return IngestionResult(
                feed_name=feed_name,
                success=True,
                posts_fetched=posts_fetched,
                posts_scored=posts_scored,
                incidents_created=incidents_created,
                errors=errors,
                duration_seconds=duration,
                timestamp=datetime.now(timezone.utc),
            )

        except Exception as e:
            duration = time.time() - start_time
            errors.append(str(e))

            return IngestionResult(
                feed_name=feed_name,
                success=False,
                posts_fetched=0,
                posts_scored=0,
                incidents_created=0,
                errors=errors,
                duration_seconds=duration,
                timestamp=datetime.now(timezone.utc),
            )

    async def _process_post(self, post: NormalizedPost) -> tuple[bool, bool]:
        """
        Process a single post: score and create incident if needed.

        Args:
            post: Normalized post to process

        Returns:
            Tuple of (scored, incident_created)
        """
        try:
            # Combine title and text for scoring
            content = f"{post.title}\n\n{post.text}"

            # Score with NLP
            classification = score_text(content)

            # Calculate risk score
            risk_result = self.risk_scorer.calculate_risk_score(
                text=content,
                threat_prob=classification["threat_prob"],
                hate_prob=classification["hate_prob"],
                risk_factors=classification["risk_factors"],
                timestamp=post.published_at,
            )

            # Check threshold
            threshold = self.config.get_setting("risk_threshold", 50.0)

            if risk_result["risk_score"] >= threshold:
                # Create incident
                if self.db:
                    self._create_incident(post, classification, risk_result)
                    return True, True
                else:
                    print(
                        f"High risk content detected but no DB session: "
                        f"{post.source} - {post.title} - Risk: {risk_result['risk_score']}"
                    )
                    return True, False

            return True, False

        except Exception as e:
            print(f"Error processing post {post.url}: {e}")
            return False, False

    def _create_incident(
        self,
        post: NormalizedPost,
        classification: dict[str, Any],
        risk_result: dict[str, Any],
    ) -> Incident:
        """
        Create an incident from a high-risk post.

        Args:
            post: Normalized post
            classification: Classification results
            risk_result: Risk scoring results

        Returns:
            Created incident
        """
        if not self.db:
            raise ValueError("No database session provided")

        # Map risk level to severity
        severity_map = {
            "LOW": "low",
            "MEDIUM": "medium",
            "HIGH": "high",
            "CRITICAL": "critical",
        }

        severity = severity_map.get(risk_result["risk_level"], "medium")

        # Create incident
        incident = Incident(
            title=f"Threat detected: {post.title[:100]}",
            description=self._build_incident_description(post, classification, risk_result),
            severity=severity,
            status="new",
            source=post.source,
            location=None,  # Could be extracted from metadata
            reported_by=None,  # System-generated
            assigned_to=None,
            metadata={
                "post_url": post.url,
                "post_author": post.author,
                "post_published_at": post.published_at.isoformat(),
                "threat_prob": classification["threat_prob"],
                "hate_prob": classification["hate_prob"],
                "risk_score": risk_result["risk_score"],
                "risk_level": risk_result["risk_level"],
                "risk_factors": classification["risk_factors"],
                "risk_breakdown": risk_result["breakdown"],
            },
        )

        self.db.add(incident)
        self.db.commit()
        self.db.refresh(incident)

        return incident

    def _build_incident_description(
        self,
        post: NormalizedPost,
        classification: dict[str, Any],
        risk_result: dict[str, Any],
    ) -> str:
        """Build incident description from post and analysis."""
        description = f"""**Source:** {post.source}
**URL:** {post.url}
**Published:** {post.published_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
**Author:** {post.author or 'Unknown'}

**Risk Assessment:**
- Risk Score: {risk_result['risk_score']:.1f}/100
- Risk Level: {risk_result['risk_level']}
- Threat Probability: {classification['threat_prob']:.2%}
- Hate Speech Probability: {classification['hate_prob']:.2%}

**Risk Factors:**
{chr(10).join('- ' + factor for factor in classification['risk_factors'])}

**Content:**
{post.title}

{post.text[:1000]}{'...' if len(post.text) > 1000 else ''}
"""
        return description

