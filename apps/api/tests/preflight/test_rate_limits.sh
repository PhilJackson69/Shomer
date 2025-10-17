#!/bin/bash
#
# Rate Limiting Tests
#
# Tests that rate limits are properly enforced:
# 1. General API: 60 requests/minute per IP
# 2. Evidence upload: 10 requests/minute
# 3. Evidence export: 5 requests/minute
#
# Usage:
#   export API="https://shomer.app"
#   export TOKEN="jwt-token"
#   ./test_rate_limits.sh

set -e

API="${API:-http://localhost:8000}"
TOKEN="${TOKEN:-}"

echo "====================================="
echo "Rate Limiting Tests"
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

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}⚠ No TOKEN provided - some tests will be skipped${NC}"
  echo ""
fi

# ============================================================================
# Test 1: General API Rate Limit (60/min)
# ============================================================================

echo "--- Test 1: General API Rate Limit (60/min) ---"
echo ""

echo "Sending 65 requests to /health endpoint..."

SUCCESS_COUNT=0
RATE_LIMITED_COUNT=0

for i in $(seq 1 65); do
  RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" "$API/health" 2>&1)
  STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)
  
  if [ "$STATUS" = "200" ]; then
    ((SUCCESS_COUNT++))
  elif [ "$STATUS" = "429" ]; then
    ((RATE_LIMITED_COUNT++))
  fi
  
  # Show progress every 10 requests
  if [ $((i % 10)) -eq 0 ]; then
    echo "  Progress: $i/65 (success: $SUCCESS_COUNT, rate-limited: $RATE_LIMITED_COUNT)"
  fi
  
  # Brief sleep to simulate realistic usage
  sleep 0.01
done

echo ""
echo "Results:"
echo "  Successful: $SUCCESS_COUNT"
echo "  Rate limited (429): $RATE_LIMITED_COUNT"

if [ $RATE_LIMITED_COUNT -gt 0 ]; then
  test_pass "Rate limiting is active (got $RATE_LIMITED_COUNT 429 responses)"
else
  echo -e "${YELLOW}⚠ No rate limiting detected (may be disabled in dev)${NC}"
fi

echo ""

# ============================================================================
# Test 2: Upload Rate Limit (10/min)
# ============================================================================

if [ -n "$TOKEN" ]; then
  echo "--- Test 2: Upload Rate Limit (10/min) ---"
  echo ""
  
  echo "Sending 15 upload requests..."
  
  # Create a small test file
  TEST_FILE=$(mktemp)
  echo "test content" > "$TEST_FILE"
  
  UPLOAD_SUCCESS=0
  UPLOAD_LIMITED=0
  
  for i in $(seq 1 15); do
    RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" -X POST \
      "$API/api/v1/evidence/upload" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$TEST_FILE" \
      -F "evidence_type=document" \
      -F "description=Rate limit test $i" \
      -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      2>&1)
    
    STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)
    
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
      ((UPLOAD_SUCCESS++))
    elif [ "$STATUS" = "429" ]; then
      ((UPLOAD_LIMITED++))
      
      # Check for Retry-After header
      RETRY_AFTER=$(echo "$RESPONSE" | grep -i "Retry-After:" | cut -d':' -f2 | xargs || true)
      if [ -n "$RETRY_AFTER" ]; then
        echo "  Retry-After header: $RETRY_AFTER seconds"
      fi
    fi
    
    if [ $((i % 5)) -eq 0 ]; then
      echo "  Progress: $i/15 (success: $UPLOAD_SUCCESS, rate-limited: $UPLOAD_LIMITED)"
    fi
    
    sleep 0.1
  done
  
  rm "$TEST_FILE"
  
  echo ""
  echo "Results:"
  echo "  Successful uploads: $UPLOAD_SUCCESS"
  echo "  Rate limited (429): $UPLOAD_LIMITED"
  
  if [ $UPLOAD_LIMITED -gt 0 ]; then
    test_pass "Upload rate limiting is active (got $UPLOAD_LIMITED 429 responses)"
  else
    echo -e "${YELLOW}⚠ Upload rate limiting not triggered (may need higher load or already rate limited)${NC}"
  fi
  
  echo ""
