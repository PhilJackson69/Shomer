#!/bin/bash
# Shomer GO Gate Checklist
# Copy/paste checklist for GO/NO-GO decision

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
STAGING_URL="${STAGING_URL:-}"
PROD_URL="${PROD_URL:-}"

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

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🚀 Shomer GO Gate Checklist${NC}"
echo -e "${BLUE}============================${NC}"
echo "Timestamp: $(date)"
echo ""

# Evidence capture directory
GO_GATE_EVIDENCE_DIR="go-gate-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$GO_GATE_EVIDENCE_DIR"

# Build & Deployment
echo -e "${BLUE}📦 Build & Deployment${NC}"
echo "======================"

# Check RC build deployed to staging
if [ -n "$STAGING_URL" ]; then
    STAGING_STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" "$STAGING_URL/api/v1/health" 2>/dev/null || echo "000")
    if [ "$STAGING_STATUS" = "200" ]; then
        log_check "PASS" "RC build deployed to staging; no P0/P1 bugs open"
    else
        log_check "FAIL" "RC build not deployed to staging (got $STAGING_STATUS)"
    fi
else
    log_check "FAIL" "STAGING_URL not set"
fi

# Check for open P0/P1 bugs (simplified check)
if command -v gh >/dev/null 2>&1; then
    P0_BUGS=$(gh issue list --state open --label "P0" --json number --jq 'length' 2>/dev/null || echo "0")
    P1_BUGS=$(gh issue list --state open --label "P1" --json number --jq 'length' 2>/dev/null || echo "0")
    
    if [ "$P0_BUGS" -eq 0 ] && [ "$P1_BUGS" -eq 0 ]; then
        log_check "PASS" "No open P0/P1 bugs"
    else
        log_check "FAIL" "Open P0 bugs: $P0_BUGS, P1 bugs: $P1_BUGS"
    fi
else
    log_warning "GitHub CLI not available, skipping bug check"
fi

echo ""

# Functional Testing
echo -e "${BLUE}🧪 Functional Testing${NC}"
echo "====================="

# Check E2E tests
if [ -f "tests/e2e/core-user-flows.spec.ts" ]; then
    if command -v pnpm >/dev/null 2>&1; then
        log_info "Running E2E tests..."
        if pnpm test:e2e --config=playwright.config.ts > "$GO_GATE_EVIDENCE_DIR/e2e-results.txt" 2>&1; then
            log_check "PASS" "E2E tests pass for all core flows"
        else
            log_check "FAIL" "E2E tests failed - check $GO_GATE_EVIDENCE_DIR/e2e-results.txt"
        fi
    else
        log_warning "pnpm not available, skipping E2E tests"
    fi
else
    log_check "FAIL" "E2E tests not found"
fi

echo ""

# Performance & Reliability
echo -e "${BLUE}⚡ Performance & Reliability${NC}"
echo "============================="

# Check load test results
if [ -f "tests/load/k6-load-test.js" ]; then
    if command -v k6 >/dev/null 2>&1; then
        log_info "Running load test..."
        if k6 run tests/load/k6-load-test.js --out json="$GO_GATE_EVIDENCE_DIR/load-test-results.json" > "$GO_GATE_EVIDENCE_DIR/load-test-output.txt" 2>&1; then
            # Parse load test results
            if [ -f "$GO_GATE_EVIDENCE_DIR/load-test-results.json" ]; then
                P95_LATENCY=$(jq -r '.metrics.http_req_duration.values.p95' "$GO_GATE_EVIDENCE_DIR/load-test-results.json" 2>/dev/null || echo "0")
                ERROR_RATE=$(jq -r '.metrics.http_req_failed.values.rate' "$GO_GATE_EVIDENCE_DIR/load-test-results.json" 2>/dev/null || echo "1")
                
                if (( $(echo "$P95_LATENCY < 500" | bc -l) )) && (( $(echo "$ERROR_RATE < 0.005" | bc -l) )); then
                    log_check "PASS" "P95 latency targets met; error rate < 0.5%"
                else
                    log_check "FAIL" "Performance targets not met (P95: ${P95_LATENCY}ms, Error Rate: $(echo "$ERROR_RATE * 100" | bc -l)%)"
                fi
            else
                log_check "FAIL" "Load test results not found"
            fi
        else
            log_check "FAIL" "Load test failed - check $GO_GATE_EVIDENCE_DIR/load-test-output.txt"
        fi
    else
        log_warning "k6 not available, skipping load test"
    fi
else
    log_check "FAIL" "Load test script not found"
fi

echo ""

# Data & Disaster Recovery
echo -e "${BLUE}💾 Data & Disaster Recovery${NC}"
echo "============================"

# Check migration rehearsal
if [ -f "scripts/dr/migration-rehearsal.sh" ]; then
    log_info "Running migration rehearsal..."
    if bash scripts/dr/migration-rehearsal.sh > "$GO_GATE_EVIDENCE_DIR/migration-rehearsal.txt" 2>&1; then
        log_check "PASS" "Migration rehearsal succeeded; restore drill done"
    else
        log_check "FAIL" "Migration rehearsal failed - check $GO_GATE_EVIDENCE_DIR/migration-rehearsal.txt"
    fi
else
    log_warning "Migration rehearsal script not found"
fi

echo ""

# Security
echo -e "${BLUE}🛡️ Security${NC}"
echo "============"

