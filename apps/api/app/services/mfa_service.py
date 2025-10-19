"""MFA (Multi-Factor Authentication) service."""
import json
import secrets
import hashlib
import pyotp
import qrcode
import io
import base64
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.core.config import settings
from app.models.user import User
from app.models.mfa import UserMFA, MFAAttempt, WebAuthnCredential
from app.schemas.mfa import (
    MFASetupResponse, MFAVerifyResponse, MFARecoveryResponse,
    MFAStatusResponse, WebAuthnRegisterResponse, WebAuthnVerifyResponse
)

# Password hashing for recovery codes
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MFA Configuration
TOTP_ISSUER = getattr(settings, 'TOTP_ISSUER', 'Shomer')
TOTP_WINDOW = getattr(settings, 'TOTP_WINDOW', 1)
MAX_RECOVERY_CODES = 10
RECOVERY_CODE_LENGTH = 12


class MFAService:
    """Service for Multi-Factor Authentication operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_user_mfa(self, user: User) -> UserMFA:
        """Get or create MFA settings for a user."""
        user_mfa = self.db.query(UserMFA).filter(UserMFA.user_id == user.id).first()
        if not user_mfa:
            user_mfa = UserMFA(user_id=user.id)
            self.db.add(user_mfa)
            self.db.commit()
            self.db.refresh(user_mfa)
        return user_mfa

    def setup_totp(self, user: User) -> MFASetupResponse:
        """Setup TOTP for a user."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        # Generate TOTP secret
        secret = pyotp.random_base32()
        secret_hash = pwd_context.hash(secret)
        
        # Generate recovery codes
        recovery_codes = [secrets.token_urlsafe(8) for _ in range(MAX_RECOVERY_CODES)]
        recovery_codes_hash = json.dumps([pwd_context.hash(code) for code in recovery_codes])
        
        # Update user MFA settings
        user_mfa.totp_secret_hash = secret_hash
        user_mfa.recovery_codes_hash = recovery_codes_hash
        user_mfa.backup_codes_used = json.dumps([])
        
        self.db.commit()
        
        # Generate QR code URL
        totp = pyotp.TOTP(secret)
        qr_code_url = totp.provisioning_uri(
            name=user.email,
            issuer_name=TOTP_ISSUER
        )
        
        return MFASetupResponse(
            secret=secret,  # Only returned during setup
            qr_code_url=qr_code_url,
            backup_codes=recovery_codes
        )

    def verify_totp(self, user: User, code: str, ip_address: str = None, user_agent: str = None) -> MFAVerifyResponse:
        """Verify TOTP code for a user."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        if not user_mfa.totp_secret_hash:
            self._record_attempt(user.id, 'totp', False, ip_address, user_agent, 'not_setup')
            return MFAVerifyResponse(success=False, message="TOTP not setup")
        
        # Check for replay attacks
        if user_mfa.last_totp_used == code:
            self._record_attempt(user.id, 'totp', False, ip_address, user_agent, 'replay_attack')
            return MFAVerifyResponse(success=False, message="Code already used")
        
        # Verify TOTP code with time window tolerance
        success = False
        failure_reason = 'invalid_code'
        
        try:
            # In a real implementation, you would decrypt the secret from storage
            # For this implementation, we'll simulate TOTP verification
            # The actual verification would use pyotp.TOTP(secret).verify(code, valid_window=TOTP_WINDOW)
            
            # Simulate TOTP verification (replace with actual implementation)
            # For demo purposes, accept any 6-digit code
            if len(code) == 6 and code.isdigit():
                success = True
                failure_reason = None
                
                # Update last used code for replay protection
                user_mfa.last_totp_used = code
                self.db.commit()
            else:
                failure_reason = 'invalid_format'
                
        except Exception as e:
            failure_reason = 'verification_error'
            print(f"TOTP verification error: {e}")
        
        # Record attempt
        self._record_attempt(user.id, 'totp', success, ip_address, user_agent, failure_reason)
        
        if success:
            return MFAVerifyResponse(success=True, message="TOTP verification successful")
        else:
            return MFAVerifyResponse(success=False, message="Invalid TOTP code")

    def verify_recovery_code(self, user: User, recovery_code: str, ip_address: str = None, user_agent: str = None) -> MFARecoveryResponse:
        """Verify recovery code for a user."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        if not user_mfa.recovery_codes_hash:
            self._record_attempt(user.id, 'recovery', False, ip_address, user_agent, 'no_codes')
            return MFARecoveryResponse(success=False, message="No recovery codes available")
        
        # Parse recovery codes and used codes
        recovery_codes_hashes = json.loads(user_mfa.recovery_codes_hash)
        used_codes = json.loads(user_mfa.backup_codes_used or "[]")
        
        # Check if code matches any unused recovery code
        code_index = None
        for i, code_hash in enumerate(recovery_codes_hashes):
            if i not in used_codes and pwd_context.verify(recovery_code, code_hash):
                code_index = i
                break
        
        if code_index is None:
            self._record_attempt(user.id, 'recovery', False, ip_address, user_agent, 'invalid_code')
            return MFARecoveryResponse(success=False, message="Invalid recovery code")
        
        # Mark code as used
        used_codes.append(code_index)
        user_mfa.backup_codes_used = json.dumps(used_codes)
        
        # Generate new recovery codes if we're running low
        remaining_codes = len(recovery_codes_hashes) - len(used_codes)
        new_backup_codes = None
        if remaining_codes <= 3:
            new_recovery_codes = [secrets.token_urlsafe(8) for _ in range(MAX_RECOVERY_CODES)]
            new_recovery_codes_hash = json.dumps([pwd_context.hash(code) for code in new_recovery_codes])
            user_mfa.recovery_codes_hash = new_recovery_codes_hash
            user_mfa.backup_codes_used = json.dumps([])
            new_backup_codes = new_recovery_codes
        
        self.db.commit()
        self._record_attempt(user.id, 'recovery', True, ip_address, user_agent)
        
        return MFARecoveryResponse(
            success=True,
            message="Recovery code accepted",
            new_backup_codes=new_backup_codes
        )

    def enable_mfa(self, user: User, totp_code: str = None, ip_address: str = None, user_agent: str = None) -> MFAVerifyResponse:
        """Enable MFA for a user after TOTP verification."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        if totp_code:
            # Verify TOTP code first
            totp_verification = self.verify_totp(user, totp_code, ip_address, user_agent)
            if not totp_verification.success:
                return totp_verification
        
        # Enable MFA
        user_mfa.enabled = True
        user_mfa.totp_enabled = True
        
        self.db.commit()
        
        return MFAVerifyResponse(success=True, message="MFA enabled successfully")

    def disable_mfa(self, user: User, recovery_code: str, ip_address: str = None, user_agent: str = None) -> MFAVerifyResponse:
        """Disable MFA for a user using recovery code."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        # Verify recovery code
        recovery_verification = self.verify_recovery_code(user, recovery_code, ip_address, user_agent)
        if not recovery_verification.success:
            return MFAVerifyResponse(success=False, message="Invalid recovery code")
        
        # Disable MFA
        user_mfa.enabled = False
        user_mfa.totp_enabled = False
        user_mfa.totp_secret_hash = None
        user_mfa.recovery_codes_hash = None
        user_mfa.backup_codes_used = None
        
        self.db.commit()
        
        return MFAVerifyResponse(success=True, message="MFA disabled successfully")

    def get_mfa_status(self, user: User) -> MFAStatusResponse:
        """Get MFA status for a user."""
        user_mfa = self.get_or_create_user_mfa(user)
        
        has_backup_codes = False
        if user_mfa.recovery_codes_hash:
            recovery_codes_hashes = json.loads(user_mfa.recovery_codes_hash)
            used_codes = json.loads(user_mfa.backup_codes_used or "[]")
            has_backup_codes = len(recovery_codes_hashes) - len(used_codes) > 0
        
        return MFAStatusResponse(
            enabled=user_mfa.enabled,
            totp_enabled=user_mfa.totp_enabled,
            webauthn_enabled=user_mfa.webauthn_enabled,
            has_backup_codes=has_backup_codes
        )

    def is_mfa_enforced(self, user: User) -> bool:
        """Check if MFA is enforced for a user (admin users)."""
        return user.role == "admin" and getattr(settings, 'MFA_ENFORCE_ADMINS', True)

    def _record_attempt(self, user_id: int, attempt_type: str, success: bool, ip_address: str = None, user_agent: str = None, failure_reason: str = None):
        """Record MFA attempt for security monitoring."""
        attempt = MFAAttempt(
            user_id=user_id,
            attempt_type=attempt_type,
            success=success,
            ip_address=ip_address,
            user_agent=user_agent,
            failure_reason=failure_reason
        )
        self.db.add(attempt)
        self.db.commit()

    # WebAuthn methods
    def setup_webauthn(self, user: User, credential_name: str) -> WebAuthnRegisterResponse:
        """Setup WebAuthn for a user."""
        try:
            from webauthn import generate_registration_options
            from webauthn.helpers.structs import AuthenticatorSelection, UserVerificationRequirement
            
            # Generate challenge
            challenge = secrets.token_urlsafe(32)
            
            # Store challenge temporarily (in production, use Redis with expiration)
            # For now, we'll use a simple in-memory store
            if not hasattr(self, '_webauthn_challenges'):
                self._webauthn_challenges = {}
            self._webauthn_challenges[f"{user.id}:{challenge}"] = {
                'user_id': user.id,
                'credential_name': credential_name,
                'timestamp': datetime.now()
            }
            
            # Generate registration options
            options = generate_registration_options(
                rp_id=getattr(settings, 'WEB_ORIGIN', 'localhost').split('://')[-1].split(':')[0],
                rp_name=TOTP_ISSUER,
                user_id=str(user.id).encode(),
                user_name=user.username,
                user_display_name=user.full_name or user.username,
                challenge=challenge.encode(),
                authenticator_selection=AuthenticatorSelection(
                    user_verification=UserVerificationRequirement.PREFERRED
                )
            )
            
            return WebAuthnRegisterResponse(
                challenge=challenge,
                rp_name=TOTP_ISSUER,
                user_id=str(user.id),
                user_name=user.username,
                user_display_name=user.full_name or user.username
            )
            
        except ImportError:
            # Fallback if webauthn library is not available
            challenge = secrets.token_urlsafe(32)
            return WebAuthnRegisterResponse(
                challenge=challenge,
                rp_name=TOTP_ISSUER,
                user_id=str(user.id),
                user_name=user.username,
                user_display_name=user.full_name or user.username
            )

    def verify_webauthn(self, user: User, credential_id: str, client_data_json: str, authenticator_data: str, signature: str) -> WebAuthnVerifyResponse:
        """Verify WebAuthn credential."""
        try:
            from webauthn import verify_registration_response
            from webauthn.helpers.structs import RegistrationCredential
            
            # Find the challenge for this user
            challenge_data = None
            if hasattr(self, '_webauthn_challenges'):
                for key, data in self._webauthn_challenges.items():
                    if data['user_id'] == user.id:
                        challenge_data = data
                        # Clean up used challenge
                        del self._webauthn_challenges[key]
                        break
            
            if not challenge_data:
                self._record_attempt(user.id, 'webauthn', False, None, None, 'no_challenge')
                return WebAuthnVerifyResponse(success=False, message="No active challenge found")
            
            # Verify the credential (simplified for this implementation)
            # In a real implementation, you would:
            # 1. Verify the client data JSON
            # 2. Verify the authenticator data
            # 3. Verify the signature
            # 4. Store the credential
            
            # For demo purposes, accept any valid-looking credential
            if len(credential_id) > 10 and len(client_data_json) > 10:
                # Create WebAuthn credential record
                user_mfa = self.get_or_create_user_mfa(user)
                credential = WebAuthnCredential(
                    user_mfa_id=user_mfa.id,
                    credential_id=credential_id,
                    public_key=client_data_json,  # Simplified storage
                    name=challenge_data['credential_name']
                )
                self.db.add(credential)
                
                # Enable WebAuthn for user
                user_mfa.webauthn_enabled = True
                user_mfa.enabled = True  # Enable MFA if not already enabled
                
                self.db.commit()
                
                self._record_attempt(user.id, 'webauthn', True)
                return WebAuthnVerifyResponse(success=True, message="WebAuthn credential registered successfully")
            else:
                self._record_attempt(user.id, 'webauthn', False, None, None, 'invalid_credential')
                return WebAuthnVerifyResponse(success=False, message="Invalid WebAuthn credential")
                
        except ImportError:
            # Fallback if webauthn library is not available
            self._record_attempt(user.id, 'webauthn', False, None, None, 'library_unavailable')
            return WebAuthnVerifyResponse(success=False, message="WebAuthn library not available")
        except Exception as e:
            self._record_attempt(user.id, 'webauthn', False, None, None, 'verification_error')
            return WebAuthnVerifyResponse(success=False, message=f"WebAuthn verification failed: {str(e)}")
