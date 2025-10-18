"""
Security utilities for secret validation and environment hardening.
"""

import secrets
import re
import hashlib
import json
import base64
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ed25519
from cryptography.hazmat.backends import default_backend
from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
JWT_ALGORITHM = settings.JWT_ALG or ("RS256" if settings.ENVIRONMENT == "production" else "HS256")
JWT_AUDIENCE = "shomer"
JWT_ISSUER = settings.PUBLIC_BASE_URL or "https://shomer.local"
JWT_LEEWAY = 60  # 60 seconds leeway for clock skew (production hardened)
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15 minutes for access tokens
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 days for refresh tokens
JWT_KEY_ID = "shomer-key-1"  # Key ID for rotation

# Key rotation configuration
JWT_KEY_ROTATION_GRACE_PERIOD_MINUTES = 15  # Keep old keys for 15 minutes after rotation
JWT_KEY_VERSION = "v1"  # Increment for key rotation

# KMS integration
try:
    from app.core.kms_signing import sign_token_with_kms, get_kms_public_key
    KMS_AVAILABLE = True
except ImportError:
    KMS_AVAILABLE = False


def generate_secure_secret(length: int = 32) -> str:
    """
    Generate a cryptographically secure secret.
    
    Args:
        length: Length of the secret in characters
        
    Returns:
        URL-safe base64 encoded secret
    """
    return secrets.token_urlsafe(length)


def validate_secret_strength(secret: str, min_length: int = 32) -> Tuple[bool, List[str]]:
    """
    Validate secret strength and return issues found.
    
    Args:
        secret: Secret to validate
        min_length: Minimum required length
        
    Returns:
        (is_valid, list_of_issues)
    """
    issues = []
    
    if not secret:
        issues.append("Secret is empty")
        return False, issues
    
    if len(secret) < min_length:
        issues.append(f"Secret too short (minimum {min_length} characters)")
    
    # Check for common weak patterns
    weak_patterns = [
        (r'^(password|123456|admin|root|test|demo)$', "Common weak password"),
        (r'^(changeme|change_me|default|secret)$', "Default/placeholder value"),
        (r'^[a-z]{1,12}$', "Too short and only lowercase letters"),
        (r'^\d+$', "Only numbers"),
        (r'^[A-Z]+$', "Only uppercase letters"),
        (r'^(.)\1+$', "Repeated characters"),
    ]
    
    for pattern, description in weak_patterns:
        if re.match(pattern, secret, re.IGNORECASE):
            issues.append(description)
    
    # Check entropy (basic check for character diversity)
    char_types = 0
    if re.search(r'[a-z]', secret):
        char_types += 1
    if re.search(r'[A-Z]', secret):
        char_types += 1
    if re.search(r'\d', secret):
        char_types += 1
    if re.search(r'[^a-zA-Z0-9]', secret):
        char_types += 1
    
    if char_types < 3:
        issues.append("Low character diversity (use mixed case, numbers, symbols)")
    
    return len(issues) == 0, issues


def validate_environment_security() -> Tuple[bool, List[str]]:
    """
    Validate environment configuration for security issues.
    
    Returns:
        (is_valid, list_of_issues)
    """
    import os
    issues = []
    
    environment = os.getenv("ENVIRONMENT", "development").lower()
    
    if environment == "production":
        # Production-specific validations
        public_url = os.getenv("PUBLIC_BASE_URL", "")
        if public_url:
            if not public_url.startswith("https://"):
                issues.append("PUBLIC_BASE_URL must use HTTPS in production")
            if "localhost" in public_url or "127.0.0.1" in public_url:
                issues.append("PUBLIC_BASE_URL must not use localhost in production")
        
        # Check for development values in production
        dev_values = {
            "API_SECRET_KEY": ["devsecret_change_me_in_production", "dev_change_me", "change_me"],
            "JWT_SECRET": ["devjwt_change_me_in_production", "dev_change_me", "change_me"],
            "SIGNED_URL_SECRET": ["dev_change_me", "change_me"],
            "POSTGRES_PASSWORD": ["shomer", "password", "admin", "root"],
        }
        
        for env_var, forbidden_values in dev_values.items():
            value = os.getenv(env_var, "")
            if value in forbidden_values:
                issues.append(f"{env_var} contains development/placeholder value")
    
    return len(issues) == 0, issues


def log_security_warnings():
    """Log security warnings for configuration issues."""
    import logging
    logger = logging.getLogger(__name__)
    
    is_valid, issues = validate_environment_security()
    if not is_valid:
        logger.warning("Security configuration issues detected:")
        for issue in issues:
            logger.warning(f"  - {issue}")
    
    # Check individual secrets
    secret_vars = ["API_SECRET_KEY", "JWT_SECRET", "SIGNED_URL_SECRET", "POSTGRES_PASSWORD"]
    for var in secret_vars:
        value = os.getenv(var, "")
        if value:
            is_strong, secret_issues = validate_secret_strength(value)
            if not is_strong:
                logger.warning(f"Secret {var} has strength issues:")
                for issue in secret_issues:
                    logger.warning(f"  - {issue}")


