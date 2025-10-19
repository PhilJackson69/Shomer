#!/bin/bash
# Shomer 24-Hour Post-Launch Monitoring Script
# Continuous monitoring with Golden Signals dashboard

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
MONITORING_DURATION="${MONITORING_DURATION:-1440}" # 24 hours in minutes
CHECK_INTERVAL="${CHECK_INTERVAL:-360}" # 6 hours between checks
SMOKE_TEST_INTERVAL="${SMOKE_TEST_INTERVAL:-360}" # 6 hours between smoke tests
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

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
echo -e "${BLUE}🔍 Shomer 24-Hour Post-Launch Monitoring${NC}"
echo -e "${BLUE}===========================================${NC}"
echo "Monitoring Duration: ${MONITORING_DURATION} minutes (24 hours)"
echo "Check Interval: ${CHECK_INTERVAL} minutes (6 hours)"
echo "Smoke Test Interval: ${SMOKE_TEST_INTERVAL} minutes (6 hours)"
echo "Start Time: $(date)"
echo ""

# Create evidence directory
EVIDENCE_DIR="releases/v1.0.0/post-launch-monitoring-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Function to query Prometheus
query_prometheus() {
    local query="$1"
    curl -fsS "$PROMETHEUS_URL/api/v1/query?query=$query" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# Function to check Golden Signals
check_golden_signals() {
    local timestamp="$1"
    
    log_info "Checking Golden Signals at $timestamp..."
    
    # Query Golden Signals
    JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total[5m])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[5m])),1) * 100")
    JWKS_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{route=\"/.well-known/jwks.json\"}[5m])) by (le)) * 1000")
    CSRF_MISMATCH=$(query_prometheus "sum(increase(app_csrf_mismatch_total[5m]))")
    HTTP_5XX=$(query_prometheus "sum(rate(http_server_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_server_requests_total[5m])) * 100")
    REFRESH_REUSE=$(query_prometheus "sum(increase(app_auth_refresh_reuse_detected_total[5m]))")
    SECURITY_EVENTS=$(query_prometheus "sum(rate(app_security_events_total[5m]))")
    
    # Calculate p50 and p95 latency
    P50_LATENCY=$(query_prometheus "histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le)) * 1000")
    P95_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le)) * 1000")
    
    # Check thresholds
    local alerts_triggered=0
    local alert_details=""
    
    # JWT error rate check (< 2% p5m)
    if (( $(echo "$JWT_ERROR_RATE > 2" | bc -l) )); then
        alert_details="${alert_details}JWT error rate: ${JWT_ERROR_RATE}% > 2%; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # JWKS latency check (< 300ms p95)
    if (( $(echo "$JWKS_LATENCY > 300" | bc -l) )); then
        alert_details="${alert_details}JWKS latency: ${JWKS_LATENCY}ms > 300ms; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # CSRF mismatch check (should be flat)
    if (( $(echo "$CSRF_MISMATCH > 0" | bc -l) )); then
        alert_details="${alert_details}CSRF mismatch: ${CSRF_MISMATCH} > 0; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # HTTP 5xx check (no regression)
    if (( $(echo "$HTTP_5XX > 1" | bc -l) )); then
        alert_details="${alert_details}HTTP 5xx rate: ${HTTP_5XX}% > 1%; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # Refresh reuse check (should be 0)
    if (( $(echo "$REFRESH_REUSE > 0" | bc -l) )); then
        alert_details="${alert_details}Refresh reuse: ${REFRESH_REUSE} > 0; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # Security events check (monitor for spikes)
    if (( $(echo "$SECURITY_EVENTS > 5" | bc -l) )); then
        alert_details="${alert_details}Security events: ${SECURITY_EVENTS} > 5; "
        alerts_triggered=$((alerts_triggered + 1))
    fi
    
    # Log metrics
    echo "Golden Signals at $timestamp:"
    echo "  JWT Error Rate: ${JWT_ERROR_RATE}%"
    echo "  JWKS Latency: ${JWKS_LATENCY}ms"
    echo "  CSRF Mismatches: ${CSRF_MISMATCH}"
    echo "  HTTP 5xx Rate: ${HTTP_5XX}%"
    echo "  Refresh Reuse Detected: ${REFRESH_REUSE}"
    echo "  Security Events Rate: ${SECURITY_EVENTS}"
    echo "  P50 Latency: ${P50_LATENCY}ms"
    echo "  P95 Latency: ${P95_LATENCY}ms"
    echo "  Alerts Triggered: ${alerts_triggered}"
    
    if [ $alerts_triggered -gt 0 ]; then
        echo "  Alert Details: $alert_details"
    fi
    
    # Save metrics to evidence
    {
        echo "Timestamp: $timestamp"
        echo "JWT Error Rate: ${JWT_ERROR_RATE}%"
        echo "JWKS Latency: ${JWKS_LATENCY}ms"
        echo "CSRF Mismatches: ${CSRF_MISMATCH}"
        echo "HTTP 5xx Rate: ${HTTP_5XX}%"
        echo "Refresh Reuse Detected: ${REFRESH_REUSE}"
        echo "Security Events Rate: ${SECURITY_EVENTS}"
        echo "P50 Latency: ${P50_LATENCY}ms"
        echo "P95 Latency: ${P95_LATENCY}ms"
        echo "Alerts Triggered: ${alerts_triggered}"
        if [ $alerts_triggered -gt 0 ]; then
            echo "Alert Details: $alert_details"
        fi
        echo "Status: $(if [ $alerts_triggered -eq 0 ]; then echo "HEALTHY"; else echo "ALERTS_TRIGGERED"; fi)"
        echo ""
    } >> "$EVIDENCE_DIR/golden-signals.log"
    
    return $alerts_triggered
}

