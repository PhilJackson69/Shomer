# Shomer NLP Module

Minimal NLP module for text classification and risk scoring in the Shomer platform.

## Overview

This module provides:
1. **Text Classification**: Hybrid rule-based and optional ML approach for detecting threats, hate speech, weapons mentions
2. **Risk Scoring**: Fuses content analysis with contextual factors (time, location proximity, user history) into a 0-100 risk score

## Architecture

### Classifier (`classifier.py`)

The `TextClassifier` uses:
- **Rule-based detection**: Keyword matching with configurable weights
- **Optional ML**: HuggingFace pipeline support (guarded imports, falls back to rule-only if unavailable)
- **Deterministic scoring**: Consistent results for reproducibility

Categories detected:
- Threat language
- Hate speech
- Weapon mentions
- Urgency indicators
- Target locations

### Risk Scorer (`risk_scorer.py`)

The `RiskScorer` fuses multiple signals:
- **Content score (50%)**: Threat and hate probabilities from classifier
- **Time score (15%)**: Night hour boost (10 PM - 6 AM)
- **Proximity score (20%)**: High-risk location mentions with proximity keywords
- **History score (15%)**: User's previous warnings and incidents

Output: Risk score 0-100 with level (LOW, MEDIUM, HIGH, CRITICAL)

## Usage

### Basic Classification

```python
from shomer_nlp import score_text

result = score_text("Sample text to analyze")
print(result)
# {
#   "threat_prob": 0.75,
#   "hate_prob": 0.20,
#   "risk_factors": ["Threat language detected (2 instances)", ...]
# }
```

### Risk Scoring

```python
from shomer_nlp import TextClassifier, RiskScorer
from datetime import datetime

classifier = TextClassifier()
scorer = RiskScorer()

text = "I will attack the school tonight"

# Classify
classification = classifier.score_text(text)

# Score risk
risk = scorer.calculate_risk_score(
    text=text,
    threat_prob=classification["threat_prob"],
    hate_prob=classification["hate_prob"],
    risk_factors=classification["risk_factors"],
    timestamp=datetime.now(),
    user_id="user123",
    previous_warnings=2
)

print(risk)
# {
#   "risk_score": 78.5,
#   "risk_level": "HIGH",
#   "breakdown": {
#     "content_score": 75.0,
#     "time_score": 30.0,
#     "proximity_score": 80.0,
#     "history_score": 50.0
#   }
# }
```

### Via API Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/nlp/score \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I will attack the school tonight",
    "timestamp": "2025-01-01T23:00:00",
    "user_id": "user123",
    "previous_warnings": 2
  }'
```

## Configuration

### Classifier Configuration

```python
from shomer_nlp.classifier import ClassifierConfig, TextClassifier

config = ClassifierConfig()
config.THREAT_WEIGHT = 0.40  # Adjust weights
config.HATE_WEIGHT = 0.35
config.WEAPON_WEIGHT = 0.45
config.USE_ML_MODEL = True  # Enable HuggingFace model

classifier = TextClassifier(config)
```

### Risk Scorer Configuration

```python
from shomer_nlp.risk_scorer import RiskScorerConfig, RiskScorer

config = RiskScorerConfig()
config.CONTENT_WEIGHT = 0.60  # Adjust fusion weights
config.TIME_WEIGHT = 0.15
config.PROXIMITY_WEIGHT = 0.15
config.HISTORY_WEIGHT = 0.10
config.NIGHT_HOURS_START = 21  # 9 PM
config.HIGH_RISK_LOCATIONS.append("stadium")  # Add custom locations

scorer = RiskScorer(config)
```

## Optional ML Support

To enable HuggingFace models:

```bash
# Install ML dependencies
pip install -e ".[ml]"

# Or manually
pip install transformers torch
```

If ML dependencies are not installed, the module automatically falls back to rule-only mode.

## Keywords

Keywords are defined in `keywords.py`:
- `THREAT_KEYWORDS`: Violence, harm, attack terms
- `HATE_KEYWORDS`: Discriminatory, dehumanizing terms
- `WEAPON_KEYWORDS`: Firearms, explosives, weapons
- `URGENCY_KEYWORDS`: Time-sensitive indicators
- `TARGET_KEYWORDS`: Potential target locations

These lists are configurable and can be extended based on domain needs.

## Testing

```bash
# Run tests
pytest tests/test_nlp.py -v

# Run with coverage
pytest tests/test_nlp.py --cov=shomer_nlp

# Test deterministic behavior
pytest tests/test_nlp.py::TestTextClassifier::test_deterministic_scoring
```

## Design Principles

1. **Fail gracefully**: ML support is optional, falls back to rules
2. **Deterministic**: Rule-based scoring is reproducible
3. **Configurable**: All weights and thresholds can be tuned
4. **Transparent**: Risk factors and score breakdown are provided
5. **Testable**: Comprehensive test coverage for rule logic

## Future Enhancements

- Fine-tuned multi-label classification models
- Language-specific models (Hebrew, Arabic, etc.)
- Real-time model updates
- Active learning from incident feedback
- Explainable AI features
- Context-aware embeddings

