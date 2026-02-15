function Load-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (-not (Test-Path "env:$name")) { Set-Item -Path "env:$name" -Value $value }
  }
}

$rootEnv = Join-Path $PSScriptRoot '..\.env'
Load-DotEnv -Path $rootEnv

$DbName = $env:PGDATABASE
$DbHost = $env:PGHOST
$DbPort = $env:PGPORT
$DbUser = $env:PGUSER
$DbPassword = $env:PGPASSWORD

if (-not $DbName) { Write-Error "PGDATABASE not set"; exit 1 }
if (-not $DbHost) { $DbHost = 'localhost' }
if (-not $DbPort) { $DbPort = 5432 }
if (-not $DbUser) { $DbUser = 'postgres' }

# Ensure psql is available
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql not found. Install PostgreSQL client tools and ensure psql is in PATH.";
  exit 1
}

# Export password for non-interactive run
$env:PGPASSWORD = $DbPassword

# Apply schema files
psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f (Join-Path $PSScriptRoot '..\schema_all.sql')
