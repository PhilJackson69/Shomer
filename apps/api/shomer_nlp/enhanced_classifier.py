"""Enhanced text classifier with improved models and confidence scoring."""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from .keywords import (
    HATE_KEYWORDS,
    TARGET_KEYWORDS,
    THREAT_KEYWORDS,
    URGENCY_KEYWORDS,
    WEAPON_KEYWORDS,
)


class EnhancedClassifierConfig:
    """Enhanced configuration for classifier with ML models and confidence scoring."""
    
    # Model settings
    USE_HUGGINGFACE: bool = True
    HATE_SPEECH_MODEL: str = "cardiffnlp/twitter-roberta-base-hate-latest"
    SENTIMENT_MODEL: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    TOXICITY_MODEL: str = "unitary/toxic-bert"
    
    # Confidence scoring
    CONFIDENCE_THRESHOLD: float = 0.7
    ENSEMBLE_WEIGHT: float = 0.6  # Weight for ensemble methods
    RULE_WEIGHT: float = 0.4      # Weight for rule-based scoring
    
    # Similarity hashing for deduplication
    SIMILARITY_THRESHOLD: float = 0.85
    MIN_HASH_LENGTH: int = 64
    
    # Keyword weights (enhanced)
    THREAT_WEIGHT: float = 0.4
    HATE_WEIGHT: float = 0.35
    WEAPON_WEIGHT: float = 0.45
    URGENCY_WEIGHT: float = 0.25
    TARGET_WEIGHT: float = 0.3
    
    # Context analysis
    CONTEXT_WINDOW: int = 3  # Words before/after keywords
    CONTEXT_BOOST: float = 0.1
    
    @classmethod
    def update(cls, **kwargs: Any) -> None:
        """Update configuration values."""
        for key, value in kwargs.items():
            if hasattr(cls, key):
                setattr(cls, key, value)


