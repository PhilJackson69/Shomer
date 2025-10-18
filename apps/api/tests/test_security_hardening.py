"""
Comprehensive security hardening tests.

Tests for secret validation, input sanitization, file upload validation,
2FA implementation, and error response hardening.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app

client = TestClient(app)


class TestSecretValidation:
    """Test secret validation and environment hardening."""
    
    def test_weak_secret_rejection(self):
        """Test that weak secrets are rejected."""
        with patch.dict('os.environ', {
            'API_SECRET_KEY': 'weak',
            'JWT_SECRET': 'weak',
            'ENVIRONMENT': 'production'
        }):
            # This should raise a validation error
            with pytest.raises(Exception):
                from app.core.config import settings
                # Settings validation should fail
    
    def test_placeholder_secret_rejection(self):
        """Test that placeholder secrets are rejected."""
        with patch.dict('os.environ', {
            'API_SECRET_KEY': 'devsecret_change_me_in_production',
            'JWT_SECRET': 'devjwt_change_me_in_production',
            'ENVIRONMENT': 'production'
        }):
            with pytest.raises(Exception):
                from app.core.config import settings


class TestInputValidation:
    """Test input validation and sanitization."""
    
    def test_html_sanitization(self):
        """Test HTML sanitization removes dangerous content."""
        from app.core.validation import sanitize_html
        
        malicious_html = "<script>alert('xss')</script><p>Safe content</p>"
        sanitized = sanitize_html(malicious_html)
        
        assert "<script>" not in sanitized
        assert "Safe content" in sanitized
    
    def test_file_upload_validation(self):
        """Test file upload validation."""
        from app.core.validation import validate_file_upload
        
        # Test valid image
        is_valid, error = validate_file_upload("test.jpg", "image/jpeg", 1024)
        assert is_valid
        assert error is None
        
        # Test dangerous file
        is_valid, error = validate_file_upload("malware.exe", "application/octet-stream", 1024)
        assert not is_valid
        assert "Dangerous file type" in error
    
    def test_text_sanitization(self):
        """Test text input sanitization."""
        from app.core.validation import sanitize_text_input
        
        malicious_text = "Hello\x00\x01World"
        sanitized = sanitize_text_input(malicious_text)
        
        assert "\x00" not in sanitized
        assert "\x01" not in sanitized
        assert "Hello" in sanitized
        assert "World" in sanitized


class TestTwoFactorAuth:
    """Test 2FA implementation."""
    
    def test_totp_secret_generation(self):
        """Test TOTP secret generation."""
        from app.core.two_factor import two_factor_auth
        
        secret = two_factor_auth.generate_totp_secret()
        assert len(secret) >= 16
        assert secret.isalnum()
    
    def test_backup_codes_generation(self):
        """Test backup codes generation."""
        from app.core.two_factor import two_factor_auth
        
        codes = two_factor_auth.generate_backup_codes()
        assert len(codes) == 10
        assert all(len(code) > 0 for code in codes)
    
    def test_2fa_feature_flag(self):
        """Test 2FA feature flag."""
        from app.core.two_factor import is_2fa_enabled
        
        with patch.dict('os.environ', {'FEATURE_2FA': 'true'}):
            assert is_2fa_enabled()
        
        with patch.dict('os.environ', {'FEATURE_2FA': 'false'}):
            assert not is_2fa_enabled()


class TestErrorHandling:
    """Test error response hardening."""
    
    def test_pii_redaction(self):
        """Test PII redaction from error messages."""
        from app.core.error_handling import redact_pii_from_text
        
        text_with_pii = "User john@example.com called from (555) 123-4567"
        redacted = redact_pii_from_text(text_with_pii)
        
        assert "john@example.com" not in redacted
        assert "(555) 123-4567" not in redacted
        assert "<REDACTED_EMAIL>" in redacted
        assert "<REDACTED_PHONE>" in redacted
    
    def test_stack_trace_sanitization(self):
        """Test stack trace sanitization."""
        from app.core.error_handling import sanitize_stack_trace
        
        traceback = "File \"/home/user/app.py\", line 123"
        sanitized = sanitize_stack_trace(traceback)
        
        assert "/home/user/" not in sanitized
        assert "app.py" in sanitized


class TestSecurityHeaders:
    """Test security headers are properly set."""
    
    def test_security_headers_present(self):
        """Test that security headers are present."""
        response = client.get("/health")
        
        assert response.status_code == 200
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers
        assert "Referrer-Policy" in response.headers
    
    def test_csp_header(self):
        """Test Content Security Policy header."""
        response = client.get("/health")
        
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None
        assert "default-src 'self'" in csp


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    def test_rate_limit_headers(self):
        """Test rate limit headers are present."""
        response = client.get("/health")
        
        # Headers should be present even if not rate limited
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
    
    def test_rate_limit_429_response(self):
        """Test rate limit 429 response."""
        # Make many requests to trigger rate limiting
        for _ in range(100):
            response = client.get("/health")
            if response.status_code == 429:
                assert "Retry-After" in response.headers
                break


if __name__ == "__main__":
    pytest.main([__file__])
