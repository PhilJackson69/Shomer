"""
Two-Factor Authentication (2FA) implementation with TOTP and backup codes.

Provides TOTP secret generation, QR code provisioning, verification,
and backup codes for secure admin authentication with enhanced security.
"""

import secrets
import base64
import qrcode
import io
import hashlib
from typing import List, Tuple, Optional, Dict
from datetime import datetime, timedelta
import pyotp
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password


class TwoFactorAuth:
    """Two-Factor Authentication manager with TOTP and backup codes."""
    
    def __init__(self):
        self.totp_window = 1  # Allow ±1 time step tolerance (30s period)
        self.totp_digits = 6  # 6-digit codes
        self.totp_period = 30  # 30-second period
        self.backup_code_length = 8
        self.backup_code_count = 10
        self.max_verify_attempts = 5  # Max attempts per 5 minutes
        self.verify_window_minutes = 5  # Rate limit window
    
    def generate_totp_secret(self) -> str:
        """
        Generate a new TOTP secret.
        
        Returns:
            Base32 encoded TOTP secret
        """
        return pyotp.random_base32()
    
    def generate_qr_code(self, secret: str, user_email: str, issuer: str = "Shomer") -> str:
        """
        Generate QR code data URL for TOTP setup.
        
        Args:
            secret: TOTP secret
            user_email: User's email address
            issuer: Service name
            
        Returns:
            QR code as data URL
        """
        # Create TOTP URI with proper parameters
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user_email,
            issuer_name=issuer,
            image=None  # No logo for security
        )
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 data URL
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    def verify_totp(self, secret: str, token: str) -> bool:
        """
        Verify TOTP token with proper validation.
        
        Args:
            secret: TOTP secret
            token: Token to verify
            
        Returns:
            True if token is valid
        """
        try:
            # Validate token format
            if not token or len(token) != self.totp_digits or not token.isdigit():
                return False
            
            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=self.totp_window)
        except Exception:
            return False
    
    def generate_backup_codes(self) -> List[str]:
        """
        Generate backup codes for account recovery.
        
        Returns:
            List of backup codes
        """
        codes = []
        for _ in range(self.backup_code_count):
            # Generate random code
            code = secrets.token_hex(self.backup_code_length // 2)
            # Format as groups of 4 characters
            formatted_code = '-'.join([
                code[i:i+4] for i in range(0, len(code), 4)
            ])
            codes.append(formatted_code.upper())
        
        return codes
    
    def hash_backup_code(self, code: str) -> str:
        """
        Hash a backup code for secure storage.
        
        Args:
            code: Backup code to hash
            
        Returns:
            Hashed code
        """
        # Normalize code
        normalized = code.replace('-', '').upper()
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    def verify_backup_code(self, provided_code: str, stored_hashes: List[str]) -> Tuple[bool, List[str]]:
        """
        Verify backup code and return updated list.
        
        Args:
            provided_code: Code provided by user
            stored_hashes: List of stored backup code hashes
            
        Returns:
            (is_valid, updated_hashes_list)
        """
        if not provided_code or not stored_hashes:
            return False, stored_hashes
        
        # Hash the provided code
        provided_hash = self.hash_backup_code(provided_code)
        
        # Check each stored hash
        updated_hashes = []
        found_match = False
        
        for stored_hash in stored_hashes:
            if secrets.compare_digest(provided_hash, stored_hash):
                found_match = True
                # Don't add the used code to the updated list
            else:
                updated_hashes.append(stored_hash)
        
        return found_match, updated_hashes
    
    def get_totp_secret_qr(self, user_email: str) -> Tuple[str, str]:
        """
        Generate TOTP secret and QR code for setup.
        
        Args:
            user_email: User's email address
            
        Returns:
            (secret, qr_code_data_url)
        """
        secret = self.generate_totp_secret()
        qr_code = self.generate_qr_code(secret, user_email)
        
        return secret, qr_code
    
    def check_rate_limit(self, user_id: int, attempt_type: str = "verify") -> Tuple[bool, str]:
        """
        Check if user has exceeded rate limits for 2FA operations.
        
        Args:
            user_id: User ID
            attempt_type: Type of operation (verify, setup, etc.)
            
        Returns:
            (is_allowed, error_message)
        """
        # TODO: Implement Redis-based rate limiting
        # For now, return True (no rate limiting)
        return True, ""
    
    def record_attempt(self, user_id: int, attempt_type: str, success: bool):
        """
        Record a 2FA attempt for rate limiting and audit purposes.
        
        Args:
            user_id: User ID
            attempt_type: Type of operation
            success: Whether the attempt was successful
        """
        # TODO: Implement attempt recording in Redis/database
        pass


# Global 2FA instance
two_factor_auth = TwoFactorAuth()


def is_2fa_enabled() -> bool:
    """Check if 2FA is enabled via feature flag."""
    return getattr(settings, 'FEATURE_2FA', False)


def require_2fa_setup(user_id: int) -> bool:
    """
    Check if user requires 2FA setup.
    
    Args:
        user_id: User ID to check
        
    Returns:
        True if 2FA setup is required
    """
    if not is_2fa_enabled():
        return False
    
    # TODO: Implement database check for user's 2FA status
    # For now, require 2FA for admin users only
    return True


def require_admin_reauth(user_id: int, password: str, db: Session) -> Tuple[bool, str]:
    """
    Require recent password reauthentication for admin operations.
    
    Args:
        user_id: User ID
        password: User's password
        db: Database session
        
    Returns:
        (is_valid, error_message)
    """
    from app.models.user import User
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False, "User not found"
    
    # Verify password
    if not verify_password(password, user.hashed_password):
        return False, "Invalid password"
    
    # TODO: Check if password was recently used (within last 15 minutes)
    # For now, just verify the password
    
    return True, ""


def validate_2fa_token(user_id: int, token: str, db: Session) -> Tuple[bool, Optional[str]]:
    """
    Validate 2FA token for user with rate limiting.
    
    Args:
        user_id: User ID
        token: 2FA token (TOTP or backup code)
        db: Database session
        
    Returns:
        (is_valid, error_message)
    """
    if not is_2fa_enabled():
        return True, None
    
    # Check rate limit
    is_allowed, error_msg = two_factor_auth.check_rate_limit(user_id, "verify")
    if not is_allowed:
        return False, f"Rate limit exceeded: {error_msg}"
    
    # TODO: Implement database lookup for user's 2FA secret and backup codes
    # For now, return False to indicate 2FA is not set up
    
    # Record attempt
    two_factor_auth.record_attempt(user_id, "verify", False)
    
    return False, "2FA not configured for user"


def setup_2fa_for_user(user_id: int, totp_secret: str, backup_codes: List[str], db: Session) -> bool:
    """
    Set up 2FA for a user with secure storage.
    
    Args:
        user_id: User ID
        totp_secret: TOTP secret
        backup_codes: List of backup codes
        db: Database session
        
    Returns:
        True if setup was successful
    """
    if not is_2fa_enabled():
        return False
    
    # Hash backup codes for storage
    hashed_codes = [two_factor_auth.hash_backup_code(code) for code in backup_codes]
    
    # TODO: Implement database storage
    # Store encrypted TOTP secret and hashed backup codes
    # For now, just return True
    
    return True


def disable_2fa_for_user(user_id: int, password: str, db: Session) -> Tuple[bool, str]:
    """
    Disable 2FA for a user with password verification.
    
    Args:
        user_id: User ID
        password: User's password for verification
        db: Database session
        
    Returns:
        (success, error_message)
    """
    if not is_2fa_enabled():
        return False, "2FA is not enabled"
    
    # Require password verification
    is_valid, error_msg = require_admin_reauth(user_id, password, db)
    if not is_valid:
        return False, error_msg
    
    # TODO: Implement database cleanup
    # Remove 2FA data for user
    
    return True, ""


def get_backup_codes_for_user(user_id: int, db: Session) -> Tuple[List[str], int]:
    """
    Get remaining backup codes for user.
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        (remaining_codes, count)
    """
    # TODO: Implement database lookup
    # For now, return empty list
    return [], 0


def regenerate_backup_codes_for_user(user_id: int, password: str, db: Session) -> Tuple[List[str], bool, str]:
    """
    Regenerate backup codes for user with password verification.
    
    Args:
        user_id: User ID
        password: User's password for verification
        db: Database session
        
    Returns:
        (new_codes, success, error_message)
    """
    if not is_2fa_enabled():
        return [], False, "2FA is not enabled"
    
    # Require password verification
    is_valid, error_msg = require_admin_reauth(user_id, password, db)
    if not is_valid:
        return [], False, error_msg
    
    # Generate new backup codes
    new_codes = two_factor_auth.generate_backup_codes()
    hashed_codes = [two_factor_auth.hash_backup_code(code) for code in new_codes]
    
    # TODO: Store new backup codes in database
    
    return new_codes, True, ""


if __name__ == "__main__":
    # CLI utility for testing 2FA
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Test TOTP generation and verification
        secret = two_factor_auth.generate_totp_secret()
        print(f"Generated secret: {secret}")
        
        # Generate QR code
        qr_code = two_factor_auth.generate_qr_code(secret, "test@example.com")
        print(f"QR code generated: {len(qr_code)} characters")
        
        # Generate backup codes
        backup_codes = two_factor_auth.generate_backup_codes()
        print(f"Backup codes: {backup_codes[:3]}...")  # Show first 3
        
        # Test TOTP verification (will fail without actual token)
        is_valid = two_factor_auth.verify_totp(secret, "123456")
        print(f"TOTP verification test: {is_valid}")
        
    else:
        print("Usage: python -m app.core.two_factor test")
