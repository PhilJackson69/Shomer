#!/usr/bin/env python3
"""
Secrets validation script for production readiness.
"""

import os
import sys
import re
from typing import List, Tuple


def validate_secret_strength(secret: str, name: str) -> Tuple[bool, str]:
    """Validate secret strength."""
    if not secret:
        return False, f"{name} is empty"
    
    if len(secret) < 32:
        return False, f"{name} is too short (minimum 32 characters)"
    
    # Check for common weak patterns
    weak_patterns = [
        r'^password$',
        r'^123456',
        r'^admin',
        r'^test',
        r'^secret$',
        r'^changeme',
        r'^default',
    ]
    
    for pattern in weak_patterns:
        if re.match(pattern, secret, re.IGNORECASE):
            return False, f"{name} matches weak pattern: {pattern}"
    
    return True, f"{name} is strong enough"


def validate_environment_variables() -> List[str]:
    """Validate required environment variables."""
    errors = []
    
    required_vars = {
        "JWT_SECRET": "JWT signing secret",
        "CSRF_SECRET": "CSRF protection secret", 
        "RATE_LIMIT_REDIS_URL": "Redis URL for rate limiting",
        "PUBLIC_BASE_URL": "Public base URL",
    }
    
    for var, description in required_vars.items():
        value = os.getenv(var)
        if not value:
            errors.append(f"Missing {var}: {description}")
        else:
            if var in ["JWT_SECRET", "CSRF_SECRET"]:
                is_valid, message = validate_secret_strength(value, var)
                if not is_valid:
                    errors.append(message)
    
    return errors


def validate_production_config() -> List[str]:
    """Validate production-specific configuration."""
    errors = []
    
    if os.getenv("ENVIRONMENT") == "production":
        public_url = os.getenv("PUBLIC_BASE_URL", "")
        if not public_url.startswith("https://"):
            errors.append("PUBLIC_BASE_URL must be HTTPS in production")
        
        jwt_alg = os.getenv("JWT_ALG", "HS256")
        if jwt_alg == "HS256":
            errors.append("Consider using RS256/EdDSA in production for better key management")
    
    return errors


def main():
    """Main validation function."""
    print("🔐 Validating secrets and configuration...")
    
    all_errors = []
    all_errors.extend(validate_environment_variables())
    all_errors.extend(validate_production_config())
    
    if all_errors:
        print("❌ Validation failed:")
        for error in all_errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print("✅ All secrets and configuration validated successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
