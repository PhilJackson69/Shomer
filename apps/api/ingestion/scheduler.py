"""Scheduled ingestion jobs."""

import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ingestion.config import IngestionConfig
from ingestion.cron_scheduler import CronScheduler
from ingestion.worker import enqueue_ingestion


class IngestionScheduler:
    """Scheduler for periodic ingestion runs."""

    def __init__(self, interval_minutes: int = 5, use_cron: bool = False, config: IngestionConfig | None = None):
        """
        Initialize scheduler.

        Args:
            interval_minutes: Interval between ingestion runs
            use_cron: Whether to use cron-based scheduling
            config: Ingestion configuration
        """
        self.interval_minutes = interval_minutes
        self.use_cron = use_cron or os.getenv("USE_CRON_SCHEDULER", "false").lower() == "true"
        self.config = config or IngestionConfig()
        
        if self.use_cron:
            self.cron_scheduler = CronScheduler(self.config)
            self.scheduler = None
        else:
            self.scheduler = BackgroundScheduler()
            self.cron_scheduler = None

    def start(self) -> None:
        """Start the scheduler."""
        if self.use_cron:
            # Use cron-based scheduling
            import asyncio
            asyncio.create_task(self.cron_scheduler.start())
            print("Cron-based ingestion scheduler started")
        else:
            # Use interval-based scheduling
            self.scheduler.add_job(
                enqueue_ingestion,
                trigger=IntervalTrigger(minutes=self.interval_minutes),
                id="ingestion_periodic",
                name="Periodic ingestion run",
                replace_existing=True,
            )

            self.scheduler.start()
            print(f"Ingestion scheduler started (interval: {self.interval_minutes} minutes)")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.use_cron and self.cron_scheduler:
            import asyncio
            asyncio.create_task(self.cron_scheduler.stop())
            print("Cron scheduler stopped")
        elif self.scheduler:
            self.scheduler.shutdown()
            print("Ingestion scheduler stopped")

    def run_now(self) -> None:
        """Trigger immediate ingestion run."""
        enqueue_ingestion()


# Global scheduler instance
_scheduler_instance: IngestionScheduler | None = None


def get_scheduler(interval_minutes: int = 5) -> IngestionScheduler:
    """Get or create global scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = IngestionScheduler(interval_minutes=interval_minutes)
    return _scheduler_instance


def start_scheduler(interval_minutes: int = 5) -> None:
    """Start global scheduler."""
    scheduler = get_scheduler(interval_minutes=interval_minutes)
    scheduler.start()


def stop_scheduler() -> None:
    """Stop global scheduler."""
    global _scheduler_instance
    if _scheduler_instance:
        _scheduler_instance.stop()
        _scheduler_instance = None

