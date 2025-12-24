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
    <div className="min-h-screen bg-[#1a1d21] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#4a154b] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">C</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Create your account</h1>
          <p className="text-gray-400 mt-2">Join ClassroomCogni today</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#222529] rounded-lg p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b]"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b]"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b]"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">I am a...</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-3 rounded border ${
                  role === 'student'
                    ? 'bg-[#4a154b] border-[#4a154b] text-white'
                    : 'bg-transparent border-[#3f4147] text-gray-400 hover:border-gray-500'
                }`}
              >
                👨‍🎓 Student
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex-1 py-3 rounded border ${
                  role === 'teacher'
                    ? 'bg-[#4a154b] border-[#4a154b] text-white'
                    : 'bg-transparent border-[#3f4147] text-gray-400 hover:border-gray-500'
                }`}
              >
                👩‍🏫 Teacher
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4a154b] text-white py-2 rounded font-medium hover:bg-[#611f69] transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#4a154b] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
