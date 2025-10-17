"""Example configuration for Shomer NLP module.

Copy this file to config.py and customize as needed.
"""

from shomer_nlp.classifier import ClassifierConfig
from shomer_nlp.risk_scorer import RiskScorerConfig


# Classifier Configuration
def get_classifier_config() -> ClassifierConfig:
    """Get custom classifier configuration."""
    config = ClassifierConfig()

    # Adjust keyword weights (0.0 - 1.0)
    config.THREAT_WEIGHT = 0.35
    config.HATE_WEIGHT = 0.30
    config.WEAPON_WEIGHT = 0.40
    config.URGENCY_WEIGHT = 0.20
    config.TARGET_WEIGHT = 0.25

    # ML model settings
    config.USE_ML_MODEL = False  # Set to True to enable HuggingFace models
    config.ML_MODEL_NAME = "distilbert-base-uncased-finetuned-sst-2-english"
    config.ML_WEIGHT = 0.3  # Weight given to ML predictions (0.0 - 1.0)

    # Thresholds for probability conversion
    config.THREAT_THRESHOLD = 0.5
    config.HATE_THRESHOLD = 0.4

    return config


# Risk Scorer Configuration
def get_risk_scorer_config() -> RiskScorerConfig:
    """Get custom risk scorer configuration."""
    config = RiskScorerConfig()

    # Score fusion weights (should sum to 1.0)
    config.CONTENT_WEIGHT = 0.50  # Content analysis
    config.TIME_WEIGHT = 0.15  # Time of day
    config.PROXIMITY_WEIGHT = 0.20  # Location proximity
    config.HISTORY_WEIGHT = 0.15  # User history

    # Time-based boosting
    config.NIGHT_HOURS_START = 22  # 10 PM
    config.NIGHT_HOURS_END = 6  # 6 AM
    config.NIGHT_BOOST = 0.30  # 30% boost during night hours

    # High-risk locations (add community-specific locations)
    config.HIGH_RISK_LOCATIONS = [
        "school",
        "synagogue",
        "mosque",
        "church",
        "temple",
        "mall",
        "stadium",
        "yeshiva",  # Example: Add specific locations
        "community center",
    ]

    # Proximity keywords
    config.PROXIMITY_KEYWORDS = [
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
    config.HISTORY_WARNING_THRESHOLD = 2  # Number of warnings before max score
    config.HISTORY_INCIDENT_THRESHOLD = 1  # Number of incidents before max score

    return config


# Usage:
# from config import get_classifier_config, get_risk_scorer_config
# from shomer_nlp import TextClassifier, RiskScorer
#
# classifier = TextClassifier(get_classifier_config())
# scorer = RiskScorer(get_risk_scorer_config())

