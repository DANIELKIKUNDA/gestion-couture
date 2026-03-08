Set shell = CreateObject("WScript.Shell")
scriptPath = Replace(WScript.ScriptFullName, ".vbs", ".ps1")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """"
shell.Run command, 0, False
