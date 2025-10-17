"""Text classifier with rule-based and optional ML support."""

import re
from typing import Any

from .keywords import (
    HATE_KEYWORDS,
    TARGET_KEYWORDS,
    THREAT_KEYWORDS,
    URGENCY_KEYWORDS,
    WEAPON_KEYWORDS,
)


class ClassifierConfig:
    """Configuration for classifier weights and thresholds."""

    # Keyword weights
    THREAT_WEIGHT: float = 0.35
    HATE_WEIGHT: float = 0.30
    WEAPON_WEIGHT: float = 0.40
    URGENCY_WEIGHT: float = 0.20
    TARGET_WEIGHT: float = 0.25

    # Thresholds for probability conversion
    THREAT_THRESHOLD: float = 0.5
    HATE_THRESHOLD: float = 0.4

    # ML model settings
    USE_ML_MODEL: bool = False
    ML_MODEL_NAME: str = "distilbert-base-uncased-finetuned-sst-2-english"
    ML_WEIGHT: float = 0.3  # Weight given to ML predictions

    @classmethod
    def update(cls, **kwargs: Any) -> None:
        """Update configuration values."""
        for key, value in kwargs.items():
            if hasattr(cls, key):
                setattr(cls, key, value)


class TextClassifier:
    """Hybrid text classifier using rules and optional ML."""

    def __init__(self, config: ClassifierConfig | None = None):
        """Initialize classifier."""
        self.config = config or ClassifierConfig()
        self._ml_pipeline = None

        # Try to load ML model if enabled
        if self.config.USE_ML_MODEL:
            self._load_ml_model()

    def _load_ml_model(self) -> None:
        """Load HuggingFace model (guarded import)."""
        try:
            from transformers import pipeline

            self._ml_pipeline = pipeline(
                "text-classification",
                model=self.config.ML_MODEL_NAME,
                device=-1,  # CPU
            )
        except ImportError:
            print(
                "Warning: transformers not installed. Running in rule-only mode."
            )
            self.config.USE_ML_MODEL = False
        except Exception as e:
            print(f"Warning: Could not load ML model: {e}. Running in rule-only mode.")
            self.config.USE_ML_MODEL = False

    def _normalize_text(self, text: str) -> str:
        """Normalize text for analysis."""
        return text.lower().strip()

    def _count_keywords(self, text: str, keywords: list[str]) -> int:
        """Count keyword matches in text."""
        normalized = self._normalize_text(text)
        count = 0

        for keyword in keywords:
            # Use word boundaries for more accurate matching
            pattern = r"\b" + re.escape(keyword) + r"\b"
            matches = re.findall(pattern, normalized)
            count += len(matches)

        return count

    def _calculate_rule_score(
        self, text: str, keywords: list[str], weight: float, max_count: int = 5
    ) -> float:
        """Calculate rule-based score for a category."""
        count = self._count_keywords(text, keywords)
        # Normalize count to 0-1 range, with diminishing returns
        normalized_count = min(count, max_count) / max_count
        return normalized_count * weight

    def _get_ml_scores(self, text: str) -> dict[str, float]:
        """Get ML model predictions if available."""
        if not self._ml_pipeline:
            return {"threat": 0.0, "hate": 0.0}

        try:
            result = self._ml_pipeline(text[:512])[0]  # Limit text length
            # Simple mapping - in production, use a proper multi-label model
            score = result["score"] if result["label"] == "NEGATIVE" else 0.0
            return {"threat": score * 0.5, "hate": score * 0.5}
        except Exception as e:
            print(f"ML prediction error: {e}")
            return {"threat": 0.0, "hate": 0.0}

    def score_text(self, text: str) -> dict[str, Any]:
        """
        Score text for threats, hate speech, and identify risk factors.

        Args:
            text: Input text to analyze

        Returns:
            dict with threat_prob, hate_prob, and risk_factors
        """
        if not text or not text.strip():
            return {
                "threat_prob": 0.0,
                "hate_prob": 0.0,
                "risk_factors": [],
            }

        # Rule-based scores
        threat_score = self._calculate_rule_score(
            text, THREAT_KEYWORDS, self.config.THREAT_WEIGHT
        )
        hate_score = self._calculate_rule_score(
            text, HATE_KEYWORDS, self.config.HATE_WEIGHT
        )
        weapon_score = self._calculate_rule_score(
            text, WEAPON_KEYWORDS, self.config.WEAPON_WEIGHT
        )
        urgency_score = self._calculate_rule_score(
            text, URGENCY_KEYWORDS, self.config.URGENCY_WEIGHT, max_count=3
        )
        target_score = self._calculate_rule_score(
            text, TARGET_KEYWORDS, self.config.TARGET_WEIGHT, max_count=3
        )

        # Combine scores for threat probability
        rule_threat_prob = min(
            threat_score + weapon_score + urgency_score + target_score, 1.0
        )
        rule_hate_prob = min(hate_score, 1.0)

        # Add ML scores if available
        ml_scores = self._get_ml_scores(text)

        # Weighted combination
        if self.config.USE_ML_MODEL and self._ml_pipeline:
            threat_prob = (
                rule_threat_prob * (1 - self.config.ML_WEIGHT)
                + ml_scores["threat"] * self.config.ML_WEIGHT
            )
            hate_prob = (
                rule_hate_prob * (1 - self.config.ML_WEIGHT)
                + ml_scores["hate"] * self.config.ML_WEIGHT
            )
        else:
            threat_prob = rule_threat_prob
            hate_prob = rule_hate_prob

        # Identify risk factors
        risk_factors = []

        if threat_score > 0:
            risk_factors.append(
                f"Threat language detected ({self._count_keywords(text, THREAT_KEYWORDS)} instances)"
            )
        if hate_score > 0:
            risk_factors.append(
                f"Hate speech detected ({self._count_keywords(text, HATE_KEYWORDS)} instances)"
            )
        if weapon_score > 0:
            risk_factors.append(
                f"Weapon mentions ({self._count_keywords(text, WEAPON_KEYWORDS)} instances)"
            )
        if urgency_score > 0:
            risk_factors.append("Time-sensitive urgency language")
        if target_score > 0:
            risk_factors.append("Specific target location mentioned")

        return {
            "threat_prob": round(threat_prob, 4),
            "hate_prob": round(hate_prob, 4),
            "risk_factors": risk_factors,
        }


# Global classifier instance
_classifier_instance: TextClassifier | None = None


def get_classifier() -> TextClassifier:
    """Get or create global classifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = TextClassifier()
    return _classifier_instance


def score_text(text: str) -> dict[str, Any]:
    """
    Convenience function to score text using the global classifier.

    Args:
        text: Input text to analyze

    Returns:
        dict with threat_prob, hate_prob, and risk_factors
    """
    classifier = get_classifier()
    return classifier.score_text(text)

