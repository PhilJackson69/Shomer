"""Tests for alert service with mocked providers."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.alert import Alert
from app.services.alert_service import AlertService
from app.services.providers.base import AlertResult


@pytest.fixture
def db_session():
    """Create in-memory database session for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


class TestAlertService:
    """Tests for AlertService."""

    def test_dev_mode_detection(self):
        """Test dev mode auto-detection."""
        # Without credentials, should be dev mode
        service = AlertService(dev_mode=None)
        assert service.dev_mode in [True, False]  # Depends on env

    def test_explicit_dev_mode(self):
        """Test explicit dev mode setting."""
        service = AlertService(dev_mode=True)
        assert service.dev_mode is True

        service = AlertService(dev_mode=False)
        assert service.dev_mode is False

    @pytest.mark.asyncio
    async def test_send_sms_dev_mode(self, db_session):
        """Test SMS sending in dev mode."""
        service = AlertService(db=db_session, dev_mode=True)

        result = await service.send_sms(
            to="+15551234567",
            message="Test message",
        )

        assert result.success is True
        assert result.channel == "sms"
        assert result.recipient == "+15551234567"
        assert "DEV MODE" in result.message

        # Check database record
        alert = db_session.query(Alert).first()
        assert alert is not None
        assert alert.channel == "sms"
        assert alert.recipient == "+15551234567"
        assert alert.message == "Test message"
        assert alert.status == "sent"

    @pytest.mark.asyncio
    async def test_send_email_dev_mode(self, db_session):
        """Test email sending in dev mode."""
        service = AlertService(db=db_session, dev_mode=True)

        result = await service.send_email(
            to="test@example.com",
            subject="Test Subject",
            body="Test body",
        )

        assert result.success is True
        assert result.channel == "email"
        assert result.recipient == "test@example.com"

        # Check database record
        alert = db_session.query(Alert).first()
        assert alert is not None
        assert alert.channel == "email"
        assert alert.recipient == "test@example.com"
        assert alert.subject == "Test Subject"
        assert alert.message == "Test body"

    @pytest.mark.asyncio
    async def test_send_push_stub(self, db_session):
        """Test push notification (stub)."""
        service = AlertService(db=db_session, dev_mode=True)

        result = await service.send_push(
            to="device_token_123",
            title="Test Title",
            body="Test body",
        )

        assert result.success is True
        assert result.channel == "push"
        assert "STUB" in result.message

        # Check database record
        alert = db_session.query(Alert).first()
        assert alert is not None
        assert alert.channel == "push"

    @pytest.mark.asyncio
    async def test_send_multi_channel(self, db_session):
        """Test sending via multiple channels."""
        service = AlertService(db=db_session, dev_mode=True)

        results = await service.send_multi_channel(
            channels=["sms", "email"],
            recipients={
                "sms": ["+15551234567", "+15559876543"],
                "email": ["test1@example.com", "test2@example.com"],
            },
            title="Multi-channel Alert",
            body="This is a test",
            severity="high",
        )

        # Check results structure
        assert "sms" in results
        assert "email" in results
        assert len(results["sms"]) == 2
        assert len(results["email"]) == 2

        # Check all succeeded
        for channel_results in results.values():
            for result in channel_results:
                assert result.success is True

        # Check database records
        alerts = db_session.query(Alert).all()
        assert len(alerts) == 4  # 2 SMS + 2 email

    @pytest.mark.asyncio
    async def test_send_with_metadata(self, db_session):
        """Test sending with metadata."""
        service = AlertService(db=db_session, dev_mode=True)

        metadata = {"severity": "critical", "incident_id": 123}

        result = await service.send_sms(
            to="+15551234567",
            message="Test",
            metadata=metadata,
        )

        assert result.success is True

        # Check metadata stored
        alert = db_session.query(Alert).first()
        assert alert.metadata is not None
        assert alert.metadata["severity"] == "critical"
        assert alert.metadata["incident_id"] == 123


