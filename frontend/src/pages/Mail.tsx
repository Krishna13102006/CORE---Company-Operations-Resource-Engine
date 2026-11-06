import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import {
  Mail,
  Send,
  Inbox,
  Trash2,
  Plus,
  Search,
  User,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  CornerUpLeft,
  Loader2,
  Paperclip,
  FileText,
  Bold,
  Italic,
  List,
  ListOrdered,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Archive,
  ArchiveRestore,
  Tag,
  AlertCircle,
  AlertTriangle,
  Building,
  Crown,
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  Eye,
  Users,
  CheckSquare,
  Layers,
  Calendar,
  DollarSign,
  Check,
  CheckCheck,
  Radio,
  Share2,
  HelpCircle,
  Zap,
  Edit3,
  ArrowRight,
  BellOff,
  Timer,
  Settings,
  Bookmark,
  Languages,
  Wand2,
  SlidersHorizontal,
  RotateCcw,
  Video,
  ArrowUpRight,
  ShieldAlert,
  Lock,
  Unlock,
  FileCheck,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  RemoveFormatting
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface UserMail {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface MailAttachment {
  id: string;
  file: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

interface ReadReceiptItem {
  id: string;
  name: string;
  email: string;
  is_read: boolean;
  read_at: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
}

interface ReadReceiptsStats {
  total_recipients: number;
  read_count: number;
  read_percentage: number;
  acknowledged_count: number;
  acknowledged_percentage: number;
  recipients: ReadReceiptItem[];
}

interface MailMessageSummary {
  id: string;
  sender: UserMail;
  subject: string;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_acknowledged: boolean;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category_tag: 'general' | 'announcement' | 'action_required' | 'fyi' | 'compliance';
  requires_acknowledgment: boolean;
  broadcast_channel: string;
  linked_entity_type: string;
  linked_entity_id: string;
  linked_entity_title: string;
  is_draft: boolean;
  scheduled_for: string | null;
  is_sent: boolean;
  recipients: UserMail[];
  parent_message: string | null;
  attachments_count: number;
}

interface MailMessageDetail {
  id: string;
  sender: UserMail;
  subject: string;
  body: string;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category_tag: 'general' | 'announcement' | 'action_required' | 'fyi' | 'compliance';
  requires_acknowledgment: boolean;
  broadcast_channel: string;
  linked_entity_type: string;
  linked_entity_id: string;
  linked_entity_title: string;
  is_draft: boolean;
  scheduled_for: string | null;
  is_sent: boolean;
  recipients: UserMail[];
  parent_message: string | null;
  attachments: MailAttachment[];
  replies: MailMessageDetail[];
  read_receipts: ReadReceiptsStats | null;
}

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

interface ChannelsMeta {
  departments: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; status: string }>;
  role_presets: Array<{ id: string; label: string; count: number }>;
  total_org_members: number;
}

interface AISummaryResult {
  tldr_summary: string;
  key_points: string[];
  action_items: Array<{
    task: string;
    assignee: string;
    due_date: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  sentiment: string;
  unresolved_questions: string[];
}

interface SmartReplyItem {
  label: string;
  type: 'affirmative' | 'clarification' | 'postpone';
  subject_prefix?: string;
  body_html: string;
}

interface EmailIntentData {
  intent: string;
  urgency: string;
  sentiment: string;
  badge_color?: string;
  key_ask?: string;
  estimated_read_minutes?: number;
}

interface WorkGraphCardData {
  type: 'task' | 'project' | 'meeting' | 'expense' | 'document';
  id: string;
  title: string;
  status?: string;
  priority?: string;
  assignee_name?: string;
  due_date?: string;
  owner_name?: string;
  tasks_count?: number;
  room_code?: string;
  is_live?: boolean;
  scheduled_start?: string;
  participant_count?: number;
  merchant?: string;
  amount?: string;
  currency?: string;
  category?: string;
  employee_name?: string;
  expense_date?: string;
  file_type?: string;
  file_size?: number;
  allowed_roles?: string;
  author_name?: string;
  updated_at?: string;
  link?: string;
}

interface UserPresenceInfo {
  status: 'online' | 'in_meeting' | 'ooo' | 'offline';
  label: string;
  color: 'emerald' | 'amber' | 'rose' | 'slate';
  detail: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const stripHtml = (html: string) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const LENGTH_SLIDER_PRESETS = [
  { level: 1, label: 'Ultra-Short', sublabel: 'Bullets Only', desc: 'Cut all fluff & pleasantries down to 2-3 essential bullet points', icon: '⚡' },
  { level: 2, label: 'Concise', sublabel: 'Brief & Tight', desc: 'Eliminate filler words; keep to 1 compact, crisp paragraph', icon: '✂️' },
  { level: 3, label: 'Standard', sublabel: 'Balanced', desc: 'Standard professional email length with balanced context', icon: '⚖️' },
  { level: 4, label: 'Detailed', sublabel: 'Expanded', desc: 'Elaborate key points with rationale, background context & steps', icon: '📝' },
  { level: 5, label: 'In-Depth', sublabel: 'Comprehensive', desc: 'Fully elaborate all notes into multi-paragraph corporate brief', icon: '📚' },
];

const PRIORITY_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: {
    label: 'Urgent',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-900/50',
  },
  high: {
    label: 'High Priority',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900/50',
  },
  normal: {
    label: 'Normal',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-800',
  },
  low: {
    label: 'Low Priority',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    border: 'border-slate-200 dark:border-slate-800',
  },
};

const CATEGORY_TAGS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  announcement: {
    label: 'Announcement',
    icon: Sparkles,
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  action_required: {
    label: 'Action Required',
    icon: AlertCircle,
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  fyi: {
    label: 'FYI / Notice',
    icon: HelpCircle,
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  compliance: {
    label: 'Policy & Compliance',
    icon: ShieldCheck,
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  general: {
    label: 'General',
    icon: Mail,
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
};

export const MailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  // Navigation & Folders
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'announcements' | 'sent' | 'snoozed' | 'archived' | 'drafts'>('inbox');
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // ⏱️ Undo Send State
  const [undoSendCountdown, setUndoSendCountdown] = useState<number | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const undoSendTimerRef = useRef<any>(null);

  // ⏰ Snooze Modal State
  const [snoozeModalOpen, setSnoozeModalOpen] = useState(false);
  const [snoozeTargetMailId, setSnoozeTargetMailId] = useState<string | null>(null);

  // 🏖️ Out of Office (OOO) Pre-Send Warning State
  const [oooRecipientsWarning, setOooRecipientsWarning] = useState<Array<{ name: string; email: string; end_date: string; message: string }>>([]);

  // ✍️ Signature & Preferences State
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [userSignature, setUserSignature] = useState('');
  const [includeSignatureDefault, setIncludeSignatureDefault] = useState(true);
  const [isOooEnabled, setIsOooEnabled] = useState(false);
  const [oooStartDate, setOooStartDate] = useState('');
  const [oooEndDate, setOooEndDate] = useState('');
  const [oooMessageText, setOooMessageText] = useState('Thank you for your email. I am currently out of the office with limited access to email. I will respond to your message upon my return.');

  // 📁 Canned Templates State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templatesList, setTemplatesList] = useState<Array<{ id: string; title: string; category: string; subject: string; body_html: string }>>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('General');

  // 📎 Forgotten Attachment Warning Modal
  const [showForgottenAttachmentModal, setShowForgottenAttachmentModal] = useState(false);

  // 🔍 Document / Image / PDF Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; fileName: string; isImage?: boolean; isPdf?: boolean } | null>(null);

  // Thread view states
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({});
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [quickReplyBody, setQuickReplyBody] = useState('');
  const [quickReplyAttachments, setQuickReplyAttachments] = useState<File[]>([]);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryResult | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // ⚡ Pillar 2: AI Dynamic Smart Replies, Intent Triage & Translation
  const [smartReplies, setSmartReplies] = useState<SmartReplyItem[]>([]);
  const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);
  const [emailIntent, setEmailIntent] = useState<EmailIntentData | null>(null);
  const [emailIntentLoading, setEmailIntentLoading] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, { translated_html: string; target_language: string; detected_source_language: string }>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  const [composerTranslateLang, setComposerTranslateLang] = useState('Spanish');
  const [isComposerTranslating, setIsComposerTranslating] = useState(false);

  // 📏 Elaborate / Shorten Quick Slider State
  const [lengthSliderLevel, setLengthSliderLevel] = useState<number>(3);
  const [showLengthSlider, setShowLengthSlider] = useState<boolean>(false);
  const [originalDraftBackup, setOriginalDraftBackup] = useState<string | null>(null);
  const [isAdjustingLength, setIsAdjustingLength] = useState<boolean>(false);

  // Convert Task Modal State
  const [convertTaskModalOpen, setConvertTaskModalOpen] = useState(false);
  const [convertTaskMailId, setConvertTaskMailId] = useState<string | null>(null);
  const [taskTargetProjectId, setTaskTargetProjectId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<string>('medium');

  // 🌐 Pillar 3: Work-Graph Deep Integration States
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceInfo>>({});
  const [workgraphCardData, setWorkgraphCardData] = useState<WorkGraphCardData | null>(null);
  const [workgraphCardLoading, setWorkgraphCardLoading] = useState(false);
  const [isSpawningMeeting, setIsSpawningMeeting] = useState(false);
  const [permissionWarningModalOpen, setPermissionWarningModalOpen] = useState(false);
  const [pendingPermissionData, setPendingPermissionData] = useState<{
    documentId: string;
    documentTitle: string;
    missingRoles: string[];
    missingRecipients: Array<{ id: string; name: string; email: string; role: string }>;
    formData: FormData;
  } | null>(null);

  // Compose State
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [targetMode, setTargetMode] = useState<'individual' | 'department' | 'role' | 'project' | 'all'>('individual');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetRoleId, setTargetRoleId] = useState<string>('all_managers');
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [parentMessageId, setParentMessageId] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [categoryTag, setCategoryTag] = useState<'general' | 'announcement' | 'action_required' | 'fyi' | 'compliance'>('general');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);

  // Context Linking State
  const [linkedEntityType, setLinkedEntityType] = useState<string>('');
  const [linkedEntityId, setLinkedEntityId] = useState<string>('');
  const [linkedEntityTitle, setLinkedEntityTitle] = useState<string>('');

  // AI Smart Compose State in Compose Modal
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<'executive' | 'concise' | 'friendly' | 'urgent' | 'formal'>('executive');
  const [aiAction, setAiAction] = useState<'draft' | 'polish'>('draft');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiCopilot, setShowAiCopilot] = useState(false);

  // Modals
  const [itemToDelete, setItemToDelete] = useState<{ id: string; subject: string; is_draft?: boolean } | null>(null);

  // 🚀 Pillar 4: Productivity & UX Refinements State
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [activeMailIndex, setActiveMailIndex] = useState<number>(-1);
  const [composerViewMode, setComposerViewMode] = useState<'normal' | 'fullscreen' | 'docked'>('normal');
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);

  // Editors & Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickReplyEditorRef = useRef<HTMLDivElement>(null);
  const quickReplyFileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Mail List based on Folder & Filters
  const { data: inboxResponse, isLoading: inboxLoading, refetch: refetchInbox } = useQuery<{
    messages: MailMessageSummary[];
    counts: { inbox_unread: number; starred: number; snoozed?: number; announcements_unread: number; drafts: number };
  }>({
    queryKey: ['mail', activeFolder, searchQuery, filterCategory, filterPriority],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.append('folder', activeFolder);
      if (searchQuery.trim()) qs.append('search', searchQuery.trim());
      if (filterCategory && filterCategory !== 'all') qs.append('category', filterCategory);
      if (filterPriority && filterPriority !== 'all') qs.append('priority', filterPriority);
      return api.get(`/communications/inbox/?${qs.toString()}`);
    },
  });

  const mailMessages = useMemo(() => inboxResponse?.messages || [], [inboxResponse?.messages]);
  const folderCounts = inboxResponse?.counts || { inbox_unread: 0, starred: 0, snoozed: 0, announcements_unread: 0, drafts: 0 };

  // Fetch User Preferences (Signature & OOO)
  const { data: userPreferencesData } = useQuery({
    queryKey: ['mail-preferences'],
    queryFn: () => api.get('/communications/preferences/'),
  });

  useEffect(() => {
    if (userPreferencesData) {
      setUserSignature(userPreferencesData.signature_html || '');
      setIncludeSignatureDefault(userPreferencesData.include_signature_by_default ?? true);
      setIsOooEnabled(userPreferencesData.is_ooo_enabled || false);
      setOooStartDate(userPreferencesData.ooo_start_date || '');
      setOooEndDate(userPreferencesData.ooo_end_date || '');
      if (userPreferencesData.ooo_message) {
        setOooMessageText(userPreferencesData.ooo_message);
      }
    }
  }, [userPreferencesData]);

  // Fetch Templates Library
  const { data: templatesData, refetch: refetchTemplates } = useQuery({
    queryKey: ['mail-templates'],
    queryFn: () => api.get('/communications/templates/'),
  });

  useEffect(() => {
    if (templatesData && Array.isArray(templatesData)) {
      setTemplatesList(templatesData);
    }
  }, [templatesData]);

  // 2. Fetch Broadcast Channels Meta
  const { data: channelsMeta } = useQuery<ChannelsMeta>({
    queryKey: ['channelsMeta'],
    queryFn: () => api.get('/communications/channels-meta/'),
  });

  // 3. Fetch Colleagues for auto-complete
  const { data: colleagues } = useQuery<TeamMember[]>({
    queryKey: ['colleagues'],
    queryFn: async () => {
      const res = await api.get('/auth/users/');
      return Array.isArray(res) ? res : (res?.results || res?.data || []);
    },
  });

  // 4. Fetch Projects for context linking
  const { data: projectList } = useQuery<any>({
    queryKey: ['projectsAll'],
    queryFn: () => api.get('/projects/?all=true'),
  });

  // 5. Fetch Meetings for context linking
  const { data: meetingList } = useQuery<any>({
    queryKey: ['meetingsAll'],
    queryFn: () => api.get('/meetings/'),
  });

  // 6. Fetch Expenses for context linking
  const { data: expenseList } = useQuery<any>({
    queryKey: ['expensesAll'],
    queryFn: () => api.get('/expenses/?all=true'),
  });

  // 6b. Fetch Documents for context linking
  const { data: documentList } = useQuery<any>({
    queryKey: ['documentsAll'],
    queryFn: () => api.get('/knowledge/documents/?all=true'),
  });

  const projects = Array.isArray(projectList?.results || projectList) ? (projectList?.results || projectList) : [];
  const meetings = Array.isArray(meetingList?.results || meetingList) ? (meetingList?.results || meetingList) : [];
  const expenses = Array.isArray(expenseList?.results || expenseList) ? (expenseList?.results || expenseList) : [];
  const documents = Array.isArray(documentList?.results || documentList) ? (documentList?.results || documentList) : [];

  // 7. Fetch Detailed Thread Message
  const { data: activeMailDetail, isLoading: detailLoading } = useQuery<MailMessageDetail>({
    queryKey: ['mail', 'detail', selectedMailId],
    queryFn: async () => {
      if (!selectedMailId) return null as any;
      const res = await api.get(`/communications/messages/${selectedMailId}/`);
      return res?.data || res;
    },
    enabled: !!selectedMailId,
  });

  // 🌐 Pillar 3: Fetch Real-Time Recipient Presence when colleagues load
  useEffect(() => {
    if (colleagues && colleagues.length > 0) {
      const userIds = colleagues.map((c) => c.id);
      api.post('/communications/presence/', { user_ids: userIds })
        .then((res: any) => {
          const p = res?.presence || res;
          if (p && typeof p === 'object') {
            setPresenceMap(p);
          }
        })
        .catch(() => {});
    }
  }, [colleagues]);

  // 🌐 Pillar 3: Fetch Work-Graph Entity Card when activeMailDetail has linked entity
  useEffect(() => {
    if (activeMailDetail && activeMailDetail.linked_entity_type && activeMailDetail.linked_entity_id) {
      setWorkgraphCardLoading(true);
      api.get(`/communications/workgraph-card/?entity_type=${activeMailDetail.linked_entity_type}&entity_id=${activeMailDetail.linked_entity_id}`)
        .then((res: any) => {
          setWorkgraphCardData(res);
        })
        .catch(() => {
          setWorkgraphCardData(null);
        })
        .finally(() => {
          setWorkgraphCardLoading(false);
        });
    } else {
      setWorkgraphCardData(null);
    }
  }, [activeMailDetail]);

  // Reset thread summaries and expand messages when thread loads
  useEffect(() => {
    if (activeMailDetail) {
      const initialMap: Record<string, boolean> = {};
      const allMsgs = [activeMailDetail, ...(activeMailDetail.replies || [])];
      allMsgs.forEach((msg) => {
        initialMap[msg.id] = true;
      });
      setExpandedMessageIds(initialMap);
      setShowQuickReply(false);
      setQuickReplyBody('');
      setQuickReplyAttachments([]);
      setAiSummary(null);
      setSmartReplies([]);
      setEmailIntent(null);
      setTranslatedMessages({});

      if (!activeMailDetail.is_draft) {
        setEmailIntentLoading(true);
        api.get(`/communications/messages/${activeMailDetail.id}/intent/`)
          .then((res: any) => setEmailIntent(res))
          .catch(() => {})
          .finally(() => setEmailIntentLoading(false));

        setSmartRepliesLoading(true);
        api.post(`/communications/messages/${activeMailDetail.id}/smart-replies/`)
          .then((res: any) => {
            if (res?.smart_replies && Array.isArray(res.smart_replies)) {
              setSmartReplies(res.smart_replies);
            }
          })
          .catch(() => {})
          .finally(() => setSmartRepliesLoading(false));
      }
    }
  }, [activeMailDetail]);

  // Sync contentEditable with react state
  useEffect(() => {
    if (showCompose && editorRef.current) {
      if (composeBody && editorRef.current.innerHTML !== composeBody) {
        editorRef.current.innerHTML = composeBody;
      }
    }
  }, [showCompose, composeBody]);

  // Format command executor for rich-text styling
  const executeFormatCommand = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      setComposeBody(editorRef.current.innerHTML);
    }
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      setComposeBody(editorRef.current.innerHTML);
    }
  };

  const handleQuickReplyChange = () => {
    if (quickReplyEditorRef.current) {
      setQuickReplyBody(quickReplyEditorRef.current.innerHTML);
    }
  };

  // Mutations
  const composeMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/communications/compose/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ['mail', 'detail', selectedMailId] });
      }
      setShowCompose(false);
      setShowQuickReply(false);
      resetComposeForm();
    },
    onError: (err: any) => {
      setComposeError(extractErrorMessage(err) || 'Failed to send mail.');
    },
  });

  const starMutation = useMutation({
    mutationFn: (id: string) => api.post(`/communications/messages/${id}/star/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ['mail', 'detail', selectedMailId] });
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/communications/messages/${id}/archive/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ['mail', 'detail', selectedMailId] });
      }
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/communications/messages/${id}/acknowledge/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ['mail', 'detail', selectedMailId] });
      }
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, preset, snooze_until }: { id: string; preset?: string; snooze_until?: string }) =>
      api.post(`/communications/messages/${id}/snooze/`, { preset, snooze_until }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      setSnoozeModalOpen(false);
      setSnoozeTargetMailId(null);
      if (selectedMailId === snoozeTargetMailId) {
        setSelectedMailId(null);
      }
      coreAlert({
        title: 'Thread Snoozed',
        description: data.message || 'Email conversation snoozed successfully.',
        variant: 'success',
        icon: <Clock className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Snooze Failed',
        description: extractErrorMessage(err) || 'Could not snooze thread.',
        variant: 'destructive',
      });
    }
  });

  const preferencesMutation = useMutation({
    mutationFn: (payload: any) => api.post('/communications/preferences/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-preferences'] });
      setShowPreferencesModal(false);
      coreAlert({
        title: 'Preferences Saved',
        description: 'Your email signature and Out-of-Office settings have been updated.',
        variant: 'success',
        icon: <CheckCircle2 className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Save Failed',
        description: extractErrorMessage(err) || 'Could not update preferences.',
        variant: 'destructive',
      });
    }
  });

  const convertTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/communications/convert-task/', data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ['mail', 'detail', selectedMailId] });
      }
      coreAlert({
        title: 'Task Created Successfully',
        description: `Task "${data.title}" has been successfully added to the project!`,
        variant: 'success',
        icon: <CheckCircle2 className="h-5 w-5" />
      });
      setConvertTaskModalOpen(false);
      setConvertTaskMailId(null);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Create Task',
        description: extractErrorMessage(err) || 'Failed to create task.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/communications/messages/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      setItemToDelete(null);
      setSelectedMailId(null);
    },
  });

  const openDraftInComposer = async (mail: any) => {
    let draftData = mail;
    if (draftData.id) {
      try {
        const res: any = await api.get(`/communications/messages/${draftData.id}/`);
        if (res?.data || res) {
          draftData = res.data || res;
        }
      } catch (err) {
        console.warn('Failed to load draft detail:', err);
      }
    }

    setEditingDraftId(draftData.id);
    setComposeSubject(draftData.subject === '(Untitled Draft)' ? '' : (draftData.subject || ''));
    const initialBody = draftData.body || '';
    setComposeBody(initialBody);
    if (editorRef.current) {
      editorRef.current.innerHTML = initialBody;
    }
    setPriority(draftData.priority || 'normal');
    setCategoryTag(draftData.category_tag || 'general');
    setRequiresAcknowledgment(draftData.requires_acknowledgment || false);
    setLinkedEntityType(draftData.linked_entity_type || '');
    setLinkedEntityId(draftData.linked_entity_id || '');
    setLinkedEntityTitle(draftData.linked_entity_title || '');

    if (draftData.broadcast_channel?.includes('Department')) {
      setTargetMode('department');
    } else if (draftData.broadcast_channel?.includes('Role')) {
      setTargetMode('role');
    } else if (draftData.broadcast_channel?.includes('Project Team')) {
      setTargetMode('project');
    } else if (draftData.broadcast_channel?.includes('All Organization')) {
      setTargetMode('all');
    } else {
      setTargetMode('individual');
      if (draftData.recipients && Array.isArray(draftData.recipients)) {
        setSelectedRecipients(draftData.recipients.map((r: any) => r.id));
      }
    }

    setSelectedMailId(null);
    setShowCompose(true);
  };

  const resetComposeForm = () => {
    setEditingDraftId(null);
    setComposeSubject('');
    setComposeBody('');
    setTargetMode('individual');
    setTargetDepartmentId('');
    setTargetRoleId('all_managers');
    setTargetProjectId('');
    setSelectedRecipients([]);
    setOooRecipientsWarning([]);
    setAttachments([]);
    setQuickReplyAttachments([]);
    setParentMessageId(null);
    setComposeError(null);
    setPriority('normal');
    setCategoryTag('general');
    setRequiresAcknowledgment(false);
    setLinkedEntityType('');
    setLinkedEntityId('');
    setLinkedEntityTitle('');
    setAiPrompt('');
    setShowAiCopilot(false);
    setLengthSliderLevel(3);
    setShowLengthSlider(false);
    setOriginalDraftBackup(null);
    setIsAdjustingLength(false);

    // Auto-inject signature if configured
    if (includeSignatureDefault && userSignature) {
      const initialWithSig = `<p><br></p><div class="core-mail-signature">${userSignature}</div>`;
      setComposeBody(initialWithSig);
      if (editorRef.current) {
        editorRef.current.innerHTML = initialWithSig;
      }
    }
  };

  // Check Out-of-Office (OOO) recipients whenever recipients change
  const checkOooRecipients = async (recipientIds: string[]) => {
    if (!colleagues || recipientIds.length === 0) {
      setOooRecipientsWarning([]);
      return;
    }
    const emails = recipientIds
      .map((id) => colleagues.find((c) => c.id === id)?.email)
      .filter(Boolean) as string[];

    if (emails.length === 0) {
      setOooRecipientsWarning([]);
      return;
    }

    try {
      const res: any = await api.post('/communications/ooo-check/', { emails });
      if (res.ooo_recipients && Array.isArray(res.ooo_recipients)) {
        setOooRecipientsWarning(res.ooo_recipients);
      } else {
        setOooRecipientsWarning([]);
      }
    } catch {
      setOooRecipientsWarning([]);
    }
  };

  // 🧠 Gemini AI Smart Compose Handler
  const handleRunAiCompose = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    try {
      const currentContent = editorRef.current ? editorRef.current.innerHTML : composeBody;
      const res: any = await api.post('/communications/ai-compose/', {
        prompt: aiPrompt,
        tone: aiTone,
        action: aiAction,
        context: currentContent,
      }, { timeoutMs: 60000 });

      if (res.subject) setComposeSubject(res.subject);
      if (res.body_html) {
        setComposeBody(res.body_html);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.body_html;
        }
      }
      if (res.suggested_category && CATEGORY_TAGS[res.suggested_category]) {
        setCategoryTag(res.suggested_category);
      }
      if (res.suggested_priority && PRIORITY_BADGES[res.suggested_priority]) {
        setPriority(res.suggested_priority);
      }
      setShowAiCopilot(false);
    } catch (err: any) {
      coreAlert({
        title: 'AI Composer Error',
        description: extractErrorMessage(err) || 'AI Composer failed. Please try again.',
        variant: 'warning',
        icon: <Sparkles className="h-5 w-5" />,
      });
    } finally {
      setIsAiGenerating(false);
    }
  };

  // 🧠 Gemini AI Thread TL;DR Summarizer
  const handleRunAiSummary = async () => {
    if (!selectedMailId) return;
    setAiSummaryLoading(true);
    try {
      const res: any = await api.post(`/communications/messages/${selectedMailId}/ai-summary/`, null, { timeoutMs: 60000 });
      setAiSummary(res);
    } catch (err: any) {
      coreAlert({
        title: 'AI Summary Error',
        description: extractErrorMessage(err) || 'Failed to generate AI Thread Summary.',
        variant: 'warning',
        icon: <Sparkles className="h-5 w-5" />,
      });
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // ⚡ Reload Dynamic Smart Replies
  const handleReloadSmartReplies = async () => {
    if (!selectedMailId) return;
    setSmartRepliesLoading(true);
    try {
      const res: any = await api.post(`/communications/messages/${selectedMailId}/smart-replies/`, null, { timeoutMs: 60000 });
      if (res?.smart_replies && Array.isArray(res.smart_replies) && res.smart_replies.length > 0) {
        setSmartReplies(res.smart_replies);
        coreAlert({
          title: 'Smart Replies Refreshed',
          description: `Loaded ${res.smart_replies.length} contextual reply suggestions.`,
          variant: 'success',
          icon: <Sparkles className="h-5 w-5" />,
        });
      } else {
        coreAlert({
          title: 'No Suggestions',
          description: 'No new reply suggestions could be generated for this message.',
          variant: 'info',
        });
      }
    } catch (err: any) {
      coreAlert({
        title: 'Refresh Suggestions Failed',
        description: extractErrorMessage(err) || 'Failed to refresh smart replies.',
        variant: 'destructive',
      });
    } finally {
      setSmartRepliesLoading(false);
    }
  };

  // 🌐 Translate specific message in thread
  const handleTranslateMessage = async (msgId: string, currentHtml: string, targetLang = 'English') => {
    if (translatedMessages[msgId]) {
      // Toggle back to original
      setTranslatedMessages((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }
    setTranslatingMessageId(msgId);
    try {
      const res: any = await api.post('/communications/translate/', {
        text: currentHtml,
        target_language: targetLang,
      }, { timeoutMs: 60000 });
      if (res?.translated_html) {
        setTranslatedMessages((prev) => ({
          ...prev,
          [msgId]: {
            translated_html: res.translated_html,
            target_language: res.target_language || targetLang,
            detected_source_language: res.detected_source_language || 'Original',
          },
        }));
      }
    } catch (err: any) {
      coreAlert({
        title: 'Translation Failed',
        description: extractErrorMessage(err) || 'Could not translate message.',
        variant: 'warning',
        icon: <Languages className="h-5 w-5" />,
      });
    } finally {
      setTranslatingMessageId(null);
    }
  };

  // ✍️ 1-Click Composer AI Transforms (Make Professional, Shorten, Elaborate, Fix Grammar)
  const handleQuickAiTransform = async (action: 'polish' | 'shorten' | 'elaborate' | 'fix_grammar', tone: string = 'executive') => {
    const currentContent = editorRef.current ? editorRef.current.innerHTML : composeBody;
    const plainText = stripHtml(currentContent).trim();
    if (!plainText) {
      coreAlert({
        title: 'Draft Content Required',
        description: 'Please type some text, notes, or bullet points in the message body first before applying AI transforms.',
        variant: 'warning',
        icon: <Sparkles className="h-5 w-5" />,
      });
      return;
    }

    setIsAiGenerating(true);
    try {
      const res: any = await api.post('/communications/ai-compose/', {
        prompt: plainText,
        tone: tone,
        action: action,
        context: currentContent,
      }, { timeoutMs: 60000 });

      if (res?.body_html) {
        setComposeBody(res.body_html);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.body_html;
        }
      }
      if (res?.subject && !composeSubject.trim()) {
        setComposeSubject(res.subject);
      }
      if (res?.suggested_category && CATEGORY_TAGS[res.suggested_category]) {
        setCategoryTag(res.suggested_category);
      }
      if (res?.suggested_priority && PRIORITY_BADGES[res.suggested_priority]) {
        setPriority(res.suggested_priority);
      }
    } catch (err: any) {
      coreAlert({
        title: 'AI Transformation Error',
        description: extractErrorMessage(err) || 'Failed to refine draft with AI.',
        variant: 'destructive',
        icon: <Sparkles className="h-5 w-5" />,
      });
    } finally {
      setIsAiGenerating(false);
    }
  };

  // 🌐 1-Click Composer Translate Draft
  const handleTranslateDraft = async (targetLang: string) => {
    const currentContent = editorRef.current ? editorRef.current.innerHTML : composeBody;
    if (!stripHtml(currentContent).trim()) {
      coreAlert({
        title: 'Draft Content Required',
        description: 'Please type some text in the message body before translating.',
        variant: 'warning',
        icon: <Languages className="h-5 w-5" />,
      });
      return;
    }

    setIsComposerTranslating(true);
    try {
      const res: any = await api.post('/communications/translate/', {
        text: currentContent,
        target_language: targetLang,
      });
      if (res?.translated_html) {
        setComposeBody(res.translated_html);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.translated_html;
        }
        coreAlert({
          title: 'Draft Translated',
          description: `Your draft has been translated to ${targetLang}.`,
          variant: 'success',
          icon: <Languages className="h-5 w-5" />,
        });
      }
    } catch (err: any) {
      coreAlert({
        title: 'Draft Translation Failed',
        description: extractErrorMessage(err) || 'Failed to translate draft.',
        variant: 'destructive',
      });
    } finally {
      setIsComposerTranslating(false);
    }
  };

  // 📏 Elaborate / Shorten Quick Slider Handler
  const handleApplyLengthSlider = async (targetLevel: number) => {
    setLengthSliderLevel(targetLevel);
    const currentContent = editorRef.current ? editorRef.current.innerHTML : composeBody;
    const plainText = stripHtml(currentContent).trim();
    if (!plainText) {
      coreAlert({
        title: 'Draft Content Required',
        description: 'Type notes, bullet points, or paragraphs in the message body first before adjusting length.',
        variant: 'warning',
        icon: <Sparkles className="h-5 w-5" />,
      });
      return;
    }

    if (!originalDraftBackup) {
      setOriginalDraftBackup(currentContent);
    }

    setIsAdjustingLength(true);
    try {
      const res: any = await api.post('/communications/ai-compose/', {
        prompt: plainText,
        tone: aiTone || 'executive',
        action: targetLevel < 3 ? 'shorten' : targetLevel > 3 ? 'elaborate' : 'polish',
        context: originalDraftBackup || currentContent,
        length_level: targetLevel,
      }, { timeoutMs: 60000 });

      if (res?.body_html) {
        setComposeBody(res.body_html);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.body_html;
        }
      }
    } catch (err: any) {
      coreAlert({
        title: 'Length Adjustment Failed',
        description: extractErrorMessage(err) || 'Failed to adjust length.',
        variant: 'destructive',
      });
    } finally {
      setIsAdjustingLength(false);
    }
  };

  const handleRevertDraft = () => {
    if (originalDraftBackup) {
      setComposeBody(originalDraftBackup);
      if (editorRef.current) {
        editorRef.current.innerHTML = originalDraftBackup;
      }
      setOriginalDraftBackup(null);
      setLengthSliderLevel(3);
    }
  };

  // Compose Submit Handler
  const handleComposeSubmit = (isDraft = false) => {
    const editorContent = editorRef.current ? editorRef.current.innerHTML : '';
    const finalBody = editorContent || composeBody;

    if (!isDraft && !composeSubject.trim()) {
      setComposeError('Subject is required.');
      return;
    }
    if (!isDraft && (!finalBody.trim() || finalBody === '<br>' || finalBody === '<div><br></div>')) {
      setComposeError('Body content is required.');
      return;
    }
    if (!isDraft && targetMode === 'individual' && selectedRecipients.length === 0) {
      setComposeError('Please select at least one recipient or pick a broadcast channel.');
      return;
    }

    const formData = new FormData();
    if (editingDraftId) {
      formData.append('draft_id', editingDraftId);
    }
    formData.append('subject', composeSubject || '(Untitled Draft)');
    formData.append('body', finalBody || '<p></p>');
    formData.append('target_mode', targetMode);
    if (targetMode === 'department') formData.append('department_id', targetDepartmentId);
    if (targetMode === 'role') formData.append('target_role', targetRoleId);
    if (targetMode === 'project') formData.append('project_id', targetProjectId);
    if (targetMode === 'individual') formData.append('recipient_ids', selectedRecipients.join(','));

    formData.append('priority', priority);
    formData.append('category_tag', categoryTag);
    formData.append('requires_acknowledgment', String(requiresAcknowledgment));

    if (linkedEntityType && linkedEntityId) {
      formData.append('linked_entity_type', linkedEntityType);
      formData.append('linked_entity_id', linkedEntityId);
      formData.append('linked_entity_title', linkedEntityTitle);
    }

    if (isDraft) {
      formData.append('is_draft', 'true');
    }

    if (parentMessageId) {
      formData.append('parent_message_id', parentMessageId);
    }

    attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    if (isDraft) {
      // Drafts save immediately without Undo grace period
      composeMutation.mutate(formData);
      return;
    }

    // 📄 Pillar 3: Document Pre-Send Permission Verifier
    if (linkedEntityType === 'document' && linkedEntityId && selectedRecipients.length > 0) {
      api.post('/communications/verify-document-access/', {
        document_id: linkedEntityId,
        recipient_ids: selectedRecipients,
      }).then((res: any) => {
        if (res && !res.all_have_access && res.missing_recipients?.length > 0) {
          setPendingPermissionData({
            documentId: linkedEntityId,
            documentTitle: res.document_title || linkedEntityTitle || 'Attached Document',
            missingRoles: res.missing_roles || [],
            missingRecipients: res.missing_recipients || [],
            formData: formData,
          });
          setPermissionWarningModalOpen(true);
          return;
        }
        // All have access, proceed with send
        proceedToSendWithChecks(formData, finalBody);
      }).catch(() => {
        // If check endpoint fails, fallback to standard flow
        proceedToSendWithChecks(formData, finalBody);
      });
      return;
    }

    proceedToSendWithChecks(formData, finalBody);
  };

  const proceedToSendWithChecks = (formData: FormData, finalBody: string) => {
    // 📎 Forgotten Attachment Detection: check if body mentions attachments when 0 files attached
    if (attachments.length === 0) {
      const lowerBody = stripHtml(finalBody).toLowerCase();
      const attachmentKeywords = [
        'attached', 'attaching', 'attachment', 'pfa', 'please find attached',
        'enclosed', 'see attached', 'attached file', 'attached document'
      ];
      const hasAttachmentMention = attachmentKeywords.some(kw => lowerBody.includes(kw));
      if (hasAttachmentMention) {
        setPendingFormData(formData);
        setShowForgottenAttachmentModal(true);
        return;
      }
    }

    // ⏱️ Start 7-second "Undo Send" grace period
    executeGracePeriodSend(formData);
  };

  // ⚡ Pillar 3: Spawn Instant Meeting from Thread
  const handleSpawnInstantMeeting = async () => {
    if (!activeMailDetail) return;
    setIsSpawningMeeting(true);
    try {
      const res: any = await api.post(`/communications/messages/${activeMailDetail.id}/instant-meeting/`);
      coreAlert({
        title: 'Instant Meeting Spawned',
        description: res.message || 'Meeting created with all thread participants!',
        variant: 'success',
        icon: <Video className="h-5 w-5" />,
      });
      if (res.meeting?.room_code) {
        navigate(`/meetings?room=${res.meeting.room_code}`);
      }
    } catch (err: any) {
      coreAlert({
        title: 'Meeting Creation Failed',
        description: extractErrorMessage(err) || 'Could not spawn instant meeting.',
        variant: 'destructive',
      });
    } finally {
      setIsSpawningMeeting(false);
    }
  };

  // 📄 Pillar 3: Grant Document Roles and Continue Send
  const handleGrantDocumentRolesAndSend = async () => {
    if (!pendingPermissionData) return;
    try {
      await api.post('/communications/grant-document-roles/', {
        document_id: pendingPermissionData.documentId,
        roles_to_add: pendingPermissionData.missingRoles,
      });
      coreAlert({
        title: 'Access Granted',
        description: `Roles [${pendingPermissionData.missingRoles.join(', ')}] granted access to document.`,
        variant: 'success',
        icon: <FileCheck className="h-5 w-5" />,
      });
    } catch (err: any) {
      console.warn('Failed to grant roles:', err);
    } finally {
      const fd = pendingPermissionData.formData;
      setPermissionWarningModalOpen(false);
      setPendingPermissionData(null);
      executeGracePeriodSend(fd);
    }
  };

  const executeGracePeriodSend = (formData: FormData) => {
    setShowCompose(false);
    setShowForgottenAttachmentModal(false);
    setPendingFormData(formData);
    setUndoSendCountdown(7);

    if (undoSendTimerRef.current) {
      clearInterval(undoSendTimerRef.current);
    }

    undoSendTimerRef.current = setInterval(() => {
      setUndoSendCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(undoSendTimerRef.current);
          undoSendTimerRef.current = null;
          // Time expired: formally dispatch to server
          composeMutation.mutate(formData);
          setPendingFormData(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAbortUndoSend = () => {
    if (undoSendTimerRef.current) {
      clearInterval(undoSendTimerRef.current);
      undoSendTimerRef.current = null;
    }
    setUndoSendCountdown(null);
    setPendingFormData(null);
    setShowCompose(true);
    coreAlert({
      title: 'Send Cancelled',
      description: 'Your message was not sent. You can edit or discard your draft.',
      variant: 'info',
    });
  };

  // Quick Reply Submit Handler
  const handleQuickReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailDetail) return;
    const finalBody = quickReplyEditorRef.current ? quickReplyEditorRef.current.innerHTML : quickReplyBody;

    if (!finalBody.trim() || finalBody === '<br>' || finalBody === '<div><br></div>') {
      coreAlert({
        title: 'Empty Reply',
        description: 'Reply message body cannot be empty.',
        variant: 'warning',
        icon: <AlertCircle className="h-5 w-5" />,
      });
      return;
    }

    const rootId = activeMailDetail.parent_message || activeMailDetail.id;
    const formData = new FormData();
    formData.append('subject', activeMailDetail.subject.startsWith('Re:') ? activeMailDetail.subject : `Re: ${activeMailDetail.subject}`);
    formData.append('body', finalBody);
    formData.append('target_mode', 'individual');

    const replyRecipientId = activeMailDetail.sender.id === user?.id
      ? activeMailDetail.recipients[0]?.id || activeMailDetail.sender.id
      : activeMailDetail.sender.id;
    formData.append('recipient_ids', replyRecipientId);
    formData.append('parent_message_id', rootId);

    quickReplyAttachments.forEach((file) => {
      formData.append('attachments', file);
    });

    composeMutation.mutate(formData);
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/communications/attachment/${attachmentId}/`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      coreAlert({
        title: 'Download Failed',
        description: 'Failed to download attachment. Access was denied or resource is unavailable.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />,
      });
    }
  };

  // ⌨️ Pillar 4: Superhuman Keyboard Shortcuts Effect (c, r, e, s, /, j, k, o/Enter, Esc, ?)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, contenteditable, or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isEditable = document.activeElement?.getAttribute('contenteditable') === 'true';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || isEditable) {
        if (e.key === 'Escape') {
          // If in search input, blur it
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // 1. 'c' or 'C' -> Open Composer
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        resetComposeForm();
        setShowCompose(true);
        setComposerViewMode('normal');
        return;
      }

      // 2. '/' -> Focus Search Input
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 3. '?' -> Toggle Keyboard Shortcuts Cheat-Sheet HUD
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // 4. 'Escape' -> Close modals or clear selection
      if (e.key === 'Escape') {
        if (previewAttachment) {
          setPreviewAttachment(null);
          return;
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (showCompose) {
          setShowCompose(false);
          return;
        }
        if (selectedMailId) {
          setSelectedMailId(null);
          return;
        }
        return;
      }

      // 5. 'r' or 'R' -> Quick Reply (if in thread view)
      if (e.key === 'r' || e.key === 'R') {
        if (selectedMailId && activeMailDetail) {
          e.preventDefault();
          setShowQuickReply(true);
          setTimeout(() => {
            quickReplyEditorRef.current?.focus();
          }, 50);
          return;
        }
      }

      // 6. 'e' or 'E' -> Archive current mail (thread or highlighted item)
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const targetId = selectedMailId || (activeMailIndex >= 0 && mailMessages[activeMailIndex]?.id);
        if (targetId) {
          archiveMutation.mutate(targetId);
        }
        return;
      }

      // 7. 's' or 'S' -> Star / Unstar current mail
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const targetId = selectedMailId || (activeMailIndex >= 0 && mailMessages[activeMailIndex]?.id);
        if (targetId) {
          starMutation.mutate(targetId);
        }
        return;
      }

      // 8. 'j' / 'ArrowDown' -> Move down in inbox message stream
      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (!selectedMailId && mailMessages.length > 0) {
          e.preventDefault();
          setActiveMailIndex((prev) => {
            const next = Math.min(prev + 1, mailMessages.length - 1);
            return next;
          });
        }
        return;
      }

      // 9. 'k' / 'ArrowUp' -> Move up in inbox message stream
      if (e.key === 'k' || e.key === 'ArrowUp') {
        if (!selectedMailId && mailMessages.length > 0) {
          e.preventDefault();
          setActiveMailIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            return next;
          });
        }
        return;
      }

      // 10. 'Enter' or 'o' -> Open active mail
      if ((e.key === 'Enter' || e.key === 'o') && !selectedMailId) {
        if (activeMailIndex >= 0 && activeMailIndex < mailMessages.length) {
          e.preventDefault();
          const target = mailMessages[activeMailIndex];
          if (target.is_draft) {
            openDraftInComposer(target);
          } else {
            setSelectedMailId(target.id);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedMailId, activeMailDetail, activeMailIndex, mailMessages, showCompose, previewAttachment, showShortcutsModal, resetComposeForm, starMutation, archiveMutation]);

  const filteredColleagues =
    colleagues?.filter((c) => {
      if (c.id === user?.id) return false;
      const search = recipientSearch.toLowerCase();
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      return fullName.includes(search) || c.email.toLowerCase().includes(search);
    }) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary shrink-0" />
            Mail & Internal Communications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gemini AI Composer, department broadcast channels, project context linking, and executive read receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcutsModal(true)}
            className="text-xs font-semibold gap-1.5 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 px-3"
            title="Press '?' for Keyboard Shortcuts"
          >
            <HelpCircle className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">?</kbd>
          </Button>

          <Button
            onClick={() => {
              resetComposeForm();
              setShowCompose(true);
              setComposerViewMode('normal');
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs h-9 px-4"
          >
            <Plus className="h-4 w-4" />
            <span>Compose</span>
            <kbd className="hidden sm:inline text-[10px] font-mono px-1 py-0.2 rounded bg-primary-foreground/20 text-primary-foreground">C</kbd>
          </Button>
        </div>
      </div>

      {/* Main Mail Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* 🗂️ Left Sidebar: Folders & Broadcast Channels */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-1">
            <button
              onClick={() => {
                setActiveFolder('inbox');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'inbox'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="h-4 w-4" />
                Inbox
              </div>
              {folderCounts.inbox_unread > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeFolder === 'inbox' ? 'bg-white text-primary' : 'bg-primary text-white'
                }`}>
                  {folderCounts.inbox_unread}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveFolder('starred');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'starred'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Starred
              </div>
              {folderCounts.starred > 0 && (
                <span className="text-[11px] opacity-80">{folderCounts.starred}</span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveFolder('announcements');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'announcements'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Announcements
              </div>
              {folderCounts.announcements_unread > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                  {folderCounts.announcements_unread} new
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveFolder('sent');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'sent'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="h-4 w-4" />
                Sent Mails
              </div>
            </button>

            <button
              onClick={() => {
                setActiveFolder('snoozed');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'snoozed'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-sky-500" />
                Snoozed
              </div>
              {(folderCounts.snoozed || 0) > 0 && (
                <span className="text-[11px] opacity-80">{folderCounts.snoozed}</span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveFolder('archived');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'archived'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Archive className="h-4 w-4 text-slate-400" />
                Archived
              </div>
            </button>

            <button
              onClick={() => {
                setActiveFolder('drafts');
                setSelectedMailId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'drafts'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-slate-400" />
                Drafts
              </div>
              {folderCounts.drafts > 0 && (
                <span className="text-[11px] opacity-80">{folderCounts.drafts}</span>
              )}
            </button>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowPreferencesModal(true)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-semibold p-1 rounded-lg transition-colors"
                title="Configure Email Signature & Out-of-Office"
              >
                <Settings className="h-3.5 w-3.5" />
                Signature & OOO
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-semibold p-1 rounded-lg transition-colors"
                title="Corporate Canned Email Templates"
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                Templates
              </button>
            </div>
          </Card>

          {/* Quick Broadcast Presets */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              1-Click Broadcast Channels
            </div>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  resetComposeForm();
                  setTargetMode('role');
                  setTargetRoleId('all_managers');
                  setCategoryTag('announcement');
                  setShowCompose(true);
                }}
                className="w-full text-left p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  All Managers & Leads
                </span>
                <Plus className="h-3 w-3 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  resetComposeForm();
                  setTargetMode('all');
                  setCategoryTag('announcement');
                  setShowCompose(true);
                }}
                className="w-full text-left p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  Company-Wide All Hands
                </span>
                <Plus className="h-3 w-3 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  resetComposeForm();
                  setCategoryTag('compliance');
                  setRequiresAcknowledgment(true);
                  setShowCompose(true);
                }}
                className="w-full text-left p-2 rounded-xl border border-purple-100 dark:border-purple-900/30 hover:border-purple-500 text-xs flex items-center justify-between bg-purple-50/40 dark:bg-purple-950/20 transition-all"
              >
                <span className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                  Policy Acknowledgment Memo
                </span>
                <Plus className="h-3 w-3 text-purple-400" />
              </button>
            </div>
          </Card>
        </div>

        {/* 📬 Middle / Main: Message List & Detail Viewer */}
        <div className="lg:col-span-9 space-y-4">
          
          {/* Filter & Search Bar */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search messages, sender, recipient, body... (Press / to search)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs bg-slate-50 dark:bg-slate-950"
                />
                <kbd className="absolute right-3 top-2.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 pointer-events-none hidden sm:inline">
                  /
                </kbd>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  <option value="all">All Categories</option>
                  <option value="announcement">Announcements</option>
                  <option value="action_required">Action Required</option>
                  <option value="fyi">FYI / Notices</option>
                  <option value="compliance">Policy & Compliance</option>
                </select>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchInbox()}
                  className="h-9 w-9 shrink-0 text-slate-500"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Messages List Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {inboxLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading messages...</div>
            ) : mailMessages.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-3">
                <Inbox className="h-8 w-8 mx-auto text-slate-400" />
                <p className="text-xs font-semibold">No messages in this folder.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mailMessages.map((mail, idx) => {
                  const isUnread = !mail.is_read;
                  const isUrgent = mail.priority === 'urgent';
                  const priorityMeta = PRIORITY_BADGES[mail.priority] || PRIORITY_BADGES.normal;
                  const categoryMeta = CATEGORY_TAGS[mail.category_tag] || CATEGORY_TAGS.general;
                  const CategoryIcon = categoryMeta.icon;
                  const isKeyboardActive = activeMailIndex === idx;

                  return (
                    <div
                      key={mail.id}
                      onClick={() => {
                        setActiveMailIndex(idx);
                        if (mail.is_draft) {
                          openDraftInComposer(mail);
                        } else {
                          setSelectedMailId(mail.id);
                        }
                      }}
                      className={`p-4 sm:p-4.5 flex items-start justify-between gap-4 cursor-pointer transition-all hover:bg-slate-50/70 dark:hover:bg-slate-800/40 relative ${
                        isKeyboardActive ? 'ring-2 ring-primary/80 bg-primary/10 dark:bg-primary/15' : isUnread ? 'bg-primary/5 font-semibold' : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isKeyboardActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                      )}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Star & Category Icon */}
                        <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              starMutation.mutate(mail.id);
                            }}
                            className="text-slate-400 hover:text-amber-500 transition-colors"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                mail.is_starred ? 'text-amber-500 fill-amber-500' : ''
                              }`}
                            />
                          </button>
                          <div className={`h-6 w-6 rounded-lg ${categoryMeta.bg} ${categoryMeta.color} flex items-center justify-center shrink-0`}>
                            <CategoryIcon className="h-3 w-3" />
                          </div>
                        </div>

                        {/* Text & Subject */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {mail.is_draft ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5" />
                                  [Draft]
                                </span>
                              ) : activeFolder === 'sent' ? (
                                `To: ${mail.recipients.map((r) => r.name).join(', ') || 'Team'}`
                              ) : (
                                mail.sender?.name
                              )}
                            </span>

                            {mail.broadcast_channel && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40">
                                📢 {mail.broadcast_channel}
                              </span>
                            )}

                            {isUrgent && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
                                🔥 URGENT
                              </span>
                            )}

                            {mail.requires_acknowledgment && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                mail.is_acknowledged
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300'
                              }`}>
                                {mail.is_acknowledged ? '✓ Acknowledged' : '⚠️ Acknowledgment Required'}
                              </span>
                            )}

                            {mail.linked_entity_title && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 flex items-center gap-1">
                                <FolderGit2 className="h-3 w-3" />
                                {mail.linked_entity_title}
                              </span>
                            )}
                          </div>

                          <div className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {mail.subject || '(Untitled Draft)'}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{new Date(mail.created_at).toLocaleString()}</span>
                            {activeFolder === 'sent' && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-slate-500 font-semibold" title="Delivered">
                                  <CheckCheck className="h-3 w-3 text-slate-400" />
                                  <span>Delivered</span>
                                </span>
                              </>
                            )}
                            {mail.attachments_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-500">
                                  <Paperclip className="h-3 w-3" />
                                  {mail.attachments_count} attachment{mail.attachments_count > 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {mail.is_draft ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDraftInComposer(mail);
                              }}
                              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                              title="Resume & Edit Draft"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete({ id: mail.id, subject: mail.subject, is_draft: mail.is_draft });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Discard Draft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSnoozeTargetMailId(mail.id);
                                setSnoozeModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Snooze / Remind Me Later"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveMutation.mutate(mail.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={mail.is_archived ? 'Move to Inbox' : 'Archive'}
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ─────────────────── 📖 Detailed Thread Viewer Modal ─────────────────── */}
      <Dialog open={!!selectedMailId} onOpenChange={(open) => !open && setSelectedMailId(null)}>
        <DialogContent className="sm:max-w-4xl w-[95vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
          {detailLoading || !activeMailDetail ? (
            <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading conversation thread...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Draft Alert Banner if viewing an unsent draft */}
              {activeMailDetail.is_draft && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-amber-600" />
                      Unsent Draft Message
                    </div>
                    <p className="text-[11px] opacity-80">
                      This message is saved in your drafts and has not been dispatched yet.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setItemToDelete({ id: activeMailDetail.id, subject: activeMailDetail.subject, is_draft: true });
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Discard Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openDraftInComposer(activeMailDetail)}
                      className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Resume & Edit Draft
                    </Button>
                  </div>
                </div>
              )}

              {/* Thread Header */}
              <div className="border-b border-border pb-5 space-y-3.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                    {activeMailDetail.subject || '(Untitled Draft)'}
                  </h2>

                  {!activeMailDetail.is_draft && (
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {/* ⚡ Pillar 3: Instant Meeting from Thread */}
                      <Button
                        size="sm"
                        onClick={handleSpawnInstantMeeting}
                        disabled={isSpawningMeeting}
                        className="text-xs font-semibold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs h-8 px-3"
                        title="Spin up an instant video meeting room inviting all thread participants"
                      >
                        {isSpawningMeeting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                        Instant Meeting
                      </Button>

                      {/* 📌 Pillar 3: Convert Entire Thread to Task */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTaskTitle(activeMailDetail.subject || 'Task from Email Thread');
                          const rootBodyText = stripHtml(activeMailDetail.body || '');
                          setTaskDescription(`Reference Email Thread: "${activeMailDetail.subject}"\n\n${rootBodyText.slice(0, 300)}...`);
                          setTaskPriority(activeMailDetail.priority === 'urgent' ? 'high' : activeMailDetail.priority === 'high' ? 'high' : 'medium');
                          setConvertTaskMailId(activeMailDetail.id);
                          setConvertTaskModalOpen(true);
                        }}
                        className="text-xs font-semibold gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 h-8 px-3"
                        title="Convert entire email thread into a tracked Project Task"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Convert to Task
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRunAiSummary}
                        disabled={aiSummaryLoading}
                        className="text-xs font-semibold gap-1.5 text-primary border-primary/30 hover:bg-primary/5 h-8 px-3"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {aiSummaryLoading ? 'Summarizing...' : 'AI TL;DR'}
                      </Button>

                      {activeMailDetail.read_receipts && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReceiptsModal(true)}
                          className="text-xs font-semibold gap-1.5 text-emerald-600 border-emerald-300 dark:border-emerald-900 hover:bg-emerald-50 h-8 px-3"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Receipts ({activeMailDetail.read_receipts.read_percentage}%)
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSnoozeTargetMailId(activeMailDetail.id);
                          setSnoozeModalOpen(true);
                        }}
                        className="text-xs font-semibold gap-1.5 text-sky-600 border-sky-300 dark:border-sky-900 hover:bg-sky-50 h-8 px-3"
                        title="Snooze thread until later"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Snooze
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate(activeMailDetail.id)}
                        className="text-xs font-semibold gap-1.5 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 h-8 px-3"
                        title="Archive thread"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        {activeMailDetail.is_archived ? 'Unarchive' : 'Archive'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Priority, Category & Linked Entity Badges */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {activeMailDetail.priority === 'urgent' && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300">
                      🔥 URGENT
                    </span>
                  )}

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                    {activeMailDetail.category_tag.replace('_', ' ')}
                  </span>

                  {activeMailDetail.broadcast_channel && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                      📢 {activeMailDetail.broadcast_channel}
                    </span>
                  )}

                  {activeMailDetail.linked_entity_title && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 flex items-center gap-1.5">
                      <FolderGit2 className="h-3 w-3" />
                      {activeMailDetail.linked_entity_type.toUpperCase()}: {activeMailDetail.linked_entity_title}
                    </span>
                  )}
                </div>

                {/* 🌐 Pillar 3: Rich Work-Graph Embed Card */}
                {workgraphCardLoading && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Loading connected Work-Graph details...
                  </div>
                )}
                {workgraphCardData && !workgraphCardLoading && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/5 via-slate-500/5 to-primary/5 border border-amber-200/60 dark:border-amber-900/40 shadow-xs space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-white uppercase tracking-wider flex items-center gap-1">
                          <FolderGit2 className="h-3 w-3" />
                          {workgraphCardData.type}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {workgraphCardData.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {workgraphCardData.status && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            workgraphCardData.status === 'completed' || workgraphCardData.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : workgraphCardData.status === 'live' || workgraphCardData.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {workgraphCardData.status}
                          </span>
                        )}
                        {workgraphCardData.link && (
                          <button
                            type="button"
                            onClick={() => navigate(workgraphCardData.link!)}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                          >
                            Open <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {workgraphCardData.type === 'task' && (
                        <>
                          {workgraphCardData.assignee_name && <span>👤 Assignee: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.assignee_name}</strong></span>}
                          {workgraphCardData.priority && <span>⚡ Priority: <strong className="text-slate-800 dark:text-slate-200 capitalize">{workgraphCardData.priority}</strong></span>}
                          {workgraphCardData.due_date && <span>📅 Due: <strong className="text-slate-800 dark:text-slate-200">{new Date(workgraphCardData.due_date).toLocaleDateString()}</strong></span>}
                        </>
                      )}
                      {workgraphCardData.type === 'project' && (
                        <>
                          {workgraphCardData.owner_name && <span>👑 Lead: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.owner_name}</strong></span>}
                          <span>📌 Total Tasks: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.tasks_count || 0}</strong></span>
                        </>
                      )}
                      {workgraphCardData.type === 'meeting' && (
                        <>
                          {workgraphCardData.room_code && <span>🔑 Room Code: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{workgraphCardData.room_code}</code></span>}
                          {workgraphCardData.scheduled_start && <span>⏰ Time: <strong className="text-slate-800 dark:text-slate-200">{new Date(workgraphCardData.scheduled_start).toLocaleString()}</strong></span>}
                          <span>👥 Participants: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.participant_count || 0}</strong></span>
                        </>
                      )}
                      {workgraphCardData.type === 'expense' && (
                        <>
                          <span>💰 Amount: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.currency} {workgraphCardData.amount}</strong></span>
                          {workgraphCardData.merchant && <span>🏪 Merchant: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.merchant}</strong></span>}
                          {workgraphCardData.employee_name && <span>👤 Submitter: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.employee_name}</strong></span>}
                        </>
                      )}
                      {workgraphCardData.type === 'document' && (
                        <>
                          {workgraphCardData.file_type && <span className="uppercase font-mono">📄 {workgraphCardData.file_type}</span>}
                          {workgraphCardData.file_size ? <span>💾 {formatBytes(workgraphCardData.file_size)}</span> : null}
                          {workgraphCardData.allowed_roles && (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-amber-500" />
                              Roles: <strong className="text-slate-800 dark:text-slate-200">{workgraphCardData.allowed_roles}</strong>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 🎯 AI Sentiment & Intent Triage Pill */}
                {emailIntent && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-xs mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {emailIntent.intent}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Sentiment: {emailIntent.sentiment}
                      </span>
                      {emailIntent.urgency && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          emailIntent.urgency === 'Urgent' || emailIntent.urgency === 'High'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {emailIntent.urgency} Urgency
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {emailIntent.estimated_read_minutes || 1} min read
                      </span>
                    </div>
                    {emailIntent.key_ask && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Key Ask: </span>
                        "{emailIntent.key_ask}"
                      </div>
                    )}
                  </div>
                )}

                {/* Compliance Acknowledgment Action Banner */}
                {activeMailDetail.requires_acknowledgment && (
                  <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-2">
                    <div className="text-xs text-purple-900 dark:text-purple-200 space-y-0.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-purple-600" />
                        Executive Policy Acknowledgment Required
                      </div>
                      <p className="text-[11px] opacity-80">
                        The sender has requested all recipients formally confirm they have reviewed this policy update.
                      </p>
                    </div>

                    {activeMailDetail.is_acknowledged ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Acknowledged ({activeMailDetail.acknowledged_at ? new Date(activeMailDetail.acknowledged_at).toLocaleDateString() : 'Confirmed'})
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => acknowledgeMutation.mutate(activeMailDetail.id)}
                        disabled={acknowledgeMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 shrink-0 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Acknowledge & Confirm Read
                      </Button>
                    )}
                  </div>
                )}

                {/* ✨ AI Thread TL;DR Summary Card */}
                {aiSummary && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3 animate-in fade-in duration-300 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Gemini AI Thread TL;DR
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                        Sentiment: {aiSummary.sentiment}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 italic">
                      "{aiSummary.tldr_summary}"
                    </p>

                    {aiSummary.key_points && aiSummary.key_points.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                          Key Takeaways
                        </div>
                        <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc list-inside space-y-0.5">
                          {aiSummary.key_points.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Extracted Action Items with 1-Click Project Task Converter */}
                    {aiSummary.action_items && aiSummary.action_items.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                          Detected Action Items ({aiSummary.action_items.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {aiSummary.action_items.map((item, i) => (
                            <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 flex items-start justify-between gap-2 shadow-xs">
                              <div className="space-y-0.5">
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{item.task}</div>
                                <div className="text-[10px] text-slate-400">
                                  Assignee: {item.assignee} • Due: {item.due_date}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTaskTitle(item.task);
                                  setTaskDescription(`Action item extracted from email thread "${activeMailDetail.subject}"`);
                                  setTaskDueDate(item.due_date !== 'Upcoming' ? item.due_date : '');
                                  setTaskPriority(item.priority || 'medium');
                                  setConvertTaskModalOpen(true);
                                }}
                                className="h-7 text-[10px] font-bold text-primary hover:bg-primary/10 border-primary/30 shrink-0"
                              >
                                <Plus className="h-3 w-3" />
                                Task
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thread Messages Stream */}
              <div className="space-y-4">
                {[activeMailDetail, ...(activeMailDetail.replies || [])].map((msg, index) => {
                  const isExpanded = expandedMessageIds[msg.id] ?? true;

                  return (
                    <Card key={msg.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                      <div
                        onClick={() => setExpandedMessageIds((prev) => ({ ...prev, [msg.id]: !isExpanded }))}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-b border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                              {msg.sender.name.charAt(0)}
                            </div>
                            {presenceMap[msg.sender.id] && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                                  presenceMap[msg.sender.id].status === 'online'
                                    ? 'bg-emerald-500'
                                    : presenceMap[msg.sender.id].status === 'in_meeting'
                                    ? 'bg-amber-500 animate-pulse'
                                    : presenceMap[msg.sender.id].status === 'ooo'
                                    ? 'bg-rose-500'
                                    : 'bg-slate-400'
                                }`}
                                title={`${presenceMap[msg.sender.id].label}: ${presenceMap[msg.sender.id].detail}`}
                              />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{msg.sender.name} &lt;{msg.sender.email}&gt;</span>
                              {presenceMap[msg.sender.id] && presenceMap[msg.sender.id].status !== 'offline' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  presenceMap[msg.sender.id].status === 'online'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : presenceMap[msg.sender.id].status === 'in_meeting'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}>
                                  {presenceMap[msg.sender.id].label}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>{new Date(msg.created_at).toLocaleString()}</span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              {msg.id === activeMailDetail.id && activeMailDetail.read_receipts ? (
                                activeMailDetail.read_receipts.read_count > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"
                                    title={`Read by ${activeMailDetail.read_receipts.read_count} of ${activeMailDetail.read_receipts.total_recipients} recipients (${activeMailDetail.read_receipts.read_percentage}%)`}
                                  >
                                    <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Read ({activeMailDetail.read_receipts.read_count})</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-slate-400 font-semibold"
                                    title="Delivered to all recipient mailboxes"
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    <span>Delivered</span>
                                  </span>
                                )
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-slate-400 font-semibold"
                                  title="Sent and delivered"
                                >
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  <span>Delivered</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTranslateMessage(msg.id, msg.body, 'English');
                            }}
                            disabled={translatingMessageId === msg.id}
                            className={`p-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                              translatedMessages[msg.id]
                                ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title="Instant Multi-Language Translation"
                          >
                            {translatingMessageId === msg.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                            ) : (
                              <Languages className="h-3.5 w-3.5" />
                            )}
                            <span className="text-[10px] hidden sm:inline">
                              {translatedMessages[msg.id] ? 'Original' : 'Translate'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              starMutation.mutate(msg.id);
                            }}
                            className="text-slate-400 hover:text-amber-500"
                          >
                            <Star className={`h-4 w-4 ${msg.is_starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                          </button>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-5 space-y-4">
                          {translatedMessages[msg.id] && (
                            <div className="flex items-center justify-between text-[11px] font-bold text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/50 p-2.5 rounded-xl border border-sky-200 dark:border-sky-800 animate-in fade-in">
                              <span className="flex items-center gap-1.5">
                                <Languages className="h-3.5 w-3.5 text-sky-600" />
                                Translated from {translatedMessages[msg.id].detected_source_language} to {translatedMessages[msg.id].target_language}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleTranslateMessage(msg.id, msg.body, 'English')}
                                className="text-[10px] text-sky-700 dark:text-sky-300 hover:underline font-bold"
                              >
                                View Original Text
                              </button>
                            </div>
                          )}

                          <div
                            className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 prose dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: translatedMessages[msg.id]?.translated_html || msg.body }}
                          />

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="pt-3 border-t border-border space-y-2">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Attached Files ({msg.attachments.length})
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {msg.attachments.map((att) => {
                                  const isImg = att.file_name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                                  const isPdf = att.file_name.match(/\.pdf$/i);
                                  return (
                                    <div
                                      key={att.id}
                                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-xs"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                                      <span className="truncate max-w-[180px]">{att.file_name}</span>
                                      <span className="text-[10px] text-slate-400">({formatBytes(att.file_size)})</span>

                                      {(isImg || isPdf) && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewAttachment({
                                            url: `/api/communications/attachment/${att.id}/`,
                                            fileName: att.file_name,
                                            isImage: !!isImg,
                                            isPdf: !!isPdf
                                          })}
                                          className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-primary"
                                          title="Instant Document Preview"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleDownloadAttachment(att.id, att.file_name)}
                                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        title="Download File"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Quick Reply Box */}
              {!activeMailDetail.is_draft && (
                <div className="pt-2 border-t border-border space-y-3">
                  {/* ✨ Dynamic Smart Reply Chips */}
                  {smartReplies && smartReplies.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                          Suggested Smart Replies
                        </div>
                        <button
                          type="button"
                          onClick={handleReloadSmartReplies}
                          disabled={smartRepliesLoading}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
                          title="Generate new reply options"
                        >
                          <RefreshCw className={`h-2.5 w-2.5 ${smartRepliesLoading ? 'animate-spin' : ''}`} />
                          Refresh Suggestions
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {smartReplies.map((reply, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setShowQuickReply(true);
                              setQuickReplyBody(reply.body_html);
                              if (quickReplyEditorRef.current) {
                                quickReplyEditorRef.current.innerHTML = reply.body_html;
                                quickReplyEditorRef.current.focus();
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs flex items-center gap-1.5 ${
                              reply.type === 'affirmative'
                                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                                : reply.type === 'clarification'
                                ? 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/70 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>{reply.label}</span>
                            <ArrowRight className="h-3 w-3 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!showQuickReply ? (
                    <Button
                      onClick={() => setShowQuickReply(true)}
                      className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs"
                    >
                      <CornerUpLeft className="h-4 w-4" />
                      Quick Reply
                    </Button>
                  ) : (
                    <form onSubmit={handleQuickReplySubmit} className="space-y-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CornerUpLeft className="h-4 w-4 text-primary" />
                        Reply to Thread
                      </div>

                      <div
                        ref={quickReplyEditorRef}
                        contentEditable
                        onInput={handleQuickReplyChange}
                        className="min-h-[100px] max-h-[250px] overflow-y-auto p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                      />

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            multiple
                            ref={quickReplyFileInputRef}
                            onChange={(e) => setQuickReplyAttachments(Array.from(e.target.files || []))}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => quickReplyFileInputRef.current?.click()}
                            className="text-xs font-semibold gap-1"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Attach File
                          </Button>
                          {quickReplyAttachments.length > 0 && (
                            <span className="text-[11px] text-slate-500">
                              {quickReplyAttachments.length} file(s) selected
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowQuickReply(false)}
                            className="text-xs font-semibold"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={composeMutation.isPending}
                            className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs"
                          >
                            {composeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────── ✍️ Full Compose Message Modal ─────────────────── */}
      <Dialog
        open={showCompose && composerViewMode !== 'docked'}
        onOpenChange={(open) => {
          setShowCompose(open);
          if (!open) setComposerViewMode('normal');
        }}
      >
        <DialogContent
          className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-y-auto transition-all duration-200 ${
            composerViewMode === 'fullscreen'
              ? 'sm:max-w-5xl w-[95vw] h-[92vh] max-h-[92vh]'
              : 'sm:max-w-2xl max-h-[90vh]'
          }`}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Compose New Message & Broadcast
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAiCopilot(!showAiCopilot)}
                  className="text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5 gap-1.5 shadow-xs h-8"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Gemini AI</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setComposerViewMode('docked')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Minimize to bottom dock (browse inbox while drafting)"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setComposerViewMode(composerViewMode === 'fullscreen' ? 'normal' : 'fullscreen')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title={composerViewMode === 'fullscreen' ? 'Standard dialog size' : 'Expand to full screen'}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {composeError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {composeError}
              </div>
            )}

            {/* ✨ Floating Gemini AI Smart Compose Box */}
            {showAiCopilot && (
              <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-3 animate-in fade-in duration-200">
                <div className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Gemini AI Composer & Tone Polisher
                </div>
                <Input
                  placeholder="e.g. Announce the launch of CORE 2.0 and ask everyone to check their tasks"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Tone:</span>
                    <select
                      value={aiTone}
                      onChange={(e: any) => setAiTone(e.target.value)}
                      className="text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 text-slate-800 dark:text-slate-200 font-semibold"
                    >
                      <option value="executive">Executive & Professional</option>
                      <option value="concise">Concise & Direct</option>
                      <option value="friendly">Friendly & Warm</option>
                      <option value="urgent">Urgent & Direct</option>
                      <option value="formal">Formal & Corporate</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleRunAiCompose}
                    disabled={isAiGenerating || !aiPrompt.trim()}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    {isAiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isAiGenerating ? 'Drafting...' : 'Generate with Gemini'}
                  </Button>
                </div>
              </div>
            )}

            {/* 🏢 Broadcast Channel Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Target Audience / Recipients
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTargetMode('individual')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    targetMode === 'individual'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Specific People
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('department')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    targetMode === 'department'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Department
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('role')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    targetMode === 'role'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Role Preset
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('project')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    targetMode === 'project'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Project Team
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('all')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    targetMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All People ({channelsMeta?.total_org_members || 'All'})
                </button>
              </div>

              {/* Target options based on mode */}
              {targetMode === 'individual' && (
                <div className="space-y-2 pt-1">
                  <div
                    onClick={() => recipientInputRef.current?.focus()}
                    className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 min-h-[46px] cursor-text focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
                  >
                    {selectedRecipients.map((rId) => {
                      const c = colleagues?.find((item) => item.id === rId);
                      const pres = presenceMap[rId];
                      return (
                        <span
                          key={rId}
                          className="pl-1.5 pr-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-1.5 animate-in zoom-in-95 duration-150"
                        >
                          <div className="relative">
                            <div className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center">
                              {c?.first_name?.[0] || 'U'}
                            </div>
                            {pres && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white dark:ring-slate-900 ${
                                  pres.status === 'online'
                                    ? 'bg-emerald-500'
                                    : pres.status === 'in_meeting'
                                    ? 'bg-amber-500 animate-pulse'
                                    : pres.status === 'ooo'
                                    ? 'bg-rose-500'
                                    : 'bg-slate-400'
                                }`}
                                title={`${pres.label}: ${pres.detail}`}
                              />
                            )}
                          </div>
                          <span>{c ? `${c.first_name} ${c.last_name}` : rId}</span>
                          {c?.role && (
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {c.role}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = selectedRecipients.filter((id) => id !== rId);
                              setSelectedRecipients(next);
                              checkOooRecipients(next);
                            }}
                            className="ml-0.5 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    <input
                      ref={recipientInputRef}
                      placeholder={selectedRecipients.length === 0 ? 'Type name or email (Enter to add, Backspace to remove)...' : 'Add another...'}
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && recipientSearch === '' && selectedRecipients.length > 0) {
                          e.preventDefault();
                          const next = selectedRecipients.slice(0, -1);
                          setSelectedRecipients(next);
                          checkOooRecipients(next);
                        } else if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          if (filteredColleagues.length > 0) {
                            const top = filteredColleagues[0];
                            if (!selectedRecipients.includes(top.id)) {
                              const next = [...selectedRecipients, top.id];
                              setSelectedRecipients(next);
                              checkOooRecipients(next);
                            }
                            setRecipientSearch('');
                          } else if (recipientSearch.trim().includes('@')) {
                            const customEmail = recipientSearch.trim().replace(/,/g, '');
                            if (!selectedRecipients.includes(customEmail)) {
                              setSelectedRecipients([...selectedRecipients, customEmail]);
                            }
                            setRecipientSearch('');
                          }
                        }
                      }}
                      className="bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-hidden flex-1 min-w-[150px] py-1"
                    />
                  </div>

                  {/* 🏖️ Real-Time OOO Alert Banner */}
                  {oooRecipientsWarning.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1 animate-in fade-in duration-200">
                      <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <BellOff className="h-4 w-4 shrink-0" />
                        <span>Recipient Out-of-Office Notice</span>
                      </div>
                      {oooRecipientsWarning.map((ooo, i) => (
                        <p key={i} className="text-[11px] leading-relaxed">
                          <strong>{ooo.name}</strong> is out of office until <strong>{ooo.end_date}</strong>: <em>"{ooo.message}"</em>
                        </p>
                      ))}
                    </div>
                  )}

                  {recipientSearch && (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl space-y-1">
                      {filteredColleagues.map((c) => {
                        const pres = presenceMap[c.id];
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              if (!selectedRecipients.includes(c.id)) {
                                const nextRecs = [...selectedRecipients, c.id];
                                setSelectedRecipients(nextRecs);
                                checkOooRecipients(nextRecs);
                              }
                              setRecipientSearch('');
                              recipientInputRef.current?.focus();
                            }}
                            className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                  {c.first_name?.[0] || 'U'}
                                </div>
                                {pres && (
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white dark:ring-slate-900 ${
                                      pres.status === 'online'
                                        ? 'bg-emerald-500'
                                        : pres.status === 'in_meeting'
                                        ? 'bg-amber-500'
                                        : pres.status === 'ooo'
                                        ? 'bg-rose-500'
                                        : 'bg-slate-400'
                                    }`}
                                  />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{c.first_name} {c.last_name}</span>
                                  {c.role && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                      {c.role}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{c.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {pres && pres.status !== 'offline' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  pres.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                                  pres.status === 'in_meeting' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                                  'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {pres.label}
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-primary opacity-60">
                                ↵ Add
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {recipientSearch.trim().includes('@') && !colleagues?.some((c) => c.email?.toLowerCase() === recipientSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            const customEmail = recipientSearch.trim().replace(/,/g, '');
                            if (!selectedRecipients.includes(customEmail)) {
                              setSelectedRecipients([...selectedRecipients, customEmail]);
                            }
                            setRecipientSearch('');
                            recipientInputRef.current?.focus();
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-primary/10 text-xs flex items-center justify-between text-primary font-medium transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-primary/20 text-primary">✉️</span>
                            <span>Add external email: <strong>{recipientSearch.trim()}</strong></span>
                          </div>
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Brevo Relay
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {targetMode === 'department' && (
                <div className="pt-1">
                  <select
                    value={targetDepartmentId}
                    onChange={(e) => setTargetDepartmentId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="">-- Choose Target Department --</option>
                    {channelsMeta?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        🏢 {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === 'role' && (
                <div className="pt-1">
                  <select
                    value={targetRoleId}
                    onChange={(e) => setTargetRoleId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    {channelsMeta?.role_presets.map((r) => (
                      <option key={r.id} value={r.id}>
                        👑 {r.label} ({r.count} members)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === 'project' && (
                <div className="pt-1">
                  <select
                    value={targetProjectId}
                    onChange={(e) => setTargetProjectId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="">-- Choose Project Team --</option>
                    {channelsMeta?.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        🎯 {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Subject Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Subject
              </label>
              <Input
                placeholder="e.g. Q3 Engineering Review & Sprint Roadmap"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
                required
              />
            </div>

            {/* Reusable Template Insertion Bar */}
            {templatesList.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                  <span>Insert Corporate Template:</span>
                </div>
                <select
                  onChange={(e) => {
                    const selectedT = templatesList.find((t) => t.id === e.target.value);
                    if (selectedT) {
                      setComposeSubject(selectedT.subject);
                      const withSig = includeSignatureDefault && userSignature
                        ? `${selectedT.body_html}<p><br></p><div class="core-mail-signature">${userSignature}</div>`
                        : selectedT.body_html;
                      setComposeBody(withSig);
                      if (editorRef.current) {
                        editorRef.current.innerHTML = withSig;
                      }
                    }
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
                >
                  <option value="" disabled>Choose a Template to Populate...</option>
                  {templatesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      📑 {t.title} ({t.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category, Priority & Compliance Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Category Tag
                </label>
                <select
                  value={categoryTag}
                  onChange={(e: any) => setCategoryTag(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-semibold"
                >
                  <option value="general">General</option>
                  <option value="announcement">Announcement</option>
                  <option value="action_required">Action Required</option>
                  <option value="fyi">FYI / Notice</option>
                  <option value="compliance">Policy & Compliance</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-semibold"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="reqAckCheck"
                  checked={requiresAcknowledgment}
                  onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="reqAckCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Require Read Acknowledgment
                </label>
              </div>
            </div>

            {/* 🏷️ Context Linking (The CORE Work Graph) */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-amber-500" />
                Attach Context from CORE Work Graph (Optional)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <select
                    value={linkedEntityType}
                    onChange={(e) => {
                      setLinkedEntityType(e.target.value);
                      setLinkedEntityId('');
                      setLinkedEntityTitle('');
                    }}
                    className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">No Context Linked</option>
                    <option value="project">🎯 Project</option>
                    <option value="meeting">📅 Meeting Room</option>
                    <option value="expense">💳 Expense Claim</option>
                    <option value="document">📄 Knowledge Document</option>
                  </select>
                </div>

                {linkedEntityType === 'project' && (
                  <div>
                    <select
                      value={linkedEntityId}
                      onChange={(e) => {
                        setLinkedEntityId(e.target.value);
                        const p = projects.find((item: any) => item.id === e.target.value);
                        setLinkedEntityTitle(p ? p.name : '');
                      }}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Project --</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkedEntityType === 'meeting' && (
                  <div>
                    <select
                      value={linkedEntityId}
                      onChange={(e) => {
                        setLinkedEntityId(e.target.value);
                        const m = meetings.find((item: any) => item.id === e.target.value);
                        setLinkedEntityTitle(m ? m.title : '');
                      }}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Meeting Room --</option>
                      {meetings.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.room_name || 'Virtual'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkedEntityType === 'expense' && (
                  <div>
                    <select
                      value={linkedEntityId}
                      onChange={(e) => {
                        setLinkedEntityId(e.target.value);
                        const exp = expenses.find((item: any) => item.id === e.target.value);
                        setLinkedEntityTitle(exp ? `${exp.title} ($${exp.amount})` : '');
                      }}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Expense Claim --</option>
                      {expenses.map((exp: any) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.title} - ${exp.amount} {exp.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkedEntityType === 'document' && (
                  <div>
                    <select
                      value={linkedEntityId}
                      onChange={(e) => {
                        setLinkedEntityId(e.target.value);
                        const doc = documents.find((item: any) => item.id === e.target.value);
                        setLinkedEntityTitle(doc ? (doc.title || doc.name) : '');
                      }}
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">-- Choose Knowledge Document --</option>
                      {documents.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                          📄 {doc.title || doc.name} ({doc.allowed_roles ? `Roles: ${doc.allowed_roles}` : 'All'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Rich Editor Body with Formatting Toolbar and Quick AI Refiner Bar */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Message Body
                </label>

                {/* ✨ 1-Click AI Tone Refiner & Actions Bar */}
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAiGenerating}
                    onClick={() => handleQuickAiTransform('polish', 'executive')}
                    className="h-6 px-2 text-[10px] font-bold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 hover:bg-purple-100"
                    title="Polish phrasing into Executive workplace tone"
                  >
                    <Sparkles className="h-3 w-3 text-purple-600 mr-1" />
                    Executive Polish
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLengthSlider(!showLengthSlider)}
                    className={`h-6 px-2 text-[10px] font-bold transition-all ${
                      showLengthSlider
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'text-primary border-primary/30 hover:bg-primary/10'
                    }`}
                    title="Toggle Elaborate / Shorten interactive range slider"
                  >
                    <SlidersHorizontal className="h-3 w-3 mr-1" />
                    Slider ({LENGTH_SLIDER_PRESETS[lengthSliderLevel - 1].label})
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAiGenerating || isAdjustingLength}
                    onClick={() => handleApplyLengthSlider(1)}
                    className="h-6 px-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Quick Cut to Bullets (Level 1)"
                  >
                    ✂️ Shorten
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAiGenerating || isAdjustingLength}
                    onClick={() => handleApplyLengthSlider(5)}
                    className="h-6 px-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Quick Deep Elaboration (Level 5)"
                  >
                    📝 Elaborate
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAiGenerating || isAdjustingLength}
                    onClick={() => handleQuickAiTransform('fix_grammar', 'formal')}
                    className="h-6 px-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100"
                    title="Fix spelling and sentence grammar"
                  >
                    ✓ Fix Grammar
                  </Button>

                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                    <select
                      value={composerTranslateLang}
                      onChange={(e) => setComposerTranslateLang(e.target.value)}
                      className="h-6 text-[10px] rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 text-slate-700 dark:text-slate-300 font-semibold"
                    >
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Mandarin Chinese">Chinese</option>
                      <option value="English">English</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isComposerTranslating}
                      onClick={() => handleTranslateDraft(composerTranslateLang)}
                      className="h-6 px-1.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/40 hover:bg-sky-100"
                      title="Translate Draft to target language"
                    >
                      {isComposerTranslating ? (
                        <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
                      ) : (
                        <Languages className="h-3 w-3 text-sky-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 🎛️ Manual Text Styling Toolbar (Bold, Italic, Underline, Strikethrough, Headings, Lists, Quotes) */}
              <div className="flex items-center flex-wrap gap-1 p-1.5 bg-slate-100/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('bold');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="h-3.5 w-3.5 font-bold" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('italic');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('underline');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('strikeThrough');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Strikethrough"
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('formatBlock', '<h3>');
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                  title="Section Header"
                >
                  H1
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('formatBlock', '<h4>');
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                  title="Subheader"
                >
                  H2
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('formatBlock', '<p>');
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  title="Normal Paragraph"
                >
                  Text
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('insertUnorderedList');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Bullet List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('insertOrderedList');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Numbered List"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('formatBlock', '<blockquote>');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Blockquote"
                >
                  <Quote className="h-3.5 w-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeFormatCommand('removeFormat');
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors"
                  title="Clear Formatting"
                >
                  <RemoveFormatting className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 📏 Elaborate / Shorten Interactive Slider HUD */}
              {showLengthSlider && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Draft Length & Depth Slider
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {LENGTH_SLIDER_PRESETS[lengthSliderLevel - 1].icon} Level {lengthSliderLevel}: {LENGTH_SLIDER_PRESETS[lengthSliderLevel - 1].label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {originalDraftBackup && (
                        <button
                          type="button"
                          onClick={handleRevertDraft}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 hover:underline"
                          title="Revert back to original draft text"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Revert Original
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowLengthSlider(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>⚡ Ultra-Short (Cut Fluff)</span>
                      <span className="text-slate-400">⚖️ Balanced (Level 3)</span>
                      <span>📚 In-Depth Elaboration</span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={lengthSliderLevel}
                      disabled={isAdjustingLength}
                      onChange={(e) => handleApplyLengthSlider(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
                    />

                    {/* 5 Interactive Notch Cards */}
                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      {LENGTH_SLIDER_PRESETS.map((p) => {
                        const isActive = lengthSliderLevel === p.level;
                        return (
                          <button
                            key={p.level}
                            type="button"
                            onClick={() => handleApplyLengthSlider(p.level)}
                            disabled={isAdjustingLength}
                            className={`p-1.5 rounded-xl text-center transition-all border ${
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                : 'bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold leading-tight">{p.icon} {p.label}</div>
                            <div className={`text-[9px] ${isActive ? 'text-primary-foreground/80' : 'text-slate-400'}`}>
                              {p.sublabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white/70 dark:bg-slate-900/70 p-2 rounded-xl border border-border flex items-center justify-between">
                    <span>"{LENGTH_SLIDER_PRESETS[lengthSliderLevel - 1].desc}"</span>
                    {isAdjustingLength && (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1 shrink-0 ml-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Rescaling draft...
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div
                ref={(el) => {
                  editorRef.current = el;
                  if (el && composeBody && el.innerHTML !== composeBody) {
                    el.innerHTML = composeBody;
                  }
                }}
                contentEditable
                onInput={handleEditorChange}
                className="min-h-[160px] max-h-[300px] overflow-y-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden prose dark:prose-invert max-w-none"
              />
            </div>

            {/* File Attachments & Drag-and-Drop Dropzone */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  File Attachments & Documents
                </label>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    setAttachments(prev => [...prev, ...newFiles]);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold gap-1"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Add Files
                </Button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAttachment(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAttachment(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAttachment(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const droppedFiles = Array.from(e.dataTransfer.files);
                    setAttachments(prev => [...prev, ...droppedFiles]);
                  }
                }}
                className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
                  isDraggingAttachment
                    ? 'border-primary bg-primary/10 text-primary scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-800 hover:border-primary/50 bg-slate-50/50 dark:bg-slate-950/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-[11px] text-slate-500">
                  Drag & drop files here, or <span className="text-primary font-bold">browse from your computer</span> (PDFs, images & documents previewable inline)
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 mt-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {attachments.map((f, i) => {
                    const isImg = f.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                    const isPdf = f.name.match(/\.pdf$/i);
                    return (
                      <span
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-2xs"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[150px] font-semibold">{f.name}</span>
                        <span className="text-[10px] text-slate-400">({formatBytes(f.size)})</span>

                        {(isImg || isPdf) && (
                          <button
                            type="button"
                            onClick={() => {
                              const objUrl = URL.createObjectURL(f);
                              setPreviewAttachment({
                                url: objUrl,
                                fileName: f.name,
                                isImage: !!isImg,
                                isPdf: !!isPdf,
                              });
                            }}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-primary transition-colors"
                            title="Preview file inline"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition-colors"
                          title="Remove file"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleComposeSubmit(true)}
                disabled={composeMutation.isPending}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Save as Draft
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompose(false)}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={() => handleComposeSubmit(false)}
                  disabled={composeMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs"
                >
                  {composeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Message
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 📌 Floating Docked / Minimized Composer Bar */}
      {showCompose && composerViewMode === 'docked' && (
        <div className="fixed bottom-4 right-6 w-96 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 truncate pr-2">
              <Send className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-bold truncate">
                {composeSubject || 'New Message (Draft)'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setComposerViewMode('normal')}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Expand Composer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompose(false);
                  setComposerViewMode('normal');
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Close Draft"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium truncate">
              {selectedRecipients.length > 0 ? `${selectedRecipients.length} recipient(s)` : 'No recipients yet'}
            </span>
            <button
              type="button"
              onClick={() => setComposerViewMode('normal')}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Click to resume editing →
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── 📊 Read Receipts Breakdown Modal ─────────────────── */}
      <Dialog open={showReceiptsModal} onOpenChange={setShowReceiptsModal}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Executive Read Receipts & Engagement
            </DialogTitle>
          </DialogHeader>

          {activeMailDetail?.read_receipts && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Read Rate</div>
                  <div className="text-xl font-extrabold text-emerald-900 dark:text-white">
                    {activeMailDetail.read_receipts.read_percentage}%
                  </div>
                  <div className="text-[10px] text-emerald-600">
                    {activeMailDetail.read_receipts.read_count} of {activeMailDetail.read_receipts.total_recipients} read
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Acknowledged</div>
                  <div className="text-xl font-extrabold text-purple-900 dark:text-white">
                    {activeMailDetail.read_receipts.acknowledged_percentage}%
                  </div>
                  <div className="text-[10px] text-purple-600">
                    {activeMailDetail.read_receipts.acknowledged_count} of {activeMailDetail.read_receipts.total_recipients} confirmed
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Recipient Status List
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2 bg-slate-50 dark:bg-slate-950">
                  {activeMailDetail.read_receipts.recipients.map((r) => (
                    <div key={r.id} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-border flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                        <div className="text-[10px] text-slate-400">{r.email}</div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className={`text-[10px] font-bold ${r.is_read ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {r.is_read ? `Read ${r.read_at || ''}` : 'Unread'}
                        </div>
                        {r.is_acknowledged && (
                          <div className="text-[9px] font-bold text-purple-600">
                            ✓ Acknowledged
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────── ➕ Convert Action Item to Project Task Modal ─────────────────── */}
      <Dialog open={convertTaskModalOpen} onOpenChange={setConvertTaskModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Convert Email Action Item to Task
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target Project
              </label>
              <select
                value={taskTargetProjectId}
                onChange={(e) => setTaskTargetProjectId(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-semibold"
                required
              >
                <option value="">-- Choose Project --</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    🎯 {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Task Title
              </label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Description / Context
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Assignee
                </label>
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs text-slate-900 dark:text-white font-semibold"
                >
                  <option value="">Me (Default)</option>
                  {colleagues?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setConvertTaskModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!taskTargetProjectId) {
                    coreAlert({
                      title: 'Project Selection Required',
                      description: 'Please select a destination project before creating the task.',
                      variant: 'warning',
                      icon: <AlertCircle className="h-5 w-5" />,
                    });
                    return;
                  }
                  convertTaskMutation.mutate({
                    project_id: taskTargetProjectId,
                    title: taskTitle,
                    description: taskDescription,
                    assignee_id: taskAssigneeId || undefined,
                    due_date: taskDueDate || undefined,
                    priority: taskPriority,
                    message_id: convertTaskMailId || undefined,
                  });
                }}
                disabled={convertTaskMutation.isPending}
                className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5"
              >
                {convertTaskMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Project Task
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── 🗑️ Core Themed Delete / Discard Modal ─────────────────── */}
      <DeleteConfirmModal
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title={itemToDelete?.is_draft ? "Discard Draft Message?" : "Delete Message?"}
        description={
          itemToDelete?.is_draft
            ? `Are you sure you want to discard this draft? All unsaved contents and attachments will be permanently removed.`
            : `Are you sure you want to delete "${itemToDelete?.subject || 'this message'}"?`
        }
        warning={itemToDelete?.is_draft ? "This action cannot be undone." : undefined}
        confirmLabel={itemToDelete?.is_draft ? "Discard Draft" : "Delete"}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.id);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
      {/* ─────────────────── ⏱️ Floating Undo Send Grace Period HUD ─────────────────── */}
      {undoSendCountdown !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-2xl border border-slate-700">
            <Timer className="h-4 w-4 text-amber-400 animate-spin" />
            <span>Sending message in <span className="text-amber-400 font-extrabold">{undoSendCountdown}s</span>...</span>
            <button
              type="button"
              onClick={handleAbortUndoSend}
              className="ml-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors shadow-sm"
            >
              Undo Send
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── ⏰ Snooze / Remind Me Modal ─────────────────── */}
      <Dialog open={snoozeModalOpen} onOpenChange={setSnoozeModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-500" />
              Snooze Conversation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Temporarily remove this thread from your inbox until you are ready to review it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <button
              type="button"
              onClick={() => snoozeTargetMailId && snoozeMutation.mutate({ id: snoozeTargetMailId, preset: 'tomorrow_9am' })}
              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 text-xs flex items-center justify-between transition-all"
            >
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Tomorrow Morning</p>
                <p className="text-[11px] text-slate-500">Tomorrow at 9:00 AM</p>
              </div>
              <Clock className="h-4 w-4 text-sky-500" />
            </button>

            <button
              type="button"
              onClick={() => snoozeTargetMailId && snoozeMutation.mutate({ id: snoozeTargetMailId, preset: 'this_weekend' })}
              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 text-xs flex items-center justify-between transition-all"
            >
              <div>
                <p className="font-bold text-slate-900 dark:text-white">This Weekend</p>
                <p className="text-[11px] text-slate-500">Saturday at 10:00 AM</p>
              </div>
              <Calendar className="h-4 w-4 text-sky-500" />
            </button>

            <button
              type="button"
              onClick={() => snoozeTargetMailId && snoozeMutation.mutate({ id: snoozeTargetMailId, preset: 'next_monday' })}
              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 text-xs flex items-center justify-between transition-all"
            >
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Next Week</p>
                <p className="text-[11px] text-slate-500">Monday at 9:00 AM</p>
              </div>
              <ArrowRight className="h-4 w-4 text-sky-500" />
            </button>

            <button
              type="button"
              onClick={() => snoozeTargetMailId && snoozeMutation.mutate({ id: snoozeTargetMailId, preset: 'clear' })}
              className="w-full text-center p-2 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors pt-2"
            >
              Clear Snooze (Move to Inbox)
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── 📎 Forgotten Attachment Warning Modal ─────────────────── */}
      <Dialog open={showForgottenAttachmentModal} onOpenChange={setShowForgottenAttachmentModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Did You Forget Your Attachment?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              You mentioned an attachment (or "PFA / enclosed") in your message, but have not attached any files.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowForgottenAttachmentModal(false);
                setShowCompose(true);
                fileInputRef.current?.click();
              }}
              className="text-xs font-semibold"
            >
              <Paperclip className="h-3.5 w-3.5 mr-1 text-primary" />
              Add Files First
            </Button>
            <Button
              onClick={() => {
                if (pendingFormData) {
                  executeGracePeriodSend(pendingFormData);
                }
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              Send Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── ✍️ Email Preferences & Out-of-Office Modal ─────────────────── */}
      <Dialog open={showPreferencesModal} onOpenChange={setShowPreferencesModal}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Email Signature & Out-of-Office (OOO)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Signature Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Professional Email Signature
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="includeSigCheck"
                    checked={includeSignatureDefault}
                    onChange={(e) => setIncludeSignatureDefault(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="includeSigCheck" className="text-[11px] text-slate-500 cursor-pointer">
                    Auto-append to new emails
                  </label>
                </div>
              </div>
              <textarea
                value={userSignature}
                onChange={(e) => setUserSignature(e.target.value)}
                placeholder="--&#10;Best regards,&#10;Saumya Kesur&#10;Core Workspace Engineering&#10;saumya@coreworkspace.com"
                rows={4}
                className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 font-mono text-slate-900 dark:text-white"
              />
            </div>

            {/* Out of Office Section */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <BellOff className="h-4 w-4 text-amber-500" />
                    Out of Office (OOO) Auto-Responder
                  </h4>
                  <p className="text-[11px] text-slate-500">Alert colleagues when you are on vacation or leave.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isOooEnabled}
                  onChange={(e) => setIsOooEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
              </div>

              {isOooEnabled && (
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">From Date</label>
                      <input
                        type="date"
                        value={oooStartDate}
                        onChange={(e) => setOooStartDate(e.target.value)}
                        className="w-full text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Until Date</label>
                      <input
                        type="date"
                        value={oooEndDate}
                        onChange={(e) => setOooEndDate(e.target.value)}
                        className="w-full text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Auto-Response Message</label>
                    <textarea
                      value={oooMessageText}
                      onChange={(e) => setOooMessageText(e.target.value)}
                      rows={3}
                      className="w-full text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={() => {
                preferencesMutation.mutate({
                  signature_html: userSignature,
                  include_signature_by_default: includeSignatureDefault,
                  is_ooo_enabled: isOooEnabled,
                  ooo_start_date: oooStartDate || null,
                  ooo_end_date: oooEndDate || null,
                  ooo_message: oooMessageText
                });
              }}
              disabled={preferencesMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4"
            >
              {preferencesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── 📁 Canned Templates Library Modal ─────────────────── */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-amber-500" />
              Corporate Email Templates
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pick a reusable template to immediately start drafting with corporate-aligned formatting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {templatesList.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{tpl.title}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{tpl.subject}</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setComposeSubject(tpl.subject);
                    const withSig = includeSignatureDefault && userSignature
                      ? `${tpl.body_html}<p><br></p><div class="core-mail-signature">${userSignature}</div>`
                      : tpl.body_html;
                    setComposeBody(withSig);
                    if (editorRef.current) {
                      editorRef.current.innerHTML = withSig;
                    }
                    setShowTemplateModal(false);
                    setShowCompose(true);
                  }}
                  className="w-full text-xs font-semibold h-8 mt-1 bg-primary text-primary-foreground"
                >
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── 🔍 Document / Image / PDF Attachment Preview Modal ─────────────────── */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="truncate max-w-md">{previewAttachment?.fileName}</span>
              <a
                href={previewAttachment?.url}
                download={previewAttachment?.fileName}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Download Original
              </a>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 flex items-center justify-center min-h-[300px]">
            {previewAttachment?.isImage ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.fileName}
                className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md"
              />
            ) : previewAttachment?.isPdf ? (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.fileName}
                className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800"
              />
            ) : (
              <div className="text-center p-8 text-slate-500">
                <FileText className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                <p className="text-xs">Preview not supported for this file format.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── 🛡️ Pillar 3: Document Pre-Send Permission Warning Modal ─────────────────── */}
      <Dialog open={permissionWarningModalOpen} onOpenChange={setPermissionWarningModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Recipient Access Warning
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              The linked document "<strong>{pendingPermissionData?.documentTitle}</strong>" has role restrictions that prevent some recipients from accessing it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
              <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                Missing Required Access ({pendingPermissionData?.missingRecipients.length})
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {pendingPermissionData?.missingRecipients.map((rec) => (
                  <div key={rec.id} className="text-xs flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>{rec.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200">
                      Role: {rec.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Would you like to grant document access for role(s) <strong>[{pendingPermissionData?.missingRoles.join(', ')}]</strong> before sending, or send anyway?
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                const fd = pendingPermissionData?.formData;
                setPermissionWarningModalOpen(false);
                setPendingPermissionData(null);
                if (fd) executeGracePeriodSend(fd);
              }}
              className="text-xs font-semibold"
            >
              Send Anyway
            </Button>
            <Button
              onClick={handleGrantDocumentRolesAndSend}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
            >
              <Unlock className="h-3.5 w-3.5" />
              Grant Access & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── ⌨️ Interactive Keyboard Shortcuts HUD Modal ─────────────────── */}
      <Dialog open={showShortcutsModal} onOpenChange={setShowShortcutsModal}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Superhuman Keyboard Shortcuts
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                ⚡ Superhuman Speed
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Fly through your inbox without touching the mouse. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[10px]">?</kbd> anytime to toggle this cheat-sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-2">
            {/* Navigation */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Inbox Navigation
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Next message</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">j</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">↓</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Previous message</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">k</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">↑</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Open active email</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">Enter</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">o</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Actions */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Actions & Triage
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Compose new message</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">c</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Quick reply to thread</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">r</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Archive message</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">e</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Star / Unstar</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">s</kbd>
                </div>
              </div>
            </div>

            {/* Composer & Search */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                Composer & Search
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Focus search bar</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">/</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Remove last recipient</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">Backspace</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Select top colleague</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">Enter / ,</kbd>
                </div>
              </div>
            </div>

            {/* Global */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Global Controls
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Toggle Shortcuts HUD</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">?</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Close modal / Clear focus</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[11px]">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
