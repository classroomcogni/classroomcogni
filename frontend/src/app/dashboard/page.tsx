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

  // Generate a color for classroom cards based on index
  const getCardColor = (index: number) => {
    const colors = [
      'bg-[#1a73e8]', // Blue
      'bg-[#1e8e3e]', // Green
      'bg-[#e37400]', // Orange
      'bg-[#a142f4]', // Purple
      'bg-[#d93025]', // Red
      'bg-[#129eaf]', // Teal
    ];
    return colors[index % colors.length];
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#5f6368] text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white border-b border-[#dadce0] px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1a73e8] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-[#202124] font-medium text-xl">Classly</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a73e8] rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">{user.display_name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="text-right">
              <div className="text-[#202124] text-sm font-medium">{user.display_name}</div>
              <div className="text-[#5f6368] text-xs capitalize">{user.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-[#5f6368] hover:text-[#202124] text-sm font-medium hover:bg-[#f1f3f4] px-3 py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-[#202124] text-2xl font-medium">Your Classes</h1>
          {user.role === 'teacher' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Class
            </button>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Join Class
            </button>
          )}
        </div>

        {classrooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-[#e8f0fe] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-[#1a73e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-[#202124] text-xl font-medium mb-2">
              {user.role === 'teacher'
                ? "You haven't created any classes yet"
                : "You haven't joined any classes yet"}
            </h2>
            <p className="text-[#5f6368] mb-6">
              {user.role === 'teacher'
                ? 'Create your first class to get started!'
                : 'Ask your teacher for a class code to get started!'}
            </p>
            <button
              onClick={() => user.role === 'teacher' ? setShowCreateModal(true) : setShowJoinModal(true)}
              className="btn-primary"
            >
              {user.role === 'teacher' ? 'Create your first class' : 'Join a class'}
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((classroom, index) => (
              <div
                key={classroom.id}
                onClick={() => router.push(`/classroom/${classroom.id}`)}
                className="card cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Colored header */}
                <div className={`${getCardColor(index)} h-24 p-4 flex items-end`}>
                  <h3 className="text-white font-medium text-lg line-clamp-2">
                    {classroom.name}
                  </h3>
                </div>
                {/* Content */}
                <div className="p-4">
                  {classroom.description && (
                    <p className="text-[#5f6368] text-sm mb-4 line-clamp-2">{classroom.description}</p>
                  )}
                  {user.role === 'teacher' && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#5f6368]">Class code:</span>
                      <code className="bg-[#f1f3f4] px-2 py-1 rounded text-[#1a73e8] font-medium">
                        {classroom.join_code}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-[#dadce0]">
              <h2 className="text-[#202124] text-xl font-medium">Create class</h2>
            </div>
            <div className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-[#5f6368] text-sm font-medium mb-2">Class name (required)</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g., AP Biology Period 3"
                  />
                </div>
                <div>
                  <label className="block text-[#5f6368] text-sm font-medium mb-2">Description (optional)</label>
                  <textarea
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    className="input w-full h-24 resize-none"
                    placeholder="What's this class about?"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 bg-[#f8f9fa] border-t border-[#dadce0]">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={createClassroom}
                disabled={!newClassName.trim()}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Classroom Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-[#dadce0]">
              <h2 className="text-[#202124] text-xl font-medium">Join class</h2>
            </div>
            <div className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-[#5f6368] text-sm font-medium mb-2">Class code</label>
                  <p className="text-[#5f6368] text-sm mb-3">Ask your teacher for the class code, then enter it here.</p>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="input w-full text-center text-2xl tracking-widest font-mono"
                    placeholder="ABC123"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 bg-[#f8f9fa] border-t border-[#dadce0]">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setError('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={joinClassroom}
                disabled={!joinCode.trim()}
                className="btn-primary"
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
