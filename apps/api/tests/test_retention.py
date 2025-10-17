"""Tests for data retention system."""

from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.core.retention import RetentionConfig, RetentionWorker
from app.models.audit_log import AuditLog
from app.models.tip import Tip


class TestRetentionWorker:
    """Test retention worker functionality."""

    def test_purge_old_tips(self, db: Session):
        """Test that old tips are purged correctly."""
        # Create an old tip (older than retention period)
        old_date = datetime.utcnow() - timedelta(days=20)
        old_tip = Tip(
            content="Old tip content",
            status="new",
            created_at=old_date,
        )
        db.add(old_tip)
        
        # Create a recent tip (within retention period)
        recent_tip = Tip(
            content="Recent tip content",
            status="new",
            created_at=datetime.utcnow(),
        )
        db.add(recent_tip)
        
        # Create an old escalated tip (should be exempt)
        escalated_tip = Tip(
            content="Escalated tip content",
            status="escalated",
            created_at=old_date,
        )
        db.add(escalated_tip)
        
        db.commit()
        
        # Run retention worker
        worker = RetentionWorker(db)
        result = worker.purge_old_tips()
        
        # Verify results
        assert result['tips_purged'] == 1  # Only old_tip should be purged
        
        # Refresh tips
        db.refresh(old_tip)
        db.refresh(recent_tip)
        db.refresh(escalated_tip)
        
        # Check old tip was redacted
        assert old_tip.content == "[REDACTED - Retention policy applied]"
        assert old_tip.contact_info is None
        assert old_tip.metadata.get('purged') is True
        
        # Check recent tip unchanged
        assert recent_tip.content == "Recent tip content"
        
        # Check escalated tip unchanged
        assert escalated_tip.content == "Escalated tip content"

    def test_purge_old_audit_logs(self, db: Session):
        """Test that old audit logs are purged correctly."""
        # Create old audit log
        old_date = datetime.utcnow() - timedelta(days=400)
        old_log = AuditLog(
            action="test_action",
            resource_type="test",
            resource_id="1",
            created_at=old_date,
        )
        db.add(old_log)
        
        # Create recent audit log
        recent_log = AuditLog(
            action="test_action",
            resource_type="test",
            resource_id="2",
            created_at=datetime.utcnow(),
        )
        db.add(recent_log)
        
        db.commit()
        
        # Get initial count
        initial_count = db.query(AuditLog).count()
        
        # Run retention worker
        worker = RetentionWorker(db)
        result = worker.purge_old_audit_logs()
        
        # Verify old log was purged
        assert result['audit_logs_purged'] >= 1
        
        # Check recent log still exists
        assert db.query(AuditLog).filter(AuditLog.id == recent_log.id).first() is not None

    def test_retention_config(self):
        """Test retention configuration."""
        config = RetentionConfig()
        
        assert config.TIP_RETENTION_DAYS == 14
        assert "escalated" in config.TIP_EXEMPT_STATUSES
        assert "under_investigation" in config.TIP_EXEMPT_STATUSES
        assert config.AUDIT_LOG_RETENTION_DAYS == 365

    def test_run_all(self, db: Session):
        """Test running all retention tasks."""
        worker = RetentionWorker(db)
        results = worker.run_all()
        
        # Verify all tasks ran
        assert 'tips' in results
        assert 'audit_logs' in results
        assert 'media' in results
        
        # Check structure
        if 'error' not in results['tips']:
            assert 'tips_purged' in results['tips']
            assert 'cutoff_date' in results['tips']


@pytest.fixture
def db():
    """Mock database session fixture."""
    from app.db.base import SessionLocal
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

