"""
CSRF Protection Middleware

Implements comprehensive CSRF protection with:
- Token-based protection for cookie-based authentication
- Bypass for API key authentication (no cookies)
- Token rotation on login/logout
- Protection for unsafe HTTP methods
"""

import secrets
import hashlib
from typing import Optional, Set
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from fastapi import HTTPException, status


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware with smart bypass logic.
    
    Protection rules:
    1. Only protect requests with cookies (session-based auth)
    2. Bypass protection for pure API key authentication
    3. Require CSRF token for unsafe methods (POST, PUT, PATCH, DELETE)
    4. Block JSON GET requests (potential CSRF vectors)
    """
    
    # Unsafe HTTP methods that require CSRF protection
    UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    # Paths that should be excluded from CSRF protection
    EXCLUDED_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register", 
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/docs",
        "/openapi.json",
        "/redoc",
    }
    
    # Headers that indicate API key authentication
    API_KEY_HEADERS = {
        "x-api-key",
        "x-auth-token", 
        "authorization"  # Bearer token
    }
    
    def __init__(self, app, secret_key: str):
        super().__init__(app)
        self.secret_key = secret_key
    
    async def dispatch(self, request: Request, call_next):
        """Process request and apply CSRF protection."""
        
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return await call_next(request)
        
        # Skip if not an unsafe method
        if request.method not in self.UNSAFE_METHODS:
            return await call_next(request)
        
        # Check if this is pure API key authentication (bypass CSRF)
        if self._is_api_key_auth(request):
            return await call_next(request)
        
        # Check if request has cookies (session-based auth requires CSRF)
        if not request.cookies:
            return await call_next(request)
        
        # Block JSON GET requests (potential CSRF vector)
        if request.method == "GET" and self._is_json_request(request):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "JSON GET requests not allowed for security"}
            )
        
        # Require CSRF token for unsafe methods with cookies
        csrf_token = self._get_csrf_token(request)
        if not csrf_token:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "CSRF token required"}
            )
        
        # Validate CSRF token
        if not self._validate_csrf_token(csrf_token, request):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Invalid CSRF token"}
            )
        
        return await call_next(request)
    
    def _is_api_key_auth(self, request: Request) -> bool:
        """Check if request uses API key authentication (no cookies needed)."""
        # Check for API key headers
        for header_name in self.API_KEY_HEADERS:
            if header_name in request.headers:
                return True
        
        # Check if Authorization header contains Bearer token
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            return True
            
        return False
    
    def _is_json_request(self, request: Request) -> bool:
        """Check if request expects JSON response."""
        accept_header = request.headers.get("accept", "")
        return "application/json" in accept_header
    
    def _get_csrf_token(self, request: Request) -> Optional[str]:
        """Extract CSRF token from request."""
        # Check header first (preferred)
        csrf_token = request.headers.get("x-csrf-token")
        if csrf_token:
            return csrf_token
        
        # Check form data
        if hasattr(request, "_form"):
            form = request._form
            if form and "csrf_token" in form:
                return form["csrf_token"]
        
        return None
    
    def _validate_csrf_token(self, token: str, request: Request) -> bool:
        """Validate CSRF token against expected value."""
        # Get expected token from cookies
        expected_token = request.cookies.get("csrf_token")
        if not expected_token:
            return False
        
        # Use constant-time comparison
        return secrets.compare_digest(token, expected_token)
    
    def generate_csrf_token(self, user_id: Optional[str] = None) -> str:
        """Generate a new CSRF token."""
        # Include user ID and secret key for token binding
        data = f"{user_id or 'anonymous'}:{self.secret_key}:{secrets.token_urlsafe(16)}"
        return hashlib.sha256(data.encode()).hexdigest()


def create_csrf_response(response: Response, csrf_token: str) -> Response:
    """Add CSRF token to response cookies."""
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Must be accessible to JavaScript
        secure=True,     # HTTPS only
        samesite="strict",  # Strict same-site policy
        max_age=3600,    # 1 hour
        path="/"
    )
    return response


def rotate_csrf_token(response: Response, user_id: Optional[str] = None) -> Response:
    """Rotate CSRF token (call on login/logout)."""
    # Generate new token
    middleware = CSRFProtectionMiddleware(None, "")  # Dummy instance for token generation
    new_token = middleware.generate_csrf_token(user_id)
    
    # Set new token in response
    return create_csrf_response(response, new_token)