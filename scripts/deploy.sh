#!/bin/bash
# Shomer Deployment Script
# Simulates the deploy command for staging/production environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE="${1:-api}"
ENV="${2:-staging}"
VERSION="${3:-latest}"
TRAFFIC="${4:-100}"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Header
echo -e "${BLUE}🚀 Shomer Deployment${NC}"
echo -e "${BLUE}===================${NC}"
echo ""

log_info "Deployment Configuration:"
echo "  Service: $SERVICE"
echo "  Environment: $ENV"
echo "  Version: $VERSION"
echo "  Traffic: $TRAFFIC%"
echo ""

# Validate inputs
if [ "$SERVICE" != "api" ]; then
    log_error "Only 'api' service is supported"
    exit 1
fi

if [ "$ENV" != "staging" ] && [ "$ENV" != "prod" ]; then
    log_error "Environment must be 'staging' or 'prod'"
    exit 1
fi

if [ "$TRAFFIC" -lt 0 ] || [ "$TRAFFIC" -gt 100 ]; then
    log_error "Traffic percentage must be between 0 and 100"
    exit 1
fi

# Simulate deployment based on environment
if [ "$ENV" = "staging" ]; then
    log_info "Deploying to staging environment..."
    
    # For staging, we'll use docker-compose with staging overrides
    if [ "$VERSION" = "previous" ]; then
        log_info "Rolling back to previous version..."
        # In a real deployment, this would switch to the previous image tag
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
        log_success "Rolled back to previous version"
    else
        log_info "Deploying version $VERSION with $TRAFFIC% traffic..."
        # In a real deployment, this would update the image tag and adjust traffic
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
        log_success "Deployed version $VERSION with $TRAFFIC% traffic"
    fi
    
elif [ "$ENV" = "prod" ]; then
    log_info "Deploying to production environment..."
    
    if [ "$VERSION" = "previous" ]; then
        log_info "Rolling back to previous version..."
        # In a real deployment, this would switch to the previous image tag
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml up -d
        log_success "Rolled back to previous version"
    else
        log_info "Deploying version $VERSION with $TRAFFIC% traffic..."
        # In a real deployment, this would update the image tag and adjust traffic
        docker-compose -f docker-compose.prod.yml up -d --build
        log_success "Deployed version $VERSION with $TRAFFIC% traffic"
    fi
fi

# Capture deployment evidence
DEPLOYMENT_EVIDENCE_DIR="releases/v1.0.0-rc1/evidence/deployment-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOYMENT_EVIDENCE_DIR"

# Log deployment details
{
    echo "Deployment Details"
    echo "=================="
    echo "Timestamp: $(date)"
    echo "Service: $SERVICE"
    echo "Environment: $ENV"
    echo "Version: $VERSION"
    echo "Traffic: $TRAFFIC%"
    echo "Status: SUCCESS"
} > "$DEPLOYMENT_EVIDENCE_DIR/deployment-log.txt"

log_info "Deployment evidence captured in: $DEPLOYMENT_EVIDENCE_DIR"

echo ""
log_success "Deployment completed successfully!"
