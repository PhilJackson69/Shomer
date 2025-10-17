"""Media handling with EXIF scrubbing and hashing."""

import hashlib
import io
from pathlib import Path
from typing import BinaryIO

from PIL import Image
from PIL.ExifTags import TAGS


class MediaProcessor:
    """Process uploaded media files."""

    def __init__(self):
        """Initialize media processor."""
        self.allowed_formats = {'JPEG', 'PNG', 'WEBP'}

    def scrub_exif(
        self, 
        file: BinaryIO, 
        keep_original: bool = False
    ) -> tuple[bytes, dict]:
        """
        Remove EXIF data from image and return cleaned version.
        
        Args:
            file: Input file object
            keep_original: Whether to preserve original (for legal reasons)
            
        Returns:
            Tuple of (cleaned_image_bytes, metadata)
        """
        # Open image
        image = Image.open(file)
        
        # Extract EXIF data before removal
        exif_data = self._extract_exif(image)
        
        # Create metadata
        metadata = {
            'original_format': image.format,
            'size': image.size,
            'mode': image.mode,
            'had_exif': bool(exif_data),
            'exif_tags_count': len(exif_data),
            'keep_original': keep_original,
        }
        
        # If keeping original, add sanitized EXIF summary
        if exif_data:
            metadata['exif_summary'] = {
                'make': exif_data.get('Make'),
                'model': exif_data.get('Model'),
                'datetime': exif_data.get('DateTime'),
                'gps': 'present' if any(
                    k.startswith('GPS') for k in exif_data.keys()
                ) else 'not_present',
            }
        
        # Create new image without EXIF
        # Convert to RGB if necessary (PNG with alpha, etc.)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Save without EXIF
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)
        
        cleaned_bytes = output.getvalue()
        
        return cleaned_bytes, metadata

    def _extract_exif(self, image: Image.Image) -> dict:
        """Extract EXIF data from image."""
        exif_data = {}
        
        try:
            exif = image._getexif()
            if exif:
                for tag_id, value in exif.items():
                    tag = TAGS.get(tag_id, tag_id)
                    exif_data[tag] = value
        except (AttributeError, KeyError):
            pass
        
        return exif_data

    def hash_file(self, file_bytes: bytes) -> dict:
        """
        Generate hashes of file content.
        
        Args:
            file_bytes: File content as bytes
            
        Returns:
            Dict with hash algorithms and values
        """
        hashes = {
            'md5': hashlib.md5(file_bytes).hexdigest(),
            'sha256': hashlib.sha256(file_bytes).hexdigest(),
            'size': len(file_bytes),
        }
        
        return hashes

    def process_upload(
        self,
        file: BinaryIO,
        filename: str,
        keep_original: bool = False,
    ) -> dict:
        """
        Process uploaded file: scrub EXIF and generate hashes.
        
        Args:
            file: Input file object
            filename: Original filename
            keep_original: Whether to preserve original (for legal reasons)
            
        Returns:
            Dict with processed file info and metadata
        """
        # Read original file
        file.seek(0)
        original_bytes = file.read()
        
        # Hash original file
        original_hashes = self.hash_file(original_bytes)
        
        # Scrub EXIF
        file.seek(0)
        cleaned_bytes, exif_metadata = self.scrub_exif(file, keep_original)
        
        # Hash cleaned file
        cleaned_hashes = self.hash_file(cleaned_bytes)
        
        # Prepare result
        result = {
            'filename': filename,
            'original_size': len(original_bytes),
            'cleaned_size': len(cleaned_bytes),
            'size_reduction': len(original_bytes) - len(cleaned_bytes),
            'original_hashes': original_hashes,
            'cleaned_hashes': cleaned_hashes,
            'exif_metadata': exif_metadata,
            'keep_original': keep_original,
            'cleaned_bytes': cleaned_bytes,
        }
        
        # If keeping original, include it
        if keep_original:
            result['original_bytes'] = original_bytes
        
        return result

    def check_duplicate(self, file_hash: str, db_session) -> bool:
        """
        Check if file with this hash already exists.
        
        Args:
            file_hash: SHA256 hash of file
            db_session: Database session
            
        Returns:
            True if duplicate found
        """
        # This would query your database for existing hashes
        # Implementation depends on your schema
        # For now, return False
        return False


def process_tip_photo(
    file: BinaryIO,
    filename: str,
    legally_required: bool = False,
) -> dict:
    """
    Process photo uploaded with tip.
    
    Args:
        file: File object
        filename: Original filename
        legally_required: Whether to keep original for legal reasons
        
    Returns:
        Processing result with file data and metadata
    """
    processor = MediaProcessor()
    return processor.process_upload(file, filename, keep_original=legally_required)

