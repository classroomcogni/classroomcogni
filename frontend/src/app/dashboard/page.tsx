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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1d21]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1d21]">
      {/* Header */}
      <header className="bg-[#19171d] border-b border-[#3f4147] px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4a154b] rounded flex items-center justify-center">
            <span className="text-white font-bold">C</span>
          </div>
          <span className="text-white font-semibold">ClassroomCogni</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            {user.display_name} ({user.role})
          </span>
          <button
            onClick={signOut}
            className="text-gray-400 hover:text-white text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-white text-2xl font-bold">Your Classrooms</h1>
          {user.role === 'teacher' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#4a154b] text-white px-4 py-2 rounded hover:bg-[#611f69] transition"
            >
              + Create Classroom
            </button>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-[#4a154b] text-white px-4 py-2 rounded hover:bg-[#611f69] transition"
            >
              + Join Classroom
            </button>
          )}
        </div>

        {classrooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-400 text-lg">
              {user.role === 'teacher'
                ? "You haven't created any classrooms yet."
                : "You haven't joined any classrooms yet."}
            </p>
            <p className="text-gray-500 mt-2">
              {user.role === 'teacher'
                ? 'Create your first classroom to get started!'
                : 'Ask your teacher for a join code to get started!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {classrooms.map((classroom) => (
              <div
                key={classroom.id}
                onClick={() => router.push(`/classroom/${classroom.id}`)}
                className="bg-[#222529] rounded-lg p-6 cursor-pointer hover:bg-[#2c2d30] transition border border-transparent hover:border-[#4a154b]"
              >
                <h3 className="text-white font-semibold text-lg mb-2">
                  {classroom.name}
                </h3>
                {classroom.description && (
                  <p className="text-gray-400 text-sm mb-4">{classroom.description}</p>
                )}
                {user.role === 'teacher' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Join Code:</span>
                    <code className="bg-[#1a1d21] px-2 py-1 rounded text-[#e01e5a]">
                      {classroom.join_code}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222529] rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-white text-xl font-bold mb-4">Create Classroom</h2>
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Classroom Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b]"
                  placeholder="e.g., AP Biology Period 3"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Description (optional)</label>
                <textarea
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b] h-24 resize-none"
                  placeholder="What's this class about?"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                  }}
                  className="flex-1 border border-[#3f4147] text-gray-300 py-2 rounded hover:bg-[#2c2d30] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createClassroom}
                  className="flex-1 bg-[#4a154b] text-white py-2 rounded hover:bg-[#611f69] transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Classroom Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222529] rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-white text-xl font-bold mb-4">Join Classroom</h2>
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Join Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b] text-center text-2xl tracking-widest"
                  placeholder="ABC123"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setError('');
                  }}
                  className="flex-1 border border-[#3f4147] text-gray-300 py-2 rounded hover:bg-[#2c2d30] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={joinClassroom}
                  className="flex-1 bg-[#4a154b] text-white py-2 rounded hover:bg-[#611f69] transition"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
