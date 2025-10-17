#!/bin/bash
#
# Master Preflight Test Runner
#
# Runs all preflight tests in sequence and generates a comprehensive report.
#
# Usage:
#   export API="https://shomer.app"
#   export DATABASE_URL="postgresql://..."
#   export ADMIN_TOKEN="admin-jwt"
#   export MOD_TOKEN="mod-jwt"
#   export VIEWER_TOKEN="viewer-jwt"
#   ./run_all_preflight.sh

set -e

API="${API:-http://localhost:8000}"

echo "=============================================="
echo "  Shomer Pre-Flight Test Suite"
echo "=============================================="
echo ""
echo "API: $API"
echo "Started: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_PASSED=0
TOTAL_FAILED=0
TEST_RESULTS=()

run_test() {
  local test_name="$1"
  local test_script="$2"
  
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Running: $test_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  if [ ! -f "$test_script" ]; then
    echo -e "${RED}✗ Test script not found: $test_script${NC}"
    TEST_RESULTS+=("$test_name: SKIP (script not found)")
    return
  fi
  
  # Make executable
  chmod +x "$test_script" 2>/dev/null || true
  
  # Run test and capture result
  if bash "$test_script" 2>&1; then
    echo -e "${GREEN}✓ $test_name PASSED${NC}"
    TEST_RESULTS+=("$test_name: PASS")
    ((TOTAL_PASSED++))
  else
    echo -e "${RED}✗ $test_name FAILED${NC}"
    TEST_RESULTS+=("$test_name: FAIL")
    ((TOTAL_FAILED++))
  fi
}

# ============================================================================
# Run All Tests
# ============================================================================

# Test 1: Security Headers
run_test "Security Headers & CSP" "./test_security_headers.sh"

# Test 2: Authentication & CSRF
if [ -n "$ADMIN_TOKEN" ]; then
  export TOKEN="$ADMIN_TOKEN"
  run_test "Authentication & CSRF" "./test_auth_csrf.sh"
else
  echo -e "${YELLOW}⚠ Skipping Auth/CSRF tests (no ADMIN_TOKEN)${NC}"
  TEST_RESULTS+=("Authentication & CSRF: SKIP (no token)")
fi

# Test 3: RBAC
if [ -n "$ADMIN_TOKEN" ] && [ -n "$MOD_TOKEN" ] && [ -n "$VIEWER_TOKEN" ]; then
  run_test "RBAC & Permissions" "./test_rbac.sh"
else
  echo -e "${YELLOW}⚠ Skipping RBAC tests (tokens not provided)${NC}"
  TEST_RESULTS+=("RBAC & Permissions: SKIP (no tokens)")
fi

# Test 4: Rate Limiting
if [ -n "$ADMIN_TOKEN" ]; then
  export TOKEN="$ADMIN_TOKEN"
  run_test "Rate Limiting" "./test_rate_limits.sh"
else
  echo -e "${YELLOW}⚠ Skipping rate limit tests (no token)${NC}"
  TEST_RESULTS+=("Rate Limiting: SKIP (no token)")
fi

# Test 5: Database Immutability
if [ -n "$DATABASE_URL" ]; then
  run_test "Database Immutability" "./test_immutability.sh"
else
  echo -e "${YELLOW}⚠ Skipping immutability tests (no DATABASE_URL)${NC}"
  TEST_RESULTS+=("Database Immutability: SKIP (no database)")
fi

# Test 6: PDF Determinism
if [ -n "$ADMIN_TOKEN" ]; then
  export TOKEN="$ADMIN_TOKEN"
  run_test "PDF Export Determinism" "./test_pdf_determinism.sh"
else
  echo -e "${YELLOW}⚠ Skipping PDF tests (no token)${NC}"
  TEST_RESULTS+=("PDF Export Determinism: SKIP (no token)")
fi

# Test 7: EXIF Stripping
if [ -n "$ADMIN_TOKEN" ]; then
  export TOKEN="$ADMIN_TOKEN"
  run_test "EXIF Metadata Stripping" "./test_exif_stripping.sh"
else
  echo -e "${YELLOW}⚠ Skipping EXIF tests (no token)${NC}"
  TEST_RESULTS+=("EXIF Metadata Stripping: SKIP (no token)")
fi

# ============================================================================
# Generate Report
# ============================================================================

echo ""
echo "=============================================="
echo "  Pre-Flight Test Summary"
echo "=============================================="
echo ""

for result in "${TEST_RESULTS[@]}"; do
  if echo "$result" | grep -q "PASS"; then
    echo -e "${GREEN}✓${NC} $result"
  elif echo "$result" | grep -q "FAIL"; then
    echo -e "${RED}✗${NC} $result"
  else
    echo -e "${YELLOW}⊘${NC} $result"
  fi
done

echo ""
echo "=============================================="
echo "Passed: ${GREEN}$TOTAL_PASSED${NC}"
echo "Failed: ${RED}$TOTAL_FAILED${NC}"
echo "Completed: $(date)"
echo "=============================================="
echo ""

# Generate HTML report (optional)
if command -v python3 &> /dev/null; then
  echo "Generating HTML report..."
  
  python3 << 'EOFPYTHON'
import json
import os
from datetime import datetime

results = []
for result in """${TEST_RESULTS[@]}""".split("\n"):
    if ":" in result:
        name, status = result.split(":", 1)
        results.append({"name": name.strip(), "status": status.strip()})

html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Shomer Pre-Flight Test Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        h1 {{ color: #1e40af; }}
        table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #1e40af; color: white; }}
        .pass {{ color: #10b981; font-weight: bold; }}
        .fail {{ color: #ef4444; font-weight: bold; }}
        .skip {{ color: #f59e0b; font-weight: bold; }}
        .summary {{ margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px; }}
    </style>
</head>
<body>
    <h1>Shomer Pre-Flight Test Report</h1>
    <p><strong>Generated:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
    <p><strong>API:</strong> {os.getenv("API", "N/A")}</p>
    
    <table>
        <tr>
            <th>Test Name</th>
            <th>Status</th>
        </tr>
"""

for r in results:
    status_class = "pass" if "PASS" in r["status"] else "fail" if "FAIL" in r["status"] else "skip"
    html += f"""
        <tr>
            <td>{r["name"]}</td>
            <td class="{status_class}">{r["status"]}</td>
        </tr>
    """

html += f"""
    </table>
    
    <div class="summary">
        <h2>Summary</h2>
        <p class="pass">Passed: {os.getenv("TOTAL_PASSED", "0")}</p>
        <p class="fail">Failed: {os.getenv("TOTAL_FAILED", "0")}</p>
    </div>
</body>
</html>
"""

with open("preflight-report.html", "w") as f:
    f.write(html)

print("HTML report saved to: preflight-report.html")
EOFPYTHON

fi

# Exit with appropriate code
if [ $TOTAL_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All pre-flight tests passed!${NC}"
  echo ""
  echo "System is ready for go-live."
  exit 0
else
  echo -e "${RED}✗ Some pre-flight tests failed.${NC}"
  echo ""
  echo "Please review failures and fix before going live."
  exit 1
fi

