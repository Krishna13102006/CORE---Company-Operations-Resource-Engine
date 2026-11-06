import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../lib/api';
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
  Palmtree,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Plus,
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  Send,
  Trash2,
  Edit,
  FileText,
  UserCheck,
  SunMedium,
  Laptop,
  HeartPulse,
  Baby,
  HeartHandshake
} from 'lucide-react';

interface LeaveRequestItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department_id: string | null;
  department_name: string | null;
  leave_type: 'annual' | 'sick' | 'casual' | 'wfh' | 'maternity_paternity' | 'bereavement' | 'unpaid';
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  half_day_period: 'morning' | 'afternoon' | null;
  duration_days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string;
  rejection_reason: string;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
}

interface PublicHolidayItem {
  id: string;
  name: string;
  date: string;
  description: string;
}

interface LeaveSummaryData {
  employee_id: string;
  balances: {
    annual: number;
    sick: number;
    casual: number;
    wfh: number;
    unpaid: number;
  };
  used_this_year: {
    annual: number;
    sick: number;
    casual: number;
    wfh: number;
    unpaid: number;
    maternity_paternity?: number;
    bereavement?: number;
  };
  pending_count: number;
  upcoming_leaves: LeaveRequestItem[];
}

interface TeamCalendarData {
  year: number;
  month: number;
  leaves: LeaveRequestItem[];
  holidays: PublicHolidayItem[];
}

