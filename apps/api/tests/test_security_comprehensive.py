"""
Comprehensive security test suite for Shomer API.
"""

import pytest
import uuid
import json
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User, UserRole


@pytest.fixture
def client():
    """Test client fixture."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Authentication headers fixture."""
    token = create_access_token("test-user-id")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def cookie_client():
    """Client with cookies for CSRF testing."""
    client = TestClient(app)
    # Get CSRF token
    response = client.get("/api/v1/csrf")
    if response.status_code == 200:
        csrf_token = response.json().get("token")
        client.cookies.set("csrf_token", csrf_token)
    return client


@pytest.mark.security
def test_error_schema(client):
    """Test that error responses follow standard schema."""
    # Force a 500 error
    with patch("app.api.v1.endpoints.auth.login", side_effect=Exception("Test error")):
        response = client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "test"})
        
        assert response.status_code == 500
        data = response.json()
        
        # Check standard error schema
        required_fields = ["error", "code", "requestId", "ts"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check requestId is present
        assert data["requestId"] is not None
        assert len(data["requestId"]) > 0


@pytest.mark.security
def test_csrf_required_for_cookie_auth(cookie_client):
    """Test CSRF protection for cookie-based authentication."""
    # Test POST without CSRF token
    response = cookie_client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "test"})
    assert response.status_code == 403
    assert "CSRF" in response.json().get("detail", "").upper()


@pytest.mark.security
def test_csrf_token_validation(cookie_client):
    """Test CSRF token validation."""
    # Get valid CSRF token
    csrf_response = cookie_client.get("/api/v1/csrf")
    assert csrf_response.status_code == 200
    csrf_token = csrf_response.json().get("token")
    
    # Test with valid CSRF token
    headers = {"X-CSRF-Token": csrf_token}
    response = cookie_client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "test"}, headers=headers)
    # Should not be 403 CSRF error (might be 400/401 for invalid credentials)
    assert response.status_code != 403 or "CSRF" not in response.json().get("detail", "").upper()


@pytest.mark.security
def test_idempotency_replay(client, auth_headers):
    """Test idempotency key replay detection."""
    idempotency_key = str(uuid.uuid4())
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}
    
    # First request
    response1 = client.post("/api/v1/tips", json={"title": "Test tip", "content": "Test content"}, headers=headers)
    
    # Replay with same idempotency key
    response2 = client.post("/api/v1/tips", json={"title": "Test tip", "content": "Test content"}, headers=headers)
    
    # Should get 409 (Conflict) or 208 (Already Reported) for replay
    assert response2.status_code in [208, 409]


@pytest.mark.security
def test_refresh_token_reuse_detection(client):
    """Test refresh token reuse detection."""
    refresh_token = create_refresh_token("test-user-id")
    
    # First use of refresh token
    response1 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    
    # Second use of same refresh token (should be detected as reuse)
    response2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    
    # Should detect reuse and revoke family
    assert response2.status_code in [401, 403]


@pytest.mark.security
def test_file_upload_validation(client, auth_headers):
    """Test file upload security validation."""
    # Test dangerous file type
    files = {"file": ("test.php", b"<?php echo 'hack'; ?>", "application/x-php")}
    response = client.post("/api/v1/tips", files=files, headers=auth_headers)
    assert response.status_code in [400, 415, 422]
    assert "validation" in response.json().get("detail", "").lower()


@pytest.mark.security
def test_file_size_limit(client, auth_headers):
    """Test file size limits."""
    # Create a large file (over 10MB)
    large_content = b"x" * (11 * 1024 * 1024)  # 11MB
    files = {"file": ("large.txt", large_content, "text/plain")}
    response = client.post("/api/v1/tips", files=files, headers=auth_headers)
    assert response.status_code in [400, 413, 422]


@pytest.mark.security
def test_ssrf_protection(client, auth_headers):
    """Test SSRF protection."""
    # Test private IP
    ssrf_payload = {"url": "http://127.0.0.1:80"}
    response = client.post("/api/v1/validation/url-scan", json=ssrf_payload, headers=auth_headers)
    assert response.status_code in [400, 403, 422]
    assert "private" in response.json().get("detail", "").lower() or "blocked" in response.json().get("detail", "").lower()


@pytest.mark.security
def test_rate_limiting(client):
    """Test rate limiting."""
    # Make multiple requests to trigger rate limiting
    responses = []
    for i in range(25):
        response = client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "test"})
        responses.append(response.status_code)
    
    # Should have some 429 responses
    assert 429 in responses, "Rate limiting not working"


