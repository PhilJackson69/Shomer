"""ICE Alert endpoints for community safety notifications."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ice_alert import (
    ICEAlertBroadcastRequest,
    ICEAlertBroadcastResponse,
    ICEAlertDetailResponse,
    ICEAlertFeedResponse,
    ICEAlertListResponse,
    ICEAlertNearbyQuery,
    ICEAlertResponse,
    ICEAlertStats,
    ICEAlertSubmit,
    ICEAlertUpdate,
)
from app.services.ice_alert_service import ICEAlertService
from app.services.alert_service import AlertService

router = APIRouter()


def require_moderator(current_user: User = Depends(get_current_user)) -> User:
    """Require moderator or admin role."""
    if current_user.role not in ["moderator", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Moderator or admin access required for this operation",
        )
    return current_user


def require_verified_partner(current_user: User = Depends(get_current_user)) -> User:
    """Require verified partner, moderator, or admin role."""
    # TODO: Implement verified_partner role check
    # For now, require moderator or admin
    if current_user.role not in ["moderator", "admin", "verified_partner"]:
        raise HTTPException(
            status_code=403,
            detail="Verified partner or moderator access required",
        )
    return current_user


@router.post("/submit", response_model=ICEAlertResponse, status_code=201)
async def submit_ice_alert(
    data: ICEAlertSubmit,
    current_user: User = Depends(require_verified_partner),
    db: Session = Depends(get_db),
) -> Any:
    """
    Submit a new ICE activity alert.
    
    **Authorization:** Moderator or verified partner only.
    
    **Important Guidelines:**
    - Do NOT include personal information (names, SSN, etc.)
    - Do NOT include license plates or badge numbers
    - Do NOT include specific addresses (use area/neighborhood)
    - Focus on public activity only
    
    **Severity Levels:**
    - `rumor`: Unconfirmed community report
    - `verified`: Confirmed by trusted source
    - `active`: Current, ongoing activity
    
    All alerts undergo human moderation before becoming public.
    Alerts automatically expire after 48 hours.
    """
    service = ICEAlertService(db)
    
    try:
        alert, issues = service.create_alert(data, current_user)
        
        if issues:
            # Alert created but with verification issues
            # Return alert with warning
            return {
                **ICEAlertResponse.from_orm(alert).model_dump(),
                "warning": f"Created with issues: {', '.join(issues[:3])}",
            }
        
        return alert
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create alert: {str(e)}")


@router.get("/nearby", response_model=list[ICEAlertResponse])
async def get_nearby_ice_alerts(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius: float = Query(10.0, ge=0.1, le=100, description="Radius in kilometers"),
    severity: str | None = Query(None, description="Filter by severity"),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get verified ICE alerts near a location.
    
    **Public endpoint** - no authentication required.
    
    Returns only approved, non-expired alerts within the specified radius.
    Coordinates are approximated for privacy (±500m).
    
    **Parameters:**
    - `lat`: Latitude coordinate
    - `lon`: Longitude coordinate  
    - `radius`: Search radius in kilometers (default: 10km, max: 100km)
    - `severity`: Filter by severity level (rumor, verified, active)
    """
    service = ICEAlertService(db)
    
    try:
        alerts = service.get_nearby_alerts(
            latitude=lat,
            longitude=lon,
            radius_km=radius,
            severity=severity,
            include_expired=False,
        )
        
        return alerts
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch nearby alerts: {str(e)}")


