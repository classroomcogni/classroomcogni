'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signUp(email, password, role, displayName);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#faf8f5] to-[#fce7f3] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-105 transition-all">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </Link>
          <h1 className="text-[#1e293b] text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-[#64748b] mt-2">Join Classly today</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 space-y-6">
          {error && (
            <div className="bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <label className="block text-[#1e293b] text-sm font-medium mb-2">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input w-full"
              placeholder="What should we call you?"
              required
            />
          </div>

          <div>
            <label className="block text-[#1e293b] text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-[#1e293b] text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-[#1e293b] text-sm font-medium mb-3">I am a...</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  role === 'student'
                    ? 'bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border-[#6366f1] text-[#6366f1] shadow-md'
                    : 'bg-[#faf8f5] border-[#e2e0dc] text-[#64748b] hover:border-[#6366f1] hover:bg-white'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  role === 'student' ? 'bg-white shadow-sm' : 'bg-white/50'
                }`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="font-medium">Student</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  role === 'teacher'
                    ? 'bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border-[#6366f1] text-[#6366f1] shadow-md'
                    : 'bg-[#faf8f5] border-[#e2e0dc] text-[#64748b] hover:border-[#6366f1] hover:bg-white'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  role === 'teacher' ? 'bg-white shadow-sm' : 'bg-white/50'
                }`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <span className="font-medium">Teacher</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base rounded-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="text-center text-[#64748b] mt-8">
          Already have an account?{' '}
          <Link href="/login" className="text-[#6366f1] hover:text-[#4f46e5] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
