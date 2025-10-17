"""Data retention and cleanup workers."""

from datetime import datetime, timedelta

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import SessionLocal
from app.models.audit_log import AuditLog
from app.models.tip import Tip


class RetentionConfig:
    """Configuration for data retention policies."""

    # Tip retention (days)
    TIP_RETENTION_DAYS = 14  # Configurable via env
    
    # Statuses exempt from purging
    TIP_EXEMPT_STATUSES = ["escalated", "under_investigation"]
    
    # Audit log retention (days)
    AUDIT_LOG_RETENTION_DAYS = 365  # 1 year
    
    # Media retention (days)
    MEDIA_RETENTION_DAYS = 30
    
    @classmethod
    def get_tip_retention_days(cls) -> int:
        """Get tip retention days from config or env."""
        return int(getattr(settings, 'TIP_RETENTION_DAYS', cls.TIP_RETENTION_DAYS))


class RetentionWorker:
    """Worker for data retention and cleanup tasks."""

    def __init__(self, db: Session):
        """Initialize retention worker."""
        self.db = db
        self.config = RetentionConfig()

    def purge_old_tips(self) -> dict:
        """
        Purge tip content older than retention period.
        
        Keeps tips with exempt statuses (escalated, under_investigation).
        Redacts content but keeps metadata for audit purposes.
        
        Returns:
            Dict with purge statistics
        """
        cutoff_date = datetime.utcnow() - timedelta(
            days=self.config.get_tip_retention_days()
        )
        
        # Find tips eligible for purging
        tips_to_purge = (
            self.db.query(Tip)
            .filter(
                and_(
                    Tip.created_at < cutoff_date,
                    ~Tip.status.in_(self.config.TIP_EXEMPT_STATUSES),
                    Tip.content.isnot(None),  # Only purge if not already purged
                )
            )
            .all()
        )
        
        purged_count = 0
        for tip in tips_to_purge:
            # Store original data for audit
            original_content = tip.content
            original_photo = getattr(tip, 'photo_url', None)
            
            # Redact content
            tip.content = "[REDACTED - Retention policy applied]"
            tip.contact_info = None  # Remove contact info
            
            # Remove photo reference (actual file deletion handled separately)
            if hasattr(tip, 'photo_url'):
                tip.photo_url = None
            
            # Mark as purged
            if not hasattr(tip, 'metadata'):
                tip.metadata = {}
            tip.metadata['purged'] = True
            tip.metadata['purged_at'] = datetime.utcnow().isoformat()
            tip.metadata['purge_reason'] = 'retention_policy'
            
            # Log the purge action
            self._log_purge(tip, original_content, original_photo)
            
            purged_count += 1
        
        self.db.commit()
        
        return {
            'tips_purged': purged_count,
            'cutoff_date': cutoff_date.isoformat(),
            'retention_days': self.config.get_tip_retention_days(),
        }

    def purge_old_audit_logs(self) -> dict:
        """
        Purge old audit logs beyond retention period.
        
        Returns:
            Dict with purge statistics
        """
        cutoff_date = datetime.utcnow() - timedelta(
            days=self.config.AUDIT_LOG_RETENTION_DAYS
        )
        
        # Count logs to be purged
        count = (
            self.db.query(AuditLog)
            .filter(AuditLog.created_at < cutoff_date)
            .count()
        )
        
        # Delete old logs
        self.db.query(AuditLog).filter(
            AuditLog.created_at < cutoff_date
        ).delete()
        
        self.db.commit()
        
        return {
            'audit_logs_purged': count,
            'cutoff_date': cutoff_date.isoformat(),
            'retention_days': self.config.AUDIT_LOG_RETENTION_DAYS,
        }

    def cleanup_orphaned_media(self) -> dict:
        """
        Clean up orphaned media files.
        
        Returns:
            Dict with cleanup statistics
        """
        # This would integrate with your storage system
        # For now, just return a placeholder
        return {
            'media_cleaned': 0,
            'message': 'Media cleanup not yet implemented',
        }

    def run_all(self) -> dict:
        """
        Run all retention tasks.
        
        Returns:
            Combined statistics
        """
        results = {}
        
        try:
            results['tips'] = self.purge_old_tips()
        except Exception as e:
            results['tips'] = {'error': str(e)}
        
        try:
            results['audit_logs'] = self.purge_old_audit_logs()
        except Exception as e:
            results['audit_logs'] = {'error': str(e)}
        
        try:
            results['media'] = self.cleanup_orphaned_media()
        except Exception as e:
            results['media'] = {'error': str(e)}
        
        return results

    def _log_purge(self, tip: Tip, original_content: str, original_photo: str | None) -> None:
        """Log the purge action to audit log."""
        audit_log = AuditLog(
            action='tip_purged',
            user_id=None,  # System action
            resource_type='tip',
            resource_id=str(tip.id),
            details={
                'tip_id': tip.id,
                'original_content_length': len(original_content) if original_content else 0,
                'had_photo': bool(original_photo),
                'status': tip.status,
                'created_at': tip.created_at.isoformat(),
                'purged_at': datetime.utcnow().isoformat(),
                'retention_days': self.config.get_tip_retention_days(),
            },
        )
        self.db.add(audit_log)


def run_retention_job() -> dict:
    """
    Run retention job (called by scheduler).
    
    Returns:
        Results dictionary
    """
    db = SessionLocal()
    try:
        worker = RetentionWorker(db)
        results = worker.run_all()
        
        # Log the retention run
        audit_log = AuditLog(
            action='retention_job_completed',
            user_id=None,
            resource_type='system',
            resource_id='retention_worker',
            details=results,
        )
        db.add(audit_log)
        db.commit()
        
        return results
    finally:
        db.close()

