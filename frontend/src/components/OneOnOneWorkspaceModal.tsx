import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ExternalLink,
  Zap,
  ArrowRight,
  Loader2,
  X,
  MessageSquare,
  ListTodo,
  CheckSquare,
  Sparkles,
  User,
  Users,
  Shield,
  AlertCircle
} from 'lucide-react';
import { api, extractErrorMessage } from '../lib/api';
import { Button } from '@/components/ui/button';
import { getInitials } from '../lib/utils';
import { useCoreModal } from '../context/ModalContext';

export interface OneOnOneAgendaItem {
  id: string;
  title: string;
  completed: boolean;
  added_by: string;
}

export interface OneOnOneTopic {
  id: string;
  topic: string;
  notes: string;
  status: 'open' | 'discussed';
}

export interface OneOnOneActionItem {
  id: string;
  title: string;
  assignee_id: string;
  assignee_name?: string;
  due_date: string | null;
  status: 'pending' | 'completed';
  converted_to_task_id: string | null;
}

export interface OneOnOneWorkspace {
  id: string;
  department: string;
  department_name?: string;
  manager: string;
  manager_name: string;
  manager_email: string;
  employee: string;
  employee_name: string;
  employee_email: string;
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'ad_hoc';
  shared_agenda: OneOnOneAgendaItem[];
  discussion_topics: OneOnOneTopic[];
  action_items: OneOnOneActionItem[];
  room_code: string;
  next_meeting_date: string | null;
  last_meeting_date: string | null;
  created_at: string;
  updated_at: string;
}

interface OneOnOneWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: string | null;
  initialEmployeeId?: string | null;
  initialDepartmentId?: string | null;
  currentUser: any;
}

