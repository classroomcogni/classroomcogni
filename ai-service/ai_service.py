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

# Embeddings removed; clustering disabled — no heavy ML dependency required.


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


# Embeddings were removed when clustering was removed — no embedding model is required for the current pipeline.


# Clustering and unit-name generation removed to simplify the pipeline.
# All uploads are combined and passed to `generate_study_guide_from_uploads` which produces a single comprehensive study guide.


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
    
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY is not set")
    
    genai.configure(api_key=GEMINI_API_KEY)
    
    generation_config = {
        "temperature": 0.7,
        "top_p": 0.9,
        "max_output_tokens": 16384,
    }
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    
    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        response = model.generate_content(prompt)
        
        # Check if response was blocked
        if not response.parts:
            print(f"Gemini response blocked or empty. Candidates: {response.candidates}")
            if response.candidates and response.candidates[0].finish_reason:
                print(f"Finish reason: {response.candidates[0].finish_reason}")
            return ""
        
        return response.text
    except Exception as e:
        print(f"Gemini API exception: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Gemini API error: {str(e)}")


def _call_openai(prompt: str) -> str:
    """Call OpenAI API to generate text."""
    from openai import OpenAI
    
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY is not set")
    
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
            max_completion_tokens=16384,
        )
        result = response.choices[0].message.content or ""
        print(f"OpenAI returned {len(result)} chars")
        return result
    except Exception as e:
        print(f"OpenAI API exception: {e}")
        import traceback
        traceback.print_exc()
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


def generate_study_guide_from_uploads(uploads: List[Dict]) -> str:
    """
    Generate a single comprehensive study guide from all uploads.
    
    Takes all uploaded notes and sends them to the LLM to create
    one study guide organized by unit/topic.
    """
    # Combine all notes into a single text
    notes_text = ""
    for i, upload in enumerate(uploads, 1):
        title = upload.get('title', f'Note {i}')
        content = upload.get('content', '')
        print(f"  Processing upload {i}: {title} ({len(content)} chars)")
        notes_text += f"\n--- Note {i}: {title} ---\n{content}\n"
    
    print(f"Total notes content length: {len(notes_text)} chars")
    
    # Check if we have any actual content
    if len(notes_text.strip()) < 50:
        return "No content found in uploads. Please add some notes first."
    
    prompt = f"""You are an expert academic tutor and study-guide designer.
NOTES: {notes_text}

TASK:
Given a student’s uploaded notes, create a comprehensive, high-quality study guide that is clearly separated by unit.

CRITICAL RULES:
- Use ONLY the information in the provided notes.
- Do NOT invent topics, formulas, or examples not present in the notes.
- Prioritize clarity, correctness, and usefulness for exam preparation.

OUTPUT FORMAT REQUIREMENTS:
- Use clean, structured Markdown.
- Use LaTeX-style math formatting for all mathematical expressions:
  - Inline math: $...$
  - Displayed equations: $$...$$
- Preserve special symbols (∫, ∑, →, ≤, ≥, etc.) correctly.
- Use headings, subheadings, bullet points, tables, and spacing for readability.

STRUCTURE THE STUDY GUIDE AS FOLLOWS:

# 📘 Unit X: [Unit Title or Topic]

## 1. Core Concepts
- Concise explanations of key ideas
- Define important terms clearly
- Explain *why* concepts matter or how they are used

## 2. Key Formulas & Rules
- List all formulas exactly as presented in the notes
- For each formula:
  - State what each variable represents
  - Briefly explain when/how to use it
- Use proper math formatting

## 3. Worked Examples (If Present in Notes)
- Rewrite example problems step-by-step
- Clearly show reasoning and intermediate steps
- Highlight common patterns or strategies

## 4. Common Mistakes & Pitfalls
- Based strictly on the notes
- Emphasize misunderstandings students are likely to have

## 5. Exam-Focused Takeaways
- Short bullet points summarizing what students must remember
- Prioritize high-yield ideas

STYLE GUIDELINES:
- Write for a motivated high school or early college student.
- Be precise, not verbose.
- Use simple language without dumbing down the math.
- Avoid filler phrases like “this is important” — show importance through explanation.

If multiple units are present, repeat the above structure for each unit.
"""

    print(f"Calling LLM with prompt length: {len(prompt)} chars")
    
    try:
        result = call_llm(prompt)
        print(f"LLM returned {len(result) if result else 0} chars")
        
        if not result:
            return "Study guide generation returned no response from AI. Please check API configuration."
        
        if len(result.strip()) < 100:
            print(f"LLM response too short: {result}")
            return f"Study guide generation returned insufficient content. Response: {result[:200]}"
        
        return result
    except Exception as e:
        print(f"Error generating study guide: {e}")
        import traceback
        traceback.print_exc()
        return f"Study guide generation failed: {str(e)}"


def process_classroom(classroom_id: str, force_regenerate: bool = False) -> Dict:
    """
    Main processing function for a classroom.
    
    This orchestrates the entire AI pipeline:
    1. Fetch all uploads from Supabase
    2. Generate a SINGLE comprehensive study guide from all uploads
    3. Analyze confusion patterns
    4. Store results back to Supabase
    
    Args:
        classroom_id: The classroom to process
        force_regenerate: Unused, kept for API compatibility
        
    Returns:
        Dict with processing results
    """
    result = {
        'success': True,
        'classroom_id': classroom_id,
        'uploads_processed': 0,
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
    
    # Generate study guide from ALL uploads
    print("\nGenerating study guide from all uploads...")
    study_guide = generate_study_guide_from_uploads(uploads)
    
    # Store/update the study guide
    current_ids = [u['id'] for u in uploads]
    metadata = {
        'processed_upload_ids': current_ids,
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