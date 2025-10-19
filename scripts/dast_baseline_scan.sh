#!/bin/bash
# DAST Baseline Security Testing with OWASP ZAP
# Runs nightly in CI to detect security vulnerabilities

set -euo pipefail

# Configuration
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:8000}"
ZAP_REPORT_FILE="zap-report.html"
ZAP_LOG_FILE="zap.log"
TIMEOUT=600  # 10 minutes timeout
FAIL_ON_MEDIUM_HIGH=true

echo "🔍 Starting DAST baseline security scan with OWASP ZAP..."
echo "Target URL: $PUBLIC_BASE_URL"
echo "Report file: $ZAP_REPORT_FILE"
echo "=========================================="

# Function to cleanup ZAP processes
cleanup_zap() {
    echo "🧹 Cleaning up ZAP processes..."
    pkill -f zap-baseline.py || true
    pkill -f zap.sh || true
    sleep 2
}

# Function to check if ZAP is available
check_zap_availability() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is required to run ZAP"
        exit 1
    fi
    
    echo "✅ Docker is available"
}

# Function to run ZAP baseline scan
run_zap_scan() {
    echo "🚀 Running ZAP baseline scan..."
    
    # Run ZAP baseline scan with exact parameters from requirements
    docker run --rm -t \
        -v "$(pwd):/zap/wrk/:rw" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-baseline.py \
        -t "$PUBLIC_BASE_URL" \
        -r "$ZAP_REPORT_FILE" \
        -d \
        -m 10 \
        -z "-config scanner.attackOnStart=true" \
        -J "$ZAP_LOG_FILE" \
        --hook "/zap/auth_hook.py" \
        -x "zap-scan-report.xml" \
        -j "zap-scan-report.json" \
        --progress \
        --timeout "$TIMEOUT" || {
        echo "⚠️  ZAP scan completed with warnings or errors"
        ZAP_EXIT_CODE=$?
    }
}

# Function to analyze scan results
analyze_results() {
    echo ""
    echo "📊 Analyzing scan results..."
    
    if [ ! -f "$ZAP_REPORT_FILE" ]; then
        echo "❌ ZAP report file not found: $ZAP_REPORT_FILE"
        return 1
    fi
    
    # Check for Medium/High findings
    if [ "$FAIL_ON_MEDIUM_HIGH" = "true" ]; then
        echo "🔍 Checking for Medium/High severity findings..."
        
        # Count findings by severity (using grep on HTML report)
        HIGH_COUNT=$(grep -c "High" "$ZAP_REPORT_FILE" || echo "0")
        MEDIUM_COUNT=$(grep -c "Medium" "$ZAP_REPORT_FILE" || echo "0")
        
        echo "High severity findings: $HIGH_COUNT"
        echo "Medium severity findings: $MEDIUM_COUNT"
        
        if [ "$HIGH_COUNT" -gt 0 ] || [ "$MEDIUM_COUNT" -gt 0 ]; then
            echo "❌ Found $HIGH_COUNT High and $MEDIUM_COUNT Medium severity findings"
            echo "🚨 Build should fail due to security findings"
            return 1
        else
            echo "✅ No Medium/High severity findings detected"
        fi
    fi
    
    # Check for specific critical vulnerabilities
    echo "🔍 Checking for critical vulnerability patterns..."
    
    CRITICAL_PATTERNS=(
        "SQL Injection"
        "Cross-Site Scripting"
        "Remote Code Execution"
        "Authentication Bypass"
        "Privilege Escalation"
    )
    
    for pattern in "${CRITICAL_PATTERNS[@]}"; do
        if grep -qi "$pattern" "$ZAP_REPORT_FILE"; then
            echo "🚨 CRITICAL: Found potential $pattern vulnerability"
            return 1
        fi
    done
    
    echo "✅ No critical vulnerability patterns detected"
    return 0
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo "📋 DAST Scan Summary"
    echo "=========================================="
    
    if [ -f "$ZAP_REPORT_FILE" ]; then
        echo "✅ ZAP scan completed successfully"
        echo "📄 Report generated: $ZAP_REPORT_FILE"
        
        # Extract key metrics from report
        TOTAL_FINDINGS=$(grep -c "finding" "$ZAP_REPORT_FILE" || echo "0")
        echo "📊 Total findings: $TOTAL_FINDINGS"
        
        # Check report size
        REPORT_SIZE=$(du -h "$ZAP_REPORT_FILE" | cut -f1)
        echo "📏 Report size: $REPORT_SIZE"
        
    else
        echo "❌ ZAP scan failed - no report generated"
        return 1
    fi
}

# Function to publish artifacts (for CI)
publish_artifacts() {
    echo ""
    echo "📤 Publishing scan artifacts..."
    
    # Create artifacts directory
    mkdir -p artifacts/dast
    
    # Copy reports to artifacts
    if [ -f "$ZAP_REPORT_FILE" ]; then
        cp "$ZAP_REPORT_FILE" "artifacts/dast/"
        echo "✅ Published HTML report to artifacts/dast/"
    fi
    
    if [ -f "zap-scan-report.xml" ]; then
        cp "zap-scan-report.xml" "artifacts/dast/"
        echo "✅ Published XML report to artifacts/dast/"
    fi
    
    if [ -f "zap-scan-report.json" ]; then
        cp "zap-scan-report.json" "artifacts/dast/"
        echo "✅ Published JSON report to artifacts/dast/"
    fi
    
    if [ -f "$ZAP_LOG_FILE" ]; then
        cp "$ZAP_LOG_FILE" "artifacts/dast/"
        echo "✅ Published ZAP log to artifacts/dast/"
    fi
}

# Main execution
main() {
    # Set up cleanup trap
    trap cleanup_zap EXIT
    
    # Check prerequisites
    check_zap_availability
    
    # Run the scan
    run_zap_scan
    
    # Analyze results
    if analyze_results; then
        echo "✅ DAST baseline scan passed"
        SCAN_RESULT=0
    else
        echo "❌ DAST baseline scan failed"
        SCAN_RESULT=1
    fi
    
    # Generate summary
    generate_summary
    
    # Publish artifacts
    publish_artifacts
    
    # Final status
    echo ""
    echo "=========================================="
    if [ $SCAN_RESULT -eq 0 ]; then
        echo "🎉 DAST baseline scan completed successfully"
        echo "🔒 No critical security vulnerabilities detected"
    else
        echo "🚨 DAST baseline scan failed"
        echo "⚠️  Security vulnerabilities detected - review report"
    fi
    echo "=========================================="
    
    exit $SCAN_RESULT
}

# Run main function
main "$@"
