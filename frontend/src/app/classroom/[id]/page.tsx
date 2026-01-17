'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase, Classroom, Message, Upload, AIInsight, User, Announcement } from '@/lib/supabase';
import StudyGuideContent from '@/components/StudyGuideContent';
import InsightsDashboard from '@/components/InsightsDashboard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

type Channel = 'general' | 'study-guide' | 'announcements' | 'insights';

export default function ClassroomPage() {
  const params = useParams();
  const classroomId = params.id as string;
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
  const [uploadMode, setUploadMode] = useState<'text' | 'file' | 'camera'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Cache for user data to avoid repeated fetches
  const [userCache, setUserCache] = useState<Record<string, User>>({});
  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');
  const [announcementNotification, setAnnouncementNotification] = useState<Announcement | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [lastSeenAnnouncementsAt, setLastSeenAnnouncementsAt] = useState<string | null>(null);
  const [highlightAnnouncementId, setHighlightAnnouncementId] = useState<string | null>(null);
  const highlightAnnouncementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const announcementsTopRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [editedGuideContent, setEditedGuideContent] = useState('');
  const [isSavingGuide, setIsSavingGuide] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Persist last seen announcements per classroom/user for unread badge
  useEffect(() => {
    if (!user) return;
    const key = `announcements_last_seen_${classroomId}_${user.id}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (stored) setLastSeenAnnouncementsAt(stored);
  }, [classroomId, user]);

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

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, user:users(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }, [classroomId]);

  // AI Service URL - can be configured via environment variable
  const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:5000';

  const generateStudyGuide = useCallback(async () => {
    console.log("Generating study guide");
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
      console.log(result);
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

  const saveEditedStudyGuide = useCallback(async () => {
    if (!user || user.role !== 'teacher') return;
    const currentGuide = insights.find((i) => i.insight_type === 'study_guide') || null;
    if (!currentGuide) {
      setGenerateError('No study guide available to edit.');
      return;
    }
    setIsSavingGuide(true);
    setGenerateError(null);
    try {
      const updatedMetadata = {
        ...(currentGuide.metadata || {}),
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
        last_edited_by_name: user.display_name,
      };
      const { error } = await supabase
        .from('ai_insights')
        .update({
          content: editedGuideContent,
          metadata: updatedMetadata,
        })
        .eq('id', currentGuide.id);
      if (error) {
        throw new Error(error.message);
      }
      // Optimistic local update
      setInsights((prev) =>
        prev.map((insight) =>
          insight.id === currentGuide.id
            ? { ...insight, content: editedGuideContent, metadata: updatedMetadata }
            : insight
        )
      );
      setEditedGuideContent(editedGuideContent);
      setIsEditingGuide(false);
      // Refresh from backend to keep everyone in sync (assumes select RLS allows teacher)
      await fetchInsights();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save study guide';
      setGenerateError(message);
    } finally {
      setIsSavingGuide(false);
    }
  }, [editedGuideContent, fetchInsights, insights, user]);

  const downloadStudyGuideAsPDF = useCallback(async () => {
    const currentStudyGuide = insights.filter((i) => i.insight_type === 'study_guide')[0] || null;
    if (!currentStudyGuide) return;
    
    try {
      // Get the rendered study guide element (which has proper LaTeX rendering)
      const sourceElement = document.getElementById('study-guide-content-for-pdf');
      if (!sourceElement) {
        alert('Study guide content not found. Please try again.');
        return;
      }

      // Create a container for PDF export with print-friendly styles
      const container = document.createElement('div');
      container.id = 'pdf-export-container';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.padding = '20mm';
      container.style.backgroundColor = '#ffffff';
      container.style.fontFamily = 'Arial, sans-serif';
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.6';
      container.style.color = '#000000';
      document.body.appendChild(container);

      // Create header
      const title = currentStudyGuide.unit_name || 'Complete Study Guide';
      const date = new Date(currentStudyGuide.created_at).toLocaleDateString();
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.style.borderBottom = '2px solid #e01e5a';
      header.style.paddingBottom = '10px';
      header.innerHTML = `
        <h1 style="color: #e01e5a; font-size: 24px; margin: 0 0 5px 0; font-weight: bold;">${title}</h1>
        <p style="color: #666; font-size: 12px; margin: 0;">Generated on ${date}</p>
      `;
      container.appendChild(header);

      // Force print-friendly styling via scoped CSS so "text-white" etc never stays white in the PDF.
      const style = document.createElement('style');
      style.textContent = `
        #pdf-export-container, #pdf-export-container * {
          color: #000 !important;
          background: transparent !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
        #pdf-export-container h1, #pdf-export-container h2 { color: #111 !important; }
        #pdf-export-container h3 { color: #e01e5a !important; }
        #pdf-export-container a { color: #1164a3 !important; text-decoration: underline !important; }
        #pdf-export-container pre, #pdf-export-container code {
          background: #f5f5f5 !important;
          color: #111 !important;
        }
        #pdf-export-container ul, #pdf-export-container ol { padding-left: 18px !important; }
        #pdf-export-container .katex, #pdf-export-container .katex * { color: #000 !important; }
      `;
      container.appendChild(style);

      // Clone the rendered content (already KaTeX-rendered)
      const contentClone = sourceElement.cloneNode(true) as HTMLElement;
      container.appendChild(contentClone);

      // Wait for KaTeX to fully render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Create PDF with proper multi-page support
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Scale to fit page width only (not height) to keep text readable
      const ratio = pdfWidth / imgWidth;
      const imgScaledWidth = pdfWidth;
      const imgScaledHeight = imgHeight * ratio;

      // Page splitting: prefer splitting on blank rows (between lines) to avoid cutting text.
      // Add a little breathing room at the top/bottom of each page.
      const marginTopMm = 6;
      const marginBottomMm = 6;
      const usablePdfHeight = pdfHeight - marginTopMm - marginBottomMm;
      const pageHeightInPixels = usablePdfHeight / ratio;
      const readCtx = canvas.getContext('2d', { willReadFrequently: true });

      const isBlankRow = (strip: Uint8ClampedArray, stripWidth: number, rowOffset: number) => {
        // Sample every N pixels to keep this fast.
        const step = 10;
        let samples = 0;
        let whites = 0;
        const base = rowOffset * stripWidth * 4;
        for (let x = 0; x < stripWidth; x += step) {
          const idx = base + x * 4;
          const r = strip[idx];
          const g = strip[idx + 1];
          const b = strip[idx + 2];
          const a = strip[idx + 3];
          samples++;
          // Treat transparent or nearly-white as blank.
          if (a < 8 || (r > 245 && g > 245 && b > 245)) whites++;
        }
        return whites / samples > 0.985;
      };

      const findSafeBreakY = (yTarget: number, range: number) => {
        if (!readCtx) return Math.floor(yTarget);
        const start = Math.max(0, Math.floor(yTarget - range));
        const end = Math.min(imgHeight, Math.floor(yTarget + range));
        const height = Math.max(1, end - start);
        const strip = readCtx.getImageData(0, start, imgWidth, height).data;
        const targetOffset = Math.min(height - 1, Math.max(0, Math.floor(yTarget) - start));

        // Prefer breaking ABOVE the target (so content doesn't overflow the page).
        for (let o = targetOffset; o >= 0; o--) {
          if (isBlankRow(strip, imgWidth, o)) return start + o;
        }
        // If no blank row above, try below.
        for (let o = targetOffset + 1; o < height; o++) {
          if (isBlankRow(strip, imgWidth, o)) return start + o;
        }
        return Math.floor(yTarget);
      };

      let yStart = 0;
      let pageIndex = 0;
      while (yStart < imgHeight) {
        if (pageIndex > 0) pdf.addPage();

        const yTarget = yStart + pageHeightInPixels;
        let yEnd = Math.min(imgHeight, yTarget);

        // Only adjust if we still have more content after this page.
        if (yEnd < imgHeight) {
          yEnd = findSafeBreakY(yTarget, 140);
          // Ensure progress; fallback if we couldn't find a good break.
          if (yEnd <= yStart + 40) yEnd = Math.min(imgHeight, yTarget);
        }

        const sliceHeight = Math.max(1, Math.floor(yEnd - yStart));
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, yStart, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
          const pageImgData = pageCanvas.toDataURL('image/png');
          const pageScaledHeight = sliceHeight * ratio;
          // Render content with top margin; bottom margin is achieved by using usablePdfHeight for slicing.
          pdf.addImage(pageImgData, 'PNG', 0, marginTopMm, imgScaledWidth, pageScaledHeight);
        }

        yStart = yEnd;
        pageIndex++;
      }

      // Download the PDF
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  }, [insights]);

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
      fetchAnnouncements();
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

    // Subscribe to announcements (with notification for students)
    const announcementsChannel = supabase
      .channel(`classroom-${classroomId}-announcements`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `classroom_id=eq.${classroomId}`,
        },
        async (payload) => {
          console.log('📢 New announcement received:', payload.new);
          const newAnnouncementId = payload.new.id;
          
          // Fetch the announcement with user data
          const { data } = await supabase
            .from('announcements')
            .select('*, user:users(*)')
            .eq('id', newAnnouncementId)
            .single();
          
          if (data) {
            setAnnouncements(prev => {
              // Check if this is our own announcement (we have a temp version)
              const tempIndex = prev.findIndex(a => 
                a.id.startsWith('temp-') && 
                a.user_id === data.user_id &&
                a.title === data.title
              );
              
              if (tempIndex !== -1) {
                // Replace temp announcement with real one
                const updated = [...prev];
                updated[tempIndex] = data;
                return updated;
              }
              
              // Check if announcement already exists (avoid duplicates)
              if (prev.some(a => a.id === newAnnouncementId)) {
                return prev;
              }
              
              // Add new announcement and keep sorted (newest first)
              return [...prev, data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            });
            
            // Show notification for students (not for the teacher who posted)
            if (user?.role === 'student' && data.user_id !== user?.id) {
              setAnnouncementNotification(data);
              // Auto-dismiss after 8 seconds
              setTimeout(() => setAnnouncementNotification(null), 8000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Announcements realtime status:', status);
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(uploadsChannel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(announcementsChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, classroomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll to appropriate position when switching tabs (instant, no animation)
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      if (activeChannel === 'general') {
        // Discussion tab - scroll to bottom instantly
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      } else {
        // Announcements, Study Guide, Insights - scroll to top instantly
        contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
  }, [activeChannel]);

  // Mark announcements as read when viewing the tab
  useEffect(() => {
    if (!user) return;
    if (activeChannel !== 'announcements') return;
    if (announcements.length === 0) return;
    const latestTs = announcements[0]?.created_at;
    if (!latestTs) return;
    const key = `announcements_last_seen_${classroomId}_${user.id}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, latestTs);
    }
    setLastSeenAnnouncementsAt(latestTs);
    // Highlight newest and scroll to top
    setHighlightAnnouncementId(announcements[0]?.id || null);
    if (highlightAnnouncementTimeoutRef.current) {
      clearTimeout(highlightAnnouncementTimeoutRef.current);
    }
    highlightAnnouncementTimeoutRef.current = setTimeout(() => {
      setHighlightAnnouncementId(null);
    }, 2000);
    if (announcementsTopRef.current) {
      announcementsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeChannel, announcements, classroomId, user]);

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

  // Post announcement (teacher only)
  const postAnnouncement = async () => {
    if (!user || user.role !== 'teacher' || !newAnnouncementTitle.trim() || !newAnnouncementContent.trim()) return;

    const title = newAnnouncementTitle.trim();
    const content = newAnnouncementContent.trim();
    const tempId = `temp-${Date.now()}`;

    // Clear form immediately for better UX
    setNewAnnouncementTitle('');
    setNewAnnouncementContent('');

    // Optimistic update - add announcement immediately
    const optimisticAnnouncement: Announcement = {
      id: tempId,
      classroom_id: classroomId,
      user_id: user.id,
      title,
      content,
      created_at: new Date().toISOString(),
      user: user,
    };
    setAnnouncements(prev => [...prev, optimisticAnnouncement].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        classroom_id: classroomId,
        user_id: user.id,
        title,
        content,
      })
      .select('*, user:users(*)')
      .single();

    if (error) {
      console.error('Error posting announcement:', error);
      // Remove optimistic announcement on error
      setAnnouncements(prev => prev.filter(a => a.id !== tempId));
      alert('Failed to post announcement. Please try again.');
    } else if (data) {
      // Replace temp announcement with real one
      setAnnouncements(prev => {
        const updated = prev.map(a => a.id === tempId ? data : a);
        return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    }
  };

  // Process file upload
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessingFile(true);
    
    try {
      const fileType = file.type;
      let content = '';
      
      if (fileType.startsWith('image/')) {
        // Convert image to base64 data URL for LLM processing
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve(e.target.result as string);
            } else {
              reject(new Error('Failed to read image'));
            }
          };
          reader.onerror = () => reject(new Error('Error reading image file'));
          reader.readAsDataURL(file);
        });
      } else if (fileType === 'application/pdf') {
        // Extract text from PDF using pdfjs-dist v3 (dynamic import, browser only)
        if (typeof window === 'undefined') {
          throw new Error('PDF processing must be done in the browser');
        }

        // pdfjs-dist v3 has simpler imports and better disableWorker support
        const pdfjsLib = await import('pdfjs-dist');
        
        // Disable the worker entirely - run on main thread
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          disableWorker: true,
        } as any);
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }
        
        content = fullText;
      } else if (fileType.startsWith('text/')) {
        // Read text files directly
        content = await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload an image, PDF, or text file.');
      }
      
      setUploadContent(content);
      if (!uploadTitle.trim()) {
        // Auto-generate title from filename
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera if available
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageDataUrl);
      
      // Store base64 data URL directly (no OCR - LLM will process the image)
      setUploadContent(imageDataUrl);
      if (!uploadTitle.trim()) {
        setUploadTitle('Camera Photo');
      }
      
      stopCamera();
      setIsProcessingFile(false);
    }
  };

  // Cleanup camera on unmount or modal close
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const submitUpload = async () => {
    if (!user || !uploadTitle.trim() || !uploadContent.trim()) return;

    // Determine file type based on content
    let fileType = 'text';
    if (uploadMode === 'file' && selectedFile) {
      fileType = selectedFile.type || 'image';
    } else if (uploadMode === 'camera' || uploadContent.startsWith('data:image/')) {
      fileType = 'image';
    }

    await supabase.from('uploads').insert({
      classroom_id: classroomId,
      user_id: user.id,
      title: uploadTitle,
      content: uploadContent,
      file_type: fileType,
    });

    setShowUploadModal(false);
    setUploadTitle('');
    setUploadContent('');
    setSelectedFile(null);
    setCapturedImage(null);
    setUploadMode('text');
    stopCamera();
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

  // Get avatar color based on user id
  const getAvatarColor = (userId: string) => {
    const colors = ['avatar-blue', 'avatar-green', 'avatar-orange', 'avatar-purple', 'avatar-red', 'avatar-teal'];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredMessages = messages.filter(
    (m) => m.channel === (activeChannel === 'general' ? 'general' : 'study-guide')
  );

  // Get only the most recent study guide (there should only be one, but filter to be safe)
  const studyGuide = insights.filter((i) => i.insight_type === 'study_guide')[0] || null;
  const confusionSummaries = insights.filter((i) => i.insight_type === 'confusion_summary');

  useEffect(() => {
    if (studyGuide && !isEditingGuide) {
      setEditedGuideContent(studyGuide.content || '');
    }
  }, [studyGuide, isEditingGuide]);

  const unreadAnnouncementsCount = user?.role === 'student' && lastSeenAnnouncementsAt
    ? announcements.filter((a) => new Date(a.created_at) > new Date(lastSeenAnnouncementsAt)).length
    : (user?.role === 'student' ? announcements.length : 0);

  if (loading || !user || !classroom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#64748b] text-lg font-medium">Loading classroom...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#faf8f5] overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-[#e2e0dc] flex items-center px-6 flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[#64748b] hover:text-[#1e293b] hover:bg-[#f5f3f0] p-2.5 rounded-xl transition-all mr-4"
          title="Back to Dashboard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-2xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">{classroom.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-[#1e293b] font-semibold text-lg leading-tight">{classroom.name}</h1>
            {user.role === 'teacher' && (
              <div className="text-[#64748b] text-sm">
                Class code: <span className="font-semibold text-[#6366f1]">{classroom.join_code}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-[#e2e0dc] px-6 flex-shrink-0">
        <div className="flex">
          <button
            onClick={() => setActiveChannel('announcements')}
            className={`tab ${activeChannel === 'announcements' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2">
              <span>Announcements</span>
              {user.role === 'student' && unreadAnnouncementsCount > 0 && (
                <span className="bg-gradient-to-r from-[#ef4444] to-[#f87171] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  {unreadAnnouncementsCount}
                </span>
              )}
            </span>
          </button>
          {user.role !== 'teacher' && (
            <>
              <button
                onClick={() => setActiveChannel('general')}
                className={`tab ${activeChannel === 'general' ? 'active' : ''}`}
              >
                Discussion
              </button>
              <button
                onClick={() => setActiveChannel('study-guide')}
                className={`tab ${activeChannel === 'study-guide' ? 'active' : ''}`}
              >
                Study Guide
              </button>
            </>
          )}
          {user.role === 'teacher' && (
            <>
              <button
                onClick={() => setActiveChannel('study-guide')}
                className={`tab ${activeChannel === 'study-guide' ? 'active' : ''}`}
              >
                Study Guide
              </button>
              <button
                onClick={() => setActiveChannel('insights')}
                className={`tab ${activeChannel === 'insights' ? 'active' : ''}`}
              >
                Insights
              </button>
            </>
          )}
          <button
            onClick={() => setShowMembersPanel(true)}
            className="tab ml-auto flex items-center gap-2"
            title="Class members"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            People
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Action Bar */}
          <div className="px-6 py-4 flex items-center justify-between flex-shrink-0 bg-[#faf8f5]">
            <div className="text-[#64748b] text-sm font-medium">
              {activeChannel === 'insights' && '📊 Class Insights'}
              {activeChannel === 'announcements' && '📢 Announcements & Updates'}
              {activeChannel === 'general' && '💬 Class Discussion'}
              {activeChannel === 'study-guide' && '📚 Study Materials'}
            </div>
            <div className="flex items-center gap-3">
              {activeChannel === 'insights' && user.role === 'teacher' && (
                <button
                  onClick={() => generateInsights()}
                  disabled={isGeneratingInsights}
                  className={`btn-primary flex items-center gap-2 rounded-xl ${isGeneratingInsights ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isGeneratingInsights ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Insights
                    </>
                  )}
                </button>
              )}
              {activeChannel !== 'insights' && activeChannel !== 'announcements' && user.role !== 'teacher' && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary flex items-center gap-2 rounded-xl"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Notes
                </button>
              )}
            </div>
          </div>

          {/* Messages / Content Area */}
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
          {activeChannel === 'insights' ? (
            // Teacher Insights View
            // PRIVACY NOTE: This view shows ONLY aggregated, anonymized insights
            // Teachers NEVER see individual student messages here
            <div className="space-y-6">
              {/* Privacy Notice */}
              <div className="bg-white rounded-2xl p-5 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[#1e293b] font-semibold mb-1">Privacy Notice</h3>
                    <p className="text-[#64748b] text-sm leading-relaxed">
                      This dashboard shows <strong>aggregated insights only</strong>. 
                      Individual student messages and identities are never displayed. 
                      AI analyzes patterns to help you understand class-wide learning needs.
                    </p>
                  </div>
                </div>
                {insightsError && (
                  <div className="mt-4 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#dc2626] text-sm">
                    <strong>Error:</strong> {insightsError}
                    <p className="text-xs mt-1 text-[#ef4444]">
                      Make sure the AI service is running. In the <code className="bg-[#fee2e2] px-1.5 rounded">ai-service</code> directory, run: <code className="bg-[#fee2e2] px-1.5 rounded">start-server.bat</code> (Windows) or <code className="bg-[#fee2e2] px-1.5 rounded">python ai_service.py --server</code>
                    </p>
                  </div>
                )}
              </div>

              {/* Dashboard with Charts */}
              <InsightsDashboard 
                messages={messages}
                uploads={uploads}
                insights={insights}
                members={members}
              />

              {/* Confusion Topics - Show only the latest */}
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#fef3c7] to-[#fde68a] rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[#1e293b] font-semibold">Common Confusion Topics</h3>
                    {confusionSummaries.length > 0 && (
                      <span className="text-[#64748b] text-xs">Last updated: {formatDate(confusionSummaries[0].created_at)}</span>
                    )}
                  </div>
                </div>
                {confusionSummaries.length > 0 ? (
                  <div className="border-t border-[#e2e0dc] pt-5">
                    <StudyGuideContent content={confusionSummaries[0].content || ''} />
                  </div>
                ) : (
                  <p className="text-[#64748b] text-sm">
                    No confusion analysis yet. Click &quot;Refresh Insights&quot; to analyze student discussions.
                  </p>
                )}
              </div>

            </div>
          ) : activeChannel === 'announcements' ? (
            // Announcements Channel - Teacher posts, students read
            <div className="space-y-5">
              {/* Teacher post input card */}
              {user.role === 'teacher' && (
                <div className="bg-white rounded-2xl p-5 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className={`avatar ${getAvatarColor(user.id)}`}>
                      {user.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Announcement title"
                        value={newAnnouncementTitle}
                        onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                        className="input w-full mb-3"
                      />
                      <textarea
                        placeholder="Share something with your class..."
                        value={newAnnouncementContent}
                        onChange={(e) => setNewAnnouncementContent(e.target.value)}
                        rows={3}
                        className="input w-full resize-none"
                      />
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={postAnnouncement}
                          disabled={!newAnnouncementTitle.trim() || !newAnnouncementContent.trim()}
                          className="btn-primary rounded-xl"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {announcements.length > 0 ? (
                <div className="space-y-4" ref={announcementsTopRef}>
                  {announcements.map((announcement) => {
                    const isOwn = announcement.user_id === user?.id;
                    const authorName = announcement.user?.display_name || 'Teacher';
                    const isHighlighted = highlightAnnouncementId === announcement.id;
                    return (
                      <div 
                        key={announcement.id} 
                        className={`bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all ${isHighlighted ? 'ring-2 ring-[#6366f1] ring-offset-2' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="avatar avatar-green flex-shrink-0">
                            {authorName[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[#1e293b] font-semibold">
                                {isOwn ? 'You' : authorName}
                              </span>
                              <span className="text-[#94a3b8] text-sm">
                                {new Date(announcement.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <h4 className="text-[#6366f1] font-semibold text-lg mt-2">
                              {announcement.title}
                            </h4>
                            <p className="text-[#475569] mt-2 whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center shadow-md">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <h3 className="text-[#1e293b] font-semibold text-lg mb-2">No announcements yet</h3>
                  <p className="text-[#64748b]">
                    {user.role === 'teacher' 
                      ? 'Share important updates with your class using the form above.'
                      : 'Your teacher will post announcements here.'}
                  </p>
                </div>
              )}
            </div>
          ) : activeChannel === 'study-guide' ? (
            // Study Guide Channel - Shows AI-generated guides
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-md">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#fce7f3] to-[#fbcfe8] rounded-2xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-7 h-7 text-[#ec4899]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[#1e293b] font-semibold text-lg mb-1">AI-Generated Study Guide</h3>
                      <p className="text-[#64748b] text-sm leading-relaxed">
                        A comprehensive guide generated from all uploaded class <br />notes,
                        organized by topic to help you study effectively.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => generateStudyGuide()}
                      disabled={isGeneratingGuide || uploads.length === 0}
                      className={`btn-primary flex items-center gap-2 rounded-xl ${isGeneratingGuide || uploads.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {studyGuide ? 'Update Guide' : 'Generate Guide'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {generateError && (
                  <div className="mt-4 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#dc2626] text-sm">
                    <strong>Error:</strong> {generateError}
                    <p className="text-xs mt-1 text-[#ef4444]">
                      Make sure the AI service is running. In the <code className="bg-[#fee2e2] px-1.5 rounded">ai-service</code> directory, run: <code className="bg-[#fee2e2] px-1.5 rounded">start-server.bat</code> (Windows) or <code className="bg-[#fee2e2] px-1.5 rounded">python ai_service.py --server</code>
                    </p>
                  </div>
                )}
                {uploads.length === 0 && (
                  <div className="mt-4 p-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-[#b45309] text-sm flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Upload some notes first before generating a study guide.
                  </div>
                )}
              </div>

              {studyGuide ? (
                <div className="bg-white rounded-2xl p-6 shadow-md">
                  <div className="flex justify-between items-start mb-5 pb-5 border-b border-[#e2e0dc]">
                    <div>
                      <h4 className="text-[#1e293b] font-semibold text-lg">
                        {studyGuide.unit_name || 'Complete Study Guide'}
                      </h4>
                      <div className="flex items-center gap-3 mt-2 text-sm text-[#64748b]">
                        <span>Last updated: {formatDate(studyGuide.created_at)}</span>
                        {studyGuide.metadata?.upload_count != null && (
                          <span>• {String(studyGuide.metadata.upload_count)} notes • {String(studyGuide.metadata.unit_count || 1)} units</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.role === 'teacher' && (
                        <>
                          {isEditingGuide ? (
                            <>
                              <button
                                onClick={saveEditedStudyGuide}
                                disabled={isSavingGuide}
                                className="btn-primary py-2 px-4 text-sm rounded-xl"
                              >
                                {isSavingGuide ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingGuide(false);
                                  setEditedGuideContent('');
                                }}
                                disabled={isSavingGuide}
                                className="btn-secondary py-2 px-4 text-sm rounded-xl"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setIsEditingGuide(true);
                                setEditedGuideContent(studyGuide.content || '');
                              }}
                              className="btn-secondary py-2 px-4 text-sm rounded-xl"
                            >
                              Edit
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={downloadStudyGuideAsPDF}
                        className="btn-secondary flex items-center gap-2 rounded-xl"
                        title="Download study guide as PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                      </button>
                    </div>
                  </div>
                  {isEditingGuide ? (
                    <div className="space-y-4">
                      <textarea
                        value={editedGuideContent}
                        onChange={(e) => setEditedGuideContent(e.target.value)}
                        className="input w-full h-80 resize-none font-mono text-sm"
                        placeholder="Edit study guide content..."
                      />
                      <p className="text-[#94a3b8] text-xs">Edits are saved for the class and visible to students.</p>
                    </div>
                  ) : (
                    <div id="study-guide-content-for-pdf">
                      <StudyGuideContent content={editedGuideContent || studyGuide.content || ''} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center shadow-md">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-[#1e293b] font-semibold text-lg mb-2">No study guide yet</h3>
                  <p className="text-[#64748b]">
                    Upload notes and click &quot;Generate Guide&quot; to create your personalized study guide!
                  </p>
                </div>
              )}

              {/* Chat in study-guide channel */}
              <div className="border-t border-[#e2e0dc] pt-5 mt-6">
                <h4 className="text-[#64748b] text-sm font-medium mb-4">Discussion</h4>
                {filteredMessages.map((message, index) => {
                  const isOwnMessage = message.user_id === user?.id;
                  const displayName = message.user?.display_name || user?.display_name || 'Unknown';
                  
                  return (
                    <div 
                      key={`study-msg-${message.id}-${index}`} 
                      className={`flex gap-4 mb-4 p-4 rounded-2xl shadow-sm transition-all hover:shadow-md bg-white`}
                    >
                      <div className={`avatar flex-shrink-0 ${getAvatarColor(message.user_id)}`}>
                        {displayName[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[#1e293b] font-semibold">
                            {isOwnMessage ? 'You' : displayName}
                          </span>
                          <span className="text-[#94a3b8] text-xs">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-[#475569] mt-1 leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // General Channel - Chat + Uploads
            <div className="space-y-4">
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
                        className={`flex gap-4 p-4 rounded-2xl shadow-sm transition-all hover:shadow-md bg-white`}
                      >
                        <div className={`avatar flex-shrink-0 ${getAvatarColor(message.user_id)}`}>
                          {displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[#1e293b] font-semibold">
                              {isOwnMessage ? 'You' : displayName}
                            </span>
                            <span className="text-[#94a3b8] text-xs">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                          <p className="text-[#475569] mt-1 leading-relaxed">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    // It's an upload
                    const upload = item as Upload;
                    const isOwnUpload = upload.user_id === user?.id;
                    const displayName = upload.user?.display_name || (isOwnUpload ? user?.display_name : 'Unknown') || 'Unknown';
                    
                    // Check if it's an image
                    const isImage = upload.file_type?.startsWith('image/') || upload.content?.startsWith('data:image/');
                    
                    return (
                      <div
                        key={`upload-${upload.id}-${index}`}
                        className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 bg-gradient-to-br from-[#fce7f3] to-[#fdf2f8] rounded-xl flex items-center justify-center flex-shrink-0">
                            {isImage ? (
                              <svg className="w-5 h-5 text-[#ec4899]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-[#ec4899]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[#1e293b] font-semibold">
                                {isOwnUpload ? 'You' : displayName}
                              </span>
                              <span className="text-[#94a3b8] text-xs">
                                {formatTime(upload.created_at)}
                              </span>
                            </div>
                            {isImage ? (
                              // Image upload - show image preview
                              <div className="mt-3">
                                {upload.title && (
                                  <div className="text-[#1e293b] font-medium mb-2">{upload.title}</div>
                                )}
                                <div className="flex justify-start">
                                  <img 
                                    src={upload.content} 
                                    alt={upload.title || 'Uploaded image'}
                                    className="max-w-full max-h-96 rounded-xl border border-[#e2e0dc] object-contain cursor-pointer hover:shadow-lg transition-all"
                                    loading="lazy"
                                    onClick={(e) => {
                                      // Open image in new tab on click for full view
                                      window.open(e.currentTarget.src, '_blank');
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              // Text/PDF upload - show content
                              <div className="mt-3">
                                <div className="text-[#6366f1] font-medium">{upload.title}</div>
                                <p className="text-[#64748b] text-sm line-clamp-3 whitespace-pre-wrap break-words mt-1 leading-relaxed">{upload.content}</p>
                              </div>
                            )}
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
          </div>

          {/* Message Input */}
          {activeChannel !== 'insights' && activeChannel !== 'announcements' && (
            <div className="p-5 border-t border-[#e2e0dc] bg-white/80 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={`Share with class...`}
                    className="input flex-1 rounded-xl"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="btn-primary px-6 rounded-xl"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Members Panel */}
      {showMembersPanel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#e2e0dc] flex flex-col animate-slide-in-right">
            <div className="p-5 border-b border-[#e2e0dc] flex items-center justify-between">
              <div>
                <div className="text-[#1e293b] font-semibold text-lg">People</div>
                <div className="text-[#64748b] text-sm">Class members</div>
              </div>
              <button
                onClick={() => setShowMembersPanel(false)}
                className="text-[#64748b] hover:text-[#1e293b] hover:bg-[#f5f3f0] p-2 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {Array.from(new Map(members.map(m => [m.id, m])).values())
                .sort((a, b) => {
                  if (a.role === 'teacher' && b.role !== 'teacher') return -1;
                  if (a.role !== 'teacher' && b.role === 'teacher') return 1;
                  return a.display_name.localeCompare(b.display_name);
                })
                .map((member) => (
                  <div key={member.id} className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all border border-[#f0eeeb]">
                    <div className={`avatar ${member.role === 'teacher' ? 'avatar-blue' : 'avatar-green'}`}>
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#1e293b] font-semibold truncate">
                        {member.display_name}{member.id === user?.id ? ' (you)' : ''}
                      </div>
                      <div className="text-[#64748b] text-sm">
                        {member.role === 'teacher' ? 'Teacher' : 'Student'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden" onClick={() => {
          setShowUploadModal(false);
          stopCamera();
        }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto overflow-x-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-[#e2e0dc]">
              <h2 className="text-[#1e293b] text-xl font-semibold">Upload Notes</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  stopCamera();
                }}
                className="text-[#64748b] hover:text-[#1e293b] hover:bg-[#f5f3f0] p-2 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Mode Tabs */}
              <div className="flex gap-2 mb-6 border-b border-[#e2e0dc]">
                <button
                  onClick={() => {
                    setUploadMode('text');
                    stopCamera();
                  }}
                  className={`tab ${uploadMode === 'text' ? 'active' : ''}`}
                >
                  Text
                </button>
                <button
                  onClick={() => {
                    setUploadMode('file');
                    stopCamera();
                  }}
                  className={`tab ${uploadMode === 'file' ? 'active' : ''}`}
                >
                  File
                </button>
                <button
                  onClick={() => {
                    setUploadMode('camera');
                    startCamera();
                  }}
                  className={`tab ${uploadMode === 'camera' ? 'active' : ''}`}
                >
                  Camera
                </button>
              </div>

              <div className="space-y-5">
                {/* Title Input */}
                <div>
                  <label className="block text-[#64748b] text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="input w-full rounded-xl"
                    placeholder="e.g., Chapter 5 Notes - Cell Division"
                  />
                </div>

              {/* Text Mode */}
              {uploadMode === 'text' && (
                <div>
                  <label className="block text-[#64748b] text-sm font-medium mb-2">Content</label>
                  <textarea
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    className="input w-full h-48 resize-none rounded-xl"
                    placeholder="Paste your notes here..."
                  />
                </div>
              )}

              {/* File Mode */}
              {uploadMode === 'file' && (
                <div>
                  <label className="block text-[#64748b] text-sm font-medium mb-2">Upload File</label>
                  <div className="border-2 border-dashed border-[#e2e0dc] rounded-2xl p-8 text-center hover:border-[#6366f1] hover:bg-[#faf8f5] transition-all">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.txt,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileSelect(file);
                        }
                      }}
                      className="hidden"
                    />
                    {!selectedFile ? (
                      <div>
                        <div className="w-16 h-16 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-[#64748b] text-sm mb-3">
                          Drag and drop a file here, or click to select
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-primary rounded-xl"
                        >
                          Choose File
                        </button>
                        <p className="text-[#94a3b8] text-xs mt-3">
                          Supports: Images (JPG, PNG), PDFs, Text files
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="w-16 h-16 bg-gradient-to-br from-[#dcfce7] to-[#d1fae5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="text-[#22c55e] font-semibold mb-2">{selectedFile.name}</div>
                        {isProcessingFile ? (
                          <div className="text-[#64748b] text-sm">Processing file...</div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedFile(null);
                              setUploadContent('');
                            }}
                            className="text-[#ef4444] text-sm hover:underline font-medium"
                          >
                            Remove file
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {uploadContent && uploadContent.startsWith('data:image/') ? (
                    <div className="mt-4">
                      <label className="block text-[#64748b] text-sm font-medium mb-2">Image Preview</label>
                      <img 
                        src={uploadContent} 
                        alt="Upload preview" 
                        className="max-w-full max-h-64 rounded-xl border border-[#e2e0dc]"
                      />
                      <p className="text-[#94a3b8] text-xs mt-2">Image will be sent directly to the LLM for processing</p>
                    </div>
                  ) : uploadContent ? (
                    <div className="mt-4">
                      <label className="block text-[#64748b] text-sm font-medium mb-2">Content</label>
                      <textarea
                        value={uploadContent}
                        onChange={(e) => setUploadContent(e.target.value)}
                        className="input w-full h-48 resize-none rounded-xl"
                        placeholder="Content will appear here after processing..."
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* Camera Mode */}
              {uploadMode === 'camera' && (
                <div>
                  <label className="block text-[#64748b] text-sm font-medium mb-2">Take Photo</label>
                  {!capturedImage ? (
                    <div className="border-2 border-[#e2e0dc] rounded-2xl overflow-hidden">
                      {cameraStream ? (
                        <div className="relative">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full max-h-96 object-contain bg-black"
                          />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button
                              onClick={capturePhoto}
                              className="bg-white rounded-2xl p-4 shadow-lg hover:bg-[#f5f3f0] transition-all"
                            >
                              <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={stopCamera}
                              className="bg-white text-[#ef4444] px-4 py-2 rounded-xl shadow-lg hover:bg-[#f5f3f0] transition-all font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <p className="text-[#64748b] text-sm mb-3">
                            Camera access needed to take photos
                          </p>
                          <button
                            onClick={startCamera}
                            className="btn-primary rounded-xl"
                          >
                            Start Camera
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full max-h-96 object-contain rounded-2xl mb-4 border border-[#e2e0dc]"
                      />
                      {isProcessingFile ? (
                        <div className="text-[#64748b] text-sm text-center">Processing image...</div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCapturedImage(null);
                              setUploadContent('');
                              startCamera();
                            }}
                            className="btn-secondary flex-1 rounded-xl"
                          >
                            Retake
                          </button>
                        </div>
                      )}
                      {uploadContent && uploadContent.startsWith('data:image/') && (
                        <div className="mt-4">
                          <label className="block text-[#64748b] text-sm font-medium mb-2">Image Preview</label>
                          <img 
                            src={uploadContent} 
                            alt="Captured photo" 
                            className="max-w-full max-h-64 rounded-xl border border-[#e2e0dc]"
                          />
                          <p className="text-[#94a3b8] text-xs mt-2">Image will be sent directly to the LLM for processing</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[#e2e0dc] bg-[#faf8f5]">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  stopCamera();
                }}
                className="btn-secondary flex-1 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={submitUpload}
                disabled={!uploadTitle.trim() || !uploadContent.trim() || isProcessingFile}
                className="btn-primary flex-1 rounded-xl"
              >
                {isProcessingFile ? 'Processing...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Notification Toast (Students) */}
      {announcementNotification && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
          <div 
            className="bg-white border-l-4 border-[#6366f1] rounded-2xl shadow-xl p-5 max-w-sm cursor-pointer hover:shadow-2xl transition-all"
            onClick={() => {
              setActiveChannel('announcements');
              setAnnouncementNotification(null);
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6366f1] font-semibold text-sm">New Announcement</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnnouncementNotification(null);
                    }}
                    className="text-[#64748b] hover:text-[#1e293b] hover:bg-[#f5f3f0] p-1.5 rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h4 className="text-[#1e293b] font-semibold mt-1 truncate">
                  {announcementNotification.title}
                </h4>
                <p className="text-[#64748b] text-sm mt-0.5 line-clamp-2 leading-relaxed">
                  {announcementNotification.content}
                </p>
                <p className="text-[#6366f1] text-xs mt-2 font-medium">Click to view</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
