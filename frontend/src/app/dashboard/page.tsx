'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, Classroom } from '@/lib/supabase';

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchClassrooms();
    }
  }, [user]);

  const fetchClassrooms = async () => {
    if (!user) return;

    console.log('📚 Fetching classrooms for user:', user.id, 'role:', user.role);

    if (user.role === 'teacher') {
      // Teachers see classrooms they created
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('teacher_id', user.id);
      console.log('📚 Teacher classrooms result:', { data, error });
      setClassrooms(data || []);
    } else {
      // Students see classrooms they joined
      const { data: memberships, error: membershipError } = await supabase
        .from('classroom_memberships')
        .select('classroom_id')
        .eq('user_id', user.id);

      console.log('📚 Student memberships result:', { memberships, membershipError });

      if (memberships && memberships.length > 0) {
        const classroomIds = memberships.map(m => m.classroom_id);
        const { data, error } = await supabase
          .from('classrooms')
          .select('*')
          .in('id', classroomIds);
        console.log('📚 Student classrooms result:', { data, error });
        setClassrooms(data || []);
      }
    }
  };

  const generateJoinCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const createClassroom = async () => {
    if (!user || !newClassName.trim()) return;
    setError('');

    const joinCode = generateJoinCode();
    console.log('🏫 Creating classroom:', { name: newClassName, joinCode, teacherId: user.id, userRole: user.role });
    
    // First verify the user profile exists in the database
    const { data: profileCheck, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('👤 Profile check before create:', { profileCheck, profileError });
    
    if (!profileCheck) {
      console.error('❌ User profile not found in database!');
      setError('User profile not found. Please sign out and sign in again.');
      return;
    }
    
    const { data, error } = await supabase.from('classrooms').insert({
      name: newClassName,
      description: newClassDesc,
      join_code: joinCode,
      teacher_id: user.id,
    }).select();

    console.log('🏫 Create classroom result:', { data, error });
    
    if (error) {
      console.error('❌ Create classroom error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error hint:', error.hint);
      setError(error.message || 'Failed to create classroom. Check console for details.');
    } else if (!data || data.length === 0) {
      console.error('❌ No data returned - likely RLS policy blocking insert');
      setError('Permission denied. Make sure you are signed in as a teacher.');
    } else {
      console.log('✅ Classroom created successfully:', data);
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassDesc('');
      fetchClassrooms();
    }
  };

  const joinClassroom = async () => {
    if (!user || !joinCode.trim()) return;
    setError('');

    // Find classroom by join code
    const { data: classroom, error: findError } = await supabase
      .from('classrooms')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .single();

    if (findError || !classroom) {
      setError('Invalid join code');
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('classroom_memberships')
      .select('*')
      .eq('classroom_id', classroom.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      setError('You are already a member of this classroom');
      return;
    }

    // Join the classroom
    const { error: joinError } = await supabase.from('classroom_memberships').insert({
      classroom_id: classroom.id,
      user_id: user.id,
    });

    if (joinError) {
      setError(joinError.message);
    } else {
      setShowJoinModal(false);
      setJoinCode('');
      fetchClassrooms();
    }
  };

  // Generate a color for classroom cards based on index - warm, cozy palette
  const getCardColor = (index: number) => {
    const colors = [
      'from-[#22c55e] to-[#4ade80]', // Green
      'from-[#f59e0b] to-[#fbbf24]', // Amber
      'from-[#a855f7] to-[#c084fc]', // Purple
      'from-[#ef4444] to-[#f87171]', // Red
      'from-[#14b8a6] to-[#2dd4bf]', // Teal
    ];
    return colors[index % colors.length];
  };

  if (loading || !user) {
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
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[#e2e0dc] px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="Classly logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[#1e293b] font-semibold text-xl tracking-tight">Classly</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-[#f5f3f0] rounded-2xl px-4 py-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-semibold text-sm">{user.display_name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="text-left">
              <div className="text-[#1e293b] text-sm font-medium">{user.display_name}</div>
              <div className="text-[#64748b] text-xs capitalize">{user.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-[#64748b] text-sm font-medium px-4 py-2.5 rounded-xl hover-surface"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-10 px-6">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-[#1e293b] text-3xl font-semibold tracking-tight">Your Classes</h1>
            <p className="text-[#64748b] mt-1">
              {user.role === 'teacher' ? 'Manage and create your classrooms' : 'Your enrolled classrooms'}
            </p>
          </div>
          {user.role === 'teacher' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2 rounded-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Class
            </button>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-primary flex items-center gap-2 rounded-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Join Class
            </button>
          )}
        </div>

        {classrooms.length === 0 ? (
          <div className="text-center py-20 animate-fade-in-up">
            <div className="w-24 h-24 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
              <svg className="w-12 h-12 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-[#1e293b] text-2xl font-semibold mb-3">
              {user.role === 'teacher'
                ? "You haven't created any classes yet"
                : "You haven't joined any classes yet"}
            </h2>
            <p className="text-[#64748b] mb-8 max-w-md mx-auto">
              {user.role === 'teacher'
                ? 'Create your first class to start building your learning community.'
                : 'Ask your teacher for a class code to get started!'}
            </p>
            <button
              onClick={() => user.role === 'teacher' ? setShowCreateModal(true) : setShowJoinModal(true)}
              className="btn-primary rounded-xl px-8 py-3"
            >
              {user.role === 'teacher' ? 'Create your first class' : 'Join a class'}
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((classroom, index) => (
              <div
                key={classroom.id}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`classroom_color_index_${classroom.id}`, String(index));
                  }
                  router.push(`/classroom/${classroom.id}`);
                }}
                className="bg-white rounded-3xl cursor-pointer overflow-hidden group hover-card"
              >
                {/* Colored header with gradient */}
                <div className={`bg-gradient-to-br ${getCardColor(index)} h-28 p-5 flex items-end`}>
                  <h3 className="text-white font-semibold text-lg line-clamp-2 drop-shadow-sm">
                    {classroom.name}
                  </h3>
                </div>
                {/* Content */}
                <div className="p-5">
                  {classroom.description && (
                    <p className="text-[#64748b] text-sm mb-4 line-clamp-2 leading-relaxed">{classroom.description}</p>
                  )}
                  {user.role === 'teacher' && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#64748b]">Class code:</span>
                      <code className="bg-[#f5f3f0] px-3 py-1.5 rounded-lg text-[#6366f1] font-semibold tracking-wider">
                        {classroom.join_code}
                      </code>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4 text-[#64748b] text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="group-hover:text-[#6366f1] transition-colors">Enter classroom</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-[#e2e0dc]">
              <h2 className="text-[#1e293b] text-xl font-semibold">Create a new class</h2>
              <p className="text-[#64748b] text-sm mt-1">Set up your classroom space</p>
            </div>
            <div className="p-6">
              {error && (
                <div className="bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] px-4 py-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className="block text-[#1e293b] text-sm font-medium mb-2">Class name</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g., AP Biology Period 3"
                  />
                </div>
                <div>
                  <label className="block text-[#1e293b] text-sm font-medium mb-2">Description <span className="text-[#94a3b8] font-normal">(optional)</span></label>
                  <textarea
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    className="input w-full h-28 resize-none"
                    placeholder="What's this class about?"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-[#faf8f5] border-t border-[#e2e0dc]">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                }}
                className="btn-secondary flex-1 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={createClassroom}
                disabled={!newClassName.trim()}
                className="btn-primary flex-1 rounded-xl"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Classroom Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-[#e2e0dc]">
              <h2 className="text-[#1e293b] text-xl font-semibold">Join a class</h2>
              <p className="text-[#64748b] text-sm mt-1">Enter the code from your teacher</p>
            </div>
            <div className="p-6">
              {error && (
                <div className="bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] px-4 py-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-[#1e293b] text-sm font-medium mb-2">Class code</label>
                  <p className="text-[#64748b] text-sm mb-4">Ask your teacher for the 6-character class code.</p>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="input w-full text-center text-2xl tracking-[0.3em] font-mono py-4"
                    placeholder="ABC123"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-[#faf8f5] border-t border-[#e2e0dc]">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setError('');
                }}
                className="btn-secondary flex-1 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={joinClassroom}
                disabled={!joinCode.trim()}
                className="btn-primary flex-1 rounded-xl"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
