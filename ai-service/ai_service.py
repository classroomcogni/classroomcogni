"""
ClassroomCogni AI Service
=========================

Simple service that generates comprehensive study guides from uploaded notes.
Supports both Google Gemini and OpenAI GPT.
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
AI_PROVIDER = os.getenv('AI_PROVIDER', 'gemini').lower()

# Gemini configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')

# OpenAI configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Server configuration
SERVER_PORT = int(os.getenv('AI_SERVICE_PORT', '5000'))

# Initialize Supabase client (lazy)
_supabase = None
def get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase


def check_env():
    """Check for required environment variables."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return False
    
    if AI_PROVIDER == 'gemini':
        if not GEMINI_API_KEY:
            print("Error: GEMINI_API_KEY must be set when using Gemini")
            return False
    elif AI_PROVIDER == 'openai':
        if not OPENAI_API_KEY:
            print("Error: OPENAI_API_KEY must be set when using OpenAI")
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


def fetch_uploads(classroom_id: str) -> List[Dict]:
    """Fetch all uploads for a classroom."""
    supabase = get_supabase()
    response = supabase.table('uploads').select('*').eq('classroom_id', classroom_id).order('created_at').execute()
    return response.data or []


def get_existing_study_guide(classroom_id: str) -> Optional[Dict]:
    """Get the existing study guide for a classroom (if any)."""
    supabase = get_supabase()
    response = supabase.table('ai_insights').select('*').eq('classroom_id', classroom_id).eq('insight_type', 'study_guide').limit(1).execute()
    return response.data[0] if response.data else None


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
        "max_output_tokens": 8192,
    }
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
    
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config=generation_config,
        safety_settings=safety_settings
    )
    response = model.generate_content(prompt)
    return response.text


def _call_openai(prompt: str) -> str:
    """Call OpenAI API to generate text."""
    from openai import OpenAI
    
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful educational assistant that creates comprehensive study guides."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=8192,
    )
    return response.choices[0].message.content or ""


def generate_study_guide(uploads: List[Dict]) -> str:
    """Generate a comprehensive study guide from all uploads."""
    
    # Combine all notes
    notes_text = ""
    for i, upload in enumerate(uploads, 1):
        notes_text += f"\n--- Note {i}: {upload['title']} ---\n"
        notes_text += upload['content']
        notes_text += "\n"
    
    # Truncate if too long
    if len(notes_text) > 30000:
        notes_text = notes_text[:30000] + "\n\n[Additional notes truncated...]"
    
    prompt = f"""You are a helpful study assistant. Create a comprehensive study guide based on the following class notes.

CLASS NOTES:
{notes_text}

Create a well-organized study guide with the following structure:

# 📚 Complete Study Guide

## 📋 Overview
Brief summary of what these notes cover.

## 🔑 Key Concepts
Explain the main concepts clearly with definitions.

## 📝 Important Terms
List key vocabulary with definitions.

## 💡 Main Ideas
Bullet points of the most important takeaways.

## 🧮 Formulas & Equations (if applicable)
Use LaTeX notation: $inline$ or $$display$$

## ❓ Review Questions
5-10 questions to test understanding.

## 🎯 Summary
Key points to remember.

FORMATTING:
- Use proper Markdown with headers (##, ###)
- Use bullet points and numbered lists
- Use **bold** for important terms
- Use tables when helpful
- For math, use LaTeX: $x^2$ or $$\\frac{{a}}{{b}}$$
- Be thorough but clear"""

    return call_llm(prompt)


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
        data = {
            'classroom_id': classroom_id,
            'insight_type': 'study_guide',
            'content': content,
            'unit_name': 'Complete Study Guide',
            'metadata': metadata
        }
        supabase.table('ai_insights').insert(data).execute()
        print("  ✓ Created new study guide")


def process_classroom(classroom_id: str, force_regenerate: bool = False) -> Dict:
    """Generate a study guide for a classroom."""
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
    print(f"\nFound {len(uploads)} uploads")
    result['uploads_processed'] = len(uploads)
    
    if not uploads:
        result['message'] = 'No uploads found in this classroom.'
        print("No uploads to process.")
        return result
    
    # Generate study guide from all uploads
    print("\nGenerating study guide...")
    try:
        study_guide_content = generate_study_guide(uploads)
        
        if not study_guide_content or len(study_guide_content.strip()) < 50:
            result['success'] = False
            result['message'] = 'Failed to generate study guide content.'
            return result
        
        # Save to database
        metadata = {
            'upload_count': len(uploads),
            'last_updated': datetime.utcnow().isoformat()
        }
        update_or_create_study_guide(classroom_id, study_guide_content, metadata)
        
        result['message'] = f'Study guide generated from {len(uploads)} uploads.'
        print(f"\n✓ Study guide generated successfully!")
        
    except Exception as e:
        result['success'] = False
        result['message'] = f'Error generating study guide: {str(e)}'
        print(f"\n✗ Error: {e}")
    
    return result


# HTTP Server
def run_server():
    """Run the AI service as an HTTP server."""
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    
    app = Flask(__name__)
    CORS(app)
    
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
    
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           ClassroomCogni AI Service                           ║
║                                                               ║
║  AI Provider: {get_ai_provider_info():<46} ║
║  Server running on port {SERVER_PORT}                              ║
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /health   - Health check                              ║
║    POST /generate - Generate study guide                      ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)


def main():
    """Main entry point."""
    if not check_env():
        sys.exit(1)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--server':
            run_server()
        else:
            classroom_id = sys.argv[1]
            process_classroom(classroom_id)
    else:
        print("Usage:")
        print("  python ai_service.py --server        # Run as HTTP server")
        print("  python ai_service.py <classroom_id>  # Process specific classroom")


if __name__ == '__main__':
    main()
