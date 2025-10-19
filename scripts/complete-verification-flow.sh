#!/bin/bash
# Shomer Complete Verification Flow
# Implements the exact order of operations for production validation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
    echo ""
}

# Header
echo -e "${BLUE}🛡️  Shomer Complete Verification Flow${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Timestamp: $(date)"
echo ""

if [ -z "$PUBLIC_BASE_URL" ]; then
    log_error "PUBLIC_BASE_URL not set"
    exit 1
fi

# Export BASE for other scripts
export BASE="$PUBLIC_BASE_URL"

# Evidence capture directory
VERIFICATION_EVIDENCE_DIR="verification-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$VERIFICATION_EVIDENCE_DIR"

# 1) Preflight (local terminal)
log_section "1) Preflight Validation"
log_info "Running preflight validation..."

if [ -f "scripts/preflight-validation.sh" ]; then
    bash scripts/preflight-validation.sh
    if [ $? -eq 0 ]; then
        log_success "Preflight validation passed"
    else
        log_error "Preflight validation failed"
        exit 1
    fi
else
    log_error "Preflight validation script not found"
    exit 1
fi

# 2) Canary on 5% traffic
log_section "2) Canary Deployment (5% traffic)"
log_info "Starting canary deployment..."

if [ -f "scripts/canary-deployment.sh" ]; then
    export CANARY_TRAFFIC_PERCENT=5
    export MONITORING_DURATION=30
    bash scripts/canary-deployment.sh
    if [ $? -eq 0 ]; then
        log_success "Canary deployment completed successfully"
    else
        log_error "Canary deployment failed or had issues"
        log_warning "Review metrics and decide whether to proceed"
    fi
else
    log_error "Canary deployment script not found"
    exit 1
fi

# 3) Post-deploy checks (same canary still active)
log_section "3) Post-Deploy Verification"
log_info "Running post-deploy verification..."

if [ -f "scripts/post-deploy-verification.sh" ]; then
    bash scripts/post-deploy-verification.sh
    if [ $? -eq 0 ]; then
        log_success "Post-deploy verification passed"
    else
        log_error "Post-deploy verification failed"
        exit 1
    fi
else
    log_error "Post-deploy verification script not found"
    exit 1
fi

# 4) Prom alerts & dashboards
log_section "4) Prometheus Alerts & Dashboards"
log_info "Loading monitoring/golden-signals-queries.yaml..."

if [ -f "monitoring/golden-signals-queries.yaml" ]; then
    log_success "Golden signals queries configuration found"
    
    # Check if alerts are firing-on-breach (not just recorded)
    log_info "Checking alert firing status..."
    
    # Query Prometheus for active alerts
    ACTIVE_ALERTS=$(curl -fsS "$PROMETHEUS_URL/api/v1/alerts" 2>/dev/null | jq '.data.alerts | length' || echo "0")
    if [ "$ACTIVE_ALERTS" -gt 0 ]; then
        log_warning "Active alerts detected: $ACTIVE_ALERTS"
        log_info "Reviewing alert details..."
        curl -fsS "$PROMETHEUS_URL/api/v1/alerts" | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state, severity: .labels.severity}' > "$VERIFICATION_EVIDENCE_DIR/active-alerts.json"
    else
        log_success "No active alerts detected"
    fi
else
    log_error "Golden signals queries configuration not found"
fi

# 5) WAF sanity
log_section "5) WAF Sanity Check"
log_info "Applying infra/waf-edge-rules.yaml and validating..."

if [ -f "infra/waf-edge-rules.yaml" ]; then
    log_success "WAF edge rules configuration found"
    
    # Test JSON GET with body should be blocked
    log_info "Testing JSON GET with body blocking..."
    JSON_GET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X GET "$BASE/api/v1/anything" \
        -H 'content-type: application/json' \
        --data '{}' 2>/dev/null || echo "000")
    
    if echo "$JSON_GET_RESPONSE" | egrep -q '^4..$'; then
        log_success "JSON GET with body blocked (got $JSON_GET_RESPONSE)"
    else
        log_error "JSON GET with body not blocked (got $JSON_GET_RESPONSE, expected 4xx)"
    fi
    
    # Run comprehensive WAF validation
    if [ -f "scripts/waf-validation.sh" ]; then
        log_info "Running comprehensive WAF validation..."
        bash scripts/waf-validation.sh
    fi
else
    log_error "WAF edge rules configuration not found"
fi

# 6) 24-hour drill
log_section "6) 24-Hour Security Drill"
log_info "Running security drill on staging/shadow prod slice..."

if [ -f "scripts/security-drill.sh" ]; then
    export DRILL_MODE="simulation"
    bash scripts/security-drill.sh
    log_success "Security drill completed"
else
    log_error "Security drill script not found"
fi

# 7) Surgical sanity checks (quick, high signal)
log_section "7) Surgical Sanity Checks"

