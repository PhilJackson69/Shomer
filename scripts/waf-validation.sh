#!/bin/bash
# Shomer WAF Validation Script
# Test WAF edge rules and security policies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
BASE="${BASE:-$BASE_URL}"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

log_test() {
    local status=$1
    local message=$2
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🛡️  Shomer WAF Validation${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""

if [ -z "$BASE" ]; then
    echo -e "${RED}❌ BASE URL not set${NC}"
    exit 1
fi

# 1) JSON GET with body should be blocked
log_info "1) Testing JSON GET with body blocking"
echo "----------------------------------------"

JSON_GET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "$BASE/api/v1/anything" \
    -H 'content-type: application/json' \
    --data '{}' 2>/dev/null || echo "000")

if echo "$JSON_GET_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "JSON GET with body blocked (got $JSON_GET_RESPONSE)"
else
    log_test "FAIL" "JSON GET with body not blocked (got $JSON_GET_RESPONSE, expected 4xx)"
fi

echo ""

# 2) Private IP requests should be blocked
log_info "2) Testing private IP request blocking"
echo "----------------------------------------"

PRIVATE_IP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE/api/v1/validation/url-scan" \
    -H 'Content-Type: application/json' \
    -d '{"url":"http://169.254.169.254/latest/meta-data/"}' 2>/dev/null || echo "000")

if echo "$PRIVATE_IP_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Private IP request blocked (got $PRIVATE_IP_RESPONSE)"
else
    log_test "FAIL" "Private IP request not blocked (got $PRIVATE_IP_RESPONSE, expected 4xx)"
fi

echo ""

# 3) Suspicious user agents should be blocked
log_info "3) Testing suspicious user agent blocking"
echo "--------------------------------------------"

SUSPICIOUS_UA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H 'User-Agent: sqlmap/1.0' \
    "$BASE/api/v1/health" 2>/dev/null || echo "000")

if echo "$SUSPICIOUS_UA_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Suspicious user agent blocked (got $SUSPICIOUS_UA_RESPONSE)"
else
    log_test "WARN" "Suspicious user agent not blocked (got $SUSPICIOUS_UA_RESPONSE)"
fi

echo ""

# 4) Common attack patterns should be blocked
log_info "4) Testing common attack pattern blocking"
echo "-------------------------------------------"

# Test SQL injection
SQL_INJECTION_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/v1/search?q=1' OR '1'='1" 2>/dev/null || echo "000")

if echo "$SQL_INJECTION_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "SQL injection pattern blocked (got $SQL_INJECTION_RESPONSE)"
else
    log_test "WARN" "SQL injection pattern not blocked (got $SQL_INJECTION_RESPONSE)"
fi

# Test XSS
XSS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/v1/search?q=<script>alert('xss')</script>" 2>/dev/null || echo "000")

if echo "$XSS_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "XSS pattern blocked (got $XSS_RESPONSE)"
else
    log_test "WARN" "XSS pattern not blocked (got $XSS_RESPONSE)"
fi

# Test path traversal
PATH_TRAVERSAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/v1/files/../../../etc/passwd" 2>/dev/null || echo "000")

if echo "$PATH_TRAVERSAL_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Path traversal pattern blocked (got $PATH_TRAVERSAL_RESPONSE)"
else
    log_test "WARN" "Path traversal pattern not blocked (got $PATH_TRAVERSAL_RESPONSE)"
fi

echo ""

# 5) Rate limiting should be active
log_info "5) Testing rate limiting"
echo "-------------------------"

RATE_LIMIT_HIT=false
for i in {1..15}; do
    RATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BASE/api/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d '{"email":"test@example.com","password":"test"}' 2>/dev/null || echo "000")
    
    if [ "$RATE_RESPONSE" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    log_test "PASS" "Rate limiting is active (429 returned)"
else
    log_test "WARN" "Rate limiting may not be active (no 429 responses)"
fi

echo ""

# 6) Missing User-Agent should be blocked
log_info "6) Testing missing User-Agent blocking"
echo "---------------------------------------"

NO_UA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H 'User-Agent:' \
    "$BASE/api/v1/health" 2>/dev/null || echo "000")

if echo "$NO_UA_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Missing User-Agent blocked (got $NO_UA_RESPONSE)"
else
    log_test "WARN" "Missing User-Agent not blocked (got $NO_UA_RESPONSE)"
fi

echo ""

# 7) Large file upload should be blocked
log_info "7) Testing large file upload blocking"
echo "---------------------------------------"

# Create a test file larger than 5MB
LARGE_FILE="/tmp/test_large_file.bin"
dd if=/dev/zero of="$LARGE_FILE" bs=1M count=6 2>/dev/null || true

LARGE_UPLOAD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE/api/v1/upload" \
    -F "file=@$LARGE_FILE" 2>/dev/null || echo "000")

# Cleanup
rm -f "$LARGE_FILE"

if echo "$LARGE_UPLOAD_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Large file upload blocked (got $LARGE_UPLOAD_RESPONSE)"
else
    log_test "WARN" "Large file upload not blocked (got $LARGE_UPLOAD_RESPONSE)"
fi

echo ""

# 8) Admin endpoint geo-blocking (if applicable)
log_info "8) Testing admin endpoint geo-blocking"
echo "----------------------------------------"

ADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/v1/admin/users" 2>/dev/null || echo "000")

if echo "$ADMIN_RESPONSE" | egrep -q '^4..$'; then
    log_test "PASS" "Admin endpoint access blocked (got $ADMIN_RESPONSE)"
else
    log_test "WARN" "Admin endpoint access not blocked (got $ADMIN_RESPONSE)"
fi

echo ""

# Evidence capture for audit/compliance
WAF_EVIDENCE_DIR="waf-validation-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WAF_EVIDENCE_DIR"

# Capture WAF test results
{
    echo "WAF Validation Results"
    echo "Timestamp: $(date)"
    echo "Base URL: $BASE"
    echo "Total Tests: $TESTS_TOTAL"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo ""
    echo "Test Results:"
    echo "- JSON GET with body: $JSON_GET_RESPONSE"
    echo "- Private IP request: $PRIVATE_IP_RESPONSE"
    echo "- Suspicious User-Agent: $SUSPICIOUS_UA_RESPONSE"
    echo "- SQL injection: $SQL_INJECTION_RESPONSE"
    echo "- XSS pattern: $XSS_RESPONSE"
    echo "- Path traversal: $PATH_TRAVERSAL_RESPONSE"
    echo "- Rate limiting: $(if [ "$RATE_LIMIT_HIT" = true ]; then echo "429"; else echo "No 429"; fi)"
    echo "- Missing User-Agent: $NO_UA_RESPONSE"
    echo "- Large file upload: $LARGE_UPLOAD_RESPONSE"
    echo "- Admin endpoint: $ADMIN_RESPONSE"
} > "$WAF_EVIDENCE_DIR/waf-test-results.txt"

# Capture WAF rules configuration
if [ -f "infra/waf-edge-rules.yaml" ]; then
    cp "infra/waf-edge-rules.yaml" "$WAF_EVIDENCE_DIR/waf-rules.yaml"
    log_info "WAF rules configuration captured"
fi

log_info "WAF validation evidence captured in: $WAF_EVIDENCE_DIR"

# Summary
echo -e "${BLUE}📊 WAF Validation Summary${NC}"
echo "============================="
echo -e "Total Tests: $TESTS_TOTAL"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All WAF validation tests passed!${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $WAF_EVIDENCE_DIR${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ $TESTS_FAILED test(s) failed. Review WAF configuration.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $WAF_EVIDENCE_DIR${NC}"
    exit 1
fi
