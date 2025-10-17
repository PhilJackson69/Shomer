"""
CSRF protection middleware for state-changing operations.

Implements HMAC-signed double-submit token pattern for CSRF protection
on POST/PUT/DELETE/PATCH requests, with smart skipping for non-cookie
auth and periodic token rotation.
"""

import os
import time
from typing import Callable
from hmac import compare_digest
from hashlib import sha256
from base64 import urlsafe_b64encode
from secrets import token_urlsafe
from fastapi import Request, HTTPException, status
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.monitoring import security_event


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using double-submit cookie pattern.
    
    - Sets a CSRF token in a cookie
    - Requires token to be sent in header for state-changing requests
    - Validates token matches for POST/PUT/DELETE/PATCH
    """

    CSRF_COOKIE_NAME = "csrf"
    CSRF_HEADER_NAME = "X-CSRF-Token"
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    ROTATE_SECONDS = 2 * 60 * 60  # 2 hours

    def __init__(self, app, exclude_paths: list[str] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health",
            "/docs",
            "/openapi.json",
            "/api/v1/auth/login",  # Login doesn't need CSRF (uses credentials)
        ]
        # Secret for signing tokens (ensure set in production)
        self.csrf_secret = os.getenv("CSRF_SECRET", os.getenv("API_SECRET_KEY", "dev_csrf_secret"))

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with CSRF validation."""
        
        # Skip CSRF for safe methods (but rotate/issue token opportunistically)
        if request.method in self.SAFE_METHODS:
            response = await call_next(request)
            self._maybe_issue_or_rotate_token(request, response)
            return response
        
        # Skip CSRF for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Skip CSRF when using Authorization header (API key/Bearer) or when no cookies are in play
        if not self._should_check_csrf(request):
            return await call_next(request)
        
        # Validate CSRF token for state-changing methods
        cookie_token = request.cookies.get(self.CSRF_COOKIE_NAME, "")
        header_token = request.headers.get(self.CSRF_HEADER_NAME, "")
        
        if not cookie_token or not header_token:
            try:
                security_event("csrf_invalid", {"route": request.url.path, "reason": "missing"})
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )
        
        if not compare_digest(cookie_token, header_token) or not self._valid_token(header_token):
            try:
                security_event("csrf_invalid", {"route": request.url.path, "reason": "invalid"})
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token invalid"
            )
        
        # Process request
        response = await call_next(request)
        # Periodically rotate token to reduce replay window
        self._maybe_issue_or_rotate_token(request, response)
        return response

    def _should_check_csrf(self, request: Request) -> bool:
        """Only check CSRF when using cookie-based auth without Authorization header."""
        has_authz = bool(request.headers.get("authorization"))
        has_cookies = bool(request.headers.get("cookie"))
        # Check for presence of a session-like cookie if known; fallback to any cookies present
        return (not has_authz) and has_cookies

    def _sign(self, data: str) -> str:
        mac = sha256((self.csrf_secret + data).encode("utf-8")).digest()
        return urlsafe_b64encode(mac).decode("utf-8").rstrip("=")

    def _generate_token(self) -> str:
        """Generate CSRF token format: nonce.timestamp.mac (base64url)."""
        nonce = token_urlsafe(24)
        ts = str(int(time.time()))
        mac = self._sign(f"{nonce}.{ts}")
        return f"{nonce}.{ts}.{mac}"

    def _valid_token(self, token: str) -> bool:
        try:
            nonce, ts, mac = token.split(".")
        except ValueError:
            return False
        expected = self._sign(f"{nonce}.{ts}")
        return compare_digest(mac, expected)

    def _is_old(self, token: str) -> bool:
        try:
            _nonce, ts, _mac = token.split(".")
            issued = int(ts)
        except Exception:
            return True
        return (time.time() - issued) > self.ROTATE_SECONDS

    def _maybe_issue_or_rotate_token(self, request: Request, response: Response) -> None:
        """Issue a CSRF token if missing, or rotate if older than threshold."""
        current = request.cookies.get(self.CSRF_COOKIE_NAME)
        if not current or not self._valid_token(current) or self._is_old(current):
            token = self._generate_token()
            response.set_cookie(
                key=self.CSRF_COOKIE_NAME,
                value=token,
                httponly=False,  # must be readable by client to echo in header
                secure=True,
                samesite="strict",
                max_age=86400,
            )

