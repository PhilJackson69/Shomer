"""Security utilities for password hashing, JWT, and signed URLs."""

import base64
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Data to encode in token
        expires_delta: Optional expiration time delta
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(seconds=settings.JWT_EXPIRES_IN)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """
    Decode and verify JWT access token.
    
    Args:
        token: JWT token to decode
        
    Returns:
        Decoded token data or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


# ============================================================================
# Signed URL Functions (Phase 2.5 Hardening)
# ============================================================================

def _b64u(data: bytes) -> str:
    """Base64url encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64u(s: str) -> bytes:
    """Base64url decode with padding restoration."""
    pad = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_path(path: str, secret: str, ttl_seconds: int, scope: str = "export") -> str:
    """
    Generate an HMAC-signed token for a URL path.
    
    Args:
        path: The URL path to sign (e.g., "/api/v1/evidence/123/export")
        secret: Secret key for HMAC signing
        ttl_seconds: Time-to-live in seconds
        scope: Token scope (default: "export")
        
    Returns:
        Signed token string (format: "expiry.signature")
    """
    exp = int(time.time()) + ttl_seconds
    msg = f"{scope}:{path}:{exp}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    token = f"{exp}.{_b64u(sig)}"
    return token


def verify_token(path: str, token: str, secret: str, scope: str = "export") -> bool:
    """
    Verify an HMAC-signed token for a URL path.
    
    Args:
        path: The URL path that was signed
        token: The token to verify (format: "expiry.signature")
        secret: Secret key for HMAC verification
        scope: Token scope (default: "export")
        
    Returns:
        True if token is valid and not expired, False otherwise
    """
    try:
        exp_str, sig_b64 = token.split(".", 1)
        exp = int(exp_str)
    except Exception:
        return False
    
    # Check expiry
    if exp < int(time.time()):
        return False
    
    # Verify signature
    msg = f"{scope}:{path}:{exp}".encode()
    expected = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    
    try:
        provided = _unb64u(sig_b64)
    except Exception:
        return False
    
    return hmac.compare_digest(expected, provided)
