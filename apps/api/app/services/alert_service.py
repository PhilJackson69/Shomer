"""Alert service for sending notifications via multiple channels."""

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.services.providers.base import AlertProvider, AlertResult
from app.services.providers.email_provider import EmailProvider
from app.services.providers.push_provider import PushProvider
from app.services.providers.sms_provider import SMSProvider


class AlertService:
    """
    Unified alert service supporting multiple channels.

    Channels:
    - SMS (via Twilio)
    - Email (via SendGrid)
    - Push (stub for future implementation)
    """

    def __init__(self, db: Session | None = None, dev_mode: bool | None = None):
        """
        Initialize alert service.

        Args:
            db: Database session for storing alert records
            dev_mode: If True, print to console instead of sending. Auto-detected if None.
        """
        self.db = db
        self.dev_mode = dev_mode if dev_mode is not None else self._is_dev_mode()

        # Initialize providers
        self.sms_provider = SMSProvider(dev_mode=self.dev_mode)
        self.email_provider = EmailProvider(dev_mode=self.dev_mode)
        self.push_provider = PushProvider(dev_mode=self.dev_mode)

        self.providers: dict[str, AlertProvider] = {
            "sms": self.sms_provider,
            "email": self.email_provider,
            "push": self.push_provider,
        }

    def _is_dev_mode(self) -> bool:
        """Detect if we're in development mode."""
        # Check if production credentials are configured
        has_twilio = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)
        has_sendgrid = bool(settings.SENDGRID_API_KEY)

        # If no credentials, assume dev mode
        return not (has_twilio or has_sendgrid)

    async def send_sms(
        self,
        to: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send SMS message.

        Args:
            to: Phone number (E.164 format recommended)
            message: Message content
            metadata: Additional metadata to store

        Returns:
            AlertResult with success status and details
        """
        result = await self.sms_provider.send(
            to=to,
            subject=None,
            body=message,
            metadata=metadata,
        )

        # Store in database
        if self.db:
            self._create_alert_record("sms", to, None, message, result, metadata)

        return result

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send email.

        Args:
            to: Email address
            subject: Email subject
            body: Email body (plain text or HTML)
            metadata: Additional metadata to store

        Returns:
            AlertResult with success status and details
        """
        result = await self.email_provider.send(
            to=to,
            subject=subject,
            body=body,
            metadata=metadata,
        )

        # Store in database
        if self.db:
            self._create_alert_record("email", to, subject, body, result, metadata)

        return result

    async def send_push(
        self,
        to: str,
        title: str,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send push notification (stub).

        Args:
            to: Device token or user ID
            title: Notification title
            body: Notification body
            metadata: Additional metadata to store

        Returns:
            AlertResult (always successful in stub mode)
        """
        result = await self.push_provider.send(
            to=to,
            subject=title,
            body=body,
            metadata=metadata,
        )

        # Store in database
        if self.db:
            self._create_alert_record("push", to, title, body, result, metadata)

        return result

    async def send_multi_channel(
        self,
        channels: list[str],
        recipients: dict[str, list[str]],
        title: str,
        body: str,
        severity: str = "medium",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, list[AlertResult]]:
        """
        Send alert via multiple channels.

        Args:
            channels: List of channels to use (sms, email, push)
            recipients: Dict mapping channel to list of recipients
            title: Alert title
            body: Alert body
            severity: Alert severity level
            metadata: Additional metadata

        Returns:
            Dict mapping channel to list of results
        """
        results: dict[str, list[AlertResult]] = {}

        metadata = metadata or {}
        metadata["severity"] = severity
        metadata["title"] = title

        for channel in channels:
            if channel not in self.providers:
                results[channel] = [
                    AlertResult(
                        success=False,
                        channel=channel,
                        message=f"Unknown channel: {channel}",
                    )
                ]
                continue

            channel_recipients = recipients.get(channel, [])
            channel_results = []

            for recipient in channel_recipients:
                try:
                    if channel == "sms":
                        result = await self.send_sms(recipient, body, metadata)
                    elif channel == "email":
                        result = await self.send_email(recipient, title, body, metadata)
                    elif channel == "push":
                        result = await self.send_push(recipient, title, body, metadata)
                    else:
                        result = AlertResult(
                            success=False,
                            channel=channel,
                            message=f"Unsupported channel: {channel}",
                        )

                    channel_results.append(result)

                except Exception as e:
                    channel_results.append(
                        AlertResult(
                            success=False,
                            channel=channel,
                            recipient=recipient,
                            message=f"Error sending to {recipient}: {str(e)}",
                            error=str(e),
                        )
                    )

            results[channel] = channel_results

        return results

    def _create_alert_record(
        self,
        channel: str,
        recipient: str,
        subject: str | None,
        body: str,
        result: AlertResult,
        metadata: dict[str, Any] | None = None,
    ) -> Alert:
        """Create an Alert record in the database."""
        if not self.db:
            raise ValueError("Database session required to create alert record")

        # Determine status
        if result.success:
            status = "sent"
        elif result.message and "pending" in result.message.lower():
            status = "pending"
        else:
            status = "failed"

        # Merge metadata
        full_metadata = metadata or {}
        if result.provider_response:
            full_metadata["provider_response"] = result.provider_response
        if result.error:
            full_metadata["error"] = result.error

        alert = Alert(
            channel=channel,
            recipient=recipient,
            subject=subject,
            message=body,
            status=status,
            sent_at=datetime.utcnow() if result.success else None,
            metadata=full_metadata,
        )

        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)

        return alert

