"""Push notification provider (stub implementation)."""

from typing import Any

from app.services.providers.base import AlertProvider, AlertResult


class PushProvider(AlertProvider):
    """
    Push notification provider (stub).

    This is a placeholder for future implementation with services like:
    - Firebase Cloud Messaging (FCM)
    - Apple Push Notification Service (APNS)
    - OneSignal
    - Pusher
    """

    async def send(
        self,
        to: str,
        subject: str | None,
        body: str,
        metadata: dict[str, Any] | None = None,
    ) -> AlertResult:
        """
        Send push notification (stub).

        Args:
            to: Device token or user ID
            subject: Notification title
            body: Notification body
            metadata: Additional metadata (can include badge, sound, data)

        Returns:
            AlertResult (always successful in stub mode)
        """
        # Always print to console in stub mode
        self._console_output("PUSH", to, subject, body, metadata)

        return AlertResult(
            success=True,
            channel="push",
            recipient=to,
            message="[STUB] Push notification logged (not actually sent)",
            provider_response={"stub": True, "implementation": "pending"},
        )


# Example implementation for when push is needed:
"""
class FCMPushProvider(AlertProvider):
    '''Push notification via Firebase Cloud Messaging.'''
    
    def __init__(self, dev_mode: bool = False):
        super().__init__(dev_mode)
        if not dev_mode:
            import firebase_admin
            from firebase_admin import credentials, messaging
            
            # Initialize Firebase
            cred = credentials.Certificate('path/to/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.messaging = messaging
    
    async def send(self, to: str, subject: str | None, body: str,
                   metadata: dict[str, Any] | None = None) -> AlertResult:
        if self.dev_mode:
            self._console_output("PUSH", to, subject, body, metadata)
            return AlertResult(success=True, channel="push", recipient=to,
                             message="[DEV MODE] Push printed to console")
        
        try:
            message = self.messaging.Message(
                notification=self.messaging.Notification(
                    title=subject or "Alert",
                    body=body
                ),
                token=to,  # Device token
                data=metadata or {}
            )
            
            response = self.messaging.send(message)
            
            return AlertResult(
                success=True,
                channel="push",
                recipient=to,
                message=f"Push sent successfully: {response}",
                provider_response={"message_id": response}
            )
        except Exception as e:
            return AlertResult(
                success=False,
                channel="push",
                recipient=to,
                message=f"Failed to send push: {str(e)}",
                error=str(e)
            )
"""

