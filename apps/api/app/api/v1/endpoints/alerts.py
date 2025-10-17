"""Alert endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import (
    AlertChannelResult,
    AlertListResponse,
    AlertResponse,
    AlertSendRequest,
    AlertSendResponse,
)
from app.services.alert_service import AlertService

router = APIRouter()


def require_moderator(current_user: User = Depends(get_current_user)) -> User:
    """Require moderator or admin role."""
    if current_user.role not in ["moderator", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Moderator or admin access required",
        )
    return current_user


@router.post("/send", response_model=AlertSendResponse)
async def send_alert(
    request: AlertSendRequest,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> AlertSendResponse:
    """
    Send alert via multiple channels.

    Requires moderator or admin role.

    Channels:
    - sms: SMS via Twilio
    - email: Email via SendGrid
    - push: Push notification (stub)

    Audience filter maps channel to list of recipients:
    ```json
    {
      "sms": ["+15551234567", "+15559876543"],
      "email": ["user@example.com"],
      "push": ["device_token_123"]
    }
    ```

    In dev mode (no credentials configured), alerts are printed to console
    and stored in database with status=pending.
    """
    # Validate channels
    valid_channels = {"sms", "email", "push"}
    invalid_channels = set(request.channels) - valid_channels
    if invalid_channels:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channels: {invalid_channels}. Valid: {valid_channels}",
        )

    # Validate audience filter has required channels
    missing_channels = set(request.channels) - set(request.audience_filter.keys())
    if missing_channels:
        raise HTTPException(
            status_code=400,
            detail=f"Missing recipients for channels: {missing_channels}",
        )

    # Validate severity
    valid_severities = {"low", "medium", "high", "critical"}
    if request.severity not in valid_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Valid: {valid_severities}",
        )

    # Initialize alert service
    alert_service = AlertService(db=db)

    # Send alerts
    results = await alert_service.send_multi_channel(
        channels=request.channels,
        recipients=request.audience_filter,
        title=request.title,
        body=request.body,
        severity=request.severity,
    )

    # Count successes and failures
    total_sent = 0
    total_failed = 0

    for channel_results in results.values():
        for result in channel_results:
            if result.success:
                total_sent += 1
            else:
                total_failed += 1

    # Format response
    formatted_results: dict[str, list[AlertChannelResult]] = {}
    for channel, channel_results in results.items():
        formatted_results[channel] = [
            AlertChannelResult(
                success=r.success,
                recipient=r.recipient,
                message=r.message,
                error=r.error,
            )
            for r in channel_results
        ]

    success = total_failed == 0
    message = f"Sent {total_sent} alerts"
    if total_failed > 0:
        message += f", {total_failed} failed"

    return AlertSendResponse(
        success=success,
        message=message,
        results=formatted_results,
        total_sent=total_sent,
        total_failed=total_failed,
    )


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    page: int = 1,
    page_size: int = 50,
    channel: str | None = None,
    status: str | None = None,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    """
    List alerts with pagination and filtering.

    Requires moderator or admin role.

    Query parameters:
    - page: Page number (1-indexed)
    - page_size: Items per page (max 100)
    - channel: Filter by channel (sms, email, push)
    - status: Filter by status (pending, sent, failed)
    """
    # Validate page size
    if page_size > 100:
        page_size = 100

    # Build query
    query = db.query(Alert)

    if channel:
        query = query.filter(Alert.channel == channel)

    if status:
        query = query.filter(Alert.status == status)

    # Get total count
    total = query.count()

    # Get paginated results
    alerts = (
        query.order_by(Alert.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AlertListResponse(
        alerts=[AlertResponse.model_validate(alert) for alert in alerts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> AlertResponse:
    """
    Get a specific alert by ID.

    Requires moderator or admin role.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return AlertResponse.model_validate(alert)


@router.get("/stats", response_model=dict[str, Any])
async def get_alert_stats(
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Get alert statistics.

    Requires moderator or admin role.

    Returns:
    - Total alerts by status
    - Total alerts by channel
    - Recent alert count (last 24 hours)
    """
    from datetime import datetime, timedelta

    # Status counts
    status_counts = (
        db.query(Alert.status, func.count(Alert.id))
        .group_by(Alert.status)
        .all()
    )

    # Channel counts
    channel_counts = (
        db.query(Alert.channel, func.count(Alert.id))
        .group_by(Alert.channel)
        .all()
    )

    # Recent count (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_count = db.query(Alert).filter(Alert.created_at >= yesterday).count()

    return {
        "by_status": {status: count for status, count in status_counts},
        "by_channel": {channel: count for channel, count in channel_counts},
        "total": db.query(Alert).count(),
        "recent_24h": recent_count,
    }