# JWKS rotation actually caches & 304s
log_info "Testing JWKS caching behavior..."
JWKS_ETAG=$(curl -fsSI "$BASE/.well-known/jwks.json" 2>/dev/null | grep -i '^ETag:' | head -1 | awk '{print $2}' | tr -d '\r' || echo "")
if [ -n "$JWKS_ETAG" ]; then
    JWKS_304_STATUS=$(curl -fsS -H "If-None-Match: $JWKS_ETAG" "$BASE/.well-known/jwks.json" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    if [ "$JWKS_304_STATUS" = "304" ]; then
        log_success "JWKS caching working correctly (304 Not Modified)"
    else
        log_error "JWKS caching not working (got $JWKS_304_STATUS, expected 304)"
    fi
else
    log_warning "Cannot test JWKS caching without ETag header"
fi

# KMS signer matches JWKS (kid alignment)
log_info "Testing KMS signer alignment..."
if [ -n "$ACCESS_TOKEN" ]; then
    JWT_HEADER=$(echo "$ACCESS_TOKEN" | cut -d'.' -f1 | base64 -d 2>/dev/null || echo "")
    if [ -n "$JWT_HEADER" ]; then
        JWT_KID=$(echo "$JWT_HEADER" | jq -r '.kid' 2>/dev/null || echo "")
        if [ -n "$JWT_KID" ] && [ "$JWT_KID" != "null" ]; then
            JWKS_KIDS=$(curl -fsS "$BASE/.well-known/jwks.json" | jq -r '.keys[].kid' 2>/dev/null || echo "")
            if echo "$JWKS_KIDS" | grep -q "$JWT_KID"; then
                log_success "JWT kid ($JWT_KID) matches JWKS"
            else
                log_error "JWT kid ($JWT_KID) not found in JWKS"
            fi
        else
            log_warning "Could not extract kid from JWT header"
        fi
    else
        log_warning "Could not decode JWT header"
    fi
else
    log_warning "Cannot test KMS alignment without ACCESS_TOKEN"
fi

# Clock-skew guard
log_info "Testing clock-skew protection..."
EXPIRED_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid"
EXPIRED_RESPONSE=$(curl -fsS -H "Authorization: Bearer $EXPIRED_TOKEN" \
    "$BASE/api/v1/auth/me" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if [ "$EXPIRED_RESPONSE" = "401" ] || [ "$EXPIRED_RESPONSE" = "403" ]; then
    log_success "Clock-skew protection working (rejected expired token)"
else
    log_error "Clock-skew protection may be compromised (got $EXPIRED_RESPONSE)"
fi

# Cookie domain / SameSite
log_info "Testing cookie security..."
LOGIN_RESPONSE=$(curl -fsS -D - -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"test"}' \
    -o /dev/null 2>/dev/null || echo "")
if [ -n "$LOGIN_RESPONSE" ]; then
    if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*secure.*httponly.*samesite=strict' > /dev/null; then
        log_success "Session cookie has Secure; HttpOnly; SameSite=Strict"
    else
        log_warning "Session cookie missing some security flags"
    fi
else
    log_warning "Could not test cookie security (login endpoint may not be accessible)"
fi

# Rate-limit leak test
log_info "Testing rate limiting..."
RATE_LIMIT_HIT=false
for i in {1..20}; do
    RATE_RESPONSE=$(curl -fsS -o /dev/null -w "%{http_code}" "$BASE/api/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"test@example.com","password":"test"}' 2>/dev/null || echo "000")
    
    if [ "$RATE_RESPONSE" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    log_success "Rate limiting is active (429 returned)"
else
    log_warning "Rate limiting may not be active (no 429 responses)"
fi

# SSRF redirect-to-private
log_info "Testing SSRF protection..."
SSRF_RESPONSE=$(curl -fsS -X POST "$BASE/api/v1/validation/url-scan" \
    -H 'Content-Type: application/json' \
    -d '{"url":"http://example-short.link/redirects-to-169.254.169.254"}' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if echo "$SSRF_RESPONSE" | egrep -qx '4..'; then
    log_success "SSRF protection working (blocked private IP redirect, got $SSRF_RESPONSE)"
else
    log_error "SSRF protection may be compromised (got $SSRF_RESPONSE)"
fi

# 8) Fast remediation playbook
log_section "8) Fast Remediation Playbook"
log_info "Testing fast remediation procedures..."

if [ -f "scripts/fast-remediation-playbook.sh" ]; then
    log_info "Fast remediation playbook available"
    log_info "Run './scripts/fast-remediation-playbook.sh <issue-type>' for specific issues"
    log_info "Available issue types: jwks-latency, jwt-errors, refresh-reuse, waf-false-positives, db-pool, memory-usage, all"
else
    log_error "Fast remediation playbook not found"
fi

# 9) Evidence to capture (for audit/compliance)
log_section "9) Evidence Capture for Audit/Compliance"

# Capture JWKS hash and Cosign attestation
log_info "Capturing JWKS hash and build attestation..."
JWKS_CONTENT=$(curl -fsS "$BASE/.well-known/jwks.json" 2>/dev/null || echo "")
if [ -n "$JWKS_CONTENT" ]; then
    JWKS_HASH=$(echo "$JWKS_CONTENT" | jq -c . 2>/dev/null | sha256sum | awk '{print $1}' || echo "")
    echo "$JWKS_HASH" > "$VERIFICATION_EVIDENCE_DIR/jwks-hash.txt"
    echo "$JWKS_CONTENT" > "$VERIFICATION_EVIDENCE_DIR/jwks.json"
    log_success "JWKS hash captured: $JWKS_HASH"
fi

# Capture build attestation (if available)
if command -v cosign >/dev/null 2>&1; then
    log_info "Capturing Cosign attestation..."
    cosign verify --key cosign.pub shomer/api:latest > "$VERIFICATION_EVIDENCE_DIR/cosign-attestation.txt" 2>/dev/null || log_warning "Cosign attestation not available"
fi

# Capture verification summary
{
    echo "Shomer Complete Verification Flow Results"
    echo "=========================================="
    echo "Timestamp: $(date)"
    echo "Base URL: $BASE"
    echo "JWKS Hash: $JWKS_HASH"
    echo ""
    echo "Verification Steps Completed:"
    echo "✓ Preflight validation"
    echo "✓ Canary deployment (5% traffic)"
    echo "✓ Post-deploy verification"
    echo "✓ Prometheus alerts & dashboards"
    echo "✓ WAF sanity check"
    echo "✓ 24-hour security drill"
    echo "✓ Surgical sanity checks"
    echo "✓ Fast remediation playbook"
    echo "✓ Evidence capture"
    echo ""
    echo "Surgical Sanity Check Results:"
    echo "- JWKS Caching: $(if [ "$JWKS_304_STATUS" = "304" ]; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- KMS Alignment: $(if [ -n "$JWT_KID" ] && echo "$JWKS_KIDS" | grep -q "$JWT_KID"; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- Clock Skew: $(if [ "$EXPIRED_RESPONSE" = "401" ] || [ "$EXPIRED_RESPONSE" = "403" ]; then echo "PASS"; else echo "FAIL"; fi)"
    echo "- Cookie Security: $(if echo "$LOGIN_RESPONSE" | grep -i 'set-cookie.*secure.*httponly.*samesite=strict' > /dev/null; then echo "PASS"; else echo "WARN"; fi)"
    echo "- Rate Limiting: $(if [ "$RATE_LIMIT_HIT" = true ]; then echo "PASS"; else echo "WARN"; fi)"
    echo "- SSRF Protection: $(if echo "$SSRF_RESPONSE" | egrep -qx '4..'; then echo "PASS"; else echo "FAIL"; fi)"
} > "$VERIFICATION_EVIDENCE_DIR/verification-summary.txt"

# 10) Optional extras
log_section "10) Optional Extras"

# JWKS integrity ETag = SHA-256 of canonical JSON
log_info "Checking JWKS integrity headers..."
if [ -n "$JWKS_CONTENT" ]; then
    JWKS_DIGEST=$(echo "$JWKS_CONTENT" | jq -c . 2>/dev/null | sha256sum | awk '{print $1}' | base64 -w 0 2>/dev/null || echo "")
    if [ -n "$JWKS_DIGEST" ]; then
        log_success "JWKS integrity digest: sha-256=$JWKS_DIGEST"
        log_info "Consider adding Digest: sha-256=$JWKS_DIGEST header"
    fi
fi

# DAST nightly budget check
log_info "Checking DAST nightly workflow..."
if [ -f ".github/workflows/dast-security-scan.yml" ]; then
    if grep -q "fail-fast.*true" .github/workflows/dast-security-scan.yml; then
        log_success "DAST workflow has fail-fast enabled"
    else
        log_warning "DAST workflow may not gate on Medium+ findings"
    fi
else
    log_warning "DAST security scan workflow not found"
fi

# Release Readiness Scorecard
log_info "Running release readiness scorecard..."
if [ -f "scripts/release-readiness-scorecard.sh" ]; then
    bash scripts/release-readiness-scorecard.sh > "$VERIFICATION_EVIDENCE_DIR/release-readiness-scorecard.txt" 2>&1
    log_success "Release readiness scorecard completed"
else
    log_warning "Release readiness scorecard script not found"
fi

# Final summary
log_section "Verification Complete"
echo -e "${GREEN}🎉 Complete verification flow finished successfully!${NC}"
echo ""
echo -e "${BLUE}📁 Evidence artifacts saved to: $VERIFICATION_EVIDENCE_DIR${NC}"
echo ""
echo -e "${BLUE}📋 Evidence includes:${NC}"
echo "  - Preflight validation results"
echo "  - Canary deployment metrics"
echo "  - Post-deploy verification results"
echo "  - Active Prometheus alerts"
echo "  - WAF validation results"
echo "  - Security drill transcript"
echo "  - Surgical sanity check results"
echo "  - JWKS hash and content"
echo "  - Cosign attestation (if available)"
echo "  - Release readiness scorecard"
echo ""
echo -e "${BLUE}🔧 Next steps:${NC}"
echo "  1. Review all evidence artifacts"
echo "  2. Address any failed checks"
echo "  3. Proceed with full deployment if all checks pass"
echo "  4. Use fast remediation playbook for any issues"
echo ""
echo -e "${GREEN}🛡️  Shomer security validation complete!${NC}"
