"""Application scheduler for background tasks."""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.retention import run_retention_job


class AppScheduler:
    """Application scheduler for periodic tasks."""

    def __init__(self):
        """Initialize scheduler."""
        self.scheduler = BackgroundScheduler()

    def start(self) -> None:
        """Start the scheduler with all jobs."""
        # Retention job - runs daily at 2 AM
        self.scheduler.add_job(
            run_retention_job,
            trigger=CronTrigger(hour=2, minute=0),
            id='retention_job',
            name='Data Retention Cleanup',
            replace_existing=True,
        )
        
        # Could add more scheduled jobs here
        # Example: Health check every hour
        # self.scheduler.add_job(
        #     check_system_health,
        #     trigger=IntervalTrigger(hours=1),
        #     id='health_check',
        #     name='System Health Check',
        # )
        
        self.scheduler.start()
        print("Application scheduler started")
        print("Scheduled jobs:")
        for job in self.scheduler.get_jobs():
            print(f"  - {job.name} ({job.id})")

    def stop(self) -> None:
        """Stop the scheduler."""
        self.scheduler.shutdown()
        print("Application scheduler stopped")

    def run_job_now(self, job_id: str) -> None:
        """Run a specific job immediately."""
        job = self.scheduler.get_job(job_id)
        if job:
            job.modify(next_run_time=None)  # Run now
        else:
            raise ValueError(f"Job {job_id} not found")


# Global scheduler instance
_scheduler_instance: AppScheduler | None = None


def get_scheduler() -> AppScheduler:
    """Get or create global scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = AppScheduler()
    return _scheduler_instance


def start_scheduler() -> None:
    """Start global scheduler."""
    scheduler = get_scheduler()
    scheduler.start()


def stop_scheduler() -> None:
    """Stop global scheduler."""
    global _scheduler_instance
    if _scheduler_instance:
        _scheduler_instance.stop()
        _scheduler_instance = None