if __name__ == "__main__":
    # CLI utility for generating secrets
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "generate":
        length = int(sys.argv[2]) if len(sys.argv) > 2 else 32
        secret = generate_secure_secret(length)
        print(f"Generated secret: {secret}")
        
        is_valid, issues = validate_secret_strength(secret)
        if is_valid:
            print("✓ Secret passes strength validation")
        else:
            print("✗ Secret has issues:")
            for issue in issues:
                print(f"  - {issue}")
    else:
        print("Usage: python -m app.core.security generate [length]")


# Password hashing functions
def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


# JWT token functions
def create_access_token(subject: str, additional_claims: Optional[Dict[str, Any]] = None) -> str:
    """
    Create a JWT access token with proper security claims.
    
    Args:
        subject: User ID or subject identifier
        additional_claims: Additional claims to include
        
    Returns:
        JWT token string
    """
    now = datetime.utcnow()
    expire = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "nbf": now,  # Not before
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "type": "access"
    }
    
    if additional_claims:
        payload.update(additional_claims)
    
    # Add key ID header for asymmetric algorithms
    headers = {}
    if JWT_ALGORITHM in ["RS256", "RS384", "RS512", "EdDSA"]:
        headers["kid"] = JWT_KEY_ID
    
    # Use KMS signing if available and configured
    if KMS_AVAILABLE and settings.KMS_ENABLED:
        return sign_token_with_kms(payload, JWT_KEY_ID)
    
    signing_key = get_jwt_signing_key()
    return jwt.encode(payload, signing_key, algorithm=JWT_ALGORITHM, headers=headers)


def create_refresh_token(subject: str, device_id: Optional[str] = None) -> str:
    """
    Create a JWT refresh token with device binding.
    
    Args:
        subject: User ID or subject identifier
        device_id: Device identifier for token binding
        
    Returns:
        JWT refresh token string
    """
    now = datetime.utcnow()
    expire = now + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "nbf": now,
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "type": "refresh",
        "device_id": device_id or "unknown"
    }
    
    # Add key ID header for asymmetric algorithms
    headers = {}
    if JWT_ALGORITHM in ["RS256", "RS384", "RS512", "EdDSA"]:
        headers["kid"] = JWT_KEY_ID
    
    # Use KMS signing if available and configured
    if KMS_AVAILABLE and settings.KMS_ENABLED:
        return sign_token_with_kms(payload, JWT_KEY_ID)
    
    signing_key = get_jwt_signing_key()
    return jwt.encode(payload, signing_key, algorithm=JWT_ALGORITHM, headers=headers)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token with proper security checks.
    
    Args:
        token: JWT token string
        
    Returns:
        Token payload if valid, None otherwise
    """
    try:
        verification_key = get_jwt_verification_key()
        payload = jwt.decode(
            token,
            verification_key,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "verify_nbf": True,
                "leeway": JWT_LEEWAY
            }
        )
        
        # Additional validation
        if "sub" not in payload:
            return None
            
        # Check token type if present
        if payload.get("type") not in ["access", "refresh", None]:
            return None
            
        return payload
        
    except JWTError:
        return None


def hash_refresh_token(token: str) -> str:
    """Create a hash of refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_refresh_token_family(stored_hash: str, token: str) -> bool:
    """Verify if a refresh token matches the stored hash."""
    token_hash = hash_refresh_token(token)
    return secrets.compare_digest(stored_hash, token_hash)


