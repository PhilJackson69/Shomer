"""
MIME type validation service (Phase 2.5 Hardening).

Prevents malicious file uploads by validating MIME type matches file extension.
Uses python-magic to sniff actual file content, not just extension.
"""

from pathlib import Path
from typing import Tuple

try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    # Fallback to mimetypes if python-magic is not available
    import mimetypes


# Allowed MIME types with their permitted extensions
ALLOWED_MIME_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
    "video/mp4": [".mp4"],
    "video/quicktime": [".mov"],
    "video/x-msvideo": [".avi"],
    "text/plain": [".txt"],
    "application/zip": [".zip"],
    "application/x-zip-compressed": [".zip"],
}


def sniff_mime(file_path: Path) -> str:
    """
    Detect MIME type by reading file content (not just extension).
    
    Args:
        file_path: Path to file to analyze
        
    Returns:
        MIME type string (e.g., "image/jpeg")
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    if MAGIC_AVAILABLE:
        # Use python-magic for accurate detection
        mime = magic.from_file(str(file_path), mime=True)
        return mime
    else:
        # Fallback to mimetypes (less secure, based on extension)
        mime, _ = mimetypes.guess_type(str(file_path))
        return mime or "application/octet-stream"


def validate_mime_and_extension(file_path: Path, original_name: str) -> Tuple[bool, str]:
    """
    Validate that file's MIME type matches its extension.
    
    Args:
        file_path: Path to uploaded file (temporary storage)
        original_name: Original filename from upload
        
    Returns:
        Tuple of (is_valid, message)
        - is_valid: True if MIME and extension match and are allowed
        - message: MIME type if valid, error message if invalid
        
    Example:
        >>> validate_mime_and_extension(Path("/tmp/upload.jpg"), "photo.jpg")
        (True, "image/jpeg")
        
        >>> validate_mime_and_extension(Path("/tmp/malicious.jpg"), "virus.exe")
        (False, "MIME image/jpeg not compatible with extension .exe")
    """
    # Get actual MIME type from file content
    try:
        mime = sniff_mime(file_path)
    except Exception as e:
        return False, f"Failed to detect MIME type: {str(e)}"
    
    # Get extension from original filename
    ext = Path(original_name).suffix.lower()
    
    # Check if MIME type is in allowed list
    if mime not in ALLOWED_MIME_TYPES:
        return False, f"MIME type {mime} is not allowed"
    
    # Check if extension matches MIME type
    allowed_exts = ALLOWED_MIME_TYPES[mime]
    if ext not in allowed_exts:
        return False, f"MIME {mime} not compatible with extension {ext}"
    
    return True, mime


def is_mime_allowed(mime_type: str) -> bool:
    """
    Check if a MIME type is in the allowed list.
    
    Args:
        mime_type: MIME type string (e.g., "image/jpeg")
        
    Returns:
        True if allowed, False otherwise
    """
    return mime_type in ALLOWED_MIME_TYPES


def get_allowed_extensions() -> list[str]:
    """
    Get list of all allowed file extensions.
    
    Returns:
        List of extensions (e.g., [".jpg", ".png", ...])
    """
    extensions = []
    for exts in ALLOWED_MIME_TYPES.values():
        extensions.extend(exts)
    return sorted(set(extensions))


