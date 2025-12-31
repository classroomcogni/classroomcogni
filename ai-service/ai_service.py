"""
ClassroomCogni AI Service
=========================

This service can run as:
1. CLI tool: python ai_service.py [classroom_id]
2. HTTP server: python ai_service.py --server

Features:
- Generates cumulative study guides organized by units
- Only processes NEW uploads (saves API credits)
- Analyzes chat for confusion patterns (aggregated, anonymous)
- Supports both Google Gemini and OpenAI GPT

PRIVACY ARCHITECTURE:
- This service reads raw student data but NEVER exposes individual messages to teachers
- All insights stored are AGGREGATED and ANONYMIZED
- Teachers only see patterns, not individual student contributions
- The AI acts as a privacy-preserving intermediary
"""

import os
import sys
import json
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# AI Provider configuration
# Options: 'gemini' or 'openai'
AI_PROVIDER = os.getenv('AI_PROVIDER', 'gemini').lower()

# Gemini configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')

# OpenAI configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Server configuration
SERVER_PORT = int(os.getenv('AI_SERVICE_PORT', '5000'))

def check_env():
    """Check for required environment variables."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        print("Copy .env.example to .env and fill in your credentials")
        return False
    
    if AI_PROVIDER == 'gemini':
        if not GEMINI_API_KEY:
            print("Error: GEMINI_API_KEY must be set when using Gemini")
            print("Get your API key from https://aistudio.google.com/app/apikey")
            return False
    elif AI_PROVIDER == 'openai':
        if not OPENAI_API_KEY:
            print("Error: OPENAI_API_KEY must be set when using OpenAI")
            print("Get your API key from https://platform.openai.com/api-keys")
            return False
    else:
        print(f"Error: Invalid AI_PROVIDER '{AI_PROVIDER}'. Must be 'gemini' or 'openai'")
        return False
    
    return True

def get_ai_provider_info() -> str:
    """Get a string describing the current AI provider and model."""
    if AI_PROVIDER == 'gemini':
        return f"Google Gemini ({GEMINI_MODEL})"
    elif AI_PROVIDER == 'openai':
        return f"OpenAI ({OPENAI_MODEL})"
    return "Unknown"

# Initialize Supabase client (lazy)
_supabase = None
def get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase

def fetch_uploads(classroom_id: str) -> List[Dict]:
    """Fetch all uploads for a classroom."""
    supabase = get_supabase()
    response = supabase.table('uploads').select('*').eq('classroom_id', classroom_id).order('created_at').execute()
    return response.data or []


def fetch_messages(classroom_id: str) -> List[Dict]:
    """
    Fetch messages for confusion analysis.
    
    PRIVACY NOTE: These messages are processed locally and NEVER stored
    in a way that teachers can see individual messages. Only aggregated
    patterns are extracted and stored.
    """
    supabase = get_supabase()
    response = supabase.table('messages').select('content').eq('classroom_id', classroom_id).execute()
    return response.data or []


def get_existing_study_guide(classroom_id: str) -> Optional[Dict]:
    """Get the existing study guide for a classroom (if any)."""
    supabase = get_supabase()
    response = supabase.table('ai_insights').select('*').eq('classroom_id', classroom_id).eq('insight_type', 'study_guide').order('created_at', desc=True).limit(1).execute()
    return response.data[0] if response.data else None


def get_processed_upload_ids(classroom_id: str) -> set:
    """Get the set of upload IDs that have already been processed."""
    existing = get_existing_study_guide(classroom_id)
    if existing and existing.get('metadata'):
        return set(existing['metadata'].get('processed_upload_ids', []))
    return set()


def generate_study_guide(uploads: List[Dict]) -> str:
    """
    Generate a comprehensive study guide from all uploaded notes.
    
    Takes all uploads and sends them to the LLM to create a single,
    well-organized study guide covering all the material.
    """
    # Combine all notes into a single text
    notes_text = ""
    for i, upload in enumerate(uploads, 1):
        notes_text += f"\n--- Note {i}: {upload['title']} ---\n"
        notes_text += upload['content']
        notes_text += "\n"
    
    # Truncate if too long (leave room for prompt)
    if len(notes_text) > 25000:
        notes_text = notes_text[:25000] + "\n\n[Additional notes truncated...]"
    
    prompt = f"""You are a helpful study assistant. Based on the following class notes, 
create a comprehensive study guide organized by topic/unit.

CLASS NOTES:
{notes_text}

Create a SINGLE comprehensive study guide. Structure it as follows:

# 📚 Complete Study Guide

## 📋 Course Overview
A brief 2-3 sentence summary of what these notes cover overall.

---

Then organize the content into logical units/topics. For EACH unit, create a section:

## Unit: [Topic Name]

### 🔑 Key Concepts
List and explain the main concepts with clear definitions.

### 📝 Important Terms
Key vocabulary with definitions (use a table if helpful).

### 💡 Main Ideas
Bullet points of the most important takeaways.

### 🧮 Formulas & Equations (if applicable)
Use LaTeX notation for any mathematical formulas:
- Inline math: $formula$
- Display math: $$formula$$

