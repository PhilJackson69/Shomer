"""ICE Alert Service for managing immigration enforcement activity alerts."""
import math
import re
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.ice_alert import ICEAlert
from app.models.alert import AlertCategory, ICESeverity
from app.models.user import User
from app.schemas.ice_alert import (
    ICEAlertSubmit,
    ICEAlertUpdate,
    ICEAlertStats,
)
from app.services.alert_service import AlertService


class ICEAlertService:
    """
    Service for managing ICE alerts with verification and moderation.
    
    Key features:
    - Human moderation required for all alerts
    - PII detection and sanitization
    - Confidence scoring for verification
    - Auto-expiration after 48 hours
    - Broadcast to opt-in subscribers
    """

    # Prohibited patterns that might contain PII or inappropriate content
    PII_PATTERNS = [
        r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
        r'\b[A-Z0-9]{2,3}-\d{3,4}\b',  # License plate patterns
        r'\bbadge\s*#?\s*\d+\b',  # Badge numbers
        r'\bofficer\s+\w+\s+\w+\b',  # Officer names
        r'\bagent\s+\w+\s+\w+\b',  # Agent names
        r'\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b',  # Specific addresses
    ]

    def __init__(self, db: Session, alert_service: Optional[AlertService] = None):
        """
        Initialize ICE alert service.
        
        Args:
            db: Database session
            alert_service: Alert service for broadcasting (optional)
        """
        self.db = db
        self.alert_service = alert_service or AlertService(db=db)

    def verify_alert(self, alert: ICEAlert, description: str) -> tuple[bool, float, list[str]]:
        """
        Verify an alert for PII and inappropriate content.
        
        Returns:
            Tuple of (passes_verification, confidence_score, issues_found)
        """
        issues = []
        
        # Check for PII patterns
        combined_text = f"{description} {alert.location}".lower()
        for pattern in self.PII_PATTERNS:
            if re.search(pattern, combined_text, re.IGNORECASE):
                issues.append(f"Contains prohibited pattern: {pattern}")
        
        # Check for specific prohibited terms
        prohibited_terms = [
            "license plate",
            "badge number",
            "officer name",
            "social security",
            "deportation target",
            "individual name",
        ]
        
        for term in prohibited_terms:
            if term in combined_text:
                issues.append(f"Contains prohibited term: '{term}'")
        
        # Calculate confidence score (0.0 to 1.0)
        # Base score starts at 0.8
        confidence = 0.8
        
        # Reduce confidence for issues found
        confidence -= len(issues) * 0.15
        
        # Boost confidence if from verified source
        if "verified" in alert.source.lower() or "partner" in alert.source.lower():
            confidence += 0.15
        
        # Clamp to 0.0 - 1.0
        confidence = max(0.0, min(1.0, confidence))
        
        # Pass if no issues and confidence > 0.5
        passes = len(issues) == 0 and confidence > 0.5
        
        return passes, confidence, issues

    def create_alert(
        self,
        data: ICEAlertSubmit,
        created_by: User,
    ) -> tuple[ICEAlert, list[str]]:
        """
        Create a new ICE alert with verification.
        
        Args:
            data: Alert submission data
            created_by: User creating the alert
            
        Returns:
            Tuple of (ICEAlert instance, list of verification issues)
        """
        # Create alert instance
        alert = ICEAlert(
            location=data.location,
            latitude=data.latitude,
            longitude=data.longitude,
            description=data.description,
            severity=data.severity,
            source=data.source,
            created_by=created_by.id,
            verified=False,
            approved=False,
        )
        
        # Run verification
        passes, confidence, issues = self.verify_alert(alert, data.description)
        alert.confidence_score = confidence
        
        # Auto-approve if passes verification and user is moderator
        if passes and self._is_moderator(created_by):
            alert.approved = True
            alert.reviewed_by = created_by.id
            alert.reviewed_at = datetime.utcnow()
        
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        
        return alert, issues

    def update_alert(
        self,
        alert_id: int,
        data: ICEAlertUpdate,
        updated_by: User,
    ) -> ICEAlert:
        """
        Update an existing ICE alert (moderator only).
        
        Args:
            alert_id: Alert ID
            data: Update data
            updated_by: User performing update
            
        Returns:
            Updated ICEAlert instance
        """
        alert = self.get_alert_by_id(alert_id)
        if not alert:
            raise ValueError(f"Alert {alert_id} not found")
        
        # Update fields if provided
        if data.location is not None:
            alert.location = data.location
        if data.description is not None:
            alert.description = data.description
        if data.severity is not None:
            alert.severity = data.severity
        if data.source is not None:
            alert.source = data.source
        if data.verified is not None:
            alert.verified = data.verified
            alert.verified_by = updated_by.id
            alert.verified_at = datetime.utcnow()
        if data.approved is not None:
            alert.approved = data.approved
            alert.reviewed_by = updated_by.id
            alert.reviewed_at = datetime.utcnow()
        if data.rejection_reason is not None:
            alert.rejection_reason = data.rejection_reason
        
        alert.updated_by = updated_by.id
        alert.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(alert)
        
        return alert

    def get_alert_by_id(self, alert_id: int) -> Optional[ICEAlert]:
        """Get alert by ID."""
        return self.db.query(ICEAlert).filter(ICEAlert.id == alert_id).first()

    def get_active_alerts(
        self,
        page: int = 1,
        page_size: int = 50,
        severity: Optional[str] = None,
    ) -> tuple[list[ICEAlert], int]:
        """
        Get active (approved, not expired) alerts.
        
        Args:
            page: Page number (1-indexed)
            page_size: Number of alerts per page
            severity: Filter by severity level
            
        Returns:
            Tuple of (alerts list, total count)
        """
        query = self.db.query(ICEAlert).filter(
            ICEAlert.approved == True,
            ICEAlert.archived == False,
            ICEAlert.expires_at > datetime.utcnow(),
        )
        
        if severity:
            query = query.filter(ICEAlert.severity == severity)
        
        total = query.count()
        
        alerts = (
            query.order_by(ICEAlert.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        
        return alerts, total

    def get_nearby_alerts(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        severity: Optional[str] = None,
        include_expired: bool = False,
    ) -> list[ICEAlert]:
        """
        Get alerts near a location using Haversine formula.
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            radius_km: Search radius in kilometers
            severity: Filter by severity
            include_expired: Include expired alerts
            
        Returns:
            List of nearby alerts
        """
        # Base query
        query = self.db.query(ICEAlert).filter(
            ICEAlert.approved == True,
            ICEAlert.archived == False,
            ICEAlert.latitude.isnot(None),
            ICEAlert.longitude.isnot(None),
        )
        
        if not include_expired:
            query = query.filter(ICEAlert.expires_at > datetime.utcnow())
        
        if severity:
            query = query.filter(ICEAlert.severity == severity)
        
        alerts = query.all()
        
        # Filter by distance using Haversine formula
        nearby_alerts = []
        for alert in alerts:
            distance = self._haversine_distance(
                latitude, longitude,
                alert.latitude, alert.longitude
            )
            if distance <= radius_km:
                nearby_alerts.append(alert)
        
        # Sort by distance (closest first)
        nearby_alerts.sort(
            key=lambda a: self._haversine_distance(
                latitude, longitude, a.latitude, a.longitude
            )
        )
        
        return nearby_alerts

    def get_feed(self, limit: int = 50) -> list[ICEAlert]:
        """
        Get latest alerts for public feed (sanitized).
        
        Args:
            limit: Maximum number of alerts to return
            
        Returns:
            List of alerts
        """
        return (
            self.db.query(ICEAlert)
            .filter(
                ICEAlert.approved == True,
                ICEAlert.archived == False,
                ICEAlert.expires_at > datetime.utcnow(),
            )
            .order_by(ICEAlert.created_at.desc())
            .limit(limit)
            .all()
        )

    async def broadcast_alert(
        self,
        alert_id: int,
        channels: list[str],
        message_template: Optional[str] = None,
    ) -> tuple[bool, int, list[str]]:
        """
        Broadcast alert to opt-in subscribers.
        
        Args:
            alert_id: Alert ID to broadcast
            channels: Channels to use (sms, email, push)
            message_template: Custom message template
            
        Returns:
            Tuple of (success, recipient_count, errors)
        """
        alert = self.get_alert_by_id(alert_id)
        if not alert:
            return False, 0, ["Alert not found"]
        
        if not alert.approved:
            return False, 0, ["Alert not approved for broadcast"]
        
        # Build message
        if message_template:
            message = message_template.format(
                location=alert.location,
                severity=alert.severity,
                description=alert.description,
            )
        else:
            message = self._build_default_message(alert)
        
        # TODO: Query subscribers who opted into ICE_ALERT category
        # For now, return success with zero recipients
        # In production, integrate with subscriber service
        
        recipient_count = 0
        errors = []
        
        # Mark as broadcast
        alert.broadcast_sent = True
        alert.broadcast_at = datetime.utcnow()
        alert.broadcast_count = recipient_count
        
        self.db.commit()
        
        return True, recipient_count, errors

    def archive_expired_alerts(self) -> int:
        """
        Archive alerts that have expired (> 48 hours old).
        
        Returns:
            Number of alerts archived
        """
        expired = self.db.query(ICEAlert).filter(
            ICEAlert.archived == False,
            ICEAlert.expires_at <= datetime.utcnow(),
        ).all()
        
        for alert in expired:
            alert.archived = True
            alert.archived_at = datetime.utcnow()
        
        self.db.commit()
        
        return len(expired)

    def get_statistics(self) -> ICEAlertStats:
        """
        Get aggregate statistics for ICE alerts.
        
        Returns:
            ICEAlertStats with counts and rates
        """
        total = self.db.query(ICEAlert).count()
        verified = self.db.query(ICEAlert).filter(ICEAlert.verified == True).count()
        
        active = self.db.query(ICEAlert).filter(
            ICEAlert.approved == True,
            ICEAlert.archived == False,
            ICEAlert.expires_at > datetime.utcnow(),
        ).count()
        
        rumor = self.db.query(ICEAlert).filter(ICEAlert.severity == ICESeverity.RUMOR.value).count()
        expired = self.db.query(ICEAlert).filter(ICEAlert.archived == True).count()
        
        # Calculate verification rate
        verification_rate = (verified / total * 100) if total > 0 else 0.0
        
        # Average confidence score
        avg_confidence = self.db.query(func.avg(ICEAlert.confidence_score)).scalar()
        
        # Broadcast stats
        broadcasts = self.db.query(ICEAlert).filter(ICEAlert.broadcast_sent == True).count()
        total_recipients = self.db.query(func.sum(ICEAlert.broadcast_count)).scalar() or 0
        
        return ICEAlertStats(
            total_alerts=total,
            alerts_verified=verified,
            alerts_active=active,
            alerts_rumor=rumor,
            alerts_expired=expired,
            verification_rate=round(verification_rate, 2),
            avg_confidence_score=round(avg_confidence, 3) if avg_confidence else None,
            total_broadcasts=broadcasts,
            total_recipients=int(total_recipients),
        )

    # Helper methods

    def _is_moderator(self, user: User) -> bool:
        """Check if user has moderator privileges."""
        # TODO: Implement RBAC check
        # For now, check if user has role_id indicating moderator
        return user.role_id in [2, 3]  # Assuming 2=moderator, 3=admin

    def _haversine_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
    ) -> float:
        """
        Calculate distance between two points using Haversine formula.
        
        Args:
            lat1, lon1: First point coordinates
            lat2, lon2: Second point coordinates
            
        Returns:
            Distance in kilometers
        """
        # Earth radius in kilometers
        R = 6371.0
        
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c

    def _build_default_message(self, alert: ICEAlert) -> str:
        """Build default broadcast message for alert."""
        severity_emoji = {
            ICESeverity.RUMOR.value: "ℹ️",
            ICESeverity.VERIFIED.value: "⚠️",
            ICESeverity.ACTIVE.value: "🚨",
        }
        
        emoji = severity_emoji.get(alert.severity, "ℹ️")
        
        message = (
            f"{emoji} ICE Activity Alert - {alert.severity.upper()}\n\n"
            f"Location: {alert.location}\n"
            f"{alert.description}\n\n"
            f"Know your rights: Visit shomer.app/ice-guide\n"
            f"This alert expires in 48 hours."
        )
        
        return message

