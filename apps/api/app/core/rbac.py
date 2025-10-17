"""Role-based access control (RBAC) enforcement."""

from functools import wraps
from typing import Callable, List

from fastapi import HTTPException, status

from app.models.user import User


class Permission:
    """Permission definitions."""

    # Tip permissions
    TIP_CREATE = 'tip:create'
    TIP_READ = 'tip:read'
    TIP_UPDATE = 'tip:update'
    TIP_DELETE = 'tip:delete'
    
    # Incident permissions
    INCIDENT_CREATE = 'incident:create'
    INCIDENT_READ = 'incident:read'
    INCIDENT_UPDATE = 'incident:update'
    INCIDENT_DELETE = 'incident:delete'
    
    # Alert permissions
    ALERT_CREATE = 'alert:create'
    ALERT_READ = 'alert:read'
    ALERT_SEND = 'alert:send'
    
    # ICE Alert permissions
    ICE_SUBMIT = 'ice_alert:submit'
    ICE_REVIEW = 'ice_alert:review'
    ICE_BROADCAST = 'ice_alert:broadcast'
    ICE_VIEW = 'ice_alert:view'
    ICE_UPDATE = 'ice_alert:update'
    
    # Evidence permissions (feature-flagged)
    EVIDENCE_SUBMIT = 'evidence:submit'
    EVIDENCE_VIEW = 'evidence:view'
    EVIDENCE_VERIFY = 'evidence:verify'
    EVIDENCE_SEAL = 'evidence:seal'
    EVIDENCE_EXPORT = 'evidence:export'
    EVIDENCE_DELETE = 'evidence:delete'
    
    # Admin permissions
    ADMIN_USERS = 'admin:users'
    ADMIN_SETTINGS = 'admin:settings'
    ADMIN_AUDIT = 'admin:audit'
    ADMIN_INGESTION = 'admin:ingestion'
    
    # System permissions
    SYSTEM_ALL = 'system:all'


# Role to permissions mapping
ROLE_PERMISSIONS = {
    'user': [
        Permission.TIP_CREATE,
        Permission.TIP_READ,
        Permission.INCIDENT_READ,
        Permission.ICE_VIEW,  # Can view public ICE alerts
    ],
    'verified_partner': [
        # Verified partners can submit ICE alerts
        Permission.TIP_CREATE,
        Permission.TIP_READ,
        Permission.INCIDENT_READ,
        Permission.ICE_SUBMIT,
        Permission.ICE_VIEW,
    ],
    'moderator': [
        Permission.TIP_CREATE,
        Permission.TIP_READ,
        Permission.TIP_UPDATE,
        Permission.INCIDENT_CREATE,
        Permission.INCIDENT_READ,
        Permission.INCIDENT_UPDATE,
        Permission.ALERT_CREATE,
        Permission.ALERT_READ,
        Permission.ALERT_SEND,
        Permission.EVIDENCE_SUBMIT,
        Permission.EVIDENCE_VIEW,
        Permission.EVIDENCE_VERIFY,
        # ICE Alert moderation permissions
        Permission.ICE_SUBMIT,
        Permission.ICE_REVIEW,
        Permission.ICE_BROADCAST,
        Permission.ICE_VIEW,
        Permission.ICE_UPDATE,
    ],
    'admin': [
        Permission.SYSTEM_ALL,  # Admin has all permissions
    ],
}


def has_permission(user: User, permission: str) -> bool:
    """
    Check if user has a specific permission.
    
    Args:
        user: User object
        permission: Permission string
        
    Returns:
        True if user has permission
    """
    if not user:
        return False
    
    # Admin has all permissions
    if user.role == 'admin':
        return True
    
    # Check role permissions
    permissions = ROLE_PERMISSIONS.get(user.role, [])
    return permission in permissions or Permission.SYSTEM_ALL in permissions


def require_permission(permission: str):
    """
    Decorator to require specific permission for endpoint.
    
    Usage:
        @require_permission(Permission.INCIDENT_UPDATE)
        def update_incident(...)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, current_user: User = None, **kwargs):
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='Authentication required',
                )
            
            if not has_permission(current_user, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f'Permission denied: {permission}',
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        
        return wrapper
    return decorator


def require_role(required_role: str | List[str]):
    """
    Decorator to require specific role(s) for endpoint.
    
    Usage:
        @require_role('admin')
        def admin_function(...)
        
        @require_role(['admin', 'moderator'])
        def moderator_function(...)
    """
    if isinstance(required_role, str):
        required_roles = [required_role]
    else:
        required_roles = required_role
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, current_user: User = None, **kwargs):
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='Authentication required',
                )
            
            if current_user.role not in required_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f'Role required: {", ".join(required_roles)}',
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        
        return wrapper
    return decorator


class RBACMiddleware:
    """Middleware to enforce RBAC on all endpoints."""

    # Public endpoints (no auth required)
    PUBLIC_PATHS = [
        '/health',
        '/api/v1/auth/login',
        '/api/v1/tips',  # Public tip submission
        '/api/v1/ice-alerts/feed',  # Public ICE alert feed
        '/api/v1/ice-alerts/nearby',  # Public nearby alerts
        '/ice-guide',  # Public ICE alert guide
        '/docs',
        '/redoc',
        '/openapi.json',
    ]
    
    # Read-only endpoints accessible to all authenticated users
    READ_ONLY_PATHS = [
        '/api/v1/incidents',
        '/api/v1/events',
    ]
    
    @classmethod
    def is_public_path(cls, path: str) -> bool:
        """Check if path is public."""
        return any(path.startswith(public) for public in cls.PUBLIC_PATHS)
    
    @classmethod
    def is_read_only_path(cls, path: str, method: str) -> bool:
        """Check if path is read-only."""
        if method not in ['GET', 'HEAD', 'OPTIONS']:
            return False
        return any(path.startswith(readonly) for readonly in cls.READ_ONLY_PATHS)

