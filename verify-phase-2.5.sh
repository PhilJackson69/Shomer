#!/bin/bash
# Phase 2.5 Hardening Verification Script
# Run after deployment to verify all features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-localhost}"
PROTOCOL="${PROTOCOL:-https}"
BASE_URL="${PROTOCOL}://${DOMAIN}"
API_URL="${BASE_URL}/api/v1"

echo "========================================="
echo "Phase 2.5 Hardening Verification"
echo "========================================="
echo "Target: $BASE_URL"
echo ""

# Counter for passed/failed tests
PASSED=0
FAILED=0

# Test function
test_check() {
    local test_name="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
    fi
}

echo "1. Security Headers"
echo "-------------------"

test_check "HSTS with preload" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "Strict-Transport-Security.*preload"

test_check "X-Frame-Options: DENY" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "X-Frame-Options: DENY"

test_check "X-Content-Type-Options" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "X-Content-Type-Options: nosniff"

test_check "Referrer-Policy: no-referrer" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "Referrer-Policy: no-referrer"

test_check "Permissions-Policy" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "Permissions-Policy"

test_check "Content-Security-Policy" \
    "curl -Iks $BASE_URL/ 2>&1" \
    "Content-Security-Policy"

echo ""
echo "2. File Structure"
echo "-----------------"

test_check "Nginx config exists" \
    "ls infra/nginx/nginx.conf 2>&1" \
    "nginx.conf"

test_check "MIME validator exists" \
    "ls apps/api/app/services/mime_validator.py 2>&1" \
    "mime_validator.py"

test_check "MIME validator tests exist" \
    "ls apps/api/tests/test_mime_validator.py 2>&1" \
    "test_mime_validator.py"

test_check "Signed URL tests exist" \
    "ls apps/api/tests/test_signed_export.py 2>&1" \
    "test_signed_export.py"

test_check "Evidence detail page exists" \
    "ls 'apps/web/src/app/dashboard/evidence/[id]/page.tsx' 2>&1" \
    "page.tsx"

test_check "Dependabot config exists" \
    "ls .github/dependabot.yml 2>&1" \
    "dependabot.yml"

test_check "Security audit workflow exists" \
    "ls .github/workflows/security-audit.yml 2>&1" \
    "security-audit.yml"

echo ""
echo "3. Code Integration"
echo "-------------------"

test_check "Signed URL functions in security.py" \
    "grep -l 'sign_path' apps/api/app/core/security.py 2>&1" \
    "security.py"

test_check "MIME validator imported" \
    "grep -l 'validate_mime_and_extension' apps/api/app/services/evidence_service.py 2>&1" \
    "evidence_service.py"

test_check "Signed URL config added" \
    "grep -l 'SIGNED_URL_SECRET' apps/api/app/core/config.py 2>&1" \
    "config.py"

test_check "Signed URL endpoint added" \
    "grep -l 'export-chain-of-custody/signed-url' apps/api/app/api/v1/endpoints/evidence.py 2>&1" \
    "evidence.py"

echo ""
echo "4. Documentation"
echo "----------------"

test_check "SECURITY.md updated" \
    "grep -l 'Phase 2.5 Hardening' docs/SECURITY.md 2>&1" \
    "SECURITY.md"

test_check "PREFLIGHT checklist updated" \
    "grep -l 'Phase 2.5' docs/PREFLIGHT_90MIN_CHECKLIST.md 2>&1" \
    "PREFLIGHT_90MIN_CHECKLIST.md"

echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Set environment variables (SIGNED_URL_SECRET, PUBLIC_BASE_URL)"
    echo "2. Install python-magic: pip install python-magic-bin"
    echo "3. Build and deploy: docker compose -f docker-compose.prod.yml up -d --build"
    echo "4. Run backend tests: pytest tests/test_mime_validator.py tests/test_signed_export.py"
    echo "5. Verify in browser: Navigate to /dashboard/evidence/[id]"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Review the output above.${NC}"
    exit 1
fi


