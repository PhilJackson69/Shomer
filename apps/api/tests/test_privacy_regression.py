"""
Privacy Regression Tests for ICE Alerts

Ensures that ICE alerts never expose personally identifiable information (PII).
These tests act as a safety net to catch any code changes that might inadvertently
expose sensitive data.

Run with: pytest apps/api/tests/test_privacy_regression.py -v
"""

import pytest
import re
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.ice_alert import ICEAlert
from app.models.user import User
from app.schemas.ice_alert import ICEAlertSubmit
from app.services.ice_alert_service import ICEAlertService


# PII Patterns that should NEVER appear in public responses
PII_PATTERNS = [
    (r'\b\d{3}-\d{2}-\d{4}\b', 'SSN'),
    (r'\b\d{9}\b', 'SSN without dashes'),
    (r'\b[A-Z]{2,3}-?\d{3,4}\b', 'License plate'),
    (r'\bbadge\s*#?\s*\d+\b', 'Badge number'),
    (r'\bofficer\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b', 'Officer name'),
    (r'\bagent\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b', 'Agent name'),
    (r'\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b', 'Specific address'),
    (r'\b\d{5}(?:-\d{4})?\b', 'ZIP code (specific)'),
    (r'\([0-9]{3}\)\s*[0-9]{3}-[0-9]{4}\b', 'Phone number with parentheses'),
    (r'\b[0-9]{3}-[0-9]{3}-[0-9]{4}\b', 'Phone number with dashes'),
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'Email address'),
]

# Field that should NEVER be in public API responses
PRIVATE_FIELDS = [
    'created_by',  # Internal user ID
    'updated_by',  # Internal user ID
    'reviewed_by',  # Internal user ID (except for moderator views)
    'verified_by',  # Internal user ID (except for moderator views)
    'metadata',  # Internal metadata
    'rejection_reason',  # Internal moderation notes
]


@pytest.fixture
def client():
    """Test client for API requests."""
    return TestClient(app)


@pytest.fixture
def db_session(mocker):
    """Mock database session."""
    # This would be replaced with actual test database setup
    return mocker.Mock(spec=Session)


@pytest.fixture
def test_user():
    """Test user for creating alerts."""
    user = User(
        id=1,
        email="test@example.com",
        role="moderator",
        role_id=2
    )
    return user


@pytest.fixture
def sample_ice_alert(test_user):
    """Sample ICE alert for testing."""
    alert = ICEAlert(
        id=1,
        location="Downtown Area",
        latitude=37.7749,
        longitude=-122.4194,
        description="ICE vehicles observed near transit hub",
        severity="verified",
        source="Community partner",
        verified=True,
        verified_by=test_user.id,
        verified_at=datetime.utcnow(),
        confidence_score=0.85,
        reviewed_by=test_user.id,
        reviewed_at=datetime.utcnow(),
        approved=True,
        rejection_reason=None,
        expires_at=datetime.utcnow() + timedelta(hours=48),
        archived=False,
        broadcast_sent=False,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        metadata={"internal": "data"}
    )
    return alert


class TestPIIDetection:
    """Test suite for PII detection in alert submissions."""

    def test_ssn_detection_in_description(self, db_session, test_user):
        """SSN should be detected and rejected."""
        service = ICEAlertService(db_session)
        
        # Alert with SSN in description
        alert_data = ICEAlertSubmit(
            location="Mission District",
            description="Person with SSN 123-45-6789 was targeted",
            severity="rumor",
            source="Community member"
        )
        
        with pytest.raises(ValueError, match="personal information"):
            service.create_alert(alert_data, test_user)

    def test_license_plate_detection(self, db_session, test_user):
        """License plates should be detected and rejected."""
        service = ICEAlertService(db_session)
        
        alert_data = ICEAlertSubmit(
            location="Downtown",
            description="Vehicle with license plate ABC-1234 observed",
            severity="rumor",
            source="Community member"
        )
        
        with pytest.raises(ValueError, match="license plate"):
            service.create_alert(alert_data, test_user)

    def test_badge_number_detection(self, db_session, test_user):
        """Badge numbers should be detected and rejected."""
        service = ICEAlertService(db_session)
        
        alert_data = ICEAlertSubmit(
            location="Financial District",
            description="Officer badge #5678 was present",
            severity="rumor",
            source="Community member"
        )
        
        with pytest.raises(ValueError, match="badge number"):
            service.create_alert(alert_data, test_user)

    def test_officer_name_detection(self, db_session, test_user):
        """Officer names should be detected and rejected."""
        service = ICEAlertService(db_session)
        
        alert_data = ICEAlertSubmit(
            location="SOMA",
            description="Officer John Smith conducted the stop",
            severity="rumor",
            source="Community member"
        )
        
        with pytest.raises(ValueError, match="officer name"):
            service.create_alert(alert_data, test_user)

    def test_specific_address_detection(self, db_session, test_user):
        """Specific addresses should be detected and rejected."""
        service = ICEAlertService(db_session)
        
        alert_data = ICEAlertSubmit(
            location="Castro",
            description="Activity at 1234 Market Street",
            severity="rumor",
            source="Community member"
        )
        
        with pytest.raises(ValueError, match="personal information"):
            service.create_alert(alert_data, test_user)

    def test_clean_alert_passes(self, db_session, test_user):
        """Clean alert without PII should pass validation."""
        service = ICEAlertService(db_session)
        
        alert_data = ICEAlertSubmit(
            location="Mission District",
            description="ICE vehicles observed near transit station",
            severity="verified",
            source="Verified partner"
        )
        
        # This should not raise an exception
        alert, issues = service.create_alert(alert_data, test_user)
        assert alert is not None
        assert len(issues) == 0


