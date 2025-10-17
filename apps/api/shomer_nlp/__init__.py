"""Shomer NLP module for text classification and risk scoring."""

from .classifier import TextClassifier, score_text
from .enhanced_classifier import EnhancedTextClassifier, enhanced_score_text
from .risk_scorer import RiskScorer
from .deduplication import DeduplicationService, get_deduplication_service, check_for_duplicates
from .confidence_normalizer import ConfidenceNormalizer, get_confidence_normalizer, normalize_confidence

__all__ = [
    "TextClassifier", 
    "score_text",
    "EnhancedTextClassifier", 
    "enhanced_score_text",
    "RiskScorer",
    "DeduplicationService",
    "get_deduplication_service", 
    "check_for_duplicates",
    "ConfidenceNormalizer",
    "get_confidence_normalizer",
    "normalize_confidence"
]

