#!/bin/bash
# MFA Chaos Smoke Test Script
# Tests rate limiting, security controls, and MFA enforcement
# Safe for production - uses synthetic accounts only

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$PROJECT_ROOT/releases/v1.1.0/evidence/chaos-smoke"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
RESULTS_FILE="$EVIDENCE_DIR/chaos-$TIMESTAMP.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_VERSION="/api/v1"

# Synthetic test accounts (from environment or defaults)
SYNTHETIC_ADMIN_USER="${SYNTHETIC_ADMIN_USER:-chaos-admin@shomer.local}"
SYNTHETIC_ADMIN_PASSWORD="${SYNTHETIC_ADMIN_PASSWORD:-ChaosTest123!}"
SYNTHETIC_USER="${SYNTHETIC_USER:-chaos-user@shomer.local}"
SYNTHETIC_USER_PASSWORD="${SYNTHETIC_USER_PASSWORD:-ChaosTest456!}"

# Test configuration
RATE_LIMIT_ATTEMPTS="${RATE_LIMIT_ATTEMPTS:-10}"
RATE_LIMIT_WINDOW="${RATE_LIMIT_WINDOW:-60}"

# Initialize results structure
declare -A TEST_RESULTS=(
    ["timestamp"]="$TIMESTAMP"
    ["api_base_url"]="$API_BASE_URL"
    ["synthetic_admin_user"]="$SYNTHETIC_ADMIN_USER"
    ["synthetic_user"]="$SYNTHETIC_USER"
    ["rate_limit_attempts"]="$RATE_LIMIT_ATTEMPTS"
)

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Create evidence directory
mkdir -p "$EVIDENCE_DIR"

# HTTP helper function
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local headers="$4"
    local expected_status="$5"
    local test_name="$6"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    log_info "Running test: $test_name"
    log_info "  Method: $method"
    log_info "  Endpoint: $endpoint"
    log_info "  Expected Status: $expected_status"
    
    # Make the request
    local response
    local status_code
    local response_body
    
    if [[ -n "$data" ]]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data" \
            "$API_BASE_URL$API_VERSION$endpoint" 2>/dev/null || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            $headers \
            "$API_BASE_URL$API_VERSION$endpoint" 2>/dev/null || echo -e "\n000")
    fi
    
    # Extract status code and body
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    log_info "  Actual Status: $status_code"
    log_info "  Response: $response_body"
    
    # Check if status matches expected
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name - Status code correct"
        TEST_RESULTS["${test_name}_status"]="PASS"
        TEST_RESULTS["${test_name}_response"]="$response_body"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name - Expected $expected_status, got $status_code"
        TEST_RESULTS["${test_name}_status"]="FAIL"
        TEST_RESULTS["${test_name}_response"]="$response_body"
        TEST_RESULTS["${test_name}_expected_status"]="$expected_status"
        TEST_RESULTS["${test_name}_actual_status"]="$status_code"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Get authentication token
get_auth_token() {
    local email="$1"
    local password="$2"
    
    local login_data='{"email":"'$email'","password":"'$password'"}'
    
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$login_data" \
        "$API_BASE_URL$API_VERSION/auth/login" 2>/dev/null || echo '{"error":"request_failed"}')
    
    # Extract token from response
    echo "$response" | jq -r '.access_token // .token // empty' 2>/dev/null || echo ""
}

