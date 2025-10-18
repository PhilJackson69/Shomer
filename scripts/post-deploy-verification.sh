#!/bin/bash
# Shomer Post-Deploy Verification Script
# 5-minute verification after deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

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

# Header
echo -e "${BLUE}🔍 Shomer Post-Deploy Verification${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

if [ -z "$BASE_URL" ]; then
    echo -e "${RED}❌ PUBLIC_BASE_URL not set${NC}"
    exit 1
fi

# 1) Revoke-all functionality
log_info "1) Session Revocation Test"
echo "----------------------------"

if [ -z "$ACCESS_TOKEN" ]; then
    log_check "FAIL" "ACCESS_TOKEN not provided for revocation test"
else
    REVOKE_STATUS=$(curl -fsS -X POST "$BASE_URL/api/v1/auth/sessions/revoke-all" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    
    if [ "$REVOKE_STATUS" = "204" ]; then
        log_check "PASS" "Revoke-all endpoint working (204)"
    else
        log_check "FAIL" "Revoke-all endpoint failed (got $REVOKE_STATUS)"
    fi
fi

echo ""

# 2) Idempotency Test
log_info "2) Idempotency Key Test"
echo "------------------------"

# Generate unique idempotency key
IK="ik-$(uuidgen 2>/dev/null || date +%s)"

# First request
FIRST_STATUS=$(curl -fsS -X POST "$BASE_URL/api/v1/resource" \
    -H "Idempotency-Key: $IK" \
    -H 'Content-Type: application/json' \
    -d '{"x":1}' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [ "$FIRST_STATUS" = "200" ] || [ "$FIRST_STATUS" = "201" ]; then
    log_check "PASS" "First idempotent request succeeded ($FIRST_STATUS)"
    
    # Second request with same key
    SECOND_STATUS=$(curl -fsS -X POST "$BASE_URL/api/v1/resource" \
        -H "Idempotency-Key: $IK" \
        -H 'Content-Type: application/json' \
        -d '{"x":1}' \
        -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    
    if echo "$SECOND_STATUS" | egrep -qx '208|409'; then
        log_check "PASS" "Idempotency working correctly ($SECOND_STATUS)"
    else
        log_check "FAIL" "Idempotency not working (got $SECOND_STATUS, expected 208 or 409)"
    fi
else
    log_check "FAIL" "First idempotent request failed ($FIRST_STATUS)"
fi

echo ""

# 3) SSRF Protection Test
log_info "3) SSRF Protection Test"
echo "------------------------"

# Test URL validation endpoint
SSRF_STATUS=$(curl -fsS -X POST "$BASE_URL/api/v1/validation/url-scan" \
    -H 'Content-Type: application/json' \
    -d '{"url":"http://example-short.link/redirects-to-169.254.169.254"}' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if echo "$SSRF_STATUS" | egrep -qx '4..'; then
    log_check "PASS" "SSRF protection working (blocked private IP, got $SSRF_STATUS)"
else
    log_check "FAIL" "SSRF protection may be compromised (got $SSRF_STATUS)"
fi

echo ""

# 4) Rate Limiting Test
log_info "4) Rate Limiting Test"
echo "---------------------"

# Test rate limiting by making multiple requests quickly
RATE_LIMIT_HIT=false
for i in {1..10}; do
    RATE_STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health" 2>/dev/null || echo "000")
    if [ "$RATE_STATUS" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    log_check "PASS" "Rate limiting is active (429 returned)"
else
    log_check "WARN" "Rate limiting may not be active (no 429 responses)"
fi

echo ""

# 5) CSRF Protection Test
log_info "5) CSRF Protection Test"
echo "------------------------"

# Test CSRF protection by making a POST without token
CSRF_STATUS=$(curl -fsS -X POST "$BASE_URL/api/v1/tips" \
    -H 'Content-Type: application/json' \
    -d '{"title":"test","description":"test"}' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [ "$CSRF_STATUS" = "403" ]; then
    log_check "PASS" "CSRF protection active (403 returned)"
else
    log_check "WARN" "CSRF protection may not be active (got $CSRF_STATUS)"
fi

echo ""

# 6) Surgical Sanity Checks
log_info "6) Surgical Sanity Checks"
echo "--------------------------"

# JWKS rotation actually caches & 304s
log_info "Testing JWKS caching behavior..."
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

# KMS signer matches JWKS (kid alignment)
log_info "Testing KMS signer alignment..."
if [ -n "$ACCESS_TOKEN" ]; then
    # Decode JWT header to get kid
    JWT_HEADER=$(echo "$ACCESS_TOKEN" | cut -d'.' -f1 | base64 -d 2>/dev/null || echo "")
    if [ -n "$JWT_HEADER" ]; then
        JWT_KID=$(echo "$JWT_HEADER" | jq -r '.kid' 2>/dev/null || echo "")
        if [ -n "$JWT_KID" ] && [ "$JWT_KID" != "null" ]; then
            # Check if kid exists in JWKS
            JWKS_KIDS=$(curl -fsS "$BASE_URL/.well-known/jwks.json" | jq -r '.keys[].kid' 2>/dev/null || echo "")
            if echo "$JWKS_KIDS" | grep -q "$JWT_KID"; then
                log_check "PASS" "JWT kid ($JWT_KID) matches JWKS"
            else
                log_check "FAIL" "JWT kid ($JWT_KID) not found in JWKS"
            fi
        else
            log_check "WARN" "Could not extract kid from JWT header"
        fi
    else
        log_check "WARN" "Could not decode JWT header"
    fi
else
    log_check "WARN" "Cannot test KMS alignment without ACCESS_TOKEN"
fi

# Clock-skew guard
log_info "Testing clock-skew protection..."
EXPIRED_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid"
EXPIRED_RESPONSE=$(curl -fsS -H "Authorization: Bearer $EXPIRED_TOKEN" \
    "$BASE_URL/api/v1/auth/me" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if [ "$EXPIRED_RESPONSE" = "401" ] || [ "$EXPIRED_RESPONSE" = "403" ]; then
    log_check "PASS" "Clock-skew protection working (rejected expired token)"
else
    log_check "FAIL" "Clock-skew protection may be compromised (got $EXPIRED_RESPONSE)"
fi

# Cookie domain / SameSite
log_info "Testing cookie security..."
LOGIN_RESPONSE=$(curl -fsS -D - -X POST "$BASE_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"test"}' \
    -o /dev/null 2>/dev/null || echo "")
if [ -n "$LOGIN_RESPONSE" ]; then
    if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*secure.*httponly.*samesite=strict' > /dev/null; then
        log_check "PASS" "Session cookie has Secure; HttpOnly; SameSite=Strict"
    else
        log_check "WARN" "Session cookie missing some security flags"
    fi
else
    log_check "WARN" "Could not test cookie security (login endpoint may not be accessible)"
fi

# Rate-limit leak test
log_info "Testing rate limiting..."
RATE_LIMIT_HIT=false
RETRY_AFTER_PRESENT=false
for i in {1..20}; do
    RATE_RESPONSE=$(curl -fsS -D - -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"test@example.com","password":"test"}' 2>/dev/null || echo "000")
    
    if [ "$RATE_RESPONSE" = "429" ]; then
        RATE_LIMIT_HIT=true
        # Check for Retry-After header
        if curl -fsS -D - -o /dev/null "$BASE_URL/api/v1/auth/login" \
            -H 'Content-Type: application/json' \
            -d '{"email":"test@example.com","password":"test"}' 2>/dev/null | grep -i 'retry-after' > /dev/null; then
            RETRY_AFTER_PRESENT=true
        fi
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    log_check "PASS" "Rate limiting is active (429 returned)"
    if [ "$RETRY_AFTER_PRESENT" = true ]; then
        log_check "PASS" "Retry-After header present"
    else
        log_check "WARN" "Retry-After header missing"
    fi
else
    log_check "WARN" "Rate limiting may not be active (no 429 responses)"
fi

# SSRF redirect-to-private
log_info "Testing SSRF protection..."
SSRF_RESPONSE=$(curl -fsS -X POST "$BASE_URL/api/v1/validation/url-scan" \
    -H 'Content-Type: application/json' \
    -d '{"url":"http://example-short.link/redirects-to-169.254.169.254"}' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if echo "$SSRF_RESPONSE" | egrep -qx '4..'; then
    log_check "PASS" "SSRF protection working (blocked private IP redirect, got $SSRF_RESPONSE)"
else
    log_check "FAIL" "SSRF protection may be compromised (got $SSRF_RESPONSE)"
fi

echo ""
echo -e "${BLUE}📊 Post-Deploy Verification Summary${NC}"
echo "====================================="
echo -e "Total Checks: $CHECKS_TOTAL"
echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"

# Evidence capture for audit/compliance
POST_DEPLOY_EVIDENCE_DIR="post-deploy-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$POST_DEPLOY_EVIDENCE_DIR"

# Capture verification results
{
    echo "Post-Deploy Verification Results"
    echo "Timestamp: $(date)"
    echo "Total Checks: $CHECKS_TOTAL"
    echo "Passed: $CHECKS_PASSED"
    echo "Failed: $CHECKS_FAILED"
    echo ""
    echo "Surgical Sanity Check Results:"
    echo "- JWKS Caching: $(if [ "$JWKS_304_STATUS" = "304" ]; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- KMS Alignment: $(if [ -n "$JWT_KID" ] && echo "$JWKS_KIDS" | grep -q "$JWT_KID"; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- Clock Skew: $(if [ "$EXPIRED_RESPONSE" = "401" ] || [ "$EXPIRED_RESPONSE" = "403" ]; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- Cookie Security: $(if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*secure.*httponly.*samesite=strict' > /dev/null; then echo "PASS"; else echo "WARN"; fi)"
    echo "- Rate Limiting: $(if [ "$RATE_LIMIT_HIT" = true ]; then echo "PASS"; else echo "WARN"; fi)"
    echo "- SSRF Protection: $(if echo "$SSRF_RESPONSE" | egrep -qx '4..'; then echo "PASS"; else echo "FAIL"; fi)"
} > "$POST_DEPLOY_EVIDENCE_DIR/verification-results.txt"

# Capture HTTP response codes and headers
{
    echo "HTTP Response Codes Tested:"
    echo "Revoke-all: $REVOKE_STATUS"
    echo "Idempotency (first): $FIRST_STATUS"
    echo "Idempotency (second): $SECOND_STATUS"
    echo "SSRF Protection: $SSRF_RESPONSE"
    echo "CSRF Protection: $CSRF_STATUS"
    echo "Rate Limiting: $RATE_RESPONSE"
    echo "Clock Skew: $EXPIRED_RESPONSE"
    echo "JWKS Caching: $JWKS_304_STATUS"
} > "$POST_DEPLOY_EVIDENCE_DIR/http-responses.txt"

log_info "Post-deploy evidence captured in: $POST_DEPLOY_EVIDENCE_DIR"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 Post-deploy verification passed!${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $POST_DEPLOY_EVIDENCE_DIR${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ $CHECKS_FAILED check(s) failed. Review deployment.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $POST_DEPLOY_EVIDENCE_DIR${NC}"
    exit 1
fi
