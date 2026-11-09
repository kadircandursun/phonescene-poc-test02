$ErrorActionPreference = 'Stop'

$port = if ($env:PORT) { $env:PORT } else { '8787' }
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  $fallback = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  $found = Get-ChildItem -Path $fallback -Recurse -Filter 'cloudflared.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    $cloudflaredPath = $found.FullName
  } else {
    Write-Error 'cloudflared bulunamadı. winget install Cloudflare.cloudflared'
  }
} else {
  $cloudflaredPath = $cloudflared.Source
}

Write-Host ''
Write-Host 'PhoneScene Cloudflare Quick Tunnel'
Write-Host '----------------------------------'
Write-Host "Local target: http://127.0.0.1:$port"
Write-Host 'Keep this window open while testing on phone.'
Write-Host 'Use the https://*.trycloudflare.com URL printed below.'
Write-Host '  Desktop: <url>/desktop/'
Write-Host '  Mobile : <url>/mobile/'
Write-Host ''

& $cloudflaredPath tunnel --url "http://127.0.0.1:$port"