const LEAVE_TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  annual: {
    label: 'Annual / Vacation',
    icon: Palmtree,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/40',
  },
  sick: {
    label: 'Sick Leave',
    icon: HeartPulse,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-900/40',
  },
  casual: {
    label: 'Casual / Personal',
    icon: SunMedium,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900/40',
  },
  wfh: {
    label: 'Remote / WFH Day',
    icon: Laptop,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-900/40',
  },
  maternity_paternity: {
    label: 'Parental Leave',
    icon: Baby,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-900/40',
  },
  bereavement: {
    label: 'Bereavement',
    icon: HeartHandshake,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-200 dark:border-slate-800',
  },
  unpaid: {
    label: 'Unpaid Leave',
    icon: CalendarDays,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-900/40',
  },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: {
    label: 'Pending Approval',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/50',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900/50',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900/50',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

interface LeavesProps {
  isEmbedded?: boolean;
}

export const Leaves: React.FC<LeavesProps> = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  const isManagerOrAdmin = ['admin', 'hr', 'manager'].includes(user?.role || '');
  const isHRorAdmin = ['admin', 'hr'].includes(user?.role || '');

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'approvals' | 'policies'>('requests');

  // Filter & Search states
  const [myFilterStatus, setMyFilterStatus] = useState<string>('all');
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<string>('pending');
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedCalendarDept, setSelectedCalendarDept] = useState<string>('');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isAIAssistModalOpen, setIsAIAssistModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelLeaveId, setCancelLeaveId] = useState<string | null>(null);

  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<any | null>(null);
  const [editBalances, setEditBalances] = useState({ annual: 20, sick: 10, casual: 5, wfh: 12 });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');

  // Apply Form State
  const [leaveType, setLeaveType] = useState<string>('annual');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [leaveNotes, setLeaveNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // AI Assistant prompt state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiDraftResult, setAiDraftResult] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Queries
  const { data: summary, isLoading: isSummaryLoading } = useQuery<LeaveSummaryData>({
    queryKey: ['leaveSummary'],
    queryFn: () => api.get('/teams/leave/my-summary/'),
  });

  const { data: myLeaves, isLoading: isMyLeavesLoading } = useQuery<any>({
    queryKey: ['myLeaves', myFilterStatus],
    queryFn: () => {
      const qs = new URLSearchParams({ all: 'true' });
      if (myFilterStatus && myFilterStatus !== 'all') qs.append('status', myFilterStatus);
      return api.get(`/teams/leave/?${qs.toString()}`);
    },
  });

  const { data: approvalLeaves, isLoading: isApprovalsLoading } = useQuery<any>({
    queryKey: ['approvalLeaves', approvalFilterStatus],
    queryFn: () => {
      const qs = new URLSearchParams({ all: 'true' });
      if (approvalFilterStatus && approvalFilterStatus !== 'all') qs.append('status', approvalFilterStatus);
      return api.get(`/teams/leave/?${qs.toString()}`);
    },
    enabled: isManagerOrAdmin,
  });

  const { data: calendarData, isLoading: isCalendarLoading } = useQuery<TeamCalendarData>({
    queryKey: ['teamCalendar', calendarYear, calendarMonth, selectedCalendarDept],
    queryFn: () => {
      const qs = new URLSearchParams({
        year: String(calendarYear),
        month: String(calendarMonth),
      });
      if (selectedCalendarDept) qs.append('department_id', selectedCalendarDept);
      return api.get(`/teams/leave/team-calendar/?${qs.toString()}`);
    },
  });

  const { data: departments } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/teams/departments/'),
  });

  const { data: employeesList, isLoading: isEmployeesLoading } = useQuery<any>({
    queryKey: ['employeesList'],
    queryFn: () => api.get('/teams/employees/?all=true'),
    enabled: isHRorAdmin,
  });

  const { data: holidaysList } = useQuery<PublicHolidayItem[]>({
    queryKey: ['publicHolidays', calendarYear],
    queryFn: () => api.get(`/teams/leave/holidays/?year=${calendarYear}`),
  });

  // Safe memoized list extractions (immune to pagination envelope mismatch)
  const myLeavesList = useMemo<LeaveRequestItem[]>(() => {
    if (!myLeaves) return [];
    if (Array.isArray(myLeaves)) return myLeaves;
    if (Array.isArray((myLeaves as any).results)) return (myLeaves as any).results;
    return [];
  }, [myLeaves]);

  const approvalLeavesList = useMemo<LeaveRequestItem[]>(() => {
    if (!approvalLeaves) return [];
    if (Array.isArray(approvalLeaves)) return approvalLeaves;
    if (Array.isArray((approvalLeaves as any).results)) return (approvalLeaves as any).results;
    return [];
  }, [approvalLeaves]);

  const employees = useMemo<any[]>(() => {
    if (!employeesList) return [];
    if (Array.isArray(employeesList)) return employeesList;
    if (Array.isArray((employeesList as any).results)) return (employeesList as any).results;
    return [];
  }, [employeesList]);

  const holidays = useMemo<PublicHolidayItem[]>(() => {
    if (!holidaysList) return [];
    if (Array.isArray(holidaysList)) return holidaysList;
    if (Array.isArray((holidaysList as any).results)) return (holidaysList as any).results;
    return [];
  }, [holidaysList]);

  // Mutations
  const applyMutation = useMutation({
    mutationFn: (data: any) => api.post('/teams/leave/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveSummary'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['approvalLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
      setIsApplyModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(extractErrorMessage(err));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/teams/leave/${id}/cancel/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveSummary'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['approvalLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
      setIsCancelModalOpen(false);
      setCancelLeaveId(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/teams/leave/${id}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveSummary'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/teams/leave/${id}/reject/`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveSummary'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      setIsRejectModalOpen(false);
      setRejectLeaveId(null);
      setRejectReason('');
    },
  });

  const balanceMutation = useMutation({
    mutationFn: ({ id, balances }: { id: string; balances: any }) =>
      api.patch(`/teams/employees/${id}/balances/`, balances),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['leaveSummary'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      setIsBalanceModalOpen(false);
    },
  });

  const holidayCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/teams/leave/holidays/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicHolidays'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
      setIsHolidayModalOpen(false);
      setHolidayName('');
      setHolidayDate('');
      setHolidayDesc('');
    },
  });

  const holidayDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/leave/holidays/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicHolidays'] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendar'] });
    },
  });

  const resetForm = () => {
    setLeaveType('annual');
    setStartDate('');
    setEndDate('');
    setIsHalfDay(false);
    setHalfDayPeriod('morning');
    setLeaveNotes('');
    setFormError(null);
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!startDate) {
      setFormError('Start date is required.');
      return;
    }
    const finalEndDate = isHalfDay ? startDate : endDate || startDate;
    applyMutation.mutate({
      leave_type: leaveType,
      start_date: startDate,
      end_date: finalEndDate,
      is_half_day: isHalfDay,
      half_day_period: isHalfDay ? halfDayPeriod : null,
      notes: leaveNotes,
    });
  };

  const handleGenerateAIDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const resp = await api.post('/teams/leave/ai-draft/', { prompt: aiPrompt });
      setAiDraftResult(resp);
    } catch (err: any) {
      coreAlert({
        title: 'AI Draft Failed',
        description: extractErrorMessage(err) || 'Failed to generate leave application draft.',
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAIDraft = () => {
    if (!aiDraftResult) return;
    setLeaveType(aiDraftResult.leave_type || 'annual');
    setStartDate(aiDraftResult.start_date || '');
    setEndDate(aiDraftResult.end_date || '');
    setIsHalfDay(!!aiDraftResult.is_half_day);
    setHalfDayPeriod(aiDraftResult.half_day_period || 'morning');
    setLeaveNotes(aiDraftResult.notes || '');
    setIsAIAssistModalOpen(false);
    setIsApplyModalOpen(true);
    setAiDraftResult(null);
    setAiPrompt('');
  };

  // Calendar calculations
  const monthName = useMemo(() => {
    return new Date(calendarYear, calendarMonth - 1, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarYear, calendarMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    const days: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNumber: 0, dateStr: '', isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }
    return days;
  }, [calendarYear, calendarMonth]);

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  // Check who is away today
  const todayStr = new Date().toISOString().split('T')[0];
  const awayToday = useMemo(() => {
    if (!calendarData?.leaves) return [];
    return calendarData.leaves.filter(
      (l) => l.start_date <= todayStr && l.end_date >= todayStr && l.status === 'approved'
    );
  }, [calendarData, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      {!isEmbedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Palmtree className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Leaves & Time-Off Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Request time off, manage team availability, view the out-of-office calendar, and configure leave balances.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                setAiPrompt('');
                setAiDraftResult(null);
                setIsAIAssistModalOpen(true);
              }}
              variant="outline"
              className="border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              AI Smart Request
            </Button>

            <Button
              onClick={() => {
                resetForm();
                setIsApplyModalOpen(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Apply for Leave
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Leaves & Time Off Hub
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Request time off, view team availability calendar, approve requests, and manage policies.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                setAiPrompt('');
                setAiDraftResult(null);
                setIsAIAssistModalOpen(true);
              }}
              variant="outline"
              size="sm"
              className="border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-semibold gap-1.5 shadow-sm h-8"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              AI Smart Request
            </Button>

            <Button
              onClick={() => {
                resetForm();
                setIsApplyModalOpen(true);
              }}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm h-8"
            >
              <Plus className="h-4 w-4" />
              Apply for Leave
            </Button>
          </div>
        </div>
      )}

      {/* Leave Balances Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annual / Vacation */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Annual / Vacation
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Palmtree className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {summary?.balances?.annual ?? 20} <span className="text-xs font-medium text-slate-400">days left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Used {summary?.used_this_year?.annual ?? 0} days this year
            </div>
          </div>
        </Card>

        {/* Sick Leave */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sick Leave
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <HeartPulse className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {summary?.balances?.sick ?? 10} <span className="text-xs font-medium text-slate-400">days left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Used {summary?.used_this_year?.sick ?? 0} days this year
            </div>
          </div>
        </Card>

        {/* Casual / Personal */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Casual / Personal
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <SunMedium className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {summary?.balances?.casual ?? 5} <span className="text-xs font-medium text-slate-400">days left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Used {summary?.used_this_year?.casual ?? 0} days this year
            </div>
          </div>
        </Card>

        {/* Remote / WFH */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Remote / WFH
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Laptop className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {summary?.balances?.wfh ?? 12} <span className="text-xs font-medium text-slate-400">days left</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Used {summary?.used_this_year?.wfh ?? 0} days this year
            </div>
          </div>
        </Card>
      </div>

      {/* Away Today Notification Banner */}
      {awayToday.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Palmtree className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Who is Out of Office Today ({awayToday.length} {awayToday.length === 1 ? 'colleague' : 'colleagues'})
              </h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {awayToday.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 border border-amber-300 dark:border-amber-900/60 shadow-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {item.employee_name} ({LEAVE_TYPE_META[item.leave_type]?.label || item.leave_type})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('calendar')}
            className="text-xs font-semibold shrink-0"
          >
            View Full Calendar
          </Button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requests'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          My Requests & History
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'calendar'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Company Out-of-Office Calendar
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'approvals'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Approvals Hub
            {approvalLeaves && approvalLeaves.filter((l: any) => l.status === 'pending').length > 0 && (
              <span className="h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-extrabold ml-1">
                {approvalLeaves.filter((l: any) => l.status === 'pending').length}
              </span>
            )}
          </button>
        )}

        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'policies'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Policy & Balances Manager
          </button>
        )}
      </div>

      {/* TAB 1: My Requests & History */}
      {activeTab === 'requests' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                My Leave Requests
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track status of your submitted time-off requests.
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              <select
                value={myFilterStatus}
                onChange={(e) => setMyFilterStatus(e.target.value)}
                className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isMyLeavesLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading your requests...</div>
            ) : myLeavesList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Palmtree className="h-8 w-8 mx-auto text-slate-400" />
                <p className="text-xs">No leave requests found for this filter.</p>
                <Button
                  onClick={() => setIsApplyModalOpen(true)}
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Request Time Off Now
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myLeavesList.map((leave: LeaveRequestItem) => {
                  const meta = LEAVE_TYPE_META[leave.leave_type] || LEAVE_TYPE_META.annual;
                  const Icon = meta.icon;
                  const badge = STATUS_BADGES[leave.status] || STATUS_BADGES.pending;

                  return (
                    <div
                      key={leave.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`h-10 w-10 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 border ${meta.border}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {meta.label}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                            {leave.is_half_day && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-900/40">
                                Half-Day ({leave.half_day_period === 'morning' ? 'Morning' : 'Afternoon'})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {leave.start_date} {leave.start_date !== leave.end_date ? `➔ ${leave.end_date}` : ''}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {leave.duration_days} {leave.duration_days === 1 ? 'day' : 'days'}
                            </span>
                          </div>

                          {leave.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic pt-0.5">
                              "{leave.notes}"
                            </p>
                          )}

                          {leave.status === 'rejected' && leave.rejection_reason && (
                            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs">
                              <strong>Rejection reason:</strong> {leave.rejection_reason}
                            </div>
                          )}

                          {leave.status === 'approved' && leave.approved_by_name && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Approved by {leave.approved_by_name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {leave.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCancelLeaveId(leave.id);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"
                          >
                            Cancel Request
                          </Button>
                        )}
                        {leave.status === 'approved' && new Date(leave.start_date) >= new Date() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCancelLeaveId(leave.id);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                          >
                            Cancel & Refund Days
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Company Out-of-Office Calendar */}
      {activeTab === 'calendar' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-xl">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white min-w-[160px] text-center">
                {monthName}
              </h3>
              <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-xl">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Department:</span>
              <select
                value={selectedCalendarDept}
                onChange={(e) => setSelectedCalendarDept(e.target.value)}
                className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="">All Departments</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[90px] sm:min-h-[110px] rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 p-1.5"
                    />
                  );
                }

                const dayLeaves =
                  calendarData?.leaves?.filter(
                    (l) => l.start_date <= cell.dateStr && l.end_date >= cell.dateStr
                  ) || [];

                const dayHolidays =
                  calendarData?.holidays?.filter((h) => h.date === cell.dateStr) || [];

                const isToday = cell.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    className={`min-h-[90px] sm:min-h-[110px] rounded-xl border p-1.5 sm:p-2 transition-all flex flex-col justify-between ${
                      isToday
                        ? 'bg-primary/5 border-primary/40 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? 'h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-extrabold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    </div>

                    {/* Events list inside cell */}
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[60px]">
                      {/* Public Holiday */}
                      {dayHolidays.map((h) => (
                        <div
                          key={h.id}
                          className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] truncate border border-emerald-500/20"
                          title={`Holiday: ${h.name}`}
                        >
                          🎉 {h.name}
                        </div>
                      ))}

                      {/* Leaves */}
                      {dayLeaves.map((l) => {
                        const meta = LEAVE_TYPE_META[l.leave_type] || LEAVE_TYPE_META.annual;
                        return (
                          <div
                            key={l.id}
                            className={`px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color} font-medium text-[10px] truncate border ${meta.border}`}
                            title={`${l.employee_name} (${meta.label})`}
                          >
                            🌴 {l.employee_name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Approvals Hub (Manager & HR) */}
      {activeTab === 'approvals' && isManagerOrAdmin && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Team Leave Approvals
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review and action leave requests from your team members.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={approvalFilterStatus}
                onChange={(e) => setApprovalFilterStatus(e.target.value)}
                className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="pending">Pending Only</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Requests</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isApprovalsLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading team requests...</div>
            ) : approvalLeavesList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="text-xs font-semibold">All caught up! No pending leave approvals.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {approvalLeavesList.map((leave: LeaveRequestItem) => {
                  const meta = LEAVE_TYPE_META[leave.leave_type] || LEAVE_TYPE_META.annual;
                  const Icon = meta.icon;
                  const badge = STATUS_BADGES[leave.status] || STATUS_BADGES.pending;

                  return (
                    <div
                      key={leave.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`h-10 w-10 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 border ${meta.border}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {leave.employee_name}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              ({leave.department_name || 'No Department'})
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{meta.label}</span>
                            <span>•</span>
                            <span>
                              {leave.start_date} {leave.start_date !== leave.end_date ? `➔ ${leave.end_date}` : ''}
                            </span>
                            <span>•</span>
                            <span>{leave.duration_days} days</span>
                            {leave.is_half_day && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                (Half Day {leave.half_day_period})
                              </span>
                            )}
                          </div>

                          {leave.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                              "{leave.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {leave.status === 'pending' ? (
                          <>
                            <Button
                              onClick={() => {
                                setRejectLeaveId(leave.id);
                                setRejectReason('');
                                setIsRejectModalOpen(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
                            >
                              Reject
                            </Button>
                            <Button
                              onClick={() => approveMutation.mutate(leave.id)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                            >
                              Approve
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {leave.status === 'approved' && `Approved by ${leave.approved_by_name || 'Manager'}`}
                            {leave.status === 'rejected' && 'Rejected'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Policy & Balances Manager (Admin & HR) */}
      {activeTab === 'policies' && isHRorAdmin && (
        <div className="space-y-6">
          {/* Employee Balances Directory */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Employee Leave Balance Allocations
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect and top-up individual leave quotas for all company staff.
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-border font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Department</th>
                    <th className="p-4 text-center">Annual</th>
                    <th className="p-4 text-center">Sick</th>
                    <th className="p-4 text-center">Casual</th>
                    <th className="p-4 text-center">Remote / WFH</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isEmployeesLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                        Loading employee balances...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                        No employees found.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp: any) => {
                      const balances = emp.leave_balance || { annual: 20, sick: 10, casual: 5, wfh: 12 };
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-4">
                            <div className="font-bold text-slate-900 dark:text-white">{emp.full_name || emp.email}</div>
                            <div className="text-[11px] text-slate-400">{emp.email}</div>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {emp.department_name || 'General'}
                          </td>
                          <td className="p-4 text-center font-bold text-amber-600 dark:text-amber-400">
                            {balances.annual ?? 20}d
                          </td>
                          <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-400">
                            {balances.sick ?? 10}d
                          </td>
                          <td className="p-4 text-center font-bold text-blue-600 dark:text-blue-400">
                            {balances.casual ?? 5}d
                          </td>
                          <td className="p-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                            {balances.wfh ?? 12}d
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTargetEmployee(emp);
                                setEditBalances({
                                  annual: balances.annual ?? 20,
                                  sick: balances.sick ?? 10,
                                  casual: balances.casual ?? 5,
                                  wfh: balances.wfh ?? 12,
                                });
                                setIsBalanceModalOpen(true);
                              }}
                              className="text-xs font-semibold gap-1.5"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Adjust Balances
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Public Holidays Management */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-border pb-4 flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Company Public Holidays ({calendarYear})
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Official company holidays recognized across tenant calendars.
                </p>
              </div>
              <Button
                onClick={() => setIsHolidayModalOpen(true)}
                size="sm"
                className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Public Holiday
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {holidays.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No public holidays registered for {calendarYear} yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="p-3.5 rounded-xl border border-border bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>🎉</span> {h.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{h.date}</div>
                        {h.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{h.description}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => holidayDeleteMutation.mutate(h.id)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* Apply for Leave Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Apply for Time Off
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleApplySubmit} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Leave Type */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Leave Category
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              >
                {Object.entries(LEAVE_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Half Day Switch */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="halfDayCheck"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="halfDayCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                This is a Half-Day Leave (0.5 Days)
              </label>
            </div>

            {/* Half Day Period Select */}
            {isHalfDay && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Half-Day Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('morning')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      halfDayPeriod === 'morning'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-border'
                    }`}
                  >
                    🌅 First Half (Morning)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('afternoon')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                      halfDayPeriod === 'afternoon'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-border'
                    }`}
                  >
                    🌆 Second Half (Afternoon)
                  </button>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className={`grid ${isHalfDay ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {isHalfDay ? 'Date' : 'Start Date'}
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              {!isHalfDay && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Reason / Handover Notes (Optional)
              </label>
              <textarea
                value={leaveNotes}
                onChange={(e) => setLeaveNotes(e.target.value)}
                placeholder="e.g. Taking time off for family trip; Sarah is covering urgent client requests."
                rows={3}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={applyMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
              >
                {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ✨ AI Smart Leave Assistant Modal */}
      <Dialog open={isAIAssistModalOpen} onOpenChange={setIsAIAssistModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              AI Natural Language Leave Booking
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Describe your leave in plain English (e.g. <em>"I need next Monday and Tuesday off for family travel"</em> or <em>"Work from home tomorrow"</em>). Gemini will parse dates and draft the request automatically.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="e.g. Take 3 days annual leave from next Wednesday..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateAIDraft()}
                className="text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex-1"
              />
              <Button
                onClick={handleGenerateAIDraft}
                disabled={aiLoading || !aiPrompt.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shrink-0"
              >
                {aiLoading ? 'Synthesizing...' : 'Draft'}
              </Button>
            </div>

            {aiDraftResult && (
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-300">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  AI Suggested Leave Draft
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <div><strong>Category:</strong> {LEAVE_TYPE_META[aiDraftResult.leave_type]?.label || aiDraftResult.leave_type}</div>
                  <div><strong>Dates:</strong> {aiDraftResult.start_date} ➔ {aiDraftResult.end_date} {aiDraftResult.is_half_day && '(Half Day)'}</div>
                  <div><strong>Reason:</strong> {aiDraftResult.notes}</div>
                  {aiDraftResult.summary_explanation && (
                    <div className="text-[11px] text-purple-700 dark:text-purple-400 italic pt-1">
                      "{aiDraftResult.summary_explanation}"
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAcceptAIDraft}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                >
                  Review & Submit This Draft
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              Reject Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Please provide a reason for the employee explaining why this request cannot be approved.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Critical deployment scheduled on those dates; team coverage insufficient."
              rows={3}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={() => rejectLeaveId && rejectMutation.mutate({ id: rejectLeaveId, reason: rejectReason })}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Employee Balances Modal */}
      <Dialog open={isBalanceModalOpen} onOpenChange={setIsBalanceModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Adjust Leave Balances for {targetEmployee?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Annual (Days)</label>
                <Input
                  type="number"
                  value={editBalances.annual}
                  onChange={(e) => setEditBalances({ ...editBalances, annual: parseFloat(e.target.value) || 0 })}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Sick (Days)</label>
                <Input
                  type="number"
                  value={editBalances.sick}
                  onChange={(e) => setEditBalances({ ...editBalances, sick: parseFloat(e.target.value) || 0 })}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Casual (Days)</label>
                <Input
                  type="number"
                  value={editBalances.casual}
                  onChange={(e) => setEditBalances({ ...editBalances, casual: parseFloat(e.target.value) || 0 })}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Remote/WFH (Days)</label>
                <Input
                  type="number"
                  value={editBalances.wfh}
                  onChange={(e) => setEditBalances({ ...editBalances, wfh: parseFloat(e.target.value) || 0 })}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBalanceModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={() =>
                targetEmployee &&
                balanceMutation.mutate({ id: targetEmployee.id, balances: editBalances })
              }
              className="bg-primary text-primary-foreground text-xs font-semibold"
            >
              Save Balances
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Public Holiday Modal */}
      <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-600" />
              Add Company Public Holiday
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Holiday Name</label>
              <Input
                placeholder="e.g. New Year's Day, Independence Day"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Date</label>
              <Input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Description (Optional)</label>
              <Input
                placeholder="e.g. Office closed globally"
                value={holidayDesc}
                onChange={(e) => setHolidayDesc(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsHolidayModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={() =>
                holidayCreateMutation.mutate({
                  name: holidayName,
                  date: holidayDate,
                  description: holidayDesc,
                })
              }
              disabled={!holidayName.trim() || !holidayDate}
              className="bg-primary text-primary-foreground text-xs font-semibold"
            >
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Leave Confirmation Modal */}
      <DeleteConfirmModal
        open={isCancelModalOpen}
        onOpenChange={setIsCancelModalOpen}
        title="Cancel Leave Request"
        description="Are you sure you want to cancel this time-off request? Any deducted leave balance will be immediately restored."
        confirmLabel="Cancel Leave"
        onConfirm={() => cancelLeaveId && cancelMutation.mutate(cancelLeaveId)}
      />
    </div>
  );
};
export default Leaves;
