"""Tests for NLP API endpoints."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestNLPEndpoint:
    """Tests for /nlp/score endpoint."""

    def test_score_text_basic(self):
        """Test basic text scoring."""
        response = client.post(
            "/api/v1/nlp/score",
            json={"text": "I will attack the school with a gun"},
        )

        assert response.status_code == 200
        data = response.json()

        assert "threat_prob" in data
        assert "hate_prob" in data
        assert "risk_factors" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "breakdown" in data

        assert 0 <= data["threat_prob"] <= 1
        assert 0 <= data["hate_prob"] <= 1
        assert 0 <= data["risk_score"] <= 100

    def test_score_text_with_timestamp(self):
        """Test scoring with timestamp."""
        response = client.post(
            "/api/v1/nlp/score",
            json={
                "text": "I will attack",
                "timestamp": "2025-01-01T02:00:00",  # Night time
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Night time should contribute to risk score
        assert data["breakdown"]["time_score"] > 0

    def test_score_text_with_user_history(self):
        """Test scoring with user history."""
        response = client.post(
            "/api/v1/nlp/score",
            json={
                "text": "test",
                "user_id": "user123",
                "previous_warnings": 3,
                "previous_incidents": 1,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # History should contribute to risk score
        assert data["breakdown"]["history_score"] > 0

    def test_score_text_with_locations(self):
        """Test scoring with detected locations."""
        response = client.post(
            "/api/v1/nlp/score",
            json={
                "text": "attack near school",
                "detected_locations": ["school", "mall"],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Locations should contribute to proximity score
        assert data["breakdown"]["proximity_score"] > 0

    def test_empty_text_error(self):
        """Test that empty text is rejected."""
        response = client.post(
            "/api/v1/nlp/score",
            json={"text": ""},
        )

        assert response.status_code == 422  # Validation error

    def test_missing_text_error(self):
        """Test that missing text is rejected."""
        response = client.post(
            "/api/v1/nlp/score",
            json={},
        )

        assert response.status_code == 422  # Validation error

    def test_threat_detection(self):
        """Test threat detection in endpoint."""
        response = client.post(
            "/api/v1/nlp/score",
            json={"text": "I will kill them all"},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["threat_prob"] > 0
        assert len(data["risk_factors"]) > 0

    def test_benign_text(self):
        """Test benign text produces low scores."""
        response = client.post(
            "/api/v1/nlp/score",
            json={"text": "I love learning new things"},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["threat_prob"] < 0.1
        assert data["hate_prob"] < 0.1
        assert data["risk_level"] == "LOW"

    def test_health_check(self):
        """Test NLP service health check."""
        response = client.get("/api/v1/nlp/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["service"] == "nlp"

    def test_negative_warnings_error(self):
        """Test that negative warnings are rejected."""
        response = client.post(
            "/api/v1/nlp/score",
            json={
                "text": "test",
                "previous_warnings": -1,
            },
        )

        assert response.status_code == 422  # Validation error

    def test_negative_incidents_error(self):
        """Test that negative incidents are rejected."""
        response = client.post(
            "/api/v1/nlp/score",
            json={
                "text": "test",
                "previous_incidents": -1,
            },
        )

        assert response.status_code == 422  # Validation error

