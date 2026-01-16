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
    console.log('🔄 Checking initial session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📡 Initial session:', session ? 'Found' : 'None');
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth state changed:', event, session ? 'Session exists' : 'No session');
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
    console.log('👤 Fetching user profile for:', userId);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('👤 Profile fetch result:', { data, error });
    
    if (error) {
      console.error('❌ Failed to fetch user profile:', error);
    }
    
    if (!error && data) {
      setUser(data as User);
      console.log('✅ User profile loaded:', data);
    } else {
      console.warn('⚠️ No user profile found - user may need to complete signup');
    }
    setLoading(false);
  };

  const signUp = async (email: string, password: string, role: 'student' | 'teacher', displayName: string) => {
    console.log('🔐 SignUp attempt:', { email, role, displayName });
    setLoading(true);
    
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
      setLoading(false);
      throw e;
    }

    if (error) {
      console.error('❌ SignUp error:', error);
      setLoading(false);
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
        setLoading(false);
        return { error: profileError };
      }
      console.log('✅ Profile created successfully');
      
      // Fetch the user profile to set it in state
      await fetchUserProfile(data.user.id);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 SignIn attempt:', { email });
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('📡 SignIn response:', { data, error });
    
    if (error) {
      setLoading(false);
      return { error };
    }
    
    // Wait for user profile to be fetched before returning
    if (data.user) {
      await fetchUserProfile(data.user.id);
    }
    
    return { error: null };
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
