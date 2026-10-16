@echo off
chcp 65001 >nul
title Fixia Dev Server

REM =====================================
REM  Fixia — Local Development Server
REM =====================================

echo.
echo  🔧 Fixia Dev Server starting...
echo.

REM Set Node.js path
set NODE_EXE="C:\Installer\node-v22.18.0-win-x64\node.exe"

REM Go to batch file directory (your project root)
cd /d "C:\Installer\Apps\FixiaApp"

REM Check Node.js
if not exist %NODE_EXE% (
    echo  ❌ Node.js not found at %NODE_EXE%
    pause
    exit /b 1
)

REM Check server.js
if not exist "server.js" (
    echo  ❌ server.js not found in project folder
    pause
    exit /b 1
)

REM Clear any existing process on port 3200
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3200.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Start server
start "Fixia Server" cmd /k "C:\Installer\node-v22.18.0-win-x64\node.exe" server.js

REM Wait for server to be ready
echo  ⏳ Waiting for server to start...
:waitloop
timeout /t 1 /nobreak >nul
netstat -an | findstr ":3200.*LISTENING" >nul 2>&1
if errorlevel 1 goto waitloop

echo  ✅ Server is running!
echo.

REM Open browser
start "" http://localhost:3200

echo  Available Commands:
echo    STOP     - Stop the server and exit
echo    BROWSER  - Reopen in browser
echo    RESTART  - Restart the server
echo    STATUS   - Check if server is running
echo.

:commandloop
set /p "cmd=Enter command: "

if /i "%cmd%"=="stop" goto stopserver

if /i "%cmd%"=="browser" (
    start "" http://localhost:3200
    goto commandloop
)

if /i "%cmd%"=="status" (
    netstat -an | findstr ":3200.*LISTENING" >nul 2>&1
    if errorlevel 1 (
        echo  ❌ Server not running
    ) else (
        echo  ✅ Server is running on port 3200
    )
    goto commandloop
)

if /i "%cmd%"=="restart" (
    echo  🔄 Restarting...
    taskkill /FI "WindowTitle eq Fixia Server*" /F >nul 2>&1
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3200.*LISTENING" 2^>nul') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    start "Fixia Server" cmd /k "C:\Installer\node-v22.18.0-win-x64\node.exe" server.js
    echo  ⏳ Waiting for server to restart...
    :restartloop
    timeout /t 1 /nobreak >nul
    netstat -an | findstr ":3200.*LISTENING" >nul 2>&1
    if errorlevel 1 goto restartloop
    echo  ✅ Server restarted!
    start "" http://localhost:3200
    goto commandloop
)

echo  ❌ Unknown command.
goto commandloop

:stopserver
echo.
echo  🛑 Stopping Fixia server...
taskkill /FI "WindowTitle eq Fixia Server*" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3200.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  ✅ Fixia server stopped.
echo.
pause
exit
