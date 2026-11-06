import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  Copy,
  Check,
  Sparkles,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  Trash2,
  Radio,
  Lock,
  MessageSquare,
  CalendarDays,
  ListTodo,
  ShieldAlert,
  X,
  ShieldCheck,
  Briefcase,
  Code2,
  Palette,
  Kanban
} from 'lucide-react';

interface MeetingHost {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface MeetingSummary {
  id: string;
  title: string;
  description: string;
  host: MeetingHost;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  is_instant: boolean;
  room_code: string;
  passcode: string;
  is_locked?: boolean;
  waiting_room_enabled?: boolean;
  template_type?: string;
  candidate_name?: string;
  agenda_items?: any[];
  allowed_roles: string;
  participants_count: number;
  has_ai_summary: boolean;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export const Meetings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingSummary | null>(null);

  // Schedule Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [agendaList, setAgendaList] = useState<string[]>(['']);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('general');
  const [selectedCandidateAppId, setSelectedCandidateAppId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Meetings
  const { data: meetings = [], isLoading } = useQuery<MeetingSummary[]>({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings/'),
    refetchInterval: 10000,
  });

  // Fetch Team Members for invitations
  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/teams/members/'),
    staleTime: 60000,
  });

  // Fetch Candidate Applications for Interview Mode
  const { data: candidateApps = [] } = useQuery<any[]>({
    queryKey: ['candidate-apps-for-meeting'],
    queryFn: async () => {
      try {
        const res = await api.get('/hiring/applications/');
        return Array.isArray(res) ? res : res.results || [];
      } catch {
        return [];
      }
    },
    enabled: isScheduleOpen,
  });

