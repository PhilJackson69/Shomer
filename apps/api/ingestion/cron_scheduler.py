"""Cron-based scheduler for ingestion jobs."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from croniter import croniter
from sqlalchemy.orm import Session

from app.db.base import get_db
from ingestion.config import IngestionConfig
from ingestion.manager import FeedManager
from ingestion.worker import run_ingestion_task

logger = logging.getLogger(__name__)


class CronScheduler:
    """Cron-based scheduler for running ingestion jobs at specified intervals."""
    
    def __init__(self, config: IngestionConfig | None = None):
        """Initialize cron scheduler."""
        self.config = config or IngestionConfig()
        self.running = False
        self.tasks = []
        
        # Default cron expressions
        self.cron_jobs = {
            "hourly_ingestion": "0 * * * *",  # Every hour at minute 0
            "daily_cleanup": "0 2 * * *",     # Daily at 2 AM
            "weekly_report": "0 9 * * 1",     # Weekly on Monday at 9 AM
        }
        
        # Load custom cron jobs from config
        self._load_cron_jobs()
    
    def _load_cron_jobs(self):
        """Load cron job configurations from config."""
        try:
            cron_config = self.config.get_setting("cron_jobs", {})
            if isinstance(cron_config, dict):
                self.cron_jobs.update(cron_config)
        except Exception as e:
            logger.warning(f"Failed to load cron jobs from config: {e}")
    
    async def start(self):
        """Start the cron scheduler."""
        if self.running:
            logger.warning("Cron scheduler is already running")
            return
        
        self.running = True
        logger.info("Starting cron scheduler")
        
        # Start each cron job
        for job_name, cron_expr in self.cron_jobs.items():
            task = asyncio.create_task(self._run_cron_job(job_name, cron_expr))
            self.tasks.append(task)
        
        logger.info(f"Started {len(self.tasks)} cron jobs")
    
    async def stop(self):
        """Stop the cron scheduler."""
        if not self.running:
            return
        
        logger.info("Stopping cron scheduler")
        self.running = False
        
        # Cancel all tasks
        for task in self.tasks:
            task.cancel()
        
        # Wait for tasks to complete
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        self.tasks.clear()
        logger.info("Cron scheduler stopped")
    
    async def _run_cron_job(self, job_name: str, cron_expr: str):
        """Run a single cron job."""
        logger.info(f"Starting cron job: {job_name} (schedule: {cron_expr})")
        
        try:
            # Create cron iterator
            cron = croniter(cron_expr, datetime.now(timezone.utc))
            
            while self.running:
                # Calculate next run time
                next_run = cron.get_next(datetime)
                now = datetime.now(timezone.utc)
                
                # Calculate sleep duration
                sleep_duration = (next_run - now).total_seconds()
                
                if sleep_duration > 0:
                    logger.debug(f"Job {job_name} sleeping for {sleep_duration:.0f} seconds until {next_run}")
                    await asyncio.sleep(sleep_duration)
                
                if not self.running:
                    break
                
                # Run the job
                logger.info(f"Running cron job: {job_name}")
                await self._execute_job(job_name)
                
        except Exception as e:
            logger.error(f"Error in cron job {job_name}: {e}")
    
    async def _execute_job(self, job_name: str):
        """Execute a specific job by name."""
        try:
            if job_name == "hourly_ingestion":
                await self._run_ingestion()
            elif job_name == "daily_cleanup":
                await self._run_cleanup()
            elif job_name == "weekly_report":
                await self._run_weekly_report()
            else:
                logger.warning(f"Unknown cron job: {job_name}")
                
        except Exception as e:
            logger.error(f"Failed to execute job {job_name}: {e}")
    
    async def _run_ingestion(self):
        """Run the main ingestion process."""
        logger.info("Running scheduled ingestion")
        
        try:
            # Run ingestion task
            result = await asyncio.get_event_loop().run_in_executor(
                None, run_ingestion_task
            )
            
            logger.info(f"Ingestion completed: {result}")
            
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
    
    async def _run_cleanup(self):
        """Run daily cleanup tasks."""
        logger.info("Running daily cleanup")
        
        # Example cleanup tasks:
        # - Remove old audit logs
        # - Clean up temporary files
        # - Optimize database
        
        try:
            # Get database session
            db = next(get_db())
            
            # Example: Remove audit logs older than 90 days
            from app.models.audit_log import AuditLog
            from datetime import timedelta
            
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
            deleted_count = db.query(AuditLog).filter(
                AuditLog.timestamp < cutoff_date
            ).delete()
            
            db.commit()
            logger.info(f"Cleaned up {deleted_count} old audit logs")
            
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
    
    async def _run_weekly_report(self):
        """Generate weekly reports."""
        logger.info("Generating weekly report")
        
        try:
            # Example weekly report generation
            # - Statistics on incidents
            # - Feed performance
            # - System health
            
            logger.info("Weekly report generation completed")
            
        except Exception as e:
            logger.error(f"Weekly report failed: {e}")
    
    def add_job(self, name: str, cron_expr: str):
        """Add a new cron job."""
        if not self.running:
            self.cron_jobs[name] = cron_expr
            logger.info(f"Added cron job: {name} ({cron_expr})")
        else:
            logger.warning("Cannot add jobs while scheduler is running")
    
    def remove_job(self, name: str):
        """Remove a cron job."""
        if name in self.cron_jobs:
            del self.cron_jobs[name]
            logger.info(f"Removed cron job: {name}")
        else:
            logger.warning(f"Cron job not found: {name}")


# Example usage:
"""
# Start cron scheduler
scheduler = CronScheduler()
await scheduler.start()

# Add custom job
scheduler.add_job("custom_ingestion", "*/30 * * * *")  # Every 30 minutes

# Stop scheduler
await scheduler.stop()
"""
