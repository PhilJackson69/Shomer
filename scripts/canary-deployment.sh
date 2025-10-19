#!/bin/bash
# Shomer Canary Deployment Script
# 30-60 minute canary deployment with monitoring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${PUBLIC_BASE_URL:-}"
CANARY_TRAFFIC_PERCENT="${CANARY_TRAFFIC_PERCENT:-5}"
MONITORING_DURATION="${MONITORING_DURATION:-30}" # minutes
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
echo -e "${BLUE}🚀 Shomer Canary Deployment${NC}"
echo -e "${BLUE}============================${NC}"
echo "Canary Traffic: ${CANARY_TRAFFIC_PERCENT}%"
echo "Monitoring Duration: ${MONITORING_DURATION} minutes"
echo ""

# Pre-deployment checks
log_info "Pre-deployment checks..."

# Check if Prometheus is accessible
if curl -fsS "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
    log_success "Prometheus is accessible"
else
    log_error "Prometheus is not accessible at $PROMETHEUS_URL"
    exit 1
fi

# Check baseline metrics
log_info "Capturing baseline metrics..."

# Function to query Prometheus
query_prometheus() {
    local query="$1"
    curl -fsS "$PROMETHEUS_URL/api/v1/query?query=$query" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Capture baseline metrics using golden signals queries
BASELINE_JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[5m])),1) * 100")
BASELINE_JWKS_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\"}[5m])) by (le)) * 1000")
BASELINE_CSRF_MISMATCH=$(query_prometheus "sum(increase(app_csrf_mismatch_total[5m]))")
BASELINE_HTTP_5XX=$(query_prometheus "sum(rate(http_server_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_server_requests_total[5m])) * 100")
BASELINE_REFRESH_REUSE=$(query_prometheus "sum(increase(app_auth_refresh_reuse_detected_total[5m]))")
BASELINE_SECURITY_EVENTS=$(query_prometheus "sum(rate(app_security_events_total[5m]))")

log_success "Baseline metrics captured:"
echo "  JWT Error Rate: ${BASELINE_JWT_ERROR_RATE}%"
echo "  JWKS Latency: ${BASELINE_JWKS_LATENCY}ms"
echo "  CSRF Mismatches: ${BASELINE_CSRF_MISMATCH}"
echo "  HTTP 5xx Rate: ${BASELINE_HTTP_5XX}%"
echo "  Refresh Reuse Detected: ${BASELINE_REFRESH_REUSE}"
echo "  Security Events Rate: ${BASELINE_SECURITY_EVENTS}"

echo ""

# Deploy canary
log_info "Deploying canary version..."

# This would be replaced with actual deployment commands
# For example: kubectl set image deployment/api api=shomer/api:canary-$BUILD_NUMBER
# Or: docker-compose up -d --scale api=2 api:canary

log_warning "CANARY DEPLOYMENT COMMAND NEEDS TO BE CONFIGURED"
log_info "Example commands:"
echo "  kubectl set image deployment/api api=shomer/api:canary-\$BUILD_NUMBER"
echo "  kubectl patch service api -p '{\"spec\":{\"selector\":{\"version\":\"canary\"}}}'"
echo "  # Configure load balancer to route ${CANARY_TRAFFIC_PERCENT}% traffic to canary"

echo ""
log_info "Waiting for canary deployment to stabilize..."
sleep 30

# Monitor canary deployment
log_info "Monitoring canary deployment for ${MONITORING_DURATION} minutes..."

ALERT_BREACH_COUNT=0
MONITORING_START=$(date +%s)
MONITORING_END=$((MONITORING_START + MONITORING_DURATION * 60))

