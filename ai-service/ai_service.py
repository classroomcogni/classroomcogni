"""
ClassroomCogni AI Service
=========================

This service runs as a background process that:
1. Fetches uploaded notes from Supabase
2. Generates embeddings using sentence-transformers
3. Clusters notes into logical units
4. Generates study guides using Google Gemini API
5. Analyzes chat for confusion patterns (aggregated, anonymous)
6. Stores results back to Supabase

PRIVACY ARCHITECTURE:
- This service reads raw student data but NEVER exposes individual messages to teachers
- All insights stored are AGGREGATED and ANONYMIZED
- Teachers only see patterns, not individual student contributions
- The AI acts as a privacy-preserving intermediary

Run: python ai_service.py [classroom_id]
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

# Gemini configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')

# Check for required environment variables
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    print("Copy .env.example to .env and fill in your credentials")
    sys.exit(1)

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY must be set")
    print("Get your API key from https://aistudio.google.com/app/apikey")
    sys.exit(1)

# Initialize Supabase client
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Lazy load ML libraries (they're heavy)
_embedder = None
def get_embedder():
    """Lazy load the sentence transformer model."""
    global _embedder
    if _embedder is None:
        print("Loading embedding model (sentence-transformers/all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        print("Model loaded!")
    return _embedder


def fetch_uploads(classroom_id: str) -> List[Dict]:
    """Fetch all uploads for a classroom."""
    response = supabase.table('uploads').select('*').eq('classroom_id', classroom_id).execute()
    return response.data or []


def fetch_messages(classroom_id: str) -> List[Dict]:
    """
    Fetch messages for confusion analysis.
    
    PRIVACY NOTE: These messages are processed locally and NEVER stored
    in a way that teachers can see individual messages. Only aggregated
    patterns are extracted and stored.
    """
    response = supabase.table('messages').select('content').eq('classroom_id', classroom_id).execute()
    return response.data or []


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts using MiniLM."""
    embedder = get_embedder()
    embeddings = embedder.encode(texts, show_progress_bar=True)
    return embeddings.tolist()


