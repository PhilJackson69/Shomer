# Create immutable audit archive of v1.0.0 release evidence
# Idempotent script - safe to run multiple times

param(
    [string]$Timestamp = (Get-Date -Format "yyyyMMdd")
)

$ReleaseDir = "releases/v1.0.0"
$ArchiveDir = "releases/audit-archive"
$ArchiveName = "audit-archive-$Timestamp"
$Tarball = "$ArchiveName.tar.gz"
$Sha256File = "$ArchiveName.sha256"
$SigFile = "$ArchiveName.sig"

Write-Host "🔒 Creating immutable audit archive for Shomer v1.0.0" -ForegroundColor Green
Write-Host "📅 Timestamp: $Timestamp" -ForegroundColor Cyan
Write-Host "📁 Source: $ReleaseDir" -ForegroundColor Cyan
Write-Host "📦 Archive: $ArchiveDir/$Tarball" -ForegroundColor Cyan

# Create archive directory if it doesn't exist
if (!(Test-Path $ArchiveDir)) {
    New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
}

# Check if release directory exists
if (!(Test-Path $ReleaseDir)) {
    Write-Host "❌ Error: Release directory $ReleaseDir not found" -ForegroundColor Red
    exit 1
}

# Create tarball using tar (available in Windows 10+)
Write-Host "📦 Creating tarball..." -ForegroundColor Yellow
tar -czf "$ArchiveDir\$Tarball" -C "releases" "v1.0.0"

# Generate SHA256 checksum
Write-Host "🔐 Generating SHA256 checksum..." -ForegroundColor Yellow
$ArchiveHash = (Get-FileHash "$ArchiveDir/$Tarball" -Algorithm SHA256).Hash.ToLower()
$ArchiveHash | Out-File -FilePath "$ArchiveDir/$Sha256File" -Encoding ASCII

# Create deterministic pseudo-signature
Write-Host "✍️  Creating deterministic signature..." -ForegroundColor Yellow
$ManifestHash = (Get-FileHash "$ReleaseDir/AUDIT_MANIFEST.sha256" -Algorithm SHA256).Hash.ToLower()
$SignatureInput = "$ArchiveHash`n$ManifestHash"
$Signature = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($SignatureInput))) -Algorithm SHA256).Hash.ToLower()
$Signature | Out-File -FilePath "$ArchiveDir/$SigFile" -Encoding ASCII

# Display results
Write-Host ""
Write-Host "✅ Audit archive created successfully!" -ForegroundColor Green
Write-Host "📦 Archive: $ArchiveDir/$Tarball" -ForegroundColor Cyan
Write-Host "🔐 SHA256:  $ArchiveDir/$Sha256File" -ForegroundColor Cyan
Write-Host "✍️  Signature: $ArchiveDir/$SigFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Archive details:" -ForegroundColor Yellow
$FileSize = (Get-Item "$ArchiveDir/$Tarball").Length
Write-Host "   Size: $([math]::Round($FileSize/1MB, 2)) MB"
Write-Host "   Archive SHA256: $ArchiveHash"
Write-Host "   Manifest SHA256: $ManifestHash"
Write-Host "   Signature: $Signature"
Write-Host ""
Write-Host "🔍 First 12 chars of archive SHA256: $($ArchiveHash.Substring(0, 12))" -ForegroundColor Magenta
