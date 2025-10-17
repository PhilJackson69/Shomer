"""API v1 router."""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    alerts,
    audit,
    auth,
    csrf,
    events,
    evidence,
    incidents,
    ingestion,
    nlp,
    tips,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(csrf.router, prefix="/csrf", tags=["csrf"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
api_router.include_router(tips.router, prefix="/tips", tags=["tips"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(nlp.router, prefix="/nlp", tags=["nlp"])
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])

