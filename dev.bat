@echo off
chcp 65001 >nul
cd /d D:\Develop\bili2insight
echo ========================================
echo   Bili2Insight - B站视频观点提炼
echo ========================================
echo.
npm run tauri dev
pause
