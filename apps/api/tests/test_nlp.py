"""Tests for NLP classification and risk scoring."""

import pytest
from datetime import datetime, time

from shomer_nlp.classifier import ClassifierConfig, TextClassifier
from shomer_nlp.risk_scorer import RiskScorer, RiskScorerConfig


class TestTextClassifier:
    """Tests for text classification."""

    def test_empty_text(self):
        """Test handling of empty text."""
        classifier = TextClassifier()
        result = classifier.score_text("")

        assert result["threat_prob"] == 0.0
        assert result["hate_prob"] == 0.0
        assert result["risk_factors"] == []

    def test_threat_keywords(self):
        """Test threat keyword detection."""
        classifier = TextClassifier()

        # Text with threat keywords
        text = "I will kill and shoot them tomorrow"
        result = classifier.score_text(text)

        assert result["threat_prob"] > 0
        assert len(result["risk_factors"]) > 0
        assert any("Threat language" in factor for factor in result["risk_factors"])

    def test_hate_keywords(self):
        """Test hate speech keyword detection."""
        classifier = TextClassifier()

        # Text with hate keywords
        text = "They are racist bigots and subhuman scum"
        result = classifier.score_text(text)

        assert result["hate_prob"] > 0
        assert any("Hate speech" in factor for factor in result["risk_factors"])

    def test_weapon_keywords(self):
        """Test weapon keyword detection."""
        classifier = TextClassifier()

        # Text with weapon keywords
        text = "I have a gun and rifle with ammunition"
        result = classifier.score_text(text)

        assert result["threat_prob"] > 0
        assert any("Weapon mentions" in factor for factor in result["risk_factors"])

    def test_urgency_keywords(self):
        """Test urgency keyword detection."""
        classifier = TextClassifier()

        # Text with urgency keywords
        text = "We must act now, today, immediately"
        result = classifier.score_text(text)

        assert any(
            "Time-sensitive urgency" in factor for factor in result["risk_factors"]
        )

    def test_target_keywords(self):
        """Test target location keyword detection."""
        classifier = TextClassifier()

        # Text with target keywords
        text = "There will be an attack at the school and synagogue"
        result = classifier.score_text(text)

        assert any(
            "Specific target location" in factor for factor in result["risk_factors"]
        )

    def test_combined_threat(self):
        """Test combined threat with multiple factors."""
        classifier = TextClassifier()

        # High-threat text
        text = "I will kill everyone at the school tomorrow with my gun"
        result = classifier.score_text(text)

        assert result["threat_prob"] > 0.5
        assert len(result["risk_factors"]) >= 3  # Multiple factors

    def test_benign_text(self):
        """Test benign text produces low scores."""
        classifier = TextClassifier()

        # Benign text
        text = "I love going to school and learning new things"
        result = classifier.score_text(text)

        assert result["threat_prob"] < 0.1
        assert result["hate_prob"] < 0.1

    def test_configurable_weights(self):
        """Test that classifier respects custom weights."""
        # Create custom config
        config = ClassifierConfig()
        config.THREAT_WEIGHT = 0.8  # Increase threat weight

        classifier = TextClassifier(config)

        # Text with threat keywords
        text = "I will kill them"
        result = classifier.score_text(text)

        # Should have higher threat probability due to increased weight
        assert result["threat_prob"] > 0

    def test_deterministic_scoring(self):
        """Test that scoring is deterministic for same input."""
        classifier = TextClassifier()

        text = "I will attack the mall with a weapon tonight"

        # Score multiple times
        result1 = classifier.score_text(text)
        result2 = classifier.score_text(text)
        result3 = classifier.score_text(text)

        # Results should be identical
        assert result1["threat_prob"] == result2["threat_prob"]
        assert result1["threat_prob"] == result3["threat_prob"]
        assert result1["hate_prob"] == result2["hate_prob"]
        assert result1["risk_factors"] == result2["risk_factors"]

    def test_keyword_count_accuracy(self):
        """Test accurate counting of keywords."""
        classifier = TextClassifier()

        # Text with multiple instances of same keyword
        text = "kill kill kill"
        result = classifier.score_text(text)

        assert "3 instances" in result["risk_factors"][0]

    def test_word_boundary_matching(self):
        """Test that keyword matching respects word boundaries."""
        classifier = TextClassifier()

        # "skill" contains "kill" but shouldn't match
        text = "I need to improve my skill level"
        result = classifier.score_text(text)

        assert result["threat_prob"] == 0.0
        assert len(result["risk_factors"]) == 0

    def test_case_insensitivity(self):
        """Test that matching is case-insensitive."""
        classifier = TextClassifier()

        text1 = "I will KILL them"
        text2 = "I will kill them"

        result1 = classifier.score_text(text1)
        result2 = classifier.score_text(text2)

        assert result1["threat_prob"] == result2["threat_prob"]


