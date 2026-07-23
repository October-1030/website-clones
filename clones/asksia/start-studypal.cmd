@echo off
setlocal
cd /d "%~dp0"
title StudyPal AI Launcher

echo [StudyPal AI] Building the verified production app...
call npm run build
if errorlevel 1 goto failed

echo [StudyPal AI] Starting on http://localhost:3000/pro/session
start "StudyPal AI Server" /min cmd /c "npm run start:local"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/pro/session"
exit /b 0

:failed
echo.
echo StudyPal AI could not start. Review the build error above.
pause
exit /b 1
