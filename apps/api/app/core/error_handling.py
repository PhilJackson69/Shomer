"""
Error response hardening and PII redaction utilities.

Provides consistent error response formatting, stack trace sanitization,
and PII redaction for production-ready error handling with standard schema.
"""

import traceback
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Union
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel

from app.core.security import redact_sensitive_data


# Patterns for redacting PII from error messages
PII_PATTERNS = [
    # Email addresses
    (re.compile(r'[\w\.-]+@[\w\.-]+\.\w+'), '<REDACTED_EMAIL>'),
    # Phone numbers
    (re.compile(r'(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})'), '<REDACTED_PHONE>'),
    # SSN patterns
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '<REDACTED_SSN>'),
    # Credit card numbers
    (re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'), '<REDACTED_CC>'),
    # API keys and tokens
    (re.compile(r'(?i)\b(sk|pk|rk)-[A-Za-z0-9]{16,}\b'), '<REDACTED_TOKEN>'),
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9\-\._]+\.[A-Za-z0-9\-\._]+\.[A-Za-z0-9\-\._]+\b'), 'Bearer <REDACTED_JWT>'),
    # Database connection strings
    (re.compile(r'(?i)(postgresql|mysql|mongodb)://[^:\s]+:[^@\s]+@'), '<REDACTED_DB_URL>'),
    # File paths with usernames
    (re.compile(r'/[^/]*/[^/]*/[^/]*'), '<REDACTED_PATH>'),
    # 16+ hex strings (API keys, tokens)
    (re.compile(r'\b[a-fA-F0-9]{16,}\b'), '<REDACTED_HEX>'),
    # IBAN-like patterns
    (re.compile(r'\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b'), '<REDACTED_IBAN>'),
]


class StandardErrorResponse(BaseModel):
    """Standard error response schema."""
    error: str
    code: str
    requestId: str
    ts: datetime


def redact_sensitive_data_enhanced(text: str) -> str:
    """
    Enhanced redaction of sensitive data from text.
    
    Args:
        text: Text to redact
        
    Returns:
        Text with sensitive patterns redacted
    """
    if not text:
        return text
    
    redacted = text
    for pattern, replacement in PII_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    
    # Cap logged body to 2KB
    if len(redacted) > 2048:
        redacted = redacted[:2048] + "... [TRUNCATED]"
    
    return redacted


def redact_pii_from_text(text: str) -> str:
    """
    Redact PII from text using predefined patterns.
    
    Args:
        text: Text to redact
        
    Returns:
        Text with PII redacted
    """
    if not text:
        return text
    
    redacted = text
    for pattern, replacement in PII_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    
    return redacted


def sanitize_stack_trace(traceback_str: str) -> str:
    """
    Sanitize stack trace to remove PII and sensitive information.
    
    Args:
        traceback_str: Stack trace string
        
    Returns:
        Sanitized stack trace
    """
    if not traceback_str:
        return traceback_str
    
    # Redact PII from the traceback
    sanitized = redact_pii_from_text(traceback_str)
    
    # Remove file paths (keep only filename)
    sanitized = re.sub(r'File "([^"]*)/([^"]*)"', r'File "\2"', sanitized)
    
    # Remove line numbers from sensitive files
    sanitized = re.sub(r'File "([^"]*\.py)", line \d+', r'File "\1"', sanitized)
    
    return sanitized


def create_error_response(
    status_code: int,
    detail: str,
    request_id: Optional[str] = None,
    error_code: Optional[str] = None,
    include_stack_trace: bool = False,
    exception: Optional[Exception] = None
) -> JSONResponse:
    """
    Create a standardized error response using the standard schema.
    
    Args:
        status_code: HTTP status code
        detail: Error detail message
        request_id: Request ID for tracing
        error_code: Machine-readable error code
        include_stack_trace: Whether to include stack trace (dev only)
        exception: Exception object for stack trace
        
    Returns:
        JSONResponse with standardized error format
    """
    # Generate request ID if not provided
    if not request_id:
        request_id = str(uuid.uuid4())
    
    # Redact PII from detail message
    sanitized_detail = redact_sensitive_data_enhanced(detail)
    
    # Create standard error response
    error_response = StandardErrorResponse(
        error=sanitized_detail,
        code=error_code or f"HTTP_{status_code}",
        requestId=request_id,
        ts=datetime.utcnow()
    )
    
    # Add stack trace in development only
    if include_stack_trace and exception:
        try:
            stack_trace = traceback.format_exc()
            sanitized_trace = sanitize_stack_trace(stack_trace)
            # Add as additional field (not in standard schema)
            response_content = error_response.model_dump()
            response_content["stack_trace"] = sanitized_trace
            return JSONResponse(
                status_code=status_code,
                content=response_content
            )
        except Exception:
            # If stack trace generation fails, don't include it
            pass
    
    return JSONResponse(
        status_code=status_code,
        content=error_response.model_dump()
    )


