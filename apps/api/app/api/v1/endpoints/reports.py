"""Physical report endpoint for community incident reporting."""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

class PhysicalReportRequest(BaseModel):
    """Request model for physical incident reporting."""
    title: str
    description: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: str
    reporter_email: Optional[EmailStr] = None
    reporter_phone: Optional[str] = None

class PhysicalReportResponse(BaseModel):
    """Response model for physical report."""
    id: str
    title: str
    description: str
    location: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    severity: str
    status: str
    created_at: datetime

@router.post("/report", response_model=PhysicalReportResponse)
async def submit_physical_report(
    request: PhysicalReportRequest,
    db: Session = Depends(get_db)
):
    """Submit a physical incident report."""
    try:
        # Validate severity
        valid_severities = ["low", "medium", "high", "critical"]
        if request.severity not in valid_severities:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid severity. Must be one of: {valid_severities}"
            )
        
        # Create physical report
        from app.models.physical_report import PhysicalReport
        
        report = PhysicalReport(
            title=request.title,
            description=request.description,
            location=request.location,
            latitude=request.latitude,
            longitude=request.longitude,
            severity=request.severity,
            reporter_email=request.reporter_email,
            reporter_phone=request.reporter_phone,
            status="open"
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        # Send Slack alert for high severity reports
        if request.severity in ["high", "critical"]:
            await send_slack_alert(report)
        
        return PhysicalReportResponse(
            id=str(report.id),
            title=report.title,
            description=report.description,
            location=report.location,
            latitude=report.latitude,
            longitude=report.longitude,
            severity=report.severity,
            status=report.status,
            created_at=report.created_at
        )
        
    except Exception as e:
        logger.error(f"Failed to submit physical report: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

async def send_slack_alert(report):
    """Send Slack alert for high-severity physical reports."""
    import os
    import httpx
    
    slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
    if not slack_webhook or report.severity not in ["high", "critical"]:
        return
    
    try:
        message = {
            "text": f"🚨 High-severity physical incident reported",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Severity:* {report.severity.upper()}\n*Location:* {report.location or 'Not specified'}\n*Status:* {report.status.upper()}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Title:* {report.title}\n*Description:* {report.description[:500]}{'...' if len(report.description) > 500 else ''}"
                    }
                }
            ]
        }
        
        if report.latitude and report.longitude:
            message["blocks"].append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Coordinates:* {report.latitude}, {report.longitude}"
                }
            })
        
        async with httpx.AsyncClient() as client:
            await client.post(slack_webhook, json=message, timeout=10.0)
            
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")

@router.get("/physical-reports")
async def get_physical_reports(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get physical reports from database."""
    try:
        from app.models.physical_report import PhysicalReport
        
        query = db.query(PhysicalReport)
        
        if severity:
            query = query.filter(PhysicalReport.severity == severity)
        if status:
            query = query.filter(PhysicalReport.status == status)
        
        reports = query.order_by(PhysicalReport.created_at.desc()).limit(limit).all()
        
        return {
            "reports": [
                {
                    "id": str(report.id),
                    "title": report.title,
                    "description": report.description,
                    "location": report.location,
                    "latitude": report.latitude,
                    "longitude": report.longitude,
                    "severity": report.severity,
                    "status": report.status,
                    "created_at": report.created_at.isoformat(),
                    "updated_at": report.updated_at.isoformat()
                }
                for report in reports
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get physical reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/incidents")
async def get_all_incidents(
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all incidents (digital + physical) for dashboard."""
    try:
        from app.models.digital_incident import DigitalIncident
        from app.models.physical_report import PhysicalReport
        
        incidents = []
        
        # Get digital incidents
        digital_query = db.query(DigitalIncident)
        if severity:
            digital_query = digital_query.filter(DigitalIncident.severity == severity)
        
        digital_incidents = digital_query.order_by(DigitalIncident.created_at.desc()).limit(limit).all()
        
        for incident in digital_incidents:
            incidents.append({
                "id": str(incident.id),
                "type": "digital",
                "title": incident.text[:100] + "..." if len(incident.text) > 100 else incident.text,
                "description": incident.text,
                "severity": incident.severity,
                "status": "open",
                "location": None,
                "latitude": None,
                "longitude": None,
                "source": incident.source,
                "subreddit": incident.subreddit,
                "author": incident.author,
                "url": incident.url,
                "score": incident.score,
                "created_at": incident.created_at.isoformat(),
                "updated_at": incident.created_at.isoformat()
            })
        
        # Get physical reports
        physical_query = db.query(PhysicalReport)
        if severity:
            physical_query = physical_query.filter(PhysicalReport.severity == severity)
        
        physical_reports = physical_query.order_by(PhysicalReport.created_at.desc()).limit(limit).all()
        
        for report in physical_reports:
            incidents.append({
                "id": str(report.id),
                "type": "physical",
                "title": report.title,
                "description": report.description,
                "severity": report.severity,
                "status": report.status,
                "location": report.location,
                "latitude": report.latitude,
                "longitude": report.longitude,
                "source": "community_report",
                "subreddit": None,
                "author": report.reporter_email,
                "url": None,
                "score": None,
                "created_at": report.created_at.isoformat(),
                "updated_at": report.updated_at.isoformat()
            })
        
        # Sort by created_at descending
        incidents.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"incidents": incidents[:limit]}
        
    except Exception as e:
        logger.error(f"Failed to get all incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


