"""Audit log endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.base import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse

router = APIRouter()


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
    skip: int = 0,
    limit: int = 100,
) -> list[AuditLogResponse]:
    """List audit logs (requires moderator role)."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/user/{user_id}", response_model=list[AuditLogResponse])
def get_user_audit_logs(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
    skip: int = 0,
    limit: int = 100,
) -> list[AuditLogResponse]:
    """Get audit logs for a specific user (requires moderator role)."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [AuditLogResponse.model_validate(log) for log in logs]

