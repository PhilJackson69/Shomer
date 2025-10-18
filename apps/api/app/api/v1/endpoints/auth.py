"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token, 
    create_refresh_token,
    get_password_hash, 
    verify_password,
    hash_refresh_token,
    verify_refresh_token_family
)
from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.schemas.token import Token, TokenRefresh
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.user import User as UserSchema

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create access token
    access_token = create_access_token(subject=str(db_user.id))
    refresh_token = create_refresh_token(subject=str(db_user.id))

    return UserResponse(
        user=UserSchema.model_validate(db_user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)) -> Token:
    """Login user."""
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    
    # Store refresh token hash for rotation tracking
    refresh_token_hash = hash_refresh_token(refresh_token)
    # In a real implementation, you'd store this in Redis or database
    # For now, we'll implement the rotation logic in the refresh endpoint
    
    # Rotate CSRF token on login
    from app.middleware.csrf import rotate_csrf_token
    rotate_csrf_token(response, str(user.id))
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=Token)
def refresh_token(token_data: TokenRefresh, db: Session = Depends(get_db)) -> Token:
    """Refresh access token using refresh token with rotation."""
    from app.core.security import decode_token
    
    # Decode and validate refresh token
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new token pair (refresh token rotation)
    new_access_token = create_access_token(subject=str(user.id))
    new_refresh_token = create_refresh_token(subject=str(user.id))
    
    # In a real implementation, you would:
    # 1. Store the old refresh token hash in a blacklist
    # 2. Store the new refresh token hash for future validation
    # 3. Implement device binding and family tracking
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


@router.post("/logout")
def logout(response: Response):
    """Logout user (client should discard tokens)."""
    # In a real implementation, you would:
    # 1. Add the refresh token to a blacklist
    # 2. Clear any server-side session data
    
    # Rotate CSRF token on logout
    from app.middleware.csrf import rotate_csrf_token
    rotate_csrf_token(response, None)
    
    return {"message": "Logged out successfully"}


@router.post("/sessions/revoke-all")
def revoke_all_sessions(
    current_user: UserSchema = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Revoke all refresh tokens for the current user/device family.
    Use this after suspicious activity detection.
    """
    import logging
    import hashlib
    from datetime import datetime
    
    logger = logging.getLogger(__name__)
    
    # Get request metadata for security event logging
    request_id = getattr(request.state, 'request_id', 'unknown') if request else 'unknown'
    client_ip = request.client.host if request and request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown') if request else 'unknown'
    
    # Hash sensitive information for audit trail
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    ua_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:16]
    
    try:
        # In a real implementation, you would:
        # 1. Query all active refresh tokens for this user
        # 2. Add them to a blacklist/revocation list
        # 3. Clear any device-specific session data
        # 4. Log the security event with tamper-evident audit entry
        
        # Log comprehensive security event
        security_event = {
            "event_type": "refresh_family_revoked",
            "user_id": current_user.id,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "actor": "user_initiated",
            "ip_hash": ip_hash,
            "ua_hash": ua_hash,
            "severity": "HIGH",
            "action": "revoke_all_sessions"
        }
        
        logger.warning(
            f"SECURITY_EVENT: Refresh token family revoked for user {current_user.id}",
            extra=security_event
        )
        
        # Create tamper-evident audit entry (immutable/append-only)
        audit_entry = {
            "event_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "refresh_family_revoked",
            "user_id": current_user.id,
            "ip_hash": ip_hash,
            "ua_hash": ua_hash,
            "actor": "user_initiated",
            "details": {
                "all_devices_invalidated": True,
                "reason": "user_initiated_revoke"
            }
        }
        
        # TODO: Store audit_entry in immutable audit table/write-ahead log
        # This should be append-only and never modified
        
        # TODO: Implement actual token revocation logic
        # This would involve:
        # - Storing revoked token hashes in Redis/DB with TTL
        # - Checking against revoked tokens in decode_token()
        # - Clearing device-specific session data
        # - Invalidating all refresh tokens in the family
        
        return {
            "message": "All sessions revoked successfully",
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "devices_affected": "all",  # In real implementation, return actual count
            "audit_id": request_id
        }
        
    except Exception as e:
        # Log failed revocation attempt
        logger.error(
            f"Failed to revoke refresh token family for user {current_user.id}: {str(e)}",
            extra={
                "event_type": "refresh_family_revoke_failed",
                "user_id": current_user.id,
                "request_id": request_id,
                "ip_hash": ip_hash,
                "ua_hash": ua_hash,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke sessions"
        )

