"""Base provider interface for alert channels."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class AlertResult:
    """Result of an alert send operation."""

    success: bool
    channel: str
    recipient: str | None = None
    message: str | None = None
    provider_response: Any | None = None
    error: str | None = None


class AlertProvider(ABC):
    """Base class for alert channel providers."""

    def __init__(self, dev_mode: bool = False):
        """
        Initialize provider.

        Args:
            dev_mode: If True, print to console instead of actually sending
        """
        self.dev_mode = dev_mode

    @abstractmethod
    async def send(
        self,
        to: str,
        subject: str | None,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send alert via this channel.

        Args:
            to: Recipient identifier (phone, email, device token)
            subject: Alert subject/title (may be None for SMS)
            body: Alert body/message
            metadata: Additional metadata

        Returns:
            AlertResult with success status and details
        """
        pass

    def _console_output(
        self,
        channel: str,
        to: str,
        subject: str | None,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Print alert to console in dev mode."""
        print("\n" + "=" * 80)
        print(f"[DEV MODE] {channel.upper()} Alert")
        print("=" * 80)
        print(f"To: {to}")
        if subject:
            print(f"Subject: {subject}")
        print(f"\n{body}")
        if metadata:
            print(f"\nMetadata: {metadata}")
        print("=" * 80 + "\n")

