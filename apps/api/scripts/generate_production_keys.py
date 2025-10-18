#!/usr/bin/env python3
"""
Production key generation script for JWT keys and secrets.
"""

import secrets
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ed25519
from cryptography.hazmat.backends import default_backend


def generate_secure_secret(length: int = 64) -> str:
    """Generate a cryptographically secure secret."""
    return secrets.token_urlsafe(length)


def generate_rsa_keypair():
    """Generate RSA keypair for JWT signing."""
    print("Generating RSA keypair...")
    
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


def generate_ed25519_keypair():
    """Generate Ed25519 keypair for JWT signing."""
    print("Generating Ed25519 keypair...")
    
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


def main():
    """Generate production keys and secrets."""
    print("🔐 Shomer Production Key Generator")
    print("=" * 50)
    
    # Generate secrets
    print("\n📝 Generating secrets...")
    jwt_secret = generate_secure_secret(64)
    csrf_secret = generate_secure_secret(64)
    api_secret = generate_secure_secret(64)
    backup_encryption_key = generate_secure_secret(64)
    
    # Generate keypairs
    print("\n🔑 Generating JWT keypairs...")
    rsa_private, rsa_public = generate_rsa_keypair()
    ed25519_private, ed25519_public = generate_ed25519_keypair()
    
    # Output configuration
    print("\n📋 Production Configuration:")
    print("=" * 50)
    
    config = f"""
# Generated Production Security Configuration
# Generated on: {__import__('datetime').datetime.now().isoformat()}

# JWT Configuration (Choose one algorithm)
JWT_ALG=RS256
JWT_PRIVATE_KEY="{rsa_private.replace(chr(10), '\\n')}"
JWT_PUBLIC_KEY="{rsa_public.replace(chr(10), '\\n')}"

# Alternative Ed25519 configuration (uncomment to use)
# JWT_ALG=EdDSA
# JWT_PRIVATE_KEY="{ed25519_private.replace(chr(10), '\\n')}"
# JWT_PUBLIC_KEY="{ed25519_public.replace(chr(10), '\\n')}"

# Security Secrets
JWT_SECRET="{jwt_secret}"
CSRF_SECRET="{csrf_secret}"
API_SECRET_KEY="{api_secret}"
BACKUP_ENCRYPTION_KEY="{backup_encryption_key}"

# Additional Configuration
JWT_REFRESH_TTL_DAYS=30
JWT_ACCESS_TTL_MIN=15
JWT_LEEWAY_SEC=30
COOKIE_SECURE=true
COOKIE_SAMESITE=Strict
COOKIE_HTTPONLY=true
ENVIRONMENT=production
"""
    
    print(config)
    
    # Save to file
    with open("production_keys.env", "w") as f:
        f.write(config)
    
    print("\n💾 Keys saved to: production_keys.env")
    print("\n⚠️  IMPORTANT SECURITY NOTES:")
    print("1. Store these keys securely (e.g., AWS Secrets Manager, HashiCorp Vault)")
    print("2. Never commit these keys to version control")
    print("3. Rotate keys regularly (every 90 days)")
    print("4. Use different keys for different environments")
    print("5. Monitor key usage and access")
    
    print("\n🔍 Key Validation:")
    print(f"JWT Secret length: {len(jwt_secret)} characters")
    print(f"CSRF Secret length: {len(csrf_secret)} characters")
    print(f"API Secret length: {len(api_secret)} characters")
    print(f"RSA key size: 2048 bits")
    print(f"Ed25519 key size: 256 bits")


if __name__ == "__main__":
    main()
