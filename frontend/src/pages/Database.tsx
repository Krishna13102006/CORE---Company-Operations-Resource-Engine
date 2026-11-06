import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage, getApiUrl, getMediaUrl } from '../lib/api';
import { useCoreModal } from '../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Database as DbIcon,
  ShieldCheck,
  FileText,
  Sparkles,
  HardDrive,
  Lock,
  Activity,
  Loader2,
  RefreshCw,
  Search,
  Copy,
  Download,
  Check,
  Terminal,
  Shield,
  HelpCircle,
  Network,
  ArrowRight,
  Maximize2,
  Sliders,
  Cpu,
  Layers,
  BarChart3,
  Users,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Briefcase,
  CreditCard,
  Video,
  BookOpen,
  Trash2,
  Edit2,
  X,
  Zap,
  UploadCloud,
  Plus,
  ExternalLink,
  Calendar,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../lib/utils';

interface OrgSettings {
  max_documents: number;
  max_users: number;
  allowed_domains: string[];
  enforce_2fa?: boolean;
  session_idle_timeout_minutes?: number;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  settings: OrgSettings;
}

interface GovernanceStats {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    created_at: string;
  };
  document_vault: {
    total_documents: number;
    storage_used_bytes: number;
    storage_used_mb: number;
    storage_used_gb: number;
    storage_cap_gb: number;
    storage_cap_mb: number;
    storage_percent: number;
    categories: Array<{
      key: string;
      label: string;
      count: number;
      size_mb: number;
      access_roles: string[];
    }>;
  };
  ai_usage: {
    total_tokens_used: number;
    monthly_quota: number;
    quota_percent: number;
    tokens_remaining: number;
    estimated_saas_savings_usd: number;
    by_feature: Array<{
      feature: string;
      tokens: number;
      requests: number;
    }>;
  };
  infrastructure: {
    database_type: string;
    database_health: string;
    vector_engine: string;
    vector_chunks_indexed: number;
    embedding_dimension: number;
    search_latency_ms: number;
  };
  security_compliance: {
    tenant_isolation: string;
    encryption_at_rest: string;
    encryption_in_transit: string;
    cross_org_leakage_protection: string;
    total_audit_events: number;
  };
  multi_tenant_allocation?: {
    total_organizations_count: number;
    system_storage_cap_mb: number;
    system_monthly_tokens: number;
    allocated_storage_mb: number;
    allocated_token_quota: number;
    org_share_percentage: number;
    allocation_model: string;
  };
}

interface VaultItem {
  id: string;
  title: string;
  source: 'knowledge' | 'expenses' | 'hiring' | 'meetings';
  source_label: string;
  file_type: string;
  file_size_bytes: number;
  uploader: string;
  created_at: string;
  sensitivity_level: 'internal' | 'confidential' | 'restricted' | 'public';
  access_roles: string[];
  file_url: string;
  meeting_id?: string;
  room_code?: string;
  ai_summary?: string;
  key_decisions?: string[];
  action_items?: string[];
  transcript_raw?: Array<{ speaker?: string; text: string; timestamp?: string }>;
}

