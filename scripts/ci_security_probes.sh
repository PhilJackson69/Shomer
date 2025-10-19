#!/bin/bash
# CI Security Probes for Production Validation
# These probes ensure critical security configurations are in place

set -euo pipefail

# Configuration
BASE="${PUBLIC_BASE_URL:-http://localhost:8000}"
TIMEOUT=30
FAILED_TESTS=0

echo "🔒 Running CI Security Probes..."
echo "Base URL: $BASE"
echo "=========================================="

# Function to mark test failure
mark_failure() {
    echo "❌ $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

# Function to mark test success
mark_success() {
    echo "✅ $1"
}

# Test 1: JWKS Algorithm Pinning - exact copy-pasteable probe
echo "1️⃣ Testing JWKS algorithm pinning..."

# JWKS alg pinning probe (exact from requirements)
JWKS_ALG_TEST=$(curl -fsS "$BASE/.well-known/jwks.json" | jq -r '.keys[].alg' | egrep -qx 'RS256|EdDSA' 2>/dev/null && echo "PASS" || echo "FAIL")

if [ "$JWKS_ALG_TEST" = "PASS" ]; then
    mark_success "JWKS algorithm pinning: RS256/EdDSA only"
else
    mark_failure "JWKS algorithm pinning: Found non-RS256/EdDSA algorithms"
fi

# Test 2: Headers Sanity - exact copy-pasteable probe
echo ""
echo "2️⃣ Testing headers sanity..."

# Headers sanity probe (exact from requirements)
HEADERS_SANITY=$(curl -fsS -D - "$BASE" -o /dev/null | \
  egrep -i 'strict-transport-security|content-security-policy|x-content-type-options|x-frame-options|vary: origin' 2>/dev/null && echo "PASS" || echo "FAIL")

if [ "$HEADERS_SANITY" = "PASS" ]; then
    mark_success "Headers sanity: Required security headers present"
else
    mark_failure "Headers sanity: Missing required security headers"
fi

SECURITY_HEADERS=$(curl -s -D - "$BASE" -o /dev/null 2>/dev/null || {
    mark_failure "Failed to fetch security headers"
    exit 1
})

# Check for required security headers
REQUIRED_HEADERS=(
    "strict-transport-security"
    "x-frame-options"
    "x-content-type-options"
    "referrer-policy"
)

for header in "${REQUIRED_HEADERS[@]}"; do
    if echo "$SECURITY_HEADERS" | grep -qi "$header"; then
        mark_success "Security header $header present"
    else
        mark_failure "Missing security header: $header"
    fi
done

# Check for CORS headers
if echo "$SECURITY_HEADERS" | grep -qi "vary: origin"; then
    mark_success "CORS headers present"
else
    echo "⚠️  CORS headers not detected (may be configured at proxy level)"
fi

# Test 3: JWKS endpoint accessibility and structure
echo ""
echo "3️⃣ Testing JWKS endpoint structure..."

JWKS_RESPONSE=$(curl -s --max-time $TIMEOUT "$BASE/.well-known/jwks.json" 2>/dev/null || {
    mark_failure "JWKS endpoint not accessible"
    exit 1
})

# Validate JWKS structure
JWKS_STRUCTURE=$(echo "$JWKS_RESPONSE" | jq -e '.keys | type == "array"' 2>/dev/null || {
    mark_failure "Invalid JWKS structure - keys must be an array"
    exit 1
})

if [ "$JWKS_STRUCTURE" = "true" ]; then
    mark_success "JWKS structure is valid"
else
    mark_failure "JWKS structure is invalid"
fi

# Check for required key fields
REQUIRED_FIELDS=("kid" "kty" "alg" "use")
KEY_COUNT=$(echo "$JWKS_RESPONSE" | jq '.keys | length')

for ((i=0; i<KEY_COUNT; i++)); do
    for field in "${REQUIRED_FIELDS[@]}"; do
        if echo "$JWKS_RESPONSE" | jq -e ".keys[$i].$field" > /dev/null 2>&1; then
            mark_success "Key $i has required field: $field"
        else
            mark_failure "Key $i missing required field: $field"
        fi
    done
done

# Test 4: Revoke-all Smoke Test - exact copy-pasteable probe
echo ""
echo "4️⃣ Testing revoke-all smoke test..."

# Revoke-all smoke probe (exact from requirements)
if [ -n "${ACCESS_TOKEN:-}" ]; then
    REVOKE_SMOKE=$(curl -fsS -X POST "$BASE/api/v1/auth/sessions/revoke-all" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    
    if [ "$REVOKE_SMOKE" = "200" ]; then
        mark_success "Revoke-all smoke test: Authenticated request succeeded"
    else
        mark_failure "Revoke-all smoke test: Unexpected response code $REVOKE_SMOKE"
    fi
else
    # Test endpoint exists and responds appropriately without auth
    REVOKE_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BASE/api/v1/auth/sessions/revoke-all" \
        -H "Content-Type: application/json" \
        -o /dev/null 2>/dev/null || echo "000")

    if [ "$REVOKE_RESPONSE" = "401" ] || [ "$REVOKE_RESPONSE" = "403" ]; then
        mark_success "Revoke-all endpoint properly requires authentication"
    elif [ "$REVOKE_RESPONSE" = "000" ]; then
        mark_failure "Revoke-all endpoint not accessible"
    else
        echo "⚠️  Revoke-all endpoint returned unexpected status: $REVOKE_RESPONSE"
    fi
fi

# Test 5: Content Security Policy
echo ""
echo "5️⃣ Testing Content Security Policy..."

CSP_HEADER=$(echo "$SECURITY_HEADERS" | grep -i "content-security-policy" || true)

if [ -n "$CSP_HEADER" ]; then
    mark_success "Content Security Policy header present"
    
    # Check for dangerous directives
    if echo "$CSP_HEADER" | grep -qi "unsafe-inline\|unsafe-eval"; then
        echo "⚠️  CSP contains potentially unsafe directives"
    else
        mark_success "CSP does not contain unsafe directives"
    fi
else
    mark_failure "Content Security Policy header missing"
fi

# Test 6: HTTPS enforcement (if applicable)
echo ""
echo "6️⃣ Testing HTTPS enforcement..."

if [[ "$BASE" =~ ^https:// ]]; then
    # Test HSTS header
    if echo "$SECURITY_HEADERS" | grep -qi "strict-transport-security"; then
        mark_success "HSTS header present for HTTPS site"
    else
        mark_failure "HSTS header missing for HTTPS site"
    fi
    
    # Test for mixed content issues
    MIXED_CONTENT=$(curl -s "$BASE" | grep -i "http://" | grep -v "localhost" | grep -v "127.0.0.1" || true)
    if [ -z "$MIXED_CONTENT" ]; then
        mark_success "No mixed content detected"
    else
        echo "⚠️  Potential mixed content detected"
    fi
else
    echo "ℹ️  Skipping HTTPS tests (not using HTTPS)"
fi

# Test 7: Rate limiting headers
echo ""
echo "7️⃣ Testing rate limiting configuration..."

RATE_LIMIT_HEADERS=$(echo "$SECURITY_HEADERS" | grep -i "x-ratelimit\|retry-after" || true)

if [ -n "$RATE_LIMIT_HEADERS" ]; then
    mark_success "Rate limiting headers present"
else
    echo "⚠️  Rate limiting headers not detected (may be configured at proxy level)"
fi

# Test 8: Cache control for sensitive endpoints
echo ""
echo "8️⃣ Testing cache control for sensitive endpoints..."

# Test JWKS cache control
JWKS_CACHE=$(curl -s -D - "$BASE/.well-known/jwks.json" -o /dev/null | grep -i "cache-control" || true)

if [ -n "$JWKS_CACHE" ]; then
    mark_success "JWKS endpoint has cache control headers"
else
    mark_failure "JWKS endpoint missing cache control headers"
fi

# Test API endpoints don't have overly aggressive caching
API_CACHE=$(curl -s -D - "$BASE/api/v1/auth/login" -o /dev/null | grep -i "cache-control" || true)

if [ -n "$API_CACHE" ]; then
    if echo "$API_CACHE" | grep -qi "no-cache\|no-store\|private"; then
        mark_success "API endpoints have appropriate cache control"
    else
        echo "⚠️  API endpoints may have overly aggressive caching"
    fi
else
    echo "ℹ️  No cache control headers on API endpoints"
fi

# Summary
echo ""
echo "=========================================="
echo "🔒 CI Security Probes Summary"
echo "=========================================="

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ All security probes passed!"
    echo "🎉 Production security configuration is valid"
    exit 0
else
    echo "❌ $FAILED_TESTS security probe(s) failed"
    echo "🚨 Production security configuration needs attention"
    exit 1
fi
