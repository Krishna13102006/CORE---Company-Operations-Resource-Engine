import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Video,
  UserCheck,
  Mail,
  FolderGit2,
  CreditCard,
  FileText,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  Webhook,
  MessageSquare,
  GitBranch,
  Calendar,
  DollarSign,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react';

interface Playbook {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  trigger_event: string;
  is_enabled: boolean;
  config: Record<string, any>;
  execution_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionLog {
  id: string;
  playbook_slug: string;
  trigger_source: string;
  status: 'success' | 'failed' | 'running' | 'skipped';
  steps_executed: Array<{
    step: string;
    status: string;
    detail: string;
    timestamp: string;
  }>;
  error_message: string;
  duration_ms: number;
  created_at: string;
  triggered_by_name: string;
}

interface AutomationStats {
  total_playbooks: number;
  active_playbooks: number;
  total_executions: number;
  success_rate: number;
  estimated_hours_saved: number;
}

export const Automations: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  // State for modals
  const [selectedPlaybookForConfig, setSelectedPlaybookForConfig] = useState<Playbook | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [simulationLog, setSimulationLog] = useState<ExecutionLog | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [inspectingLog, setInspectingLog] = useState<ExecutionLog | null>(null);
  const [activeTab, setActiveTab] = useState<'playbooks' | 'integrations' | 'logs'>('playbooks');

  // Fetch Playbooks
  const { data: playbooks = [], isLoading: loadingPlaybooks, refetch: refetchPlaybooks } = useQuery<Playbook[]>({
    queryKey: ['automation-playbooks'],
    queryFn: () => api.get('/automations/playbooks/'),
  });

  // Fetch Stats
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery<AutomationStats>({
    queryKey: ['automation-stats'],
    queryFn: () => api.get('/automations/stats/'),
  });

  // Fetch Logs
  const { data: logsData, isLoading: loadingLogs, refetch: refetchLogs } = useQuery<{ results: ExecutionLog[] }>({
    queryKey: ['automation-logs'],
    queryFn: () => api.get('/automations/logs/'),
  });

  const logs = logsData?.results || [];

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: ({ slug, is_enabled }: { slug: string; is_enabled: boolean }) =>
      api.post(`/automations/playbooks/${slug}/toggle/`, { is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
  });

