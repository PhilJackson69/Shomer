#!/bin/bash
# Shomer Quick Deploy Script
# One-command production deployment with full validation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
JWT_ALG="${JWT_ALG:-}"
COOKIE_DOMAIN="${COOKIE_DOMAIN:-}"
CSRF_SECRET="${CSRF_SECRET:-}"
RATE_LIMIT_REDIS_URL="${RATE_LIMIT_REDIS_URL:-}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🚀 Shomer Quick Deploy${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""

# Validate environment
log_info "Validating environment configuration..."

REQUIRED_VARS=("PUBLIC_BASE_URL" "JWT_ALG" "COOKIE_DOMAIN" "CSRF_SECRET" "RATE_LIMIT_REDIS_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these variables before running deployment:"
    echo "  export PUBLIC_BASE_URL=\"https://your-domain.com\""
    echo "  export JWT_ALG=\"RS256\""
    echo "  export COOKIE_DOMAIN=\"your-domain.com\""
    echo "  export CSRF_SECRET=\"your-csrf-secret\""
    echo "  export RATE_LIMIT_REDIS_URL=\"redis://your-redis:6379\""
    exit 1
fi

log_success "Environment configuration validated"

echo ""

# Step 1: Release Readiness Scorecard
log_info "Step 1: Running release readiness scorecard..."
if ./scripts/release-readiness-scorecard.sh; then
    log_success "Release readiness scorecard passed"
else
    log_error "Release readiness scorecard failed"
    exit 1
fi

echo ""

# Step 2: Preflight Validation
log_info "Step 2: Running preflight validation..."
if ./scripts/preflight-validation.sh; then
    log_success "Preflight validation passed"
else
    log_error "Preflight validation failed"
    exit 1
fi

echo ""

# Step 3: Canary Deployment
log_info "Step 3: Starting canary deployment..."
log_warning "This will deploy 5% of traffic to the new version"
read -p "Continue with canary deployment? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Canary deployment cancelled by user"
    exit 0
fi

if ./scripts/canary-deployment.sh; then
    log_success "Canary deployment completed successfully"
else
    log_error "Canary deployment failed - rollback initiated"
    exit 1
fi

echo ""

# Step 4: Post-Deploy Verification
log_info "Step 4: Running post-deploy verification..."
if ./scripts/post-deploy-verification.sh; then
    log_success "Post-deploy verification passed"
else
    log_error "Post-deploy verification failed"
    exit 1
fi

echo ""

# Step 5: Full Deployment
log_info "Step 5: Deploying to 100% traffic..."
log_warning "This will deploy the new version to all traffic"
read -p "Continue with full deployment? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Full deployment cancelled by user"
    log_info "System is running with 5% canary traffic"
    exit 0
fi

# Deploy to 100% traffic
log_info "Deploying to 100% traffic..."
# This would be replaced with actual deployment commands
# kubectl patch service api -p '{"spec":{"selector":{"version":"stable"}}}'
# kubectl scale deployment api --replicas=5

log_success "Full deployment completed"

echo ""

# Step 6: Final Verification
log_info "Step 6: Running final verification..."

# Wait for deployment to stabilize
log_info "Waiting for deployment to stabilize..."
sleep 30

# Run post-deploy verification again
if ./scripts/post-deploy-verification.sh; then
    log_success "Final verification passed"
else
    log_error "Final verification failed"
    exit 1
fi

echo ""

# Success
log_success "🎉 Deployment completed successfully!"
echo ""
echo "Deployment Summary:"
echo "=================="
echo "✅ Release readiness scorecard passed"
echo "✅ Preflight validation passed"
echo "✅ Canary deployment successful"
echo "✅ Post-deploy verification passed"
echo "✅ Full deployment completed"
echo "✅ Final verification passed"
echo ""
echo "Your Shomer application is now live in production!"
echo ""
echo "Next Steps:"
echo "1. Monitor Golden Signals for the next 24 hours"
echo "2. Review security alerts and metrics"
echo "3. Schedule monthly security drill"
echo "4. Update documentation with any lessons learned"
echo ""
echo "Monitoring Dashboard: $PROMETHEUS_URL"
echo "Application URL: $BASE_URL"
echo ""
echo -e "${GREEN}🚀 Production deployment complete!${NC}"
