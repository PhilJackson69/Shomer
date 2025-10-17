"""RQ worker tasks for ingestion."""

import asyncio
from typing import Any

from redis import Redis
from rq import Queue, Worker
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.audit_log import AuditLog
from ingestion.config import IngestionConfig
from ingestion.manager import FeedManager
from ingestion.models import IngestionResult


# Redis connection
redis_conn = Redis.from_url(str(settings.REDIS_URL))

# RQ queue
ingestion_queue = Queue("ingestion", connection=redis_conn)


def run_ingestion_task(feed_type: str | None = None, feed_name: str | None = None) -> dict[str, Any]:
    """
    RQ task to run ingestion.

    Args:
        feed_type: Optional feed type to run (rss, reddit, web). If None, runs all.
        feed_name: Optional specific feed name to run. Requires feed_type.

    Returns:
        Summary of ingestion results
    """
    # Create database session
    engine = create_engine(str(settings.DATABASE_URL))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        config = IngestionConfig()
        manager = FeedManager(config=config, db=db)

        # Run ingestion
        if feed_type and feed_name:
            # Run specific feed
            feeds = config.get_feeds(feed_type)
            feed_config = next(
                (f for f in feeds if f.get("name") == feed_name or f.get("subreddit") == feed_name),
                None,
            )
            if not feed_config:
                raise ValueError(f"Feed {feed_type}/{feed_name} not found")

            results = [asyncio.run(manager.run_feed(feed_type, feed_config))]
        else:
            # Run all feeds
            results = asyncio.run(manager.run_all())

        # Log results
        _log_ingestion_results(db, results)

        # Prepare summary
        summary = {
            "success": True,
            "feeds_processed": len(results),
            "total_posts_fetched": sum(r.posts_fetched for r in results),
            "total_posts_scored": sum(r.posts_scored for r in results),
            "total_incidents_created": sum(r.incidents_created for r in results),
            "results": [
                {
                    "feed_name": r.feed_name,
                    "success": r.success,
                    "posts_fetched": r.posts_fetched,
                    "posts_scored": r.posts_scored,
                    "incidents_created": r.incidents_created,
                    "errors": r.errors,
                    "duration_seconds": r.duration_seconds,
                }
                for r in results
            ],
        }

        return summary

    except Exception as e:
        # Log error
        if db:
            _log_error(db, str(e))

        return {
            "success": False,
            "error": str(e),
        }

    finally:
        db.close()


def _log_ingestion_results(db: Session, results: list[IngestionResult]) -> None:
    """Log ingestion results to audit log."""
    for result in results:
        audit_log = AuditLog(
            action="ingestion_run",
            user_id=None,  # System action
            resource_type="feed",
            resource_id=result.feed_name,
            details={
                "success": result.success,
                "posts_fetched": result.posts_fetched,
                "posts_scored": result.posts_scored,
                "incidents_created": result.incidents_created,
                "errors": result.errors,
                "duration_seconds": result.duration_seconds,
            },
        )
        db.add(audit_log)

    db.commit()


def _log_error(db: Session, error: str) -> None:
    """Log ingestion error to audit log."""
    audit_log = AuditLog(
        action="ingestion_error",
        user_id=None,
        resource_type="ingestion",
        resource_id="system",
        details={"error": error},
    )
    db.add(audit_log)
    db.commit()


def enqueue_ingestion(feed_type: str | None = None, feed_name: str | None = None) -> Any:
    """
    Enqueue an ingestion task.

    Args:
        feed_type: Optional feed type
        feed_name: Optional feed name

    Returns:
        RQ job
    """
    return ingestion_queue.enqueue(
        run_ingestion_task,
        feed_type=feed_type,
        feed_name=feed_name,
        job_timeout=300,  # 5 minutes
    )


def start_worker() -> None:
    """Start RQ worker for ingestion queue."""
    worker = Worker([ingestion_queue], connection=redis_conn)
    worker.work()