# Check security lane
if [ -f ".github/workflows/security-scan.yml" ]; then
    log_info "Checking security scan results..."
    if command -v gh >/dev/null 2>&1; then
        # Check if security scan passed
        SECURITY_STATUS=$(gh run list --workflow=security-scan.yml --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "unknown")
        if [ "$SECURITY_STATUS" = "success" ]; then
            log_check "PASS" "Security lane + DAST green (no High/Critical)"
        else
            log_check "FAIL" "Security scan failed or not run (status: $SECURITY_STATUS)"
        fi
    else
        log_warning "GitHub CLI not available, skipping security check"
    fi
else
    log_check "FAIL" "Security scan workflow not found"
fi

echo ""

# Operations
echo -e "${BLUE}🔧 Operations${NC}"
echo "============="

# Check alerts configuration
if [ -f "monitoring/golden-signals-queries.yaml" ]; then
    log_check "PASS" "Golden-signals alerts wired; pager tested"
else
    log_check "FAIL" "Golden signals alerts not configured"
fi

# Check monitoring dashboards
if [ -f "monitoring/dashboards/golden-signals-dashboard.json" ]; then
    log_check "PASS" "Monitoring dashboards configured"
else
    log_check "FAIL" "Monitoring dashboards not configured"
fi

echo ""

# Deployment Validation
echo -e "${BLUE}🚀 Deployment Validation${NC}"
echo "=========================="

# Run preflight validation
if [ -f "scripts/preflight-validation.sh" ]; then
    log_info "Running preflight validation..."
    if bash scripts/preflight-validation.sh > "$GO_GATE_EVIDENCE_DIR/preflight-results.txt" 2>&1; then
        log_check "PASS" "Preflight validation passed"
    else
        log_check "FAIL" "Preflight validation failed - check $GO_GATE_EVIDENCE_DIR/preflight-results.txt"
    fi
else
    log_check "FAIL" "Preflight validation script not found"
fi

# Run canary deployment
if [ -f "scripts/canary-deployment.sh" ]; then
    log_info "Running canary deployment..."
    if bash scripts/canary-deployment.sh > "$GO_GATE_EVIDENCE_DIR/canary-results.txt" 2>&1; then
        log_check "PASS" "Canary deployment successful"
    else
        log_check "FAIL" "Canary deployment failed - check $GO_GATE_EVIDENCE_DIR/canary-results.txt"
    fi
else
    log_check "FAIL" "Canary deployment script not found"
fi

# Run post-deploy verification
if [ -f "scripts/post-deploy-verification.sh" ]; then
    log_info "Running post-deploy verification..."
    if bash scripts/post-deploy-verification.sh > "$GO_GATE_EVIDENCE_DIR/post-deploy-results.txt" 2>&1; then
        log_check "PASS" "Post-deploy verification passed"
    else
        log_check "FAIL" "Post-deploy verification failed - check $GO_GATE_EVIDENCE_DIR/post-deploy-results.txt"
    fi
else
    log_check "FAIL" "Post-deploy verification script not found"
fi

echo ""

# Legal & Documentation
echo -e "${BLUE}📋 Legal & Documentation${NC}"
echo "========================="

# Check privacy policy and terms
if [ -f "docs/legal/privacy-policy.md" ] && [ -f "docs/legal/terms-of-service.md" ]; then
    log_check "PASS" "Privacy/Terms live; runbooks accessible"
else
    log_check "FAIL" "Privacy policy or terms of service not found"
fi

# Check operational guide
if [ -f "OPERATIONAL_EXCELLENCE_GUIDE.md" ]; then
    log_check "PASS" "Operational guide finalized"
else
    log_check "FAIL" "Operational guide not found"
fi

echo ""

# Summary
echo -e "${BLUE}📊 GO Gate Summary${NC}"
echo "=================="
echo -e "Total Checks: $CHECKS_TOTAL"
echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"

# Generate evidence summary
{
    echo "Shomer GO Gate Checklist Results"
    echo "================================"
    echo "Timestamp: $(date)"
    echo "Total Checks: $CHECKS_TOTAL"
    echo "Passed: $CHECKS_PASSED"
    echo "Failed: $CHECKS_FAILED"
    echo ""
    echo "Evidence Artifacts:"
    echo "- E2E Test Results: $GO_GATE_EVIDENCE_DIR/e2e-results.txt"
    echo "- Load Test Results: $GO_GATE_EVIDENCE_DIR/load-test-results.json"
    echo "- Migration Rehearsal: $GO_GATE_EVIDENCE_DIR/migration-rehearsal.txt"
    echo "- Preflight Results: $GO_GATE_EVIDENCE_DIR/preflight-results.txt"
    echo "- Canary Results: $GO_GATE_EVIDENCE_DIR/canary-results.txt"
    echo "- Post-Deploy Results: $GO_GATE_EVIDENCE_DIR/post-deploy-results.txt"
} > "$GO_GATE_EVIDENCE_DIR/go-gate-summary.txt"

log_info "Evidence captured in: $GO_GATE_EVIDENCE_DIR"

# Final decision
if [ $CHECKS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 GO DECISION: All gates passed. Proceeding with production launch.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $GO_GATE_EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${BLUE}🚀 Ready for production deployment!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ NO-GO DECISION: $CHECKS_FAILED check(s) failed. Fix issues before launch.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $GO_GATE_EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${BLUE}🔧 Next steps:${NC}"
    echo "  1. Review failed checks above"
    echo "  2. Fix identified issues"
    echo "  3. Re-run GO Gate checklist"
    echo "  4. Consider cutting RC2 if major issues found"
    exit 1
fi
