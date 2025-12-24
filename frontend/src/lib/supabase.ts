import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// DEBUG: Log configuration (remove in production)
console.log('🔧 Supabase Config Debug:');
console.log('  URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('  Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET');
console.log('  URL valid:', supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co'));

// Create a single supabase client for the browser
// Handle missing credentials gracefully for build time
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
  console.log('✅ Creating Supabase client with real credentials');
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Create a dummy client for build time - will be replaced at runtime
  console.warn('⚠️ Using placeholder Supabase client - check your .env.local file');
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };

// Database types for TypeScript
export interface User {
  id: string;
  email: string;
  role: 'student' | 'teacher';
  display_name: string;
  created_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  description: string;
  join_code: string;
  teacher_id: string;
  created_at: string;
}

export interface ClassroomMembership {
  id: string;
  classroom_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  classroom_id: string;
  user_id: string;
  content: string;
  channel: string; // 'general' or 'study-guide'
  created_at: string;
  // Joined data
  user?: User;
}

export interface Upload {
  id: string;
  classroom_id: string;
  user_id: string;
  title: string;
  content: string;
  file_type: string;
  created_at: string;
  // Joined data
  user?: User;
}

export interface AIInsight {
  id: string;
  classroom_id: string;
  insight_type: 'study_guide' | 'confusion_summary' | 'unit_cluster';
  unit_name: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
