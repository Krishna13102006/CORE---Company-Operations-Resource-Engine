import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { api, extractErrorMessage, API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Video,
  Sparkles,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  ListTodo,
  FileText,
  Download,
  RotateCw,
  Send,
  User,
  ArrowLeft,
  Bot,
  Copy,
  Check,
  Search,
  Lock,
  Plus,
  FolderGit2,
  CheckSquare,
  AlertCircle,
  CalendarDays,
  Disc,
  Play,
  Mail,
  ExternalLink,
  CheckCheck
} from 'lucide-react';

interface ActionItem {
  id?: string;
  task: string;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  deadline: string;
  is_converted?: boolean;
  task_id?: string;
  project_name?: string;
}

interface AgendaItem {
  id: string;
  text: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface Participant {
  id: string;
  email: string;
  name: string;
  role: string;
  has_joined: boolean;
  joined_at: string | null;
}

interface MeetingDetailData {
  id: string;
  title: string;
  description: string;
  host: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  is_instant: boolean;
  room_code: string;
  passcode: string;
  is_locked?: boolean;
  waiting_room_enabled?: boolean;
  agenda_items?: AgendaItem[];
  recording_file_url?: string;
  recording_url?: string;
  active_presentation?: any;
  transcript_raw: any[];
  ai_summary: string;
  key_decisions: string[];
  action_items: ActionItem[];
  participants: Participant[];
  created_at: string;
  updated_at: string;
}

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}


