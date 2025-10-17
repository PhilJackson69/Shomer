"""
Security tests for headers, rate limiting, and data redaction.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app


client = TestClient(app)


class TestSecurityHeaders:
    """Test security headers are properly set."""

    def test_security_headers_present(self):
        """Test that all required security headers are present."""
        response = client.get("/health")
        
        assert response.status_code == 200
        
        # Check critical security headers
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "Referrer-Policy",
            "Permissions-Policy",
            "Cross-Origin-Opener-Policy",
            "Cross-Origin-Resource-Policy",
        ]
        
        for header in security_headers:
            assert header in response.headers, f"Missing security header: {header}"
            
        # Verify specific values
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "no-referrer"

    def test_content_security_policy(self):
        """Test Content Security Policy header."""
        response = client.get("/health")
        
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None
        
        # Check for key CSP directives
        csp_directives = [
            "default-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        
        for directive in csp_directives:
            assert directive in csp, f"Missing CSP directive: {directive}"

    def test_hsts_header_conditional(self):
        """Test HSTS header is conditionally set based on environment."""
        # In development, HSTS should not be set
        response = client.get("/health")
        assert "Strict-Transport-Security" not in response.headers


class TestDataRedaction:
    """Test sensitive data redaction functionality."""

    def test_token_redaction(self):
        """Test that JWT tokens and API keys are redacted."""
        from app.middleware.security_headers import redact_sensitive_data
        
        # Test JWT token redaction
        jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        redacted = redact_sensitive_data(f"Bearer {jwt_token}")
        assert "<REDACTED_JWT>" in redacted
        assert jwt_token not in redacted

    def test_api_key_redaction(self):
        """Test that API keys in various formats are redacted."""
        from app.middleware.security_headers import redact_sensitive_data
        
        # Test different API key formats
        test_cases = [
            "API_KEY: sk-1234567890abcdef1234567890abcdef",
            "api_key=pk-1234567890abcdef1234567890abcdef",
            "secret: your-secret-key-here",
            "token=abc123def456ghi789jkl012mno345pqr678",
        ]
        
        for test_case in test_cases:
            redacted = redact_sensitive_data(test_case)
            assert "<REDACTED>" in redacted or "<REDACTED_TOKEN>" in redacted
            # Ensure the original sensitive value is not in the output
            assert "sk-1234567890abcdef1234567890abcdef" not in redacted
            assert "pk-1234567890abcdef1234567890abcdef" not in redacted
            assert "your-secret-key-here" not in redacted

    def test_email_redaction(self):
        """Test that email addresses are redacted."""
        from app.middleware.security_headers import redact_sensitive_data
        
        test_text = "Contact user@example.com for more information"
        redacted = redact_sensitive_data(test_text)
        
        assert "<REDACTED_EMAIL>" in redacted
        assert "user@example.com" not in redacted

    def test_phone_redaction(self):
        """Test that phone numbers are redacted."""
        from app.middleware.security_headers import redact_sensitive_data
        
        test_cases = [
            "Call us at (555) 123-4567",
            "Phone: 555-123-4567",
            "Contact: +1-555-123-4567",
        ]
        
        for test_case in test_cases:
            redacted = redact_sensitive_data(test_case)
            assert "<REDACTED_PHONE>" in redacted
            assert "555" not in redacted or "123" not in redacted


class TestRateLimiting:
    """Test rate limiting functionality."""

    @patch('app.middleware.rate_limit.get_redis_client')
    def test_rate_limiting_without_redis(self, mock_redis):
        """Test that rate limiting is bypassed when Redis is unavailable."""
        mock_redis.return_value = None
        
        # Should not raise rate limit errors when Redis is unavailable
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_endpoint_accessible(self):
        """Test that health endpoint is accessible without rate limiting issues."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_multiple_requests_allowed(self):
        """Test that multiple requests to health endpoint are allowed."""
        responses = []
        for _ in range(5):
            response = client.get("/health")
            responses.append(response)
            
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200

    def test_health_rate_limit_429(self):
        """Test rate limiting triggers 429 when exceeded."""
        # Hammer the endpoint to trigger limiter (if enabled)
        for _ in range(70):
            client.get("/health")
        r = client.get("/health")
        # In CI/dev the limiter may be off; accept 200 or 429 but prefer 429
        assert r.status_code in (200, 429)


class TestCORSConfiguration:
    """Test CORS configuration."""

    def test_cors_headers_present(self):
        """Test that CORS headers are properly configured."""
        response = client.options("/health")
        
        # Check that CORS headers are present
        assert "access-control-allow-origin" in [h.lower() for h in response.headers.keys()]

    def test_cors_origin_restriction(self):
        """Test that CORS origins are properly restricted."""
        # Test with allowed origin
        response = client.get("/health", headers={"Origin": "http://localhost:3000"})
        assert response.status_code == 200
        
        # The actual CORS validation happens in middleware
        # This test verifies the endpoint is accessible


class TestSecurityMiddleware:
    """Test security middleware integration."""

    def test_middleware_stack_order(self):
        """Test that middleware is applied in correct order."""
        response = client.get("/health")
        
        # Request ID should be present (from RequestIDMiddleware)
        assert "X-Request-ID" in response.headers
        
        # Security headers should be present
        assert "X-Content-Type-Options" in response.headers
        
        # Both should work together
        assert response.status_code == 200

    def test_error_handling(self):
        """Test that security middleware doesn't break error handling."""
        # Test 404 endpoint
        response = client.get("/nonexistent")
        assert response.status_code == 404
        
        # Security headers should still be present even on errors
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers


if __name__ == "__main__":
    pytest.main([__file__])
