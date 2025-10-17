"""
Evidence submission API endpoints (FEATURE-FLAGGED).

These endpoints are only available when FEATURE_EVIDENCE=true.
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.rbac import Permission, require_permission
from app.core.security import sign_path, verify_token
from app.models.user import User
from app.models.evidence import EvidenceType, EvidenceStatus, ChainOfCustodyAction
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceUploadResponse,
    EvidenceResponse,
    EvidenceListResponse,
    ChainOfCustodyResponse,
    EvidenceVerifyRequest,
    EvidenceVerifyResponse,
    EvidenceSealRequest,
    EvidenceSealResponse,
)
from app.services.evidence_service import EvidenceService
from app.services.chain_of_custody_pdf import ChainOfCustodyPDFService

router = APIRouter()


def check_feature_enabled():
    """Dependency to check if evidence feature is enabled."""
    if not settings.FEATURE_EVIDENCE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Evidence submission feature is not enabled. Set FEATURE_EVIDENCE=true to enable.",
        )


@router.post(
    "/upload",
    response_model=EvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_feature_enabled)],
)
async def upload_evidence(
    request: Request,
    file: UploadFile = File(...),
    evidence_type: str = Form(...),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
    incident_id: Optional[int] = Form(None),
    tip_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Upload evidence file with automatic hash calculation.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_SUBMIT (or anonymous for tips)
    
    **Process:**
    1. File uploaded
    2. SHA-256 and MD5 hashes calculated
    3. File saved to secure storage
    4. Chain-of-custody initialized with SUBMITTED and RECEIVED entries
    5. Reference number generated
    
    **Returns:**
    - Evidence ID and reference number
    - File hash for verification
    - Status and timestamps
    """
    # Validate evidence type
    try:
        evidence_type_enum = EvidenceType(evidence_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid evidence type: {evidence_type}",
        )

    # Parse tags
    tags_list = [tag.strip() for tag in tags.split(",")] if tags else None

    # Create evidence data
    evidence_data = EvidenceCreate(
        evidence_type=evidence_type_enum,
        description=description,
        location=location,
        tags=tags_list,
        incident_id=incident_id,
        tip_id=tip_id,
    )

    # Get client IP
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Upload evidence
    service = EvidenceService(db)
    evidence = await service.upload_evidence(
        file=file,
        evidence_data=evidence_data,
        user=current_user,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return EvidenceUploadResponse(
        id=evidence.id,
        reference_number=evidence.reference_number,
        filename=evidence.filename,
        file_size=evidence.file_size,
        sha256_hash=evidence.sha256_hash,
        status=EvidenceStatus(evidence.status),
        received_at=evidence.received_at,
    )


@router.get(
    "",
    response_model=EvidenceListResponse,
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_VIEW))],
)
def list_evidence(
    incident_id: Optional[int] = None,
    tip_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List evidence submissions with filters.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_VIEW
    
    **Filters:**
    - incident_id: Filter by incident
    - tip_id: Filter by tip
    - status: Filter by status (pending, verified, sealed, etc.)
    """
    status_enum = EvidenceStatus(status) if status else None
    
    service = EvidenceService(db)
    skip = (page - 1) * page_size
    items, total = service.list_evidence(
        incident_id=incident_id,
        tip_id=tip_id,
        status=status_enum,
        skip=skip,
        limit=page_size,
    )

    # Convert to response format
    evidence_responses = []
    for item in items:
        evidence_responses.append(
            EvidenceResponse(
                **item.__dict__,
                custody_events_count=len(item.custody_chain),
                access_log_count=db.query(EvidenceService).filter_by(evidence_id=item.id).count(),
            )
        )

    pages = (total + page_size - 1) // page_size

    return EvidenceListResponse(
        items=evidence_responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get(
    "/{evidence_id}",
    response_model=EvidenceResponse,
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_VIEW))],
)
def get_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get evidence details by ID.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_VIEW
    
    **Note:** Access is logged in chain-of-custody.
    """
    from app.models.evidence import Evidence
    
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Log access
    service = EvidenceService(db)
    service.log_access(
        evidence_id=evidence_id,
        user=current_user,
        access_type="view",
    )

    return EvidenceResponse(
        **evidence.__dict__,
        custody_events_count=len(evidence.custody_chain),
        access_log_count=0,  # Will be calculated separately if needed
    )


@router.get(
    "/{evidence_id}/chain-of-custody",
    response_model=list[ChainOfCustodyResponse],
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_VIEW))],
)
def get_chain_of_custody(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get complete chain-of-custody for evidence.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_VIEW
    
    **Returns:**
    - Complete immutable audit trail
    - All actions performed on evidence
    - User details and timestamps
    """
    service = EvidenceService(db)
    custody_chain = service.get_chain_of_custody(evidence_id)

    # Log this access
    service.log_access(
        evidence_id=evidence_id,
        user=current_user,
        access_type="view_chain_of_custody",
    )

    return [
        ChainOfCustodyResponse(
            **entry.__dict__,
            action_by_user_email=entry.action_by_user.email if entry.action_by_user else None,
        )
        for entry in custody_chain
    ]


@router.post(
    "/{evidence_id}/verify",
    response_model=EvidenceVerifyResponse,
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_VERIFY))],
)
def verify_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify evidence integrity by recalculating file hash.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_VERIFY
    
    **Process:**
    1. Read file from storage
    2. Calculate SHA-256 hash
    3. Compare with stored hash
    4. Log verification in chain-of-custody
    
    **Returns:**
    - Whether hash matches
    - Current hash vs. expected hash
    """
    from app.models.evidence import Evidence
    
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    service = EvidenceService(db)
    client_ip = request.client.host if request.client else None
    
    hash_match, current_hash, expected_hash = service.verify_evidence_integrity(
        evidence_id=evidence_id,
        user=current_user,
        ip_address=client_ip,
    )

    return EvidenceVerifyResponse(
        evidence_id=evidence.id,
        reference_number=evidence.reference_number,
        hash_verified=True,
        hash_match=hash_match,
        current_hash=current_hash,
        expected_hash=expected_hash,
        verified_at=evidence.verified_at or evidence.received_at,
        message="Hash verification passed" if hash_match else "Hash verification FAILED - file may be tampered",
    )


@router.post(
    "/{evidence_id}/seal",
    response_model=EvidenceSealResponse,
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_SEAL))],
)
def seal_evidence(
    evidence_id: int,
    seal_request: EvidenceSealRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Seal evidence for legal proceedings.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_SEAL (admin only)
    
    **Effects:**
    - Sets status to SEALED
    - Enables legal hold (prevents deletion)
    - Logs seal action in chain-of-custody
    
    **Use cases:**
    - Criminal proceedings
    - Civil litigation
    - Internal investigations
    - Regulatory compliance
    """
    service = EvidenceService(db)
    client_ip = request.client.host if request.client else None
    
    evidence = service.seal_evidence(
        evidence_id=evidence_id,
        user=current_user,
        reason=seal_request.reason,
        hold_until=seal_request.hold_until,
        ip_address=client_ip,
    )

    return EvidenceSealResponse(
        evidence_id=evidence.id,
        reference_number=evidence.reference_number,
        status=EvidenceStatus(evidence.status),
        legal_hold=evidence.legal_hold,
        sealed_at=evidence.sealed_at,
    )


@router.get(
    "/{evidence_id}/export-chain-of-custody/signed-url",
    dependencies=[Depends(check_feature_enabled), Depends(require_permission(Permission.EVIDENCE_EXPORT))],
)
def get_signed_export_url(
    evidence_id: int,
    ttl: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a signed URL for chain-of-custody export.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_EXPORT (moderator or admin)
    
    **Phase 2.5 Hardening:**
    - Signed URLs work without session/JWT
    - Time-limited (default: 10 minutes)
    - HMAC signature prevents tampering
    - Access is logged when URL is used
    
    **Query Parameters:**
    - ttl: Time-to-live in seconds (optional, default: 600)
    
    **Returns:**
    - url: The signed URL with token parameter
    - expires_in: TTL in seconds
    """
    from app.models.evidence import Evidence
    
    # Verify evidence exists
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Generate signed token
    ttl_seconds = ttl or settings.SIGNED_URL_DEFAULT_TTL_SECONDS
    path = f"/api/v1/evidence/{evidence_id}/export-chain-of-custody"
    token = sign_path(path, settings.SIGNED_URL_SECRET, ttl_seconds)
    
    # Construct full URL
    signed_url = f"{settings.PUBLIC_BASE_URL}{path}?token={token}"
    
    return {
        "url": signed_url,
        "expires_in": ttl_seconds,
        "reference_number": evidence.reference_number,
    }


@router.get(
    "/{evidence_id}/export-chain-of-custody",
    dependencies=[Depends(check_feature_enabled)],
)
def export_chain_of_custody_pdf(
    evidence_id: int,
    token: Optional[str] = None,
    include_access_log: bool = True,
    include_metadata: bool = True,
    purpose: str = "Official Documentation",
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Export chain-of-custody as PDF document.
    
    **Feature Flag:** FEATURE_EVIDENCE must be true
    
    **Permissions:** EVIDENCE_EXPORT (or valid signed token)
    
    **Phase 2.5 Hardening:**
    - Supports signed URL tokens (no JWT/session required)
    - Access logged with user_id or 'signed-url'
    
    **Generates professional PDF with:**
    - Complete evidence metadata
    - Full chain-of-custody audit trail
    - Access log (optional)
    - QR code for verification
    - Digital signature placeholder
    - Page numbering and headers/footers
    
    **Query Parameters:**
    - token: Signed URL token (optional, bypasses JWT auth if valid)
    - include_access_log: Include access log in PDF (default: true)
    - include_metadata: Include technical metadata (default: true)
    - purpose: Purpose of export (default: "Official Documentation")
    """
    from app.models.evidence import Evidence
    
    # Verify evidence exists
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Authentication: either token or JWT
    current_user = None
    auth_method = "unknown"
    
    if token:
        # Verify signed token
        path = f"/api/v1/evidence/{evidence_id}/export-chain-of-custody"
        if not verify_token(path, token, settings.SIGNED_URL_SECRET):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired token"
            )
        auth_method = "signed-url"
    else:
        # Require JWT authentication and RBAC permission
        from app.api.deps import get_current_user as _get_current_user
        from app.core.rbac import check_permission
        
        try:
            # Get current user from JWT
            from fastapi import Request as FastAPIRequest
            current_user = _get_current_user(db)
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check RBAC permission
            if not check_permission(current_user, Permission.EVIDENCE_EXPORT):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            auth_method = "jwt"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required (JWT or signed token)"
            )
    
    # Generate PDF
    pdf_service = ChainOfCustodyPDFService(db)
    pdf_bytes = pdf_service.generate_pdf(
        evidence_id=evidence_id,
        requester=current_user,
        purpose=purpose,
        include_access_log=include_access_log,
        include_metadata=include_metadata,
    )
    
    # Log export in chain-of-custody
    from app.models.evidence import ChainOfCustody
    custody_entry = ChainOfCustody(
        evidence_id=evidence_id,
        action=ChainOfCustodyAction.EXPORTED.value,
        action_by_user_id=current_user.id if current_user else None,
        timestamp=__import__('datetime').datetime.utcnow(),
        description=f"Chain-of-custody PDF exported: {purpose} (auth: {auth_method})",
        ip_address=request.client.host if request and request.client else None,
        evidence_status_at_time=evidence.status,
    )
    db.add(custody_entry)
    db.commit()
    
    # Stream PDF response
    filename = f"chain-of-custody_{evidence.reference_number}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/pdf",
        }
    )

