' Crea un acceso directo en el Escritorio para Abreir_App.bat con icono
On Error Resume Next
Dim fso, shell, desktopPath, repoDir, linkPath, lnk
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

desktopPath = shell.SpecialFolders("Desktop")
repoDir = fso.GetParentFolderName(WScript.ScriptFullName)
linkPath = desktopPath & "\Quimica AS - Lanzador.lnk"

Set lnk = shell.CreateShortcut(linkPath)
lnk.TargetPath = repoDir & "\Abrir_App.bat"
lnk.WorkingDirectory = repoDir

' Intentar usar un icono personalizado (dos bidones) si existe; si no, usar icono del sistema
Dim iconPath
iconPath = repoDir & "\frontend\public\bleach.ico"
If fso.FileExists(iconPath) Then
  lnk.IconLocation = iconPath
Else
  lnk.IconLocation = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\shell32.dll,44")
End If

lnk.Description = "Lanza Backend y Frontend"
lnk.Save

If Err.Number <> 0 Then
  WScript.Quit 1
Else
  WScript.Quit 0
End If