  // Update Config Mutation
  const updateConfigMutation = useMutation({
    mutationFn: ({ slug, config }: { slug: string; config: Record<string, any> }) =>
      api.patch(`/automations/playbooks/${slug}/config/`, { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-playbooks'] });
      setSelectedPlaybookForConfig(null);
    },
  });

  // Simulation Mutation
  const simulateMutation = useMutation({
    mutationFn: (slug: string) => api.post(`/automations/playbooks/${slug}/test-run/`, {}),
    onMutate: () => setIsSimulating(true),
    onSuccess: (data: any) => {
      setSimulationLog(data.log);
      setIsSimulating(false);
      queryClient.invalidateQueries({ queryKey: ['automation-playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
    },
    onError: () => setIsSimulating(false),
  });

  const handleOpenConfig = (pb: Playbook) => {
    setSelectedPlaybookForConfig(pb);
    setConfigValues(pb.config || {});
  };

  const handleSaveConfig = () => {
    if (!selectedPlaybookForConfig) return;
    updateConfigMutation.mutate({
      slug: selectedPlaybookForConfig.slug,
      config: configValues,
    });
  };

  // Helper icons and pipelines for playbooks
  const getPlaybookMeta = (slug: string) => {
    switch (slug) {
      case 'zero_touch_onboarding':
        return {
          icon: UserCheck,
          gradient: 'from-purple-600 to-violet-600',
          badge: 'HR & Lifecycle',
          steps: [
            { title: 'Candidate Hired', icon: CheckCircle2, panel: 'ATS' },
            { title: 'Provision Profile', icon: UserCheck, panel: 'Teams' },
            { title: 'Welcome Email', icon: Mail, panel: 'Mail' },
            { title: '1-on-1 Video Sync', icon: Video, panel: 'Meetings' },
            { title: 'Checklist Tasks', icon: FolderGit2, panel: 'Projects' },
            { title: 'Equipment Budget', icon: CreditCard, panel: 'Finance' },
          ],
        };
      case 'meeting_scribe_task_delegation':
        return {
          icon: Video,
          gradient: 'from-violet-600 to-purple-600',
          badge: 'Productivity & Scribe',
          steps: [
            { title: 'Call Concluded', icon: Video, panel: 'Meetings' },
            { title: 'AI Extraction', icon: Sparkles, panel: 'AI Core' },
            { title: 'Task Delegation', icon: FolderGit2, panel: 'Projects' },
            { title: 'Vault Minutes', icon: FileText, panel: 'Knowledge' },
            { title: 'Recap Email', icon: Mail, panel: 'Mail' },
          ],
        };
      case 'compliance_expiry_sync':
        return {
          icon: ShieldCheck,
          gradient: 'from-emerald-600 to-teal-600',
          badge: 'SecOps & Governance',
          steps: [
            { title: 'Policy Update', icon: FileText, panel: 'Knowledge' },
            { title: 'Qdrant Vector Sync', icon: Layers, panel: 'AI Vector' },
            { title: 'Staff Broadcast', icon: Mail, panel: 'Mail' },
            { title: 'Governance Audit', icon: ShieldCheck, panel: 'Audit' },
          ],
        };
      default:
        return {
          icon: Zap,
          gradient: 'from-violet-600 to-purple-600',
          badge: 'Autonomous',
          steps: [],
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Automations & Workflow Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Event-driven autonomous mesh unifying Hiring, Meetings, Knowledge Base, Tasks, and Finance.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPlaybooks();
              refetchStats();
              refetchLogs();
            }}
            className="w-full sm:w-auto h-9 text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh State
          </Button>
        </div>
      </div>

      {/* Telemetry KPI Ribbon (Compact 2x2 on Mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="border-border bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Active Playbooks
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.active_playbooks ?? 0}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500">of {stats?.total_playbooks ?? 3}</span>
              </div>
            </div>
            <div className={`p-2 sm:p-3 rounded-xl shrink-0 ${stats?.active_playbooks ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Executions
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.total_executions ?? 0}
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-medium">Auto-Routed</span>
              </div>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Success Rate
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.success_rate ?? 100}%
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500">0 errors</span>
              </div>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Hours Saved
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1">
                <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.estimated_hours_saved ?? 0}h
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-medium">~15m/run</span>
              </div>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher (Touch Scrollable with No Ugly Scrollbar) */}
      <div className="border-b border-border">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab('playbooks')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'playbooks'
                ? 'border-primary text-primary dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Active Playbooks
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              {playbooks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'integrations'
                ? 'border-primary text-primary dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Connectors
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Ecosystem
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'logs'
                ? 'border-primary text-primary dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Execution Logs
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              {logs.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: PLAYBOOKS */}
      {activeTab === 'playbooks' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Core Autonomous Playbooks</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Playbooks are disabled by default. Switch any playbook ON to enable automatic cross-panel triggers.
              </p>
            </div>
            {!isAdminOrHr && (
              <span className="text-[11px] text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 self-start sm:self-auto mt-1 sm:mt-0">
                Admin/HR role required to toggle
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {playbooks.map((pb) => {
              const meta = getPlaybookMeta(pb.slug);
              const Icon = meta.icon;

              return (
                <Card
                  key={pb.id}
                  className={`border transition-all duration-200 rounded-2xl shadow-sm ${
                    pb.is_enabled
                      ? 'border-primary/50 bg-white dark:bg-slate-900'
                      : 'border-border bg-white dark:bg-slate-900'
                  }`}
                >
                  <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-md shrink-0 mt-0.5`}>
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                              {pb.name}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-border">
                              {pb.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-3 sm:line-clamp-none">
                            {pb.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Switcher */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={!isAdminOrHr || toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({
                              slug: pb.slug,
                              is_enabled: !pb.is_enabled,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            pb.is_enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                          } ${!isAdminOrHr ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              pb.is_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            pb.is_enabled ? 'text-primary' : 'text-slate-400'
                          }`}
                        >
                          {pb.is_enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-1 space-y-3.5">
                    {/* Visual Step Pipeline Flow (Clean Touch Scroll) */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-border">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        Autonomous Event Pipeline
                      </p>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden py-0.5">
                        {meta.steps.map((step, idx) => {
                          const StepIcon = step.icon;
                          return (
                            <React.Fragment key={idx}>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-border text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 shrink-0 shadow-sm">
                                <StepIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>{step.title}</span>
                                <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">
                                  {step.panel}
                                </span>
                              </div>
                              {idx < meta.steps.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Metadata & Mobile Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border text-xs text-slate-500">
                      <div className="flex items-center gap-3 flex-wrap text-[11px] sm:text-xs">
                        <span className="flex items-center gap-1 font-medium">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                          <strong>{pb.execution_count}</strong> runs
                        </span>
                        {pb.last_triggered_at && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(pb.last_triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Side-by-side 2-column grid on mobile */}
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfig(pb)}
                          className="h-9 text-xs border-border hover:bg-slate-100 dark:hover:bg-slate-800 justify-center w-full sm:w-auto"
                        >
                          <Sliders className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
                          Configure
                        </Button>

                        <Button
                          variant="default"
                          size="sm"
                          disabled={isSimulating}
                          onClick={() => simulateMutation.mutate(pb.slug)}
                          className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground justify-center w-full sm:w-auto"
                        >
                          {isSimulating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin shrink-0" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                              Test Run
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FUTURE INTEGRATIONS & CONNECTORS */}
      {activeTab === 'integrations' && (
        <div className="space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Extensible Integrations Catalog</h2>
            <p className="text-xs text-slate-500">
              Connect external SaaS services, webhooks, and communication bots to CORE's autonomous event mesh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {[
              {
                title: 'Webhooks & Event Bus',
                desc: 'Dispatch and receive HMAC-signed HTTP webhooks for custom ERP and backend systems.',
                icon: Webhook,
                tag: 'Ready for Webhooks',
                badgeColor: 'bg-emerald-500/10 text-emerald-500',
              },
              {
                title: 'Slack & Discord Bots',
                desc: 'Two-way AI agent allowing employees to file receipts, request leaves, and search docs from Slack.',
                icon: MessageSquare,
                tag: 'Coming Soon',
                badgeColor: 'bg-primary/10 text-primary',
              },
              {
                title: 'GitHub & GitLab CI/CD',
                desc: 'Automatically tie repository PRs and commits to Sprint tasks and member standups.',
                icon: GitBranch,
                tag: 'Coming Soon',
                badgeColor: 'bg-slate-500/10 text-slate-400',
              },
              {
                title: 'Google Workspace & M365',
                desc: 'Bi-directional calendar synchronization, Outlook mail bridge, and Google Drive vault mirroring.',
                icon: Calendar,
                tag: 'Coming Soon',
                badgeColor: 'bg-primary/10 text-primary',
              },
              {
                title: 'QuickBooks & Xero Sync',
                desc: 'Export approved expense claims and departmental reimbursements directly into General Ledger.',
                icon: DollarSign,
                tag: 'Coming Soon',
                badgeColor: 'bg-amber-500/10 text-amber-500',
              },
              {
                title: 'Custom LLM Provider BYO',
                desc: 'Route document vector embeddings and meeting summarization to private Ollama or vLLM clusters.',
                icon: Sparkles,
                tag: 'Supported via Env',
                badgeColor: 'bg-primary/10 text-primary',
              },
            ].map((integ, i) => {
              const IntegIcon = integ.icon;
              return (
                <Card key={i} className="border-border bg-white dark:bg-slate-900 flex flex-col justify-between rounded-2xl">
                  <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary">
                        <IntegIcon className="h-5 w-5" />
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full ${integ.badgeColor}`}>
                        {integ.tag}
                      </span>
                    </div>
                    <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-2.5">
                      {integ.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {integ.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full h-8 text-xs border-border opacity-70 cursor-not-allowed"
                    >
                      Connector Configured in V2
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EXECUTION AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Execution Audit Trail</h2>
              <p className="text-xs text-slate-500">
                Transparent step-by-step history of every autonomous event routed through CORE.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLogs()}
              className="h-8 text-xs border-border"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>

          {logs.length === 0 ? (
            <Card className="border-dashed border-2 border-border p-8 sm:p-12 text-center bg-transparent rounded-2xl">
              <Zap className="h-8 w-8 text-slate-400 mx-auto mb-2.5 opacity-60" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No automation logs yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Trigger a simulation or activate a playbook above to watch the agent mesh route actions live.
              </p>
            </Card>
          ) : (
            <>
              {/* Mobile Stacked Cards View (< sm) */}
              <div className="block sm:hidden space-y-3">
                {logs.map((log) => (
                  <Card key={log.id} className="border-border bg-white dark:bg-slate-900 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {log.trigger_source}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.playbook_slug}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          log.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}
                      >
                        {log.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {log.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-border pt-2">
                      <span>{log.steps_executed.length} steps ({log.duration_ms}ms)</span>
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectingLog(log)}
                      className="w-full h-8 text-xs border-primary/30 text-primary dark:text-purple-400 hover:bg-primary/10 justify-center"
                    >
                      Inspect Execution Steps
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View (>= sm) */}
              <div className="hidden sm:block border border-border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-border text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3.5 pl-4">Trigger & Playbook</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Steps Executed</th>
                        <th className="p-3.5">Latency</th>
                        <th className="p-3.5">Triggered By</th>
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5 text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {log.trigger_source}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {log.playbook_slug}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium ${
                                log.status === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}
                            >
                              {log.status === 'success' ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {log.steps_executed.length} sub-tasks completed
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-500">
                            {log.duration_ms}ms
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-300">
                            {log.triggered_by_name}
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {new Date(log.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3.5 text-right pr-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectingLog(log)}
                              className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                            >
                              Inspect Steps
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: PLAYBOOK CONFIGURATION */}
      <Dialog
        open={!!selectedPlaybookForConfig}
        onOpenChange={(open) => !open && setSelectedPlaybookForConfig(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg bg-white dark:bg-slate-900 border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-slate-900 dark:text-white">
              <Sliders className="h-5 w-5 text-primary" />
              Configure: {selectedPlaybookForConfig?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Customize parameters and thresholds for this autonomous workflow.
            </DialogDescription>
          </DialogHeader>

          {selectedPlaybookForConfig && (
            <div className="space-y-4 py-2">
              {selectedPlaybookForConfig.slug === 'zero_touch_onboarding' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Default Department
                    </label>
                    <Input
                      value={configValues.default_department || 'Engineering'}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, default_department: e.target.value })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Initial Equipment Budget (USD)
                    </label>
                    <Input
                      type="number"
                      value={configValues.equipment_budget ?? 1500}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, equipment_budget: parseFloat(e.target.value) || 0 })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Intro Video Meeting Duration (Minutes)
                    </label>
                    <Input
                      type="number"
                      value={configValues.intro_meeting_duration_minutes ?? 30}
                      onChange={(e) =>
                        setConfigValues({
                          ...configValues,
                          intro_meeting_duration_minutes: parseInt(e.target.value) || 30,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Welcome Email Subject
                    </label>
                    <Input
                      value={configValues.welcome_email_subject || ''}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, welcome_email_subject: e.target.value })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>
                </>
              )}

              {selectedPlaybookForConfig.slug === 'meeting_scribe_task_delegation' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Target Project for Extracted Action Items
                    </label>
                    <Input
                      value={configValues.target_project_name || 'Company Operations'}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, target_project_name: e.target.value })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Default Extracted Task Priority
                    </label>
                    <select
                      value={configValues.default_task_priority || 'medium'}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, default_task_priority: e.target.value })
                      }
                      className="w-full h-9 rounded-md border border-input bg-slate-50 dark:bg-slate-950 px-3 py-1 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </>
              )}

              {selectedPlaybookForConfig.slug === 'compliance_expiry_sync' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Policy Notification Urgency Tag
                    </label>
                    <Input
                      value={configValues.policy_urgency || 'Important Update'}
                      onChange={(e) =>
                        setConfigValues({ ...configValues, policy_urgency: e.target.value })
                      }
                      className="bg-slate-50 dark:bg-slate-950 text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPlaybookForConfig(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: LIVE SIMULATION / INSPECTOR TRACE */}
      <Dialog
        open={!!simulationLog || !!inspectingLog}
        onOpenChange={(open) => {
          if (!open) {
            setSimulationLog(null);
            setInspectingLog(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-xl bg-white dark:bg-slate-900 border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              {simulationLog ? 'Simulation Execution Trace' : 'Execution Trace Inspector'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {simulationLog
                ? 'Simulated end-to-end event cascade and sub-task execution.'
                : `Trigger: ${inspectingLog?.trigger_source}`}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const currentLog = simulationLog || inspectingLog;
            if (!currentLog) return null;

            return (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-border text-xs gap-2">
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase">Trigger Source:</span>
                    <strong className="text-slate-900 dark:text-white truncate block">{currentLog.trigger_source}</strong>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-400 block text-[10px] uppercase">Latency:</span>
                    <strong className="font-mono text-emerald-500">{currentLog.duration_ms}ms</strong>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Executed Sub-Task Steps ({currentLog.steps_executed.length})
                  </p>
                  {currentLog.steps_executed.map((st, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-border flex items-start gap-2.5"
                    >
                      <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-500 mt-0.5 shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {idx + 1}. {st.step}
                          </h4>
                          <span className="text-[9px] text-slate-400 shrink-0">
                            {new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                          {st.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSimulationLog(null);
                      setInspectingLog(null);
                    }}
                    className="w-full sm:w-auto text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Done
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Automations;
