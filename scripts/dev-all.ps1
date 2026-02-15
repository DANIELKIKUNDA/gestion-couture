Param(
  [switch]$NoPortCleanup
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"

function Stop-ProcessOnPort {
  param([int]$Port)

  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) {
    Write-Host "[dev-all] Port $Port is free."
    return
  }

  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    try {
      $proc = Get-Process -Id $pid -ErrorAction Stop
      Write-Host "[dev-all] Stopping $($proc.ProcessName) (PID $pid) on port $Port..."
      Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
      Write-Warning ("[dev-all] Could not stop PID {0} on port {1}: {2}" -f $pid, $Port, $_.Exception.Message)
    }
  }
}

if (-not $NoPortCleanup) {
  Stop-ProcessOnPort -Port 3000
  Stop-ProcessOnPort -Port 5173
}

Write-Host "[dev-all] Starting backend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root'; npm run dev"
)

Write-Host "[dev-all] Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$frontendDir'; npm run dev"
)

Write-Host "[dev-all] Done. Two terminals were opened."
