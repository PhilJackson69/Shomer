"""
Algorithm confusion and boundary security tests for JWT tokens.
These tests prevent common JWT security vulnerabilities.
"""

import jwt
import pytest
import base64
import json
import time
from typing import Dict, Any
from app.core.security import decode_token, create_access_token, JWT_ALGORITHM, JWT_KEY_ID
from app.core.config import settings

# Allowed asymmetric algorithms
ALG_ASYM = ("RS256", "EdDSA")


def _hdr(token: str) -> Dict[str, Any]:
    """Extract JWT header."""
    return json.loads(base64.urlsafe_b64decode(token.split('.')[0] + '=='))


@pytest.mark.security
def test_alg_reject_none():
    """Test that algorithm 'none' is rejected."""
    # Create token with alg: none
    token = ".".join(["e30", "e30", ""])  # alg "none" style
    
    with pytest.raises(Exception):
        decode_token(token)


@pytest.mark.security
def test_reject_hs256_with_public_key_as_secret():
    """Test that HS256 with public key as secret is rejected."""
    if not settings.JWT_PUBLIC_KEY:
        pytest.skip("No public key configured")
    
    claims = {
        "sub": "test_user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "aud": "shomer",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local"
    }
    
    # Try to create HS256 token with public key as secret
    bad_token = jwt.encode(claims, settings.JWT_PUBLIC_KEY, algorithm="HS256")
    
    with pytest.raises(Exception):
        decode_token(bad_token)


@pytest.mark.security
def test_header_has_kid():
    """Test that access tokens include kid in header."""
    access_token = create_access_token("test_user")
    header = _hdr(access_token)
    
    assert "kid" in header
    assert header["kid"] == JWT_KEY_ID


@pytest.mark.security
def test_exp_boundary_leeway():
    """Test that expired tokens are rejected even with leeway."""
    now = int(time.time())
    
    # Create token that expired 1 second ago
    expired_claims = {
        "sub": "test_user",
        "exp": now - 1,
        "aud": "shomer",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local",
        "iat": now - 60
    }
    
    # Create token with RS256 (if available)
    if JWT_ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        token = jwt.encode(
            expired_claims, 
            settings.JWT_PRIVATE_KEY, 
            algorithm="RS256", 
            headers={"kid": JWT_KEY_ID}
        )
    else:
        # Fallback to HS256 for testing
        token = jwt.encode(expired_claims, settings.JWT_SECRET, algorithm="HS256")
    
    # Should be rejected even with leeway
    with pytest.raises(Exception):
        decode_token(token)


@pytest.mark.security
def test_audience_validation():
    """Test that audience validation is enforced."""
    now = int(time.time())
    
    # Create token with wrong audience
    wrong_aud_claims = {
        "sub": "test_user",
        "iat": now,
        "exp": now + 3600,
        "aud": "wrong_audience",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local"
    }
    
    if JWT_ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        token = jwt.encode(
            wrong_aud_claims, 
            settings.JWT_PRIVATE_KEY, 
            algorithm="RS256", 
            headers={"kid": JWT_KEY_ID}
        )
    else:
        token = jwt.encode(wrong_aud_claims, settings.JWT_SECRET, algorithm="HS256")
    
    with pytest.raises(Exception):
        decode_token(token)


@pytest.mark.security
def test_issuer_validation():
    """Test that issuer validation is enforced."""
    now = int(time.time())
    
    # Create token with wrong issuer
    wrong_iss_claims = {
        "sub": "test_user",
        "iat": now,
        "exp": now + 3600,
        "aud": "shomer",
        "iss": "https://evil.com"
    }
    
    if JWT_ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        token = jwt.encode(
            wrong_iss_claims, 
            settings.JWT_PRIVATE_KEY, 
            algorithm="RS256", 
            headers={"kid": JWT_KEY_ID}
        )
    else:
        token = jwt.encode(wrong_iss_claims, settings.JWT_SECRET, algorithm="HS256")
    
    with pytest.raises(Exception):
        decode_token(token)


@pytest.mark.security
def test_nbf_validation():
    """Test that 'not before' validation is enforced."""
    now = int(time.time())
    
    # Create token that's not valid yet (nbf in future)
    future_nbf_claims = {
        "sub": "test_user",
        "iat": now,
        "exp": now + 3600,
        "nbf": now + 300,  # Not valid for 5 minutes
        "aud": "shomer",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local"
    }
    
    if JWT_ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        token = jwt.encode(
            future_nbf_claims, 
            settings.JWT_PRIVATE_KEY, 
            algorithm="RS256", 
            headers={"kid": JWT_KEY_ID}
        )
    else:
        token = jwt.encode(future_nbf_claims, settings.JWT_SECRET, algorithm="HS256")
    
    with pytest.raises(Exception):
        decode_token(token)


@pytest.mark.security
def test_algorithm_pinning():
    """Test that only allowed algorithms are accepted."""
    now = int(time.time())
    
    claims = {
        "sub": "test_user",
        "iat": now,
        "exp": now + 3600,
        "aud": "shomer",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local"
    }
    
    # Test with unsupported algorithm
    if JWT_ALGORITHM != "HS256":
        # Try HS256 when we expect asymmetric
        token = jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")
        with pytest.raises(Exception):
            decode_token(token)


@pytest.mark.security
def test_malformed_token():
    """Test that malformed tokens are rejected."""
    malformed_tokens = [
        "not.a.token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",  # Only header
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",  # Missing signature
        "",  # Empty token
        "invalid",  # Invalid base64
    ]
    
    for token in malformed_tokens:
        with pytest.raises(Exception):
            decode_token(token)


@pytest.mark.security
def test_key_id_validation():
    """Test that key ID validation works for asymmetric algorithms."""
    if JWT_ALGORITHM not in ALG_ASYM:
        pytest.skip("Not using asymmetric algorithm")
    
    access_token = create_access_token("test_user")
    header = _hdr(access_token)
    
    # Should have correct kid
    assert header["kid"] == JWT_KEY_ID
    
    # Should have correct algorithm
    assert header["alg"] == JWT_ALGORITHM


@pytest.mark.security
def test_token_type_validation():
    """Test that token type validation works."""
    access_token = create_access_token("test_user")
    payload = decode_token(access_token)
    
    assert payload is not None
    assert payload.get("type") == "access"


@pytest.mark.security
def test_subject_required():
    """Test that subject claim is required."""
    now = int(time.time())
    
    # Create token without subject
    no_sub_claims = {
        "iat": now,
        "exp": now + 3600,
        "aud": "shomer",
        "iss": settings.PUBLIC_BASE_URL or "https://shomer.local"
    }
    
    if JWT_ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        token = jwt.encode(
            no_sub_claims, 
            settings.JWT_PRIVATE_KEY, 
            algorithm="RS256", 
            headers={"kid": JWT_KEY_ID}
        )
    else:
        token = jwt.encode(no_sub_claims, settings.JWT_SECRET, algorithm="HS256")
    
    # Should be rejected
    result = decode_token(token)
    assert result is None