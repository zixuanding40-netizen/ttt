$ErrorActionPreference = "Stop"

$releaseZip = "C:\Users\Administrator\Desktop\yingji-public-discussion-release.zip"
$releaseTemp = "C:\deploy\yingji-release-temp"
$webRoot = "C:\deploy\dist"
$appRoot = "C:\deploy\movie"
$nginxRoot = "C:\deploy\nginx-1.28.0"
$nginxConf = Join-Path $nginxRoot "conf\nginx.conf"

Write-Host "1/7 正在检查发布包..."
if (!(Test-Path $releaseZip)) {
  throw "没有找到 $releaseZip。请先把 yingji-public-discussion-release.zip 复制到服务器桌面。"
}

Write-Host "2/7 正在解压发布包..."
if (Test-Path $releaseTemp) {
  Remove-Item $releaseTemp -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseTemp | Out-Null
Expand-Archive -LiteralPath $releaseZip -DestinationPath $releaseTemp -Force

Write-Host "3/7 正在覆盖网站前端..."
if (!(Test-Path $webRoot)) {
  New-Item -ItemType Directory -Path $webRoot | Out-Null
}
robocopy (Join-Path $releaseTemp "dist") $webRoot /MIR | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "前端文件复制失败，robocopy 退出码：$LASTEXITCODE"
}

Write-Host "4/7 正在更新后端文件..."
if (!(Test-Path $appRoot)) {
  New-Item -ItemType Directory -Path $appRoot | Out-Null
}
robocopy (Join-Path $releaseTemp "server") (Join-Path $appRoot "server") /MIR | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "后端文件复制失败，robocopy 退出码：$LASTEXITCODE"
}
Copy-Item (Join-Path $releaseTemp "package.json") $appRoot -Force
Copy-Item (Join-Path $releaseTemp "package-lock.json") $appRoot -Force

Write-Host "5/7 正在安装后端依赖并准备数据库表..."
Push-Location $appRoot
npm.cmd install --omit=dev
Pop-Location

$schemaPath = Join-Path $appRoot "server\schema.sql"
$sqlcmd = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue
if ($sqlcmd) {
  try {
    sqlcmd.exe -S localhost,1433 -E -i $schemaPath
  } catch {
    Write-Host "使用 Windows 管理员身份建表失败，稍后可手动执行 schema.sql。"
  }
} else {
  Write-Host "没有找到 sqlcmd，稍后可手动执行 $schemaPath。"
}

Write-Host "6/7 正在配置 Nginx 的 /api 转发..."
if (!(Test-Path $nginxConf)) {
  throw "没有找到 Nginx 配置文件：$nginxConf"
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
  Set-Content -Path $nginxConf -Value $confText -Encoding UTF8
}

Write-Host "7/7 正在重启后端和 Nginx..."
$portLine = netstat -ano | findstr ":3001"
if ($portLine) {
  $pids = $portLine | ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
  foreach ($pid in $pids) {
    if ($pid -match "^\d+$") {
      Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm.cmd run server > C:\deploy\movie\server.log 2>&1" -WorkingDirectory $appRoot -WindowStyle Hidden

Push-Location $nginxRoot
taskkill /F /IM nginx.exe 2>$null
Start-Sleep -Seconds 1
.\nginx.exe -t
Start-Process -FilePath (Join-Path $nginxRoot "nginx.exe") -WorkingDirectory $nginxRoot -WindowStyle Hidden
Pop-Location

Start-Sleep -Seconds 3
Write-Host "本机检查："
curl.exe http://127.0.0.1:3001/api/health
curl.exe http://localhost/api/health
Write-Host "完成。现在打开 http://www.yingji.cyou/api/health，应该看到 {""ok"":true}。"
