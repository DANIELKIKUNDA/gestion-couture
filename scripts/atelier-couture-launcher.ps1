$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

Start-Process -WindowStyle Minimized -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","cd '$root'; npm run dev"
Start-Sleep -Seconds 2
Start-Process -WindowStyle Minimized -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","cd '$frontend'; npm run dev"
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
Write-Host "Atelier Couture lance."
