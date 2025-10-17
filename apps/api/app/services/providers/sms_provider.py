"""SMS provider using Twilio."""

from typing import Any

from app.core.config import settings
from app.services.providers.base import AlertProvider, AlertResult


class SMSProvider(AlertProvider):
    """SMS provider using Twilio API."""

    def __init__(self, dev_mode: bool = False):
        """Initialize SMS provider."""
        super().__init__(dev_mode)
        self.client = None

        # Initialize Twilio client if credentials available
        if not dev_mode and self._has_credentials():
            self._init_client()

    def _has_credentials(self) -> bool:
        """Check if Twilio credentials are configured."""
        return bool(
            settings.TWILIO_ACCOUNT_SID
            and settings.TWILIO_AUTH_TOKEN
            and settings.TWILIO_FROM_NUMBER
        )

    def _init_client(self) -> None:
        """Initialize Twilio client."""
        try:
            from twilio.rest import Client

            self.client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
        except ImportError:
            print("Warning: twilio package not installed. SMS will use dev mode.")
            self.client = None
        except Exception as e:
            print(f"Warning: Failed to initialize Twilio client: {e}")
            self.client = None

    async def send(
        self,
        to: str,
        subject: str | None,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send SMS via Twilio.

        Args:
            to: Phone number (E.164 format recommended, e.g., +15551234567)
            subject: Ignored for SMS
            body: Message content (max 160 chars recommended)
            metadata: Additional metadata

        Returns:
            AlertResult with send status
        """
        # Dev mode: print to console
        if self.dev_mode or not self.client:
            self._console_output("SMS", to, subject, body, metadata)
            return AlertResult(
                success=True,
                channel="sms",
                recipient=to,
                message="[DEV MODE] SMS printed to console",
            )

        # Production: send via Twilio
        try:
            message = self.client.messages.create(
                body=body,
                from_=settings.TWILIO_FROM_NUMBER,
                to=to,
            )

            return AlertResult(
                success=True,
                channel="sms",
                recipient=to,
                message=f"SMS sent successfully (SID: {message.sid})",
                provider_response={
                    "sid": message.sid,
                    "status": message.status,
                    "date_sent": str(message.date_sent),
                },
            )

        except Exception as e:
            return AlertResult(
                success=False,
                channel="sms",
                recipient=to,
                message=f"Failed to send SMS: {str(e)}",
                error=str(e),
            )

