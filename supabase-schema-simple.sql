-- ClassroomCogni Database Schema (Simple Version)
-- Use this if you have trouble enabling the pgvector extension
-- This version stores embeddings as JSON arrays instead of VECTOR type
-- 
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classrooms table
CREATE TABLE public.classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  join_code TEXT UNIQUE NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classroom memberships (students joining classrooms)
CREATE TABLE public.classroom_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(classroom_id, user_id)
);

-- Messages (chat in classrooms)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'general' CHECK (channel IN ('general', 'study-guide')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Uploads (notes and documents)
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Insights (study guides, confusion summaries, etc.)
-- PRIVACY NOTE: This table stores ONLY aggregated, anonymized insights
-- Individual student messages are NEVER stored here
CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('study_guide', 'confusion_summary', 'unit_cluster')),
  unit_name TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embeddings for uploads (SIMPLE VERSION - stores as JSONB instead of VECTOR)
-- This works without pgvector extension but is less efficient for large datasets
CREATE TABLE public.upload_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  embedding JSONB NOT NULL, -- Stores embedding as JSON array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(upload_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Can read own profile, insert on signup
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Classrooms: Teachers can create, members can view
CREATE POLICY "Teachers can create classrooms" ON public.classrooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Members can view classrooms" ON public.classrooms
  FOR SELECT USING (
    teacher_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Anyone can view classroom by join code" ON public.classrooms
  FOR SELECT USING (true);

CREATE POLICY "Teachers can update own classrooms" ON public.classrooms
  FOR UPDATE USING (teacher_id = auth.uid());

-- Classroom memberships
CREATE POLICY "Users can join classrooms" ON public.classroom_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can view memberships" ON public.classroom_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.classrooms WHERE id = classroom_id AND teacher_id = auth.uid())
  );

-- Messages: Members can read/write in their classrooms
CREATE POLICY "Members can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = messages.classroom_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classrooms WHERE id = messages.classroom_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Members can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = messages.classroom_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classrooms WHERE id = messages.classroom_id AND teacher_id = auth.uid())
  );

-- Uploads: Members can upload and view
CREATE POLICY "Members can upload" ON public.uploads
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = uploads.classroom_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classrooms WHERE id = uploads.classroom_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Members can view uploads" ON public.uploads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = uploads.classroom_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classrooms WHERE id = uploads.classroom_id AND teacher_id = auth.uid())
  );

-- AI Insights: All classroom members can view
CREATE POLICY "Members can view insights" ON public.ai_insights
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classroom_memberships WHERE classroom_id = ai_insights.classroom_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classrooms WHERE id = ai_insights.classroom_id AND teacher_id = auth.uid())
  );

-- Upload embeddings: Service role only
CREATE POLICY "Service can manage embeddings" ON public.upload_embeddings
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_messages_classroom ON public.messages(classroom_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_uploads_classroom ON public.uploads(classroom_id);
CREATE INDEX idx_memberships_user ON public.classroom_memberships(user_id);
CREATE INDEX idx_memberships_classroom ON public.classroom_memberships(classroom_id);
CREATE INDEX idx_insights_classroom ON public.ai_insights(classroom_id);
CREATE INDEX idx_classrooms_join_code ON public.classrooms(join_code);

-- Function to generate random join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
