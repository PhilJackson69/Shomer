"""
Evidence submission service with chain-of-custody tracking.

This service handles:
- Secure evidence upload with cryptographic hashing
- Chain-of-custody log creation and management
- Evidence verification and integrity checking
- PDF export for chain-of-custody documentation
"""

import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, BinaryIO
from io import BytesIO
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

from app.models.evidence import (
    Evidence,
    ChainOfCustody,
    EvidenceAccessLog,
    EvidenceStatus,
    EvidenceType,
    ChainOfCustodyAction,
)
from app.models.user import User
from app.schemas.evidence import (
    EvidenceCreate,
    ChainOfCustodyCreate,
    EvidenceAccessLogCreate,
)
from app.core.config import settings
from app.services.mime_validator import validate_mime_and_extension


class EvidenceService:
    """Service for evidence management and chain-of-custody."""

    def __init__(self, db: Session):
        self.db = db

    def generate_reference_number(self) -> str:
        """Generate unique evidence reference number."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        # Count existing evidence today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        count = self.db.query(Evidence).filter(Evidence.received_at >= today_start).count()
        return f"EV-{timestamp}-{count + 1:04d}"

    def calculate_file_hash(self, file_content: bytes) -> tuple[str, str]:
        """Calculate SHA-256 and MD5 hashes of file."""
        sha256_hash = hashlib.sha256(file_content).hexdigest()
        md5_hash = hashlib.md5(file_content).hexdigest()
        return sha256_hash, md5_hash

    async def upload_evidence(
        self,
        file: UploadFile,
        evidence_data: EvidenceCreate,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Evidence:
        """
        Upload evidence file with hash calculation and chain-of-custody initialization.
        
        Args:
            file: Uploaded file
            evidence_data: Evidence metadata
            user: User submitting evidence (optional for anonymous submission)
            ip_address: Submitter IP address
            user_agent: Submitter user agent
            
        Returns:
            Created Evidence object
        """
        # Read file content
        file_content = await file.read()
        
        # Strip EXIF metadata from images (privacy & safety)
        original_metadata = {}
        metadata_removed = False
        
        if self._is_image_file(file.content_type):
            file_content, original_metadata, metadata_removed = self._strip_exif_metadata(file_content)
        
        file_size = len(file_content)

        # Calculate hashes
        sha256_hash, md5_hash = self.calculate_file_hash(file_content)

        # Check for duplicate hash (possible duplicate submission)
        existing = self.db.query(Evidence).filter(Evidence.sha256_hash == sha256_hash).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Evidence with same hash already exists: {existing.reference_number}",
            )

        # Generate reference number
        reference_number = self.generate_reference_number()

        # Determine storage path
        storage_dir = Path(settings.STORAGE_LOCAL_PATH) / "evidence" / datetime.utcnow().strftime("%Y/%m/%d")
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Sanitize filename
        safe_filename = self._sanitize_filename(file.filename or "evidence")
        file_path = storage_dir / f"{reference_number}_{safe_filename}"

        # Save file to temporary location
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Phase 2.5 Hardening: Validate MIME type matches extension
        is_valid, reason_or_mime = validate_mime_and_extension(file_path, file.filename or "evidence")
        if not is_valid:
            # Delete the temp file
            try:
                file_path.unlink()
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {reason_or_mime}"
            )

        # Create evidence record
        evidence = Evidence(
            reference_number=reference_number,
            evidence_type=evidence_data.evidence_type.value,
            status=EvidenceStatus.PENDING.value,
            filename=file.filename or "unknown",
            file_path=str(file_path),
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            sha256_hash=sha256_hash,
            md5_hash=md5_hash,
            description=evidence_data.description,
            tags=evidence_data.tags,
            location=evidence_data.location,
            submitted_at=evidence_data.submitted_at,
            received_at=datetime.utcnow(),
            incident_id=evidence_data.incident_id,
            tip_id=evidence_data.tip_id,
            submitted_by_user_id=user.id if user else None,
            original_metadata=original_metadata if original_metadata else None,
            metadata_removed=metadata_removed,
        )

        self.db.add(evidence)
        self.db.flush()

        # Create initial chain-of-custody entry (SUBMITTED)
        custody_entry = ChainOfCustody(
            evidence_id=evidence.id,
            action=ChainOfCustodyAction.SUBMITTED.value,
            action_by_user_id=user.id if user else None,
            action_by_name=user.email if user else "Anonymous",
            timestamp=evidence.submitted_at,
            description=f"Evidence submitted: {file.filename}",
            ip_address=ip_address,
            user_agent=user_agent,
            evidence_status_at_time=evidence.status,
        )
        self.db.add(custody_entry)

        # Create RECEIVED entry
        received_entry = ChainOfCustody(
            evidence_id=evidence.id,
            action=ChainOfCustodyAction.RECEIVED.value,
            action_by_name="System",
            timestamp=evidence.received_at,
            description="Evidence received by system",
            hash_verified=True,
            hash_match=True,
            evidence_status_at_time=evidence.status,
        )
        self.db.add(received_entry)

        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def verify_evidence_integrity(
        self,
        evidence_id: int,
        user: User,
        ip_address: Optional[str] = None,
    ) -> tuple[bool, str, str]:
        """
        Verify evidence file integrity by recalculating hash.
        
        Returns:
            (hash_match, current_hash, expected_hash)
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence not found")

        # Read file and calculate hash
        try:
            with open(evidence.file_path, "rb") as f:
                file_content = f.read()
            current_hash, _ = self.calculate_file_hash(file_content)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Evidence file not found on disk")

        hash_match = current_hash == evidence.sha256_hash

        # Log verification in chain-of-custody
        custody_entry = ChainOfCustody(
            evidence_id=evidence.id,
            action=ChainOfCustodyAction.VERIFIED.value,
            action_by_user_id=user.id,
            timestamp=datetime.utcnow(),
            description=f"Integrity verification {'passed' if hash_match else 'FAILED'}",
            ip_address=ip_address,
            hash_verified=True,
            hash_match=hash_match,
            evidence_status_at_time=evidence.status,
        )
        self.db.add(custody_entry)

        if hash_match:
            evidence.verified_at = datetime.utcnow()
            evidence.status = EvidenceStatus.VERIFIED.value

        self.db.commit()

        return hash_match, current_hash, evidence.sha256_hash

    def log_access(
        self,
        evidence_id: int,
        user: User,
        access_type: str,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log evidence access for audit trail."""
        access_log = EvidenceAccessLog(
            evidence_id=evidence_id,
            accessed_by_user_id=user.id,
            access_type=access_type,
            accessed_at=datetime.utcnow(),
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(access_log)

        # Also add to chain-of-custody
        custody_entry = ChainOfCustody(
            evidence_id=evidence_id,
            action=ChainOfCustodyAction.ACCESSED.value,
            action_by_user_id=user.id,
            timestamp=datetime.utcnow(),
            description=f"Evidence {access_type}",
            notes=reason,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(custody_entry)
        self.db.commit()

    def seal_evidence(
        self,
        evidence_id: int,
        user: User,
        reason: str,
        hold_until: Optional[datetime] = None,
        ip_address: Optional[str] = None,
    ) -> Evidence:
        """Seal evidence for legal proceedings."""
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence not found")

        if evidence.status == EvidenceStatus.SEALED.value:
            raise HTTPException(status_code=400, detail="Evidence is already sealed")

        # Update evidence
        evidence.status = EvidenceStatus.SEALED.value
        evidence.sealed_at = datetime.utcnow()
        evidence.legal_hold = True
        evidence.legal_hold_reason = reason
        evidence.legal_hold_until = hold_until
        evidence.auto_delete = False  # Disable auto-deletion

        # Log in chain-of-custody
        custody_entry = ChainOfCustody(
            evidence_id=evidence.id,
            action=ChainOfCustodyAction.SEALED.value,
            action_by_user_id=user.id,
            timestamp=evidence.sealed_at,
            description="Evidence sealed for legal proceedings",
            notes=reason,
            ip_address=ip_address,
            evidence_status_at_time=evidence.status,
        )
        self.db.add(custody_entry)
        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def get_chain_of_custody(self, evidence_id: int) -> List[ChainOfCustody]:
        """Get complete chain-of-custody for evidence."""
        return (
            self.db.query(ChainOfCustody)
            .filter(ChainOfCustody.evidence_id == evidence_id)
            .order_by(ChainOfCustody.timestamp.asc())
            .all()
        )

    def get_access_log(self, evidence_id: int) -> List[EvidenceAccessLog]:
        """Get access log for evidence."""
        return (
            self.db.query(EvidenceAccessLog)
            .filter(EvidenceAccessLog.evidence_id == evidence_id)
            .order_by(EvidenceAccessLog.accessed_at.desc())
            .all()
        )

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage."""
        # Remove path components
        filename = os.path.basename(filename)
        # Replace unsafe characters
        unsafe_chars = '<>:"/\\|?*'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')
        return filename

    def list_evidence(
        self,
        incident_id: Optional[int] = None,
        tip_id: Optional[int] = None,
        status: Optional[EvidenceStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[Evidence], int]:
        """List evidence with filters and pagination."""
        query = self.db.query(Evidence)

        if incident_id:
            query = query.filter(Evidence.incident_id == incident_id)
        if tip_id:
            query = query.filter(Evidence.tip_id == tip_id)
        if status:
            query = query.filter(Evidence.status == status.value)

        total = query.count()
        items = query.order_by(Evidence.received_at.desc()).offset(skip).limit(limit).all()

        return items, total

    def _is_image_file(self, mime_type: Optional[str]) -> bool:
        """Check if file is an image based on MIME type."""
        if not mime_type:
            return False
        return mime_type.startswith('image/')

    def _strip_exif_metadata(self, file_content: bytes) -> tuple[bytes, dict, bool]:
        """
        Strip EXIF metadata from images for privacy protection.
        
        Returns:
            (processed_content, original_metadata, metadata_removed)
        """
        if not PILLOW_AVAILABLE:
            return file_content, {}, False
        
        try:
            # Open image from bytes
            with Image.open(BytesIO(file_content)) as img:
                # Extract original EXIF data for audit purposes
                original_metadata = {}
                if hasattr(img, '_getexif') and img._getexif():
                    exif_data = img._getexif()
                    # Store limited metadata for audit (not GPS or sensitive data)
                    original_metadata = {
                        'format': img.format,
                        'size': img.size,
                        'mode': img.mode,
                        'exif_tags_count': len(exif_data) if exif_data else 0,
                    }
                
                # Create new image without EXIF
                data = list(img.getdata())
                img_no_exif = Image.new(img.mode, img.size)
                img_no_exif.putdata(data)
                
                # Save to bytes
                output = BytesIO()
                img_no_exif.save(output, format=img.format or 'PNG')
                output.seek(0)
                
                return output.read(), original_metadata, True
                
        except Exception as e:
            # If stripping fails, return original (better to have evidence than reject)
            print(f"EXIF stripping failed: {e}")
            return file_content, {}, False

