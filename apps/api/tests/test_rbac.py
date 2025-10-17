"""Tests for RBAC system."""

import pytest

from app.core.rbac import Permission, has_permission
from app.models.user import User


class TestRBAC:
    """Test role-based access control."""

    def test_admin_has_all_permissions(self):
        """Test that admin role has all permissions."""
        admin = User(id=1, email="admin@test.com", role="admin")
        
        # Admin should have all permissions
        assert has_permission(admin, Permission.TIP_CREATE)
        assert has_permission(admin, Permission.INCIDENT_UPDATE)
        assert has_permission(admin, Permission.ALERT_SEND)
        assert has_permission(admin, Permission.ADMIN_AUDIT)
        assert has_permission(admin, Permission.SYSTEM_ALL)

    def test_moderator_permissions(self):
        """Test moderator role permissions."""
        moderator = User(id=2, email="mod@test.com", role="moderator")
        
        # Moderator should have these permissions
        assert has_permission(moderator, Permission.TIP_CREATE)
        assert has_permission(moderator, Permission.TIP_UPDATE)
        assert has_permission(moderator, Permission.INCIDENT_CREATE)
        assert has_permission(moderator, Permission.ALERT_SEND)
        
        # Moderator should NOT have admin permissions
        assert not has_permission(moderator, Permission.ADMIN_AUDIT)
        assert not has_permission(moderator, Permission.ADMIN_SETTINGS)

    def test_user_permissions(self):
        """Test regular user permissions."""
        user = User(id=3, email="user@test.com", role="user")
        
        # User should have these permissions
        assert has_permission(user, Permission.TIP_CREATE)
        assert has_permission(user, Permission.TIP_READ)
        assert has_permission(user, Permission.INCIDENT_READ)
        
        # User should NOT have these permissions
        assert not has_permission(user, Permission.TIP_UPDATE)
        assert not has_permission(user, Permission.INCIDENT_CREATE)
        assert not has_permission(user, Permission.ALERT_SEND)
        assert not has_permission(user, Permission.ADMIN_AUDIT)

    def test_no_user_no_permission(self):
        """Test that None user has no permissions."""
        assert not has_permission(None, Permission.TIP_READ)
        assert not has_permission(None, Permission.SYSTEM_ALL)

    def test_unknown_role_no_permissions(self):
        """Test that unknown role has no permissions."""
        unknown = User(id=4, email="unknown@test.com", role="unknown_role")
        
        assert not has_permission(unknown, Permission.TIP_CREATE)
        assert not has_permission(unknown, Permission.INCIDENT_READ)

