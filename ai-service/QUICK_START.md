# Quick Start Guide - AI Service

## Prerequisites

1. **Python 3.9+** installed
2. **API Keys** ready:
   - Supabase URL and Service Key
   - Either Gemini API Key OR OpenAI API Key

## Setup Steps

### 1. Create Virtual Environment (if not already done)

```bash
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Create `.env` File

Create a `.env` file in the `ai-service` directory with your credentials:

**For Gemini:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

**For OpenAI:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 5. Start the Server

**Option A: Use the startup script (Windows)**
```bash
start-server.bat
```

**Option B: Manual start**
```bash
python ai_service.py --server
```

The server will start on `http://localhost:5000`

## Verify It's Working

1. Open your browser and go to: `http://localhost:5000/health`
2. You should see a JSON response with status "ok"

## Troubleshooting

### "Module not found" errors
- Make sure the virtual environment is activated
- Run `pip install -r requirements.txt` again

### "API_KEY is not set" errors
- Check your `.env` file exists in the `ai-service` directory
- Verify the API key names match exactly (case-sensitive)
- Make sure there are no extra spaces in the `.env` file

### "Connection refused" from frontend
- Make sure the server is running (`python ai_service.py --server`)
- Check that port 5000 is not being used by another application
- Verify the frontend is looking for `http://localhost:5000` (check `.env.local` in frontend)

### Port already in use
- Change the port in `.env`: `AI_SERVICE_PORT=5001`
- Update frontend `.env.local`: `NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:5001`

## Server Endpoints

- `GET /health` - Health check
- `POST /generate-study-guide` - Generate study guide for a classroom
- `POST /generate-insights` - Generate confusion insights for a classroom

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

