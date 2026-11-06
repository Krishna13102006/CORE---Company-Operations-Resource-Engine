import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Play,
  User,
  ArrowRight,
  Shield,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
  FileCheck2,
  Building2,
  UserPlus,
  UserMinus,
  Calendar
} from 'lucide-react';
import { api, extractErrorMessage } from '../lib/api';
import { Button } from '@/components/ui/button';
import { getInitials } from '../lib/utils';
import { useCoreModal } from '../context/ModalContext';

export interface RunbookStep {
  id: string;
  phase: string;
  title: string;
  description: string;
  completed: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  due_offset_days: number;
}

export interface RunbookExecution {
  id: string;
  department: string;
  department_name: string;
  employee: string;
  employee_name: string;
  employee_email: string;
  runbook_template: string | null;
  type: 'onboarding' | 'offboarding';
  status: 'active' | 'completed' | 'cancelled';
  steps: RunbookStep[];
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface DepartmentRunbookModalProps {
  open: boolean;
  onClose: () => void;
  departmentId?: string | null;
  departmentName?: string | null;
  members: any[];
  currentUser: any;
  initialEmployeeId?: string | null;
  initialType?: 'onboarding' | 'offboarding';
}

export const DepartmentRunbookModal: React.FC<DepartmentRunbookModalProps> = ({
  open,
  onClose,
  departmentId,
  departmentName,
  members,
  currentUser,
  initialEmployeeId,
  initialType = 'onboarding',
}) => {
  const queryClient = useQueryClient();
  const { alert } = useCoreModal();

  const [activeTab, setActiveTab] = useState<'executions' | 'trigger'>('executions');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  // Trigger form state
  const [triggerEmployeeId, setTriggerEmployeeId] = useState<string>(initialEmployeeId || '');
  const [triggerType, setTriggerType] = useState<'onboarding' | 'offboarding'>(initialType);

  // Fetch Runbook Executions
  const {
    data: executions = [],
    isLoading: executionsLoading,
    refetch: refetchExecutions
  } = useQuery<RunbookExecution[]>({
    queryKey: ['runbookExecutions', departmentId],
    queryFn: async () => {
      let url = '/teams/runbook-executions/';
      if (departmentId) {
        url += `?department_id=${departmentId}`;
      }
      return await api.get(url);
    },
    enabled: open,
  });

  // Selected execution
  const activeExecution = executions.find(e => e.id === selectedExecutionId) || executions[0] || null;

  // Mutation: Trigger New Runbook
  const triggerMutation = useMutation({
    mutationFn: async () => {
      if (!triggerEmployeeId) {
        throw new Error('Please select an employee');
      }
      return await api.post('/teams/runbook-executions/', {
        employee_id: triggerEmployeeId,
        department_id: departmentId || undefined,
        type: triggerType,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['runbookExecutions'] });
      setSelectedExecutionId(res.id);
      setActiveTab('executions');
      alert({
        title: 'Runbook Triggered',
        description: `Automated ${triggerType} checklist successfully generated for ${res.employee_name}!`,
        variant: 'success',
      });
    },
    onError: (err: any) => {
      alert({
        title: 'Trigger Failed',
        description: extractErrorMessage(err) || 'Could not start runbook.',
        variant: 'destructive',
      });
    }
  });

  // Mutation: Toggle Step
  const toggleStepMutation = useMutation({
    mutationFn: async ({ executionId, stepId }: { executionId: string; stepId: string }) => {
      return await api.post(`/teams/runbook-executions/${executionId}/toggle-step/`, {
        step_id: stepId,
      });
    },
    onSuccess: () => {
      refetchExecutions();
      queryClient.invalidateQueries({ queryKey: ['runbookExecutions'] });
    },
    onError: (err: any) => {
      alert({
        title: 'Update Failed',
        description: extractErrorMessage(err) || 'Could not toggle step.',
        variant: 'destructive',
      });
    }
  });

  if (!open) return null;

  // Calculate completion percentage
  const calculateProgress = (steps: RunbookStep[]) => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter(s => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-emerald-500/10 via-background to-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  Departmental Onboarding & Offboarding Runbooks
                </h2>
                {departmentName && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {departmentName}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Automated multi-phase runbooks to ensure day-1 readiness, mentor syncs, and zero bottleneck departures.
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

        {/* Top Tab Switcher */}
        <div className="px-6 pt-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('executions')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'executions'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-t-lg'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCheck2 className="w-4 h-4" /> Active Runbooks ({executions.length})
            </button>
            <button
              onClick={() => setActiveTab('trigger')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'trigger'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-t-lg'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Play className="w-4 h-4" /> 1-Click Trigger Runbook
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setActiveTab('trigger')}
            className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" /> New Member Onboarding
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'trigger' ? (
            /* TRIGGER FORM */
            <div className="max-w-xl mx-auto space-y-6 py-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Launch Automated Departmental Runbook
                </h3>
                <p className="text-xs text-muted-foreground">
                  Instantly provisions standardized checklists (Day 1 IT & docs, Day 3 1-on-1 intro, Week 1 starter project).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Select Team Member
                  </label>
                  <select
                    value={triggerEmployeeId}
                    onChange={(e) => setTriggerEmployeeId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Employee --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.user?.full_name || m.user?.email} ({m.department_name || 'Unassigned'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Runbook Workflow Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTriggerType('onboarding')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        triggerType === 'onboarding'
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-foreground shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <UserPlus className={`w-5 h-5 mt-0.5 ${triggerType === 'onboarding' ? 'text-emerald-500' : ''}`} />
                      <div>
                        <div className="text-xs font-bold">New Hire Onboarding</div>
                        <div className="text-[11px] text-muted-foreground">Equipment, Intro 1-on-1, Beginner Task</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTriggerType('offboarding')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        triggerType === 'offboarding'
                          ? 'bg-rose-500/10 border-rose-500/50 text-foreground shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <UserMinus className={`w-5 h-5 mt-0.5 ${triggerType === 'offboarding' ? 'text-rose-500' : ''}`} />
                      <div>
                        <div className="text-xs font-bold">Team Offboarding</div>
                        <div className="text-[11px] text-muted-foreground">Access revocation, handoff, exit debrief</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('executions')} className="text-xs">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => triggerMutation.mutate()}
                    disabled={triggerMutation.isPending || !triggerEmployeeId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  >
                    {triggerMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Play className="w-3.5 h-3.5 mr-1" />
                    )}
                    Launch Runbook
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* EXECUTIONS LIST & DETAILS */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Executions List */}
              <div className="md:col-span-5 space-y-2 border-r border-border pr-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Active Runbook Pipelines
                </div>
                {executionsLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Loading runbooks...
                  </div>
                ) : executions.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    No runbook executions yet. Click "1-Click Trigger Runbook" above to onboard a team member.
                  </div>
                ) : (
                  executions.map((exec) => {
                    const isSelected = activeExecution?.id === exec.id;
                    const pct = calculateProgress(exec.steps);
                    return (
                      <div
                        key={exec.id}
                        onClick={() => setSelectedExecutionId(exec.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs'
                            : 'bg-card border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted font-bold text-xs flex items-center justify-center">
                              {getInitials(exec.employee_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">
                                {exec.employee_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {exec.department_name}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              exec.type === 'onboarding'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {exec.type}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Checklist Progress</span>
                            <span className="font-bold text-foreground">{pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                pct === 100 ? 'bg-emerald-500' : 'bg-primary'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Active Execution Detail Checklist */}
              <div className="md:col-span-7 space-y-4">
                {activeExecution ? (
                  <div className="space-y-4">
                    {/* Active Runbook Header */}
                    <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">
                            {activeExecution.employee_name}'s {activeExecution.type === 'onboarding' ? 'Onboarding' : 'Offboarding'} Runbook
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeExecution.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {activeExecution.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Started on {new Date(activeExecution.started_at).toLocaleDateString()} • {activeExecution.steps.filter(s => s.completed).length} of {activeExecution.steps.length} milestones complete
                        </div>
                      </div>
                    </div>

                    {/* Steps list */}
                    <div className="space-y-2.5">
                      {activeExecution.steps.map((step) => (
                        <div
                          key={step.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                            step.completed
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-card border-border hover:border-border/80'
                          }`}
                        >
                          <button
                            onClick={() => toggleStepMutation.mutate({
                              executionId: activeExecution.id,
                              stepId: step.id,
                            })}
                            disabled={toggleStepMutation.isPending}
                            className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors"
                          >
                            {step.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                                {step.phase}
                              </span>
                              <h4 className={`text-xs font-bold text-foreground ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {step.title}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.description}
                            </p>
                            {step.completed && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Completed by {step.completed_by_name || 'Team Lead'} on {step.completed_at ? new Date(step.completed_at).toLocaleDateString() : 'today'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Select a runbook on the left to inspect checklist milestones.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Multi-tenant checklist progress automatically syncs in real-time</span>
          </div>
          <Button variant="default" size="sm" onClick={onClose} className="font-semibold text-xs px-4">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
