"""
Tests for signed export URLs (Phase 2.5 Hardening).
"""

import pytest
import time
from app.core.security import sign_path, verify_token


class TestSignedURLs:
    """Test suite for signed URL functionality."""
    
    def test_sign_and_verify_valid_token(self):
        """Test signing and verifying a valid token."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 600  # 10 minutes
        
        # Sign the path
        token = sign_path(path, secret, ttl)
        
        # Verify should succeed
        assert verify_token(path, token, secret) is True
    
    def test_expired_token(self):
        """Test that expired tokens are rejected."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 1  # 1 second
        
        # Sign the path
        token = sign_path(path, secret, ttl)
        
        # Wait for expiration
        time.sleep(2)
        
        # Verify should fail
        assert verify_token(path, token, secret) is False
    
    def test_tampered_path(self):
        """Test that tokens don't work with different paths."""
        path1 = "/api/v1/evidence/123/export-chain-of-custody"
        path2 = "/api/v1/evidence/456/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 600
        
        # Sign path1
        token = sign_path(path1, secret, ttl)
        
        # Try to verify with path2 (should fail)
        assert verify_token(path2, token, secret) is False
    
    def test_wrong_secret(self):
        """Test that tokens fail with wrong secret."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret1 = "secret_key_1"
        secret2 = "secret_key_2"
        ttl = 600
        
        # Sign with secret1
        token = sign_path(path, secret1, ttl)
        
        # Verify with secret2 (should fail)
        assert verify_token(path, token, secret2) is False
    
    def test_malformed_token(self):
        """Test that malformed tokens are rejected."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        
        # Various malformed tokens
        malformed_tokens = [
            "not_a_valid_token",
            "12345",
            "12345.",
            ".signature_only",
            "",
            "12345.invalid_base64!@#",
        ]
        
        for bad_token in malformed_tokens:
            assert verify_token(path, bad_token, secret) is False
    
    def test_different_scopes(self):
        """Test that tokens with different scopes don't verify."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 600
        
        # Sign with "export" scope
        token = sign_path(path, secret, ttl, scope="export")
        
        # Verify with different scope (should fail)
        assert verify_token(path, token, secret, scope="download") is False
        
        # Verify with same scope (should succeed)
        assert verify_token(path, token, secret, scope="export") is True
    
    def test_token_format(self):
        """Test that tokens have expected format."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 600
        
        token = sign_path(path, secret, ttl)
        
        # Token should have format: "expiry.signature"
        parts = token.split(".")
        assert len(parts) == 2
        
        # First part should be numeric (expiry timestamp)
        expiry_str = parts[0]
        assert expiry_str.isdigit()
        
        # Expiry should be in the future
        expiry = int(expiry_str)
        current_time = int(time.time())
        assert expiry > current_time
        assert expiry <= current_time + ttl + 5  # Allow small time drift
        
        # Second part should be base64url (alphanumeric + - and _)
        signature = parts[1]
        assert len(signature) > 0
        assert all(c.isalnum() or c in "-_" for c in signature)
    
    def test_multiple_tokens_same_path(self):
        """Test that multiple tokens can be generated for same path."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 600
        
        # Generate multiple tokens
        token1 = sign_path(path, secret, ttl)
        time.sleep(0.1)  # Small delay to ensure different timestamps
        token2 = sign_path(path, secret, ttl)
        
        # Both should verify (they have different expiry times)
        assert verify_token(path, token1, secret) is True
        assert verify_token(path, token2, secret) is True
        
        # Tokens should be different (different timestamps)
        assert token1 != token2
    
    def test_short_ttl(self):
        """Test tokens with very short TTL."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 1  # 1 second
        
        token = sign_path(path, secret, ttl)
        
        # Should verify immediately
        assert verify_token(path, token, secret) is True
        
        # Wait for expiration
        time.sleep(2)
        
        # Should not verify after expiration
        assert verify_token(path, token, secret) is False
    
    def test_long_ttl(self):
        """Test tokens with long TTL."""
        path = "/api/v1/evidence/123/export-chain-of-custody"
        secret = "test_secret_key"
        ttl = 86400  # 24 hours
        
        token = sign_path(path, secret, ttl)
        
        # Should verify
        assert verify_token(path, token, secret) is True
        
        # Parse token to check expiry
        expiry_str = token.split(".")[0]
        expiry = int(expiry_str)
        current_time = int(time.time())
        
        # Expiry should be ~24 hours in the future
        assert expiry > current_time + 86000  # At least 23h 55m
        assert expiry < current_time + 86500  # At most 24h 5m


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


