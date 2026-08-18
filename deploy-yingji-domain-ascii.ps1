$ErrorActionPreference = "Stop"

$releaseZip = "C:\Users\Administrator\Desktop\yingji-watch-shell-release.zip"
if (!(Test-Path $releaseZip)) {
  $popupFixZip = "C:\Users\Administrator\Desktop\yingji-popup-fix-release.zip"
  if (Test-Path $popupFixZip) {
    $releaseZip = $popupFixZip
  }
}
if (!(Test-Path $releaseZip)) {
  $discussionZip = "C:\Users\Administrator\Desktop\yingji-public-discussion-release.zip"
  if (Test-Path $discussionZip) {
    $releaseZip = $discussionZip
  }
}
$releaseTemp = "C:\deploy\yingji-release-temp"
$webRoot = "C:\deploy\dist"
$appRoot = "C:\deploy\movie"
$nginxRoot = "C:\deploy\nginx-1.28.0"
$nginxConf = Join-Path $nginxRoot "conf\nginx.conf"

Write-Host "[1/7] Checking release zip..."
if (!(Test-Path $releaseZip)) {
  throw "Release zip not found: $releaseZip"
}

Write-Host "[2/7] Extracting release zip..."
if (Test-Path $releaseTemp) {
  Remove-Item $releaseTemp -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseTemp | Out-Null
Expand-Archive -LiteralPath $releaseZip -DestinationPath $releaseTemp -Force

Write-Host "[3/7] Updating frontend files..."
if (!(Test-Path $webRoot)) {
  New-Item -ItemType Directory -Path $webRoot | Out-Null
}
robocopy (Join-Path $releaseTemp "dist") $webRoot /MIR | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "Failed to copy frontend files. robocopy exit code: $LASTEXITCODE"
}

Write-Host "[4/7] Updating backend files..."
if (!(Test-Path $appRoot)) {
  New-Item -ItemType Directory -Path $appRoot | Out-Null
}
robocopy (Join-Path $releaseTemp "server") (Join-Path $appRoot "server") /MIR /XF .env | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "Failed to copy backend files. robocopy exit code: $LASTEXITCODE"
}
if (!(Test-Path (Join-Path $appRoot "server\.env"))) {
  Copy-Item (Join-Path $releaseTemp "server\.env") (Join-Path $appRoot "server\.env") -Force
}
Copy-Item (Join-Path $releaseTemp "package.json") $appRoot -Force
Copy-Item (Join-Path $releaseTemp "package-lock.json") $appRoot -Force

Write-Host "[5/7] Installing backend dependencies..."
Push-Location $appRoot
npm.cmd install --omit=dev
Pop-Location

Write-Host "[5/7] Preparing database schema..."
$schemaPath = Join-Path $appRoot "server\schema.sql"
$sqlcmd = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue
if ($sqlcmd) {
  try {
    sqlcmd.exe -S localhost,1433 -E -i $schemaPath
  } catch {
    Write-Host "Schema setup skipped or failed. You can run schema.sql manually later."
  }
} else {
  Write-Host "sqlcmd not found. You can run schema.sql manually later."
}

Write-Host "[6/7] Updating nginx api proxy..."
if (!(Test-Path $nginxConf)) {
  throw "Nginx config not found: $nginxConf"
}
$confText = Get-Content $nginxConf -Raw
if ($confText -notmatch "proxy_pass\s+http://127\.0\.0\.1:3001/api/;") {
  $apiBlock = @"

        location /api/ {
            proxy_pass http://127.0.0.1:3001/api/;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        }
"@
  $confText = $confText -replace "server\s*\{", "server {$apiBlock"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($nginxConf, $confText, $utf8NoBom)
}

Write-Host "[7/7] Restarting backend..."
$portLine = netstat -ano | findstr ":3001"
if ($portLine) {
  $pids = $portLine | ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
  foreach ($processId in $pids) {
    if ($processId -match "^\d+$") {
      Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm.cmd run server > C:\deploy\movie\server.log 2>&1" -WorkingDirectory $appRoot -WindowStyle Hidden

Write-Host "[7/7] Restarting nginx..."
Push-Location $nginxRoot
taskkill /F /IM nginx.exe 2>$null
Start-Sleep -Seconds 1
.\nginx.exe -t
Start-Process -FilePath (Join-Path $nginxRoot "nginx.exe") -WorkingDirectory $nginxRoot -WindowStyle Hidden
Pop-Location

Start-Sleep -Seconds 3
Write-Host "Local backend health:"
curl.exe http://127.0.0.1:3001/api/health
Write-Host "Domain api through nginx:"
curl.exe http://localhost/api/health
Write-Host "Done. Please open http://www.yingji.cyou/api/health and check for {ok:true}."
