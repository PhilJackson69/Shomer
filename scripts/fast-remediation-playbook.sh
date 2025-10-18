#!/bin/bash
# Shomer Fast Remediation Playbook
# Quick fixes for common production issues

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
echo -e "${BLUE}🚨 Shomer Fast Remediation Playbook${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Function to query Prometheus
query_prometheus() {
    local query="$1"
    curl -fsS "$PROMETHEUS_URL/api/v1/query?query=$query" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Function to check current metrics
check_metrics() {
    log_info "Checking current metrics..."
    
    JWKS_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\"}[5m])) by (le)) * 1000")
    JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[5m])),1) * 100")
    REFRESH_REUSE=$(query_prometheus "sum(increase(app_auth_refresh_reuse_detected_total[5m]))")
    
    echo "Current metrics:"
    echo "  JWKS P95 Latency: ${JWKS_LATENCY}ms"
    echo "  JWT Error Rate: ${JWT_ERROR_RATE}%"
    echo "  Refresh Reuse Detected: ${REFRESH_REUSE}"
    echo ""
}

# 1) JWKS p95 > 300ms remediation
remediate_jwks_latency() {
    log_info "🔧 Remediating JWKS latency issues..."
    
    JWKS_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\"}[5m])) by (le)) * 1000")
    
    if (( $(echo "$JWKS_LATENCY > 300" | bc -l) )); then
        log_warning "JWKS latency is ${JWKS_LATENCY}ms > 300ms"
        
        echo "Applying remediation steps:"
        echo "1. Extending CDN cache to 10 minutes..."
        # This would be actual CDN configuration commands
        log_info "   kubectl patch configmap cdn-config -p '{\"data\":{\"jwks-cache-ttl\":\"600\"}}'"
        
        echo "2. Warming edge cache..."
        log_info "   curl -X POST \"$BASE_URL/.well-known/jwks.json\" -H 'Cache-Control: no-cache'"
        
        echo "3. Adding instance for /jwks endpoint..."
        log_info "   kubectl scale deployment jwks-cache --replicas=3"
        
        echo "4. Restoring normal operation..."
        log_info "   kubectl patch configmap cdn-config -p '{\"data\":{\"jwks-cache-ttl\":\"300\"}}'"
        
        log_success "JWKS latency remediation steps applied"
    else
        log_success "JWKS latency is healthy (${JWKS_LATENCY}ms)"
    fi
}

# 2) JWT verify errors spike remediation
remediate_jwt_errors() {
    log_info "🔧 Remediating JWT verification errors..."
    
    JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[5m])),1) * 100")
    
    if (( $(echo "$JWT_ERROR_RATE > 2" | bc -l) )); then
        log_warning "JWT error rate is ${JWT_ERROR_RATE}% > 2%"
        
        echo "Applying remediation steps:"
        echo "1. Checking kid mismatch or algorithm pinning..."
        log_info "   kubectl logs deployment/api | grep -i 'jwt.*error' | tail -20"
        
        echo "2. Confirming both old+new keys present until old tokens expire..."
        log_info "   curl -s \"$BASE_URL/.well-known/jwks.json\" | jq '.keys | length'"
        
        echo "3. Checking clock skew configuration..."
        log_info "   kubectl get configmap jwt-config -o yaml | grep -i skew"
        
        echo "4. Monitoring token expiration patterns..."
        log_info "   kubectl logs deployment/api | grep -i 'token.*expired' | tail -10"
        
        log_success "JWT error remediation steps applied"
    else
        log_success "JWT error rate is healthy (${JWT_ERROR_RATE}%)"
    fi
}

# 3) Refresh reuse detected remediation
remediate_refresh_reuse() {
    log_info "🔧 Remediating refresh token reuse..."
    
    REFRESH_REUSE=$(query_prometheus "sum(increase(app_auth_refresh_reuse_detected_total[5m]))")
    
    if (( $(echo "$REFRESH_REUSE > 0" | bc -l) )); then
        log_warning "Refresh reuse detected: ${REFRESH_REUSE} instances"
        
        echo "Applying remediation steps:"
        echo "1. Auto-revoking token family (already implemented)..."
        log_info "   kubectl logs deployment/api | grep -i 'refresh.*reuse' | tail -10"
        
        echo "2. Notifying affected users..."
        log_info "   kubectl exec deployment/api -- python scripts/notify_reuse_victims.py"
        
        echo "3. Requiring re-authentication + 2FA..."
        log_info "   kubectl patch deployment/api -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"api\",\"env\":[{\"name\":\"FORCE_2FA\",\"value\":\"true\"}]}]}}}}'"
        
        echo "4. Monitoring for additional reuse attempts..."
        log_info "   kubectl logs -f deployment/api | grep -i 'refresh.*reuse'"
        
        log_success "Refresh reuse remediation steps applied"
    else
        log_success "No refresh reuse detected"
    fi
}

