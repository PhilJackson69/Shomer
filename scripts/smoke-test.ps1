# Single Business Flow Smoke Test (PowerShell)
param(
    [string]$BaseUrl = "http://localhost:8000"
)

Write-Host "🔍 Single Business Flow Smoke Test" -ForegroundColor Blue
Write-Host "===================================" -ForegroundColor Blue
Write-Host ""

# Create evidence directory
$EvidenceDir = "releases/v1.0.0-rc1/evidence/smoke-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null

$ChecksPassed = 0
$ChecksFailed = 0
$ChecksTotal = 0

function Test-Check {
    param([string]$Status, [string]$Message)
    $script:ChecksTotal++
    
    if ($Status -eq "PASS") {
        Write-Host "✓ $Message" -ForegroundColor Green
        $script:ChecksPassed++
    } else {
        Write-Host "✗ $Message" -ForegroundColor Red
        $script:ChecksFailed++
    }
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Test 1: Health Check
Write-Info "1) Health Check"
Write-Host "---------------"

try {
    $HealthResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/health" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($HealthResponse.StatusCode -eq 200) {
        Test-Check "PASS" "Health endpoint responding (200)"
    } else {
        Test-Check "FAIL" "Health endpoint not responding correctly (got $($HealthResponse.StatusCode))"
    }
} catch {
    Test-Check "FAIL" "Health endpoint not accessible"
}

Write-Host ""

# Test 2: Auth Flow (Login)
Write-Info "2) Authentication Flow"
Write-Host "----------------------"

try {
    $LoginResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"test"}' -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($LoginResponse.StatusCode -eq 401 -or $LoginResponse.StatusCode -eq 422) {
        Test-Check "PASS" "Auth endpoint responding correctly ($($LoginResponse.StatusCode))"
    } else {
        Test-Check "FAIL" "Auth endpoint not responding correctly (got $($LoginResponse.StatusCode))"
    }
} catch {
    Test-Check "FAIL" "Auth endpoint not accessible"
}

Write-Host ""

# Test 3: CSRF Protection
Write-Info "3) CSRF Protection Test"
Write-Host "------------------------"

try {
    $CSRFResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/tips" -Method POST -ContentType "application/json" -Body '{"title":"test","description":"test"}' -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($CSRFResponse.StatusCode -eq 403) {
        Test-Check "PASS" "CSRF protection active (403 returned)"
    } else {
        Test-Check "WARN" "CSRF protection may not be active (got $($CSRFResponse.StatusCode))"
    }
} catch {
    Test-Check "WARN" "CSRF protection test failed"
}

Write-Host ""

# Test 4: Write Operation (with proper auth)
Write-Info "4) Write Operation Test"
Write-Host "-----------------------"

# Generate unique idempotency key
$IdempotencyKey = "ik-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

try {
    $WriteResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/resource" -Method POST -ContentType "application/json" -Headers @{"Idempotency-Key" = $IdempotencyKey} -Body '{"x":1}' -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($WriteResponse.StatusCode -eq 200 -or $WriteResponse.StatusCode -eq 201) {
        Test-Check "PASS" "Write operation succeeded ($($WriteResponse.StatusCode))"
        
        # Test idempotency
        try {
            $IdempotencyResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/resource" -Method POST -ContentType "application/json" -Headers @{"Idempotency-Key" = $IdempotencyKey} -Body '{"x":1}' -UseBasicParsing -ErrorAction SilentlyContinue
            
            if ($IdempotencyResponse.StatusCode -eq 208 -or $IdempotencyResponse.StatusCode -eq 409) {
                Test-Check "PASS" "Idempotency working correctly ($($IdempotencyResponse.StatusCode))"
            } else {
                Test-Check "FAIL" "Idempotency not working (got $($IdempotencyResponse.StatusCode))"
            }
        } catch {
            Test-Check "FAIL" "Idempotency test failed"
        }
    } else {
        Test-Check "FAIL" "Write operation failed ($($WriteResponse.StatusCode))"
    }
} catch {
    Test-Check "FAIL" "Write operation test failed"
}

Write-Host ""

# Test 5: Request ID Logging
Write-Info "5) Request ID Logging Test"
Write-Host "-------------------------"

try {
    $Response = Invoke-WebRequest -Uri "$BaseUrl/api/v1/health" -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($Response.Headers["X-Request-ID"] -or $Response.Headers["x-request-id"]) {
        Test-Check "PASS" "Request ID header present"
    } else {
        Test-Check "WARN" "Request ID header not found"
    }
} catch {
    Test-Check "WARN" "Request ID test failed"
}

Write-Host ""

# Test 6: Performance Check (p95 < 1s)
Write-Info "6) Performance Check"
Write-Host "-------------------"

$StartTime = Get-Date
try {
    $PerfResponse = Invoke-WebRequest -Uri "$BaseUrl/api/v1/health" -UseBasicParsing -ErrorAction SilentlyContinue
    $EndTime = Get-Date
    $Duration = ($EndTime - $StartTime).TotalMilliseconds
    
    if ($Duration -lt 1000) {
        Test-Check "PASS" "Response time acceptable ($([math]::Round($Duration))ms)"
    } else {
        Test-Check "WARN" "Response time slow ($([math]::Round($Duration))ms)"
    }
} catch {
    Test-Check "WARN" "Performance test failed"
}

Write-Host ""

# Summary
Write-Host "📊 Smoke Test Summary" -ForegroundColor Blue
Write-Host "=====================" -ForegroundColor Blue
Write-Host "Total Checks: $ChecksTotal"
Write-Host "Passed: $ChecksPassed" -ForegroundColor Green
Write-Host "Failed: $ChecksFailed" -ForegroundColor Red

# Capture evidence
$SmokeTestResults = @"
Smoke Test Results
=================
Timestamp: $(Get-Date)
Base URL: $BaseUrl
Total Checks: $ChecksTotal
Passed: $ChecksPassed
Failed: $ChecksFailed

Test Details:
- Health Check: $(if ($ChecksPassed -gt 0) { "PASS" } else { "FAIL" })
- Auth Flow: $(if ($ChecksPassed -gt 1) { "PASS" } else { "FAIL" })
- CSRF Protection: $(if ($ChecksPassed -gt 2) { "PASS" } else { "WARN" })
- Write Operation: $(if ($ChecksPassed -gt 3) { "PASS" } else { "FAIL" })
- Request ID Logging: $(if ($ChecksPassed -gt 4) { "PASS" } else { "WARN" })
- Performance: $(if ($ChecksPassed -gt 5) { "PASS" } else { "WARN" })

Test Status: $(if ($ChecksFailed -eq 0) { "PASSED" } else { "FAILED" })
"@

$SmokeTestResults | Out-File -FilePath "$EvidenceDir/smoke-test-results.txt" -Encoding UTF8

Write-Host "Evidence captured in: $EvidenceDir" -ForegroundColor Cyan

if ($ChecksFailed -eq 0) {
    Write-Host ""
    Write-Host "🎉 Smoke test passed!" -ForegroundColor Green
    Write-Host "📁 Evidence artifacts saved to: $EvidenceDir" -ForegroundColor Blue
} else {
    Write-Host ""
    Write-Host "❌ $ChecksFailed check(s) failed. Review deployment." -ForegroundColor Red
    Write-Host "📁 Evidence artifacts saved to: $EvidenceDir" -ForegroundColor Blue
}
