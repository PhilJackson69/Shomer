"""Monitoring and error tracking with Sentry and custom metrics."""

import asyncio
import logging
import os
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlAlchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from app.core.config import settings


class MonitoringService:
    """Centralized monitoring and error tracking service."""
    
    def __init__(self):
        """Initialize monitoring service."""
        self.sentry_enabled = False
        self._setup_sentry()
        self._setup_logging()
    
    def _setup_sentry(self):
        """Setup Sentry error tracking."""
        sentry_dsn = os.getenv("SENTRY_DSN")
        if not sentry_dsn:
            logging.warning("SENTRY_DSN not found, Sentry monitoring disabled")
            return
        
        try:
            sentry_sdk.init(
                dsn=sentry_dsn,
                environment=os.getenv("ENVIRONMENT", "development"),
                release=os.getenv("RELEASE_VERSION", "1.0.0"),
                integrations=[
                    FastApiIntegration(auto_enabling=True),
                    SqlAlchemyIntegration(),
                    RedisIntegration(),
                    LoggingIntegration(
                        level=logging.INFO,
                        event_level=logging.ERROR
                    ),
                ],
                traces_sample_rate=0.1,  # 10% of transactions
                profiles_sample_rate=0.1,  # 10% of profiles
                send_default_pii=False,  # Don't send personally identifiable info
                before_send=self._before_send_filter,
                before_send_transaction=self._before_send_transaction_filter,
            )
            
            self.sentry_enabled = True
            logging.info("Sentry monitoring initialized successfully")
            
        except Exception as e:
            logging.error(f"Failed to initialize Sentry: {e}")
    
    def _setup_logging(self):
        """Setup structured logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(),
                # Add file handler in production
                logging.FileHandler('app.log') if os.getenv("ENVIRONMENT") == "production" else logging.NullHandler()
            ]
        )
    
    def _before_send_filter(self, event, hint):
        """Filter events before sending to Sentry."""
        # Remove sensitive data
        if 'request' in event:
            request = event['request']
            if 'data' in request:
                # Remove passwords and tokens
                data = request['data']
                if isinstance(data, dict):
                    for key in ['password', 'token', 'secret', 'key']:
                        if key in data:
                            data[key] = '[REDACTED]'
        
        # Add custom tags
        event.setdefault('tags', {}).update({
            'service': 'shomer-api',
            'version': os.getenv("RELEASE_VERSION", "1.0.0")
        })
        
        return event
    
    def _before_send_transaction_filter(self, event, hint):
        """Filter transactions before sending to Sentry."""
        # Add custom tags to transactions
        event.setdefault('tags', {}).update({
            'service': 'shomer-api',
            'version': os.getenv("RELEASE_VERSION", "1.0.0")
        })
        
        return event
    
    def capture_exception(self, exception: Exception, context: Optional[Dict[str, Any]] = None):
        """Capture an exception with context."""
        if self.sentry_enabled:
            with sentry_sdk.push_scope() as scope:
                if context:
                    for key, value in context.items():
                        scope.set_context(key, value)
                
                sentry_sdk.capture_exception(exception)
        
        # Also log locally
        logging.error(f"Exception captured: {exception}", exc_info=True)
    
    def capture_message(self, message: str, level: str = "info", context: Optional[Dict[str, Any]] = None):
        """Capture a message with context."""
        if self.sentry_enabled:
            with sentry_sdk.push_scope() as scope:
                if context:
                    for key, value in context.items():
                        scope.set_context(key, value)
                
                sentry_sdk.capture_message(message, level)
        
        # Also log locally
        log_level = getattr(logging, level.upper(), logging.INFO)
        logging.log(log_level, message)
    
    def set_user_context(self, user_id: str, username: Optional[str] = None, email: Optional[str] = None):
        """Set user context for error tracking."""
        if self.sentry_enabled:
            sentry_sdk.set_user({
                "id": user_id,
                "username": username,
                "email": email
            })
    
    def set_tag(self, key: str, value: str):
        """Set a tag for error tracking."""
        if self.sentry_enabled:
            sentry_sdk.set_tag(key, value)
    
    def set_context(self, key: str, context: Dict[str, Any]):
        """Set context for error tracking."""
        if self.sentry_enabled:
            sentry_sdk.set_context(key, context)
    
    def security_event(self, event: str, labels: Optional[Dict[str, Any]] = None):
        """Record lightweight security telemetry events.

        Example events: csrf_invalid, rl_blocked, idem_duplicate
        """
        labels = labels or {}
        try:
            logging.getLogger("security").info("security_event", extra={"event": event, **labels})
        except Exception:
            pass
    
    def start_transaction(self, name: str, op: str = "http.server") -> Optional[sentry_sdk.Transaction]:
        """Start a performance transaction."""
        if self.sentry_enabled:
            return sentry_sdk.start_transaction(name=name, op=op)
        return None
    
    def add_breadcrumb(self, message: str, category: str = "default", level: str = "info", data: Optional[Dict[str, Any]] = None):
        """Add a breadcrumb for debugging."""
        if self.sentry_enabled:
            sentry_sdk.add_breadcrumb(
                message=message,
                category=category,
                level=level,
                data=data
            )
    
    def capture_ingestion_error(self, error: Exception, feed_type: str, feed_name: str, context: Optional[Dict[str, Any]] = None):
        """Capture ingestion-specific errors."""
        error_context = {
            "ingestion": {
                "feed_type": feed_type,
                "feed_name": feed_name,
                "error_type": type(error).__name__,
                "error_message": str(error)
            }
        }
        
        if context:
            error_context.update(context)
        
        self.capture_exception(error, error_context)
        self.set_tag("error_category", "ingestion")
    
    def capture_database_error(self, error: Exception, operation: str, table: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """Capture database-specific errors."""
        error_context = {
            "database": {
                "operation": operation,
                "table": table,
                "error_type": type(error).__name__,
                "error_message": str(error)
            }
        }
        
        if context:
            error_context.update(context)
        
        self.capture_exception(error, error_context)
        self.set_tag("error_category", "database")
    
    def capture_auth_error(self, error: Exception, user_id: Optional[str] = None, ip_address: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """Capture authentication-specific errors."""
        error_context = {
            "authentication": {
                "user_id": user_id,
                "ip_address": ip_address,
                "error_type": type(error).__name__,
                "error_message": str(error)
            }
        }
        
        if context:
            error_context.update(context)
        
        self.capture_exception(error, error_context)
        self.set_tag("error_category", "authentication")


# Global monitoring service instance
_monitoring_service: Optional[MonitoringService] = None


def get_monitoring_service() -> MonitoringService:
    """Get or create global monitoring service."""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService()
    return _monitoring_service


# Convenience functions
def capture_exception(exception: Exception, context: Optional[Dict[str, Any]] = None):
    """Capture an exception with context."""
    service = get_monitoring_service()
    service.capture_exception(exception, context)


def capture_message(message: str, level: str = "info", context: Optional[Dict[str, Any]] = None):
    """Capture a message with context."""
    service = get_monitoring_service()
    service.capture_message(message, level, context)


def set_user_context(user_id: str, username: Optional[str] = None, email: Optional[str] = None):
    """Set user context for error tracking."""
    service = get_monitoring_service()
    service.set_user_context(user_id, username, email)


def set_tag(key: str, value: str):
    """Set a tag for error tracking."""
    service = get_monitoring_service()
    service.set_tag(key, value)


def set_context(key: str, context: Dict[str, Any]):
    """Set context for error tracking."""
    service = get_monitoring_service()
    service.set_context(key, context)


def security_event(event: str, labels: Optional[Dict[str, Any]] = None):
    """Emit a security telemetry event."""
    service = get_monitoring_service()
    service.security_event(event, labels)


def start_transaction(name: str, op: str = "http.server") -> Optional[sentry_sdk.Transaction]:
    """Start a performance transaction."""
    service = get_monitoring_service()
    return service.start_transaction(name, op)


def add_breadcrumb(message: str, category: str = "default", level: str = "info", data: Optional[Dict[str, Any]] = None):
    """Add a breadcrumb for debugging."""
    service = get_monitoring_service()
    service.add_breadcrumb(message, category, level, data)


# Slack notification service
class SlackNotificationService:
    """Service for sending error notifications to Slack."""
    
    def __init__(self, webhook_url: Optional[str] = None):
        """Initialize Slack notification service."""
        self.webhook_url = webhook_url or os.getenv("SLACK_WEBHOOK_URL")
        self.enabled = bool(self.webhook_url)
    
    async def send_error_notification(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        severity: str = "error"
    ):
        """Send error notification to Slack."""
        if not self.enabled:
            return
        
        try:
            import aiohttp
            
            # Format error message
            error_message = f"🚨 *{severity.upper()}* in Shomer API\n\n"
            error_message += f"*Error:* {type(error).__name__}\n"
            error_message += f"*Message:* {str(error)}\n"
            error_message += f"*Time:* {datetime.now(timezone.utc).isoformat()}\n"
            
            if context:
                error_message += f"*Context:*\n"
                for key, value in context.items():
                    error_message += f"  • {key}: {value}\n"
            
            # Send to Slack
            payload = {
                "text": error_message,
                "username": "Shomer Monitor",
                "icon_emoji": ":warning:"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=payload) as response:
                    if response.status != 200:
                        logging.error(f"Failed to send Slack notification: {response.status}")
        
        except Exception as e:
            logging.error(f"Failed to send Slack notification: {e}")


# Global Slack service instance
_slack_service: Optional[SlackNotificationService] = None


def get_slack_service() -> SlackNotificationService:
    """Get or create global Slack service."""
    global _slack_service
    if _slack_service is None:
        _slack_service = SlackNotificationService()
    return _slack_service