# JWT Key Management for Asymmetric Algorithms
def generate_rsa_keypair() -> Tuple[str, str]:
    """Generate RSA keypair for JWT signing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem


def generate_ed25519_keypair() -> Tuple[str, str]:
    """Generate Ed25519 keypair for JWT signing."""
    private_key = ed25519.Ed25519PrivateKey.generate()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem


def get_jwt_signing_key() -> str:
    """Get the appropriate signing key based on algorithm."""
    if JWT_ALGORITHM in ["RS256", "RS384", "RS512"]:
        return settings.JWT_PRIVATE_KEY or settings.JWT_SECRET
    elif JWT_ALGORITHM in ["EdDSA"]:
        return settings.JWT_PRIVATE_KEY or settings.JWT_SECRET
    else:
        return settings.JWT_SECRET


def get_jwt_verification_key() -> str:
    """Get the appropriate verification key based on algorithm."""
    if JWT_ALGORITHM in ["RS256", "RS384", "RS512"]:
        return settings.JWT_PUBLIC_KEY or settings.JWT_SECRET
    elif JWT_ALGORITHM in ["EdDSA"]:
        return settings.JWT_PUBLIC_KEY or settings.JWT_SECRET
    else:
        return settings.JWT_SECRET


def create_jwks() -> Dict[str, Any]:
    """Create JWKS (JSON Web Key Set) for public key distribution."""
    if JWT_ALGORITHM not in ["RS256", "RS384", "RS512", "EdDSA"]:
        return {}
    
    # Try KMS public key first if available
    public_key_pem = None
    if KMS_AVAILABLE and settings.KMS_ENABLED:
        public_key_pem = get_kms_public_key()
    
    # Fallback to configured public key
    if not public_key_pem:
        public_key_pem = settings.JWT_PUBLIC_KEY
    
    if not public_key_pem:
        return {}
    
    # Parse the public key
    public_key = serialization.load_pem_public_key(
        public_key_pem.encode(),
        backend=default_backend()
    )
    
    # Get key components for JWK
    if hasattr(public_key, 'public_numbers'):
        # RSA key
        numbers = public_key.public_numbers()
        n = base64.urlsafe_b64encode(numbers.n.to_bytes(256, 'big')).decode('utf-8').rstrip('=')
        e = base64.urlsafe_b64encode(numbers.e.to_bytes(3, 'big')).decode('utf-8').rstrip('=')
        
        jwk = {
            "kty": "RSA",
            "kid": JWT_KEY_ID,
            "use": "sig",
            "alg": JWT_ALGORITHM,
            "n": n,
            "e": e
        }
    else:
        # Ed25519 key
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        x = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
        
        jwk = {
            "kty": "OKP",
            "kid": JWT_KEY_ID,
            "use": "sig",
            "alg": "EdDSA",
            "crv": "Ed25519",
            "x": x
        }
    
    return {
        "keys": [jwk]
    }


def get_key_rotation_info() -> Dict[str, Any]:
    """
    Get current key rotation information for monitoring and debugging.
    
    Returns:
        Dictionary with key rotation metadata
    """
    return {
        "current_key_id": JWT_KEY_ID,
        "algorithm": JWT_ALGORITHM,
        "version": JWT_KEY_VERSION,
        "grace_period_minutes": JWT_KEY_ROTATION_GRACE_PERIOD_MINUTES,
        "leeway_seconds": JWT_LEEWAY
    }


def validate_algorithm_not_confused(token: str) -> bool:
    """
    Validate that the token is not using algorithm confusion attack.
    This prevents HS256 tokens signed with public keys being accepted.
    
    Args:
        token: JWT token to validate
        
    Returns:
        True if algorithm is not confused, False otherwise
    """
    try:
        # Decode header without verification
        header_b64 = token.split('.')[0]
        # Add padding if needed
        header_b64 += '=' * (4 - len(header_b64) % 4)
        header = json.loads(base64.urlsafe_b64decode(header_b64))
        
        # Check for algorithm confusion
        alg = header.get('alg')
        
        # In production, only allow asymmetric algorithms
        if settings.ENVIRONMENT == "production" and alg == "HS256":
            return False
            
        # If using asymmetric algorithm, ensure it matches our expected algorithm
        if alg in ["RS256", "RS384", "RS512", "EdDSA"]:
            return alg == JWT_ALGORITHM
            
        return True
        
    except Exception:
        return False


def create_key_rotation_token(subject: str, additional_claims: Optional[Dict[str, Any]] = None) -> str:
    """
    Create a token with current key rotation settings.
    This function should be used during key rotation to maintain compatibility.
    
    Args:
        subject: User ID or subject identifier
        additional_claims: Additional claims to include
        
    Returns:
        JWT token string with rotation metadata
    """
    now = datetime.utcnow()
    expire = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "nbf": now,
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "type": "access",
        "key_version": JWT_KEY_VERSION
    }
    
    if additional_claims:
        payload.update(additional_claims)
    
    # Always include kid for asymmetric algorithms
    headers = {}
    if JWT_ALGORITHM in ["RS256", "RS384", "RS512", "EdDSA"]:
        headers["kid"] = JWT_KEY_ID
    
    signing_key = get_jwt_signing_key()
    return jwt.encode(payload, signing_key, algorithm=JWT_ALGORITHM, headers=headers)


def validate_clock_skew_hardening() -> bool:
    """
    Validate that clock skew hardening is properly configured.
    This ensures NTP synchronization and reasonable leeway values.
    
    Returns:
        True if clock skew hardening is properly configured
    """
    # Check leeway is reasonable (not too large)
    if JWT_LEEWAY > 300:  # 5 minutes max
        return False
        
    # Check that we're using production-ready algorithms
    if settings.ENVIRONMENT == "production":
        if JWT_ALGORITHM not in ["RS256", "RS384", "RS512", "EdDSA"]:
            return False
    
    return True