def get_request_id(request: Request) -> Optional[str]:
    """
    Extract request ID from request headers or state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Request ID if available
    """
    # Try to get from headers first
    request_id = request.headers.get("X-Request-ID")
    if request_id:
        return request_id
    
    # Try to get from request state
    if hasattr(request.state, 'request_id'):
        return request.state.request_id
    
    return None


def is_development_environment() -> bool:
    """Check if running in development environment."""
    import os
    return os.getenv("ENVIRONMENT", "development").lower() == "development"


class ErrorHandler:
    """Centralized error handling with PII redaction."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def handle_http_exception(
        self, 
        request: Request, 
        exc: HTTPException
    ) -> JSONResponse:
        """Handle HTTP exceptions with PII redaction."""
        request_id = get_request_id(request)
        
        # Log the error (with PII redaction)
        self.logger.error(
            f"HTTP {exc.status_code}: {redact_sensitive_data_enhanced(str(exc.detail))}",
            extra={
                'request_id': request_id,
                'status_code': exc.status_code,
                'path': request.url.path,
                'method': request.method
            }
        )
        
        return create_error_response(
            status_code=exc.status_code,
            detail=str(exc.detail),
            request_id=request_id,
            error_code=f"HTTP_{exc.status_code}"
        )
    
    def handle_validation_error(
        self, 
        request: Request, 
        exc: RequestValidationError
    ) -> JSONResponse:
        """Handle validation errors with PII redaction."""
        request_id = get_request_id(request)
        
        # Redact PII from validation errors
        sanitized_errors = []
        for error in exc.errors():
            sanitized_error = error.copy()
            if 'msg' in sanitized_error:
                sanitized_error['msg'] = redact_sensitive_data_enhanced(sanitized_error['msg'])
            sanitized_errors.append(sanitized_error)
        
        # Log the error
        self.logger.error(
            f"Validation error: {redact_sensitive_data_enhanced(str(exc.errors()))}",
            extra={
                'request_id': request_id,
                'path': request.url.path,
                'method': request.method
            }
        )
        
        return create_error_response(
            status_code=422,
            detail="Validation error",
            request_id=request_id,
            error_code="VALIDATION_ERROR"
        )
    
    def handle_generic_exception(
        self, 
        request: Request, 
        exc: Exception
    ) -> JSONResponse:
        """Handle generic exceptions with PII redaction."""
        request_id = get_request_id(request)
        
        # Log the error with PII redaction
        error_message = redact_sensitive_data_enhanced(str(exc))
        self.logger.error(
            f"Unhandled exception: {error_message}",
            extra={
                'request_id': request_id,
                'path': request.url.path,
                'method': request.method,
                'exception_type': type(exc).__name__
            },
            exc_info=True
        )
        
        # Don't expose internal errors in production
        if is_development_environment():
            detail = error_message
            include_stack_trace = True
        else:
            detail = "An internal error occurred"
            include_stack_trace = False
        
        return create_error_response(
            status_code=500,
            detail=detail,
            request_id=request_id,
            error_code="INTERNAL_ERROR",
            include_stack_trace=include_stack_trace,
            exception=exc
        )


# Global error handler instance
error_handler = ErrorHandler()


def setup_error_handlers(app):
    """
    Set up error handlers for the FastAPI app.
    
    Args:
        app: FastAPI application instance
    """
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return error_handler.handle_http_exception(request, exc)
    
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
        return error_handler.handle_http_exception(request, exc)
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return error_handler.handle_validation_error(request, exc)
    
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return error_handler.handle_generic_exception(request, exc)


if __name__ == "__main__":
    # CLI utility for testing error handling
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Test PII redaction
        test_text = "User john@example.com called from (555) 123-4567 with SSN 123-45-6789"
        redacted = redact_pii_from_text(test_text)
        print(f"Original: {test_text}")
        print(f"Redacted: {redacted}")
        
        # Test stack trace sanitization
        try:
            raise ValueError("Test exception with user@example.com")
        except Exception as e:
            traceback_str = traceback.format_exc()
            sanitized = sanitize_stack_trace(traceback_str)
            print(f"Sanitized traceback: {sanitized[:200]}...")
        
    else:
        print("Usage: python -m app.core.error_handling test")
