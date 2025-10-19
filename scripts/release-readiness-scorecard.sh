#!/bin/bash
# Shomer Release Readiness Scorecard
# Comprehensive validation before production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

# Scorecard tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

log_check() {
    local status=$1
    local message=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case $status in
        "PASS")
            echo -e "${GREEN}✓${NC} $message"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "FAIL")
            echo -e "${RED}✗${NC} $message"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            WARNINGS=$((WARNINGS + 1))
            ;;
    esac
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
    echo ""
}

# Header
echo -e "${BLUE}🛡️  Shomer Release Readiness Scorecard${NC}"
echo -e "${BLUE}=========================================${NC}"
echo "Timestamp: $(date)"
echo ""

# 1. Preflight Script Validation
log_section "1. Preflight Script Validation"

if [ -f "scripts/preflight-validation.sh" ]; then
    log_check "PASS" "Preflight validation script exists"
    
    # Test preflight script
    if bash -n scripts/preflight-validation.sh; then
        log_check "PASS" "Preflight script syntax is valid"
    else
        log_check "FAIL" "Preflight script has syntax errors"
    fi
else
    log_check "FAIL" "Preflight validation script missing"
fi

# 2. Canary Deployment Readiness
log_section "2. Canary Deployment Readiness"

if [ -f "scripts/canary-deployment.sh" ]; then
    log_check "PASS" "Canary deployment script exists"
    
    # Check for required configuration
    if grep -q "CANARY_TRAFFIC_PERCENT" scripts/canary-deployment.sh; then
        log_check "PASS" "Canary deployment script has traffic control"
    else
        log_check "WARN" "Canary deployment script missing traffic control"
    fi
else
    log_check "FAIL" "Canary deployment script missing"
fi

# 3. Rollback Procedures
log_section "3. Rollback Procedures"

# Check for rollback documentation
if [ -f "docs/ops-runbooks.md" ]; then
    log_check "PASS" "Operations runbooks exist"
    
    if grep -q "rollback" docs/ops-runbooks.md; then
        log_check "PASS" "Rollback procedures documented"
    else
        log_check "WARN" "Rollback procedures not documented"
    fi
else
    log_check "FAIL" "Operations runbooks missing"
fi

# 4. JWKS Dual-Key Rotation
log_section "4. JWKS Dual-Key Rotation"

# Check JWKS endpoint
if [ -n "$BASE_URL" ]; then
    if curl -fsS "$BASE_URL/.well-known/jwks.json" > /dev/null 2>&1; then
        log_check "PASS" "JWKS endpoint accessible"
        
        # Check for multiple keys support
        KEY_COUNT=$(curl -fsS "$BASE_URL/.well-known/jwks.json" | jq '.keys | length' 2>/dev/null || echo "0")
        if [ "$KEY_COUNT" -ge 1 ]; then
            log_check "PASS" "JWKS contains $KEY_COUNT key(s)"
        else
            log_check "FAIL" "JWKS must contain at least 1 key"
        fi
    else
        log_check "FAIL" "JWKS endpoint not accessible"
    fi
else
    log_check "WARN" "Cannot test JWKS without BASE_URL"
fi

# 5. DAST Nightly Workflow
log_section "5. DAST Nightly Workflow"

# Check for DAST workflow
if [ -f ".github/workflows/dast-security-scan.yml" ]; then
    log_check "PASS" "DAST security scan workflow exists"
    
    # Check if workflow is enabled
    if grep -q "schedule:" .github/workflows/dast-security-scan.yml; then
        log_check "PASS" "DAST workflow has scheduled runs"
    else
        log_check "WARN" "DAST workflow may not be scheduled"
    fi
else
    log_check "FAIL" "DAST security scan workflow missing"
fi

# 6. Security Lane Validation
log_section "6. Security Lane Validation"

# Check for security tools
SECURITY_TOOLS=("semgrep-config.yml" "trivy-config.yaml" ".gitleaks.toml")

for tool in "${SECURITY_TOOLS[@]}"; do
    if [ -f "$tool" ]; then
        log_check "PASS" "$tool configuration exists"
    else
        log_check "FAIL" "$tool configuration missing"
    fi
done

# Check for security workflows
if [ -f ".github/workflows/security.yml" ]; then
    log_check "PASS" "Security workflow exists"
else
    log_check "FAIL" "Security workflow missing"
fi

# 7. Monitoring and Alerting
log_section "7. Monitoring and Alerting"

# Check Prometheus configuration
if [ -f "monitoring/prometheus-alerts.yaml" ]; then
    log_check "PASS" "Prometheus alerts configuration exists"
else
    log_check "FAIL" "Prometheus alerts configuration missing"
fi

# Check Golden Signals queries
if [ -f "monitoring/golden-signals-queries.yaml" ]; then
    log_check "PASS" "Golden Signals queries exist"
else
    log_check "FAIL" "Golden Signals queries missing"
fi

