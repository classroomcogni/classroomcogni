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
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#64748b] text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-[#e2e0dc] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="Classly logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[#1e293b] text-xl font-semibold tracking-tight">Classly</span>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/login" 
            className="text-[#64748b] px-5 py-2.5 rounded-xl font-medium hover-surface"
          >
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white px-5 py-2.5 rounded-xl font-medium hover-card"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-[#eff6ff] text-[#6366f1] px-4 py-2 rounded-full text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-[#6366f1] rounded-full animate-pulse"></span>
            Privacy-first by design
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-[#1e293b] mb-6 tracking-tight leading-tight">
            Where Learning<br />
            <span className="bg-gradient-to-r from-[#6366f1] to-[#f472b6] bg-clip-text text-transparent">Feels Natural</span>
          </h1>
          <p className="text-[#64748b] text-xl max-w-2xl mb-10 leading-relaxed">
            A warm, collaborative space where students share ideas freely 
            while AI quietly organizes everything — no surveillance, just support.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/signup" 
              className="bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white px-8 py-4 rounded-2xl text-lg font-semibold hover-card"
            >
              Start Learning Together
            </Link>
            <Link
              href="/login"
              className="bg-white text-[#1e293b] px-8 py-4 rounded-2xl text-lg font-semibold border-2 border-[#e2e0dc] hover-outline"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mt-4 w-full">
          <div className="bg-white p-8 rounded-3xl shadow-md hover-card">
            <div className="w-14 h-14 bg-gradient-to-br from-[#fef3c7] to-[#fde68a] rounded-2xl flex items-center justify-center mb-5 hover-scale">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-[#1e293b] font-semibold text-lg mb-3">Natural Chat</h3>
            <p className="text-[#64748b] leading-relaxed">
              Students chat and share notes naturally. No awkward interfaces — just conversation.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-md hover-card">
            <div className="w-14 h-14 bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] rounded-2xl flex items-center justify-center mb-5 hover-scale">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-[#1e293b] font-semibold text-lg mb-3">Invisible AI</h3>
            <p className="text-[#64748b] leading-relaxed">
              AI works quietly in the background to organize content and generate helpful study guides.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-md hover-card">
            <div className="w-14 h-14 bg-gradient-to-br from-[#fce7f3] to-[#fbcfe8] rounded-2xl flex items-center justify-center mb-5 hover-scale">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-[#1e293b] font-semibold text-lg mb-3">Privacy First</h3>
            <p className="text-[#64748b] leading-relaxed">
              Teachers see aggregate insights only. No individual student surveillance — ever.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-[#94a3b8] text-sm border-t border-[#e2e0dc] bg-white/50">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-[#22c55e] rounded-full"></span>
          Built for the AI in Education Competition • Ethical AI Use
        </div>
      </footer>
    </div>
  );
}
