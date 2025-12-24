'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, Classroom, Message, Upload, AIInsight, User } from '@/lib/supabase';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && classroomId) {
      fetchClassroom();
      fetchMessages();
      fetchUploads();
      fetchInsights();
      fetchMembers();

      // Subscribe to real-time messages
      const channel = supabase
        .channel(`classroom-${classroomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `classroom_id=eq.${classroomId}`,
          },
          async (payload) => {
            // Fetch the user info for the new message
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('id', payload.new.user_id)
              .single();
            
            const newMsg = { ...payload.new, user: userData } as Message;
            setMessages((prev) => [...prev, newMsg]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, classroomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchClassroom = async () => {
    const { data } = await supabase
      .from('classrooms')
      .select('*')
      .eq('id', classroomId)
      .single();
    setClassroom(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, user:users(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const fetchUploads = async () => {
    const { data } = await supabase
      .from('uploads')
      .select('*, user:users(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: true });
    setUploads(data || []);
  };

  const fetchInsights = async () => {
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });
    setInsights(data || []);
  };

  const fetchMembers = async () => {
    const { data: memberships } = await supabase
      .from('classroom_memberships')
      .select('user_id')
      .eq('classroom_id', classroomId);

    if (memberships && memberships.length > 0) {
      const userIds = memberships.map(m => m.user_id);
      const { data } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);
      setMembers(data || []);
    }
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    await supabase.from('messages').insert({
      classroom_id: classroomId,
      user_id: user.id,
      content: newMessage,
      channel: activeChannel === 'general' ? 'general' : 'study-guide',
    });

    setNewMessage('');
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

  const studyGuides = insights.filter((i) => i.insight_type === 'study_guide');
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
            Members ({members.length + 1})
          </div>
          <div className="space-y-1">
            {/* Teacher */}
            <div className="px-2 py-1 text-gray-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {user.role === 'teacher' ? user.display_name + ' (you)' : 'Teacher'}
            </div>
            {/* Students */}
            {members.map((member) => (
              <div
                key={member.id}
                className="px-2 py-1 text-gray-400 text-sm flex items-center gap-2"
              >
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {member.display_name}
                {member.id === user.id && ' (you)'}
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
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  🔒 Privacy Notice
                </h3>
                <p className="text-gray-400 text-sm">
                  This dashboard shows <strong>aggregated insights only</strong>. 
                  Individual student messages and identities are never displayed. 
                  AI analyzes patterns to help you understand class-wide learning needs.
                </p>
              </div>

              {/* Confusion Topics */}
              <div>
                <h3 className="text-white font-semibold mb-3">Common Confusion Topics</h3>
                {confusionSummaries.length > 0 ? (
                  <div className="space-y-3">
                    {confusionSummaries.map((insight) => (
                      <div
                        key={insight.id}
                        className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]"
                      >
                        <div className="text-gray-400 text-xs mb-2">
                          Generated {formatDate(insight.created_at)}
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap">{insight.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No confusion analysis yet. Run the AI service to generate insights.
                  </p>
                )}
              </div>

              {/* Study Guide Overview */}
              <div>
                <h3 className="text-white font-semibold mb-3">Generated Study Guides</h3>
                {studyGuides.length > 0 ? (
                  <div className="space-y-3">
                    {studyGuides.map((guide) => (
                      <div
                        key={guide.id}
                        className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[#e01e5a] font-medium">
                            {guide.unit_name || 'General Study Guide'}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(guide.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap line-clamp-4">
                          {guide.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No study guides generated yet. Run the AI service after students upload notes.
                  </p>
                )}
              </div>
            </div>
          ) : activeChannel === 'study-guide' ? (
            // Study Guide Channel - Shows AI-generated guides
            <div className="space-y-4">
              <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
                <h3 className="text-white font-semibold mb-2">📚 AI-Generated Study Guides</h3>
                <p className="text-gray-400 text-sm">
                  These study guides are automatically generated from uploaded class notes.
                  The AI organizes content into logical units to help you study effectively.
                </p>
              </div>

              {studyGuides.length > 0 ? (
                studyGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-[#e01e5a] font-semibold text-lg">
                        {guide.unit_name || 'Study Guide'}
                      </h4>
                      <span className="text-gray-500 text-xs">
                        {formatDate(guide.created_at)}
                      </span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-wrap">{guide.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-gray-400">
                    No study guides yet. Upload notes and the AI will generate guides automatically!
                  </p>
                </div>
              )}

              {/* Chat in study-guide channel */}
              <div className="border-t border-[#3f4147] pt-4 mt-4">
                <h4 className="text-gray-400 text-sm mb-3">Discussion</h4>
                {filteredMessages.map((message) => (
                  <div key={message.id} className="flex gap-3 mb-4 hover:bg-[#222529] p-2 rounded">
                    <div className="w-9 h-9 bg-[#4a154b] rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">
                        {message.user?.display_name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white font-semibold">
                          {message.user?.display_name || 'Unknown'}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-300">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // General Channel - Chat + Uploads
            <div>
              {/* Combined feed of messages and uploads */}
              {[...filteredMessages, ...uploads]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((item) => {
                  if ('content' in item && !('title' in item)) {
                    // It's a message
                    const message = item as Message;
                    return (
                      <div
                        key={`msg-${message.id}`}
                        className="flex gap-3 mb-4 hover:bg-[#222529] p-2 rounded"
                      >
                        <div className="w-9 h-9 bg-[#4a154b] rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">
                            {message.user?.display_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-white font-semibold">
                              {message.user?.display_name || 'Unknown'}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-300">{message.content}</p>
                        </div>
                      </div>
                    );
                  } else {
                    // It's an upload
                    const upload = item as Upload;
                    return (
                      <div
                        key={`upload-${upload.id}`}
                        className="flex gap-3 mb-4 hover:bg-[#222529] p-2 rounded"
                      >
                        <div className="w-9 h-9 bg-[#2eb67d] rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">📄</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-white font-semibold">
                              {upload.user?.display_name || 'Unknown'}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {formatTime(upload.created_at)}
                            </span>
                          </div>
                          <div className="bg-[#222529] border border-[#3f4147] rounded-lg p-3 mt-1">
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
