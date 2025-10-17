#!/bin/bash
# Go-Live Validation Script
# Run this immediately after deployment to validate the API keys hardening

set -e  # Exit on any error

echo "🚀 API Keys Hardening - Go-Live Validation"
echo "=========================================="

# Configuration
ORG="${ORG:-org_123}"
KEY="${KEY:-org_live_redacted}"  # Replace with actual test key
SECRET="${ACTION_SECRET}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "ℹ️  $1"
}

# Validation functions
validate_environment() {
    log_info "Checking environment configuration..."
    
    if [ -z "$SECRET" ]; then
        log_error "ACTION_SECRET not set"
        exit 1
    fi
    
    if [ -z "$KEY" ] || [ "$KEY" = "org_live_redacted" ]; then
        log_warning "Test API key not set - using placeholder"
        log_info "Set KEY environment variable with actual test key"
    fi
    
    log_success "Environment configuration valid"
}

validate_database() {
    log_info "Validating database migrations and schema..."
    
    # Check if migrations are applied
    if ! pnpm prisma migrate status > /dev/null 2>&1; then
        log_error "Database migrations not applied"
        exit 1
    fi
    
    # Validate schema
    pnpm prisma db pull > /dev/null 2>&1
    pnpm prisma generate > /dev/null 2>&1
    
    log_success "Database schema validated"
}

validate_build() {
    log_info "Running build validation..."
    
    pnpm typecheck
    pnpm lint
    pnpm build
    
    log_success "Build validation complete"
}

validate_tests() {
    log_info "Running test suite..."
    
    pnpm test -i org-apikeys-hardened.test.ts
    
    log_success "Test suite passed"
}

test_secret_bypass() {
    log_info "Testing global secret bypass..."
    
    response=$(curl -sS -i -X POST \
        -H "X-Action-Secret: $SECRET" \
        "$BASE_URL/api/oncall/rota?orgId=$ORG" 2>/dev/null)
    
    http_code=$(echo "$response" | head -n 1 | cut -d' ' -f2)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log_success "Global secret bypass working (HTTP $http_code)"
    else
        log_error "Global secret bypass failed (HTTP $http_code)"
        echo "$response" | head -n 12
        return 1
    fi
}

test_scoped_key_allowed() {
    log_info "Testing scoped key (allowed)..."
    
    response=$(curl -sS -i -X POST \
        -H "X-Org-Api-Key: $KEY" \
        "$BASE_URL/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1" 2>/dev/null)
    
    http_code=$(echo "$response" | head -n 1 | cut -d' ' -f2)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log_success "Scoped key allowed working (HTTP $http_code)"
    else
        log_warning "Scoped key allowed test (HTTP $http_code)"
        echo "$response" | head -n 20
    fi
}

test_scoped_key_denied() {
    log_info "Testing scoped key (denied)..."
    
    response=$(curl -sS -i -X POST \
        -H "X-Org-Api-Key: $KEY" \
        "$BASE_URL/api/orgs/$ORG/settings" 2>/dev/null)
    
    http_code=$(echo "$response" | head -n 1 | cut -d' ' -f2)
    
    if [ "$http_code" = "403" ]; then
        log_success "Scoped key denied working (HTTP $http_code)"
        
        # Check error format
        if echo "$response" | grep -q "forbidden_scope"; then
            log_success "Error format is standardized"
        else
            log_warning "Error format may not be standardized"
        fi
    else
        log_warning "Scoped key denied test (HTTP $http_code)"
        echo "$response" | head -n 20
    fi
}

test_rate_limiting() {
    log_info "Testing rate limiting..."
    
    # Make 6 requests (assuming RPM limit of 5)
    rate_limited=false
    for i in {1..6}; do
        http_code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
            -H "X-Org-Api-Key: $KEY" \
            "$BASE_URL/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1" 2>/dev/null)
        
        echo "Request $i: HTTP $http_code"
        
        if [ "$http_code" = "429" ]; then
            rate_limited=true
        fi
    done
    
    if [ "$rate_limited" = true ]; then
        log_success "Rate limiting working (429 received)"
    else
        log_warning "Rate limiting test - no 429 received (may be unlimited key)"
    fi
}

validate_monitoring() {
    log_info "Validating monitoring configuration..."
    
    # Check if monitoring endpoints are accessible
    if curl -sS "$BASE_URL/health" > /dev/null 2>&1; then
        log_success "Health endpoint accessible"
    else
        log_warning "Health endpoint not accessible"
    fi
    
    # Check if metrics endpoint exists (if implemented)
    if curl -sS "$BASE_URL/metrics" > /dev/null 2>&1; then
        log_success "Metrics endpoint accessible"
    else
        log_info "Metrics endpoint not implemented (optional)"
    fi
}

# Main validation flow
main() {
    echo "Starting go-live validation..."
    echo "Configuration:"
    echo "  ORG: $ORG"
    echo "  KEY: ${KEY:0:20}..." # Show first 20 chars
    echo "  BASE_URL: $BASE_URL"
    echo ""
    
    # Run all validations
    validate_environment
    validate_database
    validate_build
    validate_tests
    
    echo ""
    log_info "Running smoke tests..."
    
    test_secret_bypass
    test_scoped_key_allowed
    test_scoped_key_denied
    test_rate_limiting
    
    echo ""
    validate_monitoring
    
    echo ""
    echo "🎉 Go-Live Validation Complete!"
    echo ""
    echo "📊 Next Steps:"
    echo "   1. Monitor dashboards for 60 minutes"
    echo "   2. Check scope denial rate < 1%"
    echo "   3. Verify no disabled keys making calls"
    echo "   4. Review customer feedback"
    echo ""
    echo "🚨 If issues detected:"
    echo "   - Check runbook: apps/web/runbook-incident-cards.md"
    echo "   - Emergency bypass: Set EMERGENCY_BYPASS_SCOPES=true"
    echo "   - Contact on-call: #oncall-platform"
}

# Run main function
main "$@"
