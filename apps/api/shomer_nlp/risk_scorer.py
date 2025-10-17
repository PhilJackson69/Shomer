"""Risk scorer that fuses multiple signals into a 0-100 risk score."""

from datetime import datetime, time
from typing import Any


class RiskScorerConfig:
    """Configuration for risk scoring."""

    # Score weights (should sum to 1.0)
    CONTENT_WEIGHT: float = 0.50  # Content analysis weight
    TIME_WEIGHT: float = 0.15  # Time of day weight
    PROXIMITY_WEIGHT: float = 0.20  # Location proximity weight
    HISTORY_WEIGHT: float = 0.15  # User history weight

    # Time-based boosting
    NIGHT_HOURS_START: int = 22  # 10 PM
    NIGHT_HOURS_END: int = 6  # 6 AM
    NIGHT_BOOST: float = 0.30  # 30% boost during night hours

    # High-risk locations (configurable list)
    HIGH_RISK_LOCATIONS: list[str] = [
        "school",
        "synagogue",
        "mosque",
        "church",
        "temple",
        "mall",
        "stadium",
    ]

    # Proximity detection keywords
    PROXIMITY_KEYWORDS: list[str] = [
        "near",
        "at",
        "in",
        "nearby",
        "close to",
        "next to",
        "outside",
        "inside",
    ]

    # User history thresholds
    HISTORY_WARNING_THRESHOLD: int = 2  # Number of previous warnings
    HISTORY_INCIDENT_THRESHOLD: int = 1  # Number of previous incidents

    @classmethod
    def update(cls, **kwargs: Any) -> None:
        """Update configuration values."""
        for key, value in kwargs.items():
            if hasattr(cls, key):
                setattr(cls, key, value)


class RiskScorer:
    """Fuses multiple signals to calculate risk score (0-100)."""

    def __init__(self, config: RiskScorerConfig | None = None):
        """Initialize risk scorer."""
        self.config = config or RiskScorerConfig()

    def _calculate_content_score(
        self, threat_prob: float, hate_prob: float, risk_factors: list[str]
    ) -> float:
        """
        Calculate content-based risk score (0-1).

        Args:
            threat_prob: Threat probability from classifier
            hate_prob: Hate speech probability from classifier
            risk_factors: List of detected risk factors

        Returns:
            Content score between 0 and 1
        """
        # Weighted combination of threat and hate
        base_score = (threat_prob * 0.7) + (hate_prob * 0.3)

        # Boost based on number of risk factors
        factor_boost = min(len(risk_factors) * 0.1, 0.3)

        return min(base_score + factor_boost, 1.0)

    def _calculate_time_score(self, timestamp: datetime | None = None) -> float:
        """
        Calculate time-based risk score (0-1).

        Night hours get a boost as they may indicate planning/urgency.

        Args:
            timestamp: Time of the event (defaults to now)

        Returns:
            Time score between 0 and 1
        """
        if timestamp is None:
            timestamp = datetime.now()

        hour = timestamp.hour

        # Check if in night hours
        if self.config.NIGHT_HOURS_START <= hour or hour < self.config.NIGHT_HOURS_END:
            return self.config.NIGHT_BOOST

        return 0.0

    def _calculate_proximity_score(
        self, text: str, detected_locations: list[str] | None = None
    ) -> float:
        """
        Calculate proximity risk score (0-1).

        Higher score if text mentions high-risk locations with proximity keywords.

        Args:
            text: Original text content
            detected_locations: Optional list of detected location names

        Returns:
            Proximity score between 0 and 1
        """
        text_lower = text.lower()
        score = 0.0

        # Check for high-risk locations
        mentioned_locations = []
        for location in self.config.HIGH_RISK_LOCATIONS:
            if location in text_lower:
                mentioned_locations.append(location)

        # If locations mentioned, check for proximity keywords
        if mentioned_locations:
            has_proximity = any(
                keyword in text_lower for keyword in self.config.PROXIMITY_KEYWORDS
            )

            # Base score for location mention
            score = 0.4 * len(mentioned_locations)

            # Boost if proximity is indicated
            if has_proximity:
                score += 0.4

        # Consider additional detected locations
        if detected_locations:
            score += min(len(detected_locations) * 0.2, 0.3)

        return min(score, 1.0)

    def _calculate_history_score(
        self,
        user_id: str | None = None,
        previous_warnings: int = 0,
        previous_incidents: int = 0,
    ) -> float:
        """
        Calculate user history risk score (0-1).

        Args:
            user_id: User identifier
            previous_warnings: Number of previous warnings
            previous_incidents: Number of previous incidents

        Returns:
            History score between 0 and 1
        """
        if user_id is None:
            return 0.0  # No history available

        score = 0.0

        # Score based on previous warnings
        if previous_warnings > 0:
            warning_score = min(
                previous_warnings / self.config.HISTORY_WARNING_THRESHOLD, 1.0
            )
            score += warning_score * 0.5

        # Score based on previous incidents (more serious)
        if previous_incidents > 0:
            incident_score = min(
                previous_incidents / self.config.HISTORY_INCIDENT_THRESHOLD, 1.0
            )
            score += incident_score * 0.5

        return min(score, 1.0)

    def calculate_risk_score(
        self,
        text: str,
        threat_prob: float,
        hate_prob: float,
        risk_factors: list[str],
        timestamp: datetime | None = None,
        detected_locations: list[str] | None = None,
        user_id: str | None = None,
        previous_warnings: int = 0,
        previous_incidents: int = 0,
    ) -> dict[str, Any]:
        """
        Calculate comprehensive risk score (0-100).

        Args:
            text: Original text content
            threat_prob: Threat probability from classifier
            hate_prob: Hate speech probability from classifier
            risk_factors: List of detected risk factors
            timestamp: Time of the event
            detected_locations: List of detected location names
            user_id: User identifier
            previous_warnings: Number of previous warnings for user
            previous_incidents: Number of previous incidents for user

        Returns:
            dict with risk_score (0-100) and breakdown of components
        """
        # Calculate individual scores
        content_score = self._calculate_content_score(
            threat_prob, hate_prob, risk_factors
        )
        time_score = self._calculate_time_score(timestamp)
        proximity_score = self._calculate_proximity_score(text, detected_locations)
        history_score = self._calculate_history_score(
            user_id, previous_warnings, previous_incidents
        )

        # Weighted fusion
        risk_score = (
            content_score * self.config.CONTENT_WEIGHT
            + time_score * self.config.TIME_WEIGHT
            + proximity_score * self.config.PROXIMITY_WEIGHT
            + history_score * self.config.HISTORY_WEIGHT
        )

        # Convert to 0-100 scale
        risk_score_100 = round(risk_score * 100, 2)

        # Determine risk level
        if risk_score_100 >= 75:
            risk_level = "CRITICAL"
        elif risk_score_100 >= 50:
            risk_level = "HIGH"
        elif risk_score_100 >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "risk_score": risk_score_100,
            "risk_level": risk_level,
            "breakdown": {
                "content_score": round(content_score * 100, 2),
                "time_score": round(time_score * 100, 2),
                "proximity_score": round(proximity_score * 100, 2),
                "history_score": round(history_score * 100, 2),
            },
        }

