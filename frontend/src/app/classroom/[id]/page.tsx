'use client';

import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, Classroom, Message, Upload, AIInsight, User } from '@/lib/supabase';
import StudyGuideContent from '@/components/StudyGuideContent';

type Channel = 'general' | 'study-guide' | 'insights';

export default function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel>('general');
  const [newMessage, setNewMessage] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Cache for user data to avoid repeated fetches
  const [userCache, setUserCache] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Memoized fetch functions
  const fetchClassroom = useCallback(async () => {
    const { data } = await supabase
      .from('classrooms')
      .select('*')
      .eq('id', classroomId)
      .single();
    setClassroom(data);
  }, [classroomId]);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, user:users(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }
    
    // Update user cache with fetched user data
    if (data) {
      const newCache: Record<string, User> = { ...userCache };
      data.forEach((msg: Message) => {
        if (msg.user) {
          newCache[msg.user_id] = msg.user;
        }
      });
      setUserCache(newCache);
      setMessages(data);
    }
  }, [classroomId, userCache]);

  const fetchUploads = useCallback(async () => {
    const { data } = await supabase
      .from('uploads')
      .select('*, user:users(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: true });
    setUploads(data || []);
  }, [classroomId]);

  const fetchInsights = useCallback(async () => {
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });
    setInsights(data || []);
  }, [classroomId]);

  // AI Service URL - can be configured via environment variable
  const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:5000';

  const generateStudyGuide = useCallback(async (force: boolean = false) => {
    setIsGeneratingGuide(true);
    setGenerateError(null);
    
    try {
      const response = await fetch(`${AI_SERVICE_URL}/generate-study-guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          force: force,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate study guide');
      }
      
      // Refresh insights to show the new study guide
      await fetchInsights();
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to AI service';
      setGenerateError(message);
      throw error;
    } finally {
      setIsGeneratingGuide(false);
    }
  }, [classroomId, fetchInsights, AI_SERVICE_URL]);

  const generateInsights = useCallback(async () => {
    setIsGeneratingInsights(true);
    setInsightsError(null);
    
    try {
      const response = await fetch(`${AI_SERVICE_URL}/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classroom_id: classroomId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate insights');
      }
      
      // Refresh insights to show the new data
      await fetchInsights();
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to AI service';
      setInsightsError(message);
      throw error;
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [classroomId, fetchInsights, AI_SERVICE_URL]);

  const fetchMembers = useCallback(async () => {
    const userIds = new Set<string>();

    // Get the classroom to find the teacher
    const { data: classroomData } = await supabase
      .from('classrooms')
      .select('teacher_id')
      .eq('id', classroomId)
      .single();

    // Add teacher
    if (classroomData?.teacher_id) {
      userIds.add(classroomData.teacher_id);
    }

    // Get memberships - note: RLS may limit visibility for students
    const { data: memberships } = await supabase
      .from('classroom_memberships')
      .select('user_id')
      .eq('classroom_id', classroomId);
    
    if (memberships) {
      memberships.forEach(m => userIds.add(m.user_id));
    }

    // Also get unique users from messages (workaround for RLS limitations)
    // This ensures we see all active participants even if membership query is limited
    const { data: messageUsers } = await supabase
      .from('messages')
      .select('user_id')
      .eq('classroom_id', classroomId);
    
    if (messageUsers) {
      messageUsers.forEach(m => userIds.add(m.user_id));
    }

    // Get unique users from uploads as well
    const { data: uploadUsers } = await supabase
      .from('uploads')
      .select('user_id')
      .eq('classroom_id', classroomId);
    
    if (uploadUsers) {
      uploadUsers.forEach(u => userIds.add(u.user_id));
    }

    if (userIds.size > 0) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .in('id', Array.from(userIds));
      
      // Update user cache with all members
      if (data) {
        const newCache: Record<string, User> = {};
        data.forEach(u => {
          newCache[u.id] = u;
        });
        setUserCache(prev => ({ ...prev, ...newCache }));
      }
      
      setMembers(data || []);
    }
  }, [classroomId]);

  // Initial data fetch
  useEffect(() => {
    if (user && classroomId) {
      fetchClassroom();
      fetchMessages();
      fetchUploads();
      fetchInsights();
      fetchMembers();
      // Add current user to cache
      setUserCache(prev => ({ ...prev, [user.id]: user }));
      // Teachers should default to insights tab
      if (user.role === 'teacher') {
        setActiveChannel('insights');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, classroomId]);

  // Real-time subscriptions (separate effect to avoid re-subscribing)
  useEffect(() => {
    if (!user || !classroomId) return;

    // Subscribe to real-time messages
    const messagesChannel = supabase
      .channel(`classroom-${classroomId}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `classroom_id=eq.${classroomId}`,
        },
        async (payload) => {
          console.log('📨 New message received:', payload.new);
          const newMessageId = payload.new.id;
          
          // First, fetch the user data for this message
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.new.user_id)
            .single();
          
          if (userData) {
            setUserCache(prev => ({ ...prev, [userData.id]: userData }));
          }
          
          // Update messages - replace temp message or add new one
          setMessages(prev => {
            // Check if this is our own message (we have a temp version)
            const tempIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.user_id === payload.new.user_id &&
              m.content === payload.new.content
            );
            
            if (tempIndex !== -1) {
              // Replace temp message with real one
              const updated = [...prev];
              updated[tempIndex] = { ...payload.new, user: userData } as Message;
              return updated;
            }
            
            // Check if message already exists (avoid duplicates)
            const exists = prev.some(m => m.id === newMessageId);
            if (exists) {
              return prev;
            }
            
            // Add new message from another user
            return [...prev, { ...payload.new, user: userData } as Message];
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Messages realtime status:', status);
      });

    // Subscribe to uploads
    const uploadsChannel = supabase
      .channel(`classroom-${classroomId}-uploads`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'uploads',
          filter: `classroom_id=eq.${classroomId}`,
        },
        async (payload) => {
          console.log('📎 New upload received:', payload.new);
          // Check if already exists
          setUploads(prev => {
            if (prev.some(u => u.id === payload.new.id)) {
              return prev;
            }
            // Fetch the upload with user data
            supabase
              .from('uploads')
              .select('*, user:users(*)')
              .eq('id', payload.new.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setUploads(p => {
                    if (p.some(u => u.id === data.id)) return p;
                    return [...p, data];
                  });
                }
              });
            return prev;
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Uploads realtime status:', status);
      });

    // Subscribe to membership changes to update members list
    const membersChannel = supabase
      .channel(`classroom-${classroomId}-members`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classroom_memberships',
          filter: `classroom_id=eq.${classroomId}`,
        },
        () => {
          console.log('👥 Membership changed, refreshing members');
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(uploadsChannel);
      supabase.removeChannel(membersChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, classroomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    const messageChannel = activeChannel === 'general' ? 'general' : 'study-guide';
    const tempId = `temp-${Date.now()}`;
    
    // Clear input immediately for better UX
    setNewMessage('');

    // Optimistic update - add message immediately with current user data
    const optimisticMessage: Message = {
      id: tempId,
      classroom_id: classroomId,
      user_id: user.id,
      content: messageContent,
      channel: messageChannel,
      created_at: new Date().toISOString(),
      user: user, // Include full user object
    };
    
    setMessages(prev => [...prev, optimisticMessage]);

    // Actually send to database (realtime will handle the update)
    const { error } = await supabase.from('messages').insert({
      classroom_id: classroomId,
      user_id: user.id,
      content: messageContent,
      channel: messageChannel,
    });

    if (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent); // Restore the message
    }
    // Note: We don't need to update here - realtime subscription will replace the temp message
  };

  const submitUpload = async () => {
    if (!user || !uploadTitle.trim() || !uploadContent.trim()) return;

    await supabase.from('uploads').insert({
      classroom_id: classroomId,
      user_id: user.id,
      title: uploadTitle,
      content: uploadContent,
      file_type: 'text',
    });

    setShowUploadModal(false);
    setUploadTitle('');
    setUploadContent('');
    fetchUploads();
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading || !user || !classroom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1d21]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const filteredMessages = messages.filter(
    (m) => m.channel === (activeChannel === 'general' ? 'general' : 'study-guide')
  );

  // Get only the most recent study guide (there should only be one, but filter to be safe)
  const studyGuide = insights.filter((i) => i.insight_type === 'study_guide')[0] || null;
  const confusionSummaries = insights.filter((i) => i.insight_type === 'confusion_summary');

  return (
    <div className="h-screen flex bg-[#1a1d21]">
      {/* Sidebar */}
      <div className="w-64 bg-[#19171d] flex flex-col border-r border-[#3f4147]">
        {/* Workspace Header */}
        <div className="p-4 border-b border-[#3f4147]">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
          <h2 className="text-white font-bold truncate">{classroom.name}</h2>
          {user.role === 'teacher' && (
            <div className="text-xs text-gray-500 mt-1">
              Code: <span className="text-[#e01e5a]">{classroom.join_code}</span>
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-gray-400 text-xs font-semibold px-2 py-2">Channels</div>
          {/* Students see chat channels, teachers only see insights */}
          {user.role !== 'teacher' && (
            <>
              <button
                onClick={() => setActiveChannel('general')}
                className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 ${
                  activeChannel === 'general'
                    ? 'bg-[#1164a3] text-white'
                    : 'text-gray-400 hover:bg-[#222529]'
                }`}
              >
                <span className="text-lg">#</span> general
              </button>
              <button
                onClick={() => setActiveChannel('study-guide')}
                className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 ${
                  activeChannel === 'study-guide'
                    ? 'bg-[#1164a3] text-white'
                    : 'text-gray-400 hover:bg-[#222529]'
                }`}
              >
                <span className="text-lg">#</span> study-guide
              </button>
            </>
          )}
          {user.role === 'teacher' && (
            <button
              onClick={() => setActiveChannel('insights')}
              className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 ${
                activeChannel === 'insights'
                  ? 'bg-[#1164a3] text-white'
                  : 'text-gray-400 hover:bg-[#222529]'
              }`}
            >
              <span className="text-lg">📊</span> insights
            </button>
          )}

          {/* Members */}
          <div className="text-gray-400 text-xs font-semibold px-2 py-2 mt-4">
            Members ({members.length})
          </div>
          <div className="space-y-1">
            {/* Teachers first, then students - deduplicate by id */}
            {Array.from(new Map(members.map(m => [m.id, m])).values())
              .sort((a, b) => {
                // Teachers first
                if (a.role === 'teacher' && b.role !== 'teacher') return -1;
                if (a.role !== 'teacher' && b.role === 'teacher') return 1;
                return a.display_name.localeCompare(b.display_name);
              })
              .map((member) => (
                <div
                  key={member.id}
                  className="px-2 py-1 text-gray-400 text-sm flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${member.role === 'teacher' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                  <span className="truncate">
                    {member.display_name}
                    {member.id === user?.id && ' (you)'}
                    {member.role === 'teacher' && ' 👨‍🏫'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="h-14 border-b border-[#3f4147] flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">
              {activeChannel === 'insights' ? '📊 insights' : `# ${activeChannel}`}
            </span>
          </div>
          {activeChannel !== 'insights' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-[#4a154b] text-white px-3 py-1 rounded text-sm hover:bg-[#611f69] transition"
            >
              📎 Upload Notes
            </button>
          )}
        </div>

        {/* Messages / Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeChannel === 'insights' ? (
            // Teacher Insights View
            // PRIVACY NOTE: This view shows ONLY aggregated, anonymized insights
            // Teachers NEVER see individual student messages here
            <div className="space-y-6">
              <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                      🔒 Privacy Notice
                    </h3>
                    <p className="text-gray-400 text-sm">
                      This dashboard shows <strong>aggregated insights only</strong>. 
                      Individual student messages and identities are never displayed. 
                      AI analyzes patterns to help you understand class-wide learning needs.
                    </p>
                  </div>
                  <button
                    onClick={() => generateInsights()}
                    disabled={isGeneratingInsights}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                      isGeneratingInsights
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-[#2eb67d] hover:bg-[#27a06d] text-white'
                    }`}
                  >
                    {isGeneratingInsights ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        Generate Insights
                      </>
                    )}
                  </button>
                </div>
                {insightsError && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
                    <strong>Error:</strong> {insightsError}
                    <p className="text-xs mt-1 text-red-400">
                      Make sure the AI service is running: <code className="bg-red-900/50 px-1 rounded">python ai_service.py --server</code>
                    </p>
                  </div>
                )}
              </div>

              {/* Confusion Topics - Show only the latest */}
              <div>
                <h3 className="text-white font-semibold mb-3">Common Confusion Topics</h3>
                {confusionSummaries.length > 0 ? (
                  <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                    <div className="text-gray-400 text-xs mb-3">
                      Last updated: {formatDate(confusionSummaries[0].created_at)}
                    </div>
                    <StudyGuideContent content={confusionSummaries[0].content || ''} />
                  </div>
                ) : (
                  <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                    <p className="text-gray-500">
                      No confusion analysis yet. Click &quot;Generate Insights&quot; to analyze student discussions.
                    </p>
                  </div>
                )}
              </div>

              {/* Study Guide Overview - Show only the latest */}
              <div>
                <h3 className="text-white font-semibold mb-3">Study Guide Preview</h3>
                {studyGuide ? (
                  <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[#e01e5a] font-medium">
                        {studyGuide.unit_name || 'Complete Study Guide'}
                      </span>
                      <span className="text-gray-500 text-xs">
                        Last updated: {formatDate(studyGuide.created_at)}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <StudyGuideContent content={studyGuide.content || ''} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                    <p className="text-gray-500">
                      No study guide generated yet. Students can generate one from the study-guide channel.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : activeChannel === 'study-guide' ? (
            // Study Guide Channel - Shows AI-generated guides
            <div className="space-y-4">
              <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-semibold mb-2">📚 AI-Generated Study Guide</h3>
                    <p className="text-gray-400 text-sm">
                      This cumulative study guide is generated from all uploaded class notes,
                      organized by topic/unit to help you study effectively.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => generateStudyGuide(false)}
                      disabled={isGeneratingGuide || uploads.length === 0}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                        isGeneratingGuide || uploads.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-[#2eb67d] hover:bg-[#27a06d] text-white'
                      }`}
                    >
                      {isGeneratingGuide ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>🤖</span>
                          {studyGuide ? 'Update Guide' : 'Generate Guide'}
                        </>
                      )}
                    </button>
                    {studyGuide && (
                      <button
                        onClick={() => generateStudyGuide(true)}
                        disabled={isGeneratingGuide}
                        className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#3f4147] transition-colors"
                        title="Force regenerate the entire study guide"
                      >
                        🔄 Force Regenerate
                      </button>
                    )}
                  </div>
                </div>
                {generateError && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
                    <strong>Error:</strong> {generateError}
                    <p className="text-xs mt-1 text-red-400">
                      Make sure the AI service is running: <code className="bg-red-900/50 px-1 rounded">python ai_service.py --server</code>
                    </p>
                  </div>
                )}
                {uploads.length === 0 && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-sm">
                    📝 Upload some notes first before generating a study guide.
                  </div>
                )}
              </div>

              {studyGuide ? (
                <div className="bg-[#222529] rounded-lg p-5 border border-[#3f4147]">
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-[#3f4147]">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📖</span>
                      <h4 className="text-[#e01e5a] font-semibold text-lg">
                        {studyGuide.unit_name || 'Complete Study Guide'}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 text-xs bg-[#1a1d21] px-2 py-1 rounded block">
                        Last updated: {formatDate(studyGuide.created_at)}
                      </span>
                      {studyGuide.metadata?.upload_count != null && (
                        <span className="text-gray-600 text-xs mt-1 block">
                          {String(studyGuide.metadata.upload_count)} notes • {String(studyGuide.metadata.unit_count || 1)} units
                        </span>
                      )}
                    </div>
                  </div>
                  <StudyGuideContent content={studyGuide.content || ''} />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-gray-400">
                    No study guide yet. Upload notes and click &quot;Generate Guide&quot; to create one!
                  </p>
                </div>
              )}

              {/* Chat in study-guide channel */}
              <div className="border-t border-[#3f4147] pt-4 mt-4">
                <h4 className="text-gray-400 text-sm mb-3">Discussion</h4>
                {filteredMessages.map((message, index) => {
                  const isOwnMessage = message.user_id === user?.id;
                  const displayName = message.user?.display_name || user?.display_name || 'Unknown';
                  
                  return (
                    <div 
                      key={`study-msg-${message.id}-${index}`} 
                      className={`flex gap-3 mb-4 p-2 rounded ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${isOwnMessage ? 'bg-[#2eb67d]' : 'bg-[#4a154b]'}`}>
                        <span className="text-white text-sm">
                          {displayName[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
                        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : ''}`}>
                          <span className="text-white font-semibold">
                            {isOwnMessage ? 'You' : displayName}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <div className={`inline-block rounded-lg px-3 py-2 mt-1 ${isOwnMessage ? 'bg-[#2eb67d] text-white' : 'bg-[#222529] text-gray-300'}`}>
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // General Channel - Chat + Uploads
            <div>
              {/* Combined feed of messages and uploads */}
              {[...filteredMessages, ...uploads]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((item, index) => {
                  if ('content' in item && !('title' in item)) {
                    // It's a message
                    const message = item as Message;
                    const isOwnMessage = message.user_id === user?.id;
                    const displayName = message.user?.display_name || (isOwnMessage ? user?.display_name : 'Unknown') || 'Unknown';
                    
                    return (
                      <div
                        key={`msg-${message.id}-${index}`}
                        className={`flex gap-3 mb-4 p-2 rounded ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${isOwnMessage ? 'bg-[#2eb67d]' : 'bg-[#4a154b]'}`}>
                          <span className="text-white text-sm">
                            {displayName[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className={`max-w-[70%] ${isOwnMessage ? 'text-right' : ''}`}>
                          <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'justify-end' : ''}`}>
                            <span className="text-white font-semibold">
                              {isOwnMessage ? 'You' : displayName}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                          <div className={`inline-block rounded-lg px-3 py-2 mt-1 ${isOwnMessage ? 'bg-[#2eb67d] text-white' : 'bg-[#222529] text-gray-300'}`}>
                            {message.content}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // It's an upload
                    const upload = item as Upload;
                    const isOwnUpload = upload.user_id === user?.id;
                    const displayName = upload.user?.display_name || (isOwnUpload ? user?.display_name : 'Unknown') || 'Unknown';
                    
                    return (
                      <div
                        key={`upload-${upload.id}-${index}`}
                        className={`flex gap-3 mb-4 p-2 rounded ${isOwnUpload ? 'flex-row-reverse' : ''}`}
                      >
                        <div className="w-9 h-9 bg-[#e01e5a] rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">📄</span>
                        </div>
                        <div className={`max-w-[70%] ${isOwnUpload ? 'text-right' : ''}`}>
                          <div className={`flex items-baseline gap-2 ${isOwnUpload ? 'justify-end' : ''}`}>
                            <span className="text-white font-semibold">
                              {isOwnUpload ? 'You' : displayName}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatTime(upload.created_at)}
                            </span>
                          </div>
                          <div className="bg-[#222529] border border-[#3f4147] rounded-lg p-3 mt-1 text-left">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">📝</span>
                              <span className="text-white font-medium">{upload.title}</span>
                            </div>
                            <p className="text-gray-400 text-sm line-clamp-3">{upload.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        {activeChannel !== 'insights' && (
          <div className="p-4 border-t border-[#3f4147]">
            <div className="bg-[#222529] rounded-lg border border-[#3f4147] flex">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={`Message #${activeChannel}`}
                className="flex-1 bg-transparent px-4 py-3 text-white focus:outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-4 text-[#4a154b] hover:text-[#611f69] disabled:text-gray-600"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222529] rounded-lg p-6 w-full max-w-lg mx-4">
            <h2 className="text-white text-xl font-bold mb-4">Upload Notes</h2>
            <p className="text-gray-400 text-sm mb-4">
              Share your notes with the class. The AI will use these to generate study guides.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b]"
                  placeholder="e.g., Chapter 5 Notes - Cell Division"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Content</label>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  className="w-full bg-[#1a1d21] border border-[#3f4147] rounded px-4 py-2 text-white focus:outline-none focus:border-[#4a154b] h-48 resize-none"
                  placeholder="Paste your notes here..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 border border-[#3f4147] text-gray-300 py-2 rounded hover:bg-[#2c2d30] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submitUpload}
                  disabled={!uploadTitle.trim() || !uploadContent.trim()}
                  className="flex-1 bg-[#4a154b] text-white py-2 rounded hover:bg-[#611f69] transition disabled:opacity-50"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
