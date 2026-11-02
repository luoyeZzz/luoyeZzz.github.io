@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title GitHub SSH Setup

echo.
echo  ============================================
echo   GitHub SSH setup (for pushing the site)
echo  ============================================
echo.

if not exist "%USERPROFILE%\.ssh" mkdir "%USERPROFILE%\.ssh"

if exist "%USERPROFILE%\.ssh\id_ed25519" (
  echo   Key already exists, reusing it.
) else (
  echo   Generating a new SSH key ...
  ssh-keygen -t ed25519 -N "" -C "luoyue-web" -f "%USERPROFILE%\.ssh\id_ed25519"
)

echo.
echo   Writing ~/.ssh/config  (github.com -> ssh.github.com:443)
>  "%USERPROFILE%\.ssh\config" echo Host github.com
>> "%USERPROFILE%\.ssh\config" echo   HostName ssh.github.com
>> "%USERPROFILE%\.ssh\config" echo   Port 443
>> "%USERPROFILE%\.ssh\config" echo   User git
>> "%USERPROFILE%\.ssh\config" echo   IdentityFile ~/.ssh/id_ed25519
>> "%USERPROFILE%\.ssh\config" echo   IdentitiesOnly yes

echo.
echo   ------------------------------------------------------------
echo    COPY the line below into GitHub -^> Settings -^> SSH keys
echo    https://github.com/settings/keys
echo   ------------------------------------------------------------
echo.
type "%USERPROFILE%\.ssh\id_ed25519.pub"
echo.
echo   ------------------------------------------------------------
echo.

echo   Switch remote to SSH ...
for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do call :convert "%%u"

echo   Testing connection ...
ssh -o StrictHostKeyChecking=accept-new -T git@github.com

echo.
echo   Done. Now use the writing tool -^> Publish -^> Commit and push.
echo   In the tool, keep the repository URL as git@github.com:USER/REPO.git
echo   and leave the token field EMPTY.
echo.
pause
exit /b

:convert
set "URL=%~1"
set "SSHURL=%URL:https://github.com/=%"
set "SSHURL=git@github.com:%SSHURL%"
if "%SSHURL%"=="git@github.com:%URL%" goto :eof
git remote set-url origin "%SSHURL%"
echo   remote -^> %SSHURL%
goto :eof
