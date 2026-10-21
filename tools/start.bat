@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title Luoyue Writing Tool
color 07

netstat -ano | findstr ":4173" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo   Tool is already running:  http://127.0.0.1:4173
  echo   Look for a window titled "Luoyue Writing Tool" in the taskbar.
  echo.
  start "" http://127.0.0.1:4173
  timeout /t 6 >nul
  exit /b
)

echo.
echo  +------------------------------------------+
echo  ^|                                          ^|
echo  ^|       L U O Y U E   W R I T E R          ^|
echo  ^|                                          ^|
echo  +------------------------------------------+
echo.
echo    Local   http://127.0.0.1:4173
echo    Keep this window open while writing.
echo    Click Quit in the page to stop and close everything.
echo.
echo  ----------------------------------------------
echo.

node "tools\server.js"

if errorlevel 1 (
  echo.
  echo   Tool stopped with an error. Press any key to close.
  pause >nul
)
exit