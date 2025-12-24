'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, User } from './supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'student' | 'teacher', displayName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setUser(data as User);
    }
    setLoading(false);
  };

  const signUp = async (email: string, password: string, role: 'student' | 'teacher', displayName: string) => {
    console.log('🔐 SignUp attempt:', { email, role, displayName });
    
    let data, error;
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
      });
      data = result.data;
      error = result.error;
      console.log('📡 Supabase signUp response:', { data, error });
    } catch (e) {
      console.error('❌ SignUp exception:', e);
      throw e;
    }

    if (error) {
      console.error('❌ SignUp error:', error);
      return { error };
    }

    if (data.user) {
      console.log('✅ User created, creating profile...', { userId: data.user.id });
      // Create user profile
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        email,
        role,
        display_name: displayName,
      });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        return { error: profileError };
      }
      console.log('✅ Profile created successfully');
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 SignIn attempt:', { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('📡 SignIn response:', { data, error });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
