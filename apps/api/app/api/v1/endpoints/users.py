"""User management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_role
from app.db.base import get_db
from app.models.user import User, UserRole
from app.schemas.user import User as UserSchema

router = APIRouter()


@router.get("/me", response_model=UserSchema)
def get_current_user(current_user: User = Depends(get_current_active_user)) -> UserSchema:
    """Get current user."""
    return UserSchema.model_validate(current_user)


@router.get("/", response_model=list[UserSchema])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
    skip: int = 0,
    limit: int = 100,
) -> list[UserSchema]:
    """List all users (requires moderator role)."""
    users = db.query(User).offset(skip).limit(limit).all()
    return [UserSchema.model_validate(user) for user in users]


@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> UserSchema:
    """Get user by ID (requires moderator role)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserSchema.model_validate(user)

