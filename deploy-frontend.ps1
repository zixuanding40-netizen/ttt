$ErrorActionPreference = "Stop"

$nginxDir = "C:\deploy\nginx-1.28.0"
$distDir = "C:\deploy\dist"
$zipPath = "C:\Users\Administrator\Desktop\movie-dist.zip"

Write-Host "Checking frontend package..." -ForegroundColor Cyan
if (!(Test-Path $zipPath)) {
  throw "Cannot find $zipPath. Please copy movie-dist.zip to the server desktop first."
}

Write-Host "Stopping nginx if it is running..." -ForegroundColor Cyan
if (Test-Path "$nginxDir\nginx.exe") {
  Push-Location $nginxDir
  try {
    .\nginx.exe -s stop 2>$null
  } catch {
    Write-Host "Nginx was not running or could not be stopped cleanly. Continuing..." -ForegroundColor Yellow
  }
  Pop-Location
} else {
  throw "Cannot find $nginxDir\nginx.exe"
}

Write-Host "Replacing $distDir ..." -ForegroundColor Cyan
if (Test-Path $distDir) {
  Remove-Item -Recurse -Force $distDir
}

Expand-Archive -Path $zipPath -DestinationPath "C:\deploy" -Force

if (!(Test-Path "$distDir\index.html")) {
  throw "Deploy failed: $distDir\index.html was not found after extraction."
}

$indexContent = Get-Content "$distDir\index.html" -Raw
Write-Host "Current index.html asset references:" -ForegroundColor Cyan
($indexContent | Select-String -Pattern "/assets/[^`"']+" -AllMatches).Matches.Value | Sort-Object -Unique

Write-Host "Starting nginx..." -ForegroundColor Cyan
Push-Location $nginxDir
.\nginx.exe -t
Start-Process .\nginx.exe
Pop-Location

Write-Host ""
Write-Host "Done. Open http://8.210.26.129/?v=guest and press Ctrl+F5." -ForegroundColor Green
