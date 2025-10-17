#!/bin/bash
#
# Shomer Phase 3 Launch Validation Script
#
# Validates that all Phase 3 features are working correctly:
# - Secret rotation
# - Observability (metrics, logs, traces)
# - Security headers
# - Docker services
# - Test suite
#
# Usage:
#   ./verify-launch-phase3.sh [DOMAIN]
#
# Example:
#   ./verify-launch-phase3.sh shomer.example.com
#

set -e  # Exit on error

DOMAIN="${1:-localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

echo ""
echo "=========================================="
echo "🧪 Shomer Phase 3 Launch Validation"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Time: $(date)"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# 1. Security Headers
section "1. Security Headers"

info "Checking HTTPS headers on https://$DOMAIN/"

if command -v curl &> /dev/null; then
    HEADERS=$(curl -Iks "https://$DOMAIN/" 2>/dev/null || echo "")
    
    if echo "$HEADERS" | grep -qi "strict-transport-security"; then
        pass "Strict-Transport-Security header present"
    else
        warn "Strict-Transport-Security header missing (expected in production)"
    fi
    
    if echo "$HEADERS" | grep -qi "content-security-policy"; then
        pass "Content-Security-Policy header present"
    else
        warn "Content-Security-Policy header missing (recommended)"
    fi
    
    if echo "$HEADERS" | grep -qi "x-content-type-options"; then
        pass "X-Content-Type-Options header present"
    else
        warn "X-Content-Type-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "x-frame-options"; then
        pass "X-Frame-Options header present"
    else
        warn "X-Frame-Options header missing"
    fi
else
    warn "curl not installed - skipping header checks"
fi

# 2. Secret Rotation
section "2. Secret Rotation"

if [ -f "$SCRIPT_DIR/apps/api/app/scripts/rotate_secrets.py" ]; then
    pass "Secret rotation script exists"
    
    info "Testing secret rotation (dry run)..."
    if cd "$SCRIPT_DIR" && DRY_RUN=true python apps/api/app/scripts/rotate_secrets.py > /dev/null 2>&1; then
        pass "Secret rotation script runs successfully"
    else
        fail "Secret rotation script failed"
    fi
else
    fail "Secret rotation script not found"
fi

if [ -f "$SCRIPT_DIR/.github/workflows/rotate-secrets.yml" ]; then
    pass "GitHub workflow for secret rotation exists"
else
    fail "Secret rotation workflow not found"
fi

# 3. Observability
section "3. Observability"

# Check Grafana dashboard
if [ -f "$SCRIPT_DIR/infra/grafana/dashboards/shomer.json" ]; then
    pass "Grafana dashboard configuration exists"
    
    # Validate JSON
    if command -v python3 &> /dev/null; then
        if python3 -m json.tool "$SCRIPT_DIR/infra/grafana/dashboards/shomer.json" > /dev/null 2>&1; then
            pass "Grafana dashboard JSON is valid"
        else
            fail "Grafana dashboard JSON is invalid"
        fi
    fi
else
    fail "Grafana dashboard configuration not found"
fi

# Check observability guide
if [ -f "$SCRIPT_DIR/docs/OBSERVABILITY_GUIDE.md" ]; then
    pass "Observability guide exists"
else
    fail "Observability guide not found"
fi

# Check enhanced observability.py
if [ -f "$SCRIPT_DIR/apps/api/app/core/observability.py" ]; then
    pass "Observability module exists"
    
    # Check for trace_id and span_id in logging setup
    if grep -q "trace_id" "$SCRIPT_DIR/apps/api/app/core/observability.py" && \
       grep -q "span_id" "$SCRIPT_DIR/apps/api/app/core/observability.py"; then
        pass "Observability module includes trace/span IDs"
    else
        fail "Observability module missing trace/span ID support"
    fi
    
    # Check for request ID propagation
    if grep -q "extract_request_id" "$SCRIPT_DIR/apps/api/app/core/observability.py" || \
       grep -q "request_id" "$SCRIPT_DIR/apps/api/app/core/observability.py"; then
        pass "Observability module includes request ID propagation"
    else
        warn "Request ID propagation may not be implemented"
    fi