# Function to run smoke test
run_smoke_test() {
    local timestamp="$1"
    
    log_info "Running smoke test at $timestamp..."
    
    if [ -f "scripts/smoke-test-final.ps1" ]; then
        # Run PowerShell smoke test
        if powershell -ExecutionPolicy Bypass -File "scripts/smoke-test-final.ps1" > "$EVIDENCE_DIR/smoke-test-$timestamp.txt" 2>&1; then
            log_success "Smoke test passed at $timestamp"
            return 0
        else
            log_error "Smoke test failed at $timestamp"
            return 1
        fi
    elif [ -f "scripts/smoke-test.sh" ]; then
        # Run bash smoke test
        if bash scripts/smoke-test.sh > "$EVIDENCE_DIR/smoke-test-$timestamp.txt" 2>&1; then
            log_success "Smoke test passed at $timestamp"
            return 0
        else
            log_error "Smoke test failed at $timestamp"
            return 1
        fi
    else
        log_warning "No smoke test script found"
        return 1
    fi
}

# Function to send Slack notification
send_slack_notification() {
    local message="$1"
    local timestamp="$2"
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        local payload="{
            \"text\": \"Shomer Post-Launch Monitoring Report - $timestamp\",
            \"attachments\": [
                {
                    \"color\": \"good\",
                    \"fields\": [
                        {
                            \"title\": \"Status\",
                            \"value\": \"$message\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Timestamp\",
                            \"value\": \"$timestamp\",
                            \"short\": true
                        }
                    ]
                }
            ]
        }"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || log_warning "Failed to send Slack notification"
    fi
}

# Function to generate morning report
generate_morning_report() {
    local timestamp="$1"
    
    log_info "Generating morning report for $timestamp..."
    
    # Get metrics from last 6 hours
    JWT_ERROR_RATE=$(query_prometheus "sum(rate(app_auth_jwt_verify_errors_total[6h])) / clamp_min(sum(rate(app_auth_jwt_verify_attempts_total[6h])),1) * 100")
    P50_LATENCY=$(query_prometheus "histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket[6h])) by (le)) * 1000")
    P95_LATENCY=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[6h])) by (le)) * 1000")
    HTTP_5XX=$(query_prometheus "sum(rate(http_server_requests_total{status=~\"5..\"}[6h])) / sum(rate(http_server_requests_total[6h])) * 100")
    SECURITY_EVENTS=$(query_prometheus "sum(rate(app_security_events_total[6h]))")
    
    # Generate report
    local report="Morning Report - $timestamp

Golden Signals (Last 6 Hours):
- JWT Error Rate: ${JWT_ERROR_RATE}%
- P50 Latency: ${P50_LATENCY}ms
- P95 Latency: ${P95_LATENCY}ms
- HTTP 5xx Rate: ${HTTP_5XX}%
- Security Events: ${SECURITY_EVENTS}

Status: $(if [ $alerts_triggered -eq 0 ]; then echo "HEALTHY"; else echo "ALERTS_TRIGGERED"; fi)

Next Check: $(date -d "+6 hours" "+%Y-%m-%d %H:%M:%S")"
    
    echo "$report"
    
    # Save report to evidence
    echo "$report" > "$EVIDENCE_DIR/morning-report-$timestamp.txt"
    
    # Send to Slack
    send_slack_notification "$report" "$timestamp"
}

# Pre-monitoring checks
log_info "Pre-monitoring checks..."

# Check if Prometheus is accessible
if curl -fsS "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
    log_success "Prometheus is accessible"
else
    log_error "Prometheus is not accessible at $PROMETHEUS_URL"
    exit 1
fi

# Check if Grafana is accessible
if curl -fsS "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    log_success "Grafana is accessible"
else
    log_error "Grafana is not accessible at $GRAFANA_URL"
    exit 1
