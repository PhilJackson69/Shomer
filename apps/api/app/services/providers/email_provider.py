"""Email provider using SendGrid."""

from typing import Any

from app.core.config import settings
from app.services.providers.base import AlertProvider, AlertResult


class EmailProvider(AlertProvider):
    """Email provider using SendGrid API."""

    def __init__(self, dev_mode: bool = False):
        """Initialize email provider."""
        super().__init__(dev_mode)
        self.client = None

        # Initialize SendGrid client if credentials available
        if not dev_mode and self._has_credentials():
            self._init_client()

    def _has_credentials(self) -> bool:
        """Check if SendGrid credentials are configured."""
        return bool(settings.SENDGRID_API_KEY)

    def _init_client(self) -> None:
        """Initialize SendGrid client."""
        try:
            from sendgrid import SendGridAPIClient

            self.client = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        except ImportError:
            print("Warning: sendgrid package not installed. Email will use dev mode.")
            self.client = None
        except Exception as e:
            print(f"Warning: Failed to initialize SendGrid client: {e}")
            self.client = None

    async def send(
        self,
        to: str,
        subject: str | None,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send email via SendGrid.

        Args:
            to: Email address
            subject: Email subject
            body: Email body (plain text or HTML)
            metadata: Additional metadata (can include 'from_email', 'from_name')

        Returns:
            AlertResult with send status
        """
        # Dev mode: print to console
        if self.dev_mode or not self.client:
            self._console_output("EMAIL", to, subject, body, metadata)
            return AlertResult(
                success=True,
                channel="email",
                recipient=to,
                message="[DEV MODE] Email printed to console",
            )

        # Production: send via SendGrid
        try:
            from sendgrid.helpers.mail import Mail

            # Get from address (use metadata or default)
            from_email = (metadata or {}).get("from_email", "noreply@shomer.app")
            from_name = (metadata or {}).get("from_name", "Shomer")

            # Create message
            message = Mail(
                from_email=(from_email, from_name),
                to_emails=to,
                subject=subject or "Alert from Shomer",
                plain_text_content=body,
            )

            # Send
            response = self.client.send(message)

            return AlertResult(
                success=True,
                channel="email",
                recipient=to,
                message=f"Email sent successfully (status: {response.status_code})",
                provider_response={
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                },
            )

        except Exception as e:
            return AlertResult(
                success=False,
                channel="email",
                recipient=to,
                message=f"Failed to send email: {str(e)}",
                error=str(e),
            )