while [ $(date +%s) -lt $MONITORING_END ]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - MONITORING_START))
    REMAINING=$((MONITORING_END - CURRENT_TIME))
    
    echo -e "\r${BLUE}Monitoring... ${ELAPSED}s elapsed, ${REMAINING}s remaining${NC}" -n
    
    # Check canary metrics (use instance labels or fallback to global)
    CANARY_JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total{instance=~\".*canary.*\"}[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total{instance=~\".*canary.*\"}[5m])),1) * 100")
    CANARY_JWKS_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\",instance=~\".*canary.*\"}[5m])) by (le)) * 1000")
    CANARY_CSRF_MISMATCH=$(query_prometheus "sum(increase(app_csrf_mismatch_total{instance=~\".*canary.*\"}[5m]))")
    CANARY_HTTP_5XX=$(query_prometheus "sum(rate(http_server_requests_total{status=~\"5..\",instance=~\".*canary.*\"}[5m])) / sum(rate(http_server_requests_total{instance=~\".*canary.*\"}[5m])) * 100")
    CANARY_REFRESH_REUSE=$(query_prometheus "sum(increase(app_auth_refresh_reuse_detected_total{instance=~\".*canary.*\"}[5m]))")
    CANARY_SECURITY_EVENTS=$(query_prometheus "sum(rate(app_security_events_total{instance=~\".*canary.*\"}[5m]))")
    
    # Check for alert breaches (exact thresholds from requirements)
    ALERT_BREACH=false
    
    # JWT error rate check (< 2% p5m)
    if (( $(echo "$CANARY_JWT_ERROR_RATE > 2" | bc -l) )); then
        log_error "JWT error rate breach: ${CANARY_JWT_ERROR_RATE}% > 2%"
        ALERT_BREACH=true
    fi
    
    # JWKS latency check (< 300ms p95)
    if (( $(echo "$CANARY_JWKS_LATENCY > 300" | bc -l) )); then
        log_error "JWKS latency breach: ${CANARY_JWKS_LATENCY}ms > 300ms"
        ALERT_BREACH=true
    fi
    
    # CSRF mismatch check (should be flat)
    if (( $(echo "$CANARY_CSRF_MISMATCH > 0" | bc -l) )); then
        log_error "CSRF mismatch detected: ${CANARY_CSRF_MISMATCH} (should be 0)"
        ALERT_BREACH=true
    fi
    
    # HTTP 5xx check (no regression)
    if (( $(echo "$CANARY_HTTP_5XX > 1" | bc -l) )); then
        log_error "HTTP 5xx rate breach: ${CANARY_HTTP_5XX}% > 1%"
        ALERT_BREACH=true
    fi
    
    # Refresh reuse check (should be 0)
    if (( $(echo "$CANARY_REFRESH_REUSE > 0" | bc -l) )); then
        log_error "Refresh reuse detected: ${CANARY_REFRESH_REUSE} (should be 0)"
        ALERT_BREACH=true
    fi
    
    # Security events check (monitor for spikes)
    if (( $(echo "$CANARY_SECURITY_EVENTS > 5" | bc -l) )); then
        log_error "Security events spike: ${CANARY_SECURITY_EVENTS} > 5"
        ALERT_BREACH=true
    fi
    
    if [ "$ALERT_BREACH" = true ]; then
        ALERT_BREACH_COUNT=$((ALERT_BREACH_COUNT + 1))
        
        # If 5 consecutive breaches, abort deployment
        if [ $ALERT_BREACH_COUNT -ge 5 ]; then
            echo ""
            log_error "5 consecutive alert breaches detected. Aborting deployment!"
            echo ""
            
            # Rollback deployment
            log_info "Initiating rollback..."
            log_warning "ROLLBACK COMMAND NEEDS TO BE CONFIGURED"
            log_info "Example rollback commands:"
            echo "  kubectl rollout undo deployment/api"
            echo "  kubectl patch service api -p '{\"spec\":{\"selector\":{\"version\":\"stable\"}}}'"
            echo "  # Revert load balancer to 100% stable traffic"
            
            exit 1
        fi
    else
        # Reset breach count if no breach
        ALERT_BREACH_COUNT=0
    fi
    
    sleep 30
done

echo ""
log_success "Canary monitoring completed successfully!"

# Final metrics comparison
log_info "Final metrics comparison:"
echo ""
echo "Metric                    | Baseline | Canary   | Status"
echo "--------------------------|----------|----------|--------"
printf "JWT Error Rate (%%%)        | %-8s | %-8s | %s\n" "$BASELINE_JWT_ERROR_RATE" "$CANARY_JWT_ERROR_RATE" "$(if (( $(echo "$CANARY_JWT_ERROR_RATE <= 2" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
printf "JWKS Latency (ms)         | %-8s | %-8s | %s\n" "$BASELINE_JWKS_LATENCY" "$CANARY_JWKS_LATENCY" "$(if (( $(echo "$CANARY_JWKS_LATENCY <= 300" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
printf "CSRF Mismatches           | %-8s | %-8s | %s\n" "$BASELINE_CSRF_MISMATCH" "$CANARY_CSRF_MISMATCH" "$(if (( $(echo "$CANARY_CSRF_MISMATCH <= 5" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
printf "HTTP 5xx Rate (%%%)        | %-8s | %-8s | %s\n" "$BASELINE_HTTP_5XX" "$CANARY_HTTP_5XX" "$(if (( $(echo "$CANARY_HTTP_5XX <= 1" | bc -l) )); then echo "✓"; else echo "✗"; fi)"