fi

# Check if BASE_URL is accessible
if [ -n "$BASE_URL" ]; then
    if curl -fsS "$BASE_URL/api/v1/health" > /dev/null 2>&1; then
        log_success "Application is accessible"
    else
        log_error "Application is not accessible at $BASE_URL"
        exit 1
    fi
else
    log_warning "BASE_URL not set, skipping application health check"
fi

echo ""

# Start monitoring
MONITORING_START=$(date +%s)
MONITORING_END=$((MONITORING_START + MONITORING_DURATION * 60))
CHECK_COUNT=0
SMOKE_TEST_COUNT=0
TOTAL_ALERTS=0

log_info "Starting 24-hour post-launch monitoring..."

while [ $(date +%s) -lt $MONITORING_END ]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - MONITORING_START))
    REMAINING=$((MONITORING_END - CURRENT_TIME))
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo -e "\r${BLUE}Monitoring... ${ELAPSED}s elapsed, ${REMAINING}s remaining${NC}" -n
    
    # Check Golden Signals every CHECK_INTERVAL minutes
    if [ $((ELAPSED % (CHECK_INTERVAL * 60))) -eq 0 ]; then
        echo ""
        CHECK_COUNT=$((CHECK_COUNT + 1))
        
        if check_golden_signals "$TIMESTAMP"; then
            log_success "Golden Signals check $CHECK_COUNT passed"
        else
            TOTAL_ALERTS=$((TOTAL_ALERTS + 1))
            log_error "Golden Signals check $CHECK_COUNT failed"
        fi
        
        # Generate morning report every 6 hours
        if [ $((CHECK_COUNT % 4)) -eq 0 ]; then
            generate_morning_report "$TIMESTAMP"
        fi
    fi
    
    # Run smoke test every SMOKE_TEST_INTERVAL minutes
    if [ $((ELAPSED % (SMOKE_TEST_INTERVAL * 60))) -eq 0 ]; then
        echo ""
        SMOKE_TEST_COUNT=$((SMOKE_TEST_COUNT + 1))
        
        if run_smoke_test "$TIMESTAMP"; then
            log_success "Smoke test $SMOKE_TEST_COUNT passed"
        else
            log_error "Smoke test $SMOKE_TEST_COUNT failed"
        fi
    fi
    
    sleep 60
done

echo ""

# Final summary
log_info "24-hour monitoring completed!"

# Generate final report
{
    echo "Shomer 24-Hour Post-Launch Monitoring Report"
    echo "============================================"
    echo ""
    echo "Monitoring Period: $(date -d "@$MONITORING_START" "+%Y-%m-%d %H:%M:%S") to $(date -d "@$MONITORING_END" "+%Y-%m-%d %H:%M:%S")"
    echo "Total Duration: 24 hours"
    echo "Golden Signals Checks: $CHECK_COUNT"
    echo "Smoke Tests: $SMOKE_TEST_COUNT"
    echo "Total Alerts: $TOTAL_ALERTS"
    echo ""
    echo "Final Status: $(if [ $TOTAL_ALERTS -eq 0 ]; then echo "HEALTHY"; else echo "ALERTS_TRIGGERED"; fi)"
    echo ""
    echo "Evidence Files:"
    echo "- golden-signals.log: Golden Signals metrics for each check"
    echo "- morning-report-*.txt: Morning reports every 6 hours"
    echo "- smoke-test-*.txt: Smoke test results"
    echo ""
    echo "Next Steps:"
    if [ $TOTAL_ALERTS -eq 0 ]; then
        echo "1. Declare launch successful"
        echo "2. Tag release as v1.0.0"
        echo "3. Announce launch to community"
        echo "4. Continue normal monitoring"
    else
        echo "1. Investigate $TOTAL_ALERTS alert(s)"
        echo "2. Address identified issues"
        echo "3. Consider rollback if critical"
        echo "4. Re-run monitoring if needed"
    fi
} > "$EVIDENCE_DIR/final-report.txt"

log_info "Post-launch monitoring evidence captured in: $EVIDENCE_DIR"

if [ $TOTAL_ALERTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 24-hour monitoring completed successfully!${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Declare launch successful"
    echo "2. Tag release as v1.0.0"
    echo "3. Announce launch to community"
    echo "4. Continue normal monitoring"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  24-hour monitoring completed with $TOTAL_ALERTS alert(s)${NC}"
    echo -e "${BLUE}📁 Evidence artifacts saved to: $EVIDENCE_DIR${NC}"
    echo ""
    echo -e "${YELLOW}Required Actions:${NC}"
    echo "1. Investigate $TOTAL_ALERTS alert(s)"
    echo "2. Address identified issues"
    echo "3. Consider rollback if critical"
    echo "4. Re-run monitoring if needed"
    exit 1
fi
