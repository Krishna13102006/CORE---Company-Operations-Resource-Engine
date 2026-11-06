import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { api, ApiError, getApiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  UploadCloud,
  Trash2,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Filter,
  Clock,
  BookOpen,
  MessageSquare,
  Send,
  Sparkles,
  User as UserIcon,
  Bot,
  Plus,
  Shield,
  Mic,
  MicOff,
  Play,
  Square as SquareIcon,
  Layers,
  Globe,
  Edit3,
  HelpCircle,
  X,
  Radio,
  Link2,
  ExternalLink,
  ChevronRight,
  Check,
  SplitSquareVertical,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Source {
  document_id: string;
  document_title: string;
  relevance_score: number;
  pages?: number[];
}

interface Excerpt {
  document_id: string;
  document_title: string;
  page_number?: number;
  text: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  excerpts?: Excerpt[];
}

interface FAQItem {
  q: string;
  a: string;
}

interface DocumentMetadata {
  category: string;
  keywords: string[];
  entities?: Record<string, string[]>;
  summary?: string;
  faq_list?: FAQItem[];
}

interface Document {
  id: string;
  title: string;
  file_path: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'md' | 'audio';
  file_size: number;
  status: 'uploaded' | 'processing' | 'searchable' | 'failed';
  uploaded_by: number | null;
  uploaded_by_name?: string;
  allowed_roles: string;
  is_article?: boolean;
  article_content?: string;
  is_audio?: boolean;
  audio_transcript?: string;
  external_source?: string;
  created_at: string;
  chunk_count?: number;
  metadata?: DocumentMetadata;
}

interface CloudConnector {
  id: string;
  name: string;
  connector_type: 'gdrive' | 'notion' | 'onedrive';
  connector_type_display: string;
  target_url: string;
  auto_sync: boolean;
  sync_interval_hours: number;
  last_synced_at: string | null;
  sync_status: string;
  last_sync_log: string;
  documents_imported: number;
  created_at: string;
}

interface UploadingFile {
  id: string;
  file?: File;
  name: string;
  size: number;
  status: 'uploading' | 'indexing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Sanitize em-dashes and table rows
  let sanitized = content.replace(/[—–]/g, ' - ');
  sanitized = sanitized.replace(/\|\s*\|/g, '|\n|');
  sanitized = sanitized
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^\|(?:\s*-+\s*\|)+$/.test(trimmed) || /^\|(?:\s*-\s*-\s*\|)+$/.test(trimmed)) {
        const cells = trimmed.split('|');
        const fixedCells = cells.map((c) => {
          const stripped = c.replace(/\s+/g, '');
          return stripped.replace(/-/g, '').length === 0 && stripped.length > 0 ? '---' : c;
        });
        return fixedCells.join('|');
      }
      return line;
    })
    .join('\n');

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          table: ({ node, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-border bg-white dark:bg-slate-900" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-purple-50/70 dark:bg-purple-950/40 font-bold uppercase tracking-wider text-[10px] text-purple-900 dark:text-purple-200" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3.5 py-2.5 border-b border-border font-bold text-slate-800 dark:text-slate-100" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3.5 py-2.5 border-b border-border text-slate-700 dark:text-slate-300 align-top" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 my-2 space-y-1 text-slate-800 dark:text-slate-200" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1 text-slate-800 dark:text-slate-200" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed text-[11.5px]" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-3 mb-1" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-primary/60 pl-3 py-1.5 my-2 bg-primary/5 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-[11.5px]" {...props} />
          ),
          pre: ({ node, children, ...props }: any) => (
            <pre className="my-2 rounded-lg bg-slate-950 text-slate-100 p-2.5 font-mono text-[10.5px] leading-relaxed overflow-x-auto border border-slate-800" {...props}>
              {children}
            </pre>
          ),
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isMultiline = String(children).includes('\n');
            if (match || isMultiline) {
              return (
                <div className="relative my-2 rounded-xl bg-slate-950 text-slate-100 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed border border-slate-800 shadow-sm">
                  {match && (
                    <div className="absolute top-1 right-2 text-[8px] uppercase text-purple-400 font-bold select-none">
                      {match[1]}
                    </div>
                  )}
                  <code className="font-mono whitespace-pre" {...props}>
                    {children}
                  </code>
                </div>
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-[10.5px] font-semibold"
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

export const Documents: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || Boolean(user?.is_superuser);
  const queryClient = useQueryClient();
  const { confirm: coreConfirm, alert: coreAlert } = useCoreModal();

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fileType, setFileType] = useState('');
  const [page, setPage] = useState(1);

  // Multi-Document Comparative Selection
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [focusedDocIds, setFocusedDocIds] = useState<string[]>([]);

  // Upload States
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin', 'hr', 'manager', 'employee']);

  // Modals & Viewers
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [highlightExcerpts, setHighlightExcerpts] = useState<Excerpt[]>([]);

  // Feature 1: Native Markdown Wiki / Article Editor State
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleCategory, setArticleCategory] = useState('Wiki');
  const [articleRoles, setArticleRoles] = useState<string[]>(['admin', 'hr', 'manager', 'employee']);
  const [showArticlePreview, setShowArticlePreview] = useState(true);

  // Feature 4: Audio Transcription & Voice Memo State
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceCategory, setVoiceCategory] = useState('Voice Memos');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Feature 5: Cloud Connectors State
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState(false);
  const [newConnectorName, setNewConnectorName] = useState('');
  const [newConnectorType, setNewConnectorType] = useState<'gdrive' | 'notion' | 'onedrive'>('gdrive');
  const [newConnectorUrl, setNewConnectorUrl] = useState('');
  const [newConnectorToken, setNewConnectorToken] = useState('');
  const [syncingConnectorId, setSyncingConnectorId] = useState<string | null>(null);

  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am your organization's internal AI research assistant. Ask me anything about your documents, comparative contract analysis, team policies, or project deliverables.",
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Block print/save shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        coreAlert({
          title: 'Action Restricted',
          description: 'Saving and printing documents directly is restricted for corporate compliance.',
          variant: 'warning',
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  // Query Documents
  const queryParams = new URLSearchParams({
    page: page.toString(),
    ...(search && { search }),
    ...(category && { category }),
    ...(statusFilter && { status: statusFilter }),
    ...(fileType && { file_type: fileType }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', queryParams.toString()],
    queryFn: () => api.get(`/knowledge/documents/?${queryParams.toString()}`),
    refetchInterval: (query) => {
      const docs = query.state.data as any;
      if (docs && Array.isArray(docs.results)) {
        const hasProcessing = docs.results.some(
          (doc: Document) => doc.status === 'uploaded' || doc.status === 'processing'
        );
        return hasProcessing ? 4000 : false;
      }
      return false;
    },
  });

  const documents = data?.results as Document[] | undefined;
  const count = data?.count ?? 0;

  // Query Cloud Connectors
  const { data: connectors, refetch: refetchConnectors } = useQuery<CloudConnector[]>({
    queryKey: ['cloud-connectors'],
    queryFn: () => api.get('/knowledge/connectors/'),
  });

  // Query Viewing Document Content & Summary
  const { data: docContent, isLoading: contentLoading } = useQuery<any>({
    queryKey: ['doc-content', viewingDocId],
    queryFn: () => api.get(`/knowledge/documents/${viewingDocId}/content/`),
    enabled: !!viewingDocId,
  });

  const { data: docSummary, isLoading: summaryLoading } = useQuery<{ summary: string; faq_list: FAQItem[] }>({
    queryKey: ['doc-summary', viewingDocId],
    queryFn: () => api.get(`/knowledge/documents/${viewingDocId}/summary/`),
    enabled: !!viewingDocId,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge/documents/${id}/`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      setSelectedDocIds((prev) => prev.filter((d) => d !== id));
      setFocusedDocIds((prev) => prev.filter((d) => d !== id));
    },
  });

  // Reprocess Mutation
  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge/documents/${id}/reprocess/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
    },
  });

  // Article Save Mutation
  const articleMutation = useMutation({
    mutationFn: (payload: { id?: string; title: string; content: string; category: string; allowed_roles: string }) =>
      api.post('/knowledge/wiki/article/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      setIsArticleModalOpen(false);
      setArticleId(null);
      setArticleTitle('');
      setArticleContent('');
    },
    onError: (err: ApiError) => {
      coreAlert({
        title: 'Save Article Failed',
        description: err.message || 'Failed to save article.',
        variant: 'destructive',
      });
    },
  });

  // Cloud Connector Create Mutation
  const createConnectorMutation = useMutation({
    mutationFn: (payload: { name: string; connector_type: string; target_url: string; access_token: string }) =>
      api.post('/knowledge/connectors/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-connectors'] });
      setNewConnectorName('');
      setNewConnectorUrl('');
      setNewConnectorToken('');
    },
    onError: (err: ApiError) => {
      coreAlert({
        title: 'Connection Failed',
        description: err.message || 'Failed to create connector.',
        variant: 'destructive',
      });
    },
  });

  // Trigger Connector Sync
  const handleSyncConnector = async (connectorId: string) => {
    setSyncingConnectorId(connectorId);
    try {
      await api.post(`/knowledge/connectors/${connectorId}/sync/`, {});
      queryClient.invalidateQueries({ queryKey: ['cloud-connectors'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err: any) {
      coreAlert({
        title: 'Sync Failed',
        description: err.message || 'Failed to sync connector.',
        variant: 'destructive',
      });
    } finally {
      setSyncingConnectorId(null);
    }
  };

  // Delete Connector
  const handleDeleteConnector = async (connectorId: string) => {
    const confirmed = await coreConfirm({
      title: 'Disconnect Cloud Integration',
      description: 'Are you sure you want to disconnect this cloud integration?',
      variant: 'destructive',
      confirmLabel: 'Disconnect',
      warning: 'Live indexing will stop immediately and external files will no longer synchronize.',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/knowledge/connectors/${connectorId}/`);
      queryClient.invalidateQueries({ queryKey: ['cloud-connectors'] });
    } catch (err: any) {
      coreAlert({
        title: 'Disconnection Failed',
        description: err.message || 'Failed to delete connector.',
        variant: 'destructive',
      });
    }
  };

  // Multi-Document Selection Toggle
  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Trigger Multi-Document Comparative Synthesis
  const handleCompareSelected = () => {
    if (selectedDocIds.length < 2) {
      coreAlert({
        title: 'Select Multiple Documents',
        description: 'Please select at least 2 documents to run a comparative synthesis.',
        variant: 'info',
      });
      return;
    }
    setFocusedDocIds(selectedDocIds);
    const selectedTitles = documents
      ?.filter((d) => selectedDocIds.includes(d.id))
      .map((d) => `"${d.title}"`)
      .join(' and ');

    setChatInput(
      `Compare ${selectedTitles} side-by-side. Generate a Markdown table highlighting key differences, obligations, pricing/terms, and critical risk factors.`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err) {
      coreAlert({
        title: 'Microphone Access Denied',
        description: 'Microphone access was denied or not found. Please verify your browser audio permissions.',
        variant: 'warning',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const handleUploadAudio = async (fileToUpload?: File) => {
    const file = fileToUpload || (audioBlob ? new File([audioBlob], `${voiceTitle || 'Voice Memo'}.mp3`, { type: 'audio/mp3' }) : null);
    if (!file) {
      coreAlert({
        title: 'No Audio Selected',
        description: 'No audio recorded or selected for transcription.',
        variant: 'warning',
      });
      return;
    }

    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('audio_file', file);
    formData.append('title', voiceTitle.trim() || file.name);
    formData.append('category', voiceCategory || 'Voice Memos');
    formData.append('allowed_roles', allowedRoles.join(','));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getApiUrl('/knowledge/audio/upload/'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Audio transcription failed.');
      }

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setIsVoiceModalOpen(false);
      setAudioBlob(null);
      setAudioUrl(null);
      setVoiceTitle('');
    } catch (err: any) {
      coreAlert({
        title: 'Upload Failed',
        description: err.message || 'Failed to upload and transcribe audio.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  // Chat Submission with Document-ID Scoping
  const handleChatSubmit = async (e: React.FormEvent, directQuestion?: string) => {
    if (e) e.preventDefault();
    const queryToUse = directQuestion || chatInput;
    if (!queryToUse.trim() || chatLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: queryToUse.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    setActiveSources([]);

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const recentHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl('/knowledge/ask-stream/'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          question: userMessage.content,
          history: recentHistory,
          document_ids: focusedDocIds.length > 0 ? focusedDocIds : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported in browser response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedAnswer = '';
      let collectedSources: Source[] = [];
      let collectedExcerpts: Excerpt[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (cleanedLine.startsWith('data: ')) {
            const dataStr = cleanedLine.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.sources) {
                collectedSources = parsed.sources;
                setActiveSources(parsed.sources);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, sources: collectedSources }
                      : msg
                  )
                );
              }
              if (parsed.excerpts) {
                collectedExcerpts = parsed.excerpts;
              }
              if (parsed.token) {
                collectedAnswer += parsed.token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: collectedAnswer,
                          sources: collectedSources,
                          excerpts: collectedExcerpts,
                        }
                      : msg
                  )
                );
              }
            } catch (err) {
              console.error('Error parsing streaming line:', err);
            }
          }
        }
      }

      if (!collectedAnswer.trim()) {
        const fallbackNotice = "I couldn't find relevant information in your organization's documents. Please upload the relevant document or specify your query.";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: fallbackNotice,
                  sources: collectedSources,
                  excerpts: collectedExcerpts,
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `Unable to complete query: ${err.message || 'Please check your connection and try again.'}`,
              }
            : msg
        )
      );
    } finally {
      setChatLoading(false);
    }
  };

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const uploadFiles = (files: FileList) => {
    const newItems: UploadingFile[] = Array.from(files).map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));

    setUploadQueue((prev) => [...newItems, ...prev]);

    Array.from(files).forEach((fileObj, index) => {
      const item = newItems[index];
      const formData = new FormData();
      formData.append('files', fileObj);
      formData.append('category', '');
      formData.append('allowed_roles', allowedRoles.join(','));

      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open('POST', getApiUrl('/knowledge/upload/'), true);

      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          setUploadQueue((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: Math.min(percentage, 95) } : f))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadQueue((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: 'indexing', progress: 100 } : f))
          );
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          setTimeout(() => {
            setUploadQueue((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, status: 'completed' } : f))
            );
          }, 3500);
        } else {
          let errDetail = 'Upload failed';
          try {
            const errJson = JSON.parse(xhr.responseText);
            errDetail = errJson.error || errJson.details?.[0] || errJson.detail || 'Upload failed';
          } catch {}
          setUploadQueue((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: 'failed', progress: 100, error: errDetail } : f))
          );
        }
      };

      xhr.onerror = () => {
        setUploadQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'failed', progress: 100, error: 'Network request error' } : f))
        );
      };

      xhr.send(formData);
    });
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderStatusBadge = (status: Document['status']) => {
    const base = "px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit ";
    switch (status) {
      case 'uploaded':
        return <span className={base + "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"}><Clock className="h-3 w-3" /> Uploaded</span>;
      case 'processing':
        return <span className={base + "bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400"}><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>;
      case 'searchable':
        return <span className={base + "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"}><CheckCircle2 className="h-3 w-3" /> Searchable</span>;
      case 'failed':
        return <span className={base + "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"}><AlertCircle className="h-3 w-3" /> Failed</span>;
    }
  };

  const renderTypeIcon = (doc: Document) => {
    if (doc.is_article || doc.file_type === 'md') {
      return <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    }
    if (doc.is_audio || doc.file_type === 'audio') {
      return <Mic className="h-4 w-4 text-pink-600 dark:text-pink-400" />;
    }
    if (doc.external_source === 'gdrive' || doc.external_source === 'notion' || doc.external_source === 'onedrive') {
      return <Globe className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Page Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-primary shrink-0" />
            Enterprise Knowledge Hub & AI Research Assistant
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Native Markdown Wiki, Google Drive / Notion Live Sync, Whisper Voice Memos, and Multi-Document RAG Comparative Analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: New Markdown Wiki */}
          <Button
            size="sm"
            onClick={() => {
              setArticleId(null);
              setArticleTitle('');
              setArticleContent('');
              setArticleCategory('Wiki');
              setIsArticleModalOpen(true);
            }}
            className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Wiki Article
          </Button>

          {/* Action 2: Voice Memo Recording */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setVoiceTitle('');
              setAudioBlob(null);
              setAudioUrl(null);
              setIsVoiceModalOpen(true);
            }}
            className="h-9 text-xs font-semibold border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
          >
            <Mic className="h-4 w-4 text-pink-500" />
            Voice Memo (Whisper AI)
          </Button>

          {/* Action 3: Cloud Connectors (GDrive, Notion) - Admin Only */}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsConnectorsModalOpen(true)}
              className="h-9 text-xs font-semibold border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Globe className="h-4 w-4 text-blue-500" />
              Cloud Connectors
              {connectors && connectors.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                  {connectors.length}
                </span>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh Knowledge Base"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MULTI-DOCUMENT COMPARATIVE SYNTHESIS STICKY BAR
          ───────────────────────────────────────────────────────────── */}
      {selectedDocIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-purple-900 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Layers className="h-4 w-4 text-purple-300" />
            <span>{selectedDocIds.length} Document{selectedDocIds.length > 1 ? 's' : ''} Selected for Comparative Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCompareSelected}
              className="bg-white text-purple-950 hover:bg-purple-50 text-xs font-bold h-8 shadow-xs flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Compare in AI Chat
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedDocIds([])}
              className="text-purple-200 hover:text-white hover:bg-purple-800 text-xs h-8"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          RAG Q&A CHAT & ACTIVE SOURCE MATCH SECTION
          ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-7 animate-in fade-in duration-300">
        <Card className="lg:col-span-5 flex flex-col border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden h-[520px]">
          <CardHeader className="border-b border-border shrink-0 py-3.5 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">
                  Internal AI Research & Comparative Assistant
                </CardTitle>
              </div>

              {focusedDocIds.length > 0 ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-[10.5px] font-bold">
                  <span>Focused on {focusedDocIds.length} Selected Docs</span>
                  <button onClick={() => setFocusedDocIds([])} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hidden sm:inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Groq LPU 300+ tok/s
                </span>
              )}
            </div>
          </CardHeader>

          {/* Messages List Area */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full border text-[10px] font-semibold ${
                      isUser
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}
                  >
                    {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed border ${
                        isUser
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-border'
                      }`}
                    >
                      {msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-2 py-0.5 text-muted-foreground font-semibold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Thinking & synthesizing answers...
                        </div>
                      )}
                    </div>

                    {/* Inline citations */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mr-1 mt-0.5">
                          Grounded Citations:
                        </span>
                        {msg.sources.map((src) => (
                          <button
                            key={src.document_id}
                            onClick={() => {
                              setHighlightExcerpts(msg.excerpts || []);
                              setViewingDocId(src.document_id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 px-2 py-0.5 text-[9.5px] font-bold text-purple-800 dark:text-purple-300 transition-colors"
                          >
                            <FileText className="h-2.5 w-2.5 shrink-0 text-primary" />
                            {src.document_title}
                            {src.pages && src.pages.length > 0 && ` (Pgs. ${src.pages.join(', ')})`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input box */}
          <div className="p-3 border-t border-border shrink-0 bg-slate-50 dark:bg-slate-900 space-y-1.5">
            <form onSubmit={(e) => handleChatSubmit(e)} className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={focusedDocIds.length > 0 ? "Ask comparative questions against focused documents..." : "Ask questions about company SOPs, vendor contracts, benefits, or comparative policies..."}
                className="flex-1 bg-white dark:bg-slate-950 text-xs h-9"
                disabled={chatLoading}
                required
              />
              <Button type="submit" disabled={chatLoading || !chatInput.trim()} className="font-semibold px-4 h-9 bg-primary hover:bg-primary/90 text-white">
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
              <span>Grounded via Qdrant Vector Memory • Zero AI Hallucination Guarantee</span>
              <Link to="/security" className="text-purple-600 dark:text-purple-400 hover:underline">
                SOC 2 Data Isolation
              </Link>
            </div>
          </div>
        </Card>

        {/* Right Card: Active Source Contexts & Instant FAQ Prompts */}
        <Card className="lg:col-span-2 border-border shadow-sm bg-white dark:bg-slate-900 flex flex-col overflow-hidden h-[520px]">
          <CardHeader className="border-b border-border shrink-0 py-3.5 px-4">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Active Citations & Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
            {activeSources.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed">
                  Verified documents retrieved for this response:
                </p>
                {activeSources.map((src) => (
                  <div
                    key={src.document_id}
                    className="p-3 border border-purple-100 dark:border-purple-900/50 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                          {src.document_title}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        {(src.relevance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setHighlightExcerpts([]);
                        setViewingDocId(src.document_id);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      Inspect document <BookOpen className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-950/40 text-xs space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-primary" /> Suggested AI Prompts
                  </div>
                  <div className="space-y-1.5">
                    {[
                      "Summarize key vendor obligations in our active contracts",
                      "What is our standard employee remote work and expense policy?",
                      "List all project deliverables due this quarter",
                    ].map((promptText, i) => (
                      <button
                        key={i}
                        onClick={() => handleChatSubmit(undefined as any, promptText)}
                        className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 border border-border hover:border-primary/50 text-[10.5px] text-slate-700 dark:text-slate-300 font-semibold transition-all"
                      >
                        ⚡ {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DOCUMENT INGESTION VAULT & BULK UPLOAD
          ───────────────────────────────────────────────────────────── */}
      <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Corporate Document Vault & Ingestion Pipeline
            </CardTitle>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {count} indexed documents available for enterprise search and multi-tenant RAG.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search documents by title or topic..."
                className="pl-8 text-xs h-9 w-64 bg-slate-50 dark:bg-slate-950 border-border"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Drag & Drop Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-border">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Drag & drop company files here, or <span className="text-primary underline">browse</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Supports PDF, DOCX, TXT, and Markdown files up to 50MB
              </span>
            </label>
          </div>

          {/* Active Upload & Ingestion Progress Queue */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="h-4 w-4 text-primary" /> Active Document Ingestion Queue ({uploadQueue.length})
                </span>
                {uploadQueue.some((f) => f.status === 'completed' || f.status === 'failed') && (
                  <button
                    onClick={() => setUploadQueue((prev) => prev.filter((f) => f.status === 'uploading' || f.status === 'indexing'))}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 font-medium"
                  >
                    Clear finished
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {uploadQueue.map((file) => (
                  <div
                    key={file.id}
                    className={`p-3 rounded-xl border transition-all ${
                      file.status === 'failed'
                        ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
                        : file.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                        : 'border-purple-200 bg-purple-50/40 dark:border-purple-900/50 dark:bg-purple-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className={`h-4 w-4 shrink-0 ${file.status === 'failed' ? 'text-red-500' : 'text-primary'}`} />
                        <span className="truncate font-bold text-slate-900 dark:text-slate-100">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.status === 'uploading' && (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-0.5 rounded-full animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Uploading {file.progress}%
                          </span>
                        )}
                        {file.status === 'indexing' && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Processing AI Chunks...
                          </span>
                        )}
                        {file.status === 'completed' && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Searchable
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3" /> {file.error || 'Failed'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Animated Progress Bar */}
                    {(file.status === 'uploading' || file.status === 'indexing') && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mt-2">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            file.status === 'indexing'
                              ? 'bg-amber-500 w-full animate-pulse'
                              : 'bg-primary'
                          }`}
                          style={{ width: file.status === 'indexing' ? '100%' : `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3.5 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={documents && documents.length > 0 && selectedDocIds.length === documents.length}
                      onChange={() => {
                        if (documents && selectedDocIds.length === documents.length) {
                          setSelectedDocIds([]);
                        } else if (documents) {
                          setSelectedDocIds(documents.map((d) => d.id));
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </th>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">AI Chunks</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white dark:bg-slate-900">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                      Loading document vault...
                    </td>
                  </tr>
                ) : documents && documents.length > 0 ? (
                  documents.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors ${
                          isSelected ? 'bg-purple-50/50 dark:bg-purple-950/30' : ''
                        }`}
                      >
                        <td className="px-3.5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDocSelection(doc.id)}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {renderTypeIcon(doc)}
                          <span
                            onClick={() => {
                              setHighlightExcerpts([]);
                              setViewingDocId(doc.id);
                            }}
                            className="hover:text-primary cursor-pointer transition-colors"
                          >
                            {doc.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-500 font-mono">
                          {doc.file_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                            {doc.metadata?.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{renderStatusBadge(doc.status)}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                            {doc.chunk_count !== undefined && doc.chunk_count > 0 ? (
                              <span>{doc.chunk_count} {doc.chunk_count === 1 ? 'Chunk' : 'Chunks'}</span>
                            ) : doc.status === 'processing' || doc.status === 'uploaded' ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">Processing...</span>
                            ) : doc.status === 'failed' ? (
                              <span className="text-red-500 font-semibold">0 Chunks</span>
                            ) : (
                              <span>0 Chunks</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {doc.uploaded_by_name || 'System'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setHighlightExcerpts([]);
                                setViewingDocId(doc.id);
                              }}
                              className="h-8 px-2.5 text-xs text-primary hover:bg-primary/10 font-bold flex items-center gap-1.5"
                              title="Read Document"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Read
                            </Button>

                            {isAdmin && doc.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => reprocessMutation.mutate(doc.id)}
                                className="h-8 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                title="Retry / Reprocess Document"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}

                            {isAdmin && doc.is_article && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setArticleId(doc.id);
                                  setArticleTitle(doc.title);
                                  setArticleContent(doc.article_content || '');
                                  setArticleCategory(doc.metadata?.category || 'Wiki');
                                  setIsArticleModalOpen(true);
                                }}
                                className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-primary"
                                title="Edit Article"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      No documents found matching the search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {count > 20 && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page} of {Math.ceil(count / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= count}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          DOCUMENT VIEW & METADATA INSPECTION DRAWER
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!viewingDocId} onOpenChange={(open) => !open && setViewingDocId(null)}>
        <DialogContent className="max-w-6xl w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> {docContent?.title || 'Reading Document'}
              </DialogTitle>
            </div>
            {docContent && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-2 font-semibold font-sans">
                <span><strong>Type:</strong> {docContent.file_type?.toUpperCase()}</span>
                <span>•</span>
                <span><strong>Category:</strong> {docContent.category || 'General'}</span>
                <span>•</span>
                <span><strong>Uploaded By:</strong> {docContent.uploaded_by_name || 'System'}</span>
                <span>•</span>
                <span><strong>Keywords:</strong> {docContent.keywords?.join(', ') || 'None'}</span>
                {docContent.chunk_count !== undefined && (
                  <>
                    <span>•</span>
                    <span><strong>Indexed Chunks:</strong> {docContent.chunk_count}</span>
                  </>
                )}
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 mt-4 flex flex-col min-h-0 overflow-hidden">
            {contentLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 flex-1">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-semibold text-muted-foreground">Loading document preview...</span>
              </div>
            ) : (docContent?.file_type?.toLowerCase() === 'pdf' || docContent?.title?.toLowerCase().endsWith('.pdf')) ? (
              <div 
                className="flex-1 overflow-y-auto pr-1 space-y-4 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border select-none"
                onContextMenu={(e) => e.preventDefault()}
              >
                {Array.from({ length: Math.max(docContent.page_count || 1, 1) }).map((_, index) => {
                  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
                  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
                  return (
                    <div key={index} className="relative flex justify-center bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-border">
                      <img 
                        src={getApiUrl(`/knowledge/documents/${viewingDocId}/pages/${index}/?preview=true${tokenParam}`)}
                        alt={`Page ${index + 1}`}
                        className="max-w-full h-auto select-none pointer-events-none rounded border shadow-sm"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        loading="lazy"
                      />
                      <div className="absolute bottom-6 right-8 bg-slate-800/80 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold shadow-sm">
                        Page {index + 1} / {docContent.page_count || 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : docContent?.content ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <div 
                  className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-border select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                >
                  <MarkdownRenderer content={docContent.content} />
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground flex-1">
                No content could be extracted from this document, or it is still indexing.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 1: NATIVE MARKDOWN WIKI & ARTICLE EDITOR MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={isArticleModalOpen} onOpenChange={(open) => !open && setIsArticleModalOpen(false)}>
        <DialogContent className="max-w-5xl w-[92vw] h-[85vh] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {articleId ? 'Edit Wiki Article & SOP' : 'Create Native Markdown Wiki Article & SOP'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArticlePreview(!showArticlePreview)}
                className="text-xs h-7 gap-1"
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                {showArticlePreview ? 'Hide Preview' : 'Split Preview'}
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 mt-2 space-y-3 flex flex-col min-h-0">
            <div className="grid gap-3 sm:grid-cols-2 shrink-0 p-1">
              <Input
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Article Title (e.g. SOC 2 Incident Response Procedure)"
                className="bg-white dark:bg-slate-950 text-xs h-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              />
              <Input
                value={articleCategory}
                onChange={(e) => setArticleCategory(e.target.value)}
                placeholder="Category (e.g. Engineering, Compliance, HR)"
                className="bg-white dark:bg-slate-950 text-xs h-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              />
            </div>

            {/* Split Editor / Preview Area */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 p-1">
              <div className="h-full flex flex-col min-h-0">
                <textarea
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  placeholder="Write rich Markdown content with headers, tables, code blocks, and workflows..."
                  className="w-full h-full p-4 rounded-xl border border-border bg-white dark:bg-slate-950 text-xs leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-y-auto transition-all"
                />
              </div>

              {showArticlePreview && (
                <div className="h-full p-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-950 overflow-y-auto">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Live Markdown Preview
                  </span>
                  <MarkdownRenderer content={articleContent || '*Live preview will render here...*'} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-3 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-muted-foreground">
              Automatically tokenized into 500-token chunks and embedded in Qdrant on publish.
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsArticleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={articleMutation.isPending || !articleTitle.trim() || !articleContent.trim()}
                onClick={() =>
                  articleMutation.mutate({
                    id: articleId || undefined,
                    title: articleTitle.trim(),
                    content: articleContent.trim(),
                    category: articleCategory.trim() || 'Wiki',
                    allowed_roles: articleRoles.join(','),
                  })
                }
                className="bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                {articleMutation.isPending ? 'Publishing & Indexing...' : 'Publish to Knowledge Base'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 4: VOICE MEMO & AUDIO RECORDER MODAL (WHISPER AI)
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={isVoiceModalOpen} onOpenChange={(open) => !open && setIsVoiceModalOpen(false)}>
        <DialogContent className="max-w-md w-[90vw] p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Mic className="h-5 w-5 text-pink-500" />
              Voice Memo Ingestion (Whisper AI)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-center">
            {/* Live Recorder Control */}
            <div className="p-6 rounded-2xl border border-pink-200 dark:border-pink-950 bg-pink-50/50 dark:bg-pink-950/20 flex flex-col items-center gap-3">
              {isRecording ? (
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-pink-500/20 animate-ping absolute inset-0" />
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-pink-600 text-white flex items-center justify-center relative shadow-lg hover:bg-pink-700 transition-all cursor-pointer"
                  >
                    <SquareIcon className="h-6 w-6" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 transition-all cursor-pointer"
                >
                  <Mic className="h-7 w-7" />
                </button>
              )}

              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                {isRecording ? `Recording Audio... ${recordingDuration}s` : audioUrl ? 'Voice Memo Ready' : 'Click to Record Voice Memo'}
              </span>

              {audioUrl && (
                <audio controls src={audioUrl} className="w-full mt-2 h-9" />
              )}
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Memo Title / Topic
              </label>
              <Input
                value={voiceTitle}
                onChange={(e) => setVoiceTitle(e.target.value)}
                placeholder="e.g. Q3 Strategy Audio Memo"
                className="bg-white dark:bg-slate-950 text-xs h-9"
              />
            </div>

            {/* Or File Upload Alternative */}
            <div className="border-t border-border pt-3">
              <label className="text-[11px] text-muted-foreground block mb-2 font-semibold">
                Or upload pre-recorded audio file (.mp3, .wav, .m4a):
              </label>
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.webm"
                onChange={(e) => e.target.files && handleUploadAudio(e.target.files[0])}
                className="text-xs w-full"
              />
            </div>
          </div>

          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsVoiceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isTranscribing || (!audioBlob && !voiceTitle)}
              onClick={() => handleUploadAudio()}
              className="bg-pink-600 hover:bg-pink-700 text-white font-semibold"
            >
              {isTranscribing ? 'Transcribing with Whisper...' : 'Transcribe & Index'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 5: CLOUD CONNECTORS MODAL (GOOGLE DRIVE / NOTION)
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={isConnectorsModalOpen} onOpenChange={(open) => !open && setIsConnectorsModalOpen(false)}>
        <DialogContent className="max-w-2xl w-[90vw] p-6 space-y-4">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Live Cloud Connectors (Google Drive / Notion / OneDrive)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Add Connector Form */}
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
              <span className="text-xs font-bold uppercase text-blue-900 dark:text-blue-200 block">
                Connect New Cloud Source
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={newConnectorName}
                  onChange={(e) => setNewConnectorName(e.target.value)}
                  placeholder="Connector Name (e.g. Legal Team Drive)"
                  className="bg-white dark:bg-slate-950 text-xs h-9"
                />
                <select
                  value={newConnectorType}
                  onChange={(e) => setNewConnectorType(e.target.value as any)}
                  className="bg-white dark:bg-slate-950 border border-border rounded-md px-3 text-xs h-9 text-slate-800 dark:text-slate-200"
                >
                  <option value="gdrive">Google Drive Folder</option>
                  <option value="notion">Notion Database / Workspace</option>
                  <option value="onedrive">Microsoft OneDrive</option>
                </select>
              </div>
              <Input
                value={newConnectorUrl}
                onChange={(e) => setNewConnectorUrl(e.target.value)}
                placeholder="Target Folder URL / Notion Page URL"
                className="bg-white dark:bg-slate-950 text-xs h-9"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={createConnectorMutation.isPending || !newConnectorName.trim()}
                  onClick={() =>
                    createConnectorMutation.mutate({
                      name: newConnectorName.trim(),
                      connector_type: newConnectorType,
                      target_url: newConnectorUrl.trim(),
                      access_token: newConnectorToken.trim(),
                    })
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8"
                >
                  {createConnectorMutation.isPending ? 'Connecting...' : 'Connect Cloud Source'}
                </Button>
              </div>
            </div>

            {/* Connected Sources List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-muted-foreground block">
                Active Connected Sources
              </span>
              {connectors && connectors.length > 0 ? (
                connectors.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-border bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-blue-500" />
                        {c.name}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {c.connector_type_display}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        {c.last_sync_log || 'Never synced'} • {c.documents_imported} docs imported
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingConnectorId === c.id}
                        onClick={() => handleSyncConnector(c.id)}
                        className="h-8 text-xs font-semibold gap-1"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingConnectorId === c.id ? 'animate-spin' : ''}`} />
                        Sync Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteConnector(c.id)}
                        className="h-8 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No cloud connectors configured yet.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