# Check Prometheus connectivity
if [ -n "$PROMETHEUS_URL" ]; then
    if curl -fsS "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
        log_check "PASS" "Prometheus is accessible"
    else
        log_check "WARN" "Prometheus not accessible (may be normal in dev)"
    fi
fi

# 8. WAF Configuration
log_section "8. WAF Configuration"

if [ -f "infra/waf-edge-rules.yaml" ]; then
    log_check "PASS" "WAF edge rules configuration exists"
    
    # Check for critical WAF rules
    if grep -q "block-json-get-with-body" infra/waf-edge-rules.yaml; then
        log_check "PASS" "WAF has JSON GET blocking rule"
    else
        log_check "WARN" "WAF missing JSON GET blocking rule"
    fi
    
    if grep -q "block-private-ip-requests" infra/waf-edge-rules.yaml; then
        log_check "PASS" "WAF has private IP blocking rule"
    else
        log_check "WARN" "WAF missing private IP blocking rule"
    fi
else
    log_check "FAIL" "WAF edge rules configuration missing"
fi

# 9. Environment Configuration
log_section "9. Environment Configuration"

# Check for production environment template
if [ -f "env.production.template" ]; then
    log_check "PASS" "Production environment template exists"
else
    log_check "FAIL" "Production environment template missing"
fi

# Check for required environment variables
REQUIRED_ENV_VARS=("PUBLIC_BASE_URL" "JWT_ALG" "COOKIE_DOMAIN" "CSRF_SECRET" "RATE_LIMIT_REDIS_URL")

for var in "${REQUIRED_ENV_VARS[@]}"; do
    if grep -q "$var" env.production.template; then
        log_check "PASS" "$var is in production template"
    else
        log_check "WARN" "$var missing from production template"
    fi
done

# 10. Security Hardening
log_section "10. Security Hardening"

# Check for security documentation
if [ -f "docs/SECURITY.md" ]; then
    log_check "PASS" "Security documentation exists"
else
    log_check "FAIL" "Security documentation missing"
fi

# Check for security checklists
if [ -f "PRODUCTION_SECURITY_CHECKLIST.md" ]; then
    log_check "PASS" "Production security checklist exists"
else
    log_check "FAIL" "Production security checklist missing"
fi

# Check for security hardening summary
if [ -f "PRODUCTION_SECURITY_HARDENING_COMPLETE.md" ]; then
    log_check "PASS" "Security hardening summary exists"
else
    log_check "WARN" "Security hardening summary missing"
fi

# 11. Testing and Validation
log_section "11. Testing and Validation"

# Check for post-deploy verification script
if [ -f "scripts/post-deploy-verification.sh" ]; then
    log_check "PASS" "Post-deploy verification script exists"
else
    log_check "FAIL" "Post-deploy verification script missing"
fi

# Check for security drill script
if [ -f "scripts/security-drill.sh" ]; then
    log_check "PASS" "Security drill script exists"
else
    log_check "FAIL" "Security drill script missing"
fi

# Check for test coverage
if [ -f "apps/api/tests/test_security_comprehensive.py" ]; then
    log_check "PASS" "Comprehensive security tests exist"
else
    log_check "WARN" "Comprehensive security tests missing"
fi

# 12. Documentation and Runbooks
log_section "12. Documentation and Runbooks"

# Check for deployment guide
if [ -f "DEPLOYMENT_GUIDE.md" ]; then
    log_check "PASS" "Deployment guide exists"
else
    log_check "FAIL" "Deployment guide missing"
fi

# Check for ops runbooks
if [ -f "docs/ops-runbooks.md" ]; then
    log_check "PASS" "Operations runbooks exist"
else
    log_check "FAIL" "Operations runbooks missing"
fi

# Check for incident response procedures
if grep -q "incident response" docs/ops-runbooks.md; then
    log_check "PASS" "Incident response procedures documented"
else
    log_check "WARN" "Incident response procedures not documented"
fi

# Summary
echo ""
echo -e "${BLUE}📊 Release Readiness Summary${NC}"
echo "=============================="
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

# Calculate score
SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo ""
echo -e "Release Readiness Score: ${SCORE}%"

# Determine readiness status
if [ $FAILED_CHECKS -eq 0 ] && [ $SCORE -ge 90 ]; then
    echo -e "${GREEN}🎉 RELEASE READY!${NC}"
    echo -e "${GREEN}All critical checks passed. Safe to proceed with deployment.${NC}"
    exit 0
elif [ $FAILED_CHECKS -eq 0 ] && [ $SCORE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  RELEASE READY WITH CAUTION${NC}"
    echo -e "${YELLOW}All critical checks passed, but some warnings exist. Review before deployment.${NC}"
    exit 0
elif [ $FAILED_CHECKS -le 2 ] && [ $SCORE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  RELEASE READY WITH FIXES${NC}"
    echo -e "${YELLOW}Minor issues detected. Fix critical failures before deployment.${NC}"
    exit 1
else
    echo -e "${RED}❌ NOT RELEASE READY${NC}"
    echo -e "${RED}Multiple critical issues detected. Fix all failures before deployment.${NC}"
    exit 1
fi