export const OneOnOneWorkspaceModal: React.FC<OneOnOneWorkspaceModalProps> = ({
  open,
  onClose,
  workspaceId: initialWorkspaceId,
  initialEmployeeId,
  initialDepartmentId,
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const { alert } = useCoreModal();

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(initialWorkspaceId || null);
  const [activeTab, setActiveTab] = useState<'agenda' | 'topics' | 'actions'>('agenda');

  // Form local state
  const [cadence, setCadence] = useState<'weekly' | 'biweekly' | 'monthly' | 'ad_hoc'>('weekly');
  const [nextMeetingDate, setNextMeetingDate] = useState<string>('');
  const [agendaItems, setAgendaItems] = useState<OneOnOneAgendaItem[]>([]);
  const [topics, setTopics] = useState<OneOnOneTopic[]>([]);
  const [actionItems, setActionItems] = useState<OneOnOneActionItem[]>([]);
  
  // New input inputs
  const [newAgendaText, setNewAgendaText] = useState('');
  const [newTopicText, setNewTopicText] = useState('');
  const [newTopicNotes, setNewTopicNotes] = useState('');
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState<'manager' | 'employee'>('employee');
  const [newActionDueDate, setNewActionDueDate] = useState('');

  // Fetch or create workspace
  const {
    data: workspace,
    isLoading: isWorkspaceLoading,
    refetch: refetchWorkspace
  } = useQuery<OneOnOneWorkspace>({
    queryKey: ['oneOnOneWorkspace', currentWorkspaceId, initialEmployeeId],
    queryFn: async () => {
      if (currentWorkspaceId) {
        return await api.get(`/teams/one-on-one/${currentWorkspaceId}/`);
      } else if (initialEmployeeId) {
        const res = await api.post('/teams/one-on-one/', {
          employee_id: initialEmployeeId,
          department_id: initialDepartmentId,
        });
        setCurrentWorkspaceId(res.id);
        return res;
      }
      return null;
    },
    enabled: open && (Boolean(currentWorkspaceId) || Boolean(initialEmployeeId)),
  });

  // Projects list for task conversion
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['projectsListForConversion'],
    queryFn: () => api.get('/projects/projects/'),
    enabled: open,
  });

  useEffect(() => {
    if (workspace) {
      setCadence(workspace.cadence || 'weekly');
      setNextMeetingDate(workspace.next_meeting_date ? workspace.next_meeting_date.substring(0, 16) : '');
      setAgendaItems(workspace.shared_agenda || []);
      setTopics(workspace.discussion_topics || []);
      setActionItems(workspace.action_items || []);
    }
  }, [workspace]);

  // Mutation: Update workspace
  const updateWorkspaceMutation = useMutation({
    mutationFn: async (payload: Partial<OneOnOneWorkspace>) => {
      if (!currentWorkspaceId) return;
      return await api.patch(`/teams/one-on-one/${currentWorkspaceId}/`, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['oneOnOneWorkspace'] });
      queryClient.invalidateQueries({ queryKey: ['oneOnOneWorkspacesList'] });
    },
    onError: (err: any) => {
      alert({
        title: 'Update Failed',
        description: extractErrorMessage(err) || 'Could not update workspace.',
        variant: 'destructive',
      });
    }
  });

  // Save changes handler
  const handleSaveWorkspace = (updatedFields: Partial<OneOnOneWorkspace>) => {
    updateWorkspaceMutation.mutate(updatedFields);
  };

  // Agenda handlers
  const handleAddAgendaItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgendaText.trim()) return;
    const newItem: OneOnOneAgendaItem = {
      id: 'ag-' + Date.now(),
      title: newAgendaText.trim(),
      completed: false,
      added_by: currentUser?.full_name || currentUser?.email || 'User',
    };
    const updated = [...agendaItems, newItem];
    setAgendaItems(updated);
    setNewAgendaText('');
    handleSaveWorkspace({ shared_agenda: updated });
  };

  const handleToggleAgendaItem = (id: string) => {
    const updated = agendaItems.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
    setAgendaItems(updated);
    handleSaveWorkspace({ shared_agenda: updated });
  };

  const handleDeleteAgendaItem = (id: string) => {
    const updated = agendaItems.filter(item => item.id !== id);
    setAgendaItems(updated);
    handleSaveWorkspace({ shared_agenda: updated });
  };

  // Topics handlers
  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicText.trim()) return;
    const newTopic: OneOnOneTopic = {
      id: 'tp-' + Date.now(),
      topic: newTopicText.trim(),
      notes: newTopicNotes.trim(),
      status: 'open',
    };
    const updated = [...topics, newTopic];
    setTopics(updated);
    setNewTopicText('');
    setNewTopicNotes('');
    handleSaveWorkspace({ discussion_topics: updated });
  };

  const handleToggleTopicStatus = (id: string) => {
    const updated = topics.map(t => t.id === id ? { ...t, status: t.status === 'open' ? 'discussed' : 'open' } as OneOnOneTopic : t);
    setTopics(updated);
    handleSaveWorkspace({ discussion_topics: updated });
  };

  const handleDeleteTopic = (id: string) => {
    const updated = topics.filter(t => t.id !== id);
    setTopics(updated);
    handleSaveWorkspace({ discussion_topics: updated });
  };

  // Action Items handlers
  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;
    const isEmp = newActionAssignee === 'employee';
    const newAction: OneOnOneActionItem = {
      id: 'act-' + Date.now(),
      title: newActionText.trim(),
      assignee_id: isEmp ? (workspace?.employee || '') : (workspace?.manager || ''),
      assignee_name: isEmp ? workspace?.employee_name : workspace?.manager_name,
      due_date: newActionDueDate || null,
      status: 'pending',
      converted_to_task_id: null,
    };
    const updated = [...actionItems, newAction];
    setActionItems(updated);
    setNewActionText('');
    setNewActionDueDate('');
    handleSaveWorkspace({ action_items: updated });
  };

  const handleToggleActionStatus = (id: string) => {
    const updated = actionItems.map(a => a.id === id ? { ...a, status: a.status === 'pending' ? 'completed' : 'pending' } as OneOnOneActionItem : a);
    setActionItems(updated);
    handleSaveWorkspace({ action_items: updated });
  };

  const handleDeleteActionItem = (id: string) => {
    const updated = actionItems.filter(a => a.id !== id);
    setActionItems(updated);
    handleSaveWorkspace({ action_items: updated });
  };

  // Mutation: Convert action item to CORE Task
  const [convertingActionId, setConvertingActionId] = useState<string | null>(null);
  const convertTaskMutation = useMutation({
    mutationFn: async ({ actionItemId, projectId }: { actionItemId: string; projectId?: string }) => {
      if (!currentWorkspaceId) return;
      return await api.post(`/teams/one-on-one/${currentWorkspaceId}/convert-task/`, {
        action_item_id: actionItemId,
        project_id: projectId || (projects.length > 0 ? projects[0].id : null),
        priority: 'high',
      });
    },
    onSuccess: (res) => {
      refetchWorkspace();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert({
        title: 'Action Item Converted',
        description: `Successfully created CORE Task: "${res.task?.title || 'Action Task'}". Check your Projects board.`,
        variant: 'success',
      });
    },
    onError: (err: any) => {
      alert({
        title: 'Task Conversion Failed',
        description: extractErrorMessage(err) || 'Could not convert action item to task.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setConvertingActionId(null);
    }
  });

  const handleConvertActionToTask = (actionId: string) => {
    setConvertingActionId(actionId);
    convertTaskMutation.mutate({ actionItemId: actionId });
  };

  // Launch instant video meeting room
  const launchMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspaceId) return;
      return await api.post(`/teams/one-on-one/${currentWorkspaceId}/launch-meeting/`, {});
    },
    onSuccess: (data) => {
      if (data?.room_code) {
        window.open(`/meeting-room?room=${data.room_code}`, '_blank');
      }
    },
    onError: (err: any) => {
      alert({
        title: 'Room Generation Failed',
        description: extractErrorMessage(err) || 'Could not launch video meeting room.',
        variant: 'destructive',
      });
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/10 via-background to-secondary/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/20 text-primary border border-primary/30 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  Recurring 1-on-1 Workspace
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  Private Channel
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Continuous alignment, shared agenda, and direct CORE task conversion between manager and report.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isWorkspaceLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Loading 1-on-1 Workspace...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Workspace Bar: Manager & Report Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Manager Card */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm border border-primary/30">
                  {workspace?.manager_name ? getInitials(workspace.manager_name) : 'M'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-500" /> Manager
                  </div>
                  <div className="text-sm font-bold text-foreground truncate">
                    {workspace?.manager_name || 'Assigned Manager'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {workspace?.manager_email || ''}
                  </div>
                </div>
              </div>

              {/* Report Card */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary-foreground font-bold flex items-center justify-center text-sm border border-secondary/30">
                  {workspace?.employee_name ? getInitials(workspace.employee_name) : 'E'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-500" /> Direct Report
                  </div>
                  <div className="text-sm font-bold text-foreground truncate">
                    {workspace?.employee_name || 'Team Member'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {workspace?.employee_email || ''}
                  </div>
                </div>
              </div>

              {/* Quick Actions & Video Launcher */}
              <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-background flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Video Sync</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {workspace?.room_code || 'Ready'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => launchMeetingMutation.mutate()}
                  disabled={launchMeetingMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
                >
                  {launchMeetingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  <span>Launch Video Room</span>
                </Button>
              </div>
            </div>

            {/* Cadence & Next Meeting Schedule Bar */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary" /> Cadence:
                </div>
                <select
                  value={cadence}
                  onChange={(e) => {
                    const newCadence = e.target.value as any;
                    setCadence(newCadence);
                    handleSaveWorkspace({ cadence: newCadence });
                  }}
                  className="bg-muted border border-border text-foreground text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="weekly">Weekly (Recommended)</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="ad_hoc">Ad-hoc as needed</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary" /> Next Session:
                </div>
                <input
                  type="datetime-local"
                  value={nextMeetingDate}
                  onChange={(e) => {
                    setNextMeetingDate(e.target.value);
                    handleSaveWorkspace({ next_meeting_date: e.target.value || null });
                  }}
                  className="bg-muted border border-border text-foreground text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border flex items-center gap-2">
              <button
                onClick={() => setActiveTab('agenda')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'agenda'
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckSquare className="w-4 h-4" /> Shared Agenda ({agendaItems.length})
              </button>
              <button
                onClick={() => setActiveTab('topics')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'topics'
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Discussion Topics ({topics.length})
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'actions'
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListTodo className="w-4 h-4" /> Action Items & Tasks ({actionItems.length})
              </button>
            </div>

            {/* TAB 1: Shared Agenda */}
            {activeTab === 'agenda' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <form onSubmit={handleAddAgendaItem} className="flex gap-2">
                  <input
                    type="text"
                    value={newAgendaText}
                    onChange={(e) => setNewAgendaText(e.target.value)}
                    placeholder="Add an agenda topic for next 1-on-1 (e.g. Q4 Growth Goals, Workload Review)..."
                    className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button type="submit" size="sm" className="font-semibold text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Topic
                  </Button>
                </form>

                <div className="space-y-2">
                  {agendaItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      No agenda topics added yet. Add what you want to talk about in your next sync.
                    </div>
                  ) : (
                    agendaItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          item.completed
                            ? 'bg-muted/20 border-border/50 text-muted-foreground line-through'
                            : 'bg-card border-border hover:border-primary/40'
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => handleToggleAgendaItem(item.id)}
                        >
                          {item.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-medium">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            added by {item.added_by}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteAgendaItem(item.id)}
                          className="text-muted-foreground hover:text-red-500 p-1 transition-colors"
                          title="Delete agenda item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Discussion Topics */}
            {activeTab === 'topics' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <form onSubmit={handleAddTopic} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                  <div className="text-xs font-bold text-foreground">New Discussion Point / Note</div>
                  <input
                    type="text"
                    value={newTopicText}
                    onChange={(e) => setNewTopicText(e.target.value)}
                    placeholder="Topic title (e.g. Architecture decisions, Career progression, Feedback)..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <textarea
                    value={newTopicNotes}
                    onChange={(e) => setNewTopicNotes(e.target.value)}
                    placeholder="Talking points, context, or meeting minutes..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="font-semibold text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Save Discussion Note
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {topics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      No discussion topics recorded. Keep meeting notes and ongoing talking points here.
                    </div>
                  ) : (
                    topics.map((t) => (
                      <div
                        key={t.id}
                        className={`p-4 rounded-xl border transition-all ${
                          t.status === 'discussed'
                            ? 'bg-muted/30 border-border/60 opacity-80'
                            : 'bg-card border-border shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground">{t.topic}</h4>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  t.status === 'discussed'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {t.status === 'discussed' ? 'Discussed' : 'Open Point'}
                              </span>
                            </div>
                            {t.notes && (
                              <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
                                {t.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleTopicStatus(t.id)}
                              className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                            >
                              {t.status === 'discussed' ? 'Reopen' : 'Mark Discussed'}
                            </Button>
                            <button
                              onClick={() => handleDeleteTopic(t.id)}
                              className="text-muted-foreground hover:text-red-500 p-1.5 transition-colors"
                              title="Delete topic"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Action Items & CORE Task Conversion */}
            {activeTab === 'actions' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <form onSubmit={handleAddActionItem} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                  <div className="text-xs font-bold text-foreground">Add Committed Action Item</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={newActionText}
                      onChange={(e) => setNewActionText(e.target.value)}
                      placeholder="Commitment / action item description..."
                      className="md:col-span-2 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={newActionAssignee}
                      onChange={(e) => setNewActionAssignee(e.target.value as any)}
                      className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="employee">Assign to {workspace?.employee_name || 'Report'}</option>
                      <option value="manager">Assign to {workspace?.manager_name || 'Manager'}</option>
                    </select>
                    <input
                      type="date"
                      value={newActionDueDate}
                      onChange={(e) => setNewActionDueDate(e.target.value)}
                      className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="font-semibold text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Action Item
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  {actionItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      No action items yet. Decisions made in 1-on-1s can be converted directly into real CORE Tasks.
                    </div>
                  ) : (
                    actionItems.map((action) => (
                      <div
                        key={action.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          action.status === 'completed'
                            ? 'bg-muted/20 border-border/50 opacity-80'
                            : 'bg-card border-border shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleActionStatus(action.id)}
                            className="text-muted-foreground hover:text-emerald-500 transition-colors shrink-0"
                          >
                            {action.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                              <span className={action.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                                {action.title}
                              </span>
                              {action.converted_to_task_id && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  <Zap className="w-3 h-3 text-amber-500" /> Synced to CORE Task
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5">
                              <span>Assignee: <strong className="text-foreground">{action.assignee_name || 'Assigned'}</strong></span>
                              {action.due_date && <span>Due: {action.due_date}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {!action.converted_to_task_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConvertActionToTask(action.id)}
                              disabled={convertingActionId === action.id}
                              className="h-7 text-xs font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            >
                              {convertingActionId === action.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <Zap className="w-3 h-3 text-amber-500 mr-1" />
                              )}
                              Convert to CORE Task
                            </Button>
                          ) : (
                            <a
                              href="/projects"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                            >
                              <span>View in Board</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeleteActionItem(action.id)}
                            className="text-muted-foreground hover:text-red-500 p-1.5 transition-colors"
                            title="Delete action item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Changes auto-save seamlessly to your department records</span>
          </div>
          <Button variant="default" size="sm" onClick={onClose} className="font-semibold text-xs px-4">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
