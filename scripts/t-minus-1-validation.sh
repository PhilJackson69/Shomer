#!/bin/bash
# Shomer T-1 Launch Validation Script
# Final validation 1 hour before launch window

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
LAUNCH_WINDOW="${LAUNCH_WINDOW:-}"
LAUNCH_TEAM="${LAUNCH_TEAM:-}"

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
echo -e "${BLUE}🚀 Shomer T-1 Launch Validation${NC}"
echo -e "${BLUE}=================================${NC}"
echo "Launch Window: ${LAUNCH_WINDOW}"
echo "Launch Team: ${LAUNCH_TEAM}"
echo "Timestamp: $(date)"
echo ""

# Create evidence directory
EVIDENCE_DIR="releases/v1.0.0/t-minus-1-validation-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# 1) Preflight Validation Re-run
log_info "1) Re-running Preflight Validation"
echo "------------------------------------"

if [ -f "scripts/preflight-validation.sh" ]; then
    if bash scripts/preflight-validation.sh > "$EVIDENCE_DIR/preflight-results.txt" 2>&1; then
        log_check "PASS" "Preflight validation completed successfully"
    else
        log_check "FAIL" "Preflight validation failed - check $EVIDENCE_DIR/preflight-results.txt"
    fi
else
    log_check "FAIL" "Preflight validation script not found"
fi

echo ""

# 2) Canary Deployment Test
log_info "2) Canary Deployment Test"
echo "---------------------------"

if [ -f "scripts/canary-deployment.sh" ]; then
    # Set canary traffic to 1% for test
    export CANARY_TRAFFIC_PERCENT=1
    export MONITORING_DURATION=5
    
    if timeout 300 bash scripts/canary-deployment.sh > "$EVIDENCE_DIR/canary-results.txt" 2>&1; then
        log_check "PASS" "Canary deployment test completed successfully"
    else
        log_check "FAIL" "Canary deployment test failed - check $EVIDENCE_DIR/canary-results.txt"
    fi
else
    log_check "FAIL" "Canary deployment script not found"
fi

echo ""

# 3) Post-Deploy Verification Test
log_info "3) Post-Deploy Verification Test"
echo "-----------------------------------"

if [ -f "scripts/post-deploy-verification.sh" ]; then
    if bash scripts/post-deploy-verification.sh > "$EVIDENCE_DIR/post-deploy-results.txt" 2>&1; then
        log_check "PASS" "Post-deploy verification test completed successfully"
    else
        log_check "FAIL" "Post-deploy verification test failed - check $EVIDENCE_DIR/post-deploy-results.txt"
    fi
else
    log_check "FAIL" "Post-deploy verification script not found"
fi

echo ""

# 4) Launch Team Readiness Check
log_info "4) Launch Team Readiness Check"
echo "--------------------------------"

# Check if launch team is defined
if [ -n "$LAUNCH_TEAM" ]; then
    log_check "PASS" "Launch team assigned: $LAUNCH_TEAM"
else
    log_check "FAIL" "Launch team not assigned"
fi

# Check if launch window is defined
if [ -n "$LAUNCH_WINDOW" ]; then
    log_check "PASS" "Launch window scheduled: $LAUNCH_WINDOW"
else
    log_check "FAIL" "Launch window not scheduled"
fi

# Check if GO/NO-GO meeting is scheduled
if [ -f "releases/v1.0.0-rc1/GO_NO_GO_MEETING_AGENDA.md" ]; then
    log_check "PASS" "GO/NO-GO meeting agenda prepared"
else
    log_check "FAIL" "GO/NO-GO meeting agenda not prepared"
fi

echo ""

# 5) Monitoring Infrastructure Check
log_info "5) Monitoring Infrastructure Check"
echo "------------------------------------"

# Check if Prometheus is accessible
if curl -fsS "${PROMETHEUS_URL:-http://localhost:9090}/api/v1/query?query=up" > /dev/null 2>&1; then
    log_check "PASS" "Prometheus monitoring accessible"
else
    log_check "FAIL" "Prometheus monitoring not accessible"
fi

# Check if Grafana dashboard is accessible
if curl -fsS "${GRAFANA_URL:-http://localhost:3000}/api/health" > /dev/null 2>&1; then
    log_check "PASS" "Grafana dashboard accessible"
else
    log_check "FAIL" "Grafana dashboard not accessible"
fi

# Check if alerting is configured
if [ -f "monitoring/prometheus-alerts.yaml" ]; then
    log_check "PASS" "Prometheus alerts configured"
else
    log_check "FAIL" "Prometheus alerts not configured"
fi

echo ""

# 6) Rollback Readiness Check
log_info "6) Rollback Readiness Check"
echo "----------------------------"

