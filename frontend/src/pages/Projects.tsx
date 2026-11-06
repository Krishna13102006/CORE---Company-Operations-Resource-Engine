import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus,
  ListTodo,
  FolderGit2,
  Calendar,
  ClipboardList,
  Loader2,
  PlayCircle,
  CheckCircle,
  HelpCircle,
  Trash2,
  User,
  AlertCircle,
  Clock,
  Edit2,
  CheckSquare,
  X,
  MessageSquare,
  Activity,
  Sliders,
  GitBranch,
  Users,
  RefreshCw,
  Sparkles,
  Zap,
  TrendingUp,
  FileText,
  UploadCloud,
  Tag,
  Layers,
  Link2,
  PieChart,
  Target,
  ExternalLink,
  ChevronRight,
  DownloadCloud,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  Printer,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'done' | 'on_hold';
  start_date: string | null;
  end_date: string | null;
  owner?: string;
  owner_name?: string;
  task_count?: number;
  completed_count?: number;
  overdue_count?: number;
}

interface TaskComment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

interface Subtask {
  id: string;
  title: string;
  is_done: boolean;
  created_at: string;
}

interface AssigneeOOOInfo {
  leave_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  manager_name?: string | null;
  manager_user_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  start_date: string | null;
  is_milestone: boolean;
  depends_on: string | null;
  assignee?: string;
  assignee_name?: string;
  assignee_ooo_info?: AssigneeOOOInfo | null;
  tags?: string[];
  epic?: string;
  estimated_hours?: number | null;
  logged_hours?: number | null;
  linked_document?: string | null;
  linked_document_title?: string | null;
  linked_meeting?: string | null;
  linked_meeting_title?: string | null;
  comments?: TaskComment[];
  subtasks?: Subtask[];
}