class TestRiskScorer:
    """Tests for risk scoring."""

    def test_content_score_calculation(self):
        """Test content score calculation."""
        scorer = RiskScorer()

        result = scorer.calculate_risk_score(
            text="I will attack",
            threat_prob=0.8,
            hate_prob=0.2,
            risk_factors=["Threat language"],
        )

        assert result["risk_score"] > 0
        assert result["breakdown"]["content_score"] > 0
        assert result["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    def test_night_time_boost(self):
        """Test that night hours increase risk score."""
        scorer = RiskScorer()

        # Night time (2 AM)
        night_time = datetime(2025, 1, 1, 2, 0, 0)
        result_night = scorer.calculate_risk_score(
            text="I will attack",
            threat_prob=0.5,
            hate_prob=0.0,
            risk_factors=[],
            timestamp=night_time,
        )

        # Day time (2 PM)
        day_time = datetime(2025, 1, 1, 14, 0, 0)
        result_day = scorer.calculate_risk_score(
            text="I will attack",
            threat_prob=0.5,
            hate_prob=0.0,
            risk_factors=[],
            timestamp=day_time,
        )

        # Night should have higher time score
        assert result_night["breakdown"]["time_score"] > result_day["breakdown"]["time_score"]

    def test_proximity_score_with_location(self):
        """Test proximity score with high-risk locations."""
        scorer = RiskScorer()

        # Text with high-risk location
        result = scorer.calculate_risk_score(
            text="I will attack near the school",
            threat_prob=0.5,
            hate_prob=0.0,
            risk_factors=[],
        )

        assert result["breakdown"]["proximity_score"] > 0

    def test_no_proximity_without_keywords(self):
        """Test that proximity score is lower without proximity keywords."""
        scorer = RiskScorer()

        # Location without proximity keyword
        result1 = scorer.calculate_risk_score(
            text="school",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
        )

        # Location with proximity keyword
        result2 = scorer.calculate_risk_score(
            text="near school",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
        )

        assert result2["breakdown"]["proximity_score"] > result1["breakdown"]["proximity_score"]

    def test_user_history_score(self):
        """Test user history scoring."""
        scorer = RiskScorer()

        # No history
        result_no_history = scorer.calculate_risk_score(
            text="test",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
            user_id=None,
        )

        # With warnings
        result_with_warnings = scorer.calculate_risk_score(
            text="test",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
            user_id="user123",
            previous_warnings=3,
        )

        # With incidents
        result_with_incidents = scorer.calculate_risk_score(
            text="test",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
            user_id="user123",
            previous_incidents=1,
        )

        assert result_no_history["breakdown"]["history_score"] == 0
        assert result_with_warnings["breakdown"]["history_score"] > 0
        assert result_with_incidents["breakdown"]["history_score"] > 0

    def test_risk_level_thresholds(self):
        """Test risk level assignment based on score."""
        scorer = RiskScorer()

        # Low risk
        result_low = scorer.calculate_risk_score(
            text="hello",
            threat_prob=0.0,
            hate_prob=0.0,
            risk_factors=[],
        )
        assert result_low["risk_level"] == "LOW"

        # High risk
        result_high = scorer.calculate_risk_score(
            text="I will kill everyone at the school tonight",
            threat_prob=0.9,
            hate_prob=0.8,
            risk_factors=["Threat", "Weapon", "Target"],
            timestamp=datetime(2025, 1, 1, 2, 0, 0),  # Night
            user_id="user123",
            previous_incidents=2,
        )
        assert result_high["risk_level"] in ["HIGH", "CRITICAL"]

    def test_score_range(self):
        """Test that risk scores are in valid range (0-100)."""
        scorer = RiskScorer()

        # Maximum threat
        result = scorer.calculate_risk_score(
            text="kill attack bomb school synagogue weapon gun now",
            threat_prob=1.0,
            hate_prob=1.0,
            risk_factors=["A", "B", "C", "D", "E"],
            timestamp=datetime(2025, 1, 1, 2, 0, 0),
            detected_locations=["location1", "location2"],
            user_id="user123",
            previous_warnings=10,
            previous_incidents=5,
        )

        assert 0 <= result["risk_score"] <= 100

    def test_configurable_weights(self):
        """Test that risk scorer respects custom weight configuration."""
        config = RiskScorerConfig()
        config.CONTENT_WEIGHT = 1.0  # Only content matters
        config.TIME_WEIGHT = 0.0
        config.PROXIMITY_WEIGHT = 0.0
        config.HISTORY_WEIGHT = 0.0

        scorer = RiskScorer(config)

        result = scorer.calculate_risk_score(
            text="test",
            threat_prob=0.5,
            hate_prob=0.0,
            risk_factors=[],
            timestamp=datetime(2025, 1, 1, 2, 0, 0),  # Night (should be ignored)
            user_id="user123",
            previous_incidents=5,  # Should be ignored
        )

        # Time and history should have no effect
        assert result["breakdown"]["time_score"] == 0
        assert result["breakdown"]["history_score"] == 0

    def test_deterministic_risk_scoring(self):
        """Test that risk scoring is deterministic."""
        scorer = RiskScorer()

        timestamp = datetime(2025, 1, 1, 14, 0, 0)

        result1 = scorer.calculate_risk_score(
            text="I will attack the mall",
            threat_prob=0.7,
            hate_prob=0.3,
            risk_factors=["Threat", "Target"],
            timestamp=timestamp,
            user_id="user123",
            previous_warnings=2,
        )

        result2 = scorer.calculate_risk_score(
            text="I will attack the mall",
            threat_prob=0.7,
            hate_prob=0.3,
            risk_factors=["Threat", "Target"],
            timestamp=timestamp,
            user_id="user123",
            previous_warnings=2,
        )

        assert result1["risk_score"] == result2["risk_score"]
        assert result1["risk_level"] == result2["risk_level"]
        assert result1["breakdown"] == result2["breakdown"]

    def test_multiple_high_risk_locations(self):
        """Test scoring with multiple high-risk locations."""
        scorer = RiskScorer()

        result = scorer.calculate_risk_score(
            text="attack at school, synagogue, and mall",
            threat_prob=0.5,
            hate_prob=0.0,
            risk_factors=[],
        )

        # Should have elevated proximity score
        assert result["breakdown"]["proximity_score"] > 0


class TestIntegration:
    """Integration tests combining classifier and risk scorer."""

    def test_full_pipeline(self):
        """Test full classification and risk scoring pipeline."""
        classifier = TextClassifier()
        scorer = RiskScorer()

        text = "I will kill everyone at the synagogue tonight with my gun"

        # Classify
        classification = classifier.score_text(text)

        # Score risk
        risk = scorer.calculate_risk_score(
            text=text,
            threat_prob=classification["threat_prob"],
            hate_prob=classification["hate_prob"],
            risk_factors=classification["risk_factors"],
            timestamp=datetime(2025, 1, 1, 23, 0, 0),  # 11 PM
        )

        assert classification["threat_prob"] > 0.5
        assert len(classification["risk_factors"]) > 0
        assert risk["risk_score"] > 50
        assert risk["risk_level"] in ["HIGH", "CRITICAL"]

    def test_benign_text_pipeline(self):
        """Test that benign text produces low risk scores."""
        classifier = TextClassifier()
        scorer = RiskScorer()

        text = "I love learning at school and meeting friends"

        classification = classifier.score_text(text)
        risk = scorer.calculate_risk_score(
            text=text,
            threat_prob=classification["threat_prob"],
            hate_prob=classification["hate_prob"],
            risk_factors=classification["risk_factors"],
        )

        assert classification["threat_prob"] < 0.1
        assert risk["risk_score"] < 25
        assert risk["risk_level"] == "LOW"