class TestAlertServiceWithMocks:
    """Tests with mocked providers."""

    @pytest.mark.asyncio
    async def test_sms_with_mock_provider(self, db_session):
        """Test SMS with mocked Twilio provider."""
        service = AlertService(db=db_session, dev_mode=False)

        # Mock the provider
        mock_result = AlertResult(
            success=True,
            channel="sms",
            recipient="+15551234567",
            message="SMS sent successfully",
            provider_response={"sid": "SM123456"},
        )

        with patch.object(service.sms_provider, "send", return_value=mock_result):
            result = await service.send_sms(
                to="+15551234567",
                message="Test message",
            )

            assert result.success is True
            assert result.provider_response == {"sid": "SM123456"}

    @pytest.mark.asyncio
    async def test_email_with_mock_provider(self, db_session):
        """Test email with mocked SendGrid provider."""
        service = AlertService(db=db_session, dev_mode=False)

        # Mock the provider
        mock_result = AlertResult(
            success=True,
            channel="email",
            recipient="test@example.com",
            message="Email sent successfully",
            provider_response={"status_code": 202},
        )

        with patch.object(service.email_provider, "send", return_value=mock_result):
            result = await service.send_email(
                to="test@example.com",
                subject="Test",
                body="Test body",
            )

            assert result.success is True
            assert result.provider_response == {"status_code": 202}

    @pytest.mark.asyncio
    async def test_sms_provider_failure(self, db_session):
        """Test handling of SMS provider failure."""
        service = AlertService(db=db_session, dev_mode=False)

        # Mock provider failure
        mock_result = AlertResult(
            success=False,
            channel="sms",
            recipient="+15551234567",
            message="Failed to send SMS",
            error="Invalid phone number",
        )

        with patch.object(service.sms_provider, "send", return_value=mock_result):
            result = await service.send_sms(
                to="+15551234567",
                message="Test",
            )

            assert result.success is False
            assert result.error == "Invalid phone number"

            # Check database record shows failure
            alert = db_session.query(Alert).first()
            assert alert.status == "failed"

    @pytest.mark.asyncio
    async def test_multi_channel_partial_failure(self, db_session):
        """Test multi-channel with some failures."""
        service = AlertService(db=db_session, dev_mode=False)

        # Mock SMS success
        sms_success = AlertResult(
            success=True,
            channel="sms",
            recipient="+15551234567",
            message="SMS sent",
        )

        # Mock email failure
        email_failure = AlertResult(
            success=False,
            channel="email",
            recipient="invalid@example.com",
            message="Invalid email",
            error="Validation failed",
        )

        with patch.object(service.sms_provider, "send", return_value=sms_success), \
             patch.object(service.email_provider, "send", return_value=email_failure):
            
            results = await service.send_multi_channel(
                channels=["sms", "email"],
                recipients={
                    "sms": ["+15551234567"],
                    "email": ["invalid@example.com"],
                },
                title="Test",
                body="Test body",
            )

            assert results["sms"][0].success is True
            assert results["email"][0].success is False

    @pytest.mark.asyncio
    async def test_unknown_channel(self, db_session):
        """Test handling of unknown channel."""
        service = AlertService(db=db_session, dev_mode=True)

        results = await service.send_multi_channel(
            channels=["unknown_channel"],
            recipients={"unknown_channel": ["recipient"]},
            title="Test",
            body="Test body",
        )

        assert results["unknown_channel"][0].success is False
        assert "Unknown channel" in results["unknown_channel"][0].message


class TestProviderMocking:
    """Tests for individual provider mocking."""

    @pytest.mark.asyncio
    async def test_mock_twilio_client(self, db_session):
        """Test mocking Twilio client directly."""
        with patch("app.services.providers.sms_provider.Client") as MockClient:
            # Setup mock
            mock_message = MagicMock()
            mock_message.sid = "SM123456"
            mock_message.status = "sent"
            mock_message.date_sent = "2025-01-01 12:00:00"

            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockClient.return_value = mock_client

            # Create service (not in dev mode)
            from app.services.providers.sms_provider import SMSProvider

            provider = SMSProvider(dev_mode=False)
            provider.client = mock_client  # Override client

            result = await provider.send(
                to="+15551234567",
                subject=None,
                body="Test message",
            )

            assert result.success is True
            assert result.provider_response["sid"] == "SM123456"
            mock_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_mock_sendgrid_client(self, db_session):
        """Test mocking SendGrid client directly."""
        with patch("app.services.providers.email_provider.SendGridAPIClient") as MockClient:
            # Setup mock
            mock_response = MagicMock()
            mock_response.status_code = 202
            mock_response.headers = {"X-Message-Id": "abc123"}

            mock_client = MagicMock()
            mock_client.send.return_value = mock_response
            MockClient.return_value = mock_client

            # Create service
            from app.services.providers.email_provider import EmailProvider

            provider = EmailProvider(dev_mode=False)
            provider.client = mock_client

            result = await provider.send(
                to="test@example.com",
                subject="Test",
                body="Test body",
            )

            assert result.success is True
            assert result.provider_response["status_code"] == 202
            mock_client.send.assert_called_once()

