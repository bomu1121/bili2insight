@echo off
chcp 65001 >nul
cd /d D:\Develop\bili2insight
echo ========================================
echo   Bili2Insight
echo ========================================
echo.
echo [1/2] Freeing port 1420...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo [2/2] Starting Tauri dev mode...
npx tauri dev
pause
