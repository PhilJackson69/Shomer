"""Application startup handlers."""

import os

from ingestion.scheduler import start_scheduler


def startup_ingestion_scheduler() -> None:
    """Start ingestion scheduler if enabled."""
    # Only start in main process (not in worker processes)
    if os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true":
        interval_minutes = int(os.environ.get("INGESTION_INTERVAL_MINUTES", "5"))
        start_scheduler(interval_minutes=interval_minutes)

