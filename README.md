# ClassroomCogni 🎓

A **privacy-first** Slack-inspired classroom collaboration platform where students work together and AI passively organizes learning materials — without invasive monitoring.

![Privacy First](https://img.shields.io/badge/Privacy-First-green)
![AI Powered](https://img.shields.io/badge/AI-Powered-blue)
![Open Source](https://img.shields.io/badge/Open-Source-orange)

## 🎯 What is ClassroomCogni?

ClassroomCogni is a collaborative learning platform designed for ethical AI use in education:

- **Students** upload notes and chat naturally in a Slack-like interface
- **AI** automatically organizes content into units and generates study guides
- **Teachers** receive aggregate insights only — no individual student surveillance

The AI acts as an **invisible assistant**, not a chatbot. It works in the background to help students learn more effectively while preserving their privacy.

## 🔒 Privacy Architecture

This is the core innovation of ClassroomCogni:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIVACY BOUNDARY                          │
│                                                              │
│  Students ──► Chat & Notes ──► AI Service ──► Aggregated    │
│                                    │          Insights       │
│                                    │              │          │
│                                    ▼              ▼          │
│                              [Processing]    Teachers see    │
│                              [Local Only]    ONLY patterns   │
│                                                              │
│  ❌ Teachers NEVER see individual messages                   │
│  ❌ No student surveillance                                  │
│  ✅ Only anonymized, aggregated learning insights            │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js (React) with TypeScript |
| Backend/Auth/DB | Supabase |
| AI Service | Python (background service) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| LLM | Ollama (Mistral or LLaMA 3 8B) |
| Styling | Tailwind CSS |

**No paid APIs or services required!**

## 📁 Project Structure

```
classroomcogni/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   │   ├── (auth)/      # Login/signup pages
│   │   │   ├── dashboard/   # User dashboard
│   │   │   └── classroom/   # Classroom view
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities & Supabase client
│   └── .env.local           # Environment variables
│
├── ai-service/              # Python AI service
│   ├── ai_service.py        # Main AI processing script
│   ├── seed_test_data.py    # Test data generator
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # AI service config
│
└── supabase-schema.sql      # Database schema
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Supabase account (free tier works)
- Ollama installed locally

### 1. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Copy your project URL and anon key from Settings > API

### 2. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Set Up AI Service

```bash
cd ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase SERVICE key and Ollama settings
```

### 4. Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull mistral
# or
ollama pull llama3:8b
```

### 5. Run the AI Service

```bash
# Process all classrooms
python ai_service.py

# Or process a specific classroom
python ai_service.py <classroom_id>
```

## 👩‍🎓 Student Experience

1. **Sign up** and select "Student" role
2. **Join a classroom** using the teacher's join code
3. **Chat** with classmates in #general
4. **Upload notes** (they appear inline like Slack file shares)
5. **View study guides** in the #study-guide channel

## 👨‍🏫 Teacher Experience

1. **Sign up** and select "Teacher" role
2. **Create a classroom** and share the join code
3. **View the Insights tab** for:
   - Common confusion topics (aggregated, anonymous)
   - AI-generated study guides
4. **Send announcements** to the class

**Important:** Teachers see aggregate patterns only. Individual student messages are never exposed.

## 🤖 How the AI Works

### Study Guide Generation

1. **Fetch** all uploaded notes for a classroom
2. **Generate embeddings** using MiniLM (384-dimensional vectors)
3. **Cluster** notes into logical units using K-means
4. **Generate** a study guide for each unit using Ollama

### Confusion Analysis

1. **Fetch** chat messages (processed locally only)
2. **Analyze** for patterns of confusion or questions
3. **Generate** an aggregated summary (no individual quotes)
4. **Store** only the anonymous summary

### Privacy Preservation

```python
# From ai_service.py - This is the key privacy mechanism

def analyze_confusion_patterns(messages):
    """
    PRIVACY ARCHITECTURE:
    - This function processes messages locally
    - It extracts ONLY aggregated patterns
    - Individual messages are NEVER stored or shown to teachers
    - The output is a summary of topics, not quotes from students
    """
    # ... processing happens here ...
    
    prompt = """
    IMPORTANT: Do NOT quote any specific messages or identify any students.
    Only provide aggregated, anonymous insights about learning patterns.
    """
```

## 🧪 Testing with Sample Data

```bash
cd ai-service

# After creating a classroom and getting its ID:
python seed_test_data.py <classroom_id> <your_user_id>

# Then run the AI service:
python ai_service.py <classroom_id>
```

This will populate the classroom with sample biology notes and generate study guides.

## 📊 Database Schema

### Core Tables

- **users** - Student/teacher profiles
- **classrooms** - Class information with join codes
- **classroom_memberships** - Student-classroom relationships
- **messages** - Chat messages (with RLS protection)
- **uploads** - Student notes and documents
- **ai_insights** - Generated study guides and summaries

### Row Level Security

All tables have RLS policies ensuring:
- Students can only see their own classrooms
- Teachers can only see classrooms they created
- AI insights are visible to all classroom members

## 🎓 For the Competition

This project demonstrates:

1. **Ethical AI Use** - AI assists learning without surveillance
2. **Privacy by Design** - Architecture prevents data exposure
3. **Practical Value** - Real classroom utility
4. **Technical Excellence** - Modern stack, clean code
5. **Explainability** - Clear documentation of AI decisions

## 🔮 Future Enhancements

- [ ] Real-time collaboration on notes
- [ ] Voice-to-text note taking
- [ ] Spaced repetition flashcard generation
- [ ] Learning progress tracking (opt-in)
- [ ] Multi-language support

## 📄 License

MIT License - Feel free to use this for educational purposes!

## 🙏 Acknowledgments

Built for the U.S. High School AI Competition focusing on ethical, practical AI use in education.

---

**Remember:** The best AI in education is the one students don't notice — it just makes learning easier.
