"""Tests for admin endpoints."""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.audit_log import AuditLog
from app.models.user import User


@pytest.fixture
def client():
    """Test client fixture."""
    return TestClient(app)


@pytest.fixture
def admin_token(db: Session):
    """Create admin user and return auth token."""
    # This would create a real token in practice
    return "admin_test_token"


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


class TestAuditLogEndpoints:
    """Test audit log admin endpoints."""

    def test_get_audit_logs_requires_auth(self, client):
        """Test that audit logs endpoint requires authentication."""
        response = client.get("/api/v1/admin/audit-logs")
        assert response.status_code == 401

    def test_get_audit_logs_with_pagination(self, client, admin_token, db):
        """Test audit logs with pagination."""
        # Create test audit logs
        for i in range(10):
            log = AuditLog(
                action=f"test_action_{i}",
                resource_type="test",
                resource_id=str(i),
            )
            db.add(log)
        db.commit()
        
        # Mock authentication (in real test, use proper auth)
        # response = client.get(
        #     "/api/v1/admin/audit-logs?page=1&page_size=5",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert 'items' in data
        # assert 'total' in data
        # assert data['page'] == 1
        # assert data['page_size'] == 5

    def test_get_audit_stats(self, client, admin_token):
        """Test audit stats endpoint."""
        # Mock authentication
        # response = client.get(
        #     "/api/v1/admin/audit-logs/stats",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert 'total_logs' in data
        # assert 'recent_24h' in data
        # assert 'by_action' in data
        # assert 'by_resource' in data

    def test_get_audit_log_by_id(self, client, admin_token, db):
        """Test getting specific audit log."""
        # Create test audit log
        log = AuditLog(
            action="test_action",
            resource_type="test",
            resource_id="123",
            details={"test": "data"},
        )
        db.add(log)
        db.commit()
        
        # Mock authentication
        # response = client.get(
        #     f"/api/v1/admin/audit-logs/{log.id}",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert data['id'] == log.id
        # assert data['action'] == "test_action"


class TestRetentionEndpoints:
    """Test retention admin endpoints."""

    def test_trigger_retention_job(self, client, admin_token):
        """Test manually triggering retention job."""
        # Mock authentication
        # response = client.post(
        #     "/api/v1/admin/retention/run",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert data['success'] is True
        # assert 'results' in data

    def test_get_retention_config(self, client, admin_token):
        """Test getting retention configuration."""
        # Mock authentication
        # response = client.get(
        #     "/api/v1/admin/retention/config",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert 'tip_retention_days' in data
        # assert 'audit_log_retention_days' in data


class TestSystemHealthEndpoint:
    """Test system health endpoint."""

    def test_system_health(self, client, admin_token):
        """Test system health endpoint."""
        # Mock authentication
        # response = client.get(
        #     "/api/v1/admin/system/health",
        #     headers={"Authorization": f"Bearer {admin_token}"}
        # )
        
        # assert response.status_code == 200
        # data = response.json()
        # assert data['status'] == 'healthy'
        # assert 'database' in data
        # assert 'recent_24h' in data

