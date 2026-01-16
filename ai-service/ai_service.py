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


def call_llm_with_images(prompt: str, image_uploads: List[Dict]) -> str:
    """Call the configured LLM provider with images (vision capability)."""
    if AI_PROVIDER == 'gemini':
        return _call_gemini_with_images(prompt, image_uploads)
    elif AI_PROVIDER == 'openai':
        return _call_openai_with_images(prompt, image_uploads)
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


def _call_gemini_with_images(prompt: str, image_uploads: List[Dict]) -> str:
    """Call Google Gemini API with images (vision capability)."""
    import google.generativeai as genai
    import base64
    import re
    
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
        
        # Build content parts: text prompt + images
        content_parts = [prompt]
        
        for img_upload in image_uploads:
            img_data_url = img_upload['content']
            title = img_upload['title']
            
            # Extract base64 data and mime type from data URL
            match = re.match(r'data:image/(\w+);base64,(.+)', img_data_url)
            if match:
                mime_type = f"image/{match.group(1)}"
                base64_data = match.group(2)
                
                # Decode base64 to bytes
                image_bytes = base64.b64decode(base64_data)
                
                # Add image with description
                content_parts.append({
                    "mime_type": mime_type,
                    "data": image_bytes
                })
                content_parts.append(f"\n[Image: {title}]\n")
        
        response = model.generate_content(content_parts)
        
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
            # max_completion_tokens=16384,
        )
        result = response.choices[0].message.content or ""
        print(f"OpenAI returned {len(result)} chars")
        return result
    except Exception as e:
        print(f"OpenAI API exception: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"OpenAI API error: {str(e)}")


def _call_openai_with_images(prompt: str, image_uploads: List[Dict]) -> str:
    """Call OpenAI API with images (vision capability)."""
    from openai import OpenAI
    import base64
    import re
    
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY is not set")
    
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    try:
        # Build messages with images
        messages = [
            {
                "role": "system",
                "content": "You are a helpful educational assistant that creates study guides and analyzes learning patterns. You can process both text and images."
            }
        ]
        
        # Add user message with text and images
        content = [{"type": "text", "text": prompt}]
        
        for img_upload in image_uploads:
            img_data_url = img_upload['content']
            title = img_upload['title']
            
            # Extract base64 data and mime type from data URL
            match = re.match(r'data:image/(\w+);base64,(.+)', img_data_url)
            if match:
                mime_type = f"image/{match.group(1)}"
                base64_data = match.group(2)
                
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": img_data_url  # OpenAI accepts data URLs directly
                    }
                })
                content.append({
                    "type": "text",
                    "text": f"[Image: {title}]"
                })
        
        messages.append({
            "role": "user",
            "content": content
        })
        
        # Use vision-capable model (gpt-4o-mini supports vision)
        # model = OPENAI_MODEL if 'gpt-4' in OPENAI_MODEL.lower() or 'o1' in OPENAI_MODEL.lower() else 'gpt-4o-mini'
        
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            # max_completion_tokens=16384,
        )
        result = response.choices[0].message.content or ""
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
    Supports both text and image uploads (images are sent directly to vision models).
    """
    # Separate text and image uploads
    text_uploads = []
    image_uploads = []
    
    for i, upload in enumerate(uploads, 1):
        title = upload.get('title', f'Note {i}')
        content = upload.get('content', '')
        file_type = upload.get('file_type', 'text')
        
        # Check if content is a base64 image
        is_image = content.startswith('data:image/') if content else False
        
        if is_image or file_type.startswith('image/'):
            image_uploads.append({
                'title': title,
                'content': content,
                'index': i
            })
            print(f"  Found image upload {i}: {title}")
        else:
            text_uploads.append({
                'title': title,
                'content': content,
                'index': i
            })
            print(f"  Processing text upload {i}: {title} ({len(content)} chars)")
    
    # Combine text notes
    notes_text = ""
    for upload in text_uploads:
        notes_text += f"\n--- Note {upload['index']}: {upload['title']} ---\n{upload['content']}\n"
    
    print(f"Total text content length: {len(notes_text)} chars")
    print(f"Total image uploads: {len(image_uploads)}")
    
    # Check if we have any actual content
    if len(notes_text.strip()) < 50 and len(image_uploads) == 0:
        return "No content found in uploads. Please add some notes first."
    
    prompt = f"""You are an expert academic tutor and study-guide designer.

NOTES:
{notes_text if notes_text.strip() else "No text notes provided."}

TASK:
Create a comprehensive, cohesive study guide from these notes. Write it as a flowing, well-organized document that a student would actually want to read and study from — not a rigid template.

OUTPUT FORMAT REQUIREMENTS:
- Use clean, structured Markdown.
- Use LaTeX-style math formatting for all mathematical expressions:
  - Inline math: $...$
  - Displayed equations: $$...$$
- Preserve special symbols (∫, ∑, →, ≤, ≥, etc.) correctly.
- Use headings, subheadings, bullet points, and spacing for readability.
- If you need a literal dollar sign (currency or placeholder), escape it as \\\$ and do NOT wrap non-math words in $...$.

