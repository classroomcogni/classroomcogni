@echo off
REM Classly AI Service Startup Script
echo ========================================
echo Starting Classly AI Service...
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo.
    echo Please create a virtual environment first:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo.
    echo Please create a .env file with your API keys:
    echo   SUPABASE_URL=your_supabase_url
    echo   SUPABASE_SERVICE_KEY=your_service_key
    echo   AI_PROVIDER=gemini
    echo   GEMINI_API_KEY=your_gemini_key
    echo.
    echo Or for OpenAI:
    echo   AI_PROVIDER=openai
    echo   OPENAI_API_KEY=your_openai_key
    echo.
)

REM Check environment variables
echo Checking environment configuration...
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('SUPABASE_URL:', 'SET' if os.getenv('SUPABASE_URL') else 'MISSING'); print('AI_PROVIDER:', os.getenv('AI_PROVIDER', 'NOT SET'))"

echo.
echo Starting AI service server on http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

REM Start the server
python ai_service.py --server

