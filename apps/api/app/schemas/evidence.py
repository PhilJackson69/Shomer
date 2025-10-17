"""Evidence schemas for validation and serialization."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.evidence import EvidenceStatus, EvidenceType, ChainOfCustodyAction


# ============================================================================
# Evidence Schemas
# ============================================================================

class EvidenceBase(BaseModel):
    """Base evidence schema."""
    evidence_type: EvidenceType
    description: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None


class EvidenceCreate(EvidenceBase):
    """Schema for creating evidence."""
    incident_id: Optional[int] = None
    tip_id: Optional[int] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceUploadResponse(BaseModel):
    """Response after evidence upload."""
    id: int
    reference_number: str
    filename: str
    file_size: int
    sha256_hash: str
    status: EvidenceStatus
    received_at: datetime
    message: str = "Evidence uploaded successfully"
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceUpdate(BaseModel):
    """Schema for updating evidence metadata."""
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    location: Optional[str] = None
    status: Optional[EvidenceStatus] = None
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceInDB(EvidenceBase):
    """Evidence as stored in database."""
    id: int
    reference_number: str
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    sha256_hash: str
    md5_hash: Optional[str] = None
    status: EvidenceStatus
    submitted_at: datetime
    received_at: datetime
    verified_at: Optional[datetime] = None
    sealed_at: Optional[datetime] = None
    incident_id: Optional[int] = None
    tip_id: Optional[int] = None
    submitted_by_user_id: Optional[int] = None
    legal_hold: bool = False
    legal_hold_reason: Optional[str] = None
    legal_hold_until: Optional[datetime] = None
    retention_until: Optional[datetime] = None
    auto_delete: bool = True
    metadata_removed: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceResponse(EvidenceInDB):
    """Evidence response with chain-of-custody summary."""
    custody_events_count: int = 0
    access_log_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceListResponse(BaseModel):
    """Paginated evidence list response."""
    items: List[EvidenceResponse]
    total: int
    page: int
    page_size: int
    pages: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Chain of Custody Schemas
# ============================================================================

class ChainOfCustodyBase(BaseModel):
    """Base chain-of-custody schema."""
    action: ChainOfCustodyAction
    description: Optional[str] = None
    notes: Optional[str] = None


class ChainOfCustodyCreate(ChainOfCustodyBase):
    """Schema for creating chain-of-custody entry."""
    evidence_id: int
    action_by_user_id: Optional[int] = None
    action_by_name: Optional[str] = None
    hash_verified: Optional[bool] = None
    hash_match: Optional[bool] = None
    transferred_to: Optional[str] = None
    transfer_method: Optional[str] = None
    transfer_receipt: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ChainOfCustodyInDB(ChainOfCustodyBase):
    """Chain-of-custody as stored in database."""
    id: int
    evidence_id: int
    action_by_user_id: Optional[int] = None
    action_by_name: Optional[str] = None
    timestamp: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    hash_verified: Optional[bool] = None
    hash_match: Optional[bool] = None
    transferred_to: Optional[str] = None
    transfer_method: Optional[str] = None
    transfer_receipt: Optional[str] = None
    evidence_status_at_time: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ChainOfCustodyResponse(ChainOfCustodyInDB):
    """Chain-of-custody response with user details."""
    action_by_user_email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Evidence Access Log Schemas
# ============================================================================

class EvidenceAccessLogCreate(BaseModel):
    """Schema for creating access log entry."""
    evidence_id: int
    accessed_by_user_id: int
    access_type: str = Field(..., description="view, download, export, print")
    reason: Optional[str] = None
    authorized_by_user_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceAccessLogInDB(BaseModel):
    """Access log as stored in database."""
    id: int
    evidence_id: int
    accessed_by_user_id: int
    access_type: str
    accessed_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    reason: Optional[str] = None
    authorized_by_user_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceAccessLogResponse(EvidenceAccessLogInDB):
    """Access log response with user details."""
    accessed_by_user_email: Optional[str] = None
    authorized_by_user_email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Chain of Custody Export Schemas
# ============================================================================

class ChainOfCustodyExportRequest(BaseModel):
    """Request to export chain-of-custody document."""
    evidence_id: int
    include_access_log: bool = True
    include_metadata: bool = True
    requester_name: str
    requester_title: str
    purpose: str = Field(..., description="Legal proceeding, audit, investigation, etc.")
    
    model_config = ConfigDict(from_attributes=True)


class ChainOfCustodyExportResponse(BaseModel):
    """Response after generating chain-of-custody PDF."""
    evidence_id: int
    reference_number: str
    pdf_url: str
    generated_at: datetime
    generated_by_user_id: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Evidence Verification Schemas
# ============================================================================

class EvidenceVerifyRequest(BaseModel):
    """Request to verify evidence integrity."""
    evidence_id: int
    expected_hash: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceVerifyResponse(BaseModel):
    """Response after verifying evidence."""
    evidence_id: int
    reference_number: str
    hash_verified: bool
    hash_match: bool
    current_hash: str
    expected_hash: Optional[str] = None
    verified_at: datetime
    message: str
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Evidence Seal/Legal Hold Schemas
# ============================================================================

class EvidenceSealRequest(BaseModel):
    """Request to seal evidence for legal proceedings."""
    evidence_id: int
    reason: str
    case_number: Optional[str] = None
    hold_until: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class EvidenceSealResponse(BaseModel):
    """Response after sealing evidence."""
    evidence_id: int
    reference_number: str
    status: EvidenceStatus
    legal_hold: bool
    sealed_at: datetime
    message: str = "Evidence sealed successfully"
    
    model_config = ConfigDict(from_attributes=True)