@router.get("/feed", response_model=ICEAlertFeedResponse)
async def get_ice_alert_feed(
    limit: int = Query(50, ge=1, le=100, description="Maximum alerts to return"),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get latest ICE alerts feed.
    
    **Public endpoint** - no authentication required.
    
    Returns the most recent approved, non-expired alerts for public view.
    All alerts are sanitized and reviewed by human moderators.
    
    **Disclaimer:** These alerts are community-submitted and human-reviewed.
    They represent reported activity and should be treated as informational.
    Always prioritize your safety and know your rights.
    """
    service = ICEAlertService(db)
    
    try:
        alerts = service.get_feed(limit=limit)
        
        from datetime import datetime
        return ICEAlertFeedResponse(
            alerts=alerts,
            total=len(alerts),
            last_updated=datetime.utcnow(),
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch alert feed: {str(e)}")


@router.get("/{alert_id}", response_model=ICEAlertDetailResponse)
async def get_ice_alert(
    alert_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get detailed ICE alert information.
    
    **Authorization:** Moderator or admin only.
    
    Returns full alert details including moderation status,
    verification scores, and audit trail.
    """
    service = ICEAlertService(db)
    
    alert = service.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert


@router.patch("/{alert_id}", response_model=ICEAlertDetailResponse)
async def update_ice_alert(
    alert_id: int,
    data: ICEAlertUpdate,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    Update an ICE alert (moderation action).
    
    **Authorization:** Moderator or admin only.
    
    Use this endpoint to:
    - Approve or reject alerts
    - Update severity level
    - Mark as verified
    - Edit content for compliance
    """
    service = ICEAlertService(db)
    
    try:
        alert = service.update_alert(alert_id, data, current_user)
        return alert
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update alert: {str(e)}")


@router.get("", response_model=ICEAlertListResponse)
async def list_ice_alerts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    severity: str | None = Query(None, description="Filter by severity"),
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    List all ICE alerts (admin view).
    
    **Authorization:** Moderator or admin only.
    
    Returns paginated list of all alerts including pending,
    rejected, and expired alerts.
    """
    service = ICEAlertService(db)
    
    try:
        alerts, total = service.get_active_alerts(
            page=page,
            page_size=page_size,
            severity=severity,
        )
        
        return ICEAlertListResponse(
            alerts=alerts,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(page * page_size) < total,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list alerts: {str(e)}")


@router.post("/broadcast", response_model=ICEAlertBroadcastResponse)
async def broadcast_ice_alert(
    request: ICEAlertBroadcastRequest,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    Broadcast an approved ICE alert to subscribers.
    
    **Authorization:** Moderator or admin only.
    
    Sends alert to all users who have opted into ICE_ALERT notifications
    via the specified channels (SMS, email, push).
    
    **Requirements:**
    - Alert must be approved
    - Alert must not be expired
    - Users must have explicitly opted in to ICE alerts
    """
    alert_service = AlertService(db)
    service = ICEAlertService(db, alert_service)
    
    try:
        success, count, errors = await service.broadcast_alert(
            alert_id=request.alert_id,
            channels=request.channels,
            message_template=request.message_template,
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        
        return ICEAlertBroadcastResponse(
            success=success,
            message=f"Alert broadcast to {count} recipients",
            alert_id=request.alert_id,
            broadcast_count=count,
            channels_used=request.channels,
            errors=errors if errors else None,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to broadcast alert: {str(e)}")


@router.get("/stats/summary", response_model=ICEAlertStats)
async def get_ice_alert_statistics(
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get aggregate ICE alert statistics.
    
    **Authorization:** Moderator or admin only.
    
    Returns summary statistics including:
    - Total alerts created
    - Verification rate
    - Active alerts count
    - Broadcast statistics
    """
    service = ICEAlertService(db)
    
    try:
        return service.get_statistics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")


@router.post("/archive-expired", status_code=200)
async def archive_expired_alerts(
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> Any:
    """
    Archive expired ICE alerts (>48 hours old).
    
    **Authorization:** Moderator or admin only.
    
    Moves expired alerts to archive. This is typically run
    as a scheduled task but can be triggered manually.
    """
    service = ICEAlertService(db)
    
    try:
        count = service.archive_expired_alerts()
        return {
            "success": True,
            "message": f"Archived {count} expired alerts",
            "count": count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to archive alerts: {str(e)}")

