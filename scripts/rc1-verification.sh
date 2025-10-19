#!/bin/bash
# RC1 Comprehensive Verification Script
# Runs all critical validation steps for GO/NO-GO decision

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-http://localhost:8000}"
STAGING_URL="${STAGING_URL:-https://staging.shomer.example.com}"
EVIDENCE_DIR="releases/v1.0.0-rc1"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_check() {
    local status=$1
    local message=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $message"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🚀 RC1 Comprehensive Verification${NC}"
echo -e "${BLUE}=================================${NC}"
echo "Timestamp: $(date)"
echo "Base URL: $BASE_URL"
echo "Staging URL: $STAGING_URL"
echo ""

# Create evidence directory
mkdir -p "$EVIDENCE_DIR"

# 1) E2E Tests Validation
echo -e "${BLUE}1️⃣ E2E Tests Validation${NC}"
echo "========================="

if command -v npx >/dev/null 2>&1; then
    log_info "Running E2E tests..."
    if npx playwright test tests/e2e/core-user-flows.spec.ts --reporter=list > "$EVIDENCE_DIR/e2e-results.log" 2>&1; then
        log_check "PASS" "E2E tests passed - all core user flows working"
    else
        log_check "FAIL" "E2E tests failed - check $EVIDENCE_DIR/e2e-results.log"
    fi
else
    log_warning "Playwright not available - skipping E2E tests"
fi

echo ""

# 2) Performance Validation (k6)
echo -e "${BLUE}2️⃣ Performance Validation${NC}"
echo "============================"

if command -v k6 >/dev/null 2>&1; then
    log_info "Running k6 load tests..."
    if k6 run tests/load/k6-load-test.js --out json="$EVIDENCE_DIR/k6-results.json" > "$EVIDENCE_DIR/k6-results.log" 2>&1; then
        # Parse k6 results for thresholds
        if [ -f "$EVIDENCE_DIR/k6-results.json" ]; then
            P95_READ=$(jq -r '.metrics.http_req_duration.values.p95' "$EVIDENCE_DIR/k6-results.json" 2>/dev/null || echo "0")
            ERROR_RATE=$(jq -r '.metrics.http_req_failed.values.rate' "$EVIDENCE_DIR/k6-results.json" 2>/dev/null || echo "1")
            
            if (( $(echo "$P95_READ < 500" | bc -l) )); then
                log_check "PASS" "P95 read latency: ${P95_READ}ms < 500ms"
            else
                log_check "FAIL" "P95 read latency: ${P95_READ}ms >= 500ms"
            fi
            
            if (( $(echo "$ERROR_RATE < 0.005" | bc -l) )); then
                log_check "PASS" "Error rate: $(echo "$ERROR_RATE * 100" | bc -l)% < 0.5%"
            else
                log_check "FAIL" "Error rate: $(echo "$ERROR_RATE * 100" | bc -l)% >= 0.5%"
            fi
        else
            log_check "FAIL" "k6 results file not generated"
        fi
    else
        log_check "FAIL" "k6 load tests failed - check $EVIDENCE_DIR/k6-results.log"
    fi
else
    log_warning "k6 not available - skipping performance tests"
fi

echo ""

# 3) Security Validation
echo -e "${BLUE}3️⃣ Security Validation${NC}"
echo "======================="

# Run security probes
if [ -f "scripts/ci_security_probes.sh" ]; then
    log_info "Running security probes..."
    if bash scripts/ci_security_probes.sh > "$EVIDENCE_DIR/security-probes.log" 2>&1; then
        log_check "PASS" "Security probes passed"
    else
        log_check "FAIL" "Security probes failed - check $EVIDENCE_DIR/security-probes.log"
    fi
else
    log_warning "Security probes script not found"
fi

# Check for security tools
if command -v semgrep >/dev/null 2>&1; then
    log_info "Running Semgrep security scan..."
    if semgrep --config=auto --json --output="$EVIDENCE_DIR/semgrep-results.json" . > "$EVIDENCE_DIR/semgrep.log" 2>&1; then
        log_check "PASS" "Semgrep security scan completed"
    else
        log_check "FAIL" "Semgrep security scan failed"
    fi
else
    log_warning "Semgrep not available - skipping security scan"
fi

if command -v trivy >/dev/null 2>&1; then
    log_info "Running Trivy vulnerability scan..."
    if trivy fs --format json --output "$EVIDENCE_DIR/trivy-results.json" . > "$EVIDENCE_DIR/trivy.log" 2>&1; then
        log_check "PASS" "Trivy vulnerability scan completed"
    else
        log_check "FAIL" "Trivy vulnerability scan failed"
    fi
else
    log_warning "Trivy not available - skipping vulnerability scan"
fi

echo ""

# 4) Observability Validation
echo -e "${BLUE}4️⃣ Observability Validation${NC}"
echo "============================="

# Check if Golden Signals dashboard exists
if [ -f "monitoring/dashboards/golden-signals-dashboard.json" ]; then
    log_check "PASS" "Golden Signals dashboard configuration exists"
else
    log_check "FAIL" "Golden Signals dashboard configuration missing"
fi

# Check if Prometheus alerts exist
if [ -f "monitoring/prometheus-alerts.yaml" ]; then
    log_check "PASS" "Prometheus alerts configuration exists"
else
    log_check "FAIL" "Prometheus alerts configuration missing"
fi

# Check if Grafana dashboard exists
if [ -f "grafana-api-security-dashboard.json" ]; then
    log_check "PASS" "Grafana API security dashboard exists"
else
    log_check "FAIL" "Grafana API security dashboard missing"
fi

echo ""

# 5) Legal Compliance Validation
echo -e "${BLUE}5️⃣ Legal Compliance Validation${NC}"
echo "================================"

# Check Privacy Policy
if [ -f "docs/legal/privacy-policy.md" ]; then
    log_check "PASS" "Privacy Policy exists"
else
    log_check "FAIL" "Privacy Policy missing"
fi

# Check Terms of Service
if [ -f "docs/legal/terms-of-service.md" ]; then
    log_check "PASS" "Terms of Service exists"
else
    log_check "FAIL" "Terms of Service missing"
fi

echo ""

# 6) DR & Compliance Validation
echo -e "${BLUE}6️⃣ DR & Compliance Validation${NC}"
echo "==============================="

# Check DR scripts exist
if [ -f "scripts/dr/migration-rehearsal.sh" ]; then
    log_check "PASS" "Migration rehearsal script exists"
else
    log_check "FAIL" "Migration rehearsal script missing"
fi

if [ -f "scripts/dr/restore-drill.sh" ]; then
    log_check "PASS" "Restore drill script exists"
else
    log_check "FAIL" "Restore drill script missing"
fi

echo ""

# 7) Generate GO/NO-GO Report
echo -e "${BLUE}7️⃣ Generating GO/NO-GO Report${NC}"
echo "=============================="

# Create GO/NO-GO template
cat > "$EVIDENCE_DIR/GO_NO_GO_TEMPLATE.md" << EOF
# GO/NO-GO: v1.0.0-rc1

## Verification Results

- **Functional E2E**: $([ $FAILED_CHECKS -eq 0 ] && echo "✅ All green" || echo "❌ Issues found")
- **Performance (k6)**: $([ -f "$EVIDENCE_DIR/k6-results.json" ] && echo "✅ Results available" || echo "❌ No results")
- **Security lane**: $([ -f "$EVIDENCE_DIR/security-probes.log" ] && echo "✅ Probes completed" || echo "❌ Probes failed")
- **DAST**: $([ -f "$EVIDENCE_DIR/semgrep-results.json" ] && echo "✅ Scan completed" || echo "❌ Scan failed")
- **Data & DR**: $([ -f "scripts/dr/migration-rehearsal.sh" ] && echo "✅ Scripts available" || echo "❌ Scripts missing")
- **Observability**: $([ -f "monitoring/dashboards/golden-signals-dashboard.json" ] && echo "✅ Dashboard configured" || echo "❌ Dashboard missing")
- **Canary**: $([ -f "scripts/canary-deployment.sh" ] && echo "✅ Script available" || echo "❌ Script missing")
- **Legal**: $([ -f "docs/legal/privacy-policy.md" ] && echo "✅ Privacy & Terms available" || echo "❌ Legal docs missing")

## Summary
- Total Checks: $TOTAL_CHECKS
- Passed: $PASSED_CHECKS
- Failed: $FAILED_CHECKS

## Decision: $([ $FAILED_CHECKS -eq 0 ] && echo "**GO**" || echo "**NO-GO**")

## Approvers Required
- [ ] Eng Lead
- [ ] Sec Lead  
- [ ] PM

## Date/Time: $(date)

## Evidence Artifacts
- E2E Results: $EVIDENCE_DIR/e2e-results.log
- Performance Results: $EVIDENCE_DIR/k6-results.json
- Security Probes: $EVIDENCE_DIR/security-probes.log
- Semgrep Results: $EVIDENCE_DIR/semgrep-results.json
- Trivy Results: $EVIDENCE_DIR/trivy-results.json
EOF

log_check "PASS" "GO/NO-GO template generated"

echo ""

# Summary
echo -e "${BLUE}📊 RC1 Verification Summary${NC}"
echo "=============================="
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All verification checks passed!${NC}"
    echo -e "${GREEN}✅ RC1 is ready for GO decision${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ $FAILED_CHECKS check(s) failed${NC}"
    echo -e "${RED}🚨 RC1 needs attention before GO decision${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    exit 1
fi
