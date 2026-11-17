@echo off
title FixiaApp - Local Server

REM =====================================
REM  FixiaApp 2.0 - Local Dev Server (Vite)
REM  Pages run locally, /api goes to Vercel
REM =====================================

set "NODE_DIR=C:\Installer\node-v22.18.0-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NODE_EXTRA_CA_CERTS=C:\Installer\Netskope\netskope-root.cer"
set "APP_DIR=C:\Installer\Apps\FixiaApp"
set "PORT=3200"
set "VERCEL=https://gofixia.vercel.app"

set "PATH=%NODE_DIR%;%PATH%"

echo.
echo  ============================================
echo   FixiaApp - Local Server
echo  ============================================
echo.

if not exist "%NODE_EXE%" (
    echo  ERROR: Node.js not found at %NODE_EXE%
    pause
    exit /b 1
)

if not exist "%APP_DIR%\package.json" (
    echo  ERROR: package.json not found in %APP_DIR%
    pause
    exit /b 1
)

REM -- First run: install packages
if not exist "%APP_DIR%\node_modules" (
    echo  First run: installing packages. This takes a minute...
    cd /d "%APP_DIR%"
    call npm install
    if errorlevel 1 (
        echo.
        echo  ERROR: npm install failed. Copy the message above and send it to me.
        pause
        exit /b 1
    )
)

REM -- Kill anything already on PORT
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  Starting FixiaApp on port %PORT%...
echo  API is served by %VERCEL%
echo.

start "FixiaApp Server" cmd /k "set PATH=%NODE_DIR%;%PATH% && set NODE_EXTRA_CA_CERTS=%NODE_EXTRA_CA_CERTS% && set VITE_DEV_API=%VERCEL% && cd /d %APP_DIR% && npm run dev"

echo  Waiting for server to start...

:waitloop
timeout /t 2 /nobreak >nul
netstat -an | findstr ":%PORT%.*LISTENING" >nul 2>&1
if errorlevel 1 goto waitloop

echo.
echo  FixiaApp is running!
echo  Open: http://localhost:%PORT%
echo.

start "" http://localhost:%PORT%

echo  ============================================
echo  Commands: BROWSER, RESTART, STATUS, STOP
echo  ============================================
echo.

:commandloop
set /p "cmd=  Command: "

if /i "%cmd%"=="browser" (
    start "" http://localhost:%PORT%
    goto commandloop
)

if /i "%cmd%"=="status" (
    netstat -an | findstr ":%PORT%.*LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo  Server is NOT running
    ) else (
        echo  Server is running at http://localhost:%PORT%
    )
    goto commandloop
)

if /i "%cmd%"=="restart" (
    echo  Restarting...
    taskkill /FI "WindowTitle eq FixiaApp Server*" /F >nul 2>&1
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING" 2^>nul') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    start "FixiaApp Server" cmd /k "set PATH=%NODE_DIR%;%PATH% && set NODE_EXTRA_CA_CERTS=%NODE_EXTRA_CA_CERTS% && set VITE_DEV_API=%VERCEL% && cd /d %APP_DIR% && npm run dev"
    echo  Waiting...

:restartloop
    timeout /t 2 /nobreak >nul
    netstat -an | findstr ":%PORT%.*LISTENING" >nul 2>&1
    if errorlevel 1 goto restartloop

    echo  Restarted!
    start "" http://localhost:%PORT%
    goto commandloop
)

if /i "%cmd%"=="stop" goto stopserver

echo  Unknown command. Try: BROWSER, STATUS, RESTART, STOP
goto commandloop

:stopserver
echo.
echo  Stopping FixiaApp...
taskkill /FI "WindowTitle eq FixiaApp Server*" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  Stopped.
echo.
pause
exit