# Check if rollback scripts exist
if [ -f "scripts/rollback.sh" ]; then
    log_check "PASS" "Rollback script available"
else
    log_check "WARN" "Rollback script not found - manual rollback may be required"
fi

# Check if previous version is tagged
if git tag -l | grep -q "v1.0.0-rc1"; then
    log_check "PASS" "Previous version tagged (v1.0.0-rc1)"
else
    log_check "FAIL" "Previous version not tagged"
fi

# Check if database migration rollback is available
if [ -f "apps/api/alembic/versions" ]; then
    MIGRATION_COUNT=$(find apps/api/alembic/versions -name "*.py" | wc -l)
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        log_check "PASS" "Database migrations available ($MIGRATION_COUNT migrations)"
    else
        log_check "WARN" "No database migrations found"
    fi
else
    log_check "WARN" "Database migration directory not found"
fi

echo ""

# 7) Security Hardening Check
log_info "7) Security Hardening Check"
echo "-----------------------------"

# Check if WAF rules are active
if [ -f "infra/waf-edge-rules.yaml" ]; then
    log_check "PASS" "WAF edge rules configured"
else
    log_check "FAIL" "WAF edge rules not configured"
fi

# Check if security monitoring is active
if [ -f "prometheus_rules_security_monitoring.yaml" ]; then
    log_check "PASS" "Security monitoring rules configured"
else
    log_check "FAIL" "Security monitoring rules not configured"
fi

# Check if secrets rotation is configured
if [ -n "${JWT_SECRET_ROTATION_INTERVAL:-}" ]; then
    log_check "PASS" "JWT secret rotation configured"
else
    log_check "WARN" "JWT secret rotation not configured"
fi

echo ""

# 8) Business Continuity Check
log_info "8) Business Continuity Check"
echo "------------------------------"

# Check if status page is ready
if [ -f "releases/v1.0.0-rc1/STATUS_PAGE_TEMPLATES.md" ]; then
    log_check "PASS" "Status page templates prepared"
else
    log_check "FAIL" "Status page templates not prepared"
fi

# Check if crisis communication plan is ready
if [ -f "docs/CRISIS_COMMS_PLAN.md" ]; then
    log_check "PASS" "Crisis communication plan prepared"
else
    log_check "FAIL" "Crisis communication plan not prepared"
fi

# Check if community outreach plan is ready
if [ -f "docs/COMMUNITY_OUTREACH_PLAN.md" ]; then
    log_check "PASS" "Community outreach plan prepared"
else
    log_check "FAIL" "Community outreach plan not prepared"
fi

echo ""

# Summary
echo -e "${BLUE}📊 T-1 Validation Summary${NC}"
echo "=============================="
echo -e "Total Checks: $CHECKS_TOTAL"
echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"

# Create comprehensive evidence report
{
    echo "Shomer T-1 Launch Validation Report"
    echo "==================================="
    echo ""
    echo "Launch Window: $LAUNCH_WINDOW"
    echo "Launch Team: $LAUNCH_TEAM"
    echo "Validation Timestamp: $(date)"
    echo ""
    echo "Validation Summary:"
    echo "Total Checks: $CHECKS_TOTAL"
    echo "Passed: $CHECKS_PASSED"
    echo "Failed: $CHECKS_FAILED"
    echo ""
    echo "Evidence Files:"
    echo "- preflight-results.txt"
    echo "- canary-results.txt"
    echo "- post-deploy-results.txt"
    echo ""
    echo "Next Steps:"
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo "1. Proceed to GO/NO-GO meeting"
        echo "2. Execute launch runbook"
        echo "3. Monitor Golden Signals dashboard"
        echo "4. Execute canary deployment (5% → 25% → 50% → 100%)"
    else
        echo "1. Address $CHECKS_FAILED failed check(s)"
        echo "2. Re-run T-1 validation"
        echo "3. Consider postponing launch window"
    fi
} > "$EVIDENCE_DIR/t-minus-1-summary.txt"

log_info "T-1 validation evidence captured in: $EVIDENCE_DIR"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 T-1 validation passed! Ready for GO/NO-GO meeting.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Hold GO/NO-GO meeting using releases/v1.0.0-rc1/GO_NO_GO_MEETING_AGENDA.md"
    echo "2. Execute launch runbook: releases/v1.0.0-rc1/LAUNCH_DAY_RUNBOOK.md"
    echo "3. Monitor Golden Signals dashboard during deployment"
    exit 0
else
    echo ""
    echo -e "${RED}❌ $CHECKS_FAILED check(s) failed. Address issues before launch.${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${YELLOW}Required Actions:${NC}"
    echo "1. Review failed checks in evidence files"
    echo "2. Fix identified issues"
    echo "3. Re-run T-1 validation"
    echo "4. Consider postponing launch window if issues persist"
    exit 1
fi
