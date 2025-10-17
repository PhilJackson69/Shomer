"""Audit log schemas."""
from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Audit log response schema."""

    id: int
    user_id: int | None
    action: str
    resource_type: str | None
    resource_id: str | None
    details: dict | None
    ip_address: str | None
    user_agent: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}