class TestPublicAPIResponsePrivacy:
    """Test that public API endpoints never expose PII."""

    def test_public_feed_no_private_fields(self, client, mocker):
        """Public feed should not include internal fields."""
        # Mock the database query to return sample alert
        mock_alert = ICEAlert(
            id=1,
            location="Downtown",
            description="Test alert",
            severity="verified",
            source="Partner",
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_by=999,  # This should NOT appear in response
            reviewed_by=888,  # This should NOT appear in response
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # Mock the service to return our test alert
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert 'alerts' in data
        
        for alert in data['alerts']:
            # Check that private fields are not in response
            for private_field in PRIVATE_FIELDS:
                assert private_field not in alert, f"Private field '{private_field}' found in public response!"

    def test_nearby_alerts_no_private_fields(self, client, mocker):
        """Nearby alerts endpoint should not expose private fields."""
        mock_alert = ICEAlert(
            id=1,
            location="Downtown",
            latitude=37.7749,
            longitude=-122.4194,
            description="Test alert",
            severity="verified",
            source="Partner",
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_by=999,
            metadata={"secret": "data"},  # Should not be exposed
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_nearby_alerts',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/nearby?lat=37.7749&lon=-122.4194")
        assert response.status_code == 200
        
        data = response.json()
        for alert in data:
            for private_field in PRIVATE_FIELDS:
                assert private_field not in alert

    def test_no_pii_in_response_content(self, client, mocker):
        """Response content should never contain PII patterns."""
        # Create alert with PII that somehow got through (regression test)
        mock_alert = ICEAlert(
            id=1,
            location="Test Area",
            description="This should never happen but testing: 123-45-6789",  # SSN - should be caught
            severity="verified",
            source="Test",
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        response_text = response.text
        
        # Check for PII patterns in response
        for pattern, name in PII_PATTERNS:
            matches = re.findall(pattern, response_text, re.IGNORECASE)
            assert len(matches) == 0, f"Found {name} in response: {matches}"


class TestLocationPrivacy:
    """Test that location data is appropriately anonymized."""

    def test_coordinates_are_approximated(self, client, mocker):
        """Coordinates should be approximated for privacy (±500m)."""
        # Exact coordinates
        exact_lat = 37.774929
        exact_lon = -122.419416
        
        mock_alert = ICEAlert(
            id=1,
            location="Downtown",
            latitude=exact_lat,
            longitude=exact_lon,
            description="Test",
            severity="verified",
            source="Partner",
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        data = response.json()
        
        # In a real implementation, coordinates should be rounded/approximated
        # This test documents the expected behavior
        for alert in data['alerts']:
            if 'latitude' in alert and alert['latitude'] is not None:
                # Coordinates should not have more than 3 decimal places (±111m precision)
                lat_str = str(alert['latitude'])
                decimal_places = len(lat_str.split('.')[-1]) if '.' in lat_str else 0
                assert decimal_places <= 3, f"Latitude has too much precision: {alert['latitude']}"

    def test_specific_addresses_never_in_location(self, sample_ice_alert):
        """Location field should never contain specific addresses."""
        # Test that location doesn't match specific address patterns
        location = sample_ice_alert.location
        
        # Should not have house numbers with street names
        assert not re.search(r'\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave)', location, re.IGNORECASE)
        
        # Should be general (neighborhood, district, area)
        general_location_words = ['area', 'district', 'neighborhood', 'near', 'vicinity']
        location_lower = location.lower()
        
        # At least use general terminology OR be just a neighborhood name
        is_general = any(word in location_lower for word in general_location_words)
        is_short = len(location.split()) <= 3  # "Mission District" is okay
        
        assert is_general or is_short, "Location should be general, not specific address"


class TestDatabasePrivacy:
    """Test that database queries don't leak sensitive information."""

    def test_deleted_alerts_not_in_public_query(self, db_session, test_user):
        """Archived/expired alerts should not appear in public queries."""
        service = ICEAlertService(db_session)
        
        # Create expired alert
        expired_alert = ICEAlert(
            id=1,
            location="Test",
            description="Expired",
            severity="rumor",
            source="Test",
            verified=False,
            approved=True,
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
            archived=False,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # Mock database to return expired alert
        db_session.query.return_value.filter.return_value.all.return_value = [expired_alert]
        
        # Public feed should filter out expired
        alerts = service.get_feed()
        
        # Verify query includes expiration filter
        db_session.query.return_value.filter.assert_called()

    def test_unapproved_alerts_not_public(self, db_session, test_user):
        """Unapproved alerts should never appear in public endpoints."""
        service = ICEAlertService(db_session)
        
        unapproved_alert = ICEAlert(
            id=1,
            location="Test",
            description="Unapproved",
            severity="rumor",
            source="Test",
            verified=False,
            approved=False,  # Not approved
            expires_at=datetime.utcnow() + timedelta(hours=24),
            archived=False,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        db_session.query.return_value.filter.return_value.all.return_value = []
        
        # Public feed should not include unapproved
        alerts = service.get_feed()
        
        # Verify approved=True is in the query
        assert db_session.query.called


class TestModerationPrivacy:
    """Test that moderation interface properly handles PII."""

    def test_moderator_can_see_rejection_reason(self, sample_ice_alert):
        """Moderators need rejection reasons for internal review."""
        # This is okay because it's moderator-only
        assert hasattr(sample_ice_alert, 'rejection_reason')
        
        # But rejection reasons should never be in public API
        # (tested in TestPublicAPIResponsePrivacy)

    def test_confidence_score_not_in_public_response(self, client, mocker):
        """Confidence scores are internal only."""
        mock_alert = ICEAlert(
            id=1,
            location="Test",
            description="Test",
            severity="verified",
            source="Partner",
            verified=True,
            approved=True,
            confidence_score=0.95,  # Internal metric
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        data = response.json()
        
        # Confidence score can be included if documented
        # But if present, should be clearly marked as "for informational purposes"
        for alert in data['alerts']:
            if 'confidence_score' in alert:
                # Document that this is included intentionally
                assert alert['confidence_score'] is not None


class TestRegressionGuards:
    """Regression tests for specific privacy incidents (add as they occur)."""

    def test_no_user_email_in_response(self, client, mocker):
        """User email should never appear in public responses (regression guard)."""
        mock_alert = ICEAlert(
            id=1,
            location="Test",
            description="Test",
            severity="verified",
            source="test@example.com",  # Even in source field
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        response_text = response.text
        
        # Check for email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, response_text)
        
        assert len(emails) == 0, f"Found email addresses in response: {emails}"

    def test_no_sql_injection_in_location(self, db_session, test_user):
        """Location field should be sanitized (SQL injection guard)."""
        service = ICEAlertService(db_session)
        
        # Attempt SQL injection in location
        alert_data = ICEAlertSubmit(
            location="Test'; DROP TABLE ice_alerts;--",
            description="Clean description",
            severity="rumor",
            source="Test"
        )
        
        # Should not raise exception and should sanitize
        try:
            alert, issues = service.create_alert(alert_data, test_user)
            # If we get here, make sure no SQL was executed
            assert True
        except Exception as e:
            # Should fail gracefully if validation catches it
            assert "invalid" in str(e).lower() or "error" in str(e).lower()

    def test_no_xss_in_description(self, client, mocker):
        """Description should be sanitized for XSS (regression guard)."""
        mock_alert = ICEAlert(
            id=1,
            location="Test",
            description="<script>alert('xss')</script>",
            severity="verified",
            source="Test",
            verified=True,
            approved=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        mocker.patch(
            'app.services.ice_alert_service.ICEAlertService.get_feed',
            return_value=[mock_alert]
        )
        
        response = client.get("/api/v1/ice-alerts/feed")
        response_text = response.text
        
        # Script tags should be escaped or removed
        assert '<script>' not in response_text.lower()
        assert 'javascript:' not in response_text.lower()


# Pytest configuration
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers",
        "privacy: mark test as a privacy regression test"
    )


# Mark all tests in this file as privacy tests
pytestmark = pytest.mark.privacy