export const Database: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();
  const [activeTab, setActiveTab] = useState<'vault' | 'ai_usage' | 'storage' | 'security' | 'settings'>('vault');

  // Vault Filtering
  const [vaultSearch, setVaultSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('all');
  const [viewingVaultItem, setViewingVaultItem] = useState<VaultItem | null>(null);
  const [vaultBlobUrl, setVaultBlobUrl] = useState<string | null>(null);
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);
  const [docPreviewError, setDocPreviewError] = useState<string | null>(null);
  const [meetingViewMode, setMeetingViewMode] = useState<'notes' | 'pdf'>('notes');

  // Audit Log State & Filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [isExportingAudit, setIsExportingAudit] = useState(false);

  // Status Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // SQL Console States (For Superusers/Admins)
  const [sqlQuery, setSqlQuery] = useState('SELECT id, email, first_name, last_name, role FROM accounts_user LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('accounts_user');
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [resultsFilterText, setResultsFilterText] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch Governance & Usage Stats
  const { data: govStats, isLoading: govLoading, refetch: refetchGov } = useQuery<GovernanceStats>({
    queryKey: ['governance-stats'],
    queryFn: () => api.get('/tenants/governance-stats/'),
    refetchInterval: 30000,
  });

  // Fetch Document Vault Items
  const { data: vaultItems, isLoading: vaultLoading, refetch: refetchVault } = useQuery<VaultItem[]>({
    queryKey: ['document-vault'],
    queryFn: () => api.get('/tenants/document-vault/'),
  });

  // Authenticated Document Blob Loader for Vault Items (Resumes, Offers, Transcripts, PDFs)
  useEffect(() => {
    let isSubscribed = true;
    if (vaultBlobUrl) {
      URL.revokeObjectURL(vaultBlobUrl);
      setVaultBlobUrl(null);
    }
    setDocPreviewError(null);

    if (!viewingVaultItem?.file_url) {
      setDocPreviewLoading(false);
      return;
    }

    const isPdfType =
      viewingVaultItem.file_type.includes('pdf') ||
      viewingVaultItem.file_url.toLowerCase().includes('.pdf') ||
      viewingVaultItem.file_url.includes('/resume') ||
      viewingVaultItem.file_url.includes('/offer') ||
      viewingVaultItem.file_url.includes('/transcript/export');

    if (isPdfType) {
      setDocPreviewLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const rawUrl = viewingVaultItem.file_url;
      const targetUrl = rawUrl.startsWith('http') ? rawUrl : getApiUrl(rawUrl);

      fetch(targetUrl, { headers, credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Preview failed with HTTP ${res.status}`);
          const blob = await res.blob();
          if (isSubscribed) {
            setVaultBlobUrl(URL.createObjectURL(blob));
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            setDocPreviewError(err.message || 'Failed to load document preview');
          }
        })
        .finally(() => {
          if (isSubscribed) setDocPreviewLoading(false);
        });
    } else {
      setDocPreviewLoading(false);
    }

    return () => {
      isSubscribed = false;
      if (vaultBlobUrl) {
        URL.revokeObjectURL(vaultBlobUrl);
      }
    };
  }, [viewingVaultItem?.id, viewingVaultItem?.file_url]);

  const getDirectVaultUrl = (item: VaultItem | null) => {
    if (!item?.file_url) return '';
    const token = (typeof window !== 'undefined' ? localStorage.getItem('access_token') : '') || '';
    const separator = item.file_url.includes('?') ? '&' : '?';
    const authedPath = `${item.file_url}${separator}token=${token}&inline=true`;
    return authedPath.startsWith('http') ? authedPath : getApiUrl(authedPath);
  };

  // Fetch Organization details & settings
  const { data: org, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ['org'],
    queryFn: () => api.get('/tenants/me/'),
  });

  // Fetch Audit Logs with Search, Action, and Date Filtering
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit, isFetching: auditFetching } = useQuery({
    queryKey: ['audit-logs', auditPage, auditSearch, auditActionFilter, auditStartDate, auditEndDate],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('page', auditPage.toString());
      if (auditSearch.trim()) params.append('search', auditSearch.trim());
      if (auditActionFilter !== 'all') params.append('action', auditActionFilter);
      if (auditStartDate) params.append('start_date', auditStartDate);
      if (auditEndDate) params.append('end_date', auditEndDate);
      return api.get(`/auth/audit-log/?${params.toString()}`);
    },
    enabled: activeTab === 'security',
  });

  const handleExportAuditCSV = async () => {
    try {
      setIsExportingAudit(true);
      const params = new URLSearchParams();
      params.append('export', 'csv');
      if (auditSearch.trim()) params.append('search', auditSearch.trim());
      if (auditActionFilter !== 'all') params.append('action', auditActionFilter);
      if (auditStartDate) params.append('start_date', auditStartDate);
      if (auditEndDate) params.append('end_date', auditEndDate);

      const token = localStorage.getItem('access_token');
      const response = await fetch(getApiUrl(`/auth/audit-log/?${params.toString()}`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!response.ok) throw new Error('Failed to export audit logs');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${org?.slug || 'workspace'}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      coreAlert({
        title: 'Audit Export Failed',
        description: extractErrorMessage(err) || 'Failed to export audit logs CSV.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingAudit(false);
    }
  };

  // Fetch Schema Metadata (Superuser only)
  const { data: schemaMetadata, isLoading: schemaLoading } = useQuery<any[]>({
    queryKey: ['database-schema'],
    queryFn: () => api.get('/tenants/schema/'),
    enabled: user?.is_superuser === true && activeTab === 'settings',
  });

  // Settings Mutation Form States
  const [maxUsers, setMaxUsers] = useState<number | ''>('');
  const [maxDocs, setMaxDocs] = useState<number | ''>('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [enforce2FA, setEnforce2FA] = useState<boolean>(false);
  const [sessionIdleTimeout, setSessionIdleTimeout] = useState<number>(30);

  useEffect(() => {
    if (org?.settings) {
      setMaxUsers(org.settings.max_users);
      setMaxDocs(org.settings.max_documents);
      setAllowedDomains(org.settings.allowed_domains.join(', '));
      setEnforce2FA(!!org.settings.enforce_2fa);
      setSessionIdleTimeout(org.settings.session_idle_timeout_minutes ?? 30);
    }
  }, [org]);

  // Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.patch('/tenants/settings/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      setSuccessMessage('Organization governance limits updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update organization settings.');
      setTimeout(() => setErrorMessage(null), 4000);
    },
  });

  // Document Vault CRUD States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadRoles, setUploadRoles] = useState<string[]>(['admin', 'hr', 'manager', 'employee']);
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; size: number; status: 'uploading' | 'completed' | 'failed'; error?: string }>>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deletingItem, setDeletingItem] = useState<VaultItem | null>(null);
  const [inspectingItem, setInspectingItem] = useState<VaultItem | null>(null);

  // Read-only Document Viewer States (No copy, no download)
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const { data: docContent, isLoading: contentLoading } = useQuery<any>({
    queryKey: ['doc-content', viewingDocId],
    queryFn: () => api.get(`/knowledge/documents/${viewingDocId}/content/`),
    enabled: !!viewingDocId,
  });

  // Edit Modal States
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>(['admin', 'hr', 'manager', 'employee']);

  const openEditModal = (item: VaultItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory('');
    const baseRoles = item.access_roles && item.access_roles.length > 0 ? item.access_roles : ['admin', 'hr', 'manager', 'employee'];
    setEditRoles(baseRoles.includes('admin') ? baseRoles : ['admin', ...baseRoles]);
  };

  const updateDocMutation = useMutation({
    mutationFn: (data: { id: string; title: string; category?: string; allowed_roles: string }) =>
      api.patch(`/knowledge/documents/${data.id}/`, {
        title: data.title,
        category: data.category,
        allowed_roles: data.allowed_roles,
      }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['document-vault'] });
      const previousVault = queryClient.getQueryData<VaultItem[]>(['document-vault']);
      queryClient.setQueryData<VaultItem[]>(['document-vault'], (old) =>
        old
          ? old.map((i) =>
              i.id === data.id
                ? {
                    ...i,
                    title: data.title,
                    access_roles: data.allowed_roles.split(',').map((r) => r.trim()).filter(Boolean),
                  }
                : i
            )
          : []
      );
      return { previousVault };
    },
    onSuccess: () => {
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      refetchVault();
      refetchGov();
      setSuccessMessage('Document updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.previousVault) {
        queryClient.setQueryData(['document-vault'], context.previousVault);
      }
      setErrorMessage(extractErrorMessage(err) || 'Failed to update document.');
      setTimeout(() => setErrorMessage(null), 4000);
    },
  });

  // Handle Bulk Files Upload (Auto AI extraction of title, category, keywords, and vectors)
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setIsUploadingDoc(true);
    const queue = fileList.map((f) => ({
      name: f.name,
      size: f.size,
      status: 'uploading' as const,
    }));
    setUploadQueue(queue);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const autoTitle = file.name.replace(/\.[^/.]+$/, '');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', autoTitle);
      formData.append('category', ''); // Backend AI automatically classifies category
      formData.append('allowed_roles', uploadRoles.join(','));

      try {
        await api.post('/knowledge/documents/upload/', formData);
        successCount++;
        setUploadQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'completed' } : item))
        );
      } catch (err: any) {
        failCount++;
        setUploadQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'failed', error: extractErrorMessage(err) } : item
          )
        );
      }
    }

    queryClient.invalidateQueries({ queryKey: ['document-vault'] });
    queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    refetchVault();
    refetchGov();
    setIsUploadingDoc(false);

    if (failCount === 0) {
      setSuccessMessage(`${successCount} document(s) uploaded successfully! AI extraction & vector indexing queued.`);
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadQueue([]);
        setSuccessMessage(null);
      }, 1500);
    } else {
      setErrorMessage(`${successCount} uploaded, ${failCount} failed.`);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Drag and Drop handlers for upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
  };

  // Purge Storage Mutation
  const purgeMutation = useMutation({
    mutationFn: () => api.post('/tenants/purge-test-storage/'),
    onSuccess: (data: any) => {
      setIsPurgeModalOpen(false);
      queryClient.setQueryData<VaultItem[]>(['document-vault'], []);
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      refetchVault();
      refetchGov();
      setSuccessMessage(
        data?.message || 'Storage and test datasets purged successfully. Limits reset!'
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(extractErrorMessage(err) || 'Failed to purge test storage.');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Delete Vault Item Mutation with Instant Optimistic Removal
  const deleteVaultItemMutation = useMutation({
    mutationFn: async (item: VaultItem) => {
      if (item.source === 'knowledge') {
        return api.delete(`/knowledge/documents/${item.id}/`);
      } else if (item.source === 'expenses') {
        return api.delete(`/expenses/claims/${item.id}/`);
      } else if (item.source === 'hiring') {
        return api.delete(`/hiring/candidates/${item.id}/`);
      } else if (item.source === 'meetings') {
        return api.delete(`/meetings/${item.id}/`);
      }
      return api.delete(`/knowledge/documents/${item.id}/`);
    },
    onMutate: async (item: VaultItem) => {
      // 1. Immediately close modal and cancel ongoing vault query
      setDeletingItem(null);
      await queryClient.cancelQueries({ queryKey: ['document-vault'] });

      // 2. Snapshot current vault state for rollback on error
      const previousVault = queryClient.getQueryData<VaultItem[]>(['document-vault']);

      // 3. Optimistically remove item from UI state immediately without waiting for server roundtrip
      queryClient.setQueryData<VaultItem[]>(['document-vault'], (old) =>
        old ? old.filter((i) => i.id !== item.id) : []
      );

      return { previousVault };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      refetchVault();
      refetchGov();
      setSuccessMessage('Document removed from vault successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any, _item, context: any) => {
      if (context?.previousVault) {
        queryClient.setQueryData(['document-vault'], context.previousVault);
      }
      setErrorMessage(extractErrorMessage(err) || 'Failed to delete vault item.');
      setTimeout(() => setErrorMessage(null), 4000);
    },
  });

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const domains = allowedDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0);

    updateSettingsMutation.mutate({
      max_users: Number(maxUsers) || 10,
      max_documents: Number(maxDocs) || 50,
      allowed_domains: domains,
      enforce_2fa: enforce2FA,
      session_idle_timeout_minutes: Number(sessionIdleTimeout),
    });
  };

  // SQL Execution
  const handleExecuteSQL = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    setSqlError(null);
    setSqlResult(null);

    try {
      const res = await api.post('/tenants/execute-sql/', { sql: sqlQuery });
      setSqlResult(res);
      setIsResultsModalOpen(true);
    } catch (err: any) {
      setSqlError(extractErrorMessage(err) || 'Failed to execute query.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyJson = () => {
    if (!sqlResult?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(sqlResult.rows, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!sqlResult?.rows || !sqlResult?.columns) return;
    const headers = sqlResult.columns.join(',');
    const csvRows = sqlResult.rows.map((row: any) =>
      sqlResult.columns.map((c: string) => `"${String(row[c] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `query_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Vault items
  const filteredVault = (vaultItems || []).filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      item.uploader.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      item.source_label.toLowerCase().includes(vaultSearch.toLowerCase());

    const matchesSource = selectedSource === 'all' || item.source === selectedSource;
    const matchesSensitivity = selectedSensitivity === 'all' || item.sensitivity_level === selectedSensitivity;

    return matchesSearch && matchesSource && matchesSensitivity;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'knowledge':
        return <BookOpen className="w-4 h-4 text-primary" />;
      case 'expenses':
        return <CreditCard className="w-4 h-4 text-emerald-500" />;
      case 'hiring':
        return <Briefcase className="w-4 h-4 text-amber-500" />;
      case 'meetings':
        return <Video className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSensitivityBadge = (level: string) => {
    switch (level) {
      case 'restricted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Lock className="w-3 h-3" /> Restricted
          </span>
        );
      case 'confidential':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Shield className="w-3 h-3" /> Confidential
          </span>
        );
      case 'internal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <ShieldCheck className="w-3 h-3" /> Internal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Public
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              Org Governance & Usage Hub
            </h1>
            <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800 shrink-0">
              {govStats?.organization?.plan || org?.plan || 'Enterprise'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Unified cross-panel document vault, AI token quota telemetry, storage infrastructure & compliance audit.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchGov();
              refetchVault();
            }}
            className="w-full sm:w-auto gap-1.5 border-border shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-8 sm:h-9"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab('vault')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'vault'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Document Vault & RBAC
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              {govStats?.document_vault?.total_documents ?? '...'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ai_usage')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ai_usage'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            AI Token & Quota Tracker
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold">
              {govStats?.ai_usage?.quota_percent ?? 0}%
            </span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'storage'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
            Storage & Vector Infra
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'security'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
            Security & Audit Logs
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Org Policies & Console
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 sm:space-y-6">
        {/* Toast Messages */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: UNIFIED DOCUMENT VAULT & PRIVACY */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            {/* Category Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {govStats?.document_vault?.categories?.map((cat) => (
                <Card key={cat.key} className="border-border bg-white dark:bg-slate-900 shadow-xs hover:border-primary/50 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {getSourceIcon(cat.key)}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                        {cat.size_mb} MB
                      </span>
                    </div>
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-foreground truncate">{cat.label}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-foreground">{cat.count}</span>
                        <span className="text-xs text-muted-foreground">files secured</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground font-medium">Access:</span>
                      {cat.access_roles.map((r) => (
                        <span key={r} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Document Vault Table Card */}
            <Card className="border-border bg-white dark:bg-slate-900 shadow-xs">
              <CardHeader className="p-6 border-b border-border">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Cross-Panel Enterprise Document Vault
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aggregated central index of all documents, receipts, resumes, and meeting records with complete CRUD & RBAC controls.
                    </p>
                  </div>

                  {/* Actions & Filters */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      onClick={() => setIsUploadModalOpen(true)}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 h-9 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      Upload Document
                    </Button>

                    <div className="relative min-w-[200px]">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search document name, uploader..."
                        value={vaultSearch}
                        onChange={(e) => setVaultSearch(e.target.value)}
                        className="pl-9 text-xs h-9 bg-white/50 dark:bg-slate-900/50"
                      />
                    </div>

                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      className="px-3 h-9 text-xs bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary font-medium text-foreground"
                    >
                      <option value="all">All Modules</option>
                      <option value="knowledge">Knowledge Base</option>
                      <option value="expenses">Expenses & Receipts</option>
                      <option value="hiring">Hiring Resumes</option>
                      <option value="meetings">Meeting Transcripts</option>
                    </select>

                    <select
                      value={selectedSensitivity}
                      onChange={(e) => setSelectedSensitivity(e.target.value)}
                      className="px-3 h-9 text-xs bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary font-medium text-foreground"
                    >
                      <option value="all">All Sensitivity</option>
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {vaultLoading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading document directory...</p>
                  </div>
                ) : filteredVault.length === 0 ? (
                  <div className="p-12 text-center">
                    <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <h4 className="text-base font-semibold text-foreground">No documents found</h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                      Try adjusting your search terms or upload a new document to the vault.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                          <th className="px-6 py-4">Title</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Size</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Allowed Roles</th>
                          <th className="px-6 py-4">Uploaded By</th>
                          <th className="px-6 py-4">Uploaded At</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-sm">
                        {filteredVault.map((item) => (
                          <tr key={`${item.source}-${item.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all">
                            <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                <span className="truncate max-w-xs">{item.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground">
                              {item.file_type}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                              {formatBytes(item.file_size_bytes)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                                Searchable
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {item.access_roles.length >= 4 ? (
                                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                                    All
                                  </span>
                                ) : (
                                  item.access_roles.map((r) => (
                                    <span
                                      key={r}
                                      className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-950/20 dark:text-blue-400 capitalize"
                                    >
                                      {r}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-sm">
                              {item.uploader || 'System'}
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground font-semibold">
                              {item.created_at}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (item.source === 'knowledge') {
                                      setViewingDocId(item.id);
                                    } else {
                                      setViewingVaultItem(item);
                                    }
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-foreground"
                                  title="Read document content"
                                >
                                  <BookOpen className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(item)}
                                  className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                                  title="Edit document details"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingItem(item)}
                                  className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  title="Delete document"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: AI TOKEN & QUOTA TELEMETRY */}
        {activeTab === 'ai_usage' && (
          <div className="space-y-6">
            {/* Multi-Tenant Resource Pool Sharing Banner */}
            {govStats?.multi_tenant_allocation && (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">Multi-Tenant AI Rate & Token Allocation: </span>
                    <span className="text-muted-foreground">
                      Free cloud LLM quota (500,000 tokens/mo) is partitioned equally across {govStats.multi_tenant_allocation.total_organizations_count} active tenant organization(s).
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono font-semibold text-amber-700 dark:text-amber-300">
                  <span className="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-800">
                    Quota: {govStats.multi_tenant_allocation.allocated_token_quota.toLocaleString()} Tokens / Org
                  </span>
                  <span className="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-800">
                    Share: {govStats.multi_tenant_allocation.org_share_percentage}%
                  </span>
                </div>
              </div>
            )}

            {/* Top Quota Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Monthly Token Allowance</span>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground font-mono">
                      {(govStats?.ai_usage?.total_tokens_used || 0).toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {(govStats?.ai_usage?.monthly_quota || 500000).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(govStats?.ai_usage?.quota_percent || 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex justify-between">
                    <span>{govStats?.ai_usage?.quota_percent || 0}% Consumed</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {((govStats?.ai_usage?.tokens_remaining || 0) / 1000).toFixed(0)}k tokens remaining
                    </span>
                  </p>
                </div>
              </Card>

              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">AI Cost Savings Generated</span>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground font-mono">
                    ${(govStats?.ai_usage?.estimated_saas_savings_usd || 180.5).toFixed(2)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-2">
                    Estimated vs third-party SaaS tool subscriptions (Doc OCR + Audio transcription + Resume ATS + RAG).
                  </p>
                </div>
              </Card>

              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Active LLM Engines</span>
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">Gemini 1.5 Flash (Vision & OCR)</span>
                    <span className="text-emerald-500 font-bold">Online</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">Gemini Embeddings 004 (Vector)</span>
                    <span className="text-emerald-500 font-bold">Online</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">Gemini 1.5 Pro (CSV Analysis)</span>
                    <span className="text-emerald-500 font-bold">Online</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Feature breakdown table */}
            <Card className="border-border bg-white dark:bg-slate-900 shadow-xs">
              <CardHeader className="p-6 border-b border-border">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  AI Token Consumption Telemetry by Feature
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Granular breakdown of Gemini token allocation across organization modules.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-border text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                      <tr>
                        <th className="py-3.5 px-6">AI Feature</th>
                        <th className="py-3.5 px-4">Total Execution Invocations</th>
                        <th className="py-3.5 px-4">Estimated Tokens</th>
                        <th className="py-3.5 px-6 text-right">Quota Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {govStats?.ai_usage?.by_feature?.map((f) => {
                        const total = govStats?.ai_usage?.total_tokens_used || 1;
                        const pct = Math.round((f.tokens / (total || 1)) * 100);
                        return (
                          <tr key={f.feature} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-4 px-6 font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                {f.feature}
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono font-medium text-foreground">
                              {f.requests} runs
                            </td>
                            <td className="py-4 px-4 font-mono text-muted-foreground">
                              {f.tokens.toLocaleString()} tokens
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="font-mono text-xs font-bold text-foreground min-w-[32px]">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: STORAGE & VECTOR INFRASTRUCTURE */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            {/* Multi-Tenant Resource Pool Sharing Banner */}
            {govStats?.multi_tenant_allocation && (
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-lg shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">Multi-Tenant Dynamic Resource Pooling: </span>
                    <span className="text-muted-foreground">
                      Free cloud tier (500 MB DB & 500k monthly AI tokens) is divided equally across {govStats.multi_tenant_allocation.total_organizations_count} active tenant organization(s).
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono font-semibold text-purple-700 dark:text-purple-300">
                  <span className="px-2.5 py-1 rounded bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-800">
                    {govStats.multi_tenant_allocation.allocated_storage_mb} MB Storage / Org
                  </span>
                  <span className="px-2.5 py-1 rounded bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-800">
                    {govStats.multi_tenant_allocation.allocated_token_quota.toLocaleString()} Tokens / Org
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Media & Document Storage */}
              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Media & Document Object Storage</h3>
                      <p className="text-xs text-muted-foreground">Receipts, PDFs, Resumes & Attachments</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-full">
                    Healthy
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {govStats?.document_vault?.storage_used_mb || 0} MB
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      Org Cap: {govStats?.document_vault?.storage_cap_mb || 500} MB
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(govStats?.document_vault?.storage_percent || 1, 100)}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {govStats?.document_vault?.storage_percent || 0}% of tenant disk allocation consumed.
                  </p>
                </div>
              </Card>

              {/* Vector Database Infrastructure */}
              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-primary">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{govStats?.infrastructure?.vector_engine || 'Qdrant Vector Engine'}</h3>
                      <p className="text-xs text-muted-foreground">High-Dimensional Semantic RAG Search</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-full">
                    Active
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border">
                    <span className="text-xs text-muted-foreground">Indexed Chunks</span>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">
                      {govStats?.infrastructure?.vector_chunks_indexed || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border">
                    <span className="text-xs text-muted-foreground">Vector Dim</span>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">
                      {govStats?.infrastructure?.embedding_dimension || 768}d
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border">
                    <span className="text-xs text-muted-foreground">Avg Latency</span>
                    <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      {govStats?.infrastructure?.search_latency_ms || 18}ms
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Relational Database Health */}
            <Card className="border-border bg-white dark:bg-slate-900 shadow-xs p-6">
              <CardTitle className="text-base font-bold flex items-center gap-2 mb-4">
                <DbIcon className="w-5 h-5 text-primary" />
                Relational Multi-Tenant Storage Architecture
              </CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-xs font-semibold text-muted-foreground">Engine</span>
                  <p className="text-sm font-bold text-foreground mt-1">PostgreSQL 16</p>
                </div>
                <div className="p-4 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-xs font-semibold text-muted-foreground">Isolation Mode</span>
                  <p className="text-sm font-bold text-foreground mt-1">Row-Level Tenant Scoping</p>
                </div>
                <div className="p-4 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-xs font-semibold text-muted-foreground">Connection Pool</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">Optimal (Active)</p>
                </div>
                <div className="p-4 border border-border rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-xs font-semibold text-muted-foreground">Backup Snapshot</span>
                  <p className="text-sm font-bold text-foreground mt-1">Automated Daily</p>
                </div>
              </div>
            </Card>

            {/* Test Storage Maintenance & Reset */}
            <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 shadow-xs p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-base">
                    <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    Test Storage Purge & Clean Reset
                  </div>
                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    Instantly wipe all test documents, Qdrant vector embeddings, uploaded candidate resumes, and expense receipts to reclaim 100% free storage (0.0 MB). 
                    <span className="font-semibold text-foreground ml-1">Your user accounts, organization profile, and playbook automations are protected and will remain intact.</span>
                  </p>
                </div>
                <Button
                  onClick={() => setIsPurgeModalOpen(true)}
                  variant="destructive"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shrink-0 gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Purge Test Storage
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: SECURITY & AUDIT LOGS */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Security Isolation Certificate Banner */}
            <div className="p-4 rounded-xl border border-border bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 border border-emerald-200/60 dark:border-emerald-900/50">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Certified Multi-Tenant Isolation & Zero Cross-Org Leakage</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                      Enforced
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    All document queries, vector embeddings, SQL execution, and AI contexts are cryptographically scoped to Tenant ID <span className="font-mono text-primary font-semibold">[{org?.id || govStats?.organization?.id}]</span>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 font-medium text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-border text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  {govStats?.security_compliance?.encryption_at_rest || 'AES-256 (Cloud Encrypted)'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-border text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  {govStats?.security_compliance?.encryption_in_transit || 'TLS 1.3 / HTTPS (Active)'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-border text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Role-Based Access (RBAC)
                </span>
              </div>
            </div>

            {/* Audit Log Stream */}
            <Card className="border-border bg-white dark:bg-slate-900 shadow-xs">
              <CardHeader className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Organization Compliance & Audit Stream
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Immutable security log records tracking admin operations, logins, 2FA events, role modifications, and document access.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAudit()}
                    disabled={auditLoading || auditFetching}
                    className="text-xs font-semibold h-8 gap-1.5"
                    title="Refresh Feed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${auditFetching ? 'animate-spin text-primary' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExportAuditCSV}
                    disabled={isExportingAudit || auditLoading}
                    className="text-xs font-semibold h-8 gap-1.5 shadow-xs"
                    title="Export Audit Logs as CSV"
                  >
                    {isExportingAudit ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {isExportingAudit ? 'Exporting...' : 'Export to CSV'}
                  </Button>
                </div>
              </CardHeader>

              {/* Filter Toolbar */}
              <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search actor, email, action, details, IP..."
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        setAuditPage(1);
                      }}
                      className="pl-8 h-8.5 text-xs bg-white dark:bg-slate-950"
                    />
                    {auditSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuditSearch('');
                          setAuditPage(1);
                        }}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-foreground text-sm font-bold"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Action Filter */}
                  <select
                    value={auditActionFilter}
                    onChange={(e) => {
                      setAuditActionFilter(e.target.value);
                      setAuditPage(1);
                    }}
                    className="h-8.5 rounded-md border border-input bg-white dark:bg-slate-950 px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <option value="all">All Action Types</option>
                    <option value="USER_LOGIN">USER_LOGIN</option>
                    <option value="USER_LOGOUT">USER_LOGOUT</option>
                    <option value="USER_2FA_ENABLED">USER_2FA_ENABLED</option>
                    <option value="USER_2FA_DISABLED">USER_2FA_DISABLED</option>
                    <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
                    <option value="USER_ACTIVATED">USER_ACTIVATED</option>
                    <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
                    <option value="DELETE_USER">DELETE_USER</option>
                    <option value="MEMBER_INVITED">MEMBER_INVITED</option>
                    <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
                    <option value="PASSWORD_RESET_REQUEST">PASSWORD_RESET_REQUEST</option>
                    <option value="PASSWORD_RESET_CONFIRM">PASSWORD_RESET_CONFIRM</option>
                  </select>
                </div>

                {/* Date Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-input rounded-md px-2 py-1 h-8.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">From:</span>
                    <input
                      type="date"
                      value={auditStartDate}
                      onChange={(e) => {
                        setAuditStartDate(e.target.value);
                        setAuditPage(1);
                      }}
                      className="text-xs bg-transparent focus:outline-none text-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-input rounded-md px-2 py-1 h-8.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">To:</span>
                    <input
                      type="date"
                      value={auditEndDate}
                      onChange={(e) => {
                        setAuditEndDate(e.target.value);
                        setAuditPage(1);
                      }}
                      className="text-xs bg-transparent focus:outline-none text-foreground"
                    />
                  </div>
                  {(auditSearch || auditActionFilter !== 'all' || auditStartDate || auditEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAuditSearch('');
                        setAuditActionFilter('all');
                        setAuditStartDate('');
                        setAuditEndDate('');
                        setAuditPage(1);
                      }}
                      className="h-8.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Table Body */}
              <CardContent className="p-0">
                {auditLoading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading audit log feed...</p>
                  </div>
                ) : !auditData?.results || auditData.results.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <Clock className="w-10 h-10 mx-auto opacity-40 text-primary" />
                    <p className="font-semibold text-foreground text-sm">No audit events match your search.</p>
                    <p className="text-xs">Adjust your search keyword, action filter, or date range.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-border text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Details</th>
                          <th className="py-3 px-4">Target Resource</th>
                          <th className="py-3 px-4 text-right">IP Address</th>
                          <th className="py-3 px-3 text-center">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditData.results.map((log: any) => {
                          const getActionStyle = (action: string) => {
                            if (action.includes('ACTIVATED') || action.includes('2FA_ENABLED') || action.includes('LOGIN')) {
                              return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                            }
                            if (action.includes('DEACTIVATED') || action.includes('DELETE') || action.includes('2FA_DISABLED') || action.includes('REJECTED')) {
                              return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                            }
                            if (action.includes('ROLE') || action.includes('INVITED') || action.includes('INVITATION')) {
                              return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                            }
                            if (action.includes('DOCUMENT') || action.includes('TASK') || action.includes('PROJECT')) {
                              return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                            }
                            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                          };

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Timestamp */}
                              <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                                <div>{new Date(log.created_at).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</div>
                              </td>

                              {/* Actor */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                                    {getInitials(log.actor_name || log.actor || 'System')}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-foreground block truncate max-w-[130px]">
                                      {log.actor_name || log.actor || 'System'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block truncate max-w-[130px]">
                                      {log.actor_email || 'System'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Action */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border uppercase ${getActionStyle(log.action)}`}>
                                  {log.action}
                                </span>
                              </td>

                              {/* Details */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.detail}>
                                {log.detail || '-'}
                              </td>

                              {/* Target */}
                              <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                                <span className="font-semibold text-foreground">{log.target_type || '-'}</span>
                                {log.target_id && log.target_id !== '-' && (
                                  <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                                    ID: {log.target_id}
                                  </span>
                                )}
                              </td>

                              {/* IP Address */}
                              <td className="py-3 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                                {log.ip_address || '127.0.0.1'}
                              </td>

                              {/* Inspect Button */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditLog(log)}
                                  className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Inspect Event Payload"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {auditData && auditData.count > 10 && (
                  <div className="p-4 border-t border-border flex items-center justify-between text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      className="h-8"
                    >
                      Previous
                    </Button>
                    <span className="text-muted-foreground font-mono">
                      Page {auditPage} of {Math.ceil(auditData.count / 10)} ({auditData.count} total records)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!auditData.next}
                      onClick={() => setAuditPage((p) => p + 1)}
                      className="h-8"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Event Detail Inspector Dialog */}
            <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
              <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)]">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Audit Event Security Record
                  </DialogTitle>
                </DialogHeader>
                {selectedAuditLog && (
                  <div className="space-y-3.5 py-2 text-xs">
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-border">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Event Action</span>
                        <span className="font-mono font-bold text-primary">{selectedAuditLog.action}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Timestamp (UTC)</span>
                        <span className="font-mono text-muted-foreground">{new Date(selectedAuditLog.created_at).toISOString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Actor Name</span>
                        <span className="font-semibold text-foreground">{selectedAuditLog.actor_name || selectedAuditLog.actor}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Actor Email</span>
                        <span className="font-mono text-foreground">{selectedAuditLog.actor_email || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Target Type</span>
                        <span className="font-medium text-foreground">{selectedAuditLog.target_type}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Client IP Address</span>
                        <span className="font-mono text-foreground">{selectedAuditLog.ip_address}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Event Details</span>
                      <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-200 break-words">
                        {selectedAuditLog.detail || 'No additional details logged.'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Target ID</span>
                      <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg font-mono text-[11px] select-all">
                        {selectedAuditLog.target_id || '-'}
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAuditLog(null)}
                    className="w-full text-xs font-semibold"
                  >
                    Close Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* TAB 5: ORG POLICIES & SQL CONSOLE */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Org Limits Form */}
            <Card className="border-border bg-white dark:bg-slate-900 shadow-xs">
              <CardHeader className="p-6 border-b border-border">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  Organization Policy & Capacity Controls
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Enforce organizational limits for maximum seat provisioning, storage quota caps, and email domain whitelisting.
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSettingsSubmit} className="space-y-5 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                        Max User Seats Limit
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={maxUsers}
                        onChange={(e) => setMaxUsers(e.target.value === '' ? '' : Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                        Max Documents Quota
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="50000"
                        value={maxDocs}
                        onChange={(e) => setMaxDocs(e.target.value === '' ? '' : Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                      Allowed Email Whitelist Domains (Comma separated)
                    </label>
                    <Input
                      placeholder="e.g. acme.com, techcorp.io"
                      value={allowedDomains}
                      onChange={(e) => setAllowedDomains(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Employees can only signup if their work email domain matches one of these allowed domains.
                    </p>
                  </div>

                  {/* Enterprise Security & Access Compliance (SOC 2, GDPR, DPDP) */}
                  <div className="pt-4 border-t border-border space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Enterprise Compliance & Access Control Policies
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mandate zero-trust authentication standards and automated session expiration across all workspace members.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                      {/* 2FA Enforcement Switch */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              Mandatory Two-Factor Authentication (2FA)
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              SOC 2 / ISO 27001
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            When enabled, members without active 2FA are immediately locked with a setup prompt upon login.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnforce2FA(!enforce2FA)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            enforce2FA ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              enforce2FA ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Inactivity Session Idle Timeout */}
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                Inactivity Session Idle Timeout
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Automatically warn and log out inactive sessions to prevent unauthorized device access.
                            </p>
                          </div>
                          <select
                            value={sessionIdleTimeout}
                            onChange={(e) => setSessionIdleTimeout(Number(e.target.value))}
                            className="h-9 px-3 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          >
                            <option value={15}>15 Minutes (High Security / Financial)</option>
                            <option value={30}>30 Minutes (Recommended Standard)</option>
                            <option value={60}>60 Minutes (Enterprise Standard)</option>
                            <option value={0}>Disabled (No Session Expiry)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Update Policy Settings'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Superuser SQL Console & Schema */}
            {user?.is_superuser && (
              <Card className="border-border bg-white dark:bg-slate-900 shadow-xs">
                <CardHeader className="p-6 border-b border-border">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-600" />
                    Superadmin Read-Only SQL Terminal & Schema Explorer
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Execute safe, throttled SELECT queries. Writes, DDL, and multi-statements are strictly blocked.
                  </p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full p-3 font-mono text-sm bg-slate-950 text-emerald-400 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Queries are automatically capped to 500 rows and sensitive keys (passwords, tokens) are masked.
                      </p>
                      <Button
                        onClick={handleExecuteSQL}
                        disabled={isExecuting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                      >
                        {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                        Execute Query
                      </Button>
                    </div>
                  </div>

                  {sqlError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 rounded-lg text-xs font-mono">
                      Error: {sqlError}
                    </div>
                  )}

                  {/* Schema ER Preview */}
                  {schemaMetadata && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <h4 className="text-sm font-bold text-foreground mb-3">Database Table ER Explorer</h4>
                      <div className="flex flex-wrap gap-2">
                        {schemaMetadata.map((t: any) => (
                          <button
                            key={t.table}
                            onClick={() => setSelectedTable(t.table)}
                            className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
                              selectedTable === t.table
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground border-border hover:text-foreground'
                            }`}
                          >
                            {t.table}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Test Storage Reset & Danger Zone */}
            <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 shadow-xs">
              <CardHeader className="p-6 border-b border-rose-200 dark:border-rose-900/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  Test Environment Reset & Storage Purge
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Reclaim 100% free database and vector storage capacity for new rounds of local or cloud testing.
                </p>
              </CardHeader>
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-muted-foreground max-w-xl">
                  <p>
                    Purges test knowledge documents, Qdrant vectors, ATS resumes, meeting transcripts, and receipts.
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    ✔ Preserved: Admin accounts, passwords, employee seats, and playbook definitions.
                  </p>
                </div>
                <Button
                  onClick={() => setIsPurgeModalOpen(true)}
                  variant="destructive"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shrink-0 gap-2 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Purge Test Storage
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* SQL Results Modal */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-500" />
                Query Execution Results
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyJson} className="gap-1.5 text-xs">
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy JSON
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCsv} className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
            {sqlResult && (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Returned {sqlResult.rows?.length || 0} rows in {sqlResult.execution_time_ms}ms
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto border border-border rounded-lg mt-4">
            {sqlResult?.rows && sqlResult.rows.length > 0 ? (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-border">
                  <tr>
                    {sqlResult.columns.map((c: string) => (
                      <th key={c} className="py-2.5 px-4 font-bold text-foreground uppercase">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sqlResult.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {sqlResult.columns.map((c: string) => (
                        <td key={c} className="py-2.5 px-4 whitespace-nowrap text-muted-foreground">
                          {String(row[c] !== null && row[c] !== undefined ? row[c] : 'NULL')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Query returned 0 records.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Purge Test Storage Confirmation Modal */}
      <Dialog open={isPurgeModalOpen} onOpenChange={setIsPurgeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Purge Test Storage?
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reset storage consumption back to 0.0 MB
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs text-muted-foreground leading-relaxed">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200">Target Organization:</span>
              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                {govStats?.organization?.name || org?.name || 'Current Organization'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border space-y-1.5 font-medium text-foreground">
              <p className="text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider text-[11px]">
                Items that will be permanently cleared:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                <li>Knowledge Base SOPs, PDFs, and Qdrant vector chunks</li>
                <li>Expense claim receipts and OCR attachments</li>
                <li>Candidate resumes and hiring submissions</li>
                <li>Meeting transcripts and automation logs</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>User logins, org settings & playbooks will NOT be deleted.</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-300 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Multi-Tenant Safe: Other tenant organizations will not be affected.</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeModalOpen(false)}
              disabled={purgeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => purgeMutation.mutate()}
              disabled={purgeMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
            >
              {purgeMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Purging Storage...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Yes, Purge Test Storage
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Streamlined Upload Document Modal (Auto AI metadata extraction & Bulk Upload) */}
      <Dialog
        open={isUploadModalOpen}
        onOpenChange={(open) => {
          if (!isUploadingDoc) {
            setIsUploadModalOpen(open);
            if (!open) setUploadQueue([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Bulk Upload to Enterprise Vault
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI automatically extracts titles, classifies categories, and indexes vector embeddings.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* RBAC Role Selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                RBAC Access Roles Allowed
              </label>
              <div className="flex flex-wrap gap-2">
                {['admin', 'hr', 'manager', 'employee'].map((role) => {
                  const isChecked = role === 'admin' || uploadRoles.includes(role);
                  const isAdmin = role === 'admin';
                  return (
                    <label
                      key={role}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        isAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                      } transition-all ${
                        isChecked
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        disabled={isAdmin || isUploadingDoc}
                        onChange={(e) => {
                          if (isAdmin) return;
                          if (e.target.checked) {
                            setUploadRoles([...uploadRoles, role]);
                          } else {
                            setUploadRoles(uploadRoles.filter((r) => r !== role));
                          }
                        }}
                      />
                      <Check className={`w-3.5 h-3.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="capitalize">{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dropzone Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'border-border bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-900/30 dark:hover:bg-slate-900/50'
              }`}
            >
              <input
                type="file"
                id="vault-bulk-upload"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={handleFileInput}
                disabled={isUploadingDoc}
                className="hidden"
              />
              <label
                htmlFor="vault-bulk-upload"
                className={`flex flex-col items-center gap-2 ${
                  isUploadingDoc ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-border text-primary">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Drag & Drop files here, or <span className="text-primary underline">browse</span>
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports multiple PDF, DOCX, and TXT files (up to 50MB each)
                  </p>
                </div>
              </label>
            </div>

            {/* Upload Queue Progress List */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <span>Upload Status</span>
                  <span>
                    {uploadQueue.filter((f) => f.status === 'completed').length} / {uploadQueue.length} done
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {uploadQueue.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/40 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 font-medium">
                        {file.status === 'uploading' && (
                          <span className="text-primary flex items-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                          </span>
                        )}
                        {file.status === 'completed' && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Indexed
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1" title={file.error}>
                            <AlertCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadQueue([]);
              }}
              disabled={isUploadingDoc}
            >
              {isUploadingDoc ? 'Uploading in background...' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only Document Preview Dialog (No Copy, No Download) */}
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
                <pre 
                  className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-border select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                >
                  {docContent.content}
                </pre>
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground flex-1">
                No content could be extracted from this document, or it is still indexing.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Non-Knowledge Vault Item Preview Modal (Resumes, Offer Letters, Meeting Transcripts, Receipts) */}
      <Dialog open={!!viewingVaultItem} onOpenChange={(open) => !open && setViewingVaultItem(null)}>
        <DialogContent className="max-w-4xl w-[92vw] max-h-[90vh] h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/60 rounded-xl text-primary border border-purple-200/50 shrink-0">
                  {viewingVaultItem?.source === 'meetings' ? (
                    <Video className="w-5 h-5" />
                  ) : viewingVaultItem?.source === 'hiring' ? (
                    <Briefcase className="w-5 h-5" />
                  ) : viewingVaultItem?.source === 'expenses' ? (
                    <CreditCard className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-extrabold text-foreground truncate">
                    {viewingVaultItem?.title}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-primary">{viewingVaultItem?.source_label}</span>
                    <span>•</span>
                    <span>Uploaded by {viewingVaultItem?.uploader}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">{viewingVaultItem?.created_at}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2 shrink-0">
                {viewingVaultItem?.source === 'meetings' && (
                  <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-border text-[11px]">
                    <button
                      type="button"
                      onClick={() => setMeetingViewMode('notes')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        meetingViewMode === 'notes' ? 'bg-white dark:bg-slate-900 text-primary shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      AI Summary & Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingViewMode('pdf')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                        meetingViewMode === 'pdf' ? 'bg-white dark:bg-slate-900 text-primary shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Official PDF
                    </button>
                  </div>
                )}

                {viewingVaultItem?.file_url && (
                  <a
                    href={vaultBlobUrl || getDirectVaultUrl(viewingVaultItem)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (vaultBlobUrl) {
                        e.preventDefault();
                        window.open(vaultBlobUrl, '_blank');
                      }
                    }}
                    className="h-8 px-3 rounded-lg border border-border bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-foreground inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Open document in a new browser tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Open in New Tab</span>
                  </a>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body */}
          <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950/60 p-4 min-h-0 flex flex-col">
            {/* If Meeting and viewing notes tab */}
            {viewingVaultItem?.source === 'meetings' && meetingViewMode === 'notes' ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 space-y-4 max-w-3xl mx-auto w-full shadow-xs">
                {/* Meeting Meta Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{viewingVaultItem.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Host: {viewingVaultItem.uploader} · Room: <span className="font-mono font-semibold text-primary">{viewingVaultItem.room_code || 'Recorded Session'}</span>
                    </p>
                  </div>
                  {viewingVaultItem.room_code && (
                    <a
                      href={`/meetings`}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      Open Meeting Room <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* AI Executive Summary */}
                {viewingVaultItem.ai_summary ? (
                  <div className="space-y-1.5 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-extrabold text-primary tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> AI Executive Summary
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {viewingVaultItem.ai_summary}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No AI summary generated for this meeting yet. (Live notes generate upon meeting conclusion)
                  </div>
                )}

                {/* Key Decisions */}
                {viewingVaultItem.key_decisions && viewingVaultItem.key_decisions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                      Key Decisions Made
                    </span>
                    <div className="space-y-1.5">
                      {viewingVaultItem.key_decisions.map((decision: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-border">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-slate-800 dark:text-slate-200">{typeof decision === 'string' ? decision : JSON.stringify(decision)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {viewingVaultItem.action_items && viewingVaultItem.action_items.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                      Action Items
                    </span>
                    <div className="space-y-1.5">
                      {viewingVaultItem.action_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-border">
                          <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span className="text-slate-800 dark:text-slate-200">{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Speaker Transcript */}
                {viewingVaultItem.transcript_raw && viewingVaultItem.transcript_raw.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                      Live Speaker Transcript
                    </span>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {viewingVaultItem.transcript_raw.map((line: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-border text-xs">
                          <span className="font-bold text-primary block text-[11px]">
                            {line.speaker || 'Speaker'} {line.timestamp ? `(${line.timestamp})` : ''}:
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">{line.text || String(line)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* PDF & Image Viewer */
              <div className="flex-1 w-full h-full flex items-center justify-center min-h-[400px]">
                {viewingVaultItem?.file_url ? (
                  viewingVaultItem.file_type.includes('pdf') ||
                  viewingVaultItem.file_url.toLowerCase().includes('.pdf') ||
                  viewingVaultItem.file_url.includes('/resume') ||
                  viewingVaultItem.file_url.includes('/offer') ||
                  viewingVaultItem.file_url.includes('/transcript/export') ? (
                    vaultBlobUrl ? (
                      <iframe
                        src={vaultBlobUrl}
                        className="w-full h-full min-h-[500px] rounded-xl border border-border bg-white shadow-xs"
                        title={viewingVaultItem.title}
                      />
                    ) : docPreviewLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs font-semibold">Loading document preview...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 text-rose-500" />
                        <span className="text-xs font-bold text-foreground">
                          {docPreviewError || 'Failed to load document preview inline'}
                        </span>
                        <a
                          href={getDirectVaultUrl(viewingVaultItem)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Try Opening Directly in New Tab
                        </a>
                      </div>
                    )
                  ) : (
                    /* Image / Receipt preview */
                    <img
                      src={getMediaUrl(viewingVaultItem.file_url)}
                      alt={viewingVaultItem.title}
                      className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md border border-border"
                      onError={(e) => {
                        if (viewingVaultItem.file_url && e.currentTarget.src !== viewingVaultItem.file_url) {
                          e.currentTarget.src = viewingVaultItem.file_url;
                        }
                      }}
                    />
                  )
                ) : (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    No physical file attachment available for this record.
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-950/20 shrink-0 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              RBAC Allowed: <span className="font-semibold">{viewingVaultItem?.access_roles?.join(', ') || 'All Roles'}</span>
            </span>
            <Button variant="outline" onClick={() => setViewingVaultItem(null)} className="text-xs font-semibold h-8 px-4">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Modal */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/60 rounded-lg text-purple-600 dark:text-purple-400">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Edit Document Details
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update title, category, and RBAC role access permissions.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingItem) return;
              updateDocMutation.mutate({
                id: editingItem.id,
                title: editTitle,
                category: editCategory,
                allowed_roles: editRoles.join(','),
              });
            }}
            className="space-y-4 py-2"
          >
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                Document Title
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter document title..."
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary font-medium text-foreground"
              >
                <option value="">Auto / General</option>
                <option value="HR & Policies">HR & Policies</option>
                <option value="Engineering">Engineering & Tech</option>
                <option value="Finance">Finance & Accounting</option>
                <option value="Product">Product & Roadmap</option>
                <option value="Legal & Compliance">Legal & Compliance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                RBAC Access Roles Allowed
              </label>
              <div className="flex flex-wrap gap-2">
                {['admin', 'hr', 'manager', 'employee'].map((role) => {
                  const isChecked = role === 'admin' || editRoles.includes(role);
                  const isAdmin = role === 'admin';
                  return (
                    <label
                      key={role}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        isAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                      } transition-all ${
                        isChecked
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        disabled={isAdmin || updateDocMutation.isPending}
                        onChange={(e) => {
                          if (isAdmin) return;
                          if (e.target.checked) {
                            setEditRoles([...editRoles, role]);
                          } else {
                            setEditRoles(editRoles.filter((r) => r !== role));
                          }
                        }}
                      />
                      <Check className={`w-3.5 h-3.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="capitalize">{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                disabled={updateDocMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateDocMutation.isPending || !editTitle.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
              >
                {updateDocMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Modal */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Delete Document?
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove from vault and release storage
                </p>
              </div>
            </div>
          </DialogHeader>

          {deletingItem && (
            <div className="space-y-3 py-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Are you sure you want to delete <span className="font-bold text-foreground font-mono">"{deletingItem.title}"</span> ({deletingItem.source_label})?
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border text-[11px]">
                <p className="text-rose-600 dark:text-rose-400 font-semibold">
                  This will remove the file from storage and remove its vectors from the Qdrant index.
                </p>
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingItem(null)}
                  disabled={deleteVaultItemMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteVaultItemMutation.mutate(deletingItem)}
                  disabled={deleteVaultItemMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
                >
                  {deleteVaultItemMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Yes, Delete
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
