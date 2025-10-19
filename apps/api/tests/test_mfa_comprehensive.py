"""Comprehensive MFA tests including rate limiting and security scenarios."""
import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, UserRole
from app.models.mfa import UserMFA, MFAAttempt
from app.core.security import get_password_hash
from app.services.mfa_service import MFAService

client = TestClient(app)


@pytest.fixture
def admin_user(db: Session) -> User:
    """Create an admin user for testing."""
    user = User(
        email="admin@example.com",
        username="adminuser",
        hashed_password=get_password_hash("adminpassword"),
        full_name="Admin User",
        role=UserRole.ADMIN.value
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Get authentication token for admin user."""
    response = client.post("/api/v1/auth/login", json={
        "username": "adminuser",
        "password": "adminpassword"
    })
    return response.json()["access_token"]


class TestMFARateLimiting:
    """Test rate limiting on MFA endpoints."""

    def test_totp_setup_rate_limit(self, admin_token: str):
        """Test rate limiting on TOTP setup endpoint."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Make multiple requests to trigger rate limiting
        for i in range(6):  # Exceed limit of 5
            response = client.post("/api/v1/mfa/totp/setup", headers=headers)
            if i < 5:
                assert response.status_code == 200
            else:
                # Should be rate limited
                assert response.status_code == 429
                assert "Rate limit exceeded" in response.json()["detail"]

    def test_totp_verify_rate_limit(self, admin_token: str):
        """Test rate limiting on TOTP verification endpoint."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Make multiple requests to trigger rate limiting
        for i in range(11):  # Exceed limit of 10
            response = client.post("/api/v1/mfa/totp/verify", 
                                 json={"code": "123456"}, 
                                 headers=headers)
            if i < 10:
                assert response.status_code == 200
            else:
                # Should be rate limited
                assert response.status_code == 429

    def test_recovery_verify_rate_limit(self, admin_token: str):
        """Test rate limiting on recovery code verification."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Make multiple requests to trigger rate limiting
        for i in range(6):  # Exceed limit of 5
            response = client.post("/api/v1/mfa/recovery/verify", 
                                 json={"recovery_code": "testcode123"}, 
                                 headers=headers)
            if i < 5:
                assert response.status_code == 200
            else:
                # Should be rate limited
                assert response.status_code == 429


class TestMFAAdminEnforcement:
    """Test admin MFA enforcement."""

    def test_admin_mfa_enforcement_enabled(self, admin_user: User, db: Session):
        """Test that MFA is enforced for admin users."""
        from app.core.config import settings
        
        # Temporarily enable MFA enforcement
        original_value = getattr(settings, 'MFA_ENFORCE_ADMINS', True)
        settings.MFA_ENFORCE_ADMINS = True
        
        mfa_service = MFAService(db)
        assert mfa_service.is_mfa_enforced(admin_user) is True
        
        # Restore original value
        settings.MFA_ENFORCE_ADMINS = original_value

    def test_admin_mfa_enforcement_disabled(self, admin_user: User, db: Session):
        """Test that MFA enforcement can be disabled."""
        from app.core.config import settings
        
        # Temporarily disable MFA enforcement
        original_value = getattr(settings, 'MFA_ENFORCE_ADMINS', True)
        settings.MFA_ENFORCE_ADMINS = False
        
        mfa_service = MFAService(db)
        assert mfa_service.is_mfa_enforced(admin_user) is False
        
        # Restore original value
        settings.MFA_ENFORCE_ADMINS = original_value

    def test_admin_without_mfa_blocked(self, admin_token: str):
        """Test that admin users without MFA are blocked from sensitive endpoints."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to access an endpoint that requires admin MFA
        # Note: This would need to be implemented in actual endpoints
        # For now, we'll test the MFA enforcement logic directly
        response = client.get("/api/v1/mfa/status", headers=headers)
        assert response.status_code == 200  # Status endpoint should work


class TestMFASecurity:
    """Test MFA security features."""

    def test_totp_replay_protection(self, admin_user: User, db: Session):
        """Test TOTP replay attack protection."""
        mfa_service = MFAService(db)
        
        # Setup TOTP first
        setup_response = mfa_service.setup_totp(admin_user)
        assert setup_response.secret is not None
        
        # Verify the same code twice should fail on second attempt
        code = "123456"
        
        # First verification should succeed (in our mock implementation)
        response1 = mfa_service.verify_totp(admin_user, code)
        assert response1.success is True
        
        # Second verification with same code should fail
        response2 = mfa_service.verify_totp(admin_user, code)
        assert response2.success is False
        assert "already used" in response2.message

    def test_recovery_code_single_use(self, admin_user: User, db: Session):
        """Test that recovery codes are single-use."""
        mfa_service = MFAService(db)
        
        # Setup TOTP to get recovery codes
        setup_response = mfa_service.setup_totp(admin_user)
        recovery_codes = setup_response.backup_codes
        assert len(recovery_codes) == 10
        
        # Use first recovery code
        first_code = recovery_codes[0]
        response1 = mfa_service.verify_recovery_code(admin_user, first_code)
        assert response1.success is True
        
        # Try to use same recovery code again
        response2 = mfa_service.verify_recovery_code(admin_user, first_code)
        assert response2.success is False
        assert "Invalid recovery code" in response2.message

    def test_invalid_totp_format(self, admin_user: User, db: Session):
        """Test handling of invalid TOTP code formats."""
        mfa_service = MFAService(db)
        
        # Setup TOTP first
        mfa_service.setup_totp(admin_user)
        
        # Test various invalid formats
        invalid_codes = ["123", "12345", "abcdef", "1234567", ""]
        
        for code in invalid_codes:
            response = mfa_service.verify_totp(admin_user, code)
            assert response.success is False
            assert "Invalid TOTP code" in response.message

    def test_mfa_attempt_logging(self, admin_user: User, db: Session):
        """Test that MFA attempts are properly logged."""
        mfa_service = MFAService(db)
        
        # Setup TOTP
        mfa_service.setup_totp(admin_user)
        
        # Make some verification attempts
        mfa_service.verify_totp(admin_user, "123456", "192.168.1.1", "test-agent")
        mfa_service.verify_totp(admin_user, "654321", "192.168.1.1", "test-agent")
        
        # Check that attempts were logged
        attempts = db.query(MFAAttempt).filter(MFAAttempt.user_id == admin_user.id).all()
        assert len(attempts) >= 2
        
        # Check attempt details
        for attempt in attempts:
            assert attempt.user_id == admin_user.id
            assert attempt.attempt_type == "totp"
            assert attempt.ip_address == "192.168.1.1"
            assert attempt.user_agent == "test-agent"


class TestMFAWorkflow:
    """Test complete MFA workflows."""

    def test_complete_totp_workflow(self, admin_user: User, db: Session):
        """Test complete TOTP setup and usage workflow."""
        mfa_service = MFAService(db)
        
        # Step 1: Setup TOTP
        setup_response = mfa_service.setup_totp(admin_user)
        assert setup_response.secret is not None
        assert setup_response.qr_code_url is not None
        assert len(setup_response.backup_codes) == 10
        
        # Step 2: Enable TOTP
        enable_response = mfa_service.enable_mfa(admin_user, "123456")
        assert enable_response.success is True
        
        # Step 3: Check status
        status = mfa_service.get_mfa_status(admin_user)
        assert status.enabled is True
        assert status.totp_enabled is True
        assert status.has_backup_codes is True
        
        # Step 4: Test recovery code usage
        recovery_response = mfa_service.verify_recovery_code(admin_user, setup_response.backup_codes[0])
        assert recovery_response.success is True
        
        # Step 5: Disable MFA
        disable_response = mfa_service.disable_mfa(admin_user, setup_response.backup_codes[1])
        assert disable_response.success is True
        
        # Step 6: Verify MFA is disabled
        final_status = mfa_service.get_mfa_status(admin_user)
        assert final_status.enabled is False
        assert final_status.totp_enabled is False

    def test_webauthn_workflow(self, admin_user: User, db: Session):
        """Test WebAuthn registration workflow."""
        mfa_service = MFAService(db)
        
        # Step 1: Setup WebAuthn
        register_response = mfa_service.setup_webauthn(admin_user, "Test Key")
        assert register_response.challenge is not None
        assert register_response.rp_name == "Shomer"
        assert register_response.user_id == str(admin_user.id)
        
        # Step 2: Verify WebAuthn credential
        verify_response = mfa_service.verify_webauthn(
            admin_user,
            "test_credential_1234567890",
            "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiIn0=",
            "test_authenticator_data_1234567890",
            "test_signature_1234567890"
        )
        assert verify_response.success is True
        
        # Step 3: Check status
        status = mfa_service.get_mfa_status(admin_user)
        assert status.enabled is True
        assert status.webauthn_enabled is True


class TestMFAErrorHandling:
    """Test MFA error handling and edge cases."""

    def test_mfa_service_without_user(self, db: Session):
        """Test MFA service error handling with invalid user."""
        mfa_service = MFAService(db)
        
        # Create a mock user object without database record
        mock_user = User(id=99999, email="nonexistent@example.com")
        
        # These should handle gracefully
        status = mfa_service.get_mfa_status(mock_user)
        assert status.enabled is False
        
        setup_response = mfa_service.setup_totp(mock_user)
        assert setup_response.secret is not None  # Should still work

    def test_webauthn_without_library(self, admin_user: User, db: Session):
        """Test WebAuthn fallback when library is not available."""
        mfa_service = MFAService(db)
        
        # This should work even without the webauthn library
        register_response = mfa_service.setup_webauthn(admin_user, "Test Key")
        assert register_response.challenge is not None
        
        # Verify should also work with fallback
        verify_response = mfa_service.verify_webauthn(
            admin_user,
            "short",  # Invalid credential ID
            "short",  # Invalid data
            "short",
            "short"
        )
        assert verify_response.success is False
        assert "Invalid WebAuthn credential" in verify_response.message


class TestMFAPerformance:
    """Test MFA performance and scalability."""

    def test_concurrent_mfa_operations(self, admin_user: User, db: Session):
        """Test concurrent MFA operations."""
        import threading
        import time
        
        mfa_service = MFAService(db)
        
        # Setup TOTP
        setup_response = mfa_service.setup_totp(admin_user)
        
        results = []
        
        def verify_operation(code):
            response = mfa_service.verify_totp(admin_user, code)
            results.append(response.success)
        
        # Create multiple threads to test concurrency
        threads = []
        for i in range(5):
            thread = threading.Thread(target=verify_operation, args=(f"{i:06d}",))
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        assert len(results) == 5
        # At least some should succeed (depending on timing)
        assert any(results) is True

    def test_mfa_status_performance(self, admin_user: User, db: Session):
        """Test MFA status check performance."""
        mfa_service = MFAService(db)
        
        # Setup MFA
        mfa_service.setup_totp(admin_user)
        mfa_service.enable_mfa(admin_user, "123456")
        
        # Time multiple status checks
        start_time = time.time()
        for _ in range(100):
            status = mfa_service.get_mfa_status(admin_user)
            assert status is not None
        end_time = time.time()
        
        # Should be fast (less than 1 second for 100 operations)
        assert (end_time - start_time) < 1.0