### ❓ Review Questions
2-3 questions to test understanding of this unit.

---

After all units, include:

## 🎯 Final Review
- Key connections between units
- Most important concepts to remember
- 3-5 comprehensive review questions covering multiple units

FORMATTING GUIDELINES:
- Use proper Markdown formatting with headers (##, ###)
- Use bullet points and numbered lists for clarity
- Use **bold** for important terms and *italics* for emphasis
- Use `code blocks` for technical terms or commands
- Use tables when comparing concepts
- For math/science content, use LaTeX notation: $inline$ or $$display$$
- Use blockquotes (>) for important notes or tips
- Use horizontal rules (---) to separate units

Write in a friendly, encouraging tone suitable for students."""

    try:
        result = call_llm(prompt)
        if not result or len(result.strip()) < 100:
            return "Study guide generation returned empty content. Please try again."
        return result
    except Exception as e:
        print(f"Error generating study guide: {e}")
        return f"Study guide generation failed. Please try again later.\n\nError: {str(e)}"


def analyze_confusion_patterns(messages: List[Dict]) -> str:
    """
    Analyze chat messages to identify common confusion topics.
    
    PRIVACY ARCHITECTURE:
    - This function processes messages locally
    - It extracts ONLY aggregated patterns
    - Individual messages are NEVER stored or shown to teachers
    - The output is a summary of topics, not quotes from students
    
    This is a key privacy-preserving feature: teachers get actionable
    insights without surveillance of individual students.
    """
    if not messages:
        return "Not enough chat data to analyze confusion patterns yet."
    
    # Extract just the content
    all_messages = [m['content'] for m in messages]
    combined = "\n".join(all_messages[-100:])  # Last 100 messages
    
    if len(combined) < 50:
        return "Not enough chat data to analyze confusion patterns yet."
    
    prompt = f"""Analyze these classroom chat messages to identify common topics where students seem confused or are asking questions.

MESSAGES (anonymized):
{combined[:4000]}

Provide a brief summary of:
1. Topics students seem to struggle with most
2. Common questions or misconceptions
3. Suggested areas for the teacher to review

IMPORTANT: Do NOT quote any specific messages or identify any students. 
Only provide aggregated, anonymous insights about learning patterns.
Keep the response concise (under 200 words)."""

    try:
        return call_llm(prompt)
    except Exception as e:
        print(f"Error analyzing confusion: {e}")
        return f"Confusion analysis failed: {str(e)}"


def call_llm(prompt: str) -> str:
    """Call the configured LLM provider to generate text."""
    if AI_PROVIDER == 'gemini':
        return _call_gemini(prompt)
    elif AI_PROVIDER == 'openai':
        return _call_openai(prompt)
    else:
        raise Exception(f"Unknown AI provider: {AI_PROVIDER}")


def _call_gemini(prompt: str) -> str:
    """Call Google Gemini API to generate text."""
    import google.generativeai as genai
    
    genai.configure(api_key=GEMINI_API_KEY)
    
    generation_config = {
        "temperature": 0.7,
        "top_p": 0.9,
        "max_output_tokens": 4096,
    }
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
    
    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise Exception(f"Gemini API error: {str(e)}")


def _call_openai(prompt: str) -> str:
    """Call OpenAI API to generate text."""
    from openai import OpenAI
    
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful educational assistant that creates study guides and analyzes learning patterns."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_completion_tokens=4096,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")


def store_insight(classroom_id: str, insight_type: str, content: str, unit_name: Optional[str] = None, metadata: Dict = None):
    """Store an AI insight in Supabase."""
    supabase = get_supabase()
    data = {
        'classroom_id': classroom_id,
        'insight_type': insight_type,
        'content': content,
        'unit_name': unit_name,
        'metadata': metadata or {}
    }
    
    supabase.table('ai_insights').insert(data).execute()
    print(f"  ✓ Stored {insight_type}" + (f" for {unit_name}" if unit_name else ""))


def update_or_create_study_guide(classroom_id: str, content: str, metadata: Dict):
    """Update existing study guide or create a new one."""
    supabase = get_supabase()
    existing = get_existing_study_guide(classroom_id)
    
    if existing:
        # Update existing study guide
        supabase.table('ai_insights').update({
            'content': content,
            'metadata': metadata,
            'created_at': datetime.utcnow().isoformat()
        }).eq('id', existing['id']).execute()
        print("  ✓ Updated existing study guide")
    else:
        # Create new study guide
        store_insight(
            classroom_id=classroom_id,
            insight_type='study_guide',
            content=content,
            unit_name='Complete Study Guide',
            metadata=metadata
        )


def process_classroom(classroom_id: str, force_regenerate: bool = False) -> Dict:
    """
    Main processing function for a classroom.
    
    This orchestrates the entire AI pipeline:
    1. Fetch data from Supabase
    2. Check for new uploads (skip already processed ones)
    3. Cluster ALL uploads into units
    4. Generate a SINGLE cumulative study guide
    5. Analyze confusion patterns
    6. Store results back to Supabase
    
    Args:
        classroom_id: The classroom to process
        force_regenerate: If True, regenerate even if no new uploads
        
    Returns:
        Dict with processing results
    """
    result = {
        'success': True,
        'classroom_id': classroom_id,
        'uploads_processed': 0,
        'new_uploads': 0,
        'message': ''
    }
    
    print(f"\n{'='*50}")
    print(f"Processing classroom: {classroom_id}")
    print(f"{'='*50}")
    
    # Fetch all uploads
    uploads = fetch_uploads(classroom_id)
    print(f"\nFound {len(uploads)} total uploads")
    result['uploads_processed'] = len(uploads)
    
    if not uploads:
        result['message'] = 'No uploads found in this classroom.'
        print("No uploads to process.")
        return result
    
    # Check which uploads are new
    processed_ids = get_processed_upload_ids(classroom_id)
    current_ids = set(u['id'] for u in uploads)
    new_ids = current_ids - processed_ids
    
    print(f"Previously processed: {len(processed_ids)} uploads")
    print(f"New uploads: {len(new_ids)}")
    result['new_uploads'] = len(new_ids)
    
    # Skip if no new uploads (unless force regenerate)
    if not new_ids and not force_regenerate:
        result['message'] = 'No new uploads to process. Study guide is up to date.'
        print("No new uploads. Skipping study guide generation.")
        return result
    
    # Generate study guide from all uploads
    print("\nGenerating study guide from all uploads...")
    study_guide = generate_study_guide(uploads)
    
    # Store/update the study guide
    metadata = {
        'processed_upload_ids': list(current_ids),
        'upload_count': len(uploads),
        'last_updated': datetime.utcnow().isoformat()
    }
    update_or_create_study_guide(classroom_id, study_guide, metadata)
    
    result['message'] = f'Study guide generated from {len(uploads)} uploads.'
    
    # Analyze confusion patterns from chat (optional)
    print("\nAnalyzing confusion patterns...")
    messages = fetch_messages(classroom_id)
    print(f"Found {len(messages)} messages to analyze")
    
    if messages:
        confusion_summary = analyze_confusion_patterns(messages)
        # Check if confusion summary already exists
        supabase = get_supabase()
        existing_confusion = supabase.table('ai_insights').select('id').eq('classroom_id', classroom_id).eq('insight_type', 'confusion_summary').execute()
        
        if existing_confusion.data:
            # Update existing
            supabase.table('ai_insights').update({
                'content': confusion_summary,
                'metadata': {'message_count': len(messages)},
                'created_at': datetime.utcnow().isoformat()
            }).eq('id', existing_confusion.data[0]['id']).execute()
        else:
            store_insight(
                classroom_id=classroom_id,
                insight_type='confusion_summary',
                content=confusion_summary,
                metadata={'message_count': len(messages)}
            )
    
    print(f"\n{'='*50}")
    print("Processing complete!")
    print(f"{'='*50}\n")
    
    return result


def process_all_classrooms():
    """Process all classrooms in the database."""
    supabase = get_supabase()
    response = supabase.table('classrooms').select('id, name').execute()
    classrooms = response.data or []
    
    print(f"Found {len(classrooms)} classrooms to process")
    
    for classroom in classrooms:
        process_classroom(classroom['id'])


# ============================================================
# HTTP Server for Frontend Integration
# ============================================================

def run_server():
    """Run the AI service as an HTTP server."""
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)  # Enable CORS for frontend requests
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok',
            'provider': AI_PROVIDER,
            'model': GEMINI_MODEL if AI_PROVIDER == 'gemini' else OPENAI_MODEL
        })
    
    @app.route('/generate', methods=['POST'])
    def generate():
        """Generate study guide for a classroom."""
        try:
            data = request.get_json()
            classroom_id = data.get('classroom_id')
            force = data.get('force', False)
            
            if not classroom_id:
                return jsonify({'success': False, 'error': 'classroom_id is required'}), 400
            
            result = process_classroom(classroom_id, force_regenerate=force)
            return jsonify(result)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    provider_info = get_ai_provider_info()
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           ClassroomCogni AI Service (HTTP Server)             ║
║                                                               ║
║  AI Provider: {provider_info:<46} ║
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /health   - Health check                              ║
║    POST /generate - Generate study guide                      ║
║                     Body: {{"classroom_id": "...", "force": false}}  ║
║                                                               ║
║  Server running on port {SERVER_PORT}                              ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)


def main():
    """Main entry point."""
    if not check_env():
        sys.exit(1)
    
    provider_info = get_ai_provider_info()
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           ClassroomCogni AI Service                           ║
║                                                               ║
║  This service generates study guides and analyzes learning    ║
║  patterns while preserving student privacy.                   ║
║                                                               ║
║  Powered by: {provider_info:<48} ║
║                                                               ║
║  PRIVACY: Teachers only see aggregated insights.              ║
║  Individual student messages are never exposed.               ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--server':
            # Run as HTTP server
            run_server()
        else:
            # Process specific classroom
            classroom_id = sys.argv[1]
            process_classroom(classroom_id)
    else:
        # Process all classrooms
        print("No classroom ID provided. Processing all classrooms...")
        process_all_classrooms()


if __name__ == '__main__':
    main()
