import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Ban,
  ArrowRight,
  Loader2,
  Sparkles,
  Info,
  DollarSign,
  Palmtree,
  CheckSquare,
  Users
} from 'lucide-react';
import { api, extractErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getInitials } from '../lib/utils';

export interface ApprovalDelegation {
  id: string;
  delegator: string;
  delegator_name: string;
  delegator_email: string;
  delegator_role: string;
  delegatee: string;
  delegatee_name: string;
  delegatee_email: string;
  delegatee_role: string;
  delegation_type: 'all' | 'expenses' | 'leaves';
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
  is_currently_effective: boolean;
  created_at: string;
  updated_at: string;
}

interface ManagerDelegationModalProps {
  open: boolean;
  onClose: () => void;
  initialDelegatorId?: string | null;
  members: any[];
  departments: any[];
}

export const ManagerDelegationModal: React.FC<ManagerDelegationModalProps> = ({
  open,
  onClose,
  initialDelegatorId,
  members,
  departments,
}) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [delegatorId, setDelegatorId] = useState<string>('');
  const [delegateeId, setDelegateeId] = useState<string>('');
  const [delegationType, setDelegationType] = useState<'all' | 'expenses' | 'leaves'>('all');
  
  // Date defaults: today to 7 days later
  const todayStr = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(nextWeekStr);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Initialize delegator
  useEffect(() => {
    if (initialDelegatorId) {
      setDelegatorId(initialDelegatorId);
    } else if (currentUser?.id) {
      setDelegatorId(currentUser.id);
    }
  }, [initialDelegatorId, currentUser]);

  // Fetch Delegations Query
  const { data: delegations, isLoading: delegationsLoading } = useQuery<ApprovalDelegation[]>({
    queryKey: ['delegations'],
    queryFn: () => api.get('/teams/delegations/'),
    enabled: open,
    refetchInterval: 5000,
  });

  // Create Delegation Mutation
  const createDelegationMutation = useMutation({
    mutationFn: (data: {
      delegatee_id: string;
      delegation_type: string;
      start_date: string;
      end_date: string;
      notes: string;
    }) => api.post('/teams/delegations/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['department-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setFormSuccess('Out-of-office approval proxy successfully delegated!');
      setFormError(null);
      setNotes('');
      setTimeout(() => {
        setFormSuccess(null);
        setActiveTab('list');
      }, 1500);
    },
    onError: (err: any) => {
      setFormError(extractErrorMessage(err) || 'Failed to create approval delegation.');
      setFormSuccess(null);
    },
  });

  // Revoke Delegation Mutation
  const revokeDelegationMutation = useMutation({
    mutationFn: (delegationId: string) => api.post(`/teams/delegations/${delegationId}/revoke/`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['department-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (err: any) => {
      setFormError(extractErrorMessage(err) || 'Failed to revoke delegation.');
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!delegateeId) {
      setFormError('Please select an acting lead / team member as your proxy.');
      return;
    }

    if (delegatorId && delegateeId === delegatorId) {
      setFormError('You cannot delegate approval authority to yourself.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    createDelegationMutation.mutate({
      delegatee_id: delegateeId,
      delegation_type: delegationType,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim(),
    });
  };

  // Eligible delegates: excluding the delegator
  const eligibleDelegates = (members || []).filter(
    (m) => m.id !== delegatorId && m.is_active !== false
  );

  const activeCount = delegations?.filter((d) => d.is_currently_effective).length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900 dark:to-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  1-Click Manager Out-of-Office Delegation
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/30">
                  <Sparkles className="h-2.5 w-2.5" /> Zero Bottlenecks
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delegate Expense & Leave approval authority to an acting lead while out of office.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-7 w-7 rounded-full flex items-center justify-center transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-border px-5 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-primary text-primary font-bold bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Grant New Proxy Authority</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-primary text-primary font-bold bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Active & Past Delegations</span>
            {activeCount > 0 && (
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-800">
                {activeCount} Active
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* TAB 1: CREATE DELEGATION */}
          {activeTab === 'create' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Info Banner */}
              <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-[11px] text-sky-800 dark:text-sky-300 flex items-start gap-2.5 leading-relaxed">
                <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                <div>
                  <strong className="font-bold">Autonomous Out-of-Office Relay:</strong> While active, your designated acting proxy can approve expense claims and leave requests on your behalf. Approvals are audited in history with full proxy transparency.
                </div>
              </div>

              {/* Delegator (Self / Selected) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Manager Granting Authority (Delegator)
                </label>
                <select
                  value={delegatorId}
                  disabled={currentUser?.role === 'employee' || currentUser?.role === 'manager'}
                  onChange={(e) => setDelegatorId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {members?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.role.toUpperCase()}) — {m.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delegatee (Acting Lead) Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Acting Lead / Proxy Delegatee
                </label>
                <select
                  value={delegateeId}
                  onChange={(e) => setDelegateeId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                >
                  <option value="">-- Select Team Lead or Colleague --</option>
                  {eligibleDelegates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.role.toUpperCase()}) {m.department_name ? `• ${m.department_name}` : ''} — {m.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope of Authority */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Scope of Delegated Authority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDelegationType('all')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      delegationType === 'all'
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>All Approvals</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">Expenses & Leaves</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDelegationType('expenses')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      delegationType === 'expenses'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <span>Expenses Only</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">Tier-based claims</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDelegationType('leaves')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      delegationType === 'leaves'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <Palmtree className="h-4 w-4 text-amber-600" />
                      <span>Leaves Only</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">Time off & WFH</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" /> End Date (Inclusive)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Notes / Reason */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Delegation Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual leave in Tokyo - Jordan Lee covering team approvals"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button variant="outline" type="button" onClick={onClose} className="text-xs h-8.5 font-semibold">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDelegationMutation.isPending}
                  className="text-xs h-8.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  {createDelegationMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      <span>Grant 1-Click Proxy Authority</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: ACTIVE & PAST DELEGATIONS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {delegationsLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !delegations || delegations.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <ShieldCheck className="h-8 w-8 text-slate-400 mx-auto opacity-70" />
                  <p className="font-semibold text-slate-850 dark:text-slate-200">No approval delegations recorded yet.</p>
                  <p className="text-[11px]">Managers can grant out-of-office proxy authority anytime to prevent departmental bottlenecks.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {delegations.map((d) => {
                    const isEffective = d.is_currently_effective;
                    const isPast = new Date(d.end_date) < new Date(todayStr);

                    return (
                      <div
                        key={d.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isEffective
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                            : !d.is_active
                            ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60'
                            : 'bg-white dark:bg-slate-900 border-border'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {d.delegator_name}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              {d.delegatee_name} (Acting Proxy)
                            </span>

                            {isEffective ? (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                ACTIVE NOW
                              </span>
                            ) : !d.is_active ? (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                REVOKED
                              </span>
                            ) : isPast ? (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                EXPIRED
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                SCHEDULED
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                            <span className="font-semibold text-primary uppercase">
                              {d.delegation_type === 'all'
                                ? 'All Approvals'
                                : d.delegation_type === 'expenses'
                                ? 'Expense Claims'
                                : 'Leave Requests'}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(d.start_date).toLocaleDateString()} — {new Date(d.end_date).toLocaleDateString()}
                            </span>
                            {d.notes && (
                              <>
                                <span>•</span>
                                <span className="italic">"{d.notes}"</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {d.is_active && !isPast && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeDelegationMutation.mutate(d.id)}
                            disabled={revokeDelegationMutation.isPending}
                            className="h-7 text-[11px] font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0 self-start sm:self-auto gap-1"
                            title="Revoke proxy authority immediately"
                          >
                            <Ban className="h-3 w-3" />
                            <span>Revoke Proxy</span>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-border flex justify-end">
                <Button size="sm" variant="outline" onClick={onClose} className="text-xs font-semibold h-8">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
