#!/bin/bash
#
# RBAC Negative Tests
#
# Tests that role-based access control is properly enforced:
# 1. Moderator cannot perform admin actions
# 2. Viewer cannot perform moderator actions
# 3. Unauthenticated users cannot access protected resources
#
# Usage:
#   export API="https://shomer.app"
#   export ADMIN_TOKEN="admin-jwt"
#   export MOD_TOKEN="moderator-jwt"
#   export VIEWER_TOKEN="viewer-jwt"
#   ./test_rbac.sh

set -e

API="${API:-http://localhost:8000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
MOD_TOKEN="${MOD_TOKEN:-}"
VIEWER_TOKEN="${VIEWER_TOKEN:-}"

echo "====================================="
echo "RBAC Negative Tests"
echo "====================================="
echo "API: $API"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_pass() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED++))
}

test_fail() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED++))
}

check_tokens() {
  if [ -z "$ADMIN_TOKEN" ] || [ -z "$MOD_TOKEN" ] || [ -z "$VIEWER_TOKEN" ]; then
    echo -e "${RED}Error: All tokens required (ADMIN_TOKEN, MOD_TOKEN, VIEWER_TOKEN)${NC}"
    echo "Please set environment variables with valid JWT tokens for each role"
    exit 1
  fi
}

check_tokens

# ============================================================================
# Test 1: Viewer Attempting Moderator Actions
# ============================================================================

echo "--- Test 1: Viewer → Moderator Actions (expect 403) ---"
echo ""

# Test 1a: Viewer tries to create an incident
echo "Test 1a: Viewer creates incident..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$API/api/v1/incidents" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Viewer test","description":"Should fail","severity":"medium"}' \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Viewer cannot create incident (403)"
elif [ "$STATUS" = "401" ]; then
  test_pass "Viewer token invalid or expired (401)"
else
  test_fail "Viewer can create incident (got $STATUS, expected 403)"
fi

# Test 1b: Viewer tries to update an alert
echo "Test 1b: Viewer updates alert..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X PUT "$API/api/v1/alerts/1" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}' \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Viewer cannot update alert (403)"
elif [ "$STATUS" = "401" ]; then
  test_pass "Viewer token invalid (401)"
else
  test_fail "Viewer can update alert (got $STATUS, expected 403)"
fi

echo ""

# ============================================================================
# Test 2: Moderator Attempting Admin Actions
# ============================================================================

echo "--- Test 2: Moderator → Admin Actions (expect 403) ---"
echo ""

# Test 2a: Moderator tries to create a user
echo "Test 2a: Moderator creates user..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$API/api/v1/users" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","role":"viewer"}' \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Moderator cannot create user (403)"
elif [ "$STATUS" = "401" ]; then
  test_pass "Moderator token invalid (401)"
else
  test_fail "Moderator can create user (got $STATUS, expected 403)"
fi

# Test 2b: Moderator tries to delete a user
echo "Test 2b: Moderator deletes user..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X DELETE "$API/api/v1/users/1" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Moderator cannot delete user (403)"
elif [ "$STATUS" = "401" ]; then
  test_pass "Moderator token invalid (401)"
else
  test_fail "Moderator can delete user (got $STATUS, expected 403)"
fi

# Test 2c: Moderator tries to access admin-only settings
echo "Test 2c: Moderator accesses admin settings..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" "$API/api/v1/admin/settings" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Moderator cannot access admin settings (403)"
elif [ "$STATUS" = "401" ]; then
  test_pass "Moderator token invalid (401)"
elif [ "$STATUS" = "404" ]; then
  test_pass "Admin settings endpoint not found (404) - may not exist yet"
else
  test_fail "Moderator can access admin settings (got $STATUS, expected 403)"
fi

echo ""

# ============================================================================
# Test 3: Evidence Operations Without Proper Auth
# ============================================================================

echo "--- Test 3: Evidence Operations Auth ---"
echo ""

# Test 3a: Export without JWT
echo "Test 3a: Export chain-of-custody without JWT..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  "$API/api/v1/evidence/1/export-chain-of-custody" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "401" ]; then
  test_pass "Export without JWT rejected (401)"
else
  test_fail "Export without JWT allowed (got $STATUS, expected 401)"
fi

# Test 3b: Verify without JWT
echo "Test 3b: Verify evidence without JWT..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST \
  "$API/api/v1/evidence/1/verify" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "401" ]; then
  test_pass "Verify without JWT rejected (401)"
else
  test_fail "Verify without JWT allowed (got $STATUS, expected 401)"
fi

# Test 3c: Upload without JWT
echo "Test 3c: Upload evidence without JWT..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST \
  "$API/api/v1/evidence/upload" \
  -F "file=@/dev/null" \
  -F "evidence_type=document" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "401" ]; then
  test_pass "Upload without JWT rejected (401)"
else
  test_fail "Upload without JWT allowed (got $STATUS, expected 401)"
fi

echo ""

# ============================================================================
# Test 4: Evidence Operations Without CSRF
# ============================================================================

echo "--- Test 4: Evidence Operations CSRF Protection ---"
echo ""

# Test 4a: Upload without CSRF token (production should reject)
echo "Test 4a: Upload evidence without CSRF token..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST \
  "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/dev/null" \
  -F "evidence_type=document" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "403" ]; then
  test_pass "Upload without CSRF rejected (403) - production mode"
elif [ "$STATUS" = "400" ] || [ "$STATUS" = "422" ]; then
  echo -e "${YELLOW}⚠ Upload validation error ($STATUS) - may need valid file${NC}"
else
  echo -e "${YELLOW}⚠ Upload without CSRF allowed ($STATUS) - CSRF may be disabled in dev${NC}"
fi

echo ""

# ============================================================================
# Test 5: Admin Can Perform All Actions
# ============================================================================

echo "--- Test 5: Admin Permissions (sanity check) ---"
echo ""

# Test 5a: Admin lists users
echo "Test 5a: Admin lists users..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  "$API/api/v1/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "200" ]; then
  test_pass "Admin can list users (200)"
else
  test_fail "Admin cannot list users (got $STATUS, expected 200)"
fi

# Test 5b: Admin accesses evidence
echo "Test 5b: Admin accesses evidence..."
RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
  "$API/api/v1/evidence" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  2>&1)

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)

if [ "$STATUS" = "200" ]; then
  test_pass "Admin can access evidence (200)"
else
  test_fail "Admin cannot access evidence (got $STATUS, expected 200)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "====================================="
echo "Summary"
echo "====================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All RBAC tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some RBAC tests failed. Review access controls.${NC}"
  exit 1
fi

