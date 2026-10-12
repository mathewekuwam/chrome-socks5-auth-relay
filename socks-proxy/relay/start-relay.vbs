' Starts the relay hidden in the background (no console window).
' Errors are written to relay.log in this folder.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node relay.js >> relay.log 2>&1", 0, False
