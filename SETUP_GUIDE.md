# ClassroomCogni - Complete Local Setup Guide

This guide walks you through setting up ClassroomCogni from scratch on your local machine.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.9+** - [Download](https://python.org/)
- **Git** - [Download](https://git-scm.com/)
- **A Supabase account** - [Sign up free](https://supabase.com/)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/classroomcogni/classroomcogni.git
cd classroomcogni
```

---

## Step 2: Set Up Supabase

### 2.1 Create a New Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `classroomcogni`
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
4. Click **"Create new project"** and wait ~2 minutes

### 2.2 Enable the Vector Extension

The AI service uses pgvector for embeddings. Enable it first:

1. In your Supabase dashboard, go to **Database** → **Extensions**
2. Search for **"vector"**
3. Click the toggle to **enable** it
4. Wait a few seconds for it to activate

**Alternative:** If you have trouble with pgvector, use `supabase-schema-simple.sql` instead (stores embeddings as JSON).

### 2.3 Run the Database Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` from this repo
4. Paste it into the SQL editor
5. Click **"Run"** (or press Ctrl+Enter)

You should see "Success. No rows returned" - this means the tables were created.

**Troubleshooting:** If you get an error about "type vector does not exist", make sure you enabled the vector extension in step 2.2, or use `supabase-schema-simple.sql` instead.

### 2.4 Get Your API Keys

1. Go to **Settings** → **API** in the Supabase dashboard
2. Copy these values (you'll need them soon):
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys") - ⚠️ Keep this secret!

### 2.5 Enable Email Auth (Optional but Recommended)

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. For testing, go to **Authentication** → **Settings**
4. Under "Email Auth", you can disable "Confirm email" for easier testing

---

## Step 3: Set Up the Frontend

### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

### 3.2 Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit with your favorite editor
nano .env.local  # or code .env.local, vim .env.local, etc.
```

Update the file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3.3 Start the Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

---

## Step 4: Set Up the AI Service

### 4.1 Get a Google Gemini API Key

The AI service uses Google's Gemini API for text generation.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the generated key (you'll need it in step 4.3)

**Note:** The free tier includes generous usage limits suitable for classroom use.

### 4.2 Set Up Python Environment

**macOS/Linux:**
```bash
cd ai-service

# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Windows (PowerShell):**
```powershell
cd ai-service

# Create virtual environment
python -m venv venv

# If you get an execution policy error, run this first:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Activate it
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 4.3 Configure AI Service Environment

**macOS/Linux:**
```bash
cp .env.example .env
nano .env  # or your preferred editor
```

**Windows (PowerShell):**
```powershell
copy .env.example .env
notepad .env
```

Update with your credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash
```

⚠️ **Important**: Use the `service_role` key for Supabase, not the `anon` key. The AI service needs elevated permissions to read all classroom data.

---

## Step 5: Test the Application

### 5.1 Create Test Accounts

1. Open **http://localhost:3000** in your browser
2. Click **"Get Started"** or **"Sign Up"**
3. Create a **Teacher** account:
   - Name: `Test Teacher`
   - Email: `teacher@test.com`
   - Password: `password123`
   - Role: **Teacher**
4. Create a **Student** account (in a different browser or incognito):
   - Name: `Test Student`
   - Email: `student@test.com`
   - Password: `password123`
   - Role: **Student**

### 5.2 Create a Classroom (as Teacher)

1. Log in as the teacher
2. Click **"Create Classroom"**
3. Enter a name like "Biology 101"
4. Copy the **Join Code** that appears

### 5.3 Join the Classroom (as Student)

1. Log in as the student
2. Click **"Join Classroom"**
3. Enter the join code from step 5.2
4. You should now see the classroom

### 5.4 Add Some Content

**As Student:**
1. Go to the classroom
2. Send some chat messages in #general
3. Click **"Upload Notes"** and add some study content

**Sample content to upload:**
```
Cell Biology Notes

The cell is the basic unit of life. Key organelles include:
- Nucleus: Contains DNA
- Mitochondria: Produces ATP (powerhouse of the cell)
- Ribosomes: Protein synthesis
- Endoplasmic Reticulum: Transport system
```

### 5.5 Run the AI Service

The AI service can run in two modes:

#### Option A: HTTP Server Mode (Recommended)

This mode allows you to generate study guides directly from the web interface:

**macOS/Linux:**
```bash
cd ai-service
source venv/bin/activate  # if not already activated
python ai_service.py --server
```

**Windows (PowerShell):**
```powershell
cd ai-service
.\venv\Scripts\Activate.ps1
python ai_service.py --server
```

The server will start on port 5000 (configurable via `AI_SERVICE_PORT` in `.env`).

Then in the web app:
1. Go to a classroom
2. Click on the **#study-guide** channel
3. Click the **"Generate Guide"** button

The AI will:
- Cluster your notes into logical units/topics
- Generate a comprehensive study guide covering all units
- Only process NEW uploads (saves API credits!)

#### Option B: CLI Mode (One-time processing)

```bash
cd ai-service
source venv/bin/activate  # if not already activated

# Process all classrooms
python ai_service.py

# Or process a specific classroom (get ID from Supabase dashboard)
python ai_service.py <classroom-id>
```

### 5.6 View AI-Generated Content

1. Refresh the classroom page
2. Click on **#study-guide** channel to see generated study guides
3. As a teacher, click on **#insights** to see aggregated confusion topics

---

## Step 6: Seed Test Data (Optional)

For a quick demo with pre-populated content:

```bash
cd ai-service
source venv/bin/activate

# Get your classroom ID and user ID from Supabase dashboard
# Tables: classrooms, users

python seed_test_data.py <classroom-id> <user-id>

# Then run the AI service
python ai_service.py <classroom-id>
```

This adds sample biology notes and chat messages for testing.

---

## Troubleshooting

### "supabaseUrl is required" error
- Make sure `.env.local` exists in the `frontend` folder
- Check that the URL doesn't have a trailing slash

### Gemini API errors
- Verify your API key is correct in `.env`
- Check that you haven't exceeded the free tier limits
- Ensure the model name is correct (`gemini-1.5-flash` or `gemini-1.5-pro`)

### AI service can't connect to Supabase
- Verify you're using the `service_role` key, not `anon`
- Check the URL is correct in `.env`

### No study guides appearing
- Check the AI service output for errors
- Ensure there are uploads in the classroom
- Verify your Gemini API key is valid

### Auth not working
- Check Supabase dashboard → Authentication → Users
- Ensure email confirmation is disabled for testing
- Check browser console for errors

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Next.js App    │────▶│    Supabase     │◀────│  Python AI      │
│  (Frontend)     │     │  (Database)     │     │  Service        │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
   User Interface          Data Storage           AI Processing
   - Chat                  - Users                - Embeddings
   - Uploads               - Messages             - Clustering
   - Study Guides          - Uploads              - Study Guides
                           - AI Insights          - Confusion Analysis
```

### Privacy Flow

1. Students upload notes and chat → stored in Supabase
2. AI service reads data → processes locally
3. AI generates **aggregated** insights → stored back to Supabase
4. Teachers see **only** aggregated insights, never individual messages

---

## Running in Production

For production deployment:

1. **Frontend**: Deploy to Vercel
   ```bash
   cd frontend
   npx vercel
   ```

2. **AI Service**: Run as a cron job or scheduled task
   ```bash
   # Example cron (every hour)
   0 * * * * cd /path/to/ai-service && python ai_service.py
   ```

3. **Supabase**: Already cloud-hosted

---

## Quick Reference

| Component | Command | URL |
|-----------|---------|-----|
| Frontend | `npm run dev` | http://localhost:3000 |
| AI Service | `python ai_service.py` | N/A (background) |
| Supabase | Cloud hosted | Your project URL |
| Gemini API | Cloud hosted | https://aistudio.google.com |

---

## Need Help?

- Check the main [README.md](./README.md) for feature overview
- Review the code comments for implementation details
- Open an issue on GitHub for bugs or questions

Happy learning! 🎓
