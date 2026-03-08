$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Atelier Couture.lnk"
$launcher = Join-Path $PSScriptRoot "atelier-couture-launcher.vbs"
$iconPath = Join-Path $root "assets\atelier-couture.ico"
$wscriptPath = Join-Path $env:WINDIR "System32\wscript.exe"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscriptPath
$shortcut.Arguments = "`"$launcher`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Lance Atelier Couture et ouvre l'application automatiquement."
if (Test-Path $iconPath) { $shortcut.IconLocation = $iconPath }
$shortcut.Save()

Write-Host "Raccourci cree: $shortcutPath"
