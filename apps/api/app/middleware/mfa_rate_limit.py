"""MFA Rate Limiting Middleware with Enhanced Security Headers."""

import time
import uuid
from typing import Dict, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class MFARateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for MFA-specific rate limiting and security headers."""
    
    def __init__(self, app, max_attempts: int = 5, window_seconds: int = 300):
        """
        Initialize MFA rate limiting middleware.
        
        Args:
            app: FastAPI application
            max_attempts: Maximum attempts per window
            window_seconds: Time window in seconds (default 5 minutes)
        """
        super().__init__(app)
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: Dict[str, list] = {}
        
        # MFA-specific endpoints that need rate limiting
        self.mfa_endpoints = [
            "/api/v1/mfa/totp/verify",
            "/api/v1/mfa/totp/enable", 
            "/api/v1/mfa/recovery/verify",
            "/api/v1/mfa/webauthn/verify"
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request with MFA rate limiting and security headers."""
        # Check if this is an MFA endpoint
        if not any(request.url.path.startswith(endpoint) for endpoint in self.mfa_endpoints):
            response = await call_next(request)
            # Add security headers to all responses
            return self._add_security_headers(response)
        
        # Generate request ID for tracking
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Extract client identifier (IP + User-Agent hash for better tracking)
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        client_id = f"{client_ip}:{hash(user_agent)}"
        
        # Check rate limit
        if self._is_rate_limited(client_id):
            retry_after = self._get_retry_after(client_id)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Too many MFA attempts.",
                    "retry_after": retry_after,
                    "request_id": request_id
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-Request-ID": request_id,
                    "Cache-Control": "no-store",
                    "X-Rate-Limit-Limit": str(self.max_attempts),
                    "X-Rate-Limit-Remaining": "0",
                    "X-Rate-Limit-Reset": str(int(time.time() + retry_after))
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Record attempt (only for failed attempts to avoid penalizing success)
        if response.status_code >= 400:
            self._record_attempt(client_id)
        
        # Add security headers
        response = self._add_security_headers(response)
        
        # Add request ID to response
        response.headers["X-Request-ID"] = request_id
        
        # Add rate limit headers
        remaining = self._get_remaining_attempts(client_id)
        response.headers["X-Rate-Limit-Limit"] = str(self.max_attempts)
        response.headers["X-Rate-Limit-Remaining"] = str(remaining)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection IP
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _is_rate_limited(self, client_id: str) -> bool:
        """Check if client is rate limited."""
        now = time.time()
        
        # Clean up old attempts
        if client_id in self.attempts:
            self.attempts[client_id] = [
                attempt_time for attempt_time in self.attempts[client_id]
                if now - attempt_time < self.window_seconds
            ]
        else:
            self.attempts[client_id] = []
        
        # Check if limit exceeded
        return len(self.attempts[client_id]) >= self.max_attempts
    
    def _record_attempt(self, client_id: str) -> None:
        """Record a failed attempt for rate limiting."""
        now = time.time()
        
        if client_id not in self.attempts:
            self.attempts[client_id] = []
        
        self.attempts[client_id].append(now)
    
    def _get_retry_after(self, client_id: str) -> int:
        """Get retry-after seconds for rate limited client."""
        if client_id not in self.attempts or not self.attempts[client_id]:
            return self.window_seconds
        
        # Find oldest attempt
        oldest_attempt = min(self.attempts[client_id])
        retry_after = int(self.window_seconds - (time.time() - oldest_attempt))
        
        return max(1, retry_after)
    
    def _get_remaining_attempts(self, client_id: str) -> int:
        """Get remaining attempts for client."""
        if client_id not in self.attempts:
            return self.max_attempts
        
        used_attempts = len(self.attempts[client_id])
        return max(0, self.max_attempts - used_attempts)
    
    def _add_security_headers(self, response: Response) -> Response:
        """Add security headers to response."""
        # Cache control - no caching for MFA endpoints
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # HSTS (if HTTPS)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response


class MFALoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for enhanced MFA audit logging with request ID tracking."""
    
    def __init__(self, app):
        super().__init__(app)
        self.logger = None
        # Initialize logger if available
        try:
            from app.core.logging import get_logger
            self.logger = get_logger(__name__)
        except ImportError:
            import logging
            self.logger = logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next):
        """Process request with enhanced MFA logging."""
        # Generate request ID if not present
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Add request ID to request state for downstream use
        request.state.request_id = request_id
        
        # Log MFA requests
        if request.url.path.startswith("/api/v1/mfa/"):
            self._log_mfa_request(request, request_id)
        
        # Process request
        response = await call_next(request)
        
        # Log MFA responses
        if request.url.path.startswith("/api/v1/mfa/"):
            self._log_mfa_response(request, response, request_id)
        
        return response
    
    def _log_mfa_request(self, request: Request, request_id: str) -> None:
        """Log MFA request details."""
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "timestamp": time.time(),
            "event_type": "mfa_request"
        }
        
        # Add user info if available
        if hasattr(request.state, 'user') and request.state.user:
            log_data["user_id"] = request.state.user.id
            log_data["user_email"] = request.state.user.email
        
        self.logger.info("MFA Request", extra=log_data)
    
    def _log_mfa_response(self, request: Request, response: Response, request_id: str) -> None:
        """Log MFA response details."""
        log_data = {
            "request_id": request_id,
            "status_code": response.status_code,
            "response_time_ms": getattr(request.state, 'response_time_ms', 0),
            "timestamp": time.time(),
            "event_type": "mfa_response"
        }
        
        # Add user info if available
        if hasattr(request.state, 'user') and request.state.user:
            log_data["user_id"] = request.state.user.id
        
        # Log security events
        if response.status_code == 429:
            log_data["security_event"] = "rate_limit_exceeded"
        elif response.status_code >= 400:
            log_data["security_event"] = "mfa_failure"
        
        self.logger.info("MFA Response", extra=log_data)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection IP
        if request.client:
            return request.client.host
        
        return "unknown"
