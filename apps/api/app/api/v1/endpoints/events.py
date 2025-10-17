"""Events endpoints."""
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.base import get_db
from app.models.event import Event
from app.models.user import User
from app.schemas.event import Event as EventSchema
from app.schemas.event import EventCreate, EventScore

router = APIRouter()


def calculate_risk_score(event: EventCreate) -> tuple[float, list[str]]:
    """
    Calculate risk score for an event using simple heuristics.
    Returns: (score, recommendations)
    Score range: 0.0 (low risk) to 10.0 (high risk)
    """
    score = 0.0
    recommendations = []

    # Keywords that increase risk
    high_risk_keywords = [
        "violence",
        "shooting",
        "bomb",
        "terror",
        "attack",
        "threat",
        "weapon",
        "explosive",
        "riot",
        "protest",
        "emergency",
    ]

    medium_risk_keywords = [
        "suspicious",
        "police",
        "fire",
        "accident",
        "incident",
        "crowd",
        "gathering",
    ]

    # Check title and description for keywords
    text = f"{event.title} {event.description or ''}".lower()

    high_risk_count = sum(1 for keyword in high_risk_keywords if keyword in text)
    medium_risk_count = sum(1 for keyword in medium_risk_keywords if keyword in text)

    # Calculate base score from keywords
    score += high_risk_count * 2.5
    score += medium_risk_count * 1.0

    # Time-based scoring
    if event.time:
        time_diff = abs((event.time - datetime.utcnow()).total_seconds())
        hours_diff = time_diff / 3600

        # Events happening soon are higher risk
        if hours_diff < 2:
            score += 1.5
            recommendations.append("Event is happening soon - immediate monitoring recommended")
        elif hours_diff < 24:
            score += 1.0
            recommendations.append("Event within 24 hours - prepare response team")
        elif hours_diff < 72:
            score += 0.5

    # Location-based heuristics (simple check for populated areas)
    if event.location:
        populated_indicators = [
            "downtown",
            "city center",
            "mall",
            "school",
            "university",
            "stadium",
            "airport",
            "station",
        ]
        if any(indicator in event.location.lower() for indicator in populated_indicators):
            score += 1.0
            recommendations.append(
                "Event in high-traffic area - coordinate with local authorities"
            )

    # Cap score at 10.0
    score = min(score, 10.0)

    # Generate recommendations based on score
    if score >= 8.0:
        recommendations.insert(
            0, "CRITICAL: Immediate action required - notify all relevant authorities"
        )
        recommendations.append("Deploy emergency response team")
        recommendations.append("Issue public safety alert")
    elif score >= 5.0:
        recommendations.insert(0, "HIGH RISK: Enhanced monitoring required")
        recommendations.append("Alert law enforcement")
        recommendations.append("Prepare emergency communications")
    elif score >= 3.0:
        recommendations.insert(0, "MODERATE RISK: Standard monitoring protocols")
        recommendations.append("Review event details with security team")
    else:
        recommendations.insert(0, "LOW RISK: Routine observation sufficient")

    # Add general recommendations
    if high_risk_count > 0:
        recommendations.append("Conduct threat assessment")

    if not recommendations:
        recommendations.append("Continue routine monitoring")

    return round(score, 2), recommendations


@router.post("/score", response_model=EventScore)
def score_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EventScore:
    """
    Calculate risk score for an event without saving it.
    Uses simple heuristics based on keywords, timing, and location.
    """
    score, recommendations = calculate_risk_score(event_data)
    return EventScore(score=score, recommendations=recommendations)


@router.post("/", response_model=EventSchema, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EventSchema:
    """Create a new event with automatic risk scoring."""
    # Calculate risk score
    score, recommendations = calculate_risk_score(event_data)

    # Create event
    event = Event(
        title=event_data.title,
        description=event_data.description,
        location=event_data.location,
        event_time=event_data.time,
        risk_score=score,
        recommendations=recommendations,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


@router.get("/{event_id}", response_model=EventSchema)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EventSchema:
    """Get a specific event by ID."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return event


@router.get("/", response_model=list[EventSchema])
def list_events(
    skip: int = 0,
    limit: int = 100,
    min_risk_score: float | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[EventSchema]:
    """List events with optional risk score filter."""
    query = db.query(Event)

    if min_risk_score is not None:
        query = query.filter(Event.risk_score >= min_risk_score)

    events = query.order_by(Event.risk_score.desc()).offset(skip).limit(limit).all()
    return events

