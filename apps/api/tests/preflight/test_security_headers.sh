#!/bin/bash
#
# Security Headers & CSP Verification Script
#
# Tests that all required security headers are present and correctly configured
# in the production environment.
#
# Usage:
#   ./test_security_headers.sh https://shomer.app

set -e

URL="${1:-https://shomer.app}"

echo "====================================="
echo "Security Headers Verification"
echo "====================================="
echo "Testing: $URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

check_header() {
  local name="$1"
  local expected="$2"
  local response="$3"
  
  echo -n "Checking $name... "
  
  if echo "$response" | grep -qi "^$name:"; then
    actual=$(echo "$response" | grep -i "^$name:" | cut -d':' -f2- | xargs)
    
    if [ -z "$expected" ]; then
      # Just check presence
      echo -e "${GREEN}✓ Present${NC}"
      echo "  Value: $actual"
      ((PASSED++))
    elif echo "$actual" | grep -q "$expected"; then
      echo -e "${GREEN}✓ Pass${NC}"
      echo "  Value: $actual"
      ((PASSED++))
    else
      echo -e "${RED}✗ Fail${NC}"
      echo "  Expected: $expected"
      echo "  Got: $actual"
      ((FAILED++))
    fi
  else
    echo -e "${RED}✗ Missing${NC}"
    [ -n "$expected" ] && echo "  Expected: $expected"
    ((FAILED++))
  fi
  echo ""
}

# Fetch headers
echo "Fetching headers from $URL..."
RESPONSE=$(curl -sI "$URL" 2>&1)

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to connect to $URL${NC}"
  exit 1
fi

echo -e "${GREEN}Connected successfully${NC}"
echo ""

# ============================================================================
# Required Security Headers
# ============================================================================

echo "--- Required Security Headers ---"
echo ""

# Strict-Transport-Security (HSTS)
check_header "Strict-Transport-Security" "max-age=31536000.*includeSubDomains" "$RESPONSE"

# X-Content-Type-Options
check_header "X-Content-Type-Options" "nosniff" "$RESPONSE"

# X-Frame-Options
check_header "X-Frame-Options" "SAMEORIGIN\|DENY" "$RESPONSE"

# X-XSS-Protection
check_header "X-XSS-Protection" "1; mode=block" "$RESPONSE"

# Content-Security-Policy
check_header "Content-Security-Policy" "default-src 'self'" "$RESPONSE"

# Referrer-Policy
check_header "Referrer-Policy" "" "$RESPONSE"

echo "--- Connection Security ---"
echo ""

# Check for HTTPS
if echo "$URL" | grep -q "^https://"; then
  echo -e "${GREEN}✓ HTTPS enabled${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ HTTPS not enabled${NC}"
  ((FAILED++))
fi
echo ""

# Check for HTTP/2
if echo "$RESPONSE" | grep -q "HTTP/2"; then
  echo -e "${GREEN}✓ HTTP/2 enabled${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ HTTP/2 not detected${NC}"
fi
echo ""

# ============================================================================
# CSP Deep Check
# ============================================================================

echo "--- Content Security Policy Details ---"
echo ""

CSP=$(echo "$RESPONSE" | grep -i "^Content-Security-Policy:" | cut -d':' -f2- | xargs)

if [ -n "$CSP" ]; then
  echo "Full CSP:"
  echo "$CSP"
  echo ""
  
  # Check specific directives
  echo "CSP Directives:"
  
  if echo "$CSP" | grep -q "default-src 'self'"; then
    echo -e "  ${GREEN}✓${NC} default-src 'self' - Good"
  else
    echo -e "  ${RED}✗${NC} default-src should be 'self'"
  fi
  
  if echo "$CSP" | grep -q "frame-ancestors 'none'\|frame-ancestors 'self'"; then
    echo -e "  ${GREEN}✓${NC} frame-ancestors protected - Good"
  else
    echo -e "  ${YELLOW}⚠${NC} frame-ancestors not set (clickjacking risk)"
  fi
  
  if echo "$CSP" | grep -q "upgrade-insecure-requests"; then
    echo -e "  ${GREEN}✓${NC} upgrade-insecure-requests - Good"
  else
    echo -e "  ${YELLOW}⚠${NC} Consider adding upgrade-insecure-requests"
  fi
  
  # Check for unsafe directives
  if echo "$CSP" | grep -q "unsafe-inline\|unsafe-eval"; then
    echo -e "  ${YELLOW}⚠${NC} Warning: 'unsafe-inline' or 'unsafe-eval' detected"
    echo "    Consider using nonces or hashes instead"
  fi
