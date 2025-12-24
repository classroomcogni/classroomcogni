'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1d21]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1d21] to-[#2c2d30] flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#4a154b] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-white text-xl font-semibold">ClassroomCogni</span>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/login" 
            className="text-white hover:text-gray-300 px-4 py-2"
          >
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="bg-[#4a154b] text-white px-4 py-2 rounded-md hover:bg-[#611f69] transition"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          Privacy-First<br />
          <span className="text-[#e01e5a]">Classroom Collaboration</span>
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mb-8">
          A Slack-inspired platform where students collaborate naturally while AI 
          organizes learning materials — without invasive monitoring.
        </p>
        
        <div className="flex gap-4 mb-12">
          <Link 
            href="/signup" 
            className="bg-[#4a154b] text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-[#611f69] transition"
          >
            Start Learning Together
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mt-8">
          <div className="bg-[#222529] p-6 rounded-lg">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-2">Natural Chat</h3>
            <p className="text-gray-400 text-sm">
              Students chat and share notes just like in Slack. No awkward interfaces.
            </p>
          </div>
          <div className="bg-[#222529] p-6 rounded-lg">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-white font-semibold mb-2">Invisible AI</h3>
            <p className="text-gray-400 text-sm">
              AI works in the background to organize content and generate study guides.
            </p>
          </div>
          <div className="bg-[#222529] p-6 rounded-lg">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-white font-semibold mb-2">Privacy First</h3>
            <p className="text-gray-400 text-sm">
              Teachers see aggregate insights only. No individual student surveillance.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-500 text-sm">
        Built for the AI in Education Competition • Ethical AI Use
      </footer>
    </div>
  );
}