const GanttView: React.FC<{
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}> = ({ tasks, onOpenTask }) => {
  const taskDates = tasks
    .filter((t) => t.start_date || t.due_date)
    .map((t) => new Date(t.start_date || t.due_date || ''));
  
  const minDate = taskDates.length > 0 
    ? new Date(Math.min(...taskDates.map(d => d.getTime()))) 
    : new Date();
  
  const startDate = new Date(minDate);
  startDate.setDate(startDate.getDate() - 3);

  const days: Date[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/5 flex flex-col font-sans">
      <div className="flex border-b border-border bg-slate-50 dark:bg-slate-900 overflow-x-auto min-w-[800px] divide-x divide-border">
        <div className="w-64 shrink-0 p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left bg-slate-100/50 dark:bg-slate-900">
          Task Name
        </div>
        <div className="flex-1 flex min-w-[540px]">
          {days.map((d, index) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div 
                key={index} 
                className={`flex-1 min-w-[20px] py-2 text-center flex flex-col items-center justify-center text-[9px] font-bold select-none ${
                  isWeekend ? 'bg-slate-100/50 dark:bg-slate-900/30 text-slate-400' : 'text-slate-600 dark:text-slate-300'
                } ${isToday ? 'bg-primary/10 text-primary border-x border-primary/20' : ''}`}
              >
                <span>{d.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0)}</span>
                <span className="text-[10px]">{d.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-border max-h-[480px] overflow-y-auto min-w-[800px]">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground bg-white dark:bg-slate-900">
            No active tasks on timeline. Add tasks with start/due dates to display Gantt timeline.
          </div>
        ) : (
          tasks.map((task) => {
            const taskStart = task.start_date ? new Date(task.start_date) : (task.due_date ? new Date(task.due_date) : null);
            const taskDue = task.due_date ? new Date(task.due_date) : (task.start_date ? new Date(task.start_date) : null);

            let startIndex = -1;
            let endIndex = -1;

            if (taskStart && taskDue) {
              const cleanStart = new Date(taskStart.setHours(0,0,0,0));
              const cleanDue = new Date(taskDue.setHours(0,0,0,0));

              days.forEach((day, idx) => {
                const cleanDay = new Date(day.setHours(0,0,0,0));
                if (cleanDay.getTime() === cleanStart.getTime()) {
                  startIndex = idx;
                }
                if (cleanDay.getTime() === cleanDue.getTime()) {
                  endIndex = idx;
                }
              });
            }

            const hasRange = startIndex !== -1 || endIndex !== -1;
            const leftOffset = startIndex !== -1 ? (startIndex / 28) * 100 : 0;
            const rightOffset = endIndex !== -1 ? ((endIndex + 1) / 28) * 100 : 0;
            const barWidth = hasRange ? Math.max(rightOffset - leftOffset, 3.5) : 0;

            const isOverdue = task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));

            return (
              <div 
                key={task.id} 
                onClick={() => onOpenTask(task)}
                className="flex items-center hover:bg-slate-100/40 dark:hover:bg-slate-900/40 bg-white dark:bg-slate-900/60 cursor-pointer divide-x divide-border py-2.5 transition-colors text-left"
              >
                <div className="w-64 shrink-0 px-3 flex items-center justify-between gap-2 overflow-hidden">
                  <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                    {task.is_milestone ? '◆' : ''} {task.title}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-1 rounded text-[7px] font-extrabold uppercase ${
                      task.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {task.priority.substring(0, 3)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex min-w-[540px] relative items-center h-7 px-1 select-none">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((d, index) => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div 
                          key={index} 
                          className={`flex-1 border-r border-border ${isWeekend ? 'bg-slate-500/5' : ''}`}
                        />
                      );
                    })}
                  </div>

                  {hasRange && (
                    task.is_milestone ? (
                      <div 
                        style={{ left: `${leftOffset + (barWidth / 2) - 1.5}%` }}
                        className="absolute h-3 w-3 bg-amber-500 transform rotate-45 border border-white shadow-sm flex items-center justify-center"
                        title={`${task.title} (Milestone: ${taskDue ? taskDue.toLocaleDateString() : ''})`}
                      />
                    ) : (
                      <div 
                        style={{ 
                          left: `${leftOffset}%`, 
                          width: `${barWidth}%` 
                        }}
                        className={`absolute h-4 rounded-full border shadow-sm transition-all flex items-center px-2 ${
                          task.status === 'done'
                            ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : task.status === 'blocked'
                            ? 'bg-amber-500/20 text-amber-700 border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-400'
                            : isOverdue
                            ? 'bg-red-500/20 text-red-700 border-red-500/40 dark:bg-red-950/20 dark:text-red-400'
                            : 'bg-indigo-500/20 text-indigo-700 border-indigo-500/40 dark:bg-indigo-950/20 dark:text-indigo-400'
                        }`}
                      >
                        {barWidth > 12 && (
                          <span className="text-[8px] font-bold truncate leading-none uppercase">
                            {task.status}
                          </span>
                        )}
                      </div>
                    )
                  )}

                  {task.depends_on && (
                    (() => {
                      const parentTask = tasks.find(t => t.id === task.depends_on);
                      if (parentTask) {
                        return (
                          <div className="absolute right-2 text-[7px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border">
                            ⛓️ Pre: {parentTask.title.substring(0, 10)}...
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const ROLE_RANK: Record<string, number> = {
  admin: 4,
  hr: 3,
  manager: 2,
  employee: 1,
};

export const Projects: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { alert: coreAlert } = useCoreModal();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);

  // View & Sorting states
  const [viewMode, setViewMode] = useState<'board' | 'gantt'>('board');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'alphabetical'>('due_date');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Dialog States
  const [showAddTask, setShowAddTask] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [showEditProject, setShowEditProject] = useState<Project | null>(null);

  const [showSprintModal, setShowSprintModal] = useState(false);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintData, setSprintData] = useState<any>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownItems, setBreakdownItems] = useState<any[]>([]);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const [showMeetingSyncModal, setShowMeetingSyncModal] = useState(false);
  const [importingActionItem, setImportingActionItem] = useState<string | null>(null);

  const [showImporterModal, setShowImporterModal] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPayloadText, setImportPayloadText] = useState('');
  const [importTargetProject, setImportTargetProject] = useState<string>('new');
  const [importNewProjectName, setImportNewProjectName] = useState('');
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [copiedRetro, setCopiedRetro] = useState(false);
  const [isCreatingSOP, setIsCreatingSOP] = useState(false);
  const [createdSOPInfo, setCreatedSOPInfo] = useState<{ id: string; title: string } | null>(null);

  // Confirmation Dialog States
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteProjectName, setDeleteProjectName] = useState<string>('');
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteTaskTitle, setDeleteTaskTitle] = useState<string>('');

  // Edit Project Form States
  const [editProjName, setEditProjName] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [editProjStatus, setEditProjStatus] = useState<'planning' | 'active' | 'done' | 'on_hold'>('planning');

  // New Project Form State
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projStatus, setProjStatus] = useState<'planning' | 'active'>('planning');

  // Add Task Form States
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState<'todo' | 'in_progress' | 'blocked' | 'done'>('todo');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskIsMilestone, setTaskIsMilestone] = useState(false);
  const [taskDependsOn, setTaskDependsOn] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskTagsInput, setTaskTagsInput] = useState('');
  const [taskEpic, setTaskEpic] = useState('');
  const [taskEstHours, setTaskEstHours] = useState<number | ''>('');
  const [taskLoggedHours, setTaskLoggedHours] = useState<number | ''>('');
  const [taskLinkedDoc, setTaskLinkedDoc] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // Edit Task Form States
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<'todo' | 'in_progress' | 'blocked' | 'done'>('todo');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editIsMilestone, setEditIsMilestone] = useState(false);
  const [editDependsOn, setEditDependsOn] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editEpic, setEditEpic] = useState('');
  const [editEstHours, setEditEstHours] = useState<number | ''>('');
  const [editLoggedHours, setEditLoggedHours] = useState<number | ''>('');
  const [editLinkedDoc, setEditLinkedDoc] = useState('');
  const [taskTab, setTaskTab] = useState<'comments' | 'activity'>('comments');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterEpic, setFilterEpic] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const dragTracker = useRef({ isDragging: false });

  // Fetch Projects List
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects/'),
  });

  const projects = projectsData?.results as Project[] | undefined;

  // Fetch Tasks for Selected Project
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/tasks/`),
    enabled: !!selectedProjectId,
  });

  // Fetch Organization Users for assignee selection
  const { data: users } = useQuery<any[]>({
    queryKey: ['database-users'],
    queryFn: () => api.get('/auth/users/'),
  });

  // Fetch Knowledge Base Documents for linked SOP selection
  const { data: documentsData } = useQuery<any>({
    queryKey: ['knowledge-documents-select'],
    queryFn: () => api.get('/knowledge/documents/'),
  });
  const documents = (documentsData?.results || documentsData || []) as any[];

  // Fetch Meeting Action Items
  const { data: meetingActionsData, refetch: refetchMeetingActions } = useQuery<{ action_items: any[] }>({
    queryKey: ['meeting-action-items'],
    queryFn: () => api.get('/projects/meetings/action-items/'),
    enabled: showMeetingSyncModal,
  });

  // Fetch Task Activity Log
  const { data: activityLog } = useQuery<any[]>({
    queryKey: ['task-activity', viewingTask?.id],
    queryFn: () => api.get(`/projects/tasks/${viewingTask?.id}/activity/`),
    enabled: !!viewingTask?.id && taskTab === 'activity',
  });

  const activeProject = projects?.find(p => p.id === selectedProjectId);
  const canManageTasks = user?.role === 'admin' || (activeProject && activeProject.owner === user?.id);

  // Available tags & epics for filter chips
  const availableTags: string[] = Array.from(new Set((tasks || []).flatMap((t: Task) => t.tags || []))).filter((t): t is string => Boolean(t));
  const availableEpics: string[] = Array.from(new Set((tasks || []).map((t: Task) => t.epic).filter((e): e is string => Boolean(e))));


  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: (newProj: any) => api.post('/projects/', newProj),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowAddProject(false);
      setProjName('');
      setProjDesc('');
      if (res?.id) {
        setSelectedProjectId(res.id);
      }
    },
  });

  // Update Project Mutation
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/projects/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowEditProject(null);
    },
  });

  // Delete Project Mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProjectId(null);
      setShowEditProject(null);
    },
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: (newTask: any) => api.post(`/projects/${selectedProjectId}/tasks/`, newTask),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setShowAddTask(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskStatus('todo');
      setTaskPriority('medium');
      setTaskDueDate('');
      setTaskStartDate('');
      setTaskIsMilestone(false);
      setTaskDependsOn('');
      setTaskAssignee('');
      setTaskTagsInput('');
      setTaskEpic('');
      setTaskEstHours('');
      setTaskLoggedHours('');
      setTaskLinkedDoc('');
    },
  });

  // Update Task Mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/projects/tasks/${id}/`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items'] });
      setViewingTask(null);
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/tasks/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items'] });
      setViewingTask(null);
      setDeleteTaskId(null);
    },
  });

  // Create Comment Mutation
  const createCommentMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      api.post(`/projects/tasks/${taskId}/comments/`, { content }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', variables.taskId] });
      setViewingTask((prev) => {
        if (prev && prev.id === variables.taskId) {
          const comments = prev.comments || [];
          return { ...prev, comments: [...comments, data] };
        }
        return prev;
      });
      setNewCommentText('');
    },
  });

  // Create Subtask Mutation
  const createSubtaskMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) =>
      api.post(`/projects/tasks/${taskId}/subtasks/`, { title }),
    onSuccess: (newSub, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', variables.taskId] });
      setViewingTask((prev) => {
        if (prev && prev.id === variables.taskId) {
          const subs = prev.subtasks || [];
          return { ...prev, subtasks: [...subs, newSub] };
        }
        return prev;
      });
      setNewSubtaskTitle('');
    },
  });

  // Toggle Subtask Mutation
  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) =>
      api.patch(`/projects/subtasks/${subtaskId}/`, { is_done: isDone }),
    onSuccess: (updatedSub) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      if (viewingTask?.id) {
        queryClient.invalidateQueries({ queryKey: ['task-activity', viewingTask.id] });
      }
      setViewingTask((prev) => {
        if (!prev) return null;
        const subs = (prev.subtasks || []).map((s) => (s.id === updatedSub.id ? updatedSub : s));
        return { ...prev, subtasks: subs };
      });
    },
  });

  // Delete Subtask Mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: (subtaskId: string) => api.delete(`/projects/subtasks/${subtaskId}/`),
    onSuccess: (_, subtaskId) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      if (viewingTask?.id) {
        queryClient.invalidateQueries({ queryKey: ['task-activity', viewingTask.id] });
      }
      setViewingTask((prev) => {
        if (!prev) return null;
        const subs = (prev.subtasks || []).filter((s) => s.id !== subtaskId);
        return { ...prev, subtasks: subs };
      });
    },
  });

  // Importer Mutation
  const importMutation = useMutation({
    mutationFn: (payload: any) => api.post('/projects/import/', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (res?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['tasks', res.project_id] });
        setSelectedProjectId(res.project_id);
      }
      setShowImporterModal(false);
      setImportPayloadText('');
      setImportNewProjectName('');
      setImportFileName(null);
    },
  });


  // Import Meeting Action Item Mutation
  const importActionItemMutation = useMutation({
    mutationFn: (payload: any) => api.post('/projects/meetings/import-action-item/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setImportingActionItem(null);
      refetchMeetingActions();
    },
  });

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !viewingTask) return;
    createCommentMutation.mutate({
      taskId: viewingTask.id,
      content: newCommentText.trim(),
    });
  };

  const handleToggleSubtask = (subtaskId: string, currentDone: boolean) => {
    toggleSubtaskMutation.mutate({
      subtaskId,
      isDone: currentDone,
    });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    deleteSubtaskMutation.mutate(subtaskId);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: 'todo' | 'in_progress' | 'blocked' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (user?.role === 'employee' && activeProject?.status !== 'active') {
      return;
    }

    const task = tasks?.find((t: Task) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      if (user?.role === 'employee' && task.assignee !== user.id) {
        return;
      }
      
      updateTaskMutation.mutate({
        id: taskId,
        data: { status: targetStatus },
      });
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    createProjectMutation.mutate({
      name: projName,
      description: projDesc,
      status: projStatus,
    });
  };

  const handleOpenEditProject = (proj: Project) => {
    setShowEditProject(proj);
    setEditProjName(proj.name);
    setEditProjDesc(proj.description);
    setEditProjStatus(proj.status);
  };

  const handleUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjName.trim() || !showEditProject) return;
    updateProjectMutation.mutate({
      id: showEditProject.id,
      data: {
        name: editProjName,
        description: editProjDesc,
        status: editProjStatus,
      },
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const parsedTags = taskTagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc,
      status: taskStatus,
      priority: taskPriority,
      due_date: taskDueDate || null,
      assignee: taskAssignee || null,
      start_date: taskStartDate || null,
      is_milestone: taskIsMilestone,
      depends_on: taskDependsOn || null,
      tags: parsedTags,
      epic: taskEpic.trim(),
      estimated_hours: taskEstHours !== '' ? Number(taskEstHours) : null,
      logged_hours: taskLoggedHours !== '' ? Number(taskLoggedHours) : 0,
      linked_document: taskLinkedDoc || null,
    });
  };

  const handleOpenViewingTask = (task: Task) => {
    setViewingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditStartDate(task.start_date || '');
    setEditIsMilestone(task.is_milestone || false);
    setEditDependsOn(task.depends_on || '');
    setEditAssignee(task.assignee || '');
    setEditTagsInput((task.tags || []).join(', '));
    setEditEpic(task.epic || '');
    setEditEstHours(task.estimated_hours !== undefined && task.estimated_hours !== null ? task.estimated_hours : '');
    setEditLoggedHours(task.logged_hours !== undefined && task.logged_hours !== null ? task.logged_hours : '');
    setEditLinkedDoc(task.linked_document || '');
    setCreatedSOPInfo(null);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !viewingTask) return;

    const parsedTags = editTagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    updateTaskMutation.mutate({
      id: viewingTask.id,
      data: {
        title: editTitle,
        description: editDesc,
        status: editStatus,
        priority: editPriority,
        due_date: editDueDate || null,
        start_date: editStartDate || null,
        is_milestone: editIsMilestone,
        depends_on: editDependsOn || null,
        assignee: editAssignee || null,
        tags: parsedTags,
        epic: editEpic.trim(),
        estimated_hours: editEstHours !== '' ? Number(editEstHours) : null,
        logged_hours: editLoggedHours !== '' ? Number(editLoggedHours) : null,
        linked_document: editLinkedDoc || null,
      },
    });
  };

  const handleDeleteTask = () => {
    if (viewingTask) {
      setDeleteTaskId(viewingTask.id);
      setDeleteTaskTitle(viewingTask.title);
    }
  };

  // AI Sprint Retrospective Trigger
  const handleOpenSprintRetrospective = async () => {
    if (!selectedProjectId) return;
    setShowSprintModal(true);
    setSprintLoading(true);
    setSprintData(null);
    setSprintError(null);
    try {
      const data = await api.post(`/projects/${selectedProjectId}/ai/sprint-summary/`, {});
      setSprintData(data);
    } catch (err: any) {
      console.error(err);
      setSprintError(err?.response?.data?.error || err?.message || 'Failed to generate retrospective.');
    } finally {
      setSprintLoading(false);
    }
  };

  // AI Task Breakdown Trigger
  const handleRunTaskBreakdown = async (title: string, description: string) => {
    if (!title.trim()) {
      coreAlert({
        title: 'Task Title Required',
        description: 'Please enter a task title first before generating an AI breakdown.',
        variant: 'warning',
      });
      return;
    }
    setShowBreakdownModal(true);
    setBreakdownLoading(true);
    setBreakdownItems([]);
    setBreakdownError(null);
    try {
      const data = await api.post('/projects/ai/breakdown/', {
        title,
        description,
        project_id: selectedProjectId,
      });
      setBreakdownItems(data?.breakdown || []);
    } catch (err: any) {
      console.error(err);
      setBreakdownError(err?.response?.data?.error || err?.message || 'Failed to generate task breakdown.');
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleApplySubtasksFromBreakdown = () => {
    if (!viewingTask && !showAddTask) return;

    if (viewingTask) {
      breakdownItems.forEach((item) => {
        createSubtaskMutation.mutate({
          taskId: viewingTask.id,
          title: `${item.title} (${item.estimated_hours}h)`,
        });
      });
    } else if (showAddTask) {
      const checklistText = breakdownItems.map(i => `- [ ] ${i.title} (~${i.estimated_hours}h, ${i.priority})`).join('\n');
      setTaskDesc(prev => prev ? `${prev}\n\n### Subtask Breakdown:\n${checklistText}` : `### Subtask Breakdown:\n${checklistText}`);
      const estTotal = breakdownItems.reduce((acc, curr) => acc + (Number(curr.estimated_hours) || 0), 0);
      if (estTotal > 0) setTaskEstHours(estTotal);
    }
    setShowBreakdownModal(false);
  };

  // Import Action Item from Meeting
  const handleImportMeetingAction = (item: any) => {
    if (!selectedProjectId) return;
    setImportingActionItem(item.id);
    importActionItemMutation.mutate({
      project_id: selectedProjectId,
      meeting_id: item.meeting_id,
      task_text: item.task,
      priority: item.priority || 'medium',
      due_date: item.deadline && !isNaN(Date.parse(item.deadline)) ? item.deadline : null,
    });
  };

  // Handle File Upload for Project Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setImportPayloadText(text);
      if (file.name.toLowerCase().endsWith('.csv')) {
        setImportFormat('csv');
      } else if (file.name.toLowerCase().endsWith('.json')) {
        setImportFormat('json');
      }
    };
    reader.readAsText(file);
  };

  // Run Project/Board Import
  const handleRunImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPayloadText.trim()) return;

    let payload: any = importPayloadText.trim();
    if (importFormat === 'json') {
      try {
        payload = JSON.parse(importPayloadText);
      } catch (err) {
        // Keep as string, backend will handle parsing
      }
    }

    importMutation.mutate({
      format: importFormat,
      data: payload,
      project_id: importTargetProject === 'active' ? selectedProjectId : null,
      project_name: importNewProjectName.trim() || undefined,
    });
  };

  // Drag and Drop Handler for Board/Tasks Importer
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropzone(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setImportPayloadText(text);
      if (file.name.toLowerCase().endsWith('.csv')) {
        setImportFormat('csv');
      } else if (file.name.toLowerCase().endsWith('.json')) {
        setImportFormat('json');
      }
    };
    reader.readAsText(file);
  };

  // Build Markdown Text for Sprint Retrospective
  const buildRetroMarkdown = () => {
    if (!sprintData) return '';
    const proj = activeProject?.name || sprintData.project_name || 'Project';
    const score = sprintData.retrospective?.velocity_score ?? 85;
    const health = (sprintData.retrospective?.health_status || 'on_track').replace('_', ' ').toUpperCase();
    const compRate = sprintData.metrics?.completion_rate ?? 0;
    const doneTasks = sprintData.metrics?.done_tasks ?? 0;
    const totalTasks = sprintData.metrics?.total_tasks ?? 0;
    const logged = sprintData.metrics?.total_logged_hours ?? 0;
    const est = sprintData.metrics?.total_estimated_hours ?? 0;
    const recs = sprintData.retrospective?.recommendations || [];
    const recsMd = recs.length > 0 ? recs.map((r: string) => `- [ ] ${r}`).join('\n') : '- Follow up on next sprint priorities';

    return `# 🚀 Sprint Retrospective & Velocity Report: ${proj}
**Generated:** ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}  
**Velocity Score:** ${score}/100 | **Sprint Health:** ${health}  
**Completion Rate:** ${compRate}% (${doneTasks}/${totalTasks} Tasks) | **Hours Tracking:** ${logged}h logged / ${est}h est.

---

${sprintData.retrospective?.summary_markdown || ''}

---

## 🎯 Key Next-Sprint Action Items
${recsMd}
`;
  };

  // Export Sprint Retrospective as Markdown (.md)
  const handleExportRetroMarkdown = () => {
    const md = buildRetroMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (activeProject?.name || 'Sprint').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.setAttribute('download', `Sprint_Retrospective_${safeName}_${new Date().toISOString().split('T')[0]}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Sprint Retrospective Markdown to Clipboard
  const handleCopyRetroMarkdown = async () => {
    const md = buildRetroMarkdown();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopiedRetro(true);
      setTimeout(() => setCopiedRetro(false), 2500);
    } catch (err) {
      console.error('Failed to copy retrospective markdown', err);
    }
  };

  // Print / PDF Export for Sprint Retrospective
  const handlePrintRetro = () => {
    const printContent = document.getElementById('sprint-retro-printable');
    if (!printContent) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Sprint Retrospective - ${activeProject?.name || 'Report'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #1e293b; line-height: 1.6; }
            h1, h2, h3 { color: #0f172a; margin-top: 24px; margin-bottom: 8px; }
            .metrics { display: flex; gap: 16px; margin: 20px 0; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; background: #f8fafc; flex: 1; }
            .metric-val { font-size: 20px; font-weight: bold; color: #4f46e5; }
            hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }
            ul { padding-left: 20px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>🚀 Sprint Retrospective: ${activeProject?.name || 'Project'}</h1>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Create Knowledge Base SOP directly from Task
  const handleCreateSOPFromTask = async () => {
    if (!viewingTask) return;
    setIsCreatingSOP(true);
    try {
      const subtasksList = (viewingTask.subtasks || [])
        .map((s, idx) => `${idx + 1}. [ ] **${s.title}**`)
        .join('\n');

      const sopMarkdown = `# Standard Operating Procedure: ${viewingTask.title}

**Document Category:** Standard Operating Procedure (SOP) / Wiki  
**Project Scope:** ${activeProject?.name || 'Engineering Operations'}  
**Task Reference ID:** \`${viewingTask.id}\`  
**Priority Level:** ${(viewingTask.priority || 'medium').toUpperCase()}  
**Assignee / Lead:** ${viewingTask.assignee_name || 'Unassigned'}  
**Estimated Time:** ${viewingTask.estimated_hours ? `${viewingTask.estimated_hours} Hours` : 'Standard Work Unit'}  
**Created On:** ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}

---

## 1. Objective & Operational Overview
${viewingTask.description || 'Standard operational procedure and execution guidelines for this task deliverable.'}

---

## 2. Standard Step-by-Step Procedure & Checklist
${subtasksList || '1. [ ] Review architectural prerequisites and environment configuration.\n2. [ ] Execute core implementation and verify unit test coverage.\n3. [ ] Conduct peer code review and security validation.\n4. [ ] Deploy to staging environment and execute end-to-end smoke test.\n5. [ ] Release to production and monitor real-time observability telemetry.'}

---

## 3. Quality Assurance & Acceptance Criteria
- [ ] All specified acceptance requirements verified in staging.
- [ ] Error logging, telemetry metrics, and alerting alarms configured.
- [ ] Documentation updated and synced across team repository.
`;

      const res = await api.post('/knowledge/wiki/article/', {
        title: `SOP: ${viewingTask.title}`,
        content: sopMarkdown,
        category: 'SOP',
        allowed_roles: 'admin,hr,manager,employee',
      });

      const docId = res.data.id;
      const docTitle = res.data.title;

      // Link newly created SOP document to the task
      await api.patch(`/projects/tasks/${viewingTask.id}/`, {
        linked_document: docId,
      });

      setEditLinkedDoc(docId);
      setCreatedSOPInfo({ id: docId, title: docTitle });
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err) {
      console.error('Failed to create SOP from task', err);
    } finally {
      setIsCreatingSOP(false);
    }
  };



  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'planning':
        return <HelpCircle className="h-4 w-4 text-blue-500" />;
      case 'active':
        return <PlayCircle className="h-4 w-4 text-emerald-500" />;
      case 'done':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'on_hold':
        return <Calendar className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <FolderGit2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Projects & Execution Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Linear-grade Kanban, Gantt timelines, AI Sprint Retrospectives, SOP sync, and 1-click meeting item conversion.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {user?.role !== 'employee' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImporterModal(true)}
              className="h-9 text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5 text-primary" />
              Import Board
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchProjects()}
            className="h-9 text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Projects Left Sidebar Column (1/3 width) */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-bold">Projects Directory</CardTitle>
              {user?.role !== 'employee' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddProject(!showAddProject)}
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {showAddProject && (
                <form onSubmit={handleCreateProject} className="p-3 border border-border rounded-xl bg-slate-50 dark:bg-slate-950/40 space-y-3 mb-2 animate-in slide-in-from-top duration-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Project Name</label>
                    <Input
                      placeholder="Project Alpha"
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      required
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
                    <textarea
                      placeholder="Goal description..."
                      value={projDesc}
                      onChange={(e) => setProjDesc(e.target.value)}
                      className="w-full text-xs min-h-[60px] rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs font-semibold" disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </form>
              )}

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {projectsLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : projects && projects.length > 0 ? (
                  projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`w-full text-left p-3 border rounded-xl flex flex-col gap-1 transition-all ${
                        selectedProjectId === proj.id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                          : 'border-border bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {proj.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {(user?.role === 'admin' || proj.owner === user?.id) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditProject(proj);
                                }}
                                className="h-6 w-6 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-md p-0"
                                title="Edit project settings"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteProjectId(proj.id);
                                  setDeleteProjectName(proj.name);
                                }}
                                className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md p-0"
                                title="Delete project"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {getStatusIcon(proj.status)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {proj.description || 'No description provided.'}
                      </p>

                      <div className="space-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                          <span>{proj.completed_count || 0}/{proj.task_count || 0} Tasks Done</span>
                          {proj.overdue_count ? (
                            <span className="text-red-500 font-extrabold flex items-center gap-0.5">
                              {proj.overdue_count} Overdue
                            </span>
                          ) : null}
                          <span>
                            {proj.task_count ? Math.round((proj.completed_count || 0) / proj.task_count * 100) : 0}%
                          </span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${proj.task_count ? Math.round((proj.completed_count || 0) / proj.task_count * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-8">No active projects found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Board Right Columns (2/3 width) */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900 min-h-[500px]">
            <CardHeader className="border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-primary" />
                  Workspace Tasks
                </CardTitle>
                {selectedProjectId && (
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-slate-50 dark:bg-slate-900 shrink-0">
                    <button
                      onClick={() => setViewMode('board')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        viewMode === 'board'
                          ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-sm border border-border'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Kanban Board
                    </button>
                    <button
                      onClick={() => setViewMode('gantt')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        viewMode === 'gantt'
                          ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-sm border border-border'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Gantt Timeline
                    </button>
                  </div>
                )}
              </div>

              {selectedProjectId && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sprint Retrospective AI Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenSprintRetrospective}
                    className="h-8 font-semibold text-xs border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                    Sprint Retrospective
                  </Button>

                  {/* Import Meeting Action Items */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMeetingSyncModal(true)}
                    className="h-8 font-semibold text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    Sync Meeting Items
                  </Button>

                  {canManageTasks && (
                    <Button
                      size="sm"
                      onClick={() => setShowAddTask(true)}
                      className="gap-1.5 h-8 font-semibold text-xs bg-primary text-white hover:bg-primary/95 shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Add Task
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {selectedProjectId ? (
                tasksLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Filters Toolbar */}
                    <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between pb-3 border-b border-border flex-wrap">
                      <div className="flex flex-1 w-full md:w-auto items-center gap-2">
                        <Input
                          placeholder="Search tasks, epics, tags..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="h-8 text-xs max-w-xs"
                        />
                      </div>
                      <div className="flex w-full md:w-auto items-center gap-2 justify-end flex-wrap">
                        {/* Tag Filter */}
                        {availableTags.length > 0 && (
                          <select
                            value={filterTag}
                            onChange={(e) => setFilterTag(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
                          >
                            <option value="all">All Tags</option>
                            {availableTags.map((tag) => (
                              <option key={tag} value={tag}>
                                #{tag}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Epic Filter */}
                        {availableEpics.length > 0 && (
                          <select
                            value={filterEpic}
                            onChange={(e) => setFilterEpic(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
                          >
                            <option value="all">All Epics</option>
                            {availableEpics.map((epic) => (
                              <option key={epic} value={epic}>
                                [{epic}]
                              </option>
                            ))}
                          </select>
                        )}

                        <select
                          value={filterAssignee}
                          onChange={(e) => setFilterAssignee(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[110px]"
                        >
                          <option value="all">All Assignees</option>
                          <option value="unassigned">Unassigned</option>
                          {users?.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.first_name} {u.last_name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filterPriority}
                          onChange={(e) => setFilterPriority(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
                        >
                          <option value="all">All Priorities</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[110px]"
                        >
                          <option value="due_date">Sort: Due Date</option>
                          <option value="priority">Sort: Priority</option>
                          <option value="alphabetical">Sort: Alphabetical</option>
                        </select>
                        {(filterSearch || filterAssignee !== 'all' || filterPriority !== 'all' || filterTag !== 'all' || filterEpic !== 'all') && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setFilterSearch('');
                              setFilterAssignee('all');
                              setFilterPriority('all');
                              setFilterTag('all');
                              setFilterEpic('all');
                            }}
                            className="h-8 px-2 text-xs font-semibold hover:bg-slate-100"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>

                    {viewMode === 'board' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        {/* Columns: To Do, In Progress, Blocked, Done */}
                        {[
                          { id: 'todo', title: 'To Do', color: 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400' },
                          { id: 'in_progress', title: 'In Progress', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400' },
                          { id: 'blocked', title: 'Blocked', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20' },
                          { id: 'done', title: 'Done', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' },
                        ].map((col) => {
                          const columnTasks = tasks?.filter((t: Task) => {
                            if (!canManageTasks && t.assignee !== user?.id) return false;
                            if (t.status !== col.id) return false;

                            if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
                            if (filterAssignee !== 'all') {
                              if (filterAssignee === 'unassigned') {
                                if (t.assignee) return false;
                              } else {
                                if (t.assignee !== filterAssignee) return false;
                              }
                            }
                            if (filterTag !== 'all' && !(t.tags || []).includes(filterTag)) return false;
                            if (filterEpic !== 'all' && t.epic !== filterEpic) return false;

                            if (filterSearch.trim()) {
                              const s = filterSearch.toLowerCase();
                              const matchTitle = t.title.toLowerCase().includes(s);
                              const matchEpic = (t.epic || '').toLowerCase().includes(s);
                              const matchTag = (t.tags || []).some(tg => tg.toLowerCase().includes(s));
                              if (!matchTitle && !matchEpic && !matchTag) return false;
                            }

                            return true;
                          }) || [];

                          const sortedTasks = [...columnTasks].sort((a, b) => {
                            if (sortBy === 'due_date') {
                              if (!a.due_date) return 1;
                              if (!b.due_date) return -1;
                              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                            }
                            if (sortBy === 'priority') {
                              const PRIO_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
                              return (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0);
                            }
                            if (sortBy === 'alphabetical') {
                              return a.title.localeCompare(b.title);
                            }
                            return 0;
                          });

                          return (
                            <div key={col.id} className="space-y-3">
                              {/* Column Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-border">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${col.color}`}>
                                    {col.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-bold">
                                    {sortedTasks.length}
                                  </span>
                                </div>
                              </div>

                              {/* Task Cards Stack */}
                              <div 
                                onDragOver={handleDragOver}
                                onDragEnter={() => setDragOverCol(col.id)}
                                onDragLeave={() => setDragOverCol((prev) => prev === col.id ? null : prev)}
                                onDrop={(e) => {
                                  handleDrop(e, col.id as any);
                                  setDragOverCol(null);
                                }}
                                className={`space-y-3 min-h-[420px] p-2 rounded-xl border transition-all ${
                                  dragOverCol === col.id 
                                    ? 'border-primary border-solid bg-primary/5 dark:bg-primary/10 shadow-sm' 
                                    : 'border-dashed border-border bg-slate-50/40 dark:bg-slate-950/10'
                                }`}
                              >
                                {sortedTasks.length > 0 ? (
                                  sortedTasks.map((task: Task) => {
                                    const isDraggable = user?.role !== 'employee' || (activeProject?.status === 'active' && task.assignee === user?.id);
                                    
                                    const prioBorder = task.priority === 'critical' ? 'border-l-4 border-l-red-500' :
                                                       task.priority === 'high' ? 'border-l-4 border-l-orange-500' :
                                                       task.priority === 'medium' ? 'border-l-4 border-l-blue-500' :
                                                       'border-l-4 border-l-slate-400';

                                    return (
                                      <div
                                        key={task.id}
                                        draggable={isDraggable}
                                        onDragStart={(e) => {
                                          handleDragStart(e, task.id);
                                          dragTracker.current.isDragging = true;
                                        }}
                                        onDragEnd={() => {
                                          setTimeout(() => {
                                            dragTracker.current.isDragging = false;
                                          }, 50);
                                        }}
                                        onClick={() => {
                                          if (!dragTracker.current.isDragging) {
                                            handleOpenViewingTask(task);
                                          }
                                        }}
                                        className={`p-3 border border-border rounded-xl bg-white dark:bg-slate-900 hover:border-primary/50 hover:shadow-sm transition-all space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none ${prioBorder} ${
                                          isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                        }`}
                                      >
                                        {/* Epic & Priority Badges */}
                                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                          {task.epic ? (
                                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200/50">
                                              [{task.epic}]
                                            </span>
                                          ) : <span />}

                                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 border ${
                                            task.priority === 'critical'
                                              ? 'bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 border-red-200/50'
                                              : task.priority === 'high'
                                              ? 'bg-orange-50 text-orange-655 dark:bg-orange-950/20 dark:text-orange-400 border-orange-200/50'
                                              : task.priority === 'medium'
                                              ? 'bg-blue-50 text-blue-650 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/50'
                                              : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
                                          }`}>
                                            {task.priority}
                                          </span>
                                        </div>

                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug text-left">
                                          {task.is_milestone ? '◆ ' : ''}{task.title}
                                        </div>

                                        {task.description && (
                                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed text-left">
                                            {task.description}
                                          </p>
                                        )}

                                        {/* Tags & Cross-Panel Links */}
                                        {( (task.tags && task.tags.length > 0) || task.linked_document_title || task.linked_meeting_title ) && (
                                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            {task.tags?.map((tg, i) => (
                                              <span key={i} className="text-[8px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                                #{tg}
                                              </span>
                                            ))}
                                            {task.linked_document_title && (
                                              <span className="text-[8px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-emerald-200/40">
                                                <FileText className="h-2.5 w-2.5" /> SOP Linked
                                              </span>
                                            )}
                                            {task.linked_meeting_title && (
                                              <span className="text-[8px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-amber-200/40">
                                                <TrendingUp className="h-2.5 w-2.5" /> Meeting Item
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Inline Subtasks Checklist Progress Bar */}
                                        {task.subtasks && task.subtasks.length > 0 && (() => {
                                          const doneCount = task.subtasks.filter(s => s.is_done).length;
                                          const totalCount = task.subtasks.length;
                                          const pct = Math.round((doneCount / totalCount) * 100);
                                          return (
                                            <div className="pt-0.5 text-[9px] space-y-1">
                                              <div className="flex justify-between items-center text-muted-foreground font-semibold">
                                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                                                  <CheckSquare className="h-2.5 w-2.5 text-primary" /> Subtasks ({doneCount}/{totalCount})
                                                </span>
                                                <span className={`text-[8px] font-bold ${doneCount === totalCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                                  {pct}%
                                                </span>
                                              </div>
                                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full transition-all duration-300 ${
                                                    doneCount === totalCount
                                                      ? 'bg-emerald-500'
                                                      : doneCount > 0
                                                      ? 'bg-indigo-500'
                                                      : 'bg-slate-300 dark:bg-slate-600'
                                                  }`}
                                                  style={{ width: `${pct}%` }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        {/* Time Tracking Progress Indicator */}
                                        {(task.estimated_hours || task.logged_hours) && (
                                          <div className="pt-1 text-[9px] space-y-1">
                                            <div className="flex justify-between text-muted-foreground font-semibold">
                                              <span className="flex items-center gap-1">
                                                <Clock className="h-2.5 w-2.5" /> {task.logged_hours || 0}h logged
                                              </span>
                                              <span>{task.estimated_hours ? `${task.estimated_hours}h est.` : ''}</span>
                                            </div>
                                            {task.estimated_hours && (
                                              <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full transition-all ${
                                                    (task.logged_hours || 0) > task.estimated_hours
                                                      ? 'bg-rose-500'
                                                      : 'bg-primary'
                                                  }`}
                                                  style={{
                                                    width: `${Math.min(((task.logged_hours || 0) / task.estimated_hours) * 100, 100)}%`,
                                                  }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <div className="border-t border-border pt-2 flex items-center justify-between text-[9px] font-semibold text-slate-500">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="truncate max-w-[85px] flex items-center gap-1">
                                              <User className="h-2.5 w-2.5" /> {task.assignee_name || 'Unassigned'}
                                            </span>
                                            {task.assignee_ooo_info && (
                                              <span 
                                                title={`Assignee on approved ${task.assignee_ooo_info.leave_type.replace('_', ' ')} (${task.assignee_ooo_info.start_date} to ${task.assignee_ooo_info.end_date})`}
                                                className="text-[7.5px] font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/50 flex items-center gap-0.5 shrink-0"
                                              >
                                                🏖️ OOO
                                              </span>
                                            )}
                                          </div>
                                          {task.due_date && (
                                            (() => {
                                              const isOverdue = task.status !== 'done' && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                                              return (
                                                <span className={`flex items-center gap-1 shrink-0 px-1 py-0.5 rounded text-[8px] font-bold ${
                                                  isOverdue 
                                                    ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200/50 dark:border-red-900/50' 
                                                    : 'text-slate-500'
                                                }`}>
                                                  <Calendar className="h-2.5 w-2.5" /> {new Date(task.due_date).toLocaleDateString()}
                                                  {isOverdue && <span className="ml-0.5 text-[7px] uppercase tracking-wider font-extrabold text-red-650 dark:text-red-400">Overdue</span>}
                                                </span>
                                              );
                                            })()
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="flex h-32 flex-col items-center justify-center text-center text-muted-foreground">
                                    <span className="text-[10px] font-semibold">No tasks in this lane</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <GanttView 
                        tasks={tasks || []} 
                        onOpenTask={(task) => handleOpenViewingTask(task)} 
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground gap-2">
                  <FolderGit2 className="h-8 w-8 text-slate-300" />
                  <span className="text-xs">Select a project from the directory list to display its operational task board.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          AI SPRINT RETROSPECTIVE & VELOCITY MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={showSprintModal} onOpenChange={setShowSprintModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              AI Sprint Retrospective & Velocity Analysis
            </DialogTitle>
            {sprintData && (
              <div className="flex items-center gap-1.5 pr-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRetroMarkdown}
                  className="h-8 text-xs font-semibold gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Copy formatted Markdown report to clipboard"
                >
                  {copiedRetro ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedRetro ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportRetroMarkdown}
                  className="h-8 text-xs font-semibold gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Download report as Markdown (.md) file"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  Export .MD
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrintRetro}
                  className="h-8 text-xs font-semibold gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Print or save as PDF"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  Print / PDF
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-5 py-3">
            {sprintLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">
                  Synthesizing project velocity, blockers, and milestone progress with AI...
                </p>
              </div>
            ) : sprintData ? (
              <div id="sprint-retro-printable" className="space-y-5">
                {/* Metric Summary Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Velocity Score</span>
                    <div className="text-xl font-extrabold text-primary mt-0.5">
                      {sprintData.retrospective?.velocity_score ?? 85}/100
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Sprint Health</span>
                    <div className={`text-xs font-bold uppercase mt-1.5 px-2 py-0.5 rounded-full inline-block border ${
                      sprintData.retrospective?.health_status === 'on_track'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sprintData.retrospective?.health_status === 'at_risk'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {(sprintData.retrospective?.health_status || 'on_track').replace('_', ' ')}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Completion Rate</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {sprintData.metrics?.completion_rate}%
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {sprintData.metrics?.done_tasks}/{sprintData.metrics?.total_tasks} Tasks Done
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Hours Tracking</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {sprintData.metrics?.total_logged_hours}h / {sprintData.metrics?.total_estimated_hours}h
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      Logged vs Estimated
                    </span>
                  </div>
                </div>

                {/* Retrospective Markdown Report */}
                <div className="p-4 rounded-xl border border-border bg-slate-50/40 dark:bg-slate-950/20 prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sprintData.retrospective?.summary_markdown || 'No summary available.'}
                  </ReactMarkdown>
                </div>

                {/* Recommendations */}
                {sprintData.retrospective?.recommendations && sprintData.retrospective.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" /> Key Next-Sprint Action Items
                    </h4>
                    <div className="space-y-1.5">
                      {sprintData.retrospective.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300">
                          <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                {sprintError || 'Failed to generate retrospective.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MEETING ACTION ITEMS SYNC MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={showMeetingSyncModal} onOpenChange={setShowMeetingSyncModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Convert Meeting Action Items into Project Tasks
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-muted-foreground">
              Directly import action items generated by the Executive AI Meeting Assistant into <strong>{activeProject?.name || 'this project'}</strong>.
            </p>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {meetingActionsData?.action_items && meetingActionsData.action_items.length > 0 ? (
                meetingActionsData.action_items.map((item: any) => (
                  <div key={item.id} className="p-3 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                    <div className="space-y-1 min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                          {item.meeting_title}
                        </span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                          item.priority === 'high' ? 'bg-red-50 text-red-600 border-red-200' :
                          item.priority === 'medium' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                        {item.task}
                      </p>
                      {item.owner && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="h-2.5 w-2.5" /> Owner: {item.owner} {item.deadline ? `• Due: ${item.deadline}` : ''}
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleImportMeetingAction(item)}
                      disabled={importingActionItem === item.id || importActionItemMutation.isPending}
                      className="h-8 text-xs font-semibold shrink-0 gap-1"
                    >
                      {importingActionItem === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" /> Import
                        </>
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No unimported meeting action items found in your organization.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          PROJECT & TASK IMPORTER (JSON / CSV) MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={showImporterModal} onOpenChange={setShowImporterModal}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UploadCloud className="h-5 w-5 text-primary" />
              Import Project & Task Data
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRunImport} className="space-y-4 py-3">
            {/* Format Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Data Format</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportFormat('json')}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    importFormat === 'json'
                      ? 'bg-primary/10 border-primary text-primary shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:border-primary/40'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5" /> JSON Dataset
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Standard JSON objects, card lists, issue trees, or exported datasets
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setImportFormat('csv')}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    importFormat === 'csv'
                      ? 'bg-primary/10 border-primary text-primary shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:border-primary/40'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> CSV Spreadsheet
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Tabular format with Title, Description, Priority, Due Date, and Hours
                  </div>
                </button>
              </div>
            </div>

            {/* Drag-and-Drop Dropzone & File Selector */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverDropzone(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragOverDropzone(true);
              }}
              onDragLeave={() => setIsDragOverDropzone(false)}
              onDrop={handleDropFile}
              className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-2 ${
                isDragOverDropzone
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border bg-slate-50/60 dark:bg-slate-900/40 hover:border-primary/50'
              }`}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                {importFileName ? (
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Loaded: {importFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFileName(null);
                        setImportPayloadText('');
                      }}
                      className="text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors"
                      title="Clear loaded file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Drag & drop your <strong>.json</strong> or <strong>.csv</strong> file here
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      or click below to browse from your computer
                    </p>
                  </>
                )}
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 border border-border transition-colors shadow-2xs mt-0.5">
                Browse File
                <input
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Destination Project */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Destination Project</label>
              <select
                value={importTargetProject}
                onChange={(e) => setImportTargetProject(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold"
              >
                <option value="new">Create as New Project</option>
                {selectedProjectId && (
                  <option value="active">Import into currently active project ({activeProject?.name})</option>
                )}
              </select>
            </div>

            {importTargetProject === 'new' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">New Project Name (Optional)</label>
                <Input
                  placeholder="e.g. Q4 Infrastructure Migration"
                  value={importNewProjectName}
                  onChange={(e) => setImportNewProjectName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {/* Paste Payload Area */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                Paste or Edit {importFormat.toUpperCase()} Data
              </label>
              <textarea
                required
                value={importPayloadText}
                onChange={(e) => setImportPayloadText(e.target.value)}
                rows={7}
                placeholder={
                  importFormat === 'csv'
                    ? 'Title,Description,Priority,Estimated Hours,Epic\nSetup Route53,Latency-based DNS failover,High,4.0,Infrastructure\nRedis Caching,Semantic cache layer,Medium,6.0,Backend'
                    : '[\n  {\n    "title": "Configure Multi-Region Routing",\n    "description": "Set up latency routing and health checks",\n    "priority": "high",\n    "estimated_hours": 4.0\n  }\n]'
                }
                className="w-full text-xs font-mono rounded-lg border border-input bg-white dark:bg-slate-950 p-3 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {importMutation.error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20 border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{extractErrorMessage(importMutation.error)}</p>
              </div>
            )}

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowImporterModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={importMutation.isPending || !importPayloadText.trim()} className="font-semibold gap-1.5">
                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                Import Tasks
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          AI TASK BREAKDOWN MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={showBreakdownModal} onOpenChange={setShowBreakdownModal}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Zap className="h-5 w-5 text-amber-500 animate-pulse" />
              AI Task Breakdown & Subtask Architect
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {breakdownLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-semibold">
                  Generating modular subtasks, role assignments, and hours estimates...
                </p>
              </div>
            ) : breakdownItems.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  AI generated {breakdownItems.length} actionable engineering subtasks. Click "Apply to Task" to import them.
                </p>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {breakdownItems.map((item, idx) => (
                    <div key={idx} className="p-3 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {idx + 1}. {item.title}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {item.estimated_hours}h • {item.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500 pt-1">
                        <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Role: {item.suggested_role}
                        </span>
                        {item.tags?.map((tg: string, i: number) => (
                          <span key={i} className="text-primary">
                            #{tg}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <DialogFooter className="pt-3 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowBreakdownModal(false)}>
                    Close
                  </Button>
                  <Button type="button" size="sm" onClick={handleApplySubtasksFromBreakdown} className="font-semibold gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" /> Apply All Subtasks
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                {breakdownError || 'No breakdown available.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          ADD TASK DIALOG
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Log Operational Task</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRunTaskBreakdown(taskTitle, taskDesc)}
                disabled={!taskTitle.trim()}
                className="h-7 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 gap-1 mr-6"
              >
                <Sparkles className="h-3 w-3" /> AI Breakdown
              </Button>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-3">
            {createTaskMutation.error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{extractErrorMessage(createTaskMutation.error)}</p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Task Title</label>
              <Input
                required
                placeholder="Log celery pipeline worker..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Description</label>
              <textarea
                placeholder="Task description details..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Epic / Feature Group</label>
                <Input
                  placeholder="e.g. Authentication, Billing"
                  value={taskEpic}
                  onChange={(e) => setTaskEpic(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Tags (comma-separated)</label>
                <Input
                  placeholder="Frontend, Bug, Security"
                  value={taskTagsInput}
                  onChange={(e) => setTaskTagsInput(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e: any) => setTaskPriority(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Status</label>
                <select
                  value={taskStatus}
                  onChange={(e: any) => setTaskStatus(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Estimated Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 8.0"
                  value={taskEstHours}
                  onChange={(e) => setTaskEstHours(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Logged Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 0.0"
                  value={taskLoggedHours}
                  onChange={(e) => setTaskLoggedHours(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Linked Knowledge Base SOP / Document
              </label>
              <select
                value={taskLinkedDoc}
                onChange={(e) => setTaskLinkedDoc(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No Linked Document</option>
                {documents.map((doc: any) => (
                  <option key={doc.id} value={doc.id}>
                    📄 {doc.title} {doc.category ? `(${doc.category})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Start Date</label>
                <Input
                  type="date"
                  value={taskStartDate}
                  onChange={(e) => setTaskStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Due Date</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Assignee</label>
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {users?.filter((u) => {
                    const userRank = user ? ROLE_RANK[user.role] : 0;
                    const assigneeRank = ROLE_RANK[u.role] || 0;
                    return assigneeRank <= userRank;
                  }).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Depends On</label>
                <select
                  value={taskDependsOn}
                  onChange={(e) => setTaskDependsOn(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">No Dependency</option>
                  {tasks?.map((t: Task) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 py-1 select-none">
              <input
                type="checkbox"
                id="taskIsMilestone"
                checked={taskIsMilestone}
                onChange={(e) => setTaskIsMilestone(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label htmlFor="taskIsMilestone" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-350 cursor-pointer">
                Is Milestone (Renders as milestone marker)
              </label>
            </div>

            {createTaskMutation.error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20 border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{extractErrorMessage(createTaskMutation.error)}</p>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" className="w-full font-semibold" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? 'Logging Task...' : 'Log Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ─────────────────────────────────────────────────────────────
          TASK CONFIGURATION FULL DRAWER / MODAL
          ───────────────────────────────────────────────────────────── */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      Task Configuration
                    </h2>
                    {activeProject && (
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-muted-foreground px-2 py-0.5 rounded-md font-medium truncate max-w-[180px]">
                        {activeProject.name}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      editStatus === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50' :
                      editStatus === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50' :
                      editStatus === 'blocked' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-900/50' :
                      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}>
                      {editStatus.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      editPriority === 'critical' ? 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-950/30' :
                      editPriority === 'high' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-950/30' :
                      editPriority === 'medium' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-950/30' :
                      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}>
                      {editPriority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Configure task parameters, SOP attachments, subtask checklist, and team discussions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCreatingSOP}
                  onClick={handleCreateSOPFromTask}
                  className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 gap-1.5"
                  title="Convert this task and subtask checklist into a Knowledge Base SOP"
                >
                  {isCreatingSOP ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" />
                  )}
                  {isCreatingSOP ? 'Generating SOP...' : 'Create SOP'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRunTaskBreakdown(editTitle, editDesc)}
                  className="h-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI Break Down
                </Button>
                <button
                  type="button"
                  onClick={() => setViewingTask(null)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body Form */}
            <form id="task-config-form" onSubmit={handleUpdateTask} className="flex-1 overflow-y-auto p-6">
              {updateTaskMutation.error && (
                <div className="mb-5 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{extractErrorMessage(updateTaskMutation.error)}</p>
                </div>
              )}

              {user?.role === 'employee' && activeProject?.status !== 'active' && (
                <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>Tasks are locked. You can only update task status when the project is Active.</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* ── LEFT COLUMN: Task Content & Collaboration (7 Cols) ── */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Created SOP Notification Banner */}
                  {createdSOPInfo && (
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                          SOP Published & Linked: <strong>{createdSOPInfo.title}</strong>
                        </span>
                      </div>
                      <a
                        href="/knowledge"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        View Wiki <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* Out-of-Office Blocker Warning Banner with 1-Click Reassign */}
                  {viewingTask.assignee_ooo_info && (
                    <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/30 text-xs flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-200">
                            Assignee on Leave ({viewingTask.assignee_ooo_info.start_date} to {viewingTask.assignee_ooo_info.end_date})
                          </span>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300">
                            {viewingTask.assignee_name} is on approved {viewingTask.assignee_ooo_info.leave_type.replace('_', ' ')}.
                          </p>
                        </div>
                      </div>
                      {viewingTask.assignee_ooo_info.manager_user_id && canManageTasks && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditAssignee(viewingTask.assignee_ooo_info!.manager_user_id!);
                            updateTaskMutation.mutate({
                              id: viewingTask.id,
                              data: { assignee: viewingTask.assignee_ooo_info!.manager_user_id! },
                            });
                          }}
                          className="h-7 text-[10px] font-bold bg-amber-100/80 dark:bg-amber-900/40 hover:bg-amber-200 border-amber-300 text-amber-900 dark:text-amber-200"
                        >
                          Reassign to Manager ({viewingTask.assignee_ooo_info.manager_name})
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Task Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={!canManageTasks}
                      placeholder="e.g. Implement authentication flow"
                      className="text-sm font-semibold h-10"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Description & Requirements
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      disabled={!canManageTasks}
                      placeholder="Add specifications, acceptance criteria, or context for this task..."
                      rows={3}
                      className="w-full text-xs rounded-lg border border-input bg-white dark:bg-slate-950 p-3 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[85px] resize-y"
                    />
                  </div>

                  {/* Linked Meeting Banner (if imported) */}
                  {viewingTask.linked_meeting_title && (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-amber-900 dark:text-amber-200">
                          Synced from Meeting: {viewingTask.linked_meeting_title}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Subtasks / Checklist Section */}
                  <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Checklist & Subtasks
                        </span>
                      </div>
                      {viewingTask?.subtasks && viewingTask.subtasks.length > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                          {viewingTask.subtasks.filter(s => s.is_done).length} / {viewingTask.subtasks.length} Completed ({Math.round((viewingTask.subtasks.filter(s => s.is_done).length / viewingTask.subtasks.length) * 100)}%)
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {viewingTask?.subtasks && viewingTask.subtasks.length > 0 && (
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{
                            width: `${(viewingTask.subtasks.filter(s => s.is_done).length / viewingTask.subtasks.length) * 100}%`
                          }}
                        />
                      </div>
                    )}

                    {/* Subtask list */}
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {viewingTask?.subtasks && viewingTask.subtasks.length > 0 ? (
                        viewingTask.subtasks.map((sub) => {
                          const isSubtaskEditable = user?.role !== 'employee' || (activeProject?.status === 'active' && viewingTask.assignee === user?.id);
                          return (
                            <div key={sub.id} className="flex items-center justify-between gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-border group hover:border-primary/40 transition-colors">
                              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={sub.is_done}
                                  disabled={!isSubtaskEditable}
                                  onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className={`text-xs font-medium truncate ${sub.is_done ? 'line-through text-muted-foreground' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {sub.title}
                                </span>
                              </label>
                              {isSubtaskEditable && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteSubtask(sub.id)}
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-2">
                          No subtask items added yet.
                        </p>
                      )}
                    </div>

                    {/* Add subtask field */}
                    {(user?.role !== 'employee' || (activeProject?.status === 'active' && viewingTask?.assignee === user?.id)) && (
                      <div className="flex gap-2 items-center pt-1">
                        <Input
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          placeholder="Add a new checklist item..."
                          className="h-8 text-xs flex-1 bg-white dark:bg-slate-900"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newSubtaskTitle.trim() && viewingTask) {
                                createSubtaskMutation.mutate({
                                  taskId: viewingTask.id,
                                  title: newSubtaskTitle.trim(),
                                });
                                setNewSubtaskTitle('');
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-3 font-semibold text-xs shrink-0"
                          disabled={createSubtaskMutation.isPending || !newSubtaskTitle.trim()}
                          onClick={() => {
                            if (viewingTask && newSubtaskTitle.trim()) {
                              createSubtaskMutation.mutate({
                                taskId: viewingTask.id,
                                title: newSubtaskTitle.trim(),
                              });
                              setNewSubtaskTitle('');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Collaboration & Activity Feed Section */}
                  <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex gap-4 border-b border-border pb-2">
                      <button
                        type="button"
                        onClick={() => setTaskTab('comments')}
                        className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                          taskTab === 'comments'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Comments ({viewingTask?.comments?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskTab('activity')}
                        className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                          taskTab === 'activity'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Activity className="h-3.5 w-3.5" /> Activity History
                      </button>
                    </div>

                    {taskTab === 'comments' ? (
                      <div className="space-y-3">
                        {createCommentMutation.error && (
                          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <p>{extractErrorMessage(createCommentMutation.error)}</p>
                          </div>
                        )}
                        
                        <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                          {viewingTask?.comments && viewingTask.comments.length > 0 ? (
                            viewingTask.comments.map((comment) => (
                              <div key={comment.id} className="text-xs p-3 bg-white dark:bg-slate-900 rounded-lg border border-border shadow-2xs space-y-1">
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                                  <span className="text-slate-900 dark:text-white font-bold">{comment.author_name}</span>
                                  <span>{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic text-center py-3">No comments posted yet. Start the conversation below.</p>
                          )}
                        </div>

                        <div className="flex gap-2 items-end pt-1">
                          <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write a comment or update (Ctrl+Enter to send)..."
                            rows={2}
                            className="flex-1 text-xs rounded-lg border border-input bg-white dark:bg-slate-900 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleCreateComment(e);
                              }
                            }}
                          />
                          <Button 
                            type="button"
                            onClick={handleCreateComment}
                            size="sm" 
                            disabled={createCommentMutation.isPending || !newCommentText.trim()}
                            className="h-10 px-4 font-semibold text-xs shrink-0"
                          >
                            {createCommentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {activityLog && activityLog.length > 0 ? (
                          activityLog.map((log) => (
                            <div key={log.id} className="text-xs flex gap-2.5 items-start p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-border">
                              <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5 text-[10px] text-muted-foreground font-semibold">
                                  <span className="text-slate-900 dark:text-white font-bold">{log.actor_name}</span>
                                  <span>{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 font-medium">{log.detail}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic text-center py-4">No activity history recorded.</p>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* ── RIGHT COLUMN: Configuration Sidebar (5 Cols) ── */}
                <div className="lg:col-span-5 space-y-4">
                  
                  {/* Status & Priority Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-primary" /> Workflow & Priority
                    </h4>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e: any) => setEditStatus(e.target.value)}
                        disabled={user?.role === 'employee' && activeProject?.status !== 'active'}
                        className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="todo">📋 To Do</option>
                        <option value="in_progress">⚡ In Progress</option>
                        <option value="blocked">🚫 Blocked</option>
                        <option value="done">✅ Done</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority Level</label>
                      <select
                        value={editPriority}
                        onChange={(e: any) => setEditPriority(e.target.value)}
                        disabled={!canManageTasks}
                        className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="low">🟢 Low Priority</option>
                        <option value="medium">🔵 Medium Priority</option>
                        <option value="high">🟠 High Priority</option>
                        <option value="critical">🔴 Critical Priority</option>
                      </select>
                    </div>
                  </div>

                  {/* Epic & Tags Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-primary" /> Epic & Custom Tags
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Epic / Feature Group</label>
                      <Input
                        value={editEpic}
                        onChange={(e) => setEditEpic(e.target.value)}
                        disabled={!canManageTasks}
                        placeholder="e.g. Authentication"
                        className="h-8 text-xs bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tags (comma-separated)</label>
                      <Input
                        value={editTagsInput}
                        onChange={(e) => setEditTagsInput(e.target.value)}
                        disabled={!canManageTasks}
                        placeholder="Frontend, Bug, Security"
                        className="h-8 text-xs bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  {/* Financial & Time Tracking Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Time & Hours Tracking
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estimated Hours</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editEstHours}
                          onChange={(e) => setEditEstHours(e.target.value === '' ? '' : Number(e.target.value))}
                          disabled={!canManageTasks}
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Logged Hours</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editLoggedHours}
                          onChange={(e) => setEditLoggedHours(e.target.value === '' ? '' : Number(e.target.value))}
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Linked Knowledge Base SOP Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Linked Company SOP / Doc
                    </label>
                    <select
                      value={editLinkedDoc}
                      onChange={(e) => setEditLinkedDoc(e.target.value)}
                      disabled={!canManageTasks}
                      className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="">No Linked SOP</option>
                      {documents.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                          📄 {doc.title} {doc.category ? `(${doc.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assignee Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" /> Assignee
                    </label>
                    <select
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      disabled={!canManageTasks}
                      className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="">Unassigned (Open for pickup)</option>
                      {users?.filter((u) => {
                        const userRank = user ? ROLE_RANK[user.role] : 0;
                        const assigneeRank = ROLE_RANK[u.role] || 0;
                        return assigneeRank <= userRank;
                      }).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Timeline & Dates Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Timeline & Schedule
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Date</label>
                        <Input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          disabled={!canManageTasks}
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                        <Input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          disabled={!canManageTasks}
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dependencies & Milestones Card */}
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-primary" /> Dependency & Milestone
                    </h4>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Depends On Task</label>
                      <select
                        value={editDependsOn}
                        onChange={(e) => setEditDependsOn(e.target.value)}
                        disabled={!canManageTasks}
                        className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="">No Dependency</option>
                        {tasks?.filter((t: Task) => t.id !== viewingTask?.id).map((t: Task) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-white dark:bg-slate-950 cursor-pointer select-none hover:border-primary/40 transition-colors">
                      <input
                        type="checkbox"
                        id="editIsMilestone"
                        checked={editIsMilestone}
                        onChange={(e) => setEditIsMilestone(e.target.checked)}
                        disabled={!canManageTasks}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Milestone Marker
                        </span>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Highlights this task as a key milestone on the Gantt timeline
                        </p>
                      </div>
                    </label>
                  </div>

                </div>
              </div>
            </form>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 shrink-0">
              <div>
                {canManageTasks && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteTask}
                    disabled={deleteTaskMutation.isPending}
                    className="text-xs font-semibold text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Task
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingTask(null)}
                  className="text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="task-config-form"
                  size="sm"
                  disabled={updateTaskMutation.isPending}
                  className="text-xs font-semibold px-5 shadow-sm"
                >
                  {updateTaskMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={!!showEditProject} onOpenChange={(open) => !open && setShowEditProject(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
              <FolderGit2 className="h-5 w-5 text-primary" /> Project Configuration
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4 py-3">
            {updateProjectMutation.error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{extractErrorMessage(updateProjectMutation.error)}</p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Project Name</label>
              <Input
                required
                value={editProjName}
                onChange={(e) => setEditProjName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground">Description</label>
              <textarea
                value={editProjDesc}
                onChange={(e) => setEditProjDesc(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">Status</label>
              <select
                value={editProjStatus}
                onChange={(e: any) => setEditProjStatus(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="done">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            <div className="pt-4 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditProject(null)}
                className="font-semibold text-xs h-9"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="font-semibold text-xs h-9 bg-primary text-white hover:bg-primary/95" 
                disabled={updateProjectMutation.isPending}
              >
                {updateProjectMutation.isPending ? 'Saving Configurations...' : 'Save Configurations'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <DeleteConfirmModal
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
        title="Delete Project"
        description={
          <>
            Are you sure you want to delete <strong className="text-foreground font-semibold">"{deleteProjectName}"</strong>?
          </>
        }
        warning="WARNING: All tasks and milestones associated with this project will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Project"
        isLoading={deleteProjectMutation.isPending}
        onConfirm={() => {
          if (deleteProjectId) {
            deleteProjectMutation.mutate(deleteProjectId);
            setDeleteProjectId(null);
          }
        }}
      />

      {/* Delete Task Confirmation Dialog */}
      <DeleteConfirmModal
        open={!!deleteTaskId}
        onOpenChange={(open) => !open && setDeleteTaskId(null)}
        title="Delete Task"
        description={
          <>
            Are you sure you want to delete the task <strong className="text-foreground font-semibold">"{deleteTaskTitle}"</strong>?
          </>
        }
        warning="WARNING: This will permanently delete this task from the project board."
        error={deleteTaskMutation.error ? extractErrorMessage(deleteTaskMutation.error) : null}
        confirmLabel="Delete Task"
        isLoading={deleteTaskMutation.isPending}
        onConfirm={() => {
          if (deleteTaskId) {
            deleteTaskMutation.mutate(deleteTaskId);
          }
        }}
      />
    </div>
  );
};
