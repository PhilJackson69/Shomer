"""
Security headers middleware with logging redaction and CSP nonce pipeline.

Provides comprehensive security headers, CSP nonce generation, and sensitive data redaction
for production-ready security posture.
"""

import re
import secrets
from typing import Optional, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


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

def generate_csp_nonce() -> str:
    """
    Generate a cryptographically secure nonce for CSP.
    
    Returns:
        Base64-encoded nonce
    """
    return secrets.token_urlsafe(16)


def create_csp_header(nonce: str, is_production: bool = False) -> str:
    """
    Create Content Security Policy header with nonce.
    
    Args:
        nonce: CSP nonce for script execution
        is_production: Whether running in production
        
    Returns:
        CSP header value
    """
    if is_production:
        # Strict CSP for production
        csp_parts = [
            "default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}'",
            "style-src 'self' 'unsafe-inline'",  # Allow inline styles for now
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
            "upgrade-insecure-requests"
        ]
    else:
        # More permissive CSP for development
        csp_parts = [
            "default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}' 'unsafe-eval'",  # Allow eval in dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https: http://localhost:*",
            "font-src 'self' data:",
            "connect-src 'self' https: http://localhost:* ws://localhost:*",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'"
        ]
    
    return "; ".join(csp_parts)


def create_hsts_header(is_production: bool = False) -> Optional[str]:
    """
    Create HSTS header for production only.
    
    Args:
        is_production: Whether running in production
        
    Returns:
        HSTS header value or None
    """
    if is_production:
        return "max-age=31536000; includeSubDomains; preload"
    return None


def create_security_headers(nonce: str, is_production: bool = False) -> Dict[str, str]:
    """
    Create comprehensive security headers.
    
    Args:
        nonce: CSP nonce for script execution
        is_production: Whether running in production
        
    Returns:
        Dictionary of security headers
    """
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-site",
        "Content-Security-Policy": create_csp_header(nonce, is_production),
    }
    
    # Add HSTS only in production
    hsts_header = create_hsts_header(is_production)
    if hsts_header:
        headers["Strict-Transport-Security"] = hsts_header
    
    return headers


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
    Middleware to add security headers with CSP nonce pipeline.
    
    Adds comprehensive security headers to all responses with dynamic CSP nonces
    and provides utility for redacting sensitive data from log messages.
    """
    
    def __init__(self, app, enable_hsts: bool = False, is_production: bool = False):
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.is_production = is_production
        
    async def dispatch(self, request: Request, call_next):
        """Process request and add security headers to response."""
        # Generate CSP nonce for this request
        nonce = generate_csp_nonce()
        
        # Store nonce in request state for use by templates/views
        request.state.csp_nonce = nonce
        
        # Process the request
        response: Response = await call_next(request)
        
        # Create security headers with nonce
        security_headers = create_security_headers(nonce, self.is_production)
        
        # Override HSTS setting if specified
        if not self.enable_hsts:
            security_headers.pop("Strict-Transport-Security", None)
        
        # Add headers that aren't already set
        for header_name, header_value in security_headers.items():
            if header_name not in response.headers:
                response.headers[header_name] = header_value
        
        # Add Vary header for CORS
        if "Vary" not in response.headers:
            response.headers["Vary"] = "Origin"
        else:
            vary_header = response.headers["Vary"]
            if "Origin" not in vary_header:
                response.headers["Vary"] = f"{vary_header}, Origin"
        
        # Remove X-Powered-By header if present
        response.headers.pop("X-Powered-By", None)
        
        return response


def setup_cors_middleware(app: FastAPI, allowed_origins: list[str], is_production: bool = False):
    """
    Set up CORS middleware with proper security configuration.
    
    Args:
        app: FastAPI application instance
        allowed_origins: List of allowed origins
        is_production: Whether running in production
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=[
            "Content-Type", 
            "Authorization", 
            "X-CSRF-Token", 
            "X-Request-ID",
            "X-CSP-Nonce"
        ],
        expose_headers=["X-Request-ID", "X-CSP-Nonce"],
        max_age=3600 if is_production else 0  # Cache preflight for 1 hour in prod
    )


def get_csp_nonce_from_request(request: Request) -> Optional[str]:
    """
    Get CSP nonce from request state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        CSP nonce if available
    """
    return getattr(request.state, 'csp_nonce', None)


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
