"""CLI entry point for ingestion module.

Usage:
    python -m ingestion.run_once          # Run all feeds once
    python -m ingestion.run_once --type rss --name bbc_world  # Run specific feed
    python -m ingestion.worker            # Start worker
"""

import argparse
import asyncio
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from ingestion.config import IngestionConfig
from ingestion.manager import FeedManager


def run_once(feed_type: str | None = None, feed_name: str | None = None) -> None:
    """Run ingestion once and exit."""
    # Create database session
    engine = create_engine(str(settings.DATABASE_URL))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        config = IngestionConfig()
        manager = FeedManager(config=config, db=db)

        print("Starting ingestion run...")

        if feed_type and feed_name:
            # Run specific feed
            feeds = config.get_feeds(feed_type)
            feed_config = next(
                (f for f in feeds if f.get("name") == feed_name or f.get("subreddit") == feed_name),
                None,
            )
            if not feed_config:
                print(f"Error: Feed {feed_type}/{feed_name} not found")
                sys.exit(1)

            result = asyncio.run(manager.run_feed(feed_type, feed_config))
            results = [result]
        else:
            # Run all feeds
            results = asyncio.run(manager.run_all())

        # Print results
        print("\nIngestion Results:")
        print("=" * 80)

        total_fetched = 0
        total_scored = 0
        total_incidents = 0

        for result in results:
            status = "✓" if result.success else "✗"
            print(f"\n{status} {result.feed_name}")
            print(f"  Posts fetched: {result.posts_fetched}")
            print(f"  Posts scored: {result.posts_scored}")
            print(f"  Incidents created: {result.incidents_created}")
            print(f"  Duration: {result.duration_seconds:.2f}s")

            if result.errors:
                print(f"  Errors: {len(result.errors)}")
                for error in result.errors[:3]:  # Show first 3 errors
                    print(f"    - {error}")

            total_fetched += result.posts_fetched
            total_scored += result.posts_scored
            total_incidents += result.incidents_created

        print("\n" + "=" * 80)
        print(f"Total: {len(results)} feeds processed")
        print(f"  Posts fetched: {total_fetched}")
        print(f"  Posts scored: {total_scored}")
        print(f"  Incidents created: {total_incidents}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    finally:
        db.close()


def start_worker() -> None:
    """Start RQ worker."""
    from ingestion.worker import start_worker as _start_worker

    print("Starting ingestion worker...")
    print("Listening on queue: ingestion")
    print("Press Ctrl+C to exit")

    _start_worker()


def main() -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="Shomer ingestion CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # run_once command
    run_parser = subparsers.add_parser("run_once", help="Run ingestion once")
    run_parser.add_argument("--type", help="Feed type (rss, reddit, web)")
    run_parser.add_argument("--name", help="Feed name")

    # worker command
    subparsers.add_parser("worker", help="Start RQ worker")

    args = parser.parse_args()

    if args.command == "run_once":
        run_once(feed_type=args.type, feed_name=args.name)
    elif args.command == "worker":
        start_worker()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

