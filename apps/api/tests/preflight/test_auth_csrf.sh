#!/bin/bash
#
# Authentication & CSRF Protection Tests
#
# Tests:
# 1. JWT cookie security (HttpOnly, Secure, SameSite)
# 2. CSRF token presence on mutating requests
# 3. CSRF validation enforcement
#
# Usage:
#   export API="https://shomer.app"
#   export USERNAME="test@example.com"
#   export PASSWORD="password"
#   ./test_auth_csrf.sh

set -e

API="${API:-http://localhost:8000}"
USERNAME="${USERNAME:-admin@example.com}"
PASSWORD="${PASSWORD:-admin}"

echo "====================================="
echo "Auth & CSRF Protection Tests"
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

test_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# ============================================================================
# Test 1: Login and JWT Cookie
# ============================================================================

echo "--- Test 1: JWT Cookie Security ---"
echo ""

echo "Logging in as $USERNAME..."

LOGIN_RESPONSE=$(curl -si -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  2>&1)

if [ $? -ne 0 ]; then
  test_fail "Login failed (connection error)"
  exit 1
fi

# Check HTTP status
if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
  test_pass "Login successful (200 OK)"
else
  test_fail "Login failed (non-200 status)"
  echo "$LOGIN_RESPONSE" | head -n 10
  exit 1
fi

# Extract JWT token from response body or header
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$JWT_TOKEN" ]; then
  # Try to get from Set-Cookie header
  JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i "Set-Cookie.*jwt" | grep -o "jwt=[^;]*" | cut -d'=' -f2)
fi

if [ -n "$JWT_TOKEN" ]; then
  test_pass "JWT token received"
else
  test_fail "No JWT token in response"
  exit 1
fi

# Check for JWT cookie
JWT_COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "Set-Cookie.*jwt" || true)

if [ -n "$JWT_COOKIE" ]; then
  echo "JWT Cookie found:"
  echo "$JWT_COOKIE"
  echo ""
  
  # Check HttpOnly
  if echo "$JWT_COOKIE" | grep -qi "HttpOnly"; then
    test_pass "JWT cookie has HttpOnly flag"
  else
    test_fail "JWT cookie missing HttpOnly flag (XSS risk)"
  fi
  
  # Check Secure
  if echo "$JWT_COOKIE" | grep -qi "Secure"; then
    test_pass "JWT cookie has Secure flag"
  else
    test_warn "JWT cookie missing Secure flag (acceptable in dev, required in prod)"
  fi
  
  # Check SameSite
  if echo "$JWT_COOKIE" | grep -qi "SameSite=Strict\|SameSite=Lax"; then
    SAMESITE=$(echo "$JWT_COOKIE" | grep -oi "SameSite=[^;]*")
    test_pass "JWT cookie has $SAMESITE"
  else
    test_fail "JWT cookie missing SameSite (CSRF risk)"
  fi
else
  test_warn "No JWT cookie set (token may be in response body only)"
fi

echo ""

# ============================================================================
# Test 2: CSRF Token Presence
# ============================================================================

echo "--- Test 2: CSRF Token Presence ---"
echo ""

# Make a GET request to get CSRF token
CSRF_RESPONSE=$(curl -si "$API/api/v1/evidence" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  2>&1)

# Check for CSRF cookie
CSRF_COOKIE=$(echo "$CSRF_RESPONSE" | grep -i "Set-Cookie.*csrf" || true)

if [ -n "$CSRF_COOKIE" ]; then
  CSRF_TOKEN=$(echo "$CSRF_COOKIE" | grep -o "csrf[^=]*=[^;]*" | cut -d'=' -f2)
  test_pass "CSRF token cookie received: ${CSRF_TOKEN:0:16}..."
  echo ""
else
  test_warn "No CSRF token cookie (may not be required in dev)"
  CSRF_TOKEN=""
  echo ""
fi

# ============================================================================
# Test 3: CSRF Validation on POST Requests
# ============================================================================

echo "--- Test 3: CSRF Validation ---"
echo ""

# Test 3a: POST without CSRF token (should fail in production)
echo "Test 3a: POST without CSRF token..."

NO_CSRF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API/api/v1/tips" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test tip","anonymous":true}' \
  2>&1)

HTTP_STATUS=$(echo "$NO_CSRF_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "403" ]; then
  test_pass "POST without CSRF token rejected (403)"
elif [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  test_warn "POST without CSRF token accepted (CSRF protection may be disabled in dev)"
else
  test_warn "POST without CSRF token returned $HTTP_STATUS (unexpected)"
fi

echo ""

# Test 3b: POST with valid CSRF token (should succeed)
if [ -n "$CSRF_TOKEN" ]; then
  echo "Test 3b: POST with valid CSRF token..."
  
  WITH_CSRF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API/api/v1/tips" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Test tip with CSRF","anonymous":true}' \
    2>&1)
  
  HTTP_STATUS=$(echo "$WITH_CSRF_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    test_pass "POST with CSRF token accepted ($HTTP_STATUS)"
  else
    test_fail "POST with CSRF token failed ($HTTP_STATUS)"
    echo "Response: $WITH_CSRF_RESPONSE"
  fi
  
  echo ""
fi

# Test 3c: POST with invalid CSRF token (should fail)
if [ -n "$CSRF_TOKEN" ]; then
  echo "Test 3c: POST with invalid CSRF token..."
  
  INVALID_CSRF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API/api/v1/tips" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "X-CSRF-Token: invalid-token-12345" \
    -H "Content-Type: application/json" \
    -d '{"content":"Test with invalid CSRF","anonymous":true}' \
    2>&1)
  
  HTTP_STATUS=$(echo "$INVALID_CSRF_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  
  if [ "$HTTP_STATUS" = "403" ]; then
    test_pass "POST with invalid CSRF token rejected (403)"
  else
    test_fail "POST with invalid CSRF token not rejected ($HTTP_STATUS)"
  fi
  
  echo ""
fi

# ============================================================================
# Test 4: Unauthenticated Access
# ============================================================================

echo "--- Test 4: Authentication Required ---"
echo ""

# Test 4a: Access protected endpoint without token (should return 401)
echo "Test 4a: Access protected endpoint without auth..."

NO_AUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "$API/api/v1/evidence" \
  2>&1)

HTTP_STATUS=$(echo "$NO_AUTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "401" ]; then
  test_pass "Protected endpoint without auth returns 401"
else
  test_fail "Protected endpoint without auth returns $HTTP_STATUS (expected 401)"
fi

echo ""

# Test 4b: Access with expired/invalid token (should return 401)
echo "Test 4b: Access with invalid token..."

INVALID_TOKEN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer invalid-token-12345" \
  "$API/api/v1/evidence" \
  2>&1)

HTTP_STATUS=$(echo "$INVALID_TOKEN_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" = "401" ]; then
  test_pass "Invalid token returns 401"
else
  test_fail "Invalid token returns $HTTP_STATUS (expected 401)"
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
  echo -e "${GREEN}✓ All auth & CSRF tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Review and fix issues.${NC}"
  exit 1
fi

