"""
Two-Factor Authentication endpoints.

Provides 2FA setup, verification, and management endpoints for admin users.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_role
from app.db.base import get_db
from app.core.two_factor import (
    two_factor_auth, 
    is_2fa_enabled, 
    require_2fa_setup,
    validate_2fa_token,
    setup_2fa_for_user,
    disable_2fa_for_user,
    get_backup_codes_for_user,
    regenerate_backup_codes_for_user
)
from app.core.rbac import UserRole
from app.models.user import User

router = APIRouter()


class TwoFactorSetupRequest(BaseModel):
    """Request model for 2FA setup."""
    totp_secret: str
    verification_token: str


class TwoFactorVerificationRequest(BaseModel):
    """Request model for 2FA verification."""
    token: str


class TwoFactorDisableRequest(BaseModel):
    """Request model for 2FA disable."""
    password: str


class TwoFactorRegenerateRequest(BaseModel):
    """Request model for backup code regeneration."""
    password: str


class TwoFactorSetupResponse(BaseModel):
    """Response model for 2FA setup."""
    secret: str
    qr_code: str
    backup_codes: List[str]


class TwoFactorStatusResponse(BaseModel):
    """Response model for 2FA status."""
    enabled: bool
    requires_setup: bool
    backup_codes_remaining: int


@router.get("/status", response_model=TwoFactorStatusResponse)
async def get_2fa_status(
    current_user: User = Depends(get_current_active_user)
) -> TwoFactorStatusResponse:
    """
    Get 2FA status for current user.
    
    Returns:
        Current 2FA configuration status
    """
    if not is_2fa_enabled():
        return TwoFactorStatusResponse(
            enabled=False,
            requires_setup=False,
            backup_codes_remaining=0
        )
    
    requires_setup = require_2fa_setup(current_user.id)
    
    # TODO: Get actual backup codes count from database
    backup_codes_remaining = 0
    
    return TwoFactorStatusResponse(
        enabled=True,
        requires_setup=requires_setup,
        backup_codes_remaining=backup_codes_remaining
    )


@router.post("/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> TwoFactorSetupResponse:
    """
    Set up 2FA for admin user.
    
    Returns:
        TOTP secret, QR code, and backup codes
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Generate TOTP secret and QR code
    secret, qr_code = two_factor_auth.get_totp_secret_qr(current_user.email)
    
    # Generate backup codes
    backup_codes = two_factor_auth.generate_backup_codes()
    
    return TwoFactorSetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes
    )


@router.post("/verify-setup")
async def verify_2fa_setup(
    request: TwoFactorSetupRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Verify 2FA setup with TOTP token.
    
    Args:
        request: 2FA setup verification request
        
    Returns:
        Success confirmation
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Verify TOTP token
    is_valid = two_factor_auth.verify_totp(request.totp_secret, request.verification_token)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    # Generate backup codes
    backup_codes = two_factor_auth.generate_backup_codes()
    
    # Store 2FA configuration
    success = setup_2fa_for_user(current_user.id, request.totp_secret, backup_codes, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save 2FA configuration"
        )
    
    return JSONResponse({
        "message": "2FA setup verified successfully",
        "status": "enabled",
        "backup_codes": backup_codes
    })


@router.post("/verify")
async def verify_2fa_token(
    request: TwoFactorVerificationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Verify 2FA token for authentication.
    
    Args:
        request: 2FA verification request
        
    Returns:
        Verification result
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Validate 2FA token with rate limiting
    is_valid, error_message = validate_2fa_token(current_user.id, request.token, db)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Invalid 2FA token"
        )
    
    return JSONResponse({
        "message": "2FA verification successful",
        "verified": True
    })


@router.post("/disable")
async def disable_2fa(
    request: TwoFactorDisableRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Disable 2FA for admin user with password verification.
    
    Args:
        request: 2FA disable request with password
        
    Returns:
        Disable confirmation
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Disable 2FA with password verification
    success, error_message = disable_2fa_for_user(current_user.id, request.password, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Failed to disable 2FA"
        )
    
    return JSONResponse({
        "message": "2FA disabled successfully",
        "status": "disabled"
    })


@router.get("/backup-codes")
async def get_backup_codes(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Get remaining backup codes for admin user.
    
    Returns:
        List of remaining backup codes
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Get remaining backup codes
    remaining_codes, count = get_backup_codes_for_user(current_user.id, db)
    
    return JSONResponse({
        "backup_codes": remaining_codes,
        "remaining_count": count
    })


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    request: TwoFactorRegenerateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Regenerate backup codes for admin user with password verification.
    
    Args:
        request: Backup code regeneration request with password
        
    Returns:
        New backup codes
    """
    if not is_2fa_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA is not enabled"
        )
    
    # Regenerate backup codes with password verification
    new_codes, success, error_message = regenerate_backup_codes_for_user(
        current_user.id, request.password, db
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Failed to regenerate backup codes"
        )
    
    return JSONResponse({
        "backup_codes": new_codes,
        "message": "Backup codes regenerated successfully"
    })