  // Create Meeting Mutation
  const createMeetingMutation = useMutation({
    mutationFn: (data: any) => api.post('/meetings/', data),
    onSuccess: (newMeeting) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setIsScheduleOpen(false);
      resetScheduleForm();
      if (newMeeting.is_instant) {
        navigate(`/meetings/room/${newMeeting.room_code}`);
      }
    },
    onError: (err: any) => {
      setFormError(extractErrorMessage(err));
    },
  });

  // Delete Meeting Mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/meetings/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setMeetingToDelete(null);
    },
  });

  const resetScheduleForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewStart('');
    setNewEnd('');
    setNewPasscode('');
    setWaitingRoomEnabled(false);
    setSelectedTemplate('general');
    setSelectedCandidateAppId('');
    setAgendaList(['']);
    setSelectedInvitees([]);
    setCustomEmailInput('');
    setFormError(null);
  };


  const handleStartInstantMeeting = () => {
    const defaultTitle = `${user?.first_name || 'My'}'s Instant Meeting`;
    createMeetingMutation.mutate({
      title: defaultTitle,
      description: 'Quick ad-hoc conference call',
      is_instant: true,
      invitees: [],
    });
  };

  const handleDownloadMeetingICS = async (m: MeetingSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/meetings/${m.id}/ics/`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to download calendar invite');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${m.room_code}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      coreAlert({
        title: 'Download Failed',
        description: err.message || 'Error downloading calendar invite file (.ics).',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newTitle.trim()) {
      setFormError('Meeting title is required.');
      return;
    }

    let inviteesPayload = selectedInvitees.map((email) => {
      const mem = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
      return {
        email,
        name: mem ? `${mem.first_name} ${mem.last_name}`.trim() : email.split('@')[0],
        role: 'attendee',
      };
    });

    // If candidate interview mode, auto-add candidate email to invitees
    if (selectedTemplate === 'interview' && selectedCandidateAppId) {
      const app = candidateApps.find((a: any) => a.id === selectedCandidateAppId);
      if (app && app.candidate && app.candidate.email) {
        const cEmail = app.candidate.email.toLowerCase();
        if (!inviteesPayload.some((inv) => inv.email.toLowerCase() === cEmail)) {
          inviteesPayload.push({
            email: cEmail,
            name: app.candidate.first_name ? `${app.candidate.first_name} ${app.candidate.last_name}` : 'Candidate',
            role: 'attendee',
          });
        }
      }
    }

    const filteredAgenda = agendaList.map((a) => a.trim()).filter(Boolean);

    createMeetingMutation.mutate({
      title: newTitle.trim(),
      description: newDesc.trim(),
      scheduled_start: newStart ? new Date(newStart).toISOString() : null,
      scheduled_end: newEnd ? new Date(newEnd).toISOString() : null,
      is_instant: false,
      passcode: newPasscode.trim(),
      waiting_room_enabled: waitingRoomEnabled,
      template_type: selectedTemplate,
      candidate_application_id: selectedCandidateAppId || null,
      agenda_items: filteredAgenda,
      invitees: inviteesPayload,
    });
  };

  const handleAddCustomEmail = () => {
    const trimmed = customEmailInput.trim().toLowerCase();
    if (trimmed && trimmed.includes('@') && !selectedInvitees.includes(trimmed)) {
      setSelectedInvitees([...selectedInvitees, trimmed]);
      setCustomEmailInput('');
    }
  };

  const handleCopyLink = (roomCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = `${window.location.origin}/meetings/room/${roomCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedRoomCode(roomCode);
    setTimeout(() => setCopiedRoomCode(null), 2000);
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.room_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.host.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.host.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'upcoming') {
        return m.status === 'scheduled' || m.status === 'live';
      }
      if (activeTab === 'past') {
        return m.status === 'completed' || m.status === 'cancelled';
      }
      return true;
    });
  }, [meetings, searchQuery, activeTab]);

  // Statistics
  const totalCount = meetings.length;
  const liveCount = meetings.filter((m) => m.status === 'live').length;
  const upcomingCount = meetings.filter((m) => m.status === 'scheduled').length;
  const aiSummarizedCount = meetings.filter((m) => m.has_ai_summary).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border pb-4 sm:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Meetings & Video Intelligence
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse">
                <Radio className="h-3 w-3" />
                {liveCount} Live
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Video conferencing, real-time speech transcription, and AI-powered meeting intelligence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleStartInstantMeeting}
            disabled={createMeetingMutation.isPending}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs gap-1.5 sm:gap-2 flex-1 sm:flex-none h-8 sm:h-9 text-xs"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Instant Meeting
          </Button>
          <Button
            onClick={() => {
              resetScheduleForm();
              setIsScheduleOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-border text-slate-700 dark:text-slate-300 hover:bg-accent font-semibold gap-1.5 sm:gap-2 flex-1 sm:flex-none h-8 sm:h-9 text-xs"
          >
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Metrics Row (Compact 2x2 on Mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-xl p-3 sm:p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Meetings</p>
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 sm:mt-1">{totalCount}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
              <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-xl p-3 sm:p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Live & Scheduled</p>
              <h3 className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-1">{upcomingCount + liveCount}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-xl p-3 sm:p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">AI Summarized</p>
              <h3 className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 sm:mt-1">{aiSummarizedCount}</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-xl p-3 sm:p-5">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Calendar Sync</p>
              <h3 className="text-lg sm:text-2xl font-bold text-sky-600 dark:text-sky-400 mt-0.5 sm:mt-1">Active</h3>
            </div>
            <div className="p-2 sm:p-2.5 bg-sky-50 dark:bg-sky-950/40 rounded-xl text-sky-600 dark:text-sky-400 shrink-0">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs and Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Upcoming & Live ({upcomingCount + liveCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'past'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Past & AI Archives ({meetings.filter((m) => m.status === 'completed' || m.status === 'cancelled').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Meetings ({totalCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, host or code..."
            className="pl-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs h-9"
          />
        </div>
      </div>

      {/* Meetings Grid List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Video className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No meetings found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? `No meetings matching "${searchQuery}". Try refining your search.`
              : activeTab === 'upcoming'
              ? 'You have no scheduled or live meetings right now. Start an instant conference or schedule one for your team.'
              : 'No past recorded meetings in your workspace yet.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button
              onClick={handleStartInstantMeeting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 text-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start Instant Meeting
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMeetings.map((meeting) => {
            const isHost = user?.id === meeting.host.id;
            const isLive = meeting.status === 'live';
            const isCompleted = meeting.status === 'completed';
            const isScheduled = meeting.status === 'scheduled';

            return (
              <Card
                key={meeting.id}
                className={`group flex flex-col justify-between transition-all duration-200 hover:shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl ${
                  isLive
                    ? 'ring-2 ring-rose-500/40 border-rose-500/40'
                    : 'hover:border-primary/40'
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {isLive && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            LIVE
                          </span>
                        )}
                        {isScheduled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 shrink-0">
                            Scheduled
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                            Completed
                          </span>
                        )}
                        {meeting.passcode && (
                          <span title="Passcode Protected" className="text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-900/40">
                            <Lock className="h-3 w-3" />
                            Passcode
                          </span>
                        )}
                        {meeting.waiting_room_enabled && (
                          <span title="Waiting Room Enabled" className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-900/40">
                            <ShieldCheck className="h-3 w-3" />
                            Waiting Room
                          </span>
                        )}
                        {meeting.template_type === 'interview' && (
                          <span className="text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                            <Briefcase className="h-3 w-3" />
                            Interview {meeting.candidate_name ? `• ${meeting.candidate_name}` : ''}
                          </span>
                        )}
                        {meeting.template_type === 'code' && (
                          <span className="text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-indigo-300 dark:border-indigo-800">
                            <Code2 className="h-3 w-3" />
                            Code Sandbox
                          </span>
                        )}
                        {meeting.template_type === 'whiteboard' && (
                          <span className="text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-pink-300 dark:border-pink-800">
                            <Palette className="h-3 w-3" />
                            Whiteboard
                          </span>
                        )}
                        {meeting.template_type === 'retro' && (
                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                            <Kanban className="h-3 w-3" />
                            Sprint Retro
                          </span>
                        )}
                        {meeting.template_type === '1on1' && (
                          <span className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-purple-300 dark:border-purple-800">
                            🤝 1-on-1 Sync
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                        {meeting.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Download .ics Calendar File */}
                      <button
                        type="button"
                        onClick={(e) => handleDownloadMeetingICS(meeting, e)}
                        title="Download .ics Calendar Invite"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>

                      {/* Copy Room Link Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(meeting.room_code, e)}
                        title="Copy meeting link"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                      >
                        {copiedRoomCode === meeting.room_code ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {meeting.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                      {meeting.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3.5">
                  <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        {meeting.scheduled_start
                          ? new Date(meeting.scheduled_start).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Instant Session'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate text-slate-600 dark:text-slate-300 font-medium">
                          Host: <strong>{meeting.host.first_name} {meeting.host.last_name}</strong>
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {meeting.room_code}
                      </span>
                    </div>
                  </div>

                  {/* AI Summary Badge for Past Meetings */}
                  {meeting.has_ai_summary && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>Gemini AI Insights & Decisions Ready</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {isLive || isScheduled ? (
                      <Button
                        onClick={() => navigate(`/meetings/room/${meeting.room_code}`)}
                        className={`flex-1 font-semibold gap-2 text-xs h-9 ${
                          isLive
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        <Video className="h-4 w-4" />
                        {isLive ? 'Join Live' : 'Enter Room'}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => navigate(`/meetings/${meeting.id}`)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold gap-2 text-xs border border-slate-200 dark:border-slate-700 h-9"
                      >
                        <FileText className="h-4 w-4 text-primary" />
                        View AI Summary & Chat
                      </Button>
                    )}

                    {(isCompleted || isScheduled) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/meetings/${meeting.id}`)}
                        title="Meeting Details & Transcripts"
                        className="h-9 w-9 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}

                    {(isHost || user?.role === 'admin') && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMeetingToDelete(meeting)}
                        title="Delete Meeting"
                        className="h-9 w-9 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule Meeting Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Calendar className="h-5 w-5 text-primary" />
              Schedule Video Conference
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleScheduleSubmit} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            {/* Structured Meeting Framework & Template Picker */}
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Meeting Framework & Purpose
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'general', label: '👥 General Call', desc: 'Standard video & agenda' },
                  { id: 'interview', label: '💼 Interview Mode', desc: 'Candidate Dossier & Live Scorecard' },
                  { id: 'code', label: '💻 Code Sandbox', desc: 'Live Pair-Programming' },
                  { id: 'whiteboard', label: '🎨 Whiteboard', desc: 'Collaborative Diagramming' },
                  { id: 'retro', label: '🔄 Sprint Retro', desc: 'Keep / Stop / Start Sticky Board' },
                  { id: '1on1', label: '🤝 1-on-1 Sync', desc: 'Wins, Blockers & Growth' },
                ].map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(tmpl.id);
                      if (tmpl.id === 'interview' && !newTitle) {
                        setNewTitle('Technical Interview: Candidate Evaluation');
                      } else if (tmpl.id === 'retro' && !newTitle) {
                        setNewTitle('Engineering Sprint Retrospective');
                      } else if (tmpl.id === '1on1' && !newTitle) {
                        setNewTitle('Weekly 1-on-1 Growth Sync');
                      } else if (tmpl.id === 'code' && !newTitle) {
                        setNewTitle('Technical Pair-Programming Session');
                      } else if (tmpl.id === 'whiteboard' && !newTitle) {
                        setNewTitle('System Architecture & Design Review');
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedTemplate === tmpl.id
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{tmpl.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{tmpl.desc}</div>
                  </button>
                ))}
              </div>

              {/* If Interview Mode, Show Candidate Application Dropdown */}
              {selectedTemplate === 'interview' && (
                <div className="pt-2 space-y-1.5 border-t border-slate-200 dark:border-slate-800 mt-2">
                  <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Link Candidate from Hiring Pipeline
                  </label>
                  <select
                    value={selectedCandidateAppId}
                    onChange={(e) => {
                      const appId = e.target.value;
                      setSelectedCandidateAppId(appId);
                      const app = candidateApps.find((a: any) => a.id === appId);
                      if (app && app.candidate) {
                        setNewTitle(`Interview: ${app.candidate.first_name || ''} ${app.candidate.last_name || 'Candidate'} - ${app.job_posting?.title || 'Engineer'}`);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-lg p-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-primary"
                  >
                    <option value="">Select Candidate Application to Link...</option>
                    {candidateApps.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.candidate?.first_name} {a.candidate?.last_name} ({a.candidate?.email}) — {a.job_posting?.title || 'Candidate'} [{a.stage?.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Auto-populates the candidate's verified resume and standardized scoring scorecard inside the video room.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Meeting Topic / Title *</label>
              <Input
                required
                placeholder="e.g. Weekly Product Sync & Roadmap Review"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Agenda / Description</label>
              <textarea
                rows={2}
                placeholder="Brief summary of meeting discussion points..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Live Agenda Topics Checklist Builder */}
            <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-indigo-500" />
                  Live Meeting Agenda Topics (Tracked Live)
                </label>
                <button
                  type="button"
                  onClick={() => setAgendaList([...agendaList, ''])}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Bullet Point
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Attendees can check off these topics in real time during the live video call.
              </p>

              <div className="space-y-2 pt-1">
                {agendaList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <Input
                      placeholder={`e.g. Topic ${idx + 1}: ${idx === 0 ? 'Q3 Performance Review' : idx === 1 ? 'Budget Allocation' : 'Next Sprint Goals'}`}
                      value={item}
                      onChange={(e) => {
                        const next = [...agendaList];
                        next[idx] = e.target.value;
                        setAgendaList(next);
                      }}
                      className="text-xs bg-white dark:bg-slate-900 h-8"
                    />
                    {agendaList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAgendaList(agendaList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Start Time</label>
                  <Input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">End Time</label>
                  <Input
                    type="datetime-local"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 15);
                    const end = new Date(now.getTime() + 45 * 60000);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    setNewStart(toIso(now));
                    setNewEnd(toIso(end));
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                >
                  In 15 Mins
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(10, 0, 0, 0);
                    const end = new Date(tomorrow.getTime() + 60 * 60000);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    setNewStart(toIso(tomorrow));
                    setNewEnd(toIso(end));
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                >
                  Tomorrow 10 AM
                </button>
              </div>
            </div>

            {/* Enhanced Security & Guest Access */}
            <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" />
                Enhanced Security & Room Protection
              </label>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                  Room Passcode (Optional)
                </label>
                <Input
                  placeholder="e.g. 849201 or leave blank for open workspace access"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs h-8 font-mono"
                />
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={waitingRoomEnabled}
                  onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Enable Waiting Room (Guest Knocking)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Participants must be explicitly admitted by the host before joining audio & video.
                  </span>
                </div>
              </label>
            </div>

            {/* Invite Participants */}
            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Invite Workspace Members (Email & .ICS dispatched)</span>
                <span className="text-primary font-bold">{selectedInvitees.length} selected</span>
              </label>

              {/* Quick Select Workspace Members */}
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No other team members found.</p>
                )}
                {members
                  .filter((m) => m.email.toLowerCase() !== user?.email.toLowerCase())
                  .map((mem) => {
                    const isSelected = selectedInvitees.includes(mem.email.toLowerCase());
                    return (
                      <div
                        key={mem.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedInvitees(selectedInvitees.filter((e) => e !== mem.email.toLowerCase()));
                          } else {
                            setSelectedInvitees([...selectedInvitees, mem.email.toLowerCase()]);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/30 text-primary font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300">
                            {mem.first_name?.[0] || mem.email[0].toUpperCase()}
                          </div>
                          <span className="font-semibold truncate">
                            {mem.first_name} {mem.last_name}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">&lt;{mem.email}&gt;</span>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    );
                  })}
              </div>

              {/* Add Custom Outside Email */}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="email"
                  placeholder="Or invite external email address..."
                  value={customEmailInput}
                  onChange={(e) => setCustomEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomEmail();
                    }
                  }}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
                />
                <Button
                  type="button"
                  onClick={handleAddCustomEmail}
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs font-semibold"
                >
                  Add
                </Button>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScheduleOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMeetingMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs"
              >
                {createMeetingMutation.isPending ? 'Scheduling...' : 'Schedule & Send Invites'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {meetingToDelete && (
        <DeleteConfirmModal
          open={!!meetingToDelete}
          onOpenChange={(open) => {
            if (!open) setMeetingToDelete(null);
          }}
          title="Delete Meeting"
          description={`Are you sure you want to delete "${meetingToDelete.title}"? All associated transcripts and recordings will be removed.`}
          onConfirm={() => deleteMeetingMutation.mutate(meetingToDelete.id)}
          isLoading={deleteMeetingMutation.isPending}
        />
      )}
    </div>
  );
};