class EnhancedTextClassifier:
    """Enhanced text classifier with ML models, confidence scoring, and deduplication."""
    
    def __init__(self, config: EnhancedClassifierConfig | None = None):
        """Initialize enhanced classifier."""
        self.config = config or EnhancedClassifierConfig()
        self._models = {}
        self._load_models()
    
    def _load_models(self):
        """Load ML models if available."""
        if not self.config.USE_HUGGINGFACE:
            return
        
        try:
            from transformers import pipeline
            
            # Load hate speech detection model
            try:
                self._models['hate_speech'] = pipeline(
                    "text-classification",
                    model=self.config.HATE_SPEECH_MODEL,
                    return_all_scores=True
                )
                print(f"Loaded hate speech model: {self.config.HATE_SPEECH_MODEL}")
            except Exception as e:
                print(f"Failed to load hate speech model: {e}")
            
            # Load sentiment analysis model
            try:
                self._models['sentiment'] = pipeline(
                    "sentiment-analysis",
                    model=self.config.SENTIMENT_MODEL,
                    return_all_scores=True
                )
                print(f"Loaded sentiment model: {self.config.SENTIMENT_MODEL}")
            except Exception as e:
                print(f"Failed to load sentiment model: {e}")
            
            # Load toxicity detection model
            try:
                self._models['toxicity'] = pipeline(
                    "text-classification",
                    model=self.config.TOXICITY_MODEL,
                    return_all_scores=True
                )
                print(f"Loaded toxicity model: {self.config.TOXICITY_MODEL}")
            except Exception as e:
                print(f"Failed to load toxicity model: {e}")
                
        except ImportError:
            print("Transformers library not available. Using rule-based classification only.")
    
    def score_text(self, text: str) -> Dict[str, Any]:
        """
        Score text with enhanced classification and confidence.
        
        Returns:
            Dictionary with enhanced scoring including confidence and context
        """
        if not text or not text.strip():
            return self._empty_result()
        
        # Rule-based scoring
        rule_scores = self._rule_based_scoring(text)
        
        # ML-based scoring
        ml_scores = self._ml_based_scoring(text)
        
        # Ensemble scoring
        ensemble_scores = self._ensemble_scoring(rule_scores, ml_scores)
        
        # Confidence calculation
        confidence = self._calculate_confidence(rule_scores, ml_scores, text)
        
        # Context analysis
        context_analysis = self._analyze_context(text)
        
        # Generate similarity hash for deduplication
        similarity_hash = self._generate_similarity_hash(text)
        
        return {
            "threat_prob": ensemble_scores["threat_prob"],
            "hate_prob": ensemble_scores["hate_prob"],
            "confidence": confidence,
            "similarity_hash": similarity_hash,
            "risk_factors": rule_scores["risk_factors"],
            "ml_predictions": ml_scores,
            "context_analysis": context_analysis,
            "ensemble_method": "rule_ml_hybrid"
        }
    
    def _rule_based_scoring(self, text: str) -> Dict[str, Any]:
        """Enhanced rule-based scoring with context analysis."""
        text_lower = text.lower()
        
        # Count keyword matches with context
        threat_matches = self._count_keywords_with_context(text_lower, THREAT_KEYWORDS)
        hate_matches = self._count_keywords_with_context(text_lower, HATE_KEYWORDS)
        weapon_matches = self._count_keywords_with_context(text_lower, WEAPON_KEYWORDS)
        urgency_matches = self._count_keywords_with_context(text_lower, URGENCY_KEYWORDS)
        target_matches = self._count_keywords_with_context(text_lower, TARGET_KEYWORDS)
        
        # Calculate probabilities with enhanced weighting
        threat_prob = min(threat_matches * self.config.THREAT_WEIGHT, 1.0)
        hate_prob = min(hate_matches * self.config.HATE_WEIGHT, 1.0)
        
        # Add context boost
        context_boost = self._calculate_context_boost(text_lower)
        threat_prob = min(threat_prob + context_boost, 1.0)
        hate_prob = min(hate_prob + context_boost, 1.0)
        
        # Generate risk factors
        risk_factors = []
        if threat_matches > 0:
            risk_factors.append(f"Threat language detected ({threat_matches} instances)")
        if hate_matches > 0:
            risk_factors.append(f"Hate speech indicators ({hate_matches} instances)")
        if weapon_matches > 0:
            risk_factors.append(f"Weapon mentions ({weapon_matches} instances)")
        if urgency_matches > 0:
            risk_factors.append(f"Urgency indicators ({urgency_matches} instances)")
        if target_matches > 0:
            risk_factors.append(f"Target locations mentioned ({target_matches} instances)")
        
        return {
            "threat_prob": threat_prob,
            "hate_prob": hate_prob,
            "risk_factors": risk_factors,
            "keyword_counts": {
                "threat": threat_matches,
                "hate": hate_matches,
                "weapon": weapon_matches,
                "urgency": urgency_matches,
                "target": target_matches
            }
        }
    
    def _ml_based_scoring(self, text: str) -> Dict[str, Any]:
        """ML-based scoring using loaded models."""
        ml_scores = {
            "hate_speech": None,
            "sentiment": None,
            "toxicity": None
        }
        
        if not self._models:
            return ml_scores
        
        try:
            # Hate speech detection
            if 'hate_speech' in self._models:
                hate_results = self._models['hate_speech'](text)
                ml_scores['hate_speech'] = self._process_huggingface_results(hate_results)
            
            # Sentiment analysis
            if 'sentiment' in self._models:
                sentiment_results = self._models['sentiment'](text)
                ml_scores['sentiment'] = self._process_huggingface_results(sentiment_results)
            
            # Toxicity detection
            if 'toxicity' in self._models:
                toxicity_results = self._models['toxicity'](text)
                ml_scores['toxicity'] = self._process_huggingface_results(toxicity_results)
                
        except Exception as e:
            print(f"ML scoring failed: {e}")
        
        return ml_scores
    
    def _ensemble_scoring(self, rule_scores: Dict, ml_scores: Dict) -> Dict[str, float]:
        """Combine rule-based and ML scores using ensemble methods."""
        threat_prob = rule_scores["threat_prob"] * self.config.RULE_WEIGHT
        hate_prob = rule_scores["hate_prob"] * self.config.RULE_WEIGHT
        
        # Add ML contributions if available
        if ml_scores.get('hate_speech'):
            hate_prob += ml_scores['hate_speech'].get('hate_prob', 0) * self.config.ENSEMBLE_WEIGHT
        
        if ml_scores.get('toxicity'):
            toxicity_score = ml_scores['toxicity'].get('toxic_prob', 0)
            threat_prob += toxicity_score * self.config.ENSEMBLE_WEIGHT
        
        return {
            "threat_prob": min(threat_prob, 1.0),
            "hate_prob": min(hate_prob, 1.0)
        }
    
    def _calculate_confidence(self, rule_scores: Dict, ml_scores: Dict, text: str) -> float:
        """Calculate confidence score based on multiple factors."""
        confidence_factors = []
        
        # Rule-based confidence
        rule_confidence = self._calculate_rule_confidence(rule_scores, text)
        confidence_factors.append(rule_confidence)
        
        # ML confidence
        if any(ml_scores.values()):
            ml_confidence = self._calculate_ml_confidence(ml_scores)
            confidence_factors.append(ml_confidence)
        
        # Text quality confidence
        quality_confidence = self._calculate_text_quality_confidence(text)
        confidence_factors.append(quality_confidence)
        
        # Return weighted average
        return np.mean(confidence_factors) if confidence_factors else 0.5
    
    def _calculate_rule_confidence(self, rule_scores: Dict, text: str) -> float:
        """Calculate confidence based on rule-based scoring."""
        # Higher confidence for more specific keyword matches
        keyword_counts = rule_scores.get("keyword_counts", {})
        total_matches = sum(keyword_counts.values())
        
        if total_matches == 0:
            return 0.1  # Low confidence for no matches
        
        # Confidence increases with more matches, but caps at reasonable level
        return min(0.3 + (total_matches * 0.1), 0.9)
    
    def _calculate_ml_confidence(self, ml_scores: Dict) -> float:
        """Calculate confidence based on ML model agreement."""
        confidences = []
        
        for model_name, scores in ml_scores.items():
            if scores and 'confidence' in scores:
                confidences.append(scores['confidence'])
        
        return np.mean(confidences) if confidences else 0.5
    
    def _calculate_text_quality_confidence(self, text: str) -> float:
        """Calculate confidence based on text quality indicators."""
        if len(text) < 10:
            return 0.2  # Low confidence for very short text
        
        if len(text) > 1000:
            return 0.8  # Higher confidence for longer, more detailed text
        
        # Normalize based on length
        return 0.3 + (len(text) / 1000) * 0.5
    
    def _count_keywords_with_context(self, text: str, keywords: List[str]) -> int:
        """Count keywords with context analysis."""
        count = 0
        words = text.split()
        
        for i, word in enumerate(words):
            # Check if word contains any keyword
            for keyword in keywords:
                if keyword in word:
                    # Check context around the word
                    context_start = max(0, i - self.config.CONTEXT_WINDOW)
                    context_end = min(len(words), i + self.config.CONTEXT_WINDOW + 1)
                    context = ' '.join(words[context_start:context_end])
                    
                    # Boost count if context suggests threat
                    if self._is_threatening_context(context):
                        count += 1.5
                    else:
                        count += 1
        
        return int(count)
    
    def _is_threatening_context(self, context: str) -> bool:
        """Determine if context suggests threatening intent."""
        threatening_context_words = [
            'will', 'going to', 'plan to', 'intend to', 'threaten',
            'promise', 'swear', 'vow', 'guarantee'
        ]
        
        return any(word in context.lower() for word in threatening_context_words)
    
    def _calculate_context_boost(self, text: str) -> float:
        """Calculate additional boost based on context analysis."""
        boost = 0.0
        
        # Check for threatening patterns
        threatening_patterns = [
            r'i will \w+',
            r'i am going to \w+',
            r'i plan to \w+',
            r'you will \w+',
            r'we will \w+'
        ]
        
        for pattern in threatening_patterns:
            if re.search(pattern, text):
                boost += self.config.CONTEXT_BOOST
        
        return min(boost, 0.3)  # Cap the boost
    
    def _analyze_context(self, text: str) -> Dict[str, Any]:
        """Analyze contextual information from text."""
        return {
            "length": len(text),
            "word_count": len(text.split()),
            "has_pronouns": bool(re.search(r'\b(i|you|we|they|he|she|it)\b', text.lower())),
            "has_temporal_words": bool(re.search(r'\b(now|today|tomorrow|tonight|soon|immediately)\b', text.lower())),
            "has_location_words": bool(re.search(r'\b(here|there|at|in|near|around)\b', text.lower())),
            "has_caps_lock": text.isupper(),
            "has_exclamation": '!' in text,
            "has_question": '?' in text
        }
    
    def _generate_similarity_hash(self, text: str) -> str:
        """Generate similarity hash for deduplication."""
        # Normalize text for hashing
        normalized = re.sub(r'[^\w\s]', '', text.lower())
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        # Generate hash
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _process_huggingface_results(self, results: List[Dict]) -> Dict[str, float]:
        """Process HuggingFace model results into standardized format."""
        if not results:
            return {}
        
        # Find the highest scoring result
        best_result = max(results, key=lambda x: x['score'])
        
        return {
            'label': best_result['label'],
            'confidence': best_result['score'],
            'hate_prob': best_result['score'] if 'hate' in best_result['label'].lower() else 0.0,
            'toxic_prob': best_result['score'] if 'toxic' in best_result['label'].lower() else 0.0
        }
    
    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result structure."""
        return {
            "threat_prob": 0.0,
            "hate_prob": 0.0,
            "confidence": 0.0,
            "similarity_hash": "",
            "risk_factors": [],
            "ml_predictions": {},
            "context_analysis": {},
            "ensemble_method": "rule_ml_hybrid"
        }


# Convenience function
def enhanced_score_text(text: str) -> Dict[str, Any]:
    """Enhanced text scoring with ML models and confidence."""
    classifier = EnhancedTextClassifier()
    return classifier.score_text(text)
