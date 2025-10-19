#!/bin/bash
# Shomer Production Preflight Validation Script
# 10-minute comprehensive security check before deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
JWT_ALG="${JWT_ALG:-}"
COOKIE_DOMAIN="${COOKIE_DOMAIN:-}"
CSRF_SECRET="${CSRF_SECRET:-}"
RATE_LIMIT_REDIS_URL="${RATE_LIMIT_REDIS_URL:-}"

# Export BASE for other scripts
export BASE="$BASE_URL"

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

log_check() {
    local status=$1
    local message=$2
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $message"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🛡️  Shomer Production Preflight Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 1) Config & Secrets Validation
log_info "1) Configuration & Secrets Validation"
echo "----------------------------------------"

# Check PUBLIC_BASE_URL is HTTPS
if [ -n "$BASE_URL" ]; then
    if echo "$BASE_URL" | grep -E '^https://' > /dev/null; then
        log_check "PASS" "PUBLIC_BASE_URL uses HTTPS"
    else
        log_check "FAIL" "PUBLIC_BASE_URL must use HTTPS in production"
    fi
else
    log_check "FAIL" "PUBLIC_BASE_URL not set"
fi

# Check JWT algorithm
if [ -n "$JWT_ALG" ]; then
    if echo "$JWT_ALG" | egrep -qx 'RS256|EdDSA'; then
        log_check "PASS" "JWT algorithm is production-ready ($JWT_ALG)"
    else
        log_check "FAIL" "JWT algorithm should be RS256 or EdDSA in production"
    fi
else
    log_check "FAIL" "JWT_ALG not set"
fi

# Check required secrets
if [ -n "$COOKIE_DOMAIN" ] && [ -n "$CSRF_SECRET" ] && [ -n "$RATE_LIMIT_REDIS_URL" ]; then
    log_check "PASS" "Required security secrets configured"
else
    log_check "FAIL" "Missing required security secrets (COOKIE_DOMAIN, CSRF_SECRET, RATE_LIMIT_REDIS_URL)"
fi

echo ""

# 2) JWKS Health & Pinning
log_info "2) JWKS Health & Pinning"
echo "-------------------------"

if [ -z "$BASE_URL" ]; then
    log_check "FAIL" "Cannot test JWKS without BASE_URL"
else
    # Test JWKS endpoint exists and returns valid JSON
    if curl -fsS "$BASE_URL/.well-known/jwks.json" > /dev/null 2>&1; then
        log_check "PASS" "JWKS endpoint accessible"
        
        # Check JWKS has at least 1 key
        KEY_COUNT=$(curl -fsS "$BASE_URL/.well-known/jwks.json" | jq '.keys | length' 2>/dev/null || echo "0")
        if [ "$KEY_COUNT" -ge 1 ]; then
            log_check "PASS" "JWKS contains $KEY_COUNT key(s)"
        else
            log_check "FAIL" "JWKS must contain at least 1 key"
        fi
        
        # Check algorithm is production-ready
        ALGORITHMS=$(curl -fsS "$BASE_URL/.well-known/jwks.json" | jq -r '.keys[].alg' 2>/dev/null || echo "")
        if echo "$ALGORITHMS" | egrep -qx 'RS256|EdDSA'; then
            log_check "PASS" "JWKS algorithms are production-ready"
        else
            log_check "FAIL" "JWKS algorithms must be RS256 or EdDSA"
        fi
        
        # Check caching headers
        CACHE_HEADERS=$(curl -fsSI "$BASE_URL/.well-known/jwks.json" 2>/dev/null | egrep -i 'etag|cache-control' || echo "")
        if [ -n "$CACHE_HEADERS" ]; then
            log_check "PASS" "JWKS has proper caching headers"
        else
            log_check "FAIL" "JWKS missing caching headers (ETag/Cache-Control)"
        fi
        
        # Test JWKS caching behavior (304 Not Modified)
        JWKS_ETAG=$(curl -fsSI "$BASE_URL/.well-known/jwks.json" 2>/dev/null | grep -i '^ETag:' | head -1 | awk '{print $2}' | tr -d '\r' || echo "")
        if [ -n "$JWKS_ETAG" ]; then
            JWKS_304_STATUS=$(curl -fsS -H "If-None-Match: $JWKS_ETAG" "$BASE_URL/.well-known/jwks.json" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
            if [ "$JWKS_304_STATUS" = "304" ]; then
                log_check "PASS" "JWKS caching working correctly (304 Not Modified)"
            else
                log_check "FAIL" "JWKS caching not working (got $JWKS_304_STATUS, expected 304)"
            fi
        else
            log_check "WARN" "Cannot test JWKS caching without ETag header"
        fi
        
        # Check JWKS integrity (SHA-256 hash)
        JWKS_CONTENT=$(curl -fsS "$BASE_URL/.well-known/jwks.json" 2>/dev/null || echo "")
        if [ -n "$JWKS_CONTENT" ]; then
            JWKS_HASH=$(echo "$JWKS_CONTENT" | jq -c . 2>/dev/null | sha256sum | awk '{print $1}' || echo "")
            if [ -n "$JWKS_HASH" ]; then
                log_check "PASS" "JWKS integrity hash: $JWKS_HASH"
            else
                log_check "WARN" "Could not generate JWKS integrity hash"
            fi
        fi
    else
        log_check "FAIL" "JWKS endpoint not accessible"
    fi
fi

echo ""

# 3) Headers/CORS/CSP Validation
log_info "3) Security Headers Validation"
echo "--------------------------------"

if [ -z "$BASE_URL" ]; then
    log_check "FAIL" "Cannot test headers without BASE_URL"
else
    # Test security headers
    HEADERS=$(curl -fsS -D - "$BASE_URL" -o /dev/null 2>/dev/null || echo "")
    
    if echo "$HEADERS" | grep -i 'strict-transport-security' > /dev/null; then
        log_check "PASS" "HSTS header present"
    else
        log_check "FAIL" "Missing HSTS header"
    fi
    
    if echo "$HEADERS" | grep -i 'content-security-policy' > /dev/null; then
        log_check "PASS" "CSP header present"
    else
        log_check "FAIL" "Missing CSP header"
    fi
    
    if echo "$HEADERS" | grep -i 'x-content-type-options' > /dev/null; then
        log_check "PASS" "X-Content-Type-Options header present"
    else
        log_check "FAIL" "Missing X-Content-Type-Options header"
    fi
    
    if echo "$HEADERS" | grep -i 'x-frame-options' > /dev/null; then
        log_check "PASS" "X-Frame-Options header present"
    else
        log_check "FAIL" "Missing X-Frame-Options header"
    fi
    
    if echo "$HEADERS" | grep -i 'vary: origin' > /dev/null; then
        log_check "PASS" "CORS Vary header present"
    else
        log_check "FAIL" "Missing CORS Vary header"
    fi
fi

echo ""

# 4) Critical Routes Sanity Check
log_info "4) Critical Routes Sanity Check"
echo "--------------------------------"

if [ -z "$BASE_URL" ]; then
    log_check "FAIL" "Cannot test routes without BASE_URL"
else
    # Health endpoint
    HEALTH_STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_STATUS" = "200" ]; then
        log_check "PASS" "Health endpoint responding (200)"
    else
        log_check "FAIL" "Health endpoint not responding (got $HEALTH_STATUS)"
    fi
    
    # Auth login endpoint (should return 401 or 405, not 500)
    AUTH_STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/login" 2>/dev/null || echo "000")
    if echo "$AUTH_STATUS" | egrep -qx '200|401|405'; then
        log_check "PASS" "Auth endpoint responding correctly ($AUTH_STATUS)"
    else
        log_check "FAIL" "Auth endpoint not responding correctly (got $AUTH_STATUS)"
    fi
fi

echo ""

# 5) Cookie Security Validation
log_info "5) Cookie Security Validation"
echo "-------------------------------"

if [ -z "$BASE_URL" ]; then
    log_check "FAIL" "Cannot test cookies without BASE_URL"
else
    # Test login endpoint for proper cookie settings
    LOGIN_RESPONSE=$(curl -fsS -D - -X POST "$BASE_URL/api/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"test@example.com","password":"test"}' \
        -o /dev/null 2>/dev/null || echo "")
    
    if [ -n "$LOGIN_RESPONSE" ]; then
        # Check for session cookie security
        if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*secure' > /dev/null; then
            log_check "PASS" "Session cookie has Secure flag"
        else
            log_check "FAIL" "Session cookie missing Secure flag"
        fi
        
        if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*httponly' > /dev/null; then
            log_check "PASS" "Session cookie has HttpOnly flag"
        else
            log_check "FAIL" "Session cookie missing HttpOnly flag"
        fi
        
        if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*samesite=strict' > /dev/null; then
            log_check "PASS" "Session cookie has SameSite=Strict"
        else
            log_check "WARN" "Session cookie missing SameSite=Strict (check if cross-site flows needed)"
        fi
        
        # Check cookie domain
        if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*domain=' > /dev/null; then
            log_check "PASS" "Cookie domain is set"
        else
            log_check "WARN" "Cookie domain not explicitly set"
        fi
    else
        log_check "WARN" "Could not test cookie security (login endpoint may not be accessible)"
    fi
fi

echo ""

# 6) Clock Skew Validation
log_info "6) Clock Skew Validation"
echo "-------------------------"

# Test with expired token (should be rejected even with leeway)
if [ -n "$ACCESS_TOKEN" ]; then
    # Create a token that expired 1 hour ago (simulate clock skew)
    EXPIRED_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid"
    
    EXPIRED_RESPONSE=$(curl -fsS -H "Authorization: Bearer $EXPIRED_TOKEN" \
        "$BASE_URL/api/v1/auth/me" \
        -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    
    if [ "$EXPIRED_RESPONSE" = "401" ] || [ "$EXPIRED_RESPONSE" = "403" ]; then
        log_check "PASS" "Clock skew protection working (rejected expired token)"
    else
        log_check "FAIL" "Clock skew protection may be compromised (got $EXPIRED_RESPONSE)"
    fi
else
    log_check "WARN" "Cannot test clock skew without ACCESS_TOKEN"
fi

echo ""

# Summary
echo -e "${BLUE}📊 Preflight Validation Summary${NC}"
echo "=================================="
echo -e "Total Checks: $CHECKS_TOTAL"
echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"

# Evidence capture for audit/compliance
EVIDENCE_DIR="preflight-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Capture JWKS hash and content
if [ -n "$BASE_URL" ]; then
    curl -fsS "$BASE_URL/.well-known/jwks.json" > "$EVIDENCE_DIR/jwks.json" 2>/dev/null || true
    echo "$JWKS_HASH" > "$EVIDENCE_DIR/jwks-hash.txt" 2>/dev/null || true
fi

# Capture environment configuration (sanitized)
{
    echo "PUBLIC_BASE_URL=$BASE_URL"
    echo "JWT_ALG=$JWT_ALG"
    echo "COOKIE_DOMAIN=$COOKIE_DOMAIN"
    echo "CSRF_SECRET=[REDACTED]"
    echo "RATE_LIMIT_REDIS_URL=[REDACTED]"
} > "$EVIDENCE_DIR/env-config.txt"

# Capture preflight results
{
    echo "Preflight Validation Results"
    echo "Timestamp: $(date)"
    echo "Total Checks: $CHECKS_TOTAL"
    echo "Passed: $CHECKS_PASSED"
    echo "Failed: $CHECKS_FAILED"
} > "$EVIDENCE_DIR/results.txt"

log_info "Evidence captured in: $EVIDENCE_DIR"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All preflight checks passed! Ready for deployment.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ $CHECKS_FAILED check(s) failed. Fix issues before deployment.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    exit 1
fi
