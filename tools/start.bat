@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title Luoyue Writing Tool
color 07

node -v >nul 2>nul
if errorlevel 1 goto NONODE

netstat -ano | findstr ":4173" | findstr "LISTENING" >nul
if not errorlevel 1 goto RUNNING

echo.
echo  +------------------------------------------+
echo  ^|                                          ^|
echo  ^|       L U O Y U E   W R I T E R          ^|
echo  ^|                                          ^|
echo  +------------------------------------------+
echo.
echo    Local   http://127.0.0.1:4173
echo    Keep this window open while writing.
echo    Click Quit in the page to stop everything.
echo.
echo  ----------------------------------------------
echo.

node "tools\server.js"

if errorlevel 1 (
  echo.
  echo   Tool stopped with an error. Press any key to close.
  pause >nul
)
exit /b

:NONODE
echo.
echo   Node.js not found. Opening the download page ...
start "" https://nodejs.org/zh-cn
echo   Install the LTS version, then run this file again.
echo.
pause
exit /b 1

:RUNNING
echo.
echo   Tool is already running:  http://127.0.0.1:4173/admin/
echo   Look for the window titled "Luoyue Writing Tool".
echo.
start "" http://127.0.0.1:4173/admin/
timeout /t 5 >nul
exit /b
