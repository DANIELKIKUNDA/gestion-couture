$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Atelier Couture.lnk"
$launcher = Join-Path $PSScriptRoot "atelier-couture-launcher.ps1"
$iconPath = Join-Path $root "assets\atelier-couture.ico"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $root
if (Test-Path $iconPath) { $shortcut.IconLocation = $iconPath }
$shortcut.Save()

Write-Host "Raccourci cree: $shortcutPath"
