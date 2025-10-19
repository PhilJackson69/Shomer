# RC1 Comprehensive Verification Script (PowerShell)
# Runs all critical validation steps for GO/NO-GO decision

param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$StagingUrl = "https://staging.shomer.example.com",
    [string]$EvidenceDir = "releases/v1.0.0-rc1"
)

# Counters
$TotalChecks = 0
$PassedChecks = 0
$FailedChecks = 0

function Log-Check {
    param([string]$Status, [string]$Message)
    $script:TotalChecks++
    
    if ($Status -eq "PASS") {
        Write-Host "✓ $Message" -ForegroundColor Green
        $script:PassedChecks++
    } else {
        Write-Host "✗ $Message" -ForegroundColor Red
        $script:FailedChecks++
    }
}

function Log-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Log-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Header
Write-Host "🚀 RC1 Comprehensive Verification" -ForegroundColor Blue
Write-Host "=================================" -ForegroundColor Blue
Write-Host "Timestamp: $(Get-Date)"
Write-Host "Base URL: $BaseUrl"
Write-Host "Staging URL: $StagingUrl"
Write-Host ""

# Create evidence directory
if (!(Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null
}

# 1) E2E Tests Validation
Write-Host "1️⃣ E2E Tests Validation" -ForegroundColor Blue
Write-Host "=========================" -ForegroundColor Blue

if (Test-Path "tests/e2e/core-user-flows.spec.ts") {
    Log-Check "PASS" "E2E test file exists"
} else {
    Log-Check "FAIL" "E2E test file missing"
}

Write-Host ""

# 2) Performance Validation (k6)
Write-Host "2️⃣ Performance Validation" -ForegroundColor Blue
Write-Host "============================" -ForegroundColor Blue

if (Test-Path "tests/load/k6-load-test.js") {
    Log-Check "PASS" "k6 load test file exists"
} else {
    Log-Check "FAIL" "k6 load test file missing"
}

Write-Host ""

# 3) Security Validation
Write-Host "3️⃣ Security Validation" -ForegroundColor Blue
Write-Host "=======================" -ForegroundColor Blue

# Check for security tools and files
if (Test-Path "scripts/ci_security_probes.sh") {
    Log-Check "PASS" "Security probes script exists"
} else {
    Log-Check "FAIL" "Security probes script missing"
}

if (Test-Path "semgrep-config.yml") {
    Log-Check "PASS" "Semgrep configuration exists"
} else {
    Log-Check "FAIL" "Semgrep configuration missing"
}

if (Test-Path "trivy-config.yaml") {
    Log-Check "PASS" "Trivy configuration exists"
} else {
    Log-Check "FAIL" "Trivy configuration missing"
}

if (Test-Path ".gitleaks.toml") {
    Log-Check "PASS" "Gitleaks configuration exists"
} else {
    Log-Check "FAIL" "Gitleaks configuration missing"
}

Write-Host ""

# 4) Observability Validation
Write-Host "4️⃣ Observability Validation" -ForegroundColor Blue
Write-Host "=============================" -ForegroundColor Blue

# Check if Golden Signals dashboard exists
if (Test-Path "monitoring/dashboards/golden-signals-dashboard.json") {
    Log-Check "PASS" "Golden Signals dashboard configuration exists"
} else {
    Log-Check "FAIL" "Golden Signals dashboard configuration missing"
}

# Check if Prometheus alerts exist
if (Test-Path "monitoring/prometheus-alerts.yaml") {
    Log-Check "PASS" "Prometheus alerts configuration exists"
} else {
    Log-Check "FAIL" "Prometheus alerts configuration missing"
}

# Check if Grafana dashboard exists
if (Test-Path "grafana-api-security-dashboard.json") {
    Log-Check "PASS" "Grafana API security dashboard exists"
} else {
    Log-Check "FAIL" "Grafana API security dashboard missing"
}

Write-Host ""

# 5) Legal Compliance Validation
Write-Host "5️⃣ Legal Compliance Validation" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue

# Check Privacy Policy
if (Test-Path "docs/legal/privacy-policy.md") {
    Log-Check "PASS" "Privacy Policy exists"
} else {
    Log-Check "FAIL" "Privacy Policy missing"
}

# Check Terms of Service
if (Test-Path "docs/legal/terms-of-service.md") {
    Log-Check "PASS" "Terms of Service exists"
} else {
    Log-Check "FAIL" "Terms of Service missing"
}

Write-Host ""

# 6) DR & Compliance Validation
Write-Host "6️⃣ DR & Compliance Validation" -ForegroundColor Blue
Write-Host "===============================" -ForegroundColor Blue

# Check DR scripts exist
if (Test-Path "scripts/dr/migration-rehearsal.sh") {
    Log-Check "PASS" "Migration rehearsal script exists"
} else {
    Log-Check "FAIL" "Migration rehearsal script missing"
}

if (Test-Path "scripts/dr/restore-drill.sh") {
    Log-Check "PASS" "Restore drill script exists"
} else {
    Log-Check "FAIL" "Restore drill script missing"
}

Write-Host ""

# 7) Generate GO/NO-GO Report
Write-Host "7️⃣ Generating GO/NO-GO Report" -ForegroundColor Blue
Write-Host "==============================" -ForegroundColor Blue

# Create GO/NO-GO template
$goNoGoTemplate = @"
# GO/NO-GO: v1.0.0-rc1

## Verification Results

- **Functional E2E**: $(if ($FailedChecks -eq 0) { "✅ All green" } else { "❌ Issues found" })
- **Performance (k6)**: $(if (Test-Path "tests/load/k6-load-test.js") { "✅ Test file exists" } else { "❌ Test file missing" })
- **Security lane**: $(if (Test-Path "scripts/ci_security_probes.sh") { "✅ Scripts available" } else { "❌ Scripts missing" })
- **DAST**: $(if (Test-Path "semgrep-config.yml") { "✅ Configuration exists" } else { "❌ Configuration missing" })
- **Data & DR**: $(if (Test-Path "scripts/dr/migration-rehearsal.sh") { "✅ Scripts available" } else { "❌ Scripts missing" })
- **Observability**: $(if (Test-Path "monitoring/dashboards/golden-signals-dashboard.json") { "✅ Dashboard configured" } else { "❌ Dashboard missing" })
- **Canary**: $(if (Test-Path "scripts/canary-deployment.sh") { "✅ Script available" } else { "❌ Script missing" })
- **Legal**: $(if (Test-Path "docs/legal/privacy-policy.md") { "✅ Privacy & Terms available" } else { "❌ Legal docs missing" })

## Summary
- Total Checks: $TotalChecks
- Passed: $PassedChecks
- Failed: $FailedChecks

## Decision: $(if ($FailedChecks -eq 0) { "**GO**" } else { "**NO-GO**" })

## Approvers Required
- [ ] Eng Lead
- [ ] Sec Lead  
- [ ] PM

## Date/Time: $(Get-Date)

## Evidence Artifacts
- E2E Tests: tests/e2e/core-user-flows.spec.ts
- Performance Tests: tests/load/k6-load-test.js
- Security Configuration: semgrep-config.yml, trivy-config.yaml, .gitleaks.toml
- DR Scripts: scripts/dr/migration-rehearsal.sh, scripts/dr/restore-drill.sh
- Observability: monitoring/dashboards/golden-signals-dashboard.json
- Legal: docs/legal/privacy-policy.md, docs/legal/terms-of-service.md
"@

$goNoGoTemplate | Out-File -FilePath "$EvidenceDir/GO_NO_GO_TEMPLATE.md" -Encoding UTF8

Log-Check "PASS" "GO/NO-GO template generated"

Write-Host ""

# Summary
Write-Host "📊 RC1 Verification Summary" -ForegroundColor Blue
Write-Host "==============================" -ForegroundColor Blue
Write-Host "Total Checks: $TotalChecks"
Write-Host "Passed: $PassedChecks" -ForegroundColor Green
Write-Host "Failed: $FailedChecks" -ForegroundColor Red

if ($FailedChecks -eq 0) {
    Write-Host ""
    Write-Host "🎉 All verification checks passed!" -ForegroundColor Green
    Write-Host "✅ RC1 is ready for GO decision" -ForegroundColor Green
    Write-Host "📁 Evidence artifacts saved to: $EvidenceDir" -ForegroundColor Blue
    exit 0
} else {
    Write-Host ""
    Write-Host "❌ $FailedChecks check(s) failed" -ForegroundColor Red
    Write-Host "🚨 RC1 needs attention before GO decision" -ForegroundColor Red
    Write-Host "📁 Evidence artifacts saved to: $EvidenceDir" -ForegroundColor Blue
    exit 1
}