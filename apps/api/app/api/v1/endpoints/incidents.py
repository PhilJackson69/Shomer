"""Incidents endpoints."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_role
from app.db.base import get_db
from app.models.incident import Incident
from app.models.user import User, UserRole
from app.schemas.incident import (
    Incident as IncidentSchema,
    IncidentCreate,
    IncidentList,
    IncidentUpdate,
)

router = APIRouter()


@router.post("/", response_model=IncidentSchema, status_code=status.HTTP_201_CREATED)
def create_incident(
    incident_data: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> IncidentSchema:
    """Create a new incident (moderator+ only)."""
    incident = Incident(**incident_data.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/", response_model=IncidentList)
def list_incidents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    keyword: Optional[str] = Query(None, description="Search keyword in title/description"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> IncidentList:
    """List incidents with filters and pagination."""
    query = db.query(Incident)

    # Apply filters
    if severity:
        query = query.filter(Incident.severity == severity)

    if status:
        query = query.filter(Incident.status == status)

    if start_date:
        query = query.filter(Incident.created_at >= start_date)

    if end_date:
        query = query.filter(Incident.created_at <= end_date)

    if keyword:
        search_term = f"%{keyword}%"
        query = query.filter(
            or_(
                Incident.title.ilike(search_term),
                Incident.description.ilike(search_term),
            )
        )

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    incidents = query.order_by(Incident.created_at.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return IncidentList(
        incidents=incidents,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{incident_id}", response_model=IncidentSchema)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> IncidentSchema:
    """Get a specific incident by ID."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


@router.put("/{incident_id}", response_model=IncidentSchema)
def update_incident(
    incident_id: int,
    incident_data: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> IncidentSchema:
    """Update an incident (moderator+ only)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    # Update fields
    update_data = incident_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(incident, field, value)

    # Mark as resolved if status changed to resolved
    if incident_data.status == "resolved" and not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    """Delete an incident (admin only)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    db.delete(incident)
    db.commit()