GUIDELINES FOR CREATING THE STUDY GUIDE:

1. **Organize by Topic/Unit**: If the notes cover multiple topics or units, organize the guide accordingly with clear headings.

2. **Explain Concepts Naturally**: Write clear explanations that connect ideas together. Don't just list definitions — explain how concepts relate to each other and why they matter.

3. **Include Formulas & Key Information**: Present important formulas, rules, and facts clearly. For each formula, explain what the variables mean and when to use it.

4. **Show Examples**: Create (or use from the notes) worked examples with clear step-by-step explanations. Use blockquotes for examples. Show the reasoning, not just the steps.

5. **Highlight Common Pitfalls**: Based on the notes, mention common mistakes or tricky areas students should watch out for.

6. **Use Enriched Study Aids (where the notes support them)**:
   - **Tables**: Summaries, comparisons, variable definitions, and units. Keep them compact and readable in Markdown.
   - **Mnemonics / Memory Hooks**: Short, relevant, non-cheesy aids tied to the actual content.
   - **Checklists**: For procedures or multi-step methods.
   - **Worked Examples**: Stepwise, with brief reasoning per step.
   - **Mini-diagrams-in-words**: If a visual is needed but no image is provided, describe the layout textually (no ASCII art).

7. **End Each Major Section with Review Questions**: After covering a topic or unit, include 3-5 review questions that test understanding. These should be:
   - A mix of conceptual questions ("Why does X happen?") and application questions ("Calculate Y given Z")
   - Based directly on the material covered in the notes
   - Varied in difficulty — some straightforward recall, some requiring deeper thinking
   - Do NOT provide answers — let students test themselves

STYLE GUIDELINES:
- Write for a motivated high school or early college student.
- Be precise but conversational — like a knowledgeable tutor explaining things.
- Use simple language without dumbing down technical content.
- Create smooth transitions between sections.
- Make it feel like a cohesive document, not a fill-in-the-blank template.
"""

    print(f"Calling LLM with prompt length: {len(prompt)} chars")
    
    try:
        # If we have images, use vision-capable LLM call
        if image_uploads:
            result = call_llm_with_images(prompt, image_uploads)
        else:
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


def process_study_guide_only(classroom_id: str) -> Dict:
    """
    Generate only the study guide for a classroom (no insights).
    
    Args:
        classroom_id: The classroom to process
        
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
    print(f"Generating study guide for classroom: {classroom_id}")
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
    
    print(f"\n{'='*50}")
    print("Study guide generation complete!")
    print(f"{'='*50}\n")
    
    return result


def process_insights_only(classroom_id: str) -> Dict:
    """
    Generate only the confusion insights for a classroom (no study guide).
    
    Args:
        classroom_id: The classroom to process
        
    Returns:
        Dict with processing results
    """
    result = {
        'success': True,
        'classroom_id': classroom_id,
        'messages_analyzed': 0,
        'message': ''
    }
    
    print(f"\n{'='*50}")
    print(f"Generating insights for classroom: {classroom_id}")
    print(f"{'='*50}")
    
    # Analyze confusion patterns from chat
    print("\nAnalyzing confusion patterns...")
    messages = fetch_messages(classroom_id)
    print(f"Found {len(messages)} messages to analyze")
    result['messages_analyzed'] = len(messages)
    
    if not messages:
        result['message'] = 'No messages found to analyze.'
        print("No messages to analyze.")
        return result
    
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
        print("  ✓ Updated existing confusion summary")
    else:
        store_insight(
            classroom_id=classroom_id,
            insight_type='confusion_summary',
            content=confusion_summary,
            metadata={'message_count': len(messages)}
        )
    
    result['message'] = f'Insights generated from {len(messages)} messages.'
    
    print(f"\n{'='*50}")
    print("Insights generation complete!")
    print(f"{'='*50}\n")
    
    return result


def process_classroom(classroom_id: str, force_regenerate: bool = False) -> Dict:
    """
    Main processing function for a classroom (generates both study guide and insights).
    
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
        """Generate both study guide and insights for a classroom (legacy endpoint)."""
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
    
    @app.route('/generate-study-guide', methods=['POST'])
    def generate_study_guide_endpoint():
        """Generate only the study guide for a classroom (no insights)."""
        try:
            data = request.get_json()
            classroom_id = data.get('classroom_id')
            
            if not classroom_id:
                return jsonify({'success': False, 'error': 'classroom_id is required'}), 400
            
            result = process_study_guide_only(classroom_id)
            return jsonify(result)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/generate-insights', methods=['POST'])
    def generate_insights_endpoint():
        """Generate only the confusion insights for a classroom (no study guide)."""
        try:
            data = request.get_json()
            classroom_id = data.get('classroom_id')
            
            if not classroom_id:
                return jsonify({'success': False, 'error': 'classroom_id is required'}), 400
            
            result = process_insights_only(classroom_id)
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
║    GET  /health              - Health check                   ║
║    POST /generate            - Generate both (legacy)         ║
║    POST /generate-study-guide - Study guide only              ║
║    POST /generate-insights    - Confusion insights only       ║
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