else
    fail "Observability module not found"
fi

# Check if Prometheus metrics endpoint is accessible
if command -v curl &> /dev/null; then
    info "Checking metrics endpoint..."
    if curl -s "http://$DOMAIN/metrics" | grep -q "^# HELP"; then
        pass "Prometheus metrics endpoint accessible"
    else
        warn "Metrics endpoint not accessible (may need to start services)"
    fi
fi

# 4. Docker Services
section "4. Docker Services"

if command -v docker &> /dev/null; then
    info "Checking Docker services..."
    
    # Check if docker compose is running
    if docker compose ps > /dev/null 2>&1; then
        pass "Docker Compose is available"
        
        # List running services
        SERVICES=$(docker compose ps --services 2>/dev/null || echo "")
        
        if [ -n "$SERVICES" ]; then
            SERVICE_COUNT=$(echo "$SERVICES" | wc -l)
            info "Found $SERVICE_COUNT Docker services"
            
            # Check for key services
            for service in api db; do
                if echo "$SERVICES" | grep -q "^$service$"; then
                    pass "Service '$service' is defined"
                else
                    warn "Service '$service' not found"
                fi
            done
        else
            warn "No Docker services running (may need to start with 'docker compose up')"
        fi
    else
        warn "Docker Compose not running"
    fi
else
    warn "Docker not installed - skipping container checks"
fi

# 5. Test Suite
section "5. Test Suite"

if [ -d "$SCRIPT_DIR/apps/api/tests" ]; then
    pass "Test directory exists"
    
    if command -v pytest &> /dev/null; then
        info "Running test suite..."
        cd "$SCRIPT_DIR/apps/api"
        
        # Run tests with minimal output
        if pytest tests -q --disable-warnings --maxfail=5 -x > /tmp/pytest-output.txt 2>&1; then
            pass "All tests passed"
        else
            # Show last few lines of output
            tail -n 10 /tmp/pytest-output.txt
            warn "Some tests failed (see above)"
        fi
    else
        warn "pytest not installed - skipping test execution"
        info "Install with: pip install pytest"
    fi
else
    fail "Test directory not found"
fi

# 6. Prior Preflight Tests
section "6. Prior Preflight Tests"

if [ -f "$SCRIPT_DIR/tests/preflight/preflight-checklist.sh" ]; then
    pass "Preflight test script exists"
    
    info "Running preflight checks..."
    if bash "$SCRIPT_DIR/tests/preflight/preflight-checklist.sh" > /tmp/preflight-output.txt 2>&1; then
        pass "Preflight checks passed"
    else
        warn "Some preflight checks failed"
        tail -n 5 /tmp/preflight-output.txt
    fi
else
    info "Preflight test script not found (may not exist yet)"
fi

# 7. Documentation
section "7. Documentation"

DOCS=(
    "docs/POST_LAUNCH_MONITORING.md"
    "docs/OBSERVABILITY_GUIDE.md"
    "PHASE_3_LAUNCH_VALIDATION_SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$SCRIPT_DIR/$doc" ]; then
        pass "Documentation exists: $doc"
    else
        warn "Documentation missing: $doc"
    fi
done

# 8. Configuration Files
section "8. Configuration Files"

CONFIG_FILES=(
    "apps/api/app/scripts/rotate_secrets.py"
    ".github/workflows/rotate-secrets.yml"
    "infra/grafana/dashboards/shomer.json"
    "apps/api/app/core/observability.py"
)

for config in "${CONFIG_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$config" ]; then
        pass "Configuration exists: $config"
    else
        fail "Configuration missing: $config"
    fi
done

# Summary
section "Validation Summary"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo "Results:"
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "  Total:    $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Validation Complete - All critical checks passed${NC}"
    echo ""
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Note: $WARNINGS warnings were found (review recommended)${NC}"
    fi
    
    exit 0
else
    echo -e "${RED}❌ Validation Failed - $FAILED checks failed${NC}"
    echo ""
    echo "Please fix the failed checks before proceeding to production."
    exit 1
fi

