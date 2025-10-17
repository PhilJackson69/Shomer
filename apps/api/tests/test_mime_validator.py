"""
Tests for MIME type validation (Phase 2.5 Hardening).
"""

import pytest
from pathlib import Path
import tempfile
import os

from app.services.mime_validator import (
    validate_mime_and_extension,
    is_mime_allowed,
    get_allowed_extensions,
    ALLOWED_MIME_TYPES,
)


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def create_test_image(path: Path, format: str = "PNG"):
    """Create a test image file."""
    try:
        from PIL import Image
        img = Image.new('RGB', (100, 100), color='red')
        img.save(path, format=format)
    except ImportError:
        # Fallback: create a minimal PNG header
        if format == "PNG":
            png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
            path.write_bytes(png_header)
        elif format == "JPEG":
            jpeg_header = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C'
            path.write_bytes(jpeg_header)


def create_test_pdf(path: Path):
    """Create a minimal PDF file."""
    pdf_content = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n100\n%%EOF'
    path.write_bytes(pdf_content)


def create_test_text(path: Path):
    """Create a test text file."""
    path.write_text("This is a test text file.\nLine 2.\n")


class TestMIMEValidator:
    """Test suite for MIME type validation."""
    
    def test_valid_jpeg_file(self, temp_dir):
        """Test valid JPEG file with .jpg extension."""
        file_path = temp_dir / "test.jpg"
        create_test_image(file_path, "JPEG")
        
        is_valid, result = validate_mime_and_extension(file_path, "photo.jpg")
        
        assert is_valid is True
        assert "jpeg" in result.lower()
    
    def test_valid_png_file(self, temp_dir):
        """Test valid PNG file with .png extension."""
        file_path = temp_dir / "test.png"
        create_test_image(file_path, "PNG")
        
        is_valid, result = validate_mime_and_extension(file_path, "image.png")
        
        assert is_valid is True
        assert result == "image/png"
    
    def test_valid_pdf_file(self, temp_dir):
        """Test valid PDF file with .pdf extension."""
        file_path = temp_dir / "test.pdf"
        create_test_pdf(file_path)
        
        is_valid, result = validate_mime_and_extension(file_path, "document.pdf")
        
        assert is_valid is True
        assert result == "application/pdf"
    
    def test_valid_text_file(self, temp_dir):
        """Test valid text file with .txt extension."""
        file_path = temp_dir / "test.txt"
        create_test_text(file_path)
        
        is_valid, result = validate_mime_and_extension(file_path, "notes.txt")
        
        assert is_valid is True
        assert result == "text/plain"
    
    def test_mismatched_extension_jpg_as_pdf(self, temp_dir):
        """Test JPEG file renamed to .pdf (should fail)."""
        file_path = temp_dir / "test.jpg"
        create_test_image(file_path, "JPEG")
        
        is_valid, result = validate_mime_and_extension(file_path, "fake.pdf")
        
        assert is_valid is False
        assert "not compatible" in result.lower()
        assert "pdf" in result.lower()
    
    def test_mismatched_extension_pdf_as_jpg(self, temp_dir):
        """Test PDF file renamed to .jpg (should fail)."""
        file_path = temp_dir / "test.pdf"
        create_test_pdf(file_path)
        
        is_valid, result = validate_mime_and_extension(file_path, "fake.jpg")
        
        assert is_valid is False
        assert "not compatible" in result.lower()
    
    def test_disallowed_extension_exe(self, temp_dir):
        """Test file with disallowed .exe extension."""
        file_path = temp_dir / "test.exe"
        file_path.write_bytes(b"MZ\x90\x00")  # Minimal PE header
        
        is_valid, result = validate_mime_and_extension(file_path, "malware.exe")
        
        assert is_valid is False
        assert "not allowed" in result.lower() or "not compatible" in result.lower()
    
    def test_nonexistent_file(self, temp_dir):
        """Test validation with nonexistent file."""
        file_path = temp_dir / "nonexistent.jpg"
        
        is_valid, result = validate_mime_and_extension(file_path, "ghost.jpg")
        
        assert is_valid is False
        assert "not found" in result.lower() or "failed" in result.lower()
    
    def test_is_mime_allowed(self):
        """Test MIME type allowlist checking."""
        assert is_mime_allowed("image/jpeg") is True
        assert is_mime_allowed("image/png") is True
        assert is_mime_allowed("application/pdf") is True
        assert is_mime_allowed("text/plain") is True
        
        assert is_mime_allowed("application/x-msdownload") is False
        assert is_mime_allowed("application/x-executable") is False
        assert is_mime_allowed("text/html") is False
    
    def test_get_allowed_extensions(self):
        """Test getting list of allowed extensions."""
        extensions = get_allowed_extensions()
        
        assert ".jpg" in extensions
        assert ".jpeg" in extensions
        assert ".png" in extensions
        assert ".pdf" in extensions
        assert ".txt" in extensions
        assert ".mp4" in extensions
        
        assert ".exe" not in extensions
        assert ".bat" not in extensions
        assert ".sh" not in extensions
    
    def test_allowed_mime_types_structure(self):
        """Test that ALLOWED_MIME_TYPES is properly structured."""
        assert isinstance(ALLOWED_MIME_TYPES, dict)
        
        for mime, exts in ALLOWED_MIME_TYPES.items():
            assert isinstance(mime, str)
            assert "/" in mime  # Valid MIME format
            assert isinstance(exts, list)
            assert len(exts) > 0
            
            for ext in exts:
                assert ext.startswith(".")
                assert ext.islower()  # Extensions should be lowercase


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


