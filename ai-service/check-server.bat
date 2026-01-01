@echo off
REM Quick check if AI service is running
echo Checking if AI service is running...
echo.

curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] AI service is running on http://localhost:5000
    curl http://localhost:5000/health
) else (
    echo [ERROR] AI service is NOT running
    echo.
    echo Please start it with:
    echo   start-server.bat
    echo.
    echo Or manually:
    echo   python ai_service.py --server
)

echo.
pause

