"""MFA (Multi-Factor Authentication) endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.schemas.mfa import (
    MFASetupResponse, MFAVerifyRequest, MFAVerifyResponse,
    MFARecoveryRequest, MFARecoveryResponse, MFAStatusResponse,
    MFADisableRequest, WebAuthnRegisterRequest, WebAuthnRegisterResponse,
    WebAuthnVerifyRequest, WebAuthnVerifyResponse, WebAuthnCredentialResponse,
    MFAConfigResponse
)
from app.services.mfa_service import MFAService

router = APIRouter()


@router.get("/status", response_model=MFAStatusResponse)
def get_mfa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFAStatusResponse:
    """Get MFA status for the current user."""
    mfa_service = MFAService(db)
    return mfa_service.get_mfa_status(current_user)


@router.get("/config", response_model=MFAConfigResponse)
def get_mfa_config() -> MFAConfigResponse:
    """Get MFA configuration settings."""
    from app.core.config import settings
    
    return MFAConfigResponse(
        mfa_enforce_admins=getattr(settings, 'MFA_ENFORCE_ADMINS', True),
        totp_issuer=getattr(settings, 'TOTP_ISSUER', 'Shomer'),
        totp_window=getattr(settings, 'TOTP_WINDOW', 1),
        max_recovery_codes=10
    )


@router.post("/totp/setup", response_model=MFASetupResponse)
def setup_totp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFASetupResponse:
    """Setup TOTP for the current user."""
    mfa_service = MFAService(db)
    return mfa_service.setup_totp(current_user)


@router.post("/totp/verify", response_model=MFAVerifyResponse)
def verify_totp(
    request_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFAVerifyResponse:
    """Verify TOTP code for the current user."""
    mfa_service = MFAService(db)
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    request_id = request.headers.get("X-Request-ID")
    
    # Add request ID to response headers
    response = mfa_service.verify_totp(
        current_user, 
        request_data.code, 
        ip_address, 
        user_agent
    )
    
    # Set response headers
    response_headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    
    if request_id:
        response_headers["X-Request-ID"] = request_id
    
    # Create response with headers
    from fastapi import Response as FastAPIResponse
    return FastAPIResponse(
        content=response.dict(),
        status_code=200,
        headers=response_headers,
        media_type="application/json"
    )


@router.post("/totp/enable", response_model=MFAVerifyResponse)
def enable_totp(
    request_data: MFAVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFAVerifyResponse:
    """Enable TOTP for the current user after verification."""
    mfa_service = MFAService(db)
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    return mfa_service.enable_mfa(
        current_user, 
        request_data.code, 
        ip_address, 
        user_agent
    )


@router.post("/recovery/verify", response_model=MFARecoveryResponse)
def verify_recovery_code(
    request_data: MFARecoveryRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFARecoveryResponse:
    """Verify recovery code for the current user."""
    mfa_service = MFAService(db)
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    return mfa_service.verify_recovery_code(
        current_user, 
        request_data.recovery_code, 
        ip_address, 
        user_agent
    )


@router.post("/disable", response_model=MFAVerifyResponse)
def disable_mfa(
    request_data: MFADisableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MFAVerifyResponse:
    """Disable MFA for the current user using recovery code."""
    mfa_service = MFAService(db)
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    return mfa_service.disable_mfa(
        current_user, 
        request_data.recovery_code, 
        ip_address, 
        user_agent
    )


@router.post("/webauthn/register", response_model=WebAuthnRegisterResponse)
def register_webauthn(
    request_data: WebAuthnRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> WebAuthnRegisterResponse:
    """Start WebAuthn registration process."""
    mfa_service = MFAService(db)
    return mfa_service.setup_webauthn(current_user, request_data.credential_name)


@router.post("/webauthn/verify", response_model=WebAuthnVerifyResponse)
def verify_webauthn(
    request_data: WebAuthnVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> WebAuthnVerifyResponse:
    """Verify WebAuthn credential."""
    mfa_service = MFAService(db)
    return mfa_service.verify_webauthn(
        current_user,
        request_data.credential_id,
        request_data.client_data_json,
        request_data.authenticator_data,
        request_data.signature
    )


@router.get("/webauthn/credentials", response_model=list[WebAuthnCredentialResponse])
def get_webauthn_credentials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> list[WebAuthnCredentialResponse]:
    """Get WebAuthn credentials for the current user."""
    from app.models.mfa import UserMFA, WebAuthnCredential
    
    user_mfa = db.query(UserMFA).filter(UserMFA.user_id == current_user.id).first()
    if not user_mfa:
        return []
    
    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_mfa_id == user_mfa.id
    ).all()
    
    return [
        WebAuthnCredentialResponse(
            id=cred.id,
            name=cred.name,
            created_at=cred.created_at,
            last_used=cred.last_used
        )
        for cred in credentials
    ]
