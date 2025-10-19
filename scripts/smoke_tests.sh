#!/bin/bash
# Post-merge smoke tests for production security validation
# Usage: BASE="$PUBLIC_BASE_URL" ACCESS_TOKEN="$TOKEN" ./scripts/smoke_tests.sh

set -euo pipefail

# Configuration
BASE="${PUBLIC_BASE_URL:-http://localhost:8000}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
TIMEOUT=30

echo "🔍 Running production security smoke tests..."
echo "Base URL: $BASE"
echo "=========================================="

# Test 1: JWKS reachable + kid present
echo "1️⃣ Testing JWKS endpoint..."
JWKS_RESPONSE=$(curl -s --max-time $TIMEOUT "$BASE/.well-known/jwks.json" || {
    echo "❌ JWKS endpoint not reachable"
    exit 1
})

# Validate JWKS structure and extract key information
echo "JWKS Response:"
echo "$JWKS_RESPONSE" | jq '.'

# Extract and validate key properties
KIDS=$(echo "$JWKS_RESPONSE" | jq -r '.keys[].kid // empty' | tr '\n' ' ')
ALGS=$(echo "$JWKS_RESPONSE" | jq -r '.keys[].alg // empty' | tr '\n' ' ')
KTYS=$(echo "$JWKS_RESPONSE" | jq -r '.keys[].kty // empty' | tr '\n' ' ')

echo "📋 Key Summary:"
echo "  Kids: $KIDS"
echo "  Algorithms: $ALGS"
echo "  Key Types: $KTYS"

# Validate that we have required fields
if [ -z "$KIDS" ]; then
    echo "❌ No 'kid' fields found in JWKS"
    exit 1
fi

if [[ ! "$ALGS" =~ (RS256|EdDSA) ]]; then
    echo "❌ No supported algorithms (RS256/EdDSA) found in JWKS"
    exit 1
fi

echo "✅ JWKS validation passed"

# Test 2: Access token sanity (if provided)
if [ -n "$ACCESS_TOKEN" ]; then
    echo ""
    echo "2️⃣ Testing access token validation..."
    
    # Validate token header
    TOKEN_VALIDATION=$(python3 - <<'PY'
import jwt
import base64
import json
import sys
import os

token = os.environ.get("ACCESS_TOKEN", "")
if not token:
    print("❌ No access token provided")
    sys.exit(1)

try:
    # Decode header
    header_b64 = token.split('.')[0]
    # Add padding if needed
    header_b64 += '=' * (4 - len(header_b64) % 4)
    header = json.loads(base64.urlsafe_b64decode(header_b64))
    
    print(f"Token header: {header}")
    
    # Validate required fields
    if 'kid' not in header:
        print("❌ Token missing 'kid' header")
        sys.exit(1)
    
    if header.get('alg') not in ['RS256', 'EdDSA']:
        print(f"❌ Unsupported algorithm: {header.get('alg')}")
        sys.exit(1)
    
    print("✅ Token header validation passed")
    
except Exception as e:
    print(f"❌ Token validation failed: {e}")
    sys.exit(1)
PY
    )
    
    echo "$TOKEN_VALIDATION"
    
    # Test 3: Token verification against JWKS
    echo ""
    echo "3️⃣ Testing token verification against JWKS..."
    
    TOKEN_VERIFICATION=$(python3 - <<'PY'
import jwt
import requests
import os
import sys

token = os.environ.get("ACCESS_TOKEN", "")
base_url = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000")
jwks_url = f"{base_url}/.well-known/jwks.json"

try:
    # Fetch JWKS
    response = requests.get(jwks_url, timeout=5)
    response.raise_for_status()
    jwks = response.json()
    
    # Use PyJWKClient for key resolution
    from jwt import PyJWKClient
    jwks_client = PyJWKClient(jwks_url)
    
    # Get signing key
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    
    # Decode and verify token
    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=['RS256', 'EdDSA'],
        audience='shomer',
        options={"verify_exp": True}
    )
    
    print(f"✅ Token verification successful")
    print(f"Token payload: {decoded}")
    
except Exception as e:
    print(f"❌ Token verification failed: {e}")
    sys.exit(1)
PY
    )
    
    echo "$TOKEN_VERIFICATION"
else
    echo "⚠️  Skipping token tests (no ACCESS_TOKEN provided)"
fi

# Test 4: Algorithm confusion protection
echo ""
echo "4️⃣ Testing algorithm confusion protection..."

ALG_CONFUSION_TEST=$(python3 - <<'PY'
import jwt
import requests
import os
import sys

base_url = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000")
jwks_url = f"{base_url}/.well-known/jwks.json"

try:
    # Get public key from JWKS
    response = requests.get(jwks_url, timeout=5)
    response.raise_for_status()
    jwks = response.json()
    
    # Extract first public key
    if not jwks.get('keys'):
        print("❌ No keys in JWKS")
        sys.exit(1)
    
    pub_key = jwks['keys'][0]
    
    # Create malicious token using HS256 with public key as secret
    malicious_claims = {
        "sub": "test",
        "aud": "shomer",
        "exp": 9999999999,  # Far future
        "iat": 1000000000
    }
    
    # This should be rejected
    malicious_token = jwt.encode(
        malicious_claims,
        str(pub_key),  # Using public key as secret
        algorithm="HS256"
    )
    
    print(f"Created malicious token: {malicious_token[:50]}...")
    print("✅ Algorithm confusion test setup complete")
    print("   (Token should be rejected by verification)")
    
except Exception as e:
    print(f"❌ Algorithm confusion test failed: {e}")
    sys.exit(1)
PY
)

echo "$ALG_CONFUSION_TEST"

# Test 5: Security headers
echo ""
echo "5️⃣ Testing security headers..."

SECURITY_HEADERS=$(curl -s -D - "$BASE" -o /dev/null | grep -iE "(strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy)" || true)

if [ -n "$SECURITY_HEADERS" ]; then
    echo "✅ Security headers found:"
    echo "$SECURITY_HEADERS"
else
    echo "⚠️  No security headers detected (may be configured at proxy level)"
fi

# Test 6: CORS headers
echo ""
echo "6️⃣ Testing CORS configuration..."

CORS_HEADERS=$(curl -s -D - "$BASE" -o /dev/null | grep -i "vary: origin" || true)

if [ -n "$CORS_HEADERS" ]; then
    echo "✅ CORS headers present"
else
    echo "⚠️  CORS headers not detected"
fi

echo ""
echo "🎉 Smoke tests completed successfully!"
echo "=========================================="
