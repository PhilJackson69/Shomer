"""Tips endpoints."""
import io
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_role
from app.core.media import process_tip_photo
from app.core.rbac import Permission, require_permission
from app.core.validation import sanitize_text_input, enhanced_validate_file_upload, sanitize_filename
from app.db.base import get_db
from app.middleware.audit import create_audit_log
from app.models.tip import Tip
from app.models.user import User, UserRole
from app.schemas.tip import Tip as TipSchema

router = APIRouter()

# Directory for storing uploaded images (dev environment)
UPLOAD_DIR = Path("uploads/tips")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/", response_model=TipSchema, status_code=status.HTTP_201_CREATED)
async def create_tip(
    content: str = Form(...),
    submitter_email: str | None = Form(None),
    submitter_phone: str | None = Form(None),
    location: str | None = Form(None),
    legally_required: bool = Form(False, description="Keep original for legal reasons"),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> TipSchema:
    """
    Create a new tip with optional image upload (publicly accessible).
    
    Image processing:
    - EXIF data is automatically scrubbed
    - File hash is generated for duplicate detection
    - Original can be preserved if legally_required=True
    """
    # Sanitize text inputs
    content = sanitize_text_input(content, max_length=5000)
    submitter_email = sanitize_text_input(submitter_email or "", max_length=255)
    submitter_phone = sanitize_text_input(submitter_phone or "", max_length=20)
    location = sanitize_text_input(location or "", max_length=500)
    
    # Handle image upload if provided
    image_url = None
    metadata = {}
    
    if image:
        # Read file content for enhanced validation
        file_content = await image.read()
        
        # Enhanced file validation with libmagic and security checks
        is_valid, error = enhanced_validate_file_upload(
            image.filename or "unnamed",
            image.content_type or "application/octet-stream",
            image.size or 0,
            file_content,
            allowed_categories=["image"]
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image validation failed: {error}"
            )
        
        # Sanitize filename
        sanitized_filename = sanitize_filename(image.filename or "unnamed")
        
        # Validate image type
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Only images are allowed.",
            )

        # Process image: scrub EXIF and generate hashes
        try:
            # Create file object from content
            file_obj = io.BytesIO(file_content)
            
            # Process with EXIF scrubbing
            result = process_tip_photo(
                file=file_obj,
                filename=sanitized_filename,
                legally_required=legally_required,
            )
            
            # Generate unique filename for cleaned version
            filename = f"{uuid.uuid4()}.jpg"
            file_path = UPLOAD_DIR / filename
            
            # Save cleaned image
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(result['cleaned_bytes'])
            
            # If keeping original, save separately
            if legally_required and 'original_bytes' in result:
                original_filename = f"{uuid.uuid4()}_original.jpg"
                original_path = UPLOAD_DIR / original_filename
                async with aiofiles.open(original_path, "wb") as f:
                    await f.write(result['original_bytes'])
                metadata['original_url'] = f"/uploads/tips/{original_filename}"
            
            # Store URL and metadata
            image_url = f"/uploads/tips/{filename}"
            metadata.update({
                'cleaned_hash': result['cleaned_hashes']['sha256'],
                'original_hash': result['original_hashes']['sha256'],
                'had_exif': result['exif_metadata']['had_exif'],
                'size_reduction': result['size_reduction'],
                'legally_required': legally_required,
            })
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process image: {str(e)}",
            )

    # Create tip
    tip = Tip(
        content=content,
        submitter_email=submitter_email,
        submitter_phone=submitter_phone,
        location=location,
        image_url=image_url,
        metadata=metadata if metadata else None,
    )

    db.add(tip)
    db.commit()
    db.refresh(tip)
    
    # Log tip creation
    create_audit_log(
        action='tip_created',
        user_id=None,  # Public submission
        resource_type='tip',
        resource_id=str(tip.id),
        details={
            'has_image': bool(image_url),
            'has_contact': bool(submitter_email or submitter_phone),
            'has_location': bool(location),
        },
    )

    return tip


@router.get("/{tip_id}", response_model=TipSchema)
def get_tip(
    tip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> TipSchema:
    """Get a specific tip by ID (moderator+ only)."""
    tip = db.query(Tip).filter(Tip.id == tip_id).first()
    if not tip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tip not found",
        )
    return tip


@router.get("/", response_model=list[TipSchema])
def list_tips(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> list[TipSchema]:
    """List all tips (moderator+ only)."""
    tips = db.query(Tip).order_by(Tip.created_at.desc()).offset(skip).limit(limit).all()
    return tips


@router.delete("/{tip_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission(Permission.TIP_DELETE)
async def delete_tip(
    tip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MODERATOR)),
) -> None:
    """Delete a tip (moderator+ only)."""
    tip = db.query(Tip).filter(Tip.id == tip_id).first()
    if not tip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tip not found",
        )

    # Capture before state for audit
    before = {
        'content': tip.content,
        'has_image': bool(tip.image_url),
    }

    # Delete associated image files if exist
    if tip.image_url:
        try:
            # Delete cleaned image
            image_path = Path(tip.image_url.lstrip("/"))
            if image_path.exists():
                image_path.unlink()
            
            # Delete original if exists
            if tip.metadata and 'original_url' in tip.metadata:
                original_path = Path(tip.metadata['original_url'].lstrip("/"))
                if original_path.exists():
                    original_path.unlink()
        except Exception as e:
            print(f"Failed to delete image file: {e}")

    db.delete(tip)
    db.commit()
    
    # Log deletion
    create_audit_log(
        action='tip_deleted',
        user_id=current_user.id,
        resource_type='tip',
        resource_id=str(tip_id),
        before=before,
    )

