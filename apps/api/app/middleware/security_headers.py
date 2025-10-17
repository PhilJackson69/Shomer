"""
Security headers middleware with logging redaction.

Provides comprehensive security headers and sensitive data redaction
for production-ready security posture.
"""

import re
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# Patterns for redacting sensitive data from logs (NOT API responses)
SENSITIVE_PATTERNS = [
    # Common API key shapes: sk-..., pk-..., Bearer <jwt>
    (re.compile(r'(?i)\b(sk|pk|rk)-[A-Za-z0-9]{16,}\b'), '<REDACTED_TOKEN>'),
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9\-\._]+\.[A-Za-z0-9\-\._]+\.[A-Za-z0-9\-\._]+\b'), 'Bearer <REDACTED_JWT>'),
    # API keys, secrets, tokens in key=value format
    (re.compile(r'(?i)(api[-_ ]?key|secret|token|password|pwd)\s*[:=]\s*[^,\s]+'), r'\1:<REDACTED>'),
    # Email addresses
    (re.compile(r'[\w\.-]+@[\w\.-]+\.\w+'), '<REDACTED_EMAIL>'),
    # Phone numbers
    (re.compile(r'(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})'), '<REDACTED_PHONE>'),
    # Credit card numbers (basic pattern)
    (re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'), '<REDACTED_CC>'),
    # SSN (basic pattern)
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '<REDACTED_SSN>'),
]

# Security headers for production
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    # COEP is powerful but brittle; enable later when you audit third-party assets
    # "Cross-Origin-Embedder-Policy": "require-corp",
    # HSTS (only enable when serving over HTTPS)
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    # Minimal CSP for MVP; tighten with nonces/hashes later
    "Content-Security-Policy": (
        "default-src 'self'; "
        "img-src 'self' data: blob: https:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self' https: http://localhost:*; "
        "font-src 'self' data:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
}


def redact_sensitive_data(text: str) -> str:
    """
    Redact sensitive information from text for logging.
    
    Args:
        text: Input text that may contain sensitive data
        
    Returns:
        Text with sensitive patterns redacted
    """
    if not text:
        return text
        
    redacted = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
        
    return redacted


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers and redact sensitive data from logs.
    
    Adds comprehensive security headers to all responses and provides
    utility for redacting sensitive data from log messages.
    """
    
    def __init__(self, app, enable_hsts: bool = False):
        super().__init__(app)
        self.enable_hsts = enable_hsts
        
    async def dispatch(self, request: Request, call_next):
        """Process request and add security headers to response."""
        # Process the request
        response: Response = await call_next(request)
        
        # Add security headers (avoid clobbering existing ones)
        headers_to_add = SECURITY_HEADERS.copy()
        
        # Conditionally add HSTS based on configuration
        if not self.enable_hsts:
            headers_to_add.pop("Strict-Transport-Security", None)
            
        # Add headers that aren't already set
        for header_name, header_value in headers_to_add.items():
            if header_name not in response.headers:
                response.headers[header_name] = header_value
                
        return response


class LoggingRedactionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to redact sensitive data from request/response logging.
    
    This middleware doesn't modify requests/responses but provides
    utilities for other middleware to redact sensitive data.
    """
    
    async def dispatch(self, request: Request, call_next):
        """Process request and store redaction utilities."""
        # Store redaction function in request state for use by other middleware
        request.state.redact = redact_sensitive_data
        
        response = await call_next(request)
        return response