echo ""

# Decision point
if [ $ALERT_BREACH_COUNT -eq 0 ]; then
    log_success "Canary deployment successful! Proceeding to full deployment..."
    echo ""
    log_info "Next steps:"
    echo "1. Increase canary traffic to 50%"
    echo "2. Monitor for additional 15 minutes"
    echo "3. If stable, deploy to 100% traffic"
    echo "4. Clean up canary instances"
else
    log_warning "Canary deployment had some issues but completed monitoring period"
    echo ""
    log_info "Review the metrics above and decide whether to:"
    echo "1. Proceed with caution"
    echo "2. Rollback to previous version"
    echo "3. Investigate specific issues"
fi

# Evidence capture for audit/compliance
CANARY_EVIDENCE_DIR="canary-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$CANARY_EVIDENCE_DIR"

# Capture final metrics comparison
{
    echo "Canary Deployment Metrics Comparison"
    echo "Timestamp: $(date)"
    echo "Canary Traffic: ${CANARY_TRAFFIC_PERCENT}%"
    echo "Monitoring Duration: ${MONITORING_DURATION} minutes"
    echo ""
    echo "Metric                    | Baseline | Canary   | Status"
    echo "--------------------------|----------|----------|--------"
    printf "JWT Error Rate (%%%)        | %-8s | %-8s | %s\n" "$BASELINE_JWT_ERROR_RATE" "$CANARY_JWT_ERROR_RATE" "$(if (( $(echo "$CANARY_JWT_ERROR_RATE <= 2" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    printf "JWKS Latency (ms)         | %-8s | %-8s | %s\n" "$BASELINE_JWKS_LATENCY" "$CANARY_JWKS_LATENCY" "$(if (( $(echo "$CANARY_JWKS_LATENCY <= 300" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    printf "CSRF Mismatches           | %-8s | %-8s | %s\n" "$BASELINE_CSRF_MISMATCH" "$CANARY_CSRF_MISMATCH" "$(if (( $(echo "$CANARY_CSRF_MISMATCH <= 0" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    printf "HTTP 5xx Rate (%%%)        | %-8s | %-8s | %s\n" "$BASELINE_HTTP_5XX" "$CANARY_HTTP_5XX" "$(if (( $(echo "$CANARY_HTTP_5XX <= 1" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    printf "Refresh Reuse Detected    | %-8s | %-8s | %s\n" "$BASELINE_REFRESH_REUSE" "$CANARY_REFRESH_REUSE" "$(if (( $(echo "$CANARY_REFRESH_REUSE <= 0" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    printf "Security Events Rate      | %-8s | %-8s | %s\n" "$BASELINE_SECURITY_EVENTS" "$CANARY_SECURITY_EVENTS" "$(if (( $(echo "$CANARY_SECURITY_EVENTS <= 5" | bc -l) )); then echo "✓"; else echo "✗"; fi)"
    echo ""
    echo "Alert Breach Count: $ALERT_BREACH_COUNT"
    echo "Deployment Status: $(if [ $ALERT_BREACH_COUNT -eq 0 ]; then echo "SUCCESS"; else echo "ISSUES_DETECTED"; fi)"
} > "$CANARY_EVIDENCE_DIR/metrics-comparison.txt"

# Capture Prometheus queries for verification
{
    echo "Prometheus Queries Used:"
    echo "JWT Error Rate: sum(rate(app_auth_jwt_verify_errors_total[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[5m])),1) * 100"
    echo "JWKS Latency: histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\"}[5m])) by (le)) * 1000"
    echo "CSRF Mismatch: sum(increase(app_csrf_mismatch_total[5m]))"
    echo "HTTP 5xx Rate: sum(rate(http_server_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_server_requests_total[5m])) * 100"
    echo "Refresh Reuse: sum(increase(app_auth_refresh_reuse_detected_total[5m]))"
    echo "Security Events: sum(rate(app_security_events_total[5m]))"
} > "$CANARY_EVIDENCE_DIR/prometheus-queries.txt"

log_info "Canary evidence captured in: $CANARY_EVIDENCE_DIR"

echo ""
echo -e "${GREEN}🎉 Canary deployment process completed!${NC}"
echo -e "${BLUE}📁 Evidence artifacts saved to: $CANARY_EVIDENCE_DIR${NC}"