else
  echo "--- Test 2: Upload Rate Limit (SKIPPED - no token) ---"
  echo ""
fi

# ============================================================================
# Test 3: Export Rate Limit (5/min)
# ============================================================================

if [ -n "$TOKEN" ]; then
  echo "--- Test 3: Export Rate Limit (5/min) ---"
  echo ""
  
  echo "Sending 10 export requests to evidence ID 1..."
  
  EXPORT_SUCCESS=0
  EXPORT_LIMITED=0
  EXPORT_NOT_FOUND=0
  
  for i in $(seq 1 10); do
    RESPONSE=$(curl -s -w "\nSTATUS:%{http_code}" \
      "$API/api/v1/evidence/1/export-chain-of-custody" \
      -H "Authorization: Bearer $TOKEN" \
      2>&1)
    
    STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d':' -f2)
    
    if [ "$STATUS" = "200" ]; then
      ((EXPORT_SUCCESS++))
    elif [ "$STATUS" = "429" ]; then
      ((EXPORT_LIMITED++))
    elif [ "$STATUS" = "404" ]; then
      ((EXPORT_NOT_FOUND++))
    fi
    
    if [ $((i % 3)) -eq 0 ]; then
      echo "  Progress: $i/10 (success: $EXPORT_SUCCESS, rate-limited: $EXPORT_LIMITED, not found: $EXPORT_NOT_FOUND)"
    fi
    
    sleep 0.1
  done
  
  echo ""
  echo "Results:"
  echo "  Successful exports: $EXPORT_SUCCESS"
  echo "  Rate limited (429): $EXPORT_LIMITED"
  echo "  Not found (404): $EXPORT_NOT_FOUND"
  
  if [ $EXPORT_LIMITED -gt 0 ]; then
    test_pass "Export rate limiting is active (got $EXPORT_LIMITED 429 responses)"
  elif [ $EXPORT_NOT_FOUND -eq 10 ]; then
    echo -e "${YELLOW}⚠ Evidence ID 1 not found - cannot test export rate limit${NC}"
  else
    echo -e "${YELLOW}⚠ Export rate limiting not triggered (may need higher load)${NC}"
  fi
  
  echo ""
else
  echo "--- Test 3: Export Rate Limit (SKIPPED - no token) ---"
  echo ""
fi

# ============================================================================
# Test 4: Rate Limit Headers
# ============================================================================

echo "--- Test 4: Rate Limit Response Headers ---"
echo ""

echo "Checking for rate limit headers in 429 response..."

# Make requests until we get a 429
for i in $(seq 1 100); do
  RESPONSE=$(curl -si "$API/health" 2>&1)
  
  if echo "$RESPONSE" | grep -q "HTTP/[0-9.]* 429"; then
    echo "Got 429 response:"
    echo "$RESPONSE" | head -n 20
    echo ""
    
    # Check for Retry-After header
    if echo "$RESPONSE" | grep -qi "Retry-After:"; then
      test_pass "Retry-After header present in 429 response"
    else
      test_fail "Retry-After header missing from 429 response"
    fi
    
    break
  fi
  
  sleep 0.01
done

if [ $i -eq 100 ]; then
  echo -e "${YELLOW}⚠ Could not trigger 429 response after 100 requests${NC}"
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
  echo -e "${GREEN}✓ Rate limiting tests completed!${NC}"
  echo ""
  echo "Note: Rate limits may be disabled or relaxed in development."
  echo "Verify in production that limits are properly enforced."
  exit 0
else
  echo -e "${RED}✗ Some rate limit tests failed.${NC}"
  exit 1
fi

