@echo off
setlocal enabledelayedexpansion
cd /d C:\Installer\Apps\FixiaApp

set PATH=C:\Installer\node-v22.18.0-win-x64;C:\Installer\MinGit-2.55.0.5-64-bit\cmd;%PATH%

:menu
echo.
echo  ============================================
echo   FixiaApp - Git Push
echo  ============================================
echo.
git status -s
echo.
echo  1. Push ALL changed files
echo  2. Push SELECTED files
echo  3. Cancel
echo  4. RELEASE (bump version, commit and push version files)
echo.
set /p "choice=Choose an option (1-4): "

if "%choice%"=="1" goto pushall
if "%choice%"=="2" goto pushselected
if "%choice%"=="3" goto :eof
if "%choice%"=="4" goto release
echo  Invalid choice.
goto menu

:pushall
git add -A
goto commit

:pushselected
echo.
echo  Enter file paths separated by spaces, relative to the project root.
echo  Example: public\homepage.html public\css\fixia.css
set /p "files=Files: "
if "%files%"=="" (
    echo  No files entered.
    goto menu
)
git add %files%
goto commit

:commit
echo.
set /p "msg=Commit message (blank = "Update files"): "
if "%msg%"=="" set "msg=Update files"
git commit -m "%msg%"
if errorlevel 1 (
    echo.
    echo  Nothing staged, or commit failed. Nothing was pushed.
    pause
    exit /b 1
)

echo.
git push
if errorlevel 1 (
    echo.
    echo  Push failed. Check the error above ^(auth, conflicts, no remote, etc.^).
    pause
    exit /b 1
)

echo.
echo  Done. Pushed to GitHub - Vercel will redeploy the web app automatically.
echo.
set "askrel="
set /p "askrel=Will this need an APK release version bump? (Y/N): "
if /i "%askrel%"=="Y" goto release
echo.
echo  Press any key to exit.
pause >nul
exit /b 0

:release
echo.
echo  ============================================
echo   RELEASE - bump version
echo  ============================================

if not exist "public\js\version.js" (
    echo  Cannot find public\js\version.js
    goto menu
)
if not exist "android\app\build.gradle" (
    echo  Cannot find android\app\build.gradle - run "npx cap add android" once first.
    goto menu
)

set "curver="
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Select-String -Path 'public\js\version.js' -Pattern 'APP_VERSION\s*=\s*.([0-9][0-9A-Za-z.-]*)').Matches[0].Groups[1].Value"`) do set "curver=%%V"
echo.
echo  Current version: %curver%
set "newver="
set /p "newver=New version (example 1.1.0, blank = cancel): "
if "%newver%"=="" goto menu

echo !newver!| findstr /r /x "[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" >nul
if errorlevel 1 (
    echo.
    echo  Invalid format. Use numbers like 1.1.0
    goto menu
)
if "%newver%"=="%curver%" (
    echo.
    echo  That is already the current version. Enter a new one.
    goto menu
)

echo.
echo  This will:
echo    - set APP_VERSION to %newver% in public\js\version.js
echo    - set versionName to %newver% and add 1 to versionCode in android\app\build.gradle
echo    - commit and push ONLY those two files
set "ok="
set /p "ok=Proceed? (Y/N): "
if /i not "%ok%"=="Y" goto menu

powershell -NoProfile -Command "$v='!newver!'; $f1='public\js\version.js'; $f2='android\app\build.gradle'; $a=[IO.File]::ReadAllText($f1); $b=[IO.File]::ReadAllText($f2); if($a -notmatch 'APP_VERSION\s*=\s*\S+' -or $b -notmatch 'versionCode\s+\d+' -or $b -notmatch 'versionName\s+\S+'){Write-Host 'ERROR: could not find the version fields.'; exit 1}; $q=[char]34; $a=[regex]::Replace($a,'APP_VERSION\s*=\s*\S+','APP_VERSION = '+$q+$v+$q+';'); $c=[int][regex]::Match($b,'versionCode\s+(\d+)').Groups[1].Value+1; $b=[regex]::Replace($b,'versionCode\s+\d+','versionCode '+$c); $b=[regex]::Replace($b,'versionName\s+\S+','versionName '+$q+$v+$q); [IO.File]::WriteAllText($f1,$a); [IO.File]::WriteAllText($f2,$b); Write-Host ('  version.js: '+$v+'   build.gradle: versionName '+$v+', versionCode '+$c)"
if errorlevel 1 (
    echo.
    echo  Version update failed. Nothing was changed or pushed.
    pause
    goto menu
)

git add public\js\version.js android\app\build.gradle
git commit -m "Release !newver!" -- public\js\version.js android\app\build.gradle
if errorlevel 1 (
    echo.
    echo  Commit failed. Nothing was pushed.
    pause
    exit /b 1
)

echo.
git push
if errorlevel 1 (
    echo.
    echo  Push failed. Check the error above ^(auth, conflicts, no remote, etc.^).
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Release !newver! pushed.
echo.
echo   Next steps:
echo    1. GitHub - Actions - Build Android APK - Run workflow
echo    2. Download the fixia.apk artifact and install / distribute it
echo  ============================================
echo.
pause
exit /b 0
