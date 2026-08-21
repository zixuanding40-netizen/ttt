$ErrorActionPreference = "Stop"

$zipPath = "C:\Users\Administrator\Desktop\movie-dist.zip"
$deployRoot = "C:\deploy"
$webRoot = "C:\deploy\dist"
$nginxRoot = "C:\deploy\nginx-1.28.0"
$expectedJs = "index-DnHmW-3R.js"
$releaseStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stageRoot = Join-Path $deployRoot "frontend-stage-$releaseStamp"
$backupRoot = Join-Path $deployRoot "backups"
$backupZip = Join-Path $backupRoot "dist-$releaseStamp.zip"

function Assert-UnderPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Parent
  )

  $resolvedParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  $resolvedPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\') + '\'
  if (!$resolvedPath.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to operate outside $resolvedParent : $resolvedPath"
  }
}

Write-Host "Checking release package..." -ForegroundColor Cyan
if (!(Test-Path $zipPath)) {
  throw "Cannot find $zipPath. Upload the latest movie-dist.zip to the server desktop first."
}

if (!(Test-Path "$nginxRoot\nginx.exe")) {
  throw "Cannot find nginx.exe at $nginxRoot"
}

New-Item -ItemType Directory -Force -Path $stageRoot, $backupRoot | Out-Null
Assert-UnderPath -Path $stageRoot -Parent $deployRoot

Write-Host "Extracting package to staging..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $stageRoot -Force
$stagedDist = Join-Path $stageRoot "dist"

if (!(Test-Path "$stagedDist\index.html")) {
  throw "Deploy failed: staged dist/index.html was not found."
}

$indexContent = Get-Content "$stagedDist\index.html" -Raw
if ($indexContent -notmatch [regex]::Escape($expectedJs)) {
  throw "Deploy failed: staged index.html does not reference $expectedJs."
}

if (!(Test-Path "$stagedDist\assets\$expectedJs")) {
  throw "Deploy failed: staged assets\$expectedJs was not found."
}

Write-Host "Backing up current web root..." -ForegroundColor Cyan
if (Test-Path $webRoot) {
  Compress-Archive -Path "$webRoot\*" -DestinationPath $backupZip -Force
} else {
  New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
}

Write-Host "Publishing files. index.html is copied last..." -ForegroundColor Cyan
robocopy $stagedDist $webRoot /E /XF index.html | Out-Host
$robocopyCode = $LASTEXITCODE
if ($robocopyCode -gt 7) {
  throw "robocopy failed with exit code $robocopyCode"
}

Copy-Item "$stagedDist\index.html" "$webRoot\index.html" -Force

$publishedIndex = Get-Content "$webRoot\index.html" -Raw
if ($publishedIndex -notmatch [regex]::Escape($expectedJs)) {
  throw "Deploy failed: published index.html does not reference $expectedJs."
}

Write-Host "Testing nginx config and reloading..." -ForegroundColor Cyan
Push-Location $nginxRoot
try {
  .\nginx.exe -t
  .\nginx.exe -s reload
} finally {
  Pop-Location
}

Write-Host "Checking local nginx response..." -ForegroundColor Cyan
$localHtml = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1/?deploy-check=$releaseStamp" -Headers @{ "Cache-Control" = "no-cache" }).Content
if ($localHtml -notmatch [regex]::Escape($expectedJs)) {
  throw "Local nginx check did not return $expectedJs."
}

Assert-UnderPath -Path $stageRoot -Parent $deployRoot
Remove-Item -Recurse -Force $stageRoot

Write-Host ""
Write-Host "Done. Published $expectedJs" -ForegroundColor Green
Write-Host "Public check: https://www.yingji.cyou/?v=$releaseStamp" -ForegroundColor Green
Write-Host "Cache reset:  https://www.yingji.cyou/reset.html?v=$releaseStamp" -ForegroundColor Green
Write-Host "Backup:       $backupZip" -ForegroundColor Green
