"""
AWS KMS signing integration for JWT tokens.
This module provides secure token signing using AWS KMS without loading private keys into memory.
"""

import json
import base64
import boto3
from typing import Dict, Any, Optional
from jose.utils import base64url_encode
from app.core.config import settings


class KMSSigningError(Exception):
    """KMS signing related errors."""
    pass


class KMSSigner:
    """AWS KMS-based JWT signer."""
    
    def __init__(self, key_id: str, region: str = "us-east-1"):
        """
        Initialize KMS signer.
        
        Args:
            key_id: AWS KMS key ID for signing
            region: AWS region
        """
        self.key_id = key_id
        self.region = region
        self._kms_client = None
    
    @property
    def kms_client(self):
        """Get KMS client (lazy initialization)."""
        if self._kms_client is None:
            self._kms_client = boto3.client("kms", region_name=self.region)
        return self._kms_client
    
    def sign_rs256(self, payload: Dict[str, Any], kid: str) -> str:
        """
        Sign JWT payload using RS256 algorithm via AWS KMS.
        
        Args:
            payload: JWT payload dictionary
            kid: Key ID for the token header
            
        Returns:
            Complete JWT token string
        """
        try:
            # Create JWT header
            header = {
                "alg": "RS256",
                "typ": "JWT",
                "kid": kid
            }
            
            # Encode header and payload
            header_b64 = base64url_encode(json.dumps(header).encode()).decode()
            payload_b64 = base64url_encode(json.dumps(payload).encode()).decode()
            
            # Create message to sign (header.payload)
            message = f"{header_b64}.{payload_b64}"
            message_bytes = message.encode()
            
            # Sign with KMS
            response = self.kms_client.sign(
                KeyId=self.key_id,
                Message=message_bytes,
                SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256",
                MessageType="RAW"
            )
            
            # Get signature and encode
            signature = response["Signature"]
            signature_b64 = base64url_encode(signature).decode()
            
            # Return complete JWT
            return f"{message}.{signature_b64}"
            
        except Exception as e:
            raise KMSSigningError(f"KMS signing failed: {str(e)}")
    
    def get_public_key(self) -> str:
        """
        Get public key from KMS for JWKS.
        
        Returns:
            PEM-formatted public key
        """
        try:
            response = self.kms_client.get_public_key(KeyId=self.key_id)
            return response["PublicKey"].decode()
        except Exception as e:
            raise KMSSigningError(f"Failed to get public key from KMS: {str(e)}")


def create_kms_signer() -> Optional[KMSSigner]:
    """
    Create KMS signer if KMS is enabled and configured.
    
    Returns:
        KMSSigner instance or None if KMS is not enabled
    """
    if not settings.KMS_ENABLED or not settings.KMS_KEY_ID:
        return None
    
    return KMSSigner(
        key_id=settings.KMS_KEY_ID,
        region=settings.AWS_REGION
    )


def sign_token_with_kms(payload: Dict[str, Any], kid: str) -> str:
    """
    Sign token using KMS if available, fallback to local signing.
    
    Args:
        payload: JWT payload
        kid: Key ID
        
    Returns:
        Signed JWT token
    """
    kms_signer = create_kms_signer()
    if kms_signer:
        return kms_signer.sign_rs256(payload, kid)
    
    # Fallback to local signing (existing implementation)
    from app.core.security import create_access_token
    return create_access_token(payload.get("sub", ""), payload)


def get_kms_public_key() -> Optional[str]:
    """
    Get public key from KMS for JWKS if KMS is enabled.
    
    Returns:
        PEM-formatted public key or None
    """
    kms_signer = create_kms_signer()
    if kms_signer:
        try:
            return kms_signer.get_public_key()
        except KMSSigningError:
            return None
    return None
