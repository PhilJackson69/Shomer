"""Metrics endpoint for Prometheus scraping."""

from fastapi import APIRouter, Response, Depends, HTTPException
from app.core.metrics import get_metrics, get_security_metrics, get_security_metrics_summary
from app.core.security import get_current_user
from app.schemas.user import UserSchema

router = APIRouter()


@router.get("/metrics")
async def metrics_endpoint() -> Response:
    """
    Prometheus metrics endpoint.
    
    Returns metrics in Prometheus format for scraping.
    """
    metrics_data = get_metrics()
    return Response(
        content=metrics_data,
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@router.get("/metrics/security")
async def security_metrics_endpoint() -> Response:
    """
    Security-specific metrics endpoint.
    
    Returns security metrics in Prometheus format for scraping.
    """
    metrics_data = get_security_metrics()
    return Response(
        content=metrics_data,
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@router.get("/metrics/security/summary")
async def security_metrics_summary_endpoint(
    current_user: UserSchema = Depends(get_current_user)
) -> dict:
    """
    Security metrics summary endpoint.
    
    Returns security metrics summary for monitoring dashboards.
    Requires authentication.
    """
    try:
        summary = get_security_metrics_summary()
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get security metrics summary: {str(e)}"
        )
