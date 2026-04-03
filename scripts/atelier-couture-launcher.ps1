param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendUrl = "http://localhost:3000/health"
$frontendUrl = "http://localhost:5173"
$frontendDir = Join-Path $root "frontend"
$frontendSrcDir = Join-Path $frontendDir "src"
$frontendDistDir = Join-Path $frontendDir "dist"
$logsDir = Join-Path $root "logs"
$npmPath = (Get-Command npm.cmd).Source
$nodePath = (Get-Command node.exe).Source
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

function Stop-ProcessOnPort {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) {
    return
  }

  $processIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Processus sur le port $Port arrete (PID $processId)."
    } catch {
      Write-Warning ("Impossible d'arreter PID {0} sur le port {1}: {2}" -f $processId, $Port, $_.Exception.Message)
    }
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

function Ensure-NpmDependencies {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$PackageLockPath,
    [Parameter(Mandatory = $true)][string]$RequiredBinaryPath,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $mustInstall = -not (Test-Path $RequiredBinaryPath)
  if (-not $mustInstall -and (Test-Path $PackageLockPath)) {
    $requiredBinary = Get-Item $RequiredBinaryPath -ErrorAction SilentlyContinue
    $packageLock = Get-Item $PackageLockPath -ErrorAction SilentlyContinue
    if ($null -ne $requiredBinary -and $null -ne $packageLock -and $packageLock.LastWriteTime -gt $requiredBinary.LastWriteTime) {
      $mustInstall = $true
    }
  }

  if (-not $mustInstall) {
    Write-Host "$Label dependencies deja disponibles."
    return
  }

  Write-Host "Installation des dependencies $Label..."
  Push-Location $WorkingDirectory
  try {
    & $npmPath ci
    if ($LASTEXITCODE -ne 0) {
      throw "L'installation npm a echoue pour $Label."
    }
  } finally {
    Pop-Location
  }
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

function Get-LatestWriteTime {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if (-not (Test-Path $Path)) {
    return [datetime]::MinValue
  }

  $item = Get-Item $Path -ErrorAction SilentlyContinue
  if ($null -eq $item) {
    return [datetime]::MinValue
  }

  if (-not $item.PSIsContainer) {
    return $item.LastWriteTime
  }

  $latest = $item.LastWriteTime
  $children = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    if ($child.LastWriteTime -gt $latest) {
      $latest = $child.LastWriteTime
    }
  }
  return $latest
}

function Ensure-FrontendBuild {
  Ensure-NpmDependencies `
    -WorkingDirectory $frontendDir `
    -PackageLockPath (Join-Path $frontendDir "package-lock.json") `
    -RequiredBinaryPath (Join-Path $frontendDir "node_modules\\.bin\\vite.cmd") `
    -Label "frontend"

  $distIndex = Join-Path $frontendDistDir "index.html"
  $sourceTimes = @(
    (Get-LatestWriteTime -Path $frontendSrcDir),
    (Get-LatestWriteTime -Path (Join-Path $frontendDir "index.html")),
    (Get-LatestWriteTime -Path (Join-Path $frontendDir "package.json")),
    (Get-LatestWriteTime -Path (Join-Path $frontendDir "vite.config.js"))
  )
  $latestSource = ($sourceTimes | Sort-Object -Descending | Select-Object -First 1)
  $latestDist = Get-LatestWriteTime -Path $frontendDistDir

  if ((-not (Test-Path $distIndex)) -or ($latestSource -gt $latestDist)) {
    Write-Host "Build frontend en cours..."
    Push-Location $frontendDir
    try {
      & $npmPath run build
      if ($LASTEXITCODE -ne 0) {
        throw "Le build frontend a echoue."
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "Frontend dist deja a jour."
  }
}

Ensure-NpmDependencies `
  -WorkingDirectory $root `
  -PackageLockPath (Join-Path $root "package-lock.json") `
  -RequiredBinaryPath (Join-Path $root "node_modules\\dotenv\\package.json") `
  -Label "backend"

Ensure-FrontendBuild

Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5173

Start-BackgroundProcess `
  -WorkingDirectory $root `
  -FilePath $npmPath `
  -Arguments @("run", "start") `
  -StdoutPath (Join-Path $logsDir "launcher-backend.out.log") `
  -StderrPath (Join-Path $logsDir "launcher-backend.err.log")

Start-BackgroundProcess `
  -WorkingDirectory $root `
  -FilePath $nodePath `
  -Arguments @("scripts/serve-frontend.js") `
  -StdoutPath (Join-Path $logsDir "launcher-frontend.out.log") `
  -StderrPath (Join-Path $logsDir "launcher-frontend.err.log")

Wait-HttpReady -Url $backendUrl -TimeoutSeconds 45 | Out-Null
Wait-HttpReady -Url "$frontendUrl/health" -TimeoutSeconds 45 | Out-Null

if (-not $NoBrowser) {
  Start-Process -FilePath "explorer.exe" -ArgumentList $frontendUrl
}
Write-Host "Atelier Couture lance."
