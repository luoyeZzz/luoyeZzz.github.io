@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title Luoyue Web - setup

echo.
echo   ============================================
echo    Luoyue Web  -  one-time setup
echo   ============================================
echo.

node -v >nul 2>nul
if errorlevel 1 goto NONODE

for /f "delims=" %%v in ('node -v') do echo   Node %%v  OK

echo.
echo   [2/3] Checking dependencies ...
echo.
node "tools\doctor.js" --open

echo.
echo   [3/3] Creating desktop shortcut ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $n = -join ([char]0x6D1B, [char]0x6708, [char]0x5199, [char]0x4F5C, [char]0x5DE5, [char]0x5177); $lnk = $ws.CreateShortcut((Join-Path $desk ($n + '.lnk'))); $q = [char]34; $lnk.TargetPath = 'C:\Windows\System32\conhost.exe'; $lnk.Arguments = 'cmd.exe /c ' + $q + '%~dp0start.bat' + $q; $lnk.WorkingDirectory = '%~dp0..'; $lnk.Save()"
echo         Done

echo.
echo   Starting the writing tool ...
echo.
call "%~dp0start.bat"
exit /b

:NONODE
echo.
echo   Node.js not found. Opening the download page ...
start "" https://nodejs.org/zh-cn
echo   Install the LTS version, then run setup.bat again.
echo.
pause
exit /b 1
