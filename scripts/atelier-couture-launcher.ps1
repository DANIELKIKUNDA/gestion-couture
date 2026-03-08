$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendUrl = "http://localhost:3000/health"
$frontendUrl = "http://localhost:5173"
$logsDir = Join-Path $root "logs"
$npmPath = (Get-Command npm.cmd).Source
$nodePath = (Get-Command node.exe).Source
$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chromePath = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not (Test-Path $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

function Test-PortOpen {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    return $null -ne $connection
  } catch {
    return $false
  }
}

function Start-BackgroundProcess {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$StdoutPath = "",
    [string]$StderrPath = ""
  )

  $params = @{
    WindowStyle = "Hidden"
    WorkingDirectory = $WorkingDirectory
    FilePath = $FilePath
    ArgumentList = $Arguments
  }
  if ($StdoutPath) { $params.RedirectStandardOutput = $StdoutPath }
  if ($StderrPath) { $params.RedirectStandardError = $StderrPath }
  Start-Process @params
}

function Wait-HttpReady {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  throw "Demarrage trop lent ou indisponible: $Url"
}

if (-not (Test-PortOpen -Port 3000)) {
  Start-BackgroundProcess `
    -WorkingDirectory $root `
    -FilePath $npmPath `
    -Arguments @("run", "start") `
    -StdoutPath (Join-Path $logsDir "launcher-backend.out.log") `
    -StderrPath (Join-Path $logsDir "launcher-backend.err.log")
}

try {
  $frontendReady = Invoke-WebRequest -Uri "$frontendUrl/health" -UseBasicParsing -TimeoutSec 2
  $hasFrontend = $frontendReady.StatusCode -ge 200 -and $frontendReady.StatusCode -lt 500
} catch {
  $hasFrontend = $false
}

if (-not $hasFrontend) {
  Start-BackgroundProcess `
    -WorkingDirectory $root `
    -FilePath $nodePath `
    -Arguments @("scripts/serve-frontend.js") `
    -StdoutPath (Join-Path $logsDir "launcher-frontend.out.log") `
    -StderrPath (Join-Path $logsDir "launcher-frontend.err.log")
}

Wait-HttpReady -Url $backendUrl -TimeoutSeconds 45 | Out-Null
Wait-HttpReady -Url "$frontendUrl/health" -TimeoutSeconds 45 | Out-Null

if ($chromePath) {
  Start-Process -WindowStyle Hidden -FilePath $chromePath -ArgumentList @("--app=$frontendUrl")
} else {
  Start-Process -FilePath "explorer.exe" -ArgumentList $frontendUrl
}
Write-Host "Atelier Couture lance."
