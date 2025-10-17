"""Admin endpoints for audit logs and system management."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.rbac import Permission, require_permission
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.retention import run_retention_job

router = APIRouter()


@router.get("/audit-logs")
@require_permission(Permission.ADMIN_AUDIT)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: str | None = Query(None, description="Filter by action"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    user_id: int | None = Query(None, description="Filter by user ID"),
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Get audit logs with filters and pagination.
    
    Requires admin role.
    
    Query parameters:
    - page: Page number (1-indexed)
    - page_size: Items per page (max 100)
    - action: Filter by action (e.g., 'incident_created')
    - resource_type: Filter by resource type (e.g., 'incident')
    - user_id: Filter by user ID
    - start_date: Filter logs after this date
    - end_date: Filter logs before this date
    """
    # Build query
    query = db.query(AuditLog)
    
    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    logs = (
        query.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    # Format results
    items = []
    for log in logs:
        item = {
            'id': log.id,
            'action': log.action,
            'user_id': log.user_id,
            'resource_type': log.resource_type,
            'resource_id': log.resource_id,
            'details': log.details,
            'created_at': log.created_at.isoformat(),
        }
        items.append(item)
    
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size,
    }


@router.get("/audit-logs/stats")
@require_permission(Permission.ADMIN_AUDIT)
async def get_audit_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Get audit log statistics.
    
    Requires admin role.
    """
    # Action counts
    action_counts = (
        db.query(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .all()
    )
    
    # Resource type counts
    resource_counts = (
        db.query(AuditLog.resource_type, func.count(AuditLog.id))
        .group_by(AuditLog.resource_type)
        .all()
    )
    
    # User activity
    user_activity = (
        db.query(AuditLog.user_id, func.count(AuditLog.id))
        .filter(AuditLog.user_id.isnot(None))
        .group_by(AuditLog.user_id)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
        .all()
    )
    
    # Total logs
    total_logs = db.query(AuditLog).count()
    
    # Recent activity (last 24 hours)
    from datetime import timedelta
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_count = db.query(AuditLog).filter(
        AuditLog.created_at >= yesterday
    ).count()
    
    return {
        'total_logs': total_logs,
        'recent_24h': recent_count,
        'by_action': {action: count for action, count in action_counts},
        'by_resource': {resource: count for resource, count in resource_counts},
        'top_users': [
            {'user_id': user_id, 'count': count}
            for user_id, count in user_activity
        ],
    }


@router.get("/audit-logs/{log_id}")
@require_permission(Permission.ADMIN_AUDIT)
async def get_audit_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Get a specific audit log entry.
    
    Requires admin role.
    """
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    return {
        'id': log.id,
        'action': log.action,
        'user_id': log.user_id,
        'resource_type': log.resource_type,
        'resource_id': log.resource_id,
        'details': log.details,
        'created_at': log.created_at.isoformat(),
    }


@router.post("/retention/run")
@require_permission(Permission.ADMIN_SETTINGS)
async def trigger_retention_job(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Manually trigger retention job.
    
    Requires admin role.
    
    This will:
    - Purge tips older than retention period
    - Clean up old audit logs
    - Remove orphaned media
    """
    results = run_retention_job()
    
    return {
        'success': True,
        'message': 'Retention job completed',
        'results': results,
    }


@router.get("/retention/config")
@require_permission(Permission.ADMIN_SETTINGS)
async def get_retention_config(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get retention configuration.
    
    Requires admin role.
    """
    from app.core.retention import RetentionConfig
    
    config = RetentionConfig()
    
    return {
        'tip_retention_days': config.get_tip_retention_days(),
        'tip_exempt_statuses': config.TIP_EXEMPT_STATUSES,
        'audit_log_retention_days': config.AUDIT_LOG_RETENTION_DAYS,
        'media_retention_days': config.MEDIA_RETENTION_DAYS,
    }


@router.get("/system/health")
@require_permission(Permission.ADMIN_SETTINGS)
async def get_system_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Get system health metrics.
    
    Requires admin role.
    """
    from app.models.incident import Incident
    from app.models.tip import Tip
    from app.models.alert import Alert
    
    # Database counts
    incident_count = db.query(Incident).count()
    tip_count = db.query(Tip).count()
    alert_count = db.query(Alert).count()
    audit_log_count = db.query(AuditLog).count()
    
    # Recent activity
    from datetime import timedelta
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    recent_incidents = db.query(Incident).filter(
        Incident.created_at >= yesterday
    ).count()
    
    recent_tips = db.query(Tip).filter(
        Tip.created_at >= yesterday
    ).count()
    
    return {
        'status': 'healthy',
        'database': {
            'incidents': incident_count,
            'tips': tip_count,
            'alerts': alert_count,
            'audit_logs': audit_log_count,
        },
        'recent_24h': {
            'incidents': recent_incidents,
            'tips': recent_tips,
        },
        'timestamp': datetime.utcnow().isoformat(),
    }

