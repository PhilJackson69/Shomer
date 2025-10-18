"""
JWKS (JSON Web Key Set) endpoint for JWT public key distribution.
"""

import json
import hashlib
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from app.core.security import create_jwks, JWT_ALGORITHM

router = APIRouter()


def etag(payload: bytes) -> str:
    """Generate ETag from payload content."""
    return hashlib.sha256(payload).hexdigest()


@router.get("/.well-known/jwks.json")
async def get_jwks(request: Request, response: Response):
    """
    Serve the JSON Web Key Set (JWKS) for JWT verification.
    This endpoint provides public keys for asymmetric JWT algorithms.
    """
    if JWT_ALGORITHM not in ["RS256", "RS384", "RS512", "EdDSA"]:
        raise HTTPException(
            status_code=404, 
            detail="JWKS not available for symmetric algorithms"
        )
    
    jwks = create_jwks()
    if not jwks:
        raise HTTPException(
            status_code=500,
            detail="JWKS generation failed - check JWT_PUBLIC_KEY configuration"
        )
    
    # Generate compact JSON (no spaces) for consistent ETag
    body = json.dumps(jwks, separators=(",", ":")).encode()
    
    # Set strong caching headers
    response.headers["Cache-Control"] = "max-age=60, stale-while-revalidate=300"
    response.headers["ETag"] = etag(body)
    response.headers["Content-Type"] = "application/json"
    response.headers["Vary"] = "Origin"  # CORS support
    
    # Check if client has cached version
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match == etag(body):
        response.status_code = 304
        return Response(content=b"", media_type="application/json")
    
    return Response(content=body, media_type="application/json")