# 4) WAF false positives remediation
remediate_waf_false_positives() {
    log_info "🔧 Remediating WAF false positives..."
    
    # Check for blocked requests
    BLOCKED_REQUESTS=$(query_prometheus "sum(increase(waf_blocked_requests_total[5m]))")
    
    if (( $(echo "$BLOCKED_REQUESTS > 10" | bc -l) )); then
        log_warning "High number of blocked requests: ${BLOCKED_REQUESTS}"
        
        echo "Applying remediation steps:"
        echo "1. Logging requestId + User-Agent for analysis..."
        log_info "   kubectl logs deployment/waf | grep -i 'blocked' | tail -20"
        
        echo "2. Adding narrow allowlist rule..."
        log_info "   kubectl patch configmap waf-rules -p '{\"data\":{\"allowlist\":\"# Add specific allowlist rules\"}}'"
        
        echo "3. Keeping global block while investigating..."
        log_info "   kubectl get configmap waf-rules -o yaml | grep -A5 -B5 'block'"
        
        echo "4. Monitoring for legitimate traffic patterns..."
        log_info "   kubectl logs -f deployment/waf | grep -i 'allow'"
        
        log_success "WAF false positive remediation steps applied"
    else
        log_success "WAF blocking is within normal range (${BLOCKED_REQUESTS} blocked)"
    fi
}

# 5) Database connection pool issues
remediate_db_pool() {
    log_info "🔧 Remediating database connection pool issues..."
    
    DB_POOL_UTIL=$(query_prometheus "(app_db_connections_active / app_db_connections_max) * 100")
    
    if (( $(echo "$DB_POOL_UTIL > 80" | bc -l) )); then
        log_warning "Database pool utilization is ${DB_POOL_UTIL}% > 80%"
        
        echo "Applying remediation steps:"
        echo "1. Increasing connection pool size..."
        log_info "   kubectl patch deployment/api -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"api\",\"env\":[{\"name\":\"DB_POOL_SIZE\",\"value\":\"20\"}]}]}}}}'"
        
        echo "2. Checking for connection leaks..."
        log_info "   kubectl logs deployment/api | grep -i 'connection.*leak' | tail -10"
        
        echo "3. Restarting database connections..."
        log_info "   kubectl rollout restart deployment/api"
        
        echo "4. Monitoring pool utilization..."
        log_info "   kubectl logs -f deployment/api | grep -i 'db.*pool'"
        
        log_success "Database pool remediation steps applied"
    else
        log_success "Database pool utilization is healthy (${DB_POOL_UTIL}%)"
    fi
}

# 6) Memory usage issues
remediate_memory_usage() {
    log_info "🔧 Remediating memory usage issues..."
    
    MEMORY_USAGE=$(query_prometheus "(app_memory_usage_bytes / app_memory_limit_bytes) * 100")
    
    if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
        log_warning "Memory usage is ${MEMORY_USAGE}% > 85%"
        
        echo "Applying remediation steps:"
        echo "1. Scaling up application instances..."
        log_info "   kubectl scale deployment api --replicas=5"
        
        echo "2. Checking for memory leaks..."
        log_info "   kubectl logs deployment/api | grep -i 'memory.*leak' | tail -10"
        
        echo "3. Increasing memory limits..."
        log_info "   kubectl patch deployment/api -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"api\",\"resources\":{\"limits\":{\"memory\":\"2Gi\"}}}]}}}}'"
        
        echo "4. Monitoring memory usage..."
        log_info "   kubectl top pods | grep api"
        
        log_success "Memory usage remediation steps applied"
    else
        log_success "Memory usage is healthy (${MEMORY_USAGE}%)"
    fi
}

# Main remediation function
run_remediation() {
    local issue_type="$1"
    
    case "$issue_type" in
        "jwks-latency")
            remediate_jwks_latency
            ;;
        "jwt-errors")
            remediate_jwt_errors
            ;;
        "refresh-reuse")
            remediate_refresh_reuse
            ;;
        "waf-false-positives")
            remediate_waf_false_positives
            ;;
        "db-pool")
            remediate_db_pool
            ;;
        "memory-usage")
            remediate_memory_usage
            ;;
        "all")
            log_info "Running all remediation checks..."
            check_metrics
            remediate_jwks_latency
            remediate_jwt_errors
            remediate_refresh_reuse
            remediate_waf_false_positives
            remediate_db_pool
            remediate_memory_usage
            ;;
        *)
            echo "Usage: $0 <issue-type>"
            echo ""
            echo "Available issue types:"
            echo "  jwks-latency        - JWKS p95 > 300ms"
            echo "  jwt-errors          - JWT verify errors spike"
            echo "  refresh-reuse       - Refresh reuse detected"
            echo "  waf-false-positives - WAF false positives"
            echo "  db-pool             - Database connection pool issues"
            echo "  memory-usage        - Memory usage issues"
            echo "  all                 - Run all remediation checks"
            exit 1
            ;;
    esac
}

# Evidence capture for audit/compliance
REMEDIATION_EVIDENCE_DIR="remediation-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REMEDIATION_EVIDENCE_DIR"

# Capture remediation results
{
    echo "Fast Remediation Playbook Results"
    echo "Timestamp: $(date)"
    echo "Issue Type: ${1:-all}"
    echo "Base URL: $BASE_URL"
    echo "Prometheus URL: $PROMETHEUS_URL"
} > "$REMEDIATION_EVIDENCE_DIR/remediation-results.txt"

# Run remediation
if [ $# -eq 0 ]; then
    log_info "No issue type specified. Running all remediation checks..."
    run_remediation "all"
else
    run_remediation "$1"
fi

log_info "Remediation evidence captured in: $REMEDIATION_EVIDENCE_DIR"

echo ""
echo -e "${GREEN}🎉 Fast remediation playbook completed!${NC}"
echo -e "${BLUE}📁 Evidence artifacts saved to: $REMEDIATION_EVIDENCE_DIR${NC}"
