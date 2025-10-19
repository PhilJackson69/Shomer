"""API dependencies."""
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.base import get_db
from app.models.user import User, UserRole

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get current authenticated user."""
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


def require_role(required_role: UserRole) -> Callable[[User], User]:
    """Dependency factory to require a specific role."""

    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        role_hierarchy = {
            UserRole.VIEWER: 0,
            UserRole.MODERATOR: 1,
            UserRole.ADMIN: 2,
        }

        user_role_level = role_hierarchy.get(UserRole(current_user.role), -1)
        required_role_level = role_hierarchy.get(required_role, 999)

        if user_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return role_checker


def require_mfa_for_admin(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """Require MFA for admin users with staged rollout controls."""
    from app.core.config import settings
    from app.services.mfa_service import MFAService
    from app.flags.mfa import get_mfa_flags
    from app.core.metrics import record_mfa_enforcement_decision
    
    # Get rollout flags
    mfa_flags = get_mfa_flags()
    
    # Check if MFA should be enforced for this user
    should_enforce, reason = mfa_flags.should_enforce_mfa(
        current_user.id, 
        current_user.role, 
        db
    )
    
    # Get metrics labels for observability
    metrics_labels = mfa_flags.get_metrics_labels(
        current_user.id, 
        current_user.role, 
        db
    )
    
    # Record enforcement decision for metrics
    record_mfa_enforcement_decision(should_enforce, reason, metrics_labels)
    
    # Log enforcement decision (redacted for security)
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f"MFA enforcement check: user_id={current_user.id}, "
        f"role={current_user.role}, mode={mfa_flags.mode.value}, "
        f"enforced={should_enforce}, reason={reason}"
    )
    
    if should_enforce:
        # Check if user has MFA enabled
        mfa_service = MFAService(db)
        mfa_status = mfa_service.get_mfa_status(current_user)
        
        if not mfa_status.enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "MFA_REQUIRED",
                    "message": "Multi-factor authentication is required for admin accounts",
                    "redirect": "/dashboard/settings/security",
                    "rollout_mode": mfa_flags.mode.value,
                    "reason": reason
                }
            )
    
    return current_user
