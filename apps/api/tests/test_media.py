"""Tests for media processing."""

import io

import pytest
from PIL import Image

from app.core.media import MediaProcessor, process_tip_photo


class TestMediaProcessor:
    """Test media processor functionality."""

    def test_scrub_exif_basic(self):
        """Test basic EXIF removal."""
        processor = MediaProcessor()
        
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        # Scrub EXIF
        cleaned_bytes, metadata = processor.scrub_exif(img_bytes, keep_original=False)
        
        # Verify result
        assert len(cleaned_bytes) > 0
        assert metadata['original_format'] == 'JPEG'
        assert metadata['size'] == (100, 100)
        assert metadata['keep_original'] is False

    def test_hash_file(self):
        """Test file hashing."""
        processor = MediaProcessor()
        
        test_data = b"test file content"
        hashes = processor.hash_file(test_data)
        
        assert 'md5' in hashes
        assert 'sha256' in hashes
        assert hashes['size'] == len(test_data)
        
        # Verify hashes are consistent
        hashes2 = processor.hash_file(test_data)
        assert hashes['md5'] == hashes2['md5']
        assert hashes['sha256'] == hashes2['sha256']

    def test_process_upload(self):
        """Test full upload processing."""
        processor = MediaProcessor()
        
        # Create test image
        img = Image.new('RGB', (200, 200), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        # Process upload
        result = processor.process_upload(
            file=img_bytes,
            filename="test.jpg",
            keep_original=False,
        )
        
        # Verify result structure
        assert 'filename' in result
        assert 'original_size' in result
        assert 'cleaned_size' in result
        assert 'size_reduction' in result
        assert 'original_hashes' in result
        assert 'cleaned_hashes' in result
        assert 'exif_metadata' in result
        assert 'cleaned_bytes' in result
        
        # Verify original not included
        assert 'original_bytes' not in result

    def test_process_upload_keep_original(self):
        """Test upload processing with original preservation."""
        processor = MediaProcessor()
        
        # Create test image
        img = Image.new('RGB', (150, 150), color='green')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        # Process upload with keep_original=True
        result = processor.process_upload(
            file=img_bytes,
            filename="test.jpg",
            keep_original=True,
        )
        
        # Verify original is included
        assert 'original_bytes' in result
        assert result['keep_original'] is True


def test_process_tip_photo():
    """Test tip photo processing helper."""
    # Create test image
    img = Image.new('RGB', (100, 100), color='yellow')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    # Process
    result = process_tip_photo(
        file=img_bytes,
        filename="tip_photo.jpg",
        legally_required=False,
    )
    
    # Verify
    assert result['filename'] == "tip_photo.jpg"
    assert result['keep_original'] is False
    assert 'cleaned_bytes' in result

