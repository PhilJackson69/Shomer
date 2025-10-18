"""
System metrics and admin dashboard endpoints.

Provides system health, rate limit violations, and 7-day totals
for admin monitoring and system overview.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.api.deps import get_current_active_user, require_role
from app.core.rbac import UserRole
from app.db.base import get_db
from app.models.user import User
from app.models.tip import Tip
from app.models.incident import Incident
from app.models.audit_log import AuditLog

router = APIRouter()


class SystemMetrics(BaseModel):
    """System metrics response model."""
    total_users: int
    total_tips: int
    total_incidents: int
    rate_limit_violations_7d: int
    system_health: str
    uptime_hours: float
    last_7d_totals: Dict[str, int]


class RateLimitViolation(BaseModel):
    """Rate limit violation model."""
    timestamp: datetime
    ip_address: str
    endpoint: str
    violation_type: str
    retry_after: int


class SystemHealth(BaseModel):
    """System health status model."""
    status: str
    database: str
    redis: str
    disk_usage: float
    memory_usage: float
    last_check: datetime


@router.get("/metrics", response_model=SystemMetrics)
async def get_system_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> SystemMetrics:
    """
    Get comprehensive system metrics for admin dashboard.
    
    Returns:
        System metrics including totals, health, and 7-day statistics
    """
    try:
        # Get total counts
        total_users = db.query(User).count()
        total_tips = db.query(Tip).count()
        total_incidents = db.query(Incident).count()
        
        # Get 7-day totals
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        tips_7d = db.query(Tip).filter(Tip.created_at >= seven_days_ago).count()
        incidents_7d = db.query(Incident).filter(Incident.created_at >= seven_days_ago).count()
        users_7d = db.query(User).filter(User.created_at >= seven_days_ago).count()
        
        # Get rate limit violations (from audit logs)
        rate_limit_violations_7d = db.query(AuditLog).filter(
            AuditLog.created_at >= seven_days_ago,
            AuditLog.action == "rate_limit_exceeded"
        ).count()
        
        # Calculate uptime (simplified - would need actual start time)
        uptime_hours = 24 * 7  # Placeholder
        
        # Determine system health
        system_health = "healthy"
        if rate_limit_violations_7d > 1000:
            system_health = "degraded"
        elif rate_limit_violations_7d > 5000:
            system_health = "critical"
        
        return SystemMetrics(
            total_users=total_users,
            total_tips=total_tips,
            total_incidents=total_incidents,
            rate_limit_violations_7d=rate_limit_violations_7d,
            system_health=system_health,
            uptime_hours=uptime_hours,
            last_7d_totals={
                "tips": tips_7d,
                "incidents": incidents_7d,
                "users": users_7d,
                "rate_limit_violations": rate_limit_violations_7d
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve system metrics: {str(e)}"
        )


@router.get("/health", response_model=SystemHealth)
async def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> SystemHealth:
    """
    Get detailed system health status.
    
    Returns:
        System health including database, Redis, and resource usage
    """
    try:
        # Check database health
        db_status = "healthy"
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            db_status = "unhealthy"
        
        # Check Redis health (simplified)
        redis_status = "healthy"  # Would need actual Redis check
        
        # Get system resource usage (simplified)
        disk_usage = 45.2  # Placeholder - would use psutil
        memory_usage = 67.8  # Placeholder - would use psutil
        
        # Determine overall status
        overall_status = "healthy"
        if db_status != "healthy" or redis_status != "healthy":
            overall_status = "unhealthy"
        elif disk_usage > 90 or memory_usage > 90:
            overall_status = "degraded"
        
        return SystemHealth(
            status=overall_status,
            database=db_status,
            redis=redis_status,
            disk_usage=disk_usage,
            memory_usage=memory_usage,
            last_check=datetime.utcnow()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve system health: {str(e)}"
        )


@router.get("/rate-limit-violations")
async def get_rate_limit_violations(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> JSONResponse:
    """
    Get recent rate limit violations.
    
    Args:
        limit: Maximum number of violations to return
        
    Returns:
        List of recent rate limit violations
    """
    try:
        # Get recent rate limit violations from audit logs
        violations = db.query(AuditLog).filter(
            AuditLog.action == "rate_limit_exceeded"
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()
        
        violation_data = []
        for violation in violations:
            violation_data.append({
                "timestamp": violation.created_at,
                "ip_address": violation.ip_address or "unknown",
                "endpoint": violation.endpoint or "unknown",
                "violation_type": "rate_limit_exceeded",
                "retry_after": 60,  # Placeholder
                "user_id": violation.user_id
            })
        
        return JSONResponse({
            "violations": violation_data,
            "total_count": len(violation_data),
            "limit": limit
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve rate limit violations: {str(e)}"
        )


@router.get("/activity-summary")
async def get_activity_summary(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> JSONResponse:
    """
    Get activity summary for the specified number of days.
    
    Args:
        days: Number of days to include in summary
        
    Returns:
        Daily activity breakdown
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get daily activity counts
        daily_activity = []
        
        for i in range(days):
            current_date = start_date + timedelta(days=i)
            next_date = current_date + timedelta(days=1)
            
            # Count activities for this day
            tips_count = db.query(Tip).filter(
                Tip.created_at >= current_date,
                Tip.created_at < next_date
            ).count()
            
            incidents_count = db.query(Incident).filter(
                Incident.created_at >= current_date,
                Incident.created_at < next_date
            ).count()
            
            users_count = db.query(User).filter(
                User.created_at >= current_date,
                User.created_at < next_date
            ).count()
            
            daily_activity.append({
                "date": current_date.date().isoformat(),
                "tips": tips_count,
                "incidents": incidents_count,
                "users": users_count,
                "total": tips_count + incidents_count + users_count
            })
        
        return JSONResponse({
            "period_days": days,
            "daily_activity": daily_activity,
            "summary": {
                "total_tips": sum(day["tips"] for day in daily_activity),
                "total_incidents": sum(day["incidents"] for day in daily_activity),
                "total_users": sum(day["users"] for day in daily_activity),
                "avg_daily_activity": sum(day["total"] for day in daily_activity) / days
            }
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve activity summary: {str(e)}"
        )


@router.get("/security-events")
async def get_security_events(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> JSONResponse:
    """
    Get recent security events for monitoring.
    
    Args:
        limit: Maximum number of events to return
        
    Returns:
        List of recent security events
    """
    try:
        # Get security-related audit log entries
        security_actions = [
            "rate_limit_exceeded",
            "csrf_invalid",
            "authentication_failed",
            "authorization_failed",
            "file_upload_rejected",
            "suspicious_activity"
        ]
        
        events = db.query(AuditLog).filter(
            AuditLog.action.in_(security_actions)
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()
        
        event_data = []
        for event in events:
            event_data.append({
                "timestamp": event.created_at,
                "action": event.action,
                "ip_address": event.ip_address or "unknown",
                "endpoint": event.endpoint or "unknown",
                "user_id": event.user_id,
                "details": event.details or {}
            })
        
        return JSONResponse({
            "events": event_data,
            "total_count": len(event_data),
            "limit": limit
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve security events: {str(e)}"
        )
