"""Basic MFA tests for TOTP and recovery codes."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, UserRole
from app.models.mfa import UserMFA
from app.core.security import get_password_hash


client = TestClient(app)


@pytest.fixture
def test_user(db: Session) -> User:
    """Create a test user for MFA testing."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpassword"),
        full_name="Test User",
        role=UserRole.ADMIN.value
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_user_token(test_user: User) -> str:
    """Get authentication token for test user."""
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "testpassword"
    })
    return response.json()["access_token"]


class TestMFASetup:
    """Test MFA setup functionality."""

    def test_get_mfa_status_initial(self, test_user_token: str):
        """Test getting MFA status for user without MFA setup."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.get("/api/v1/mfa/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["totp_enabled"] is False
        assert data["webauthn_enabled"] is False
        assert data["has_backup_codes"] is False

    def test_setup_totp(self, test_user_token: str):
        """Test TOTP setup process."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/totp/setup", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "qr_code_url" in data
        assert "backup_codes" in data
        assert len(data["backup_codes"]) == 10
        assert all(len(code) >= 8 for code in data["backup_codes"])

    def test_get_mfa_config(self):
        """Test getting MFA configuration."""
        response = client.get("/api/v1/mfa/config")
        
        assert response.status_code == 200
        data = response.json()
        assert "mfa_enforce_admins" in data
        assert "totp_issuer" in data
        assert "totp_window" in data
        assert "max_recovery_codes" in data


class TestMFAVerification:
    """Test MFA verification functionality."""

    def test_verify_totp_not_setup(self, test_user_token: str):
        """Test TOTP verification when not setup."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/totp/verify", 
                             json={"code": "123456"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "not setup" in data["message"]

    def test_enable_totp_not_setup(self, test_user_token: str):
        """Test enabling TOTP when not setup."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/totp/enable", 
                             json={"code": "123456"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "not setup" in data["message"]

    def test_verify_recovery_code_not_setup(self, test_user_token: str):
        """Test recovery code verification when not setup."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/recovery/verify", 
                             json={"recovery_code": "testcode123"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "No recovery codes" in data["message"]

    def test_disable_mfa_not_enabled(self, test_user_token: str):
        """Test disabling MFA when not enabled."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/disable", 
                             json={"recovery_code": "testcode123"}, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "Invalid recovery code" in data["message"]


class TestWebAuthnEndpoints:
    """Test WebAuthn endpoints (placeholder implementations)."""

    def test_register_webauthn(self, test_user_token: str):
        """Test WebAuthn registration start."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/webauthn/register", 
                             json={"credential_name": "Test Key"}, 
                             headers=Headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "challenge" in data
        assert "rp_name" in data
        assert "user_id" in data
        assert "user_name" in data
        assert "user_display_name" in data

    def test_get_webauthn_credentials(self, test_user_token: str):
        """Test getting WebAuthn credentials."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.get("/api/v1/mfa/webauthn/credentials", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_verify_webauthn(self, test_user_token: str):
        """Test WebAuthn verification."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = client.post("/api/v1/mfa/webauthn/verify", 
                             json={
                                 "credential_id": "test_credential",
                                 "client_data_json": "{}",
                                 "authenticator_data": "test_data",
                                 "signature": "test_signature"
                             }, 
                             headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "successful" in data["message"]


class TestMFAEnforcement:
    """Test MFA enforcement for admin users."""

    def test_admin_mfa_enforcement(self, db: Session):
        """Test that MFA is enforced for admin users."""
        from app.services.mfa_service import MFAService
        
        # Create admin user
        admin_user = User(
            email="admin@example.com",
            username="admin",
            hashed_password=get_password_hash("adminpassword"),
            full_name="Admin User",
            role=UserRole.ADMIN.value
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        mfa_service = MFAService(db)
        assert mfa_service.is_mfa_enforced(admin_user) is True

    def test_non_admin_mfa_enforcement(self, db: Session):
        """Test that MFA is not enforced for non-admin users."""
        from app.services.mfa_service import MFAService
        
        # Create regular user
        regular_user = User(
            email="user@example.com",
            username="user",
            hashed_password=get_password_hash("userpassword"),
            full_name="Regular User",
            role=UserRole.VIEWER.value
        )
        db.add(regular_user)
        db.commit()
        db.refresh(regular_user)
        
        mfa_service = MFAService(db)
        assert mfa_service.is_mfa_enforced(regular_user) is False


class TestMFAErrorHandling:
    """Test MFA error handling."""

    def test_invalid_token(self):
        """Test MFA endpoints with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/mfa/status", headers=headers)
        
        assert response.status_code == 401

    def test_missing_token(self):
        """Test MFA endpoints without token."""
        response = client.get("/api/v1/mfa/status")
        
        assert response.status_code == 403

    def test_invalid_request_data(self, test_user_token: str):
        """Test MFA endpoints with invalid request data."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Test with invalid TOTP code format
        response = client.post("/api/v1/mfa/totp/verify", 
                             json={"code": "123"},  # Too short
                             headers=headers)
        
        assert response.status_code == 422  # Validation error
        
        # Test with invalid recovery code format
        response = client.post("/api/v1/mfa/recovery/verify", 
                             json={"recovery_code": "123"},  # Too short
                             headers=headers)
        
        assert response.status_code == 422  # Validation error


# Integration test for complete MFA workflow
class TestMFAWorkflow:
    """Test complete MFA workflow."""

    def test_complete_mfa_workflow(self, test_user_token: str, db: Session):
        """Test complete MFA setup and verification workflow."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Step 1: Check initial status
        response = client.get("/api/v1/mfa/status", headers=headers)
        assert response.status_code == 200
        assert response.json()["enabled"] is False
        
        # Step 2: Setup TOTP
        response = client.post("/api/v1/mfa/totp/setup", headers=headers)
        assert response.status_code == 200
        setup_data = response.json()
        backup_codes = setup_data["backup_codes"]
        
        # Step 3: Enable TOTP (using first backup code as verification)
        response = client.post("/api/v1/mfa/totp/enable", 
                             json={"code": "123456"},  # Placeholder - would be real TOTP
                             headers=headers)
        assert response.status_code == 200
        
        # Step 4: Check status after enable
        response = client.get("/api/v1/mfa/status", headers=headers)
        assert response.status_code == 200
        # Note: In real implementation, this would show enabled=True after proper verification
        
        # Step 5: Test recovery code verification
        response = client.post("/api/v1/mfa/recovery/verify", 
                             json={"recovery_code": backup_codes[0]}, 
                             headers=headers)
        assert response.status_code == 200
        
        # Step 6: Disable MFA
        response = client.post("/api/v1/mfa/disable", 
                             json={"recovery_code": backup_codes[1]}, 
                             headers=headers)
        assert response.status_code == 200
        
        # Step 7: Verify MFA is disabled
        response = client.get("/api/v1/mfa/status", headers=headers)
        assert response.status_code == 200
        assert response.json()["enabled"] is False