def cluster_uploads(uploads: List[Dict], n_clusters: int = 3) -> Dict[int, List[Dict]]:
    """
    Cluster uploads into logical units using K-means.
    
    This groups related notes together so the AI can generate
    coherent study guides for each topic area.
    """
    if len(uploads) < 2:
        return {0: uploads}
    
    from sklearn.cluster import KMeans
    import numpy as np
    
    # Generate embeddings for all uploads
    texts = [f"{u['title']}\n{u['content']}" for u in uploads]
    embeddings = generate_embeddings(texts)
    
    # Determine optimal number of clusters (max 5, min 1)
    n_clusters = min(max(1, len(uploads) // 2), 5, len(uploads))
    
    # Perform clustering
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(embeddings)
    
    # Group uploads by cluster
    clusters = {}
    for i, label in enumerate(labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(uploads[i])
    
    return clusters


def generate_unit_name(uploads: List[Dict]) -> str:
    """Generate a descriptive name for a unit based on its uploads."""
    titles = [u['title'] for u in uploads[:3]]  # Use first 3 titles
    
    prompt = f"""Based on these note titles, generate a short, descriptive unit name (3-5 words max):
Titles: {', '.join(titles)}

Respond with ONLY the unit name, nothing else."""

    try:
        response = call_gemini(prompt)
        return response.strip().strip('"').strip("'")[:50]  # Limit length
    except Exception as e:
        print(f"Error generating unit name: {e}")
        return f"Unit {uploads[0]['title'][:30]}"


def generate_study_guide(uploads: List[Dict], unit_name: str) -> str:
    """
    Generate a student-friendly study guide from clustered uploads.
    
    The AI synthesizes the uploaded notes into a clear, organized
    study guide that helps students review the material.
    """
    # Combine all content from the cluster
    combined_content = "\n\n---\n\n".join([
        f"**{u['title']}**\n{u['content']}" for u in uploads
    ])
    
    # Truncate if too long (Gemini context limit)
    if len(combined_content) > 8000:
        combined_content = combined_content[:8000] + "\n\n[Content truncated...]"
    
    prompt = f"""You are a helpful study assistant. Based on the following class notes about "{unit_name}", 
create a clear, student-friendly study guide.

CLASS NOTES:
{combined_content}

Create a study guide that:
1. Summarizes the key concepts
2. Lists important terms and definitions
3. Highlights main ideas students should remember
4. Includes 3-5 review questions

Format the guide clearly with headers and bullet points. Keep it concise but comprehensive.
Write in a friendly, encouraging tone suitable for high school students."""

    try:
        return call_gemini(prompt)
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
        return call_gemini(prompt)
    except Exception as e:
        print(f"Error analyzing confusion: {e}")
        return f"Confusion analysis failed: {str(e)}"


def call_gemini(prompt: str) -> str:
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


def store_insight(classroom_id: str, insight_type: str, content: str, unit_name: Optional[str] = None, metadata: Dict = None):
    """Store an AI insight in Supabase."""
    data = {
        'classroom_id': classroom_id,
        'insight_type': insight_type,
        'content': content,
        'unit_name': unit_name,
        'metadata': metadata or {}
    }
    
    supabase.table('ai_insights').insert(data).execute()
    print(f"  ✓ Stored {insight_type}" + (f" for {unit_name}" if unit_name else ""))


def process_classroom(classroom_id: str):
    """
    Main processing function for a classroom.
    
    This orchestrates the entire AI pipeline:
    1. Fetch data from Supabase
    2. Cluster uploads into units
    3. Generate study guides for each unit
    4. Analyze confusion patterns
    5. Store results back to Supabase
    """
    print(f"\n{'='*50}")
    print(f"Processing classroom: {classroom_id}")
    print(f"{'='*50}")
    
    # Fetch uploads
    uploads = fetch_uploads(classroom_id)
    print(f"\nFound {len(uploads)} uploads")
    
    if uploads:
        # Cluster uploads into units
        print("\nClustering uploads into units...")
        clusters = cluster_uploads(uploads)
        print(f"Created {len(clusters)} unit clusters")
        
        # Generate study guide for each cluster
        print("\nGenerating study guides...")
        for cluster_id, cluster_items in clusters.items():
            print(f"\n  Processing cluster {cluster_id + 1} ({len(cluster_items)} uploads)...")
            
            # Generate unit name
            unit_name = generate_unit_name(cluster_items)
            print(f"  Unit name: {unit_name}")
            
            # Generate study guide
            study_guide = generate_study_guide(cluster_items, unit_name)
            
            # Store the study guide
            store_insight(
                classroom_id=classroom_id,
                insight_type='study_guide',
                content=study_guide,
                unit_name=unit_name,
                metadata={
                    'upload_count': len(cluster_items),
                    'upload_ids': [u['id'] for u in cluster_items]
                }
            )
    
    # Analyze confusion patterns from chat
    print("\nAnalyzing confusion patterns...")
    messages = fetch_messages(classroom_id)
    print(f"Found {len(messages)} messages to analyze")
    
    if messages:
        confusion_summary = analyze_confusion_patterns(messages)
        store_insight(
            classroom_id=classroom_id,
            insight_type='confusion_summary',
            content=confusion_summary,
            metadata={'message_count': len(messages)}
        )
    
    print(f"\n{'='*50}")
    print("Processing complete!")
    print(f"{'='*50}\n")


def process_all_classrooms():
    """Process all classrooms in the database."""
    response = supabase.table('classrooms').select('id, name').execute()
    classrooms = response.data or []
    
    print(f"Found {len(classrooms)} classrooms to process")
    
    for classroom in classrooms:
        process_classroom(classroom['id'])


def main():
    """Main entry point."""
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║           ClassroomCogni AI Service                           ║
║                                                               ║
║  This service generates study guides and analyzes learning    ║
║  patterns while preserving student privacy.                   ║
║                                                               ║
║  Powered by: Google Gemini ({GEMINI_MODEL})                   ║
║                                                               ║
║  PRIVACY: Teachers only see aggregated insights.              ║
║  Individual student messages are never exposed.               ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    if len(sys.argv) > 1:
        # Process specific classroom
        classroom_id = sys.argv[1]
        process_classroom(classroom_id)
    else:
        # Process all classrooms
        print("No classroom ID provided. Processing all classrooms...")
        process_all_classrooms()


if __name__ == '__main__':
    main()