const MarkdownRenderer: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  if (!content) return null;

  // Sanitize em-dashes and table row breaks
  const sanitized = content.replace(/[—–]/g, ' - ').replace(/\|\s*\|/g, '|\n|');

  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          table: ({ node, ...props }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs border-collapse divide-y divide-border bg-white dark:bg-slate-900" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase tracking-wider text-[10px] text-slate-700 dark:text-slate-200" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 border-b border-border font-bold text-slate-800 dark:text-slate-100" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-b border-border text-slate-700 dark:text-slate-300 align-top" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-1.5 list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-1.5 list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="my-0.5 leading-relaxed" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-1 leading-relaxed text-slate-800 dark:text-slate-200" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-slate-900 dark:text-white" {...props} />
          ),
          code: ({ node, inline, className: codeClass, children, ...props }: any) => {
            return (
              <code
                className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-primary"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
};

export const MeetingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat'>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloadingICS, setIsDownloadingICS] = useState(false);

  // Convert Action Item to Task State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertIndex, setConvertIndex] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [convertError, setConvertError] = useState<string | null>(null);

  // RAG Chat State
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am your AI Meeting Assistant. You can ask me any question about what was discussed, decisions made, action items, or specific speaker points.",
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch Meeting Detail
  const {
    data: meeting,
    isLoading,
    isError,
  } = useQuery<MeetingDetailData>({
    queryKey: ['meeting-detail', id],
    queryFn: () => api.get(`/meetings/${id}/`),
  });

  // Fetch Projects for Task Conversion
  const { data: projectsData } = useQuery<any>({
    queryKey: ['projects-for-meeting'],
    queryFn: () => api.get('/projects/'),
    enabled: isConvertModalOpen,
  });
  const projects = Array.isArray(projectsData?.results) ? projectsData.results : Array.isArray(projectsData) ? projectsData : [];

  // Fetch Users for Task Assignee
  const { data: usersData } = useQuery<any[]>({
    queryKey: ['users-for-meeting'],
    queryFn: () => api.get('/auth/users/'),
    enabled: isConvertModalOpen,
  });
  const teamUsers = Array.isArray(usersData) ? usersData : [];

  // Convert Action Item Mutation
  const convertTaskMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/meetings/${id}/convert-task/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items'] });
      setIsConvertModalOpen(false);
      setConvertError(null);
    },
    onError: (err: any) => {
      setConvertError(extractErrorMessage(err) || 'Failed to convert action item to project task.');
    }
  });

  const handleOpenConvertModal = (item: ActionItem, idx: number) => {
    setConvertIndex(idx);
    setTaskTitle(item.task || '');
    setTaskDescription(`Action item owner: ${item.owner || 'Unassigned'}\nOriginal deadline: ${item.deadline || 'None'}`);
    setTaskPriority(item.priority === 'high' ? 'high' : item.priority === 'low' ? 'low' : 'medium');
    setTaskDueDate('');
    
    // Auto-select first project if available
    if (projects.length > 0 && !taskProjectId) {
      setTaskProjectId(projects[0].id);
    }
    
    // Match owner to team users if possible
    if (item.owner && teamUsers.length > 0) {
      const matched = teamUsers.find(u => 
        `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase().includes(item.owner.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(item.owner.toLowerCase())
      );
      if (matched) {
        setTaskAssigneeId(matched.id);
      }
    }

    setConvertError(null);
    setIsConvertModalOpen(true);
  };

  const handleExecuteConvertTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProjectId) {
      setConvertError('Please select a project for this task.');
      return;
    }
    if (!taskTitle.trim()) {
      setConvertError('Task title is required.');
      return;
    }

    convertTaskMutation.mutate({
      project_id: taskProjectId,
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      assignee_id: taskAssigneeId || null,
      due_date: taskDueDate || null,
      priority: taskPriority,
      action_index: convertIndex,
    });
  };

  // Re-generate AI Summary Mutation
  const summarizeMutation = useMutation({
    mutationFn: () => api.post(`/meetings/${id}/summarize/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-detail', id] });
    },
  });

  const handleDownloadICS = async () => {
    if (!meeting) return;
    try {
      setIsDownloadingICS(true);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/meetings/${meeting.id}/ics/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to download calendar file');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${meeting.room_code}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      coreAlert({
        title: 'Download Failed',
        description: err.message || 'Error downloading calendar invite (.ics).',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingICS(false);
    }
  };

  const [isSendingRecap, setIsSendingRecap] = useState(false);
  const [recapSuccess, setRecapSuccess] = useState<string | null>(null);
  const [isConvertingAllTasks, setIsConvertingAllTasks] = useState(false);

  // Helper: Format date for calendar URL
  const formatCalTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    } catch {
      return '';
    }
  };

  // 1-Click Google Calendar URL
  const getGoogleCalendarUrl = () => {
    if (!meeting) return '#';
    const title = encodeURIComponent(meeting.title || 'CORE Meeting');
    const details = encodeURIComponent(
      `${meeting.description || 'CORE Video Conference'}\n\nJoin Meeting: ${window.location.origin}/meetings/room/${meeting.room_code}\nRoom Code: ${meeting.room_code}`
    );
    const location = encodeURIComponent(`${window.location.origin}/meetings/room/${meeting.room_code}`);
    const start = formatCalTime(meeting.scheduled_start || new Date().toISOString());
    const end = formatCalTime(meeting.scheduled_end || new Date(Date.now() + 3600000).toISOString());
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${start}/${end}`;
  };

  // 1-Click Outlook Calendar URL
  const getOutlookCalendarUrl = () => {
    if (!meeting) return '#';
    const subject = encodeURIComponent(meeting.title || 'CORE Meeting');
    const body = encodeURIComponent(
      `${meeting.description || 'CORE Video Conference'}\n\nJoin Meeting: ${window.location.origin}/meetings/room/${meeting.room_code}\nRoom Code: ${meeting.room_code}`
    );
    const location = encodeURIComponent(`${window.location.origin}/meetings/room/${meeting.room_code}`);
    const start = meeting.scheduled_start ? new Date(meeting.scheduled_start).toISOString() : new Date().toISOString();
    const end = meeting.scheduled_end ? new Date(meeting.scheduled_end).toISOString() : new Date(Date.now() + 3600000).toISOString();
    return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&body=${body}&location=${location}&startdt=${encodeURIComponent(start)}&enddt=${encodeURIComponent(end)}`;
  };

  // Send AI Meeting Recap Email to Attendees
  const handleSendRecapEmail = async () => {
    if (!meeting) return;
    try {
      setIsSendingRecap(true);
      setRecapSuccess(null);
      const res = await api.post(`/meetings/${meeting.id}/recap-email/`);
      setRecapSuccess(res.detail || 'Meeting recap email dispatched to all attendees!');
      coreAlert({
        title: 'Recap Email Dispatched',
        description: res.detail || 'Meeting executive recap and action items emailed to all participants successfully.'
      });
      setTimeout(() => setRecapSuccess(null), 5000);
    } catch (err: any) {
      coreAlert({
        title: 'Dispatch Failed',
        description: extractErrorMessage(err) || 'Failed to dispatch meeting recap emails.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingRecap(false);
    }
  };

  // Bulk Convert All Action Items to CORE Project Tasks
  const handleBulkConvertTasks = async () => {
    if (!meeting) return;
    try {
      setIsConvertingAllTasks(true);
      const res = await api.post(`/meetings/${meeting.id}/convert-all-tasks/`);
      queryClient.invalidateQueries({ queryKey: ['meeting-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      coreAlert({
        title: 'Tasks Created in CORE Projects',
        description: res.detail || `Converted ${res.converted_count || 0} action items into project tasks.`
      });
    } catch (err: any) {
      coreAlert({
        title: 'Conversion Failed',
        description: extractErrorMessage(err) || 'Failed to bulk convert action items.',
        variant: 'destructive',
      });
    } finally {
      setIsConvertingAllTasks(false);
    }
  };


  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isStreaming]);

  // Handle SSE Streaming RAG Chat
  const handleSendAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isStreaming || !meeting) return;

    const userQuery = chatInput.trim();
    setChatInput('');

    const userMsg: AIChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: userQuery,
    };

    const assistantMsgId = Math.random().toString(36).substring(2, 9);
    const assistantMsg: AIChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/meetings/${meeting.id}/ai-chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          question: userQuery,
          history: historyPayload,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to AI streaming service.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace(/^data:\s*/, '').trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedText }
                      : msg
                  )
                );
              }
            } catch (e) {
              // Ignore non-JSON or partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  'Sorry, I encountered an error answering your question from the meeting context. Please try again.',
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleDownloadNotes = () => {
    if (!meeting) return;
    const dateStr = new Date(meeting.created_at).toLocaleDateString();
    let md = `# Meeting Notes: ${meeting.title}\n\n`;
    md += `**Date:** ${dateStr}\n`;
    md += `**Host:** ${meeting.host.first_name} ${meeting.host.last_name} (${meeting.host.email})\n`;
    md += `**Room Code:** ${meeting.room_code}\n\n`;

    md += `## Executive Summary\n${meeting.ai_summary || 'No summary available.'}\n\n`;

    md += `## Key Decisions\n`;
    (meeting.key_decisions || []).forEach((d) => {
      md += `- ${d}\n`;
    });
    md += '\n';

    md += `## Action Items\n`;
    (meeting.action_items || []).forEach((a) => {
      md += `- [ ] **${a.task}** | Owner: ${a.owner} | Priority: ${a.priority.toUpperCase()} | Due: ${a.deadline}\n`;
    });
    md += '\n';

    md += `## Spoken Transcript\n`;
    (meeting.transcript_raw || []).forEach((t) => {
      md += `[${t.timestamp || ''}] **${t.speaker_name || t.speaker_email}**: ${t.text}\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${meeting.title.replace(/\s+/g, '_')}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/meetings/room/${meeting?.room_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RotateCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Loading meeting intelligence...</p>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meeting Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">The requested meeting could not be loaded.</p>
        <Button onClick={() => navigate('/meetings')} className="mt-4 bg-primary text-primary-foreground font-semibold">
          Back to Meetings
        </Button>
      </div>
    );
  }

  const filteredTranscripts = (meeting.transcript_raw || []).filter((t) =>
    (t.text || '').toLowerCase().includes(transcriptSearch.toLowerCase()) ||
    (t.speaker_name || '').toLowerCase().includes(transcriptSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Meetings Hub
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {meeting.status !== 'completed' && (
            <Button
              onClick={() => navigate(`/meetings/room/${meeting.room_code}`)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 h-9"
            >
              <Video className="h-3.5 w-3.5" />
              Enter Room
            </Button>
          )}

          {/* 1-Click Google Calendar */}
          <a
            href={getGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors h-9"
            title="Add event directly to Google Calendar"
          >
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
            <span>Google Cal</span>
            <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
          </a>

          {/* 1-Click Microsoft Outlook Calendar */}
          <a
            href={getOutlookCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors h-9"
            title="Add event directly to Microsoft Outlook Calendar"
          >
            <CalendarDays className="h-3.5 w-3.5 text-sky-500" />
            <span>Outlook Cal</span>
            <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
          </a>

          <Button
            onClick={handleDownloadICS}
            disabled={isDownloadingICS}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-800 text-xs font-semibold gap-1.5 h-9 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <CalendarDays className={`h-3.5 w-3.5 text-indigo-500 ${isDownloadingICS ? 'animate-spin' : ''}`} />
            {isDownloadingICS ? 'Downloading...' : '.ics Invite'}
          </Button>

          <Button
            onClick={handleDownloadNotes}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-800 text-xs font-semibold gap-1.5 h-9"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            Export Markdown
          </Button>

          {/* Email AI Meeting Minutes Recap to Attendees */}
          <Button
            onClick={handleSendRecapEmail}
            disabled={isSendingRecap}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-800 text-xs font-semibold gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-9"
            title="Send executive summary and action items email to all meeting participants"
          >
            <Mail className={`h-3.5 w-3.5 ${isSendingRecap ? 'animate-bounce' : ''}`} />
            {isSendingRecap ? 'Sending Recap...' : 'Email Recap'}
          </Button>

          <Button
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-800 text-xs font-semibold gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 h-9"
          >
            <Sparkles className={`h-3.5 w-3.5 ${summarizeMutation.isPending ? 'animate-spin' : ''}`} />
            {summarizeMutation.isPending ? 'Re-analyzing...' : 'Refresh AI Summary'}
          </Button>
        </div>
      </div>

      {/* Hero Overview Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                {meeting.status.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {meeting.room_code}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{meeting.title}</h1>
            {meeting.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{meeting.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shrink-0 self-start md:self-auto"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Room Link'}</span>
          </button>
        </div>

        {/* Metadata Details Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Host</span>
            <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
              {meeting.host.first_name} {meeting.host.last_name}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Date</span>
            <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
              {new Date(meeting.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Attendees</span>
            <span className="font-bold text-primary mt-0.5 block">
              {meeting.participants.length} Invited ({meeting.participants.filter((p) => p.has_joined).length} Joined)
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Spoken Turns</span>
            <span className="font-bold text-purple-600 dark:text-purple-400 mt-0.5 block">
              {meeting.transcript_raw?.length || 0} segments
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'summary'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          AI Summary & Action Items
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'transcript'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          Full Transcript ({meeting.transcript_raw?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'chat'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bot className="h-4 w-4" />
          Ask Meeting AI
        </button>
      </div>

      {/* Tab 1: AI Summary, Key Decisions & Action Items */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Executive Summary & Recording (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Video Recording (if available) */}
            {(meeting.recording_file_url || meeting.recording_url) && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Disc className="h-4 w-4 text-rose-500" />
                    Session Video Recording
                  </CardTitle>
                  <a
                    href={meeting.recording_file_url || meeting.recording_url}
                    download={`meeting_${meeting.room_code}_recording.webm`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Video
                  </a>
                </CardHeader>
                <CardContent className="p-4 bg-slate-950 flex flex-col items-center justify-center">
                  <video
                    src={meeting.recording_file_url || meeting.recording_url}
                    controls
                    className="w-full max-h-[420px] rounded-xl object-contain bg-black shadow-lg"
                  />
                </CardContent>
              </Card>
            )}

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Executive Meeting Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {meeting.ai_summary ? (
                  <MarkdownRenderer content={meeting.ai_summary} className="text-sm" />
                ) : (
                  <div className="text-center py-12 text-slate-500 space-y-3">
                    <Sparkles className="h-8 w-8 mx-auto text-slate-400" />
                    <p className="text-xs">No AI summary generated yet for this session.</p>
                    <Button
                      onClick={() => summarizeMutation.mutate()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                    >
                      Generate AI Summary Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Decisions List */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Key Decisions Finalized
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {meeting.key_decisions && meeting.key_decisions.length > 0 ? (
                  <ul className="space-y-2.5">
                    {meeting.key_decisions.map((decision, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 text-xs text-slate-800 dark:text-slate-200"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="font-semibold leading-relaxed">{decision}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No formal key decisions recorded in this meeting.</p>
                )}
              </CardContent>
            </Card>

            {/* Live Agenda Topics Status Card */}
            {meeting.agenda_items && meeting.agenda_items.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-base font-bold flex items-center justify-between text-slate-900 dark:text-white">
                    <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                      <CheckSquare className="h-4 w-4" />
                      Meeting Agenda Progress
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                      {meeting.agenda_items.filter((i) => i.is_completed).length} / {meeting.agenda_items.length} Covered
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-2.5">
                    {meeting.agenda_items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-colors ${
                          item.is_completed
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="mt-0.5">
                          {item.is_completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <div className="h-4 w-4 rounded border-2 border-slate-300 dark:border-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold ${item.is_completed ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {item.text}
                          </p>
                          {item.completed_at && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                              Completed during session ({item.completed_at})
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Items Checklist (1 Col) */}
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex flex-wrap items-center justify-between gap-2 text-purple-600 dark:text-purple-400">
                  <span className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Assigned Action Items
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-normal text-slate-400">
                      {meeting.action_items?.length || 0} items
                    </span>
                    {meeting.action_items && meeting.action_items.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkConvertTasks}
                        disabled={isConvertingAllTasks}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-900/60 px-2 py-1 rounded-lg transition-colors"
                        title="Auto-create CORE project tasks for all action items"
                      >
                        <CheckCheck className={`h-3 w-3 ${isConvertingAllTasks ? 'animate-spin' : ''}`} />
                        <span>{isConvertingAllTasks ? 'Converting...' : 'Convert All to Tasks'}</span>
                      </button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {meeting.action_items && meeting.action_items.length > 0 ? (
                  meeting.action_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white leading-snug">{item.task}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                            item.priority === 'high'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                              : item.priority === 'medium'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 truncate font-medium text-slate-700 dark:text-slate-300">
                          <User className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{item.owner}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">{item.deadline}</span>
                      </div>

                      {/* 1-Click Convert to Project Task Action */}
                      <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        {item.is_converted ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/40 w-full">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Converted to Task {item.project_name ? `(${item.project_name})` : ''}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenConvertModal(item, idx)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors w-full justify-center"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            + Convert to Project Task
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No assigned action items extracted.</p>
                )}
              </CardContent>
            </Card>

            {/* Attendees Panel */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Users className="h-4 w-4 text-primary" />
                  Invited Participants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {meeting.participants.map((p) => (
                  <div
                    key={p.id || p.email}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {p.name?.[0] || p.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.email}</p>
                      </div>
                    </div>
                    {p.has_joined ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                        Attended
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Invited</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Full Spoken Transcript */}
      {activeTab === 'transcript' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <FileText className="h-4 w-4 text-primary" />
              Verbatim Dialogue Transcript
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search spoken dialogue..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                className="pl-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs h-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {filteredTranscripts.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p>No dialogue matching your filter.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {filteredTranscripts.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          {entry.speaker_name || entry.speaker_email || 'Speaker'}
                        </span>
                        {entry.speaker_email && (
                          <span className="text-[10px] text-slate-400">&lt;{entry.speaker_email}&gt;</span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{entry.timestamp}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Ask Meeting AI (Interactive RAG Chat) */}
      {activeTab === 'chat' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl flex flex-col h-[620px]">
          <CardHeader className="border-b border-border pb-4 flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Bot className="h-5 w-5 text-primary" />
              Ask Meeting AI Assistant
            </CardTitle>
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              Grounded in Spoken Dialogue & Notes
            </span>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl max-w-[80%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500 italic">
                        <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                        Synthesizing response from meeting notes...
                      </span>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {user?.first_name?.[0] || 'U'}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </CardContent>

          <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-950/40">
            <form onSubmit={handleSendAIChat} className="flex items-center gap-2">
              <Input
                placeholder="Ask anything about this meeting (e.g., 'What was agreed on pricing?', 'Who handles deployment?')..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isStreaming}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
              <Button
                type="submit"
                disabled={isStreaming || !chatInput.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Convert Action Item to Project Task Modal */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <FolderGit2 className="h-5 w-5 text-primary" />
              Convert Action Item to Project Task
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteConvertTask} className="space-y-4 pt-2">
            {convertError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{convertError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Project <span className="text-rose-500">*</span>
              </label>
              <select
                value={taskProjectId}
                onChange={(e) => setTaskProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              >
                <option value="" disabled>-- Select a Project --</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.status || 'Active'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Finalize API specification"
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Assignee
                </label>
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {teamUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e: any) => setTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConvertModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={convertTaskMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5"
              >
                {convertTaskMutation.isPending ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {convertTaskMutation.isPending ? 'Creating Task...' : 'Convert to Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