@pytest.mark.security
def test_jwt_claims_validation(client):
    """Test JWT claims validation."""
    # Test with invalid audience
    invalid_token = create_access_token("test-user-id", {"aud": "wrong-audience"})
    headers = {"Authorization": f"Bearer {invalid_token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.security
def test_jwt_expiry_validation(client):
    """Test JWT expiry validation."""
    # Create expired token
    import time
    expired_token = create_access_token("test-user-id", {"exp": int(time.time()) - 3600})
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.security
def test_jwt_algorithm_validation(client):
    """Test JWT algorithm validation."""
    # Test with "none" algorithm (should be rejected)
    import jwt as pyjwt
    none_token = pyjwt.encode({"sub": "test"}, "", algorithm="none")
    headers = {"Authorization": f"Bearer {none_token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.security
def test_2fa_rate_limiting(client, auth_headers):
    """Test 2FA rate limiting."""
    # Make multiple 2FA verification attempts
    responses = []
    for i in range(10):
        response = client.post("/api/v1/2fa/verify", json={"token": "123456"}, headers=auth_headers)
        responses.append(response.status_code)
    
    # Should have some 429 responses after too many attempts
    assert 429 in responses, "2FA rate limiting not working"


@pytest.mark.security
def test_backup_code_one_time_use(client, auth_headers):
    """Test backup code one-time use."""
    # This would require setting up 2FA first, then testing backup code
    # For now, just test the endpoint exists and validates input
    response = client.post("/api/v1/2fa/verify-backup", json={"code": "invalid-code"}, headers=auth_headers)
    assert response.status_code in [400, 401, 422]


@pytest.mark.security
def test_admin_reauth_required(client, auth_headers):
    """Test admin reauthentication requirement."""
    # Test admin endpoint without recent password verification
    response = client.post("/api/v1/admin/settings", json={"setting": "value"}, headers=auth_headers)
    # Should require recent password verification
    assert response.status_code in [401, 403, 422]


@pytest.mark.security
def test_security_headers(client):
    """Test security headers."""
    response = client.get("/")
    
    # Check for security headers
    security_headers = [
        "content-security-policy",
        "x-content-type-options", 
        "x-frame-options"
    ]
    
    for header in security_headers:
        assert header in response.headers, f"Missing security header: {header}"
    
    # Check for dangerous headers
    dangerous_headers = ["x-powered-by", "server"]
    for header in dangerous_headers:
        assert header not in response.headers, f"Dangerous header present: {header}"


@pytest.mark.security
def test_cors_configuration(client):
    """Test CORS configuration."""
    # Test preflight request
    response = client.options("/api/v1/auth/login", headers={
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
    })
    
    # Should have CORS headers
    assert "access-control-allow-origin" in response.headers
    assert "access-control-allow-methods" in response.headers


@pytest.mark.security
def test_pii_redaction(client):
    """Test PII redaction in logs and responses."""
    # This would require checking logs, which is complex in tests
    # For now, test that error responses don't contain raw PII
    with patch("app.api.v1.endpoints.auth.login", side_effect=Exception("User email@example.com failed")):
        response = client.post("/api/v1/auth/login", json={"email": "email@example.com", "password": "test"})
        
        # Error response should not contain raw email
        error_detail = response.json().get("detail", "")
        assert "email@example.com" not in error_detail
        assert "[REDACTED]" in error_detail or "redacted" in error_detail.lower()


@pytest.mark.security
def test_jwks_endpoint(client):
    """Test JWKS endpoint."""
    response = client.get("/.well-known/jwks.json")
    
    if response.status_code == 200:
        jwks = response.json()
        assert "keys" in jwks
        assert len(jwks["keys"]) > 0
        
        # Check key structure
        key = jwks["keys"][0]
        assert "kty" in key
        assert "kid" in key
        assert "use" in key
        assert key["use"] == "sig"
    else:
        # JWKS might not be available for symmetric algorithms
        assert response.status_code in [404, 500]


@pytest.mark.security
def test_refresh_family_revoke(client, auth_headers):
    """Test refresh token family revocation."""
    # Test the revoke-all endpoint
    response = client.post("/api/v1/auth/sessions/revoke-all", headers=auth_headers)
    assert response.status_code == 200
    
    data = response.json()
    assert "message" in data
    assert "requestId" in data
    assert "timestamp" in data


@pytest.mark.security
def test_input_sanitization(client, auth_headers):
    """Test input sanitization."""
    # Test XSS prevention
    malicious_input = "<script>alert('xss')</script>"
    response = client.post("/api/v1/tips", json={
        "title": malicious_input,
        "content": malicious_input
    }, headers=auth_headers)
    
    # Should sanitize or reject malicious input
    if response.status_code == 200:
        data = response.json()
        assert "<script>" not in data.get("title", "")
        assert "<script>" not in data.get("content", "")


@pytest.mark.security
def test_sql_injection_prevention(client, auth_headers):
    """Test SQL injection prevention."""
    # Test SQL injection in various fields
    sql_payloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users; --"
    ]
    
    for payload in sql_payloads:
        response = client.post("/api/v1/auth/login", json={
            "email": payload,
            "password": "test"
        })
        
        # Should not cause SQL errors (should be 400/401, not 500)
        assert response.status_code != 500
        assert "sql" not in response.json().get("detail", "").lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "security"])
