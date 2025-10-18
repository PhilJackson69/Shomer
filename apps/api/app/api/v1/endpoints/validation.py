"""
File upload validation endpoint for secure file handling.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List, Optional

from app.core.validation import validate_file_upload, sanitize_filename
from app.core.monitoring import security_event

router = APIRouter()


@router.post("/validate")
async def validate_upload(
    file: UploadFile = File(...),
    allowed_categories: Optional[List[str]] = None
) -> JSONResponse:
    """
    Validate file upload for security.
    
    Args:
        file: Uploaded file
        allowed_categories: List of allowed file categories (image, document, video, audio)
        
    Returns:
        Validation result with sanitized filename
    """
    try:
        # Get file info
        filename = file.filename or "unnamed"
        content_type = file.content_type or "application/octet-stream"
        
        # Read file size (limit to first 1MB for validation)
        content = await file.read(1024 * 1024)
        file_size = len(content)
        
        # Validate file
        is_valid, error_message = validate_file_upload(
            filename, content_type, file_size, allowed_categories
        )
        
        if not is_valid:
            # Log security event
            try:
                security_event("file_upload_rejected", {
                    "filename": filename,
                    "content_type": content_type,
                    "file_size": file_size,
                    "reason": error_message
                })
            except Exception:
                pass
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File validation failed: {error_message}"
            )
        
        # Sanitize filename
        sanitized_filename = sanitize_filename(filename)
        
        return JSONResponse({
            "valid": True,
            "original_filename": filename,
            "sanitized_filename": sanitized_filename,
            "content_type": content_type,
            "file_size": file_size,
            "message": "File validation successful"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected errors
        try:
            security_event("file_validation_error", {
                "filename": filename,
                "error": str(e)
            })
        except Exception:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File validation failed due to server error"
        )


@router.get("/allowed-types")
async def get_allowed_file_types() -> JSONResponse:
    """
    Get list of allowed file types and their configurations.
    
    Returns:
        Allowed file types with extensions, MIME types, and size limits
    """
    from app.core.validation import (
        ALLOWED_FILE_EXTENSIONS, 
        ALLOWED_MIME_TYPES, 
        MAX_FILE_SIZES
    )
    
    return JSONResponse({
        "allowed_types": {
            category: {
                "extensions": extensions,
                "mime_types": ALLOWED_MIME_TYPES.get(category, []),
                "max_size_bytes": MAX_FILE_SIZES.get(category, 0),
                "max_size_mb": MAX_FILE_SIZES.get(category, 0) // (1024 * 1024)
            }
            for category, extensions in ALLOWED_FILE_EXTENSIONS.items()
        }
    })


@router.post("/sanitize-filename")
async def sanitize_file_name(filename: str) -> JSONResponse:
    """
    Sanitize filename to prevent path traversal and other security issues.
    
    Args:
        filename: Original filename to sanitize
        
    Returns:
        Sanitized filename
    """
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    sanitized = sanitize_filename(filename)
    
    return JSONResponse({
        "original_filename": filename,
        "sanitized_filename": sanitized
    })