else
  echo -e "${RED}✗ No Content-Security-Policy header found${NC}"
fi

echo ""

# ============================================================================
# Mixed Content Check
# ============================================================================

echo "--- Mixed Content Check ---"
echo ""

echo "Checking for mixed content (HTTP resources on HTTPS page)..."

# Fetch page content
PAGE_CONTENT=$(curl -sL "$URL" 2>&1)

MIXED_HTTP=$(echo "$PAGE_CONTENT" | grep -oP '(src|href)=["'\'']http://[^"'\'']*' || true)

if [ -n "$MIXED_HTTP" ]; then
  echo -e "${RED}✗ Mixed content detected:${NC}"
  echo "$MIXED_HTTP" | head -n 5
  ((FAILED++))
else
  echo -e "${GREEN}✓ No mixed content detected${NC}"
  ((PASSED++))
fi

echo ""

# ============================================================================
# Cookie Security Check
# ============================================================================

echo "--- Cookie Security ---"
echo ""

# Make a request that might set cookies
COOKIES=$(curl -sI "$URL" | grep -i "^Set-Cookie:" || true)

if [ -n "$COOKIES" ]; then
  echo "Cookies found:"
  echo "$COOKIES"
  echo ""
  
  # Check for HttpOnly
  if echo "$COOKIES" | grep -qi "HttpOnly"; then
    echo -e "  ${GREEN}✓${NC} HttpOnly flag present"
  else
    echo -e "  ${RED}✗${NC} HttpOnly flag missing (XSS risk)"
  fi
  
  # Check for Secure
  if echo "$COOKIES" | grep -qi "Secure"; then
    echo -e "  ${GREEN}✓${NC} Secure flag present"
  else
    echo -e "  ${RED}✗${NC} Secure flag missing (MITM risk)"
  fi
  
  # Check for SameSite
  if echo "$COOKIES" | grep -qi "SameSite="; then
    SAMESITE=$(echo "$COOKIES" | grep -oi "SameSite=[^;]*" | head -n1)
    echo -e "  ${GREEN}✓${NC} SameSite: $SAMESITE"
  else
    echo -e "  ${YELLOW}⚠${NC} SameSite not set (CSRF risk)"
  fi
else
  echo "No cookies set on homepage"
  echo "(This is normal if cookies are only set after login)"
fi

echo ""

# ============================================================================
# TLS/SSL Check
# ============================================================================

echo "--- TLS/SSL Configuration ---"
echo ""

if echo "$URL" | grep -q "^https://"; then
  DOMAIN=$(echo "$URL" | sed 's|https://||' | sed 's|/.*||')
  
  echo "Checking TLS for $DOMAIN..."
  
  # Check TLS version
  TLS_VERSION=$(echo | openssl s_client -connect "$DOMAIN:443" 2>/dev/null | grep "Protocol" || echo "Unknown")
  echo "$TLS_VERSION"
  
  if echo "$TLS_VERSION" | grep -q "TLSv1.3\|TLSv1.2"; then
    echo -e "${GREEN}✓ TLS version acceptable${NC}"
  else
    echo -e "${RED}✗ Outdated TLS version${NC}"
  fi
  
  # Check certificate
  CERT_EXPIRY=$(echo | openssl s_client -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate || echo "Unknown")
  echo "$CERT_EXPIRY"
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
  echo -e "${GREEN}✓ All security header checks passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some security checks failed. Review and fix issues.${NC}"
  exit 1
fi

