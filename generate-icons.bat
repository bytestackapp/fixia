@echo off
cd /d C:\Installer\Apps\FixiaApp
set PATH=C:\Installer\node-v22.18.0-win-x64;C:\Installer\MinGit-2.55.0.5-64-bit\cmd;%PATH%

echo.
echo  Regenerating Android icons from assets\icon.png ...
echo.

npx capacitor-assets generate --android

echo.
echo  Done. Check "git status" to confirm files changed, then run git-push.bat.
echo.
pause
