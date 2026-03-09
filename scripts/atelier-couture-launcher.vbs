Set shell = CreateObject("WScript.Shell")
scriptPath = Replace(WScript.ScriptFullName, ".vbs", ".ps1")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """ -NoBrowser"
shell.Run command, 0, False
WScript.Sleep 4000
shell.Run "http://localhost:5173", 1, False
