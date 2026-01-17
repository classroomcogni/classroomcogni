"""
Seed Test Data for Classly
=================================

This script creates sample data for testing and demo purposes.
Run this after setting up your Supabase database.

Usage: python seed_test_data.py
"""

import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    exit(1)

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Sample biology notes
SAMPLE_UPLOADS = [
    {
        "title": "Cell Structure Notes - Chapter 3",
        "content": """Cell Structure and Function

The cell is the basic unit of life. All living organisms are made up of cells.

Key Organelles:
- Nucleus: Contains DNA, controls cell activities
- Mitochondria: Powerhouse of the cell, produces ATP through cellular respiration
- Ribosomes: Protein synthesis
- Endoplasmic Reticulum (ER): 
  - Rough ER: Has ribosomes, makes proteins
  - Smooth ER: Makes lipids, detoxifies
- Golgi Apparatus: Packages and ships proteins
- Cell Membrane: Controls what enters/exits the cell (selectively permeable)
- Cytoplasm: Gel-like fluid inside the cell

Plant cells also have:
- Cell Wall: Provides structure and support
- Chloroplasts: Site of photosynthesis
- Large Central Vacuole: Stores water and nutrients

Remember: Prokaryotes (bacteria) don't have membrane-bound organelles!"""
    },
    {
        "title": "Mitosis Notes",
        "content": """Mitosis - Cell Division

Mitosis is how cells divide to create two identical daughter cells.

Phases of Mitosis:
1. INTERPHASE (not technically mitosis)
   - Cell grows and copies DNA
   - G1 → S → G2

2. PROPHASE
   - Chromatin condenses into chromosomes
   - Nuclear membrane breaks down
   - Spindle fibers form

3. METAPHASE
   - Chromosomes line up in the MIDDLE
   - Spindle fibers attach to centromeres

4. ANAPHASE
   - Sister chromatids are pulled APART
   - Move to opposite poles

5. TELOPHASE
   - Nuclear membranes reform
   - Chromosomes decondense
   - Cytokinesis begins (cell splits)

Mnemonic: PMAT (Prophase, Metaphase, Anaphase, Telophase)

Why is mitosis important?
- Growth
- Repair
- Asexual reproduction"""
    },
    {
        "title": "Photosynthesis Summary",
        "content": """Photosynthesis

The process by which plants convert light energy into chemical energy (glucose).

Overall Equation:
6CO2 + 6H2O + light energy → C6H12O6 + 6O2

Location: Chloroplasts (specifically in the thylakoid membranes and stroma)

Two Main Stages:

1. LIGHT-DEPENDENT REACTIONS
   - Occur in thylakoid membranes
   - Need sunlight
   - Water is split (photolysis)
   - Produces ATP and NADPH
   - Releases O2 as byproduct

2. LIGHT-INDEPENDENT REACTIONS (Calvin Cycle)
   - Occur in stroma
   - Don't need direct light
   - Uses ATP and NADPH from light reactions
   - CO2 is fixed into glucose
   - Also called "carbon fixation"

Factors affecting photosynthesis:
- Light intensity
- CO2 concentration
- Temperature
- Water availability"""
    },
    {
        "title": "Cellular Respiration",
        "content": """Cellular Respiration

The process of breaking down glucose to release energy (ATP).

Overall Equation:
C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP

Three Main Stages:

1. GLYCOLYSIS
   - Location: Cytoplasm
   - Breaks glucose (6C) into 2 pyruvate (3C)
   - Produces: 2 ATP, 2 NADH
   - Doesn't need oxygen (anaerobic)

2. KREBS CYCLE (Citric Acid Cycle)
   - Location: Mitochondrial matrix
   - Pyruvate converted to Acetyl-CoA first
   - Produces: 2 ATP, 6 NADH, 2 FADH2
   - Releases CO2

3. ELECTRON TRANSPORT CHAIN
   - Location: Inner mitochondrial membrane
   - Uses NADH and FADH2
   - Produces: 32-34 ATP
   - Needs oxygen (aerobic)
   - Water is produced

Total ATP: ~36-38 per glucose molecule

Anaerobic respiration (fermentation):
- Lactic acid fermentation (muscles)
- Alcoholic fermentation (yeast)"""
    },
    {
        "title": "DNA Structure and Replication",
        "content": """DNA Structure

DNA = Deoxyribonucleic Acid

Structure:
- Double helix (twisted ladder)
- Made of nucleotides
- Each nucleotide has:
  - Phosphate group
  - Deoxyribose sugar
  - Nitrogenous base

The Four Bases:
- Adenine (A) pairs with Thymine (T)
- Guanine (G) pairs with Cytosine (C)
- A-T has 2 hydrogen bonds
- G-C has 3 hydrogen bonds

DNA Replication:
1. Helicase unzips the double helix
2. DNA polymerase adds new nucleotides
3. Leading strand: continuous
4. Lagging strand: Okazaki fragments
5. Ligase joins fragments together

Replication is SEMI-CONSERVATIVE:
Each new DNA molecule has one old strand and one new strand

Why is DNA replication important?
- Cell division
- Passing genetic info to offspring
- Maintaining genetic continuity"""
    }
]

# Sample chat messages (for confusion analysis)
SAMPLE_MESSAGES = [
    "Can someone explain the difference between mitosis and meiosis?",
    "I'm confused about the light reactions vs Calvin cycle",
    "Wait, so ATP is made in both photosynthesis AND respiration?",
    "How do I remember all the phases of mitosis?",
    "Is the mitochondria really the powerhouse of the cell lol",
    "I don't understand how DNA replication works",
    "What's the difference between rough and smooth ER?",
    "Why do plant cells have cell walls but animal cells don't?",
    "The Krebs cycle is so confusing",
    "Can someone help me understand electron transport chain?",
    "I keep mixing up glycolysis and the Calvin cycle",
    "What does semi-conservative mean for DNA replication?",
    "How many ATP does cellular respiration actually make?",
    "I'm struggling with the photosynthesis equation",
    "Does anyone have good mnemonics for the cell organelles?",
]


def seed_data(classroom_id: str, user_id: str):
    """Seed test data for a classroom."""
    print(f"Seeding data for classroom {classroom_id}...")
    
    # Add uploads
    for upload in SAMPLE_UPLOADS:
        supabase.table('uploads').insert({
            'classroom_id': classroom_id,
            'user_id': user_id,
            'title': upload['title'],
            'content': upload['content'],
            'file_type': 'text'
        }).execute()
        print(f"  ✓ Added upload: {upload['title']}")
    
    # Add messages
    for message in SAMPLE_MESSAGES:
        supabase.table('messages').insert({
            'classroom_id': classroom_id,
            'user_id': user_id,
            'content': message,
            'channel': 'general'
        }).execute()
    print(f"  ✓ Added {len(SAMPLE_MESSAGES)} sample messages")
    
    print("\nTest data seeded successfully!")
    print("Now run: python ai_service.py " + classroom_id)


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python seed_test_data.py <classroom_id> <user_id>")
        print("\nGet these IDs from your Supabase dashboard after creating a classroom.")
        exit(1)
    
    classroom_id = sys.argv[1]
    user_id = sys.argv[2]
    seed_data(classroom_id, user_id)
