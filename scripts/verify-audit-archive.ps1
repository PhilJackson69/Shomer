# Verify audit archive integrity
# Usage: .\scripts\verify-audit-archive.ps1 [YYYYMMDD]
# If no date provided, uses most recent archive

param(
    [string]$Timestamp = ""
)

if ($Timestamp -eq "") {
    # Find most recent archive
    $Archives = Get-ChildItem "releases/audit-archive/audit-archive-*.tar.gz" -ErrorAction SilentlyContinue
    if ($Archives.Count -eq 0) {
        Write-Host "❌ Error: No audit archive found in releases/audit-archive/" -ForegroundColor Red
        Write-Host "Usage: .\scripts\verify-audit-archive.ps1 [YYYYMMDD]" -ForegroundColor Yellow
        exit 1
    }
    $LatestArchive = $Archives | Sort-Object Name -Descending | Select-Object -First 1
    $Timestamp = $LatestArchive.Name -replace "audit-archive-(\d{8}).*", '$1'
}

$ArchiveName = "audit-archive-$Timestamp"
$Tarball = "releases/audit-archive/$ArchiveName.tar.gz"
$Sha256File = "releases/audit-archive/$ArchiveName.sha256"
$SigFile = "releases/audit-archive/$ArchiveName.sig"

Write-Host "🔍 Verifying audit archive: $ArchiveName" -ForegroundColor Green
Write-Host "📅 Date: $Timestamp" -ForegroundColor Cyan

# Check if all required files exist
$RequiredFiles = @($Tarball, $Sha256File, $SigFile)
foreach ($file in $RequiredFiles) {
    if (!(Test-Path $file)) {
        Write-Host "❌ Error: Required file not found: $file" -ForegroundColor Red
        exit 1
    }
}

# Verify SHA256 checksum
Write-Host "🔐 Verifying SHA256 checksum..." -ForegroundColor Yellow
$ExpectedHash = (Get-Content $Sha256File).Trim()
$ActualHash = (Get-FileHash $Tarball -Algorithm SHA256).Hash.ToLower()

if ($ExpectedHash -ne $ActualHash) {
    Write-Host "❌ SHA256 verification FAILED!" -ForegroundColor Red
    Write-Host "   Expected: $ExpectedHash" -ForegroundColor Red
    Write-Host "   Actual:   $ActualHash" -ForegroundColor Red
    exit 1
}

Write-Host "✅ SHA256 verification passed" -ForegroundColor Green

# Verify signature
Write-Host "✍️  Verifying signature..." -ForegroundColor Yellow
$ArchiveHash = (Get-FileHash $Tarball -Algorithm SHA256).Hash.ToLower()
$ManifestHash = (Get-FileHash "releases/v1.0.0/AUDIT_MANIFEST.sha256" -Algorithm SHA256).Hash.ToLower()
$SignatureInput = "$ArchiveHash`n$ManifestHash"
$ExpectedSig = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($SignatureInput))) -Algorithm SHA256).Hash.ToLower()
$ActualSig = (Get-Content $SigFile).Trim()

if ($ExpectedSig -ne $ActualSig) {
    Write-Host "❌ Signature verification FAILED!" -ForegroundColor Red
    Write-Host "   Expected: $ExpectedSig" -ForegroundColor Red
    Write-Host "   Actual:   $ActualSig" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Signature verification passed" -ForegroundColor Green

# Display verification results
Write-Host ""
Write-Host "🎉 Audit archive verification SUCCESSFUL!" -ForegroundColor Green
Write-Host "📦 Archive: $Tarball" -ForegroundColor Cyan
Write-Host "🔐 SHA256: $ActualHash" -ForegroundColor Cyan
Write-Host "✍️  Signature: $ActualSig" -ForegroundColor Cyan
$FileSize = (Get-Item $Tarball).Length
Write-Host "📊 Size: $([math]::Round($FileSize/1MB, 2)) MB" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 First 12 chars of archive SHA256: $($ActualHash.Substring(0, 12))" -ForegroundColor Magenta
