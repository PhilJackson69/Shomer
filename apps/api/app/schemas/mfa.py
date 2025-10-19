"""MFA (Multi-Factor Authentication) schemas."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MFASetupResponse(BaseModel):
    """Response for MFA setup initiation."""
    secret: str = Field(..., description="TOTP secret for QR code generation")
    qr_code_url: str = Field(..., description="URL for QR code generation")
    backup_codes: List[str] = Field(..., description="Recovery codes for account recovery")


class MFAVerifyRequest(BaseModel):
    """Request to verify MFA code."""
    code: str = Field(..., min_length=6, max_length=8, description="TOTP code from authenticator app")


class MFAVerifyResponse(BaseModel):
    """Response for MFA verification."""
    success: bool = Field(..., description="Whether verification was successful")
    message: str = Field(..., description="Success or error message")


class MFARecoveryRequest(BaseModel):
    """Request to use recovery code."""
    recovery_code: str = Field(..., min_length=8, max_length=12, description="Recovery code")


class MFARecoveryResponse(BaseModel):
    """Response for recovery code usage."""
    success: bool = Field(..., description="Whether recovery was successful")
    new_backup_codes: Optional[List[str]] = Field(None, description="New backup codes if old ones were used")
    message: str = Field(..., description="Success or error message")


class MFAStatusResponse(BaseModel):
    """Response for MFA status check."""
    enabled: bool = Field(..., description="Whether MFA is enabled for the user")
    totp_enabled: bool = Field(..., description="Whether TOTP is enabled")
    webauthn_enabled: bool = Field(..., description="Whether WebAuthn is enabled")
    has_backup_codes: bool = Field(..., description="Whether user has unused backup codes")


class MFADisableRequest(BaseModel):
    """Request to disable MFA."""
    recovery_code: str = Field(..., description="Recovery code to confirm MFA disable")


class WebAuthnRegisterRequest(BaseModel):
    """Request to register WebAuthn credential."""
    credential_name: str = Field(..., min_length=1, max_length=100, description="User-friendly name for the credential")


class WebAuthnRegisterResponse(BaseModel):
    """Response for WebAuthn registration challenge."""
    challenge: str = Field(..., description="Challenge data for WebAuthn registration")
    rp_name: str = Field(..., description="Relying party name")
    user_id: str = Field(..., description="User ID for WebAuthn")
    user_name: str = Field(..., description="Username for WebAuthn")
    user_display_name: str = Field(..., description="Display name for WebAuthn")


class WebAuthnVerifyRequest(BaseModel):
    """Request to verify WebAuthn credential."""
    credential_id: str = Field(..., description="Credential ID")
    client_data_json: str = Field(..., description="Client data JSON from WebAuthn")
    authenticator_data: str = Field(..., description="Authenticator data from WebAuthn")
    signature: str = Field(..., description="Signature from WebAuthn")


class WebAuthnVerifyResponse(BaseModel):
    """Response for WebAuthn verification."""
    success: bool = Field(..., description="Whether verification was successful")
    message: str = Field(..., description="Success or error message")


class WebAuthnCredentialResponse(BaseModel):
    """Response for WebAuthn credential info."""
    id: int = Field(..., description="Credential ID")
    name: Optional[str] = Field(None, description="User-friendly name")
    created_at: datetime = Field(..., description="When credential was created")
    last_used: Optional[datetime] = Field(None, description="When credential was last used")


class MFAConfigResponse(BaseModel):
    """Response for MFA configuration."""
    mfa_enforce_admins: bool = Field(..., description="Whether MFA is enforced for admin users")
    totp_issuer: str = Field(..., description="TOTP issuer name")
    totp_window: int = Field(..., description="TOTP time window tolerance")
    max_recovery_codes: int = Field(..., description="Maximum number of recovery codes")