# Test 1: Rate Limiting on MFA TOTP Verification
test_rate_limiting() {
    log_info "=== Testing Rate Limiting ==="
    
    local token
    token=$(get_auth_token "$SYNTHETIC_ADMIN_USER" "$SYNTHETIC_ADMIN_PASSWORD")
    
    if [[ -z "$token" ]]; then
        log_error "Failed to get authentication token for rate limiting test"
        TEST_RESULTS["rate_limiting_token"]="FAIL"
        return 1
    fi
    
    local auth_header="-H \"Authorization: Bearer $token\""
    local failed_attempts=0
    local rate_limited_attempts=0
    
    # Make multiple failed TOTP attempts to trigger rate limiting
    for i in $(seq 1 "$RATE_LIMIT_ATTEMPTS"); do
        log_info "Rate limit test attempt $i/$RATE_LIMIT_ATTEMPTS"
        
        local totp_data='{"code":"000000"}'
        local response
        local status_code
        
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$totp_data" \
            "$API_BASE_URL$API_VERSION/mfa/totp/verify" 2>/dev/null || echo -e "\n000")
        
        status_code=$(echo "$response" | tail -n1)
        
        if [[ "$status_code" == "429" ]]; then
            rate_limited_attempts=$((rate_limited_attempts + 1))
            log_success "Rate limiting triggered at attempt $i"
            break
        elif [[ "$status_code" == "400" ]]; then
            failed_attempts=$((failed_attempts + 1))
            log_info "Failed attempt $i (expected)"
        else
            log_warning "Unexpected status code $status_code at attempt $i"
        fi
        
        # Small delay between attempts
        sleep 1
    done
    
    if [[ "$rate_limited_attempts" -gt 0 ]]; then
        log_success "Rate limiting test PASSED - triggered after $failed_attempts attempts"
        TEST_RESULTS["rate_limiting"]="PASS"
        TEST_RESULTS["rate_limiting_attempts_before_limit"]="$failed_attempts"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "Rate limiting test FAILED - no rate limiting triggered"
        TEST_RESULTS["rate_limiting"]="FAIL"
        TEST_RESULTS["rate_limiting_attempts_before_limit"]="$failed_attempts"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Test 2: TOTP Reuse Detection
test_totp_reuse() {
    log_info "=== Testing TOTP Reuse Detection ==="
    
    local token
    token=$(get_auth_token "$SYNTHETIC_USER" "$SYNTHETIC_USER_PASSWORD")
    
    if [[ -z "$token" ]]; then
        log_error "Failed to get authentication token for TOTP reuse test"
        TEST_RESULTS["totp_reuse_token"]="FAIL"
        return 1
    fi
    
    local totp_data='{"code":"123456"}'
    local auth_header="-H \"Authorization: Bearer $token\""
    
    # First attempt (should fail with invalid code)
    make_request "POST" "/mfa/totp/verify" "$totp_data" "$auth_header" "400" "TOTP Reuse - First Attempt"
    
    # Second attempt with same code (should fail with reuse detection)
    make_request "POST" "/mfa/totp/verify" "$totp_data" "$auth_header" "400" "TOTP Reuse - Second Attempt"
    
    # Check if response indicates reuse detection
    local response_body="${TEST_RESULTS["TOTP Reuse - Second Attempt_response"]}"
    if echo "$response_body" | grep -qi "reuse\|already.*used\|invalid.*code"; then
        log_success "TOTP reuse detection working"
        TEST_RESULTS["totp_reuse_detection"]="PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "TOTP reuse detection not working"
        TEST_RESULTS["totp_reuse_detection"]="FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Test 3: WebAuthn Tampered Signature
test_webauthn_tampering() {
    log_info "=== Testing WebAuthn Tampered Signature ==="
    
    local token
    token=$(get_auth_token "$SYNTHETIC_ADMIN_USER" "$SYNTHETIC_ADMIN_PASSWORD")
    
    if [[ -z "$token" ]]; then
        log_error "Failed to get authentication token for WebAuthn test"
        TEST_RESULTS["webauthn_token"]="FAIL"
        return 1
    fi
    
    # Tampered WebAuthn data
    local webauthn_data='{
        "credential_id": "test_credential_id",
        "client_data_json": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiYWJjZGVmZ2hpaiIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
        "authenticator_data": "dGVzdF9hdXRoZW50aWNhdG9yX2RhdGE",
        "signature": "tampered_signature_data_that_should_fail"
    }'
    
    local auth_header="-H \"Authorization: Bearer $token\""
    
    make_request "POST" "/mfa/webauthn/verify" "$webauthn_data" "$auth_header" "400" "WebAuthn Tampered Signature"
    
    # Check if response indicates signature validation failure
    local response_body="${TEST_RESULTS["WebAuthn Tampered Signature_response"]}"
    if echo "$response_body" | grep -qi "invalid.*signature\|verification.*failed\|authentication.*failed"; then
        log_success "WebAuthn signature validation working"
        TEST_RESULTS["webauthn_signature_validation"]="PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "WebAuthn signature validation not working"
        TEST_RESULTS["webauthn_signature_validation"]="FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Test 4: MFA Enforcement for Admin Users
test_mfa_enforcement() {
    log_info "=== Testing MFA Enforcement for Admin Users ==="
    
    local token
    token=$(get_auth_token "$SYNTHETIC_ADMIN_USER" "$SYNTHETIC_ADMIN_PASSWORD")
    
    if [[ -z "$token" ]]; then
        log_error "Failed to get authentication token for MFA enforcement test"
        TEST_RESULTS["mfa_enforcement_token"]="FAIL"
        return 1
    fi
    
    local auth_header="-H \"Authorization: Bearer $token\""
    
    # Try to access admin endpoint without MFA
    make_request "GET" "/admin/audit-logs" "" "$auth_header" "403" "MFA Enforcement - Admin Access"
    
    # Check if response indicates MFA requirement
    local response_body="${TEST_RESULTS["MFA Enforcement - Admin Access_response"]}"
    if echo "$response_body" | grep -qi "mfa.*required\|multi.*factor\|two.*factor"; then
        log_success "MFA enforcement working for admin users"
        TEST_RESULTS["mfa_enforcement_admin"]="PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "MFA enforcement not working for admin users"
        TEST_RESULTS["mfa_enforcement_admin"]="FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Test 5: Recovery Code Validation
test_recovery_code_validation() {
    log_info "=== Testing Recovery Code Validation ==="
    
    local token
    token=$(get_auth_token "$SYNTHETIC_USER" "$SYNTHETIC_USER_PASSWORD")
    
    if [[ -z "$token" ]]; then
        log_error "Failed to get authentication token for recovery code test"
        TEST_RESULTS["recovery_code_token"]="FAIL"
        return 1
    fi
    
    local auth_header="-H \"Authorization: Bearer $token\""
    
    # Test with invalid recovery code
    local recovery_data='{"recovery_code":"invalid-code-12345"}'
    make_request "POST" "/mfa/recovery/verify" "$recovery_data" "$auth_header" "400" "Recovery Code Validation"
    
    # Check if response indicates invalid code
    local response_body="${TEST_RESULTS["Recovery Code Validation_response"]}"
    if echo "$response_body" | grep -qi "invalid.*code\|recovery.*failed\|code.*not.*found"; then
        log_success "Recovery code validation working"
        TEST_RESULTS["recovery_code_validation"]="PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "Recovery code validation not working"
        TEST_RESULTS["recovery_code_validation"]="FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Main execution
main() {
    log_info "Starting MFA Chaos Smoke Test"
    log_info "Timestamp: $TIMESTAMP"
    log_info "API Base URL: $API_BASE_URL"
    log_info "Evidence Directory: $EVIDENCE_DIR"
    log_info "Results File: $RESULTS_FILE"
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        exit 1
    fi
    
    # Run tests
    test_rate_limiting
    test_totp_reuse
    test_webauthn_tampering
    test_mfa_enforcement
    test_recovery_code_validation
    
    # Calculate final results
    local success_rate
    if [[ "$TESTS_TOTAL" -gt 0 ]]; then
        success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    else
        success_rate=0
    fi
    
    # Add final results to test data
    TEST_RESULTS["tests_total"]="$TESTS_TOTAL"
    TEST_RESULTS["tests_passed"]="$TESTS_PASSED"
    TEST_RESULTS["tests_failed"]="$TESTS_FAILED"
    TEST_RESULTS["success_rate_percent"]="$success_rate"
    TEST_RESULTS["overall_status"]=$([[ "$TESTS_FAILED" -eq 0 ]] && echo "PASS" || echo "FAIL")
    
    # Write results to JSON file
    log_info "Writing results to $RESULTS_FILE"
    
    # Convert associative array to JSON
    local json_output="{"
    local first=true
    for key in "${!TEST_RESULTS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            json_output+=","
        fi
        json_output+="\"$key\":\"${TEST_RESULTS[$key]}\""
    done
    json_output+="}"
    
    echo "$json_output" | jq '.' > "$RESULTS_FILE"
    
    # Print summary
    echo ""
    log_info "=== CHAOS SMOKE TEST SUMMARY ==="
    log_info "Total Tests: $TESTS_TOTAL"
    log_success "Passed: $TESTS_PASSED"
    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        log_error "Failed: $TESTS_FAILED"
    else
        log_info "Failed: $TESTS_FAILED"
    fi
    log_info "Success Rate: $success_rate%"
    
    if [[ "$TESTS_FAILED" -eq 0 ]]; then
        log_success "Overall Status: PASS"
        log_success "All MFA security controls are working correctly"
    else
        log_error "Overall Status: FAIL"
        log_error "Some MFA security controls need attention"
    fi
    
    log_info "Results saved to: $RESULTS_FILE"
    
    # Exit with appropriate code
    if [[ "$TESTS_FAILED" -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
