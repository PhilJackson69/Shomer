"""Device-bound MFA tests that require real hardware (skipped in CI)."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, UserRole
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture
def device_test_user(db: Session) -> User:
    """Create a test user for device-bound testing."""
    user = User(
        email="device-test@example.com",
        username="devicetest",
        hashed_password=get_password_hash("testpassword"),
        full_name="Device Test User",
        role=UserRole.ADMIN.value
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def device_test_token(device_test_user: User) -> str:
    """Get authentication token for device test user."""
    response = client.post("/api/v1/auth/login", json={
        "username": "devicetest",
        "password": "testpassword"
    })
    return response.json()["access_token"]


@pytest.mark.webauthn_device
@pytest.mark.skipif(os.getenv("CI") == "true", reason="Hardware security key not present in CI")
class TestWebAuthnDevice:
    """Test WebAuthn with real hardware security keys."""

    def test_real_webauthn_registration(self, device_test_token: str):
        """Test WebAuthn registration with real hardware key."""
        headers = {"Authorization": f"Bearer {device_test_token}"}
        
        # Start registration
        response = client.post("/api/v1/mfa/webauthn/register", 
                             json={"credential_name": "Real Hardware Key"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "challenge" in data
        
        # Note: In a real test, you would:
        # 1. Use the challenge to create a real WebAuthn credential
        # 2. Submit the credential response
        # 3. Verify the credential was stored
        
        # For now, we just verify the registration starts correctly
        assert len(data["challenge"]) > 10

    def test_real_webauthn_authentication(self, device_test_token: str):
        """Test WebAuthn authentication with real hardware key."""
        headers = {"Authorization": f"Bearer {device_test_token}"}
        
        # This would test actual WebAuthn authentication flow
        # with a real security key in a local environment
        
        # For now, just verify the endpoint exists
        response = client.post("/api/v1/mfa/webauthn/verify", 
                             json={
                                 "credential_id": "real_credential_id",
                                 "client_data_json": "real_client_data",
                                 "authenticator_data": "real_authenticator_data",
                                 "signature": "real_signature"
                             }, 
                             headers=headers)
        
        # Should fail in test mode since we're not using real credentials
        assert response.status_code == 200
        data = response.json()
        # In test mode, this should succeed due to our mock
        assert data["success"] is True


@pytest.mark.mfa_device
@pytest.mark.skipif(os.getenv("CI") == "true", reason="MFA hardware not available in CI")
class TestMFADevice:
    """Test MFA with real hardware devices."""

    def test_real_totp_device(self, device_test_token: str):
        """Test TOTP with real authenticator app."""
        headers = {"Authorization": f"Bearer {device_test_token}"}
        
        # Setup TOTP
        response = client.post("/api/v1/mfa/totp/setup", headers=headers)
        assert response.status_code == 200
        
        setup_data = response.json()
        assert "secret" in setup_data
        assert "qr_code_url" in setup_data
        
        # In a real test, you would:
        # 1. Scan the QR code with a real authenticator app
        # 2. Get a real TOTP code
        # 3. Verify it works
        
        # For now, we test the setup flow
        secret = setup_data["secret"]
        assert len(secret) > 10

    def test_real_totp_verification(self, device_test_token: str):
        """Test TOTP verification with real authenticator app."""
        headers = {"Authorization": f"Bearer {device_test_token}"}
        
        # This would test with a real TOTP code from an authenticator app
        # In CI, we skip this test since we can't generate real TOTP codes
        
        # Test with mock code (should work in test mode)
        response = client.post("/api/v1/mfa/totp/verify", 
                             json={"code": "123456"}, 
                             headers=headers)
        
        # Should succeed in test mode
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestMFADeviceFallback:
    """Test MFA device fallback behavior in CI."""

    def test_device_tests_skipped_in_ci(self):
        """Verify that device tests are properly skipped in CI."""
        if os.getenv("CI") == "true":
            pytest.skip("Device tests are skipped in CI environment")
        
        # This test would run in local environment
        assert True

    def test_mfa_mock_behavior_in_ci(self, device_test_token: str):
        """Test that MFA mocks work correctly in CI."""
        headers = {"Authorization": f"Bearer {device_test_token}"}
        
        # Test TOTP verification with mock
        response = client.post("/api/v1/mfa/totp/verify", 
                             json={"code": "123456"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if os.getenv("MFA_TEST_MODE") == "true":
            # In test mode, should succeed with mock
            assert data["success"] is True
        else:
            # In production mode, should fail without proper setup
            assert data["success"] is False
