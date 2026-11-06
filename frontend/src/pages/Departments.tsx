import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Leaves } from './Leaves';
import { api, extractErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { getInitials } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { OrgChartTree } from '@/components/OrgChartTree';
import { ManagerDelegationModal } from '@/components/ManagerDelegationModal';
import { BulkTeamImportModal } from '@/components/BulkTeamImportModal';
import { StandupDigestModal } from '@/components/StandupDigestModal';
import { DailyCheckinModal } from '@/components/DailyCheckinModal';
import { OneOnOneWorkspaceModal } from '@/components/OneOnOneWorkspaceModal';
import { DepartmentRunbookModal } from '@/components/DepartmentRunbookModal';
import {
  ShieldCheck,
  UserMinus,
  UserCheck,
  Loader2,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Mail,
  Calendar,
  CheckSquare,
  Clock,
  Shield,
  Users,
  Briefcase,
  AlertTriangle,
  FolderTree,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Circle,
  Pencil,
  Palmtree,
  ArrowRight,
  UserPlus,
  Send,
  Ban,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  UploadCloud,
  Layers,
  Bot,
  Tag,
  ExternalLink,
  FileSpreadsheet,
  Flame,
  Zap,
  Activity,
  Building2,
  Globe,
  Target,
  DollarSign,
  TrendingUp,
  BarChart3,
  Rocket,
  AlertOctagon,
  MessageSquare,
  ListChecks,
  FileCheck2,
  ListTodo,
  Video
} from 'lucide-react';

interface OrganizationInvitation {
  id: string;
  email: string;
  role: 'admin' | 'hr' | 'manager' | 'employee';
  department: string | null;
  department_name: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by_name: string;
  invited_by_email: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  invite_link?: string;
}

export interface CommandCenterPulse {
  total_headcount: number;
  online_count: number;
  present_count: number;
  remote_wfh_count: number;
  on_leave_count: number;
  half_day_count: number;
  leave_details: Array<{
    employee_id: string;
    full_name: string;
    role: string;
    leave_type: string;
    leave_type_display: string;
    is_wfh: boolean;
    is_half_day: boolean;
    half_day_period: string | null;
    start_date: string;
    end_date: string;
    notes: string;
  }>;
}

export interface BurnoutEmployee {
  employee_id: string;
  user_id: string;
  full_name: string;
  email: string;
  department_name: string;
  total_tasks: number;
  high_priority_tasks: number;
  overdue_tasks: number;
  status: 'high_risk' | 'available' | 'balanced';
}

export interface CommandCenterWorkload {
  total_open_tasks: number;
  high_priority_tasks: number;
  burnout_risk_count: number;
  burnout_risk_employees: BurnoutEmployee[];
  available_capacity_count: number;
  available_capacity_employees: BurnoutEmployee[];
  balanced_count: number;
  avg_tasks_per_employee: number;
}

export interface CommandCenterFinancial {
  budget_amount: number;
  spent_this_month: number;
  utilization_pct: number;
  status: 'healthy' | 'warning' | 'exceeded' | 'unallocated';
  currency: string;
}

export interface CommandCenterHiring {
  open_requisitions_count: number;
  open_roles: Array<{
    id: string;
    title: string;
    department: string;
    employment_type: string;
    location: string;
  }>;
}

export interface DepartmentCardOverview {
  id: string;
  name: string;
  parent_name: string | null;
  head_name: string | null;
  head_email: string | null;
  head_id: string | null;
  employee_count: number;
  present_count: number;
  remote_count: number;
  leave_count: number;
  burnout_count: number;
  budget_amount: number;
  spent_this_month: number;
  utilization_pct: number;
  open_roles_count: number;
  open_roles: Array<{ id: string; title: string }>;
}

export interface CommandCenterData {
  selected_department: {
    id: string;
    name: string;
    head_name: string | null;
  } | null;
  pulse: CommandCenterPulse;
  workload_gauge: CommandCenterWorkload;
  financial_radar: CommandCenterFinancial;
  hiring_pipeline: CommandCenterHiring;
  department_cards: DepartmentCardOverview[];
  span_of_control?: {
    total_managers: number;
    avg_span: number;
    max_span: number;
    overloaded_count: number;
    overloaded_managers: Array<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      direct_reports_count: number;
      span_status: string;
    }>;
    optimal_count: number;
    manager_metrics: any[];
  };
  delegations?: {
    active_count: number;
    active_delegations: any[];
  };
}

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr' | 'manager' | 'employee';
  is_active: boolean;
  created_at: string;
  org_name?: string | null;
  department_id?: string | null;
  department_ids?: string[];
  department_name?: string | null;
  departments?: Array<{ id: string; name: string }>;
  primary_department?: { id: string; name: string } | null;
  secondary_departments?: Array<{ id: string; name: string }>;
  workload_stats?: {
    total: number;
    high_priority: number;
    overdue: number;
    burnout_status: 'high_risk' | 'available' | 'balanced';
  };
  today_attendance?: {
    status: 'present' | 'remote_wfh' | 'on_leave' | 'half_day';
    label: string;
    is_wfh: boolean;
    leave_type: string | null;
  };
  employee_profile_id?: string | null;
  skills?: string[];
  task_stats?: {
    total: number;
    completed: number;
    overdue: number;
  };
  status_message?: string | null;
  status_emoji?: string | null;
  status_updated_at?: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
  last_seen_display?: string;
  user_id?: string;
  user?: any;
}

interface Department {
  id: string;
  name: string;
  parent_department: string | null;
  parent_name: string | null;
  head: string | null;
  head_name: string | null;
  employee_count: number;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  department_id?: string | null;
  leave_type: 'annual' | 'sick' | 'unpaid';
  start_date: string;
  end_date: string;
  duration_days: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
}

export const Departments: React.FC = () => {
  const { user: currentUser, checkSession } = useAuth();
  const queryClient = useQueryClient();
  const { confirm: coreConfirm, alert: coreAlert } = useCoreModal();

  // Tab & View States
  const [activeTab, setActiveTab] = useState<'members' | 'departments' | 'leaves' | 'standups' | 'invitations' | '1-on-1s' | 'skills' | 'runbooks'>('members');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [deptViewMode, setDeptViewMode] = useState<'list' | 'tree'>('list');
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [showDailyCheckinModal, setShowDailyCheckinModal] = useState(false);
  const [dismissedBlockerBanner, setDismissedBlockerBanner] = useState(false);
  const [standupDeptFilter, setStandupDeptFilter] = useState<string>('all');

  // Pillar 4: 1-on-1 Workspaces, Skill Matrix & Runbooks
  const [showOneOnOneModal, setShowOneOnOneModal] = useState(false);
  const [selectedOneOnOneEmployeeId, setSelectedOneOnOneEmployeeId] = useState<string | null>(null);
  const [selectedOneOnOneDeptId, setSelectedOneOnOneDeptId] = useState<string | null>(null);
  const [selectedOneOnOneWorkspaceId, setSelectedOneOnOneWorkspaceId] = useState<string | null>(null);

  const [showRunbookModal, setShowRunbookModal] = useState(false);
  const [selectedRunbookEmployeeId, setSelectedRunbookEmployeeId] = useState<string | null>(null);
  const [selectedRunbookDeptId, setSelectedRunbookDeptId] = useState<string | null>(null);
  const [selectedRunbookType, setSelectedRunbookType] = useState<'onboarding' | 'offboarding'>('onboarding');

  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [selectedSkillDeptFilter, setSelectedSkillDeptFilter] = useState('all');
  const [selectedSkillTag, setSelectedSkillTag] = useState<string | null>(null);
  const [quickSkillMember, setQuickSkillMember] = useState<any | null>(null);
  const [quickSkillInput, setQuickSkillInput] = useState('');

  // Invitation States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'hr' | 'manager' | 'employee'>('employee');
  const [inviteDeptId, setInviteDeptId] = useState('');
  const [inviteModalError, setInviteModalError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Selected Member for Detail Modal
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberDrawerTab, setMemberDrawerTab] = useState<'profile' | 'workload' | 'leaves' | 'org'>('profile');
  const [editRole, setEditRole] = useState<string>('employee');
  const [editDept, setEditDept] = useState<string>('');
  const [editDeptIds, setEditDeptIds] = useState<string[]>([]);
  const [editManager, setEditManager] = useState<string>('');
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState<string>('');
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [pageSuccessMessage, setPageSuccessMessage] = useState<string | null>(null);
  const [deleteDeptError, setDeleteDeptError] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Pillar 1: Dynamic Department Command Center & Capacity Radar States
  const [selectedCommandDept, setSelectedCommandDept] = useState<string>('all');
  const [showBurnoutModal, setShowBurnoutModal] = useState(false);
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);

  // Pillar 2: Org Tree & Manager Delegation States
  const [showDelegationModal, setShowDelegationModal] = useState<boolean>(false);
  const [selectedDelegationManagerId, setSelectedDelegationManagerId] = useState<string | null>(null);

  // Daily Standup Status States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('💬');

  // Directory Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterWorkload, setFilterWorkload] = useState<string>('all');
  const [filterSkill, setFilterSkill] = useState<string>('all');

  // Department Creation & Edit Modal States
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptParent, setNewDeptParent] = useState('');
  const [newDeptHead, setNewDeptHead] = useState('');
  const [selectedDeptMembers, setSelectedDeptMembers] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [deptModalError, setDeptModalError] = useState<string | null>(null);

  // Queries (optimized with 30s staleTime & reduced server load)
  const { data: members, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['members'],
    queryFn: () => api.get('/auth/users/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/teams/departments/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: allEmployees, isLoading: allEmployeesLoading } = useQuery<any[]>({
    queryKey: ['all-employees'],
    queryFn: () => api.get('/teams/employees/?all=true'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const canManageInvites = currentUser?.role === 'admin' || currentUser?.role === 'hr';

  const { data: invitations, isLoading: invitationsLoading } = useQuery<OrganizationInvitation[]>({
    queryKey: ['invitations'],
    queryFn: () => api.get('/tenants/invitations/'),
    enabled: canManageInvites,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 1: Dynamic Department Command Center & Capacity Radar Query (ambient 60s polling)
  const {
    data: commandCenter,
    isLoading: commandCenterLoading,
    refetch: refetchCommandCenter
  } = useQuery<CommandCenterData>({
    queryKey: ['department-command-center', selectedCommandDept],
    queryFn: () =>
      api.get(`/teams/departments/command-center/${selectedCommandDept !== 'all' ? `?dept_id=${selectedCommandDept}` : ''}`),
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch active leaves for directory OOO presence indicators
  const { data: oooLeaves } = useQuery<LeaveRequest[]>({
    queryKey: ['ooo-leaves'],
    queryFn: () => api.get('/teams/leave/?status=approved&all=true'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch standup history feed
  const { data: statusFeed, isLoading: feedLoading } = useQuery<any[]>({
    queryKey: ['status-feed'],
    queryFn: () => api.get('/teams/status-feed/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 3: Active Blocker Alert Banner Query
  const { data: blockerBanner } = useQuery<{
    has_active_blockers: boolean;
    blocker_count: number;
    blockers: Array<{
      id: string;
      employee_name: string;
      department_name: string;
      severity: string;
      description: string;
    }>;
  }>({
    queryKey: ['standup-banner'],
    queryFn: () => api.get('/teams/departments/standup-banner/').then((r: any) => r),
    staleTime: 20000,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 2: Out-of-Office Delegations Query
  const { data: delegationsList } = useQuery<any[]>({
    queryKey: ['delegations'],
    queryFn: () => api.get('/teams/delegations/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 4: Recurring 1-on-1 Workspaces Query
  const { data: oneOnOneWorkspaces = [], isLoading: oneOnOnesLoading, refetch: refetchOneOnOnes } = useQuery<any[]>({
    queryKey: ['oneOnOneWorkspacesList'],
    queryFn: () => api.get('/teams/one-on-one/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 4: Talent Directory & Skill Matrix Query
  const { data: skillMatrixData, isLoading: skillMatrixLoading, refetch: refetchSkillMatrix } = useQuery<any>({
    queryKey: ['skillMatrixData', skillSearchQuery, selectedSkillDeptFilter, selectedSkillTag],
    queryFn: () => {
      const q = selectedSkillTag ? selectedSkillTag : skillSearchQuery;
      let url = `/teams/skills/?q=${encodeURIComponent(q || '')}`;
      if (selectedSkillDeptFilter && selectedSkillDeptFilter !== 'all') {
        url += `&department_id=${selectedSkillDeptFilter}`;
      }
      return api.get(url);
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Pillar 4: Departmental Runbook Executions Query
  const { data: runbookExecutions = [], isLoading: runbooksLoading, refetch: refetchRunbooks } = useQuery<any[]>({
    queryKey: ['runbookExecutionsList'],
    queryFn: () => api.get('/teams/runbook-executions/'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Mutation to update skills directly
  const updateSkillsMutation = useMutation({
    mutationFn: async ({ employeeId, skills }: { employeeId: string; skills: string[] }) => {
      return await api.post('/teams/skills/update/', {
        employee_id: employeeId,
        skills,
      });
    },
    onSuccess: () => {
      refetchSkillMatrix();
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      setQuickSkillMember(null);
      coreAlert({
        title: 'Skills Updated',
        description: 'Employee technical skills updated successfully!',
        variant: 'success',
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Update Failed',
        description: extractErrorMessage(err) || 'Could not update skills.',
        variant: 'destructive',
      });
    }
  });

  // Fetch individual employee detail (for leave balances and reviews)
  const profileId = selectedMember?.employee_profile_id || (selectedMember?.id === currentUser?.id ? currentUser?.employee_profile_id : null);
  const { data: employeeDetail, error: employeeDetailError } = useQuery<any>({
    queryKey: ['employee-detail', profileId],
    queryFn: () => api.get(`/teams/employees/${profileId}/`),
    enabled: !!profileId,
  });

  const openMemberModal = (memberOrEmployee: any) => {
    let targetMember: TeamMember | undefined = members?.find(
      (m) =>
        m.id === memberOrEmployee.user_id ||
        m.id === memberOrEmployee.id ||
        m.email === memberOrEmployee.email
    );
    if (!targetMember) {
      targetMember = {
        id: memberOrEmployee.user_id || memberOrEmployee.id,
        email: memberOrEmployee.email,
        first_name:
          memberOrEmployee.first_name ||
          memberOrEmployee.full_name?.split(' ')[0] ||
          '',
        last_name:
          memberOrEmployee.last_name ||
          memberOrEmployee.full_name?.split(' ').slice(1).join(' ') ||
          '',
        role: memberOrEmployee.role,
        is_active: memberOrEmployee.is_active ?? true,
        created_at: memberOrEmployee.created_at || new Date().toISOString(),
        department_id:
          memberOrEmployee.department || memberOrEmployee.department_id,
        department_ids:
          memberOrEmployee.department_ids ||
          (memberOrEmployee.department ? [memberOrEmployee.department] : memberOrEmployee.department_id ? [memberOrEmployee.department_id] : []),
        department_name: memberOrEmployee.department_name,
        employee_profile_id:
          memberOrEmployee.employee_profile_id || memberOrEmployee.id,
        skills: memberOrEmployee.skills || [],
        status_message: memberOrEmployee.status_message,
        status_emoji: memberOrEmployee.status_emoji,
        status_updated_at: memberOrEmployee.status_updated_at,
      };
    }
    setSelectedMember(targetMember);
    setMemberDrawerTab('profile');
    setEditRole(targetMember.role);
    setEditDept(targetMember.department_id || '');
    setEditDeptIds(
      targetMember.department_ids ||
      (targetMember.department_id ? [targetMember.department_id] : [])
    );
    setEditManager(
      memberOrEmployee.manager_id || memberOrEmployee.manager || ''
    );
    const empSkills = targetMember.skills || memberOrEmployee.skills || allEmployees?.find((e: any) => e.user_id === targetMember?.id || e.id === targetMember?.id)?.skills || [];
    setEditSkills(empSkills);
    setNewSkillInput('');
    setModalSuccessMessage(null);
    setModalErrorMessage(null);
  };

  useEffect(() => {
    if (employeeDetail) {
      setEditManager(employeeDetail.manager || employeeDetail.manager_id || '');
      if (employeeDetail.skills && Array.isArray(employeeDetail.skills)) {
        setEditSkills(employeeDetail.skills);
      }
    }
  }, [employeeDetail]);

  useEffect(() => {
    api.post('/auth/heartbeat/').catch(() => {});
  }, []);

  // Mutations
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/auth/users/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      setMemberToDelete(null);
      setPageSuccessMessage('Member removed from organization successfully.');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Removal Failed',
        description: extractErrorMessage(err) || 'Failed to remove member.',
        variant: 'destructive',
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({
      employeeId,
      departmentId,
      departmentIds,
      managerId,
      leaveBalance,
      skills,
    }: {
      employeeId: string;
      departmentId?: string | null;
      departmentIds?: string[];
      managerId?: string | null;
      leaveBalance?: any;
      skills?: string[];
    }) =>
      api.patch(`/teams/employees/${employeeId}/`, {
        ...(departmentId !== undefined ? { department_id: departmentId } : {}),
        ...(departmentIds !== undefined ? { department_ids: departmentIds } : {}),
        manager_id: managerId,
        ...(leaveBalance ? { leave_balance: leaveBalance } : {}),
        ...(skills !== undefined ? { skills } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      queryClient.invalidateQueries({ queryKey: ['employee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ooo-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['department-command-center'] });
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: any) => api.post('/teams/departments/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ooo-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setShowCreateDeptModal(false);
      setNewDeptName('');
      setNewDeptParent('');
      setNewDeptHead('');
      setSelectedDeptMembers([]);
      setMemberSearchQuery('');
      setDeptModalError(null);
      setPageSuccessMessage('Department created and team members assigned successfully!');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setDeptModalError(err.message || 'Failed to create department.');
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/departments/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ooo-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setDeptToDelete(null);
      setDeleteDeptError(null);
      setPageSuccessMessage('Department deleted successfully. Members are now unassigned.');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setDeleteDeptError(extractErrorMessage(err) || 'Failed to delete department.');
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/teams/departments/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      queryClient.invalidateQueries({ queryKey: ['ooo-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setShowCreateDeptModal(false);
      setEditingDeptId(null);
      setNewDeptName('');
      setNewDeptParent('');
      setNewDeptHead('');
      setSelectedDeptMembers([]);
      setMemberSearchQuery('');
      setDeptModalError(null);
      setPageSuccessMessage('Department updated and member assignments saved successfully!');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setDeptModalError(extractErrorMessage(err) || 'Failed to update department.');
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string; department_id?: string | null }) =>
      api.post('/tenants/invitations/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('employee');
      setInviteDeptId('');
      setInviteModalError(null);
      setPageSuccessMessage('Invitation sent successfully via email!');
      setTimeout(() => setPageSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setInviteModalError(extractErrorMessage(err) || 'Failed to send invitation.');
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tenants/invitations/${id}/resend/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setPageSuccessMessage('Invitation email resent successfully!');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Resend Failed',
        description: extractErrorMessage(err) || 'Failed to resend invitation.',
        variant: 'destructive',
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tenants/invitations/${id}/revoke/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setPageSuccessMessage('Invitation revoked.');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Revoke Failed',
        description: extractErrorMessage(err) || 'Failed to revoke invitation.',
        variant: 'destructive',
      });
    },
  });

  const handleCopyInviteLink = (invite: OrganizationInvitation) => {
    const link = invite.invite_link || `${window.location.origin}/accept-invite?token=${(invite as any).token || ''}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(null), 2500);
  };

  const handleUpdateDeptHead = (id: string, headId: string | null) => {
    updateDeptMutation.mutate({ id, data: { head_id: headId } });
  };

  const handleOpenCreateDeptModal = () => {
    setEditingDeptId(null);
    setNewDeptName('');
    setNewDeptParent('');
    setNewDeptHead('');
    setSelectedDeptMembers([]);
    setMemberSearchQuery('');
    setDeptModalError(null);
    setShowCreateDeptModal(true);
  };

  const handleOpenEditDeptModal = (dept: Department) => {
    setEditingDeptId(dept.id);
    setNewDeptName(dept.name);
    setNewDeptParent(dept.parent_department || '');
    setNewDeptHead(dept.head || '');
    setMemberSearchQuery('');
    setDeptModalError(null);

    // Identify all members who belong to this department
    const currentMemberIds = (members || [])
      .filter((m) => {
        if (m.department_ids && m.department_ids.includes(dept.id)) return true;
        if (m.department_id === dept.id) return true;
        if (m.department_name) {
          const deptNames = m.department_name.split(',').map((s: string) => s.trim().toLowerCase());
          return deptNames.includes(dept.name.toLowerCase());
        }
        return false;
      })
      .map((m) => m.id);

    setSelectedDeptMembers(currentMemberIds);
    setShowCreateDeptModal(true);
  };

  // Handlers
  const handleRoleChange = (memberId: string, role: string) => {
    updateMemberMutation.mutate({ id: memberId, data: { role } });
  };

  const handleToggleStatus = (memberId: string, currentStatus: boolean) => {
    updateMemberMutation.mutate({ id: memberId, data: { is_active: !currentStatus } });
  };

  const handleToggleDeptMember = (id: string) => {
    if (selectedDeptMembers.includes(id)) {
      setSelectedDeptMembers(selectedDeptMembers.filter((mId) => mId !== id));
    } else {
      setSelectedDeptMembers([...selectedDeptMembers, id]);
    }
  };

  const handleSelectAllDeptMembers = () => {
    if (!members) return;
    setSelectedDeptMembers(members.map((m) => m.id));
  };

  const handleSelectUnassignedDeptMembers = () => {
    if (!members) return;
    const unassigned = members
      .filter((m) => {
        const hasDeptIds = m.department_ids && m.department_ids.length > 0;
        const hasDept = Boolean(m.department_id);
        const hasValidName = m.department_name && m.department_name !== 'Unassigned' && m.department_name !== 'No Dept';
        return !hasDeptIds && !hasDept && !hasValidName;
      })
      .map((m) => m.id);
    setSelectedDeptMembers(unassigned);
  };

  const handleClearDeptMembers = () => {
    setSelectedDeptMembers([]);
  };

  const filteredModalMembers = (members || []).filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.toLowerCase();
    const name = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    const email = (m.email || '').toLowerCase();
    const dept = (m.department_name || '').toLowerCase();
    const role = (m.role || '').toLowerCase();
    return name.includes(query) || email.includes(query) || dept.includes(query) || role.includes(query);
  });

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      setDeptModalError('Department name is required.');
      return;
    }
    setDeptModalError(null);
    if (editingDeptId) {
      updateDeptMutation.mutate({
        id: editingDeptId,
        data: {
          name: newDeptName.trim(),
          parent_department_id: newDeptParent || null,
          head_id: newDeptHead || null,
          member_ids: selectedDeptMembers,
        },
      });
    } else {
      createDeptMutation.mutate({
        name: newDeptName.trim(),
        parent_department_id: newDeptParent || null,
        head_id: newDeptHead || null,
        member_ids: selectedDeptMembers,
      });
    }
  };

  const handleSaveStatus = async () => {
    if (!currentUser?.employee_profile_id) return;
    try {
      await api.patch(`/teams/employees/${currentUser.employee_profile_id}/`, {
        status_message: statusText,
        status_emoji: statusEmoji,
      });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['status-feed'] });
      if (checkSession) {
        await checkSession();
      }
      setShowStatusModal(false);
    } catch (err: any) {
      coreAlert({
        title: 'Status Update Failed',
        description: err.message || 'Failed to update user status.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedMember) return;
    setModalSuccessMessage(null);
    setModalErrorMessage(null);

    const targetMemberId = selectedMember.id;
    const targetDept = editDept;
    const targetRole = editRole;

    try {
      // 1. Update user role if changed
      if (editRole !== selectedMember.role) {
        await updateMemberMutation.mutateAsync({
          id: selectedMember.id,
          data: { role: editRole }
        });
      }

      // 2. Sanitize and check employee department & manager assignments & skills
      const cleanManagerId = editManager && editManager.trim() && !editManager.includes(',') ? editManager.trim() : null;
      const currentManagerId = employeeDetail?.manager_id || employeeDetail?.manager || null;

      const currentDeptIds = selectedMember.department_ids || (selectedMember.department_id ? [selectedMember.department_id] : []);
      const deptChanged = JSON.stringify([...editDeptIds].sort()) !== JSON.stringify([...currentDeptIds].sort());
      const managerChanged = cleanManagerId !== currentManagerId;

      const empProfileId =
        selectedMember.employee_profile_id ||
        allEmployees?.find((e: any) => e.user_id === selectedMember.id || e.id === selectedMember.id)?.id;

      if (empProfileId) {
        await updateEmployeeMutation.mutateAsync({
          employeeId: empProfileId,
          departmentId: editDept || null,
          departmentIds: editDeptIds,
          managerId: cleanManagerId,
          skills: editSkills,
        });
      }

      // 3. Optimistically update members cache for 0ms dynamic UI feedback
      const updatedDeptNames = editDeptIds
        .map(id => departments?.find(d => d.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      queryClient.setQueryData(['members'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((m: any) =>
          m.id === targetMemberId
            ? {
                ...m,
                role: targetRole,
                department_id: editDeptIds[0] || null,
                department_ids: editDeptIds,
                department_name: updatedDeptNames || 'Unassigned',
                skills: editSkills,
              }
            : m
        );
      });

      // 4. Invalidate related queries to synchronize background state
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['employee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['database-users'] });
      queryClient.invalidateQueries({ queryKey: ['department-command-center'] });

      // 5. Automatically close modal immediately and show notification
      setSelectedMember(null);
      setPageSuccessMessage('Member profile, department permissions, and skills updated successfully!');
      setTimeout(() => setPageSuccessMessage(null), 3500);
    } catch (err: any) {
      setModalErrorMessage(extractErrorMessage(err) || 'Failed to update employee details.');
    }
  };

  // Extract all unique skills across all team members
  const allAvailableSkills = useMemo(() => {
    const skillSet = new Set<string>();
    allEmployees?.forEach((emp: any) => {
      (emp.skills || []).forEach((s: string) => {
        if (s && s.trim()) skillSet.add(s.trim());
      });
    });
    members?.forEach((m: any) => {
      (m.skills || []).forEach((s: string) => {
        if (s && s.trim()) skillSet.add(s.trim());
      });
    });
    return Array.from(skillSet).sort();
  }, [allEmployees, members]);

  // Summarize counts
  const totalCount = members?.length || 0;
  const activeCount = members?.filter((m) => m.is_active).length || 0;
  const suspendedCount = totalCount - activeCount;
  const adminCount = members?.filter((m) => m.role === 'admin').length || 0;
  const managerCount = members?.filter((m) => m.role === 'manager').length || 0;
  const hrCount = members?.filter((m) => m.role === 'hr').length || 0;
  const employeeCount = members?.filter((m) => m.role === 'employee').length || 0;

  // Approved Leaves Filters (Who's Out Today & Next Week)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(today.getDate() + 1);
  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(today.getDate() + 7);

  const userDepts = currentUser?.department_id ? currentUser.department_id.split(', ') : [];

  const outToday = oooLeaves?.filter((leave) => {
    const start = new Date(leave.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leave.end_date);
    end.setHours(0, 0, 0, 0);
    // Filter by same department if current user is not admin
    if (currentUser?.role && ['employee', 'hr', 'manager'].includes(currentUser.role)) {
      if (!leave.department_id || !userDepts.includes(leave.department_id)) {
        return false;
      }
    }
    return today >= start && today <= end;
  }) || [];

  const outNextWeek = oooLeaves?.filter((leave) => {
    const start = new Date(leave.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leave.end_date);
    end.setHours(0, 0, 0, 0);
    if (currentUser?.role && ['employee', 'hr', 'manager'].includes(currentUser.role)) {
      if (!leave.department_id || !userDepts.includes(leave.department_id)) {
        return false;
      }
    }
    const startsInNextWeek = start >= nextWeekStart && start <= nextWeekEnd;
    const isOutToday = today >= start && today <= end;
    return startsInNextWeek && !isOutToday;
  }) || [];

  // Filtered members list
  const filteredMembers = members?.filter((member) => {
    if (currentUser?.role && ['employee', 'hr', 'manager'].includes(currentUser.role)) {
      const memberDepts = member.department_id ? member.department_id.split(', ') : [];
      const hasSharedDept = memberDepts.some(d => userDepts.includes(d));
      if (!hasSharedDept) {
        return false;
      }
    }
    const searchStr = `${member.first_name} ${member.last_name} ${member.email}`.toLowerCase();
    if (filterSearch && !searchStr.includes(filterSearch.toLowerCase())) {
      return false;
    }
    if (filterRole !== 'all' && member.role !== filterRole) {
      return false;
    }
    if (filterStatus !== 'all') {
      const isActiveMatch = filterStatus === 'active';
      if (member.is_active !== isActiveMatch) {
        return false;
      }
    }
    if (filterSkill !== 'all') {
      const memberSkills = member.skills || allEmployees?.find((e: any) => e.user_id === member.id || e.id === member.id)?.skills || [];
      if (!memberSkills.some((s: string) => s.toLowerCase() === filterSkill.toLowerCase())) {
        return false;
      }
    }
    if (filterWorkload !== 'all') {
      const stats = member.task_stats || { total: 0, completed: 0, overdue: 0 };
      const activeTasksCount = stats.total - stats.completed;
      if (filterWorkload === 'overloaded' && stats.overdue === 0) return false;
      if (filterWorkload === 'active' && activeTasksCount === 0) return false;
      if (filterWorkload === 'free' && activeTasksCount > 0) return false;
    }
    return true;
  });

  // Helpers
  const getRoleBadgeStyle = (role: TeamMember['role']) => {
    const base = 'px-2 py-0.5 rounded-md text-[10px] font-bold border ';
    switch (role) {
      case 'admin':
        return base + 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30';
      case 'hr':
        return base + 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/30';
      case 'manager':
        return base + 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
      case 'employee':
        return base + 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    }
  };

  const getRoleAvatarStyle = (role: TeamMember['role']) => {
    const base = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold ';
    switch (role) {
      case 'admin':
        return base + 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-200 dark:border-purple-900';
      case 'hr':
        return base + 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400 border-pink-200 dark:border-pink-900';
      case 'manager':
        return base + 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900';
      case 'employee':
        return base + 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900';
    }
  };

  const isMemberOnline = (member: TeamMember) => {
    const isSelf = Boolean(
      currentUser && (
        member.id === currentUser.id ||
        member.user_id === currentUser.id ||
        member.user?.id === currentUser.id ||
        (member.email && currentUser.email && member.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (member.user?.email && currentUser.email && member.user.email.toLowerCase() === currentUser.email.toLowerCase())
      )
    );
    return Boolean(isSelf || member.is_online || member.user?.is_online);
  };

  const getMemberLastSeen = (member: TeamMember) => {
    if (isMemberOnline(member)) return 'Online now';
    return member.last_seen_display || 'Offline';
  };

  const getLeaveStatusBadge = (status: LeaveRequest['status']) => {
    const base = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ';
    switch (status) {
      case 'pending':
        return base + 'bg-yellow-50 text-yellow-600 border border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30';
      case 'approved':
        return base + 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'rejected':
        return base + 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
    }
  };

  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterRole('all');
    setFilterStatus('all');
    setFilterWorkload('all');
    setFilterSkill('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary shrink-0" />
            Department & Team Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
            Manage organization members, departments hierarchy, reporting lines, and team standups.
          </p>
        </div>

        {/* Right Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {canManageInvites && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkImportModal(true)}
                className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-200 shadow-xs"
                title="Bulk import team roster via CSV or Google Sheets"
              >
                <UploadCloud className="h-4 w-4 text-primary" />
                <span>Bulk Import (CSV)</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setInviteEmail('');
                  setInviteRole('employee');
                  setInviteDeptId('');
                  setInviteModalError(null);
                  setShowInviteModal(true);
                }}
                className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <UserPlus className="h-4 w-4" />
                <span>Invite Member</span>
              </Button>
            </>
          )}

          {['admin', 'hr', 'manager'].includes(currentUser?.role || '') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDelegationManagerId(null);
                setShowDelegationModal(true);
              }}
              className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400"
              title="Out-of-Office Approval Delegation"
            >
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              <span>OOO Delegation</span>
              {(delegationsList?.filter((d: any) => d.is_active)?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500 text-white">
                  {delegationsList?.filter((d: any) => d.is_active)?.length}
                </span>
              )}
            </Button>
          )}

          {/* Pillar 4: Quick 1-on-1 Sync Launcher */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedOneOnOneWorkspaceId(null);
              setSelectedOneOnOneEmployeeId(null);
              setShowOneOnOneModal(true);
            }}
            className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-200 hover:border-purple-500/50 hover:text-purple-600 dark:hover:text-purple-400"
            title="Open 1-on-1 Meeting Workspaces"
          >
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span>1-on-1 Sync</span>
            {(oneOnOneWorkspaces?.length || 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-500 text-white">
                {oneOnOneWorkspaces.length}
              </span>
            )}
          </Button>

          {/* Pillar 4: Quick Department Runbooks Launcher */}
          {['admin', 'hr', 'manager'].includes(currentUser?.role || '') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRunbookEmployeeId(null);
                setShowRunbookModal(true);
              }}
              className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Departmental Onboarding / Offboarding Runbooks"
            >
              <ListChecks className="h-4 w-4 text-emerald-500" />
              <span>Runbooks</span>
              {(runbookExecutions?.filter((r: any) => r.status === 'active')?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white">
                  {runbookExecutions.filter((r: any) => r.status === 'active').length}
                </span>
              )}
            </Button>
          )}

          {currentUser?.employee_profile_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDailyCheckinModal(true)}
              className="text-xs flex items-center gap-1.5 h-8 font-semibold bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-200 hover:border-primary/50 transition-colors"
              title="Open 3-Question Rapid Async Check-in"
            >
              <span>{currentUser.status_emoji || '🚀'}</span>
              <span>{currentUser.status_message ? 'Daily Standup' : 'Check In Today'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['members'] });
              queryClient.invalidateQueries({ queryKey: ['departments'] });
              queryClient.invalidateQueries({ queryKey: ['leaves'] });
              queryClient.invalidateQueries({ queryKey: ['invitations'] });
              queryClient.invalidateQueries({ queryKey: ['department-command-center'] });
              queryClient.invalidateQueries({ queryKey: ['delegations'] });
              queryClient.invalidateQueries({ queryKey: ['oneOnOneWorkspacesList'] });
              queryClient.invalidateQueries({ queryKey: ['skillMatrixData'] });
              queryClient.invalidateQueries({ queryKey: ['runbookExecutionsList'] });
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Refresh Directory & Command Center"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 1: DYNAMIC DEPARTMENT COMMAND CENTER & CAPACITY RADAR
          ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 text-white shadow-xl overflow-hidden p-5 space-y-4">
        {/* Top Header & Department Scope Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-inner">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">Department Command Center & Capacity Radar</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time workforce availability, active workload burnout risks, and integrated spend / hiring radar.
              </p>
            </div>
          </div>

          {/* Department Filter Dropdown */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Building2 className="h-4 w-4 text-slate-400" />
            <select
              value={selectedCommandDept}
              onChange={(e) => setSelectedCommandDept(e.target.value)}
              className="h-8.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-white font-semibold px-3 py-1 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">🏢 All Departments (Org-Wide)</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.head_name ? `(Head: ${d.head_name})` : ''}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchCommandCenter()}
              disabled={commandCenterLoading}
              className="h-8.5 w-8.5 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${commandCenterLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 3 Live Telemetry Widgets Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* WIDGET 1: Live Department Pulse Bar */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700/80 p-4 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-sky-400" /> Live Department Pulse Bar
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {commandCenter?.pulse.total_headcount ?? totalCount} Staff
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-extrabold" title="Actively online with a live session right now">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {Math.max(
                    commandCenter?.pulse.online_count ?? 0,
                    members?.filter((m) => isMemberOnline(m)).length ?? 0,
                    currentUser ? 1 : 0
                  )} Online Now
                </span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold" title="Staff scheduled on-duty today (not on approved leave)">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  {commandCenter?.pulse.present_count ?? totalCount} On-Duty Today
                </span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1.5 text-sky-400 font-extrabold">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  {commandCenter?.pulse.remote_wfh_count ?? 0} Remote/WFH
                </span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-extrabold">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {commandCenter?.pulse.on_leave_count ?? 0} On Leave
                </span>
                {(commandCenter?.pulse.half_day_count ?? 0) > 0 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="inline-flex items-center gap-1 text-violet-400 font-semibold text-xs">
                      {commandCenter?.pulse.half_day_count} Half-Day
                    </span>
                  </>
                )}
              </div>

              {/* Multi-segment Availability Bar */}
              <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden flex">
                <div
                  style={{
                    width: `${
                      (commandCenter?.pulse.total_headcount || 1) > 0
                        ? (((commandCenter?.pulse.present_count || 0) / (commandCenter?.pulse.total_headcount || 1)) * 100)
                        : 0
                    }%`
                  }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Present: ${commandCenter?.pulse.present_count ?? 0}`}
                />
                <div
                  style={{
                    width: `${
                      (commandCenter?.pulse.total_headcount || 1) > 0
                        ? (((commandCenter?.pulse.remote_wfh_count || 0) / (commandCenter?.pulse.total_headcount || 1)) * 100)
                        : 0
                    }%`
                  }}
                  className="bg-sky-400 h-full transition-all duration-500"
                  title={`Remote / WFH: ${commandCenter?.pulse.remote_wfh_count ?? 0}`}
                />
                <div
                  style={{
                    width: `${
                      (commandCenter?.pulse.total_headcount || 1) > 0
                        ? ((((commandCenter?.pulse.on_leave_count || 0) + (commandCenter?.pulse.half_day_count || 0)) / (commandCenter?.pulse.total_headcount || 1)) * 100)
                        : 0
                    }%`
                  }}
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`On Leave / Half-day: ${commandCenter?.pulse.on_leave_count ?? 0}`}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {(commandCenter?.pulse.leave_details?.length || 0)} OOO Entries Today
              </span>
              <button
                onClick={() => setShowLeaveDetailsModal(true)}
                className="text-sky-400 hover:text-sky-300 font-bold hover:underline flex items-center gap-1"
              >
                View Details <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* WIDGET 2: Workload & Bandwidth Gauge */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700/80 p-4 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-amber-400" /> Workload & Bandwidth Gauge
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {commandCenter?.workload_gauge.total_open_tasks || 0} Open ({commandCenter?.workload_gauge.high_priority_tasks || 0} High/Crit)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Burnout Risk Card Button */}
              <button
                onClick={() => setShowBurnoutModal(true)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  (commandCenter?.workload_gauge.burnout_risk_count ?? 0) > 0
                    ? 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25 text-red-200'
                    : 'bg-slate-750 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Flame className="h-3 w-3 text-red-400" /> Burnout Risk
                  </span>
                  <span className="text-base font-extrabold text-red-400">
                    {commandCenter?.workload_gauge.burnout_risk_count ?? 0}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">&gt; 6 high-pri tasks</span>
              </button>

              {/* Available Capacity Card Button */}
              <button
                onClick={() => setShowAvailableModal(true)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  (commandCenter?.workload_gauge.available_capacity_count ?? 0) > 0
                    ? 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-200'
                    : 'bg-slate-750 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3 w-3 text-emerald-400" /> Available
                  </span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {commandCenter?.workload_gauge.available_capacity_count ?? 0}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">0 open tasks</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Balanced: <strong className="text-white font-bold">{commandCenter?.workload_gauge.balanced_count ?? 0}</strong></span>
              <span>Avg: <strong className="text-white font-bold">{commandCenter?.workload_gauge.avg_tasks_per_employee ?? 0}</strong> tasks/emp</span>
            </div>
          </div>

          {/* WIDGET 3: Integrated Departmental Spend & Hiring Radar */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700/80 p-4 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Spend & Hiring Radar
              </span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                commandCenter?.financial_radar.status === 'exceeded'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : commandCenter?.financial_radar.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : commandCenter?.financial_radar.status === 'healthy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {commandCenter?.financial_radar.status || 'unallocated'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  ${(commandCenter?.financial_radar.spent_this_month || 0).toLocaleString()} / ${(commandCenter?.financial_radar.budget_amount || 0).toLocaleString()}
                </span>
                <span className="font-extrabold text-slate-300">
                  {commandCenter?.financial_radar.utilization_pct ?? 0}% Utilized
                </span>
              </div>

              {/* Spend progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                <div
                  style={{ width: `${Math.min(commandCenter?.financial_radar.utilization_pct || 0, 100)}%` }}
                  className={`h-full transition-all duration-500 ${
                    (commandCenter?.financial_radar.utilization_pct || 0) > 100
                      ? 'bg-red-500'
                      : (commandCenter?.financial_radar.utilization_pct || 0) >= 80
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
              </div>

              {/* Hiring pipeline requisition badge */}
              <div className="pt-2 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="text-slate-300 font-semibold">
                    <strong className="text-white font-bold">{commandCenter?.hiring_pipeline.open_requisitions_count || 0}</strong> Open Roles
                  </span>
                </div>
                <Link
                  to="/hiring"
                  className="text-primary hover:text-primary/80 font-bold hover:underline flex items-center gap-1 text-[11px]"
                >
                  Hiring Pipeline <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
              <Link
                to="/expenses"
                className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline flex items-center gap-1"
              >
                Expense Budgets <ArrowRight className="h-3 w-3" />
              </Link>
              {commandCenter?.selected_department && (
                <span className="text-slate-400 text-[10px] truncate max-w-[120px]">
                  Dept: <strong className="text-white">{commandCenter.selected_department.name}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pillar 3: Real-Time Standup Blocker Alert Banner */}
      {blockerBanner?.has_active_blockers && !dismissedBlockerBanner && (
        <div className="rounded-xl border border-red-300 dark:border-red-900/60 bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300 flex items-center justify-center shrink-0 font-bold shadow-sm">
              <Flame className="h-5 w-5 animate-pulse text-red-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-red-900 dark:text-red-200">
                  🚨 Standup Blocker Alert: {blockerBanner.blocker_count} Active Blocker(s) Reported Today
                </h4>
                <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 animate-pulse">
                  Urgent Attention
                </span>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-300/80 mt-0.5 line-clamp-1">
                {blockerBanner.blockers[0]?.employee_name} ({blockerBanner.blockers[0]?.department_name}): "{blockerBanner.blockers[0]?.description}"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              size="sm"
              onClick={() => setActiveTab('standups')}
              className="h-7 text-xs font-bold px-3 bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              Review Standups &rarr;
            </Button>
            <button
              onClick={() => setDismissedBlockerBanner(true)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Members</span>
          <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-border">
            {membersLoading ? '...' : totalCount}
          </span>
        </button>

        {currentUser?.role !== 'employee' && (
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'departments'
                ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
                : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderTree className="h-4 w-4" />
            <span>Departments</span>
            <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-border">
              {departments?.length || 0}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'leaves'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Palmtree className="h-4 w-4" />
          <span>Leaves & Time Off</span>
        </button>

        <button
          onClick={() => setActiveTab('standups')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'standups'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Standup Feed</span>
          {(blockerBanner?.blocker_count || 0) > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
              {blockerBanner?.blocker_count}
            </span>
          )}
        </button>

        {canManageInvites && (
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
                : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Invitations</span>
            {invitations && invitations.filter((i) => i.status === 'pending').length > 0 && (
              <span className="ml-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {invitations.filter((i) => i.status === 'pending').length}
              </span>
            )}
          </button>
        )}

        {/* Pillar 4: Recurring 1-on-1 Workspaces Tab */}
        <button
          onClick={() => setActiveTab('1-on-1s')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === '1-on-1s'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-purple-500" />
          <span>1-on-1 Syncs</span>
          {oneOnOneWorkspaces?.length > 0 && (
            <span className="ml-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {oneOnOneWorkspaces.length}
            </span>
          )}
        </button>

        {/* Pillar 4: Skill Matrix & Talent Directory Tab */}
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'skills'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Talent & Skills</span>
        </button>

        {/* Pillar 4: Onboarding & Offboarding Runbooks Tab */}
        <button
          onClick={() => setActiveTab('runbooks')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'runbooks'
              ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ListChecks className="h-4 w-4 text-emerald-500" />
          <span>Runbooks</span>
          {runbookExecutions?.filter((r: any) => r.status === 'active')?.length > 0 && (
            <span className="ml-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {runbookExecutions.filter((r: any) => r.status === 'active').length}
            </span>
          )}
        </button>
      </div>

      {pageSuccessMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{pageSuccessMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MEMBERS DIRECTORY
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Quick Stats Grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Members</span>
              <span className="text-xl font-bold text-slate-800 dark:text-white">
                {membersLoading ? '...' : totalCount}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Status</span>
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {membersLoading ? '...' : activeCount}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider">Admins / HR</span>
              <span className="text-xl font-bold text-purple-750 dark:text-purple-400">
                {membersLoading ? '...' : (adminCount + hrCount)}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Managers</span>
              <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                {membersLoading ? '...' : managerCount}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Employees</span>
              <span className="text-xl font-bold text-slate-700 dark:text-slate-350">
                {membersLoading ? '...' : employeeCount}
              </span>
            </Card>
          </div>

          {/* Who's Out Today / Calendar Banner */}
          {(outToday.length > 0 || outNextWeek.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {outToday.length > 0 && (
                <Card className="border-red-100 dark:border-red-950/40 bg-red-50/20 dark:bg-red-950/5 shadow-sm p-4 flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-red-650 dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <CalendarDays className="h-4 w-4" /> Out of Office Today ({outToday.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {outToday.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-white dark:bg-slate-900 border border-red-100/60 dark:border-red-955/40 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm"
                      >
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-slate-800 dark:text-white">{leave.employee_name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded">
                          {leave.leave_type}
                        </span>
                        <span className="text-[9px] text-red-500 dark:text-red-400 font-bold">
                          Until {new Date(leave.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {outNextWeek.length > 0 && (
                <Card className="border-amber-100 dark:border-amber-950/40 bg-amber-50/20 dark:bg-amber-950/5 shadow-sm p-4 flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-amber-650 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <CalendarDays className="h-4 w-4" /> Out Next 7 Days ({outNextWeek.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {outNextWeek.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-white dark:bg-slate-900 border border-amber-100/60 dark:border-amber-955/40 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm"
                      >
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-slate-800 dark:text-white">{leave.employee_name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded">
                          {leave.leave_type}
                        </span>
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                          {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Pending Invitations Quick Alert */}
          {canManageInvites && (invitations?.filter((i) => i.status === 'pending').length || 0) > 0 && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  You have <strong className="font-bold">{invitations?.filter((i) => i.status === 'pending').length}</strong> pending team invitation(s) awaiting onboarding.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('invitations')}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white underline font-bold text-xs flex items-center gap-1 shrink-0"
              >
                View Invitations <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Directory Filter Bar */}
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center justify-between">
              <div className="flex flex-1 flex-col md:flex-row md:items-center gap-3 w-full">
                {/* Search Input */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="employee">Employee</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>

                  <select
                    value={filterWorkload}
                    onChange={(e) => setFilterWorkload(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="all">All Workloads</option>
                    <option value="overloaded">Overloaded (Has Overdue)</option>
                    <option value="active">Active (Has Active Tasks)</option>
                    <option value="free">Free (Idle)</option>
                  </select>

                  {/* Skill Matrix Filter Dropdown */}
                  <select
                    value={filterSkill}
                    onChange={(e) => setFilterSkill(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-slate-950 dark:border-slate-800 font-semibold text-primary"
                  >
                    <option value="all">All Skills & Competencies</option>
                    {allAvailableSkills.map((sk) => (
                      <option key={sk} value={sk}>
                        Skill: {sk}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid / Spreadsheet view Mode Toggle */}
              <div className="flex border border-border rounded-lg p-0.5 bg-slate-50 dark:bg-slate-900 text-slate-650 self-start md:self-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                      : 'text-muted-foreground hover:text-slate-800 dark:hover:text-white'
                  }`}
                  title="Grid Cards"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                      : 'text-muted-foreground hover:text-slate-800 dark:hover:text-white'
                  }`}
                  title="Spreadsheet Table"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Members Display Container */}
          {membersLoading ? (
            <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredMembers && filteredMembers.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMembers.map((member) => {
                  const stats = member.task_stats || { total: 0, completed: 0, overdue: 0 };
                  const activeTasks = stats.total - stats.completed;
                  const memberSkills = member.skills || allEmployees?.find((e: any) => e.user_id === member.id || e.id === member.id)?.skills || [];

                  return (
                    <Card
                      key={member.id}
                      className={`border-border bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:shadow-md ${
                        !member.is_active ? 'opacity-70' : ''
                      }`}
                    >
                      {/* Clickable Card Body */}
                      <div
                        onClick={() => openMemberModal(member)}
                        className="p-5 space-y-4 cursor-pointer hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors"
                      >
                        {/* Header Row: Initials & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="relative">
                            <div className={getRoleAvatarStyle(member.role)}>
                              {getInitials(member.first_name, member.last_name)}
                            </div>
                            {/* Live Online Presence Beacon */}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                isMemberOnline(member)
                                  ? 'bg-emerald-500 ring-2 ring-emerald-400/30'
                                  : 'bg-slate-400 dark:bg-slate-500'
                              }`}
                              title={
                                isMemberOnline(member)
                                  ? '🟢 Online Now (Active in workspace)'
                                  : `⚪ Offline • Last seen ${getMemberLastSeen(member)}`
                              }
                            >
                              {isMemberOnline(member) && (
                                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={getRoleBadgeStyle(member.role)}>{member.role}</span>
                              {/* Real-Time Online Presence Pill */}
                              <span
                                className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  isMemberOnline(member)
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isMemberOnline(member)
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400'
                                  }`}
                                />
                                {isMemberOnline(member) ? 'Online' : getMemberLastSeen(member)}
                              </span>
                            </div>

                            {/* Account Standing Tag (if suspended) */}
                            {!member.is_active && (
                              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                                Suspended Account
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Member Details */}
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight flex items-center gap-1.5 flex-wrap">
                            <span>{member.first_name} {member.last_name}</span>
                            {member.status_message && (
                              <span
                                title={member.status_message}
                                className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/30 px-1.5 py-0.5 rounded text-[9px] text-sky-700 dark:text-sky-305 border border-sky-100 dark:border-sky-900/40 font-bold max-w-[140px] truncate"
                              >
                                <span>{member.status_emoji || '💬'}</span>
                                <span className="truncate">{member.status_message}</span>
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {/* Cross-Departmental Matrix Badges (Primary + Matrix Pods) */}
                          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mt-1">
                            <Briefcase className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
                            <div className="flex flex-wrap gap-1">
                              {/* Primary Department Badge */}
                              {member.primary_department ? (
                                <span
                                  title="Primary Department"
                                  className="bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
                                >
                                  <Building2 className="h-2.5 w-2.5" />
                                  <span>{member.primary_department.name}</span>
                                  <span className="text-[7.5px] uppercase tracking-wider font-extrabold text-primary/70 bg-primary/10 px-1 rounded">(Primary)</span>
                                </span>
                              ) : member.department_name ? (
                                <span
                                  title="Primary Department"
                                  className="bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
                                >
                                  <Building2 className="h-2.5 w-2.5" />
                                  <span>{member.department_name.split(', ')[0]}</span>
                                  <span className="text-[7.5px] uppercase tracking-wider font-extrabold text-primary/70 bg-primary/10 px-1 rounded">(Primary)</span>
                                </span>
                              ) : (
                                <span className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[9px] text-slate-400 font-semibold border border-slate-200 dark:border-slate-800">
                                  Unassigned
                                </span>
                              )}

                              {/* Secondary Cross-Departmental Matrix Pod Badges */}
                              {member.secondary_departments && member.secondary_departments.length > 0 ? (
                                member.secondary_departments.map((sd) => (
                                  <span
                                    key={sd.id}
                                    title="Matrix Cross-Departmental Pod"
                                    className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1"
                                  >
                                    <Globe className="h-2.5 w-2.5 text-indigo-500" />
                                    <span>{sd.name}</span>
                                    <span className="text-[7.5px] uppercase tracking-wider font-extrabold text-indigo-500/80 bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">(Matrix)</span>
                                  </span>
                                ))
                              ) : (
                                (member.department_name || '').split(', ').slice(1).map((dName) => (
                                  <span
                                    key={dName}
                                    title="Matrix Cross-Departmental Pod"
                                    className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1"
                                  >
                                    <Globe className="h-2.5 w-2.5 text-indigo-500" />
                                    <span>{dName}</span>
                                    <span className="text-[7.5px] uppercase tracking-wider font-extrabold text-indigo-500/80 bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">(Matrix)</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Telemetry Status Pills (Attendance & Workload Radar) */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {member.today_attendance && member.today_attendance.status !== 'present' && (
                              <span
                                title="Today's Attendance Status"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              >
                                <Clock className="h-2.5 w-2.5 text-amber-600" />
                                <span>{member.today_attendance.label}</span>
                              </span>
                            )}

                            {member.workload_stats?.burnout_status === 'high_risk' && (
                              <span
                                title="Flagged with > 6 open high or critical priority tasks"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse"
                              >
                                <Flame className="h-3 w-3 text-red-600" />
                                <span>Burnout Risk ({member.workload_stats.high_priority} High/Crit)</span>
                              </span>
                            )}

                            {member.workload_stats?.burnout_status === 'available' && (
                              <span
                                title="0 active assigned tasks across projects"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              >
                                <Zap className="h-2.5 w-2.5 text-emerald-600" />
                                <span>Available Capacity</span>
                              </span>
                            )}
                          </div>

                          {/* Skill Matrix Tags */}
                          {memberSkills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {memberSkills.slice(0, 3).map((sk: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-semibold px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[100px]"
                                >
                                  {sk}
                                </span>
                              ))}
                              {memberSkills.length > 3 && (
                                <span className="text-[9px] text-muted-foreground font-bold px-1">
                                  +{memberSkills.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>Joined {new Date(member.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Workload Section */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-2.5 space-y-2 border border-slate-100 dark:border-slate-800 text-[10px]">
                          <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-350">
                            <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3 text-primary" /> Active Tasks</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeTasks}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-350">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-red-500" /> Overdue Tasks</span>
                            <span className={`font-bold ${stats.overdue > 0 ? 'text-red-500 font-extrabold' : 'text-slate-800 dark:text-white'}`}>
                              {stats.overdue}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      {currentUser?.role === 'admin' && (
                        <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-border p-3.5 flex items-center justify-between gap-2">
                          {member.id !== currentUser.id ? (
                            <>
                              {/* Quick Edit Trigger */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openMemberModal(member)}
                                className="h-8 text-xs font-semibold px-2.5 border-border"
                              >
                                Edit Profile
                              </Button>

                              <div className="flex items-center gap-1">
                                {/* Toggle Active status button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleStatus(member.id, member.is_active)}
                                  className={`h-8 text-xs font-semibold px-2 gap-1 ${
                                    member.is_active
                                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                                      : 'text-primary hover:bg-primary/10'
                                  }`}
                                  title={member.is_active ? 'Suspend member account' : 'Reactivate member account'}
                                >
                                  {member.is_active ? (
                                    <>
                                      <UserMinus className="h-3.5 w-3.5" /> Suspend
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3.5 w-3.5" /> Activate
                                    </>
                                  )}
                                </Button>

                                {/* Delete / Remove Member button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setMemberToDelete(member)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  title="Remove Member from Organization"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex w-full justify-center text-[10px] font-bold text-muted-foreground tracking-wide py-1">
                              ACTIVE SESSION
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Skills Matrix</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Workload Metrics</th>
                        {currentUser?.role === 'admin' && <th className="px-6 py-4 text-right">Access Controls</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {filteredMembers.map((member) => {
                        const stats = member.task_stats || { total: 0, completed: 0, overdue: 0 };
                        const activeTasksCount = stats.total - stats.completed;
                        const memberSkills = member.skills || allEmployees?.find((e: any) => e.user_id === member.id || e.id === member.id)?.skills || [];

                        return (
                          <tr
                            key={member.id}
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all ${
                              !member.is_active ? 'opacity-70' : ''
                            }`}
                          >
                            {/* Avatar & Name - Clickable */}
                            <td
                              className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-50/40"
                              onClick={() => openMemberModal(member)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                  <div className={`h-8 w-8 rounded-full border text-[10px] font-bold flex items-center justify-center ${getRoleAvatarStyle(member.role).replace('flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold ', '')}`}>
                                    {getInitials(member.first_name, member.last_name)}
                                  </div>
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                      isMemberOnline(member) ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}
                                    title={isMemberOnline(member) ? 'Online Now' : `Offline (${getMemberLastSeen(member)})`}
                                  />
                                </div>
                                <span className="font-bold text-slate-850 dark:text-slate-100 hover:underline flex items-center gap-1.5">
                                  <span>{member.first_name} {member.last_name}</span>
                                  {member.status_message && (
                                    <span
                                      title={member.status_message}
                                      className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/30 px-1.5 py-0.5 rounded text-[9px] text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40 font-bold shrink-0"
                                    >
                                      <span>{member.status_emoji || '💬'}</span>
                                      <span className="max-w-[180px] truncate">{member.status_message}</span>
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-6 py-4 text-muted-foreground font-medium">
                              {member.email}
                            </td>

                            {/* Department (Primary + Cross-Departmental Matrix Pods) */}
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1 max-w-[240px]">
                                {member.primary_department ? (
                                  <span
                                    title="Primary Department"
                                    className="bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex items-center gap-1"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    <span>{member.primary_department.name}</span>
                                    <span className="text-[7.5px] uppercase font-extrabold text-primary/70 bg-primary/10 px-1 rounded">(Primary)</span>
                                  </span>
                                ) : member.department_name ? (
                                  <span
                                    title="Primary Department"
                                    className="bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex items-center gap-1"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    <span>{member.department_name.split(', ')[0]}</span>
                                    <span className="text-[7.5px] uppercase font-extrabold text-primary/70 bg-primary/10 px-1 rounded">(Primary)</span>
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                    Unassigned
                                  </span>
                                )}

                                {member.secondary_departments && member.secondary_departments.length > 0 ? (
                                  member.secondary_departments.map((sd) => (
                                    <span
                                      key={sd.id}
                                      title="Matrix Cross-Departmental Pod"
                                      className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap flex items-center gap-1"
                                    >
                                      <Globe className="h-2.5 w-2.5 text-indigo-500" />
                                      <span>{sd.name}</span>
                                      <span className="text-[7.5px] uppercase font-extrabold text-indigo-500/80 bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">(Matrix)</span>
                                    </span>
                                  ))
                                ) : (
                                  (member.department_name || '').split(', ').slice(1).map((dName) => (
                                    <span
                                      key={dName}
                                      title="Matrix Cross-Departmental Pod"
                                      className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap flex items-center gap-1"
                                    >
                                      <Globe className="h-2.5 w-2.5 text-indigo-500" />
                                      <span>{dName}</span>
                                      <span className="text-[7.5px] uppercase font-extrabold text-indigo-500/80 bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">(Matrix)</span>
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>

                            {/* Role */}
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-semibold">
                              <span className={getRoleBadgeStyle(member.role)}>
                                {member.role}
                              </span>
                            </td>

                            {/* Skills */}
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {memberSkills.length > 0 ? (
                                  memberSkills.slice(0, 3).map((sk: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium whitespace-nowrap"
                                    >
                                      {sk}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-[10px] italic">No skills</span>
                                )}
                                {memberSkills.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground font-bold">
                                    +{memberSkills.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Real-Time Online Presence & Account Status */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                                    isMemberOnline(member)
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${isMemberOnline(member) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  <span>{isMemberOnline(member) ? 'Online Now' : getMemberLastSeen(member)}</span>
                                </span>
                                {!member.is_active && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                                    Suspended
                                  </span>
                                )}
                                {member.today_attendance && member.today_attendance.status !== 'present' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5 text-amber-600" />
                                    <span>{member.today_attendance.label}</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Workload Stats & Telemetry */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-350">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1">
                                    <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                    {activeTasksCount} Active
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    <span className={stats.overdue > 0 ? 'text-red-500 font-extrabold' : ''}>
                                      {stats.overdue} Overdue
                                    </span>
                                  </span>
                                </div>
                                {member.workload_stats?.burnout_status === 'high_risk' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse w-fit">
                                    <Flame className="h-2.5 w-2.5 text-red-600" />
                                    <span>High Burnout Risk ({member.workload_stats.high_priority} High/Crit)</span>
                                  </span>
                                )}
                                {member.workload_stats?.burnout_status === 'available' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 w-fit">
                                    <Zap className="h-2.5 w-2.5 text-emerald-600" />
                                    <span>Available Capacity</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            {currentUser?.role === 'admin' && (
                              <td className="px-6 py-4 text-right">
                                {member.id !== currentUser.id ? (
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedMember(member);
                                        setEditRole(member.role);
                                        setEditDept(member.department_id || '');
                                      }}
                                      className="h-8 text-xs font-semibold px-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleStatus(member.id, member.is_active)}
                                      className={`h-8 text-xs font-semibold gap-1 ${
                                        member.is_active
                                          ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                                          : 'text-primary hover:bg-primary/10'
                                      }`}
                                    >
                                      {member.is_active ? (
                                        <>
                                          <UserMinus className="h-4 w-4" /> Suspend
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-4 w-4" /> Activate
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setMemberToDelete(member)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      title="Remove Member from Organization"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground font-bold tracking-wide px-3 py-1">
                                    ACTIVE SESSION
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          ) : (
            <Card className="border-border bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-3">No Department Members Found</h3>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs mt-3">
                Clear Filters
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DEPARTMENTS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DEPARTMENTS MANAGEMENT & ORG CHART
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'departments' && currentUser?.role !== 'employee' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar with View Mode Switcher & Create Dept */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-border shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-primary" />
                Department Hierarchy & Organizational Structure
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switch between tabular department allocations and full interactive visual reporting tree.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* View Switcher Toggle */}
              <div className="flex border border-border rounded-lg p-0.5 bg-slate-50 dark:bg-slate-950 text-slate-650">
                <button
                  onClick={() => setDeptViewMode('list')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    deptViewMode === 'list'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                      : 'text-muted-foreground hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  <span>Departments List</span>
                </button>
                <button
                  onClick={() => setDeptViewMode('tree')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    deptViewMode === 'tree'
                      ? 'bg-white dark:bg-slate-800 text-primary font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Interactive Org Chart</span>
                </button>
              </div>

              {['admin', 'hr', 'manager'].includes(currentUser?.role || '') && (
                <Button
                  onClick={handleOpenCreateDeptModal}
                  size="sm"
                  className="flex items-center gap-1.5 text-xs font-semibold shrink-0 shadow-sm h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Department
                </Button>
              )}
            </div>
          </div>

          {deptViewMode === 'tree' ? (
            <OrgChartTree
              employees={allEmployees || []}
              members={members || []}
              departments={departments || []}
              oooLeaves={oooLeaves || []}
              delegations={delegationsList || commandCenter?.delegations?.active_delegations || []}
              onSelectMember={openMemberModal}
              onOpenDelegationModal={(managerId?: string) => {
                setSelectedDelegationManagerId(managerId || null);
                setShowDelegationModal(true);
              }}
            />
          ) : (
            <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FolderTree className="h-5 w-5 text-primary" />
                    Departments Directory
                    <span className="ml-1 bg-primary/10 text-primary text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-primary/20">
                      {departments?.length || 0}
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Organize team structure, assign department heads, and manage employee allocations.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
              {deptsLoading ? (
                <div className="flex h-56 w-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : departments && departments.length > 0 ? (
                <div className="divide-y divide-border">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      onClick={() => handleOpenEditDeptModal(dept)}
                      title="Click to edit department details and manage member assignments"
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-2">
                            {dept.name}
                          </h4>
                          {dept.parent_name && (
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-border">
                              <span className="text-muted-foreground">Parent:</span> {dept.parent_name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-500">Department Head:</span>
                            {currentUser?.role === 'admin' ? (
                              <select
                                value={dept.head || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleUpdateDeptHead(dept.id, e.target.value || null);
                                }}
                                className="bg-slate-50 dark:bg-slate-800 border border-border rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary ml-1"
                              >
                                <option value="">No head assigned</option>
                                {members?.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.first_name} {m.last_name} ({m.role})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">
                                {dept.head_name || 'No assigned head'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {dept.employee_count} {dept.employee_count === 1 ? 'Member' : 'Members'}
                        </span>

                        {['admin', 'hr', 'manager'].includes(currentUser?.role || '') && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditDeptModal(dept);
                              }}
                              className="h-8 px-3 text-xs font-semibold gap-1.5 hover:border-primary hover:text-primary transition-all shadow-xs"
                              title="Edit Department & Members"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeptToDelete(dept);
                              }}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Delete Department"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <FolderTree className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Departments Created Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Create departments to organize your organization, assign leaders, and manage reporting structures.
                  </p>
                  {['admin', 'hr', 'manager'].includes(currentUser?.role || '') && (
                    <Button
                      onClick={handleOpenCreateDeptModal}
                      className="mt-2 text-xs font-semibold"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Department
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: LEAVES & TIME OFF HUB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'leaves' && (
        <div className="animate-in fade-in duration-200">
          <Leaves isEmbedded={true} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: DAILY STANDUPS FEED & AI DIGEST
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'standups' && (
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900 max-w-3xl mx-auto animate-in fade-in duration-200 overflow-hidden">
          <CardHeader className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Department Standup Feed
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                See what teammates are working on today, track async updates, and synthesize executive summaries.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Department Feed Filter */}
              <select
                value={standupDeptFilter}
                onChange={(e) => setStandupDeptFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-white px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Departments</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Post 3-Question Standup Check-in */}
              <Button
                size="sm"
                onClick={() => setShowDailyCheckinModal(true)}
                className="h-8 text-xs font-bold px-3 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                title="Submit your 3-question rapid async standup update"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Check In</span>
              </Button>

              {/* AI Daily Summary Button */}
              <Button
                size="sm"
                onClick={() => setShowDigestModal(true)}
                className="h-8 text-xs font-semibold px-3 gap-1.5 bg-gradient-to-r from-primary to-purple-600 text-white shadow-sm hover:from-primary/90 hover:to-purple-700"
                title="Generate AI-powered Executive Standup Digest"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Daily Digest</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {feedLoading ? (
              <div className="flex h-32 w-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : statusFeed && statusFeed.length > 0 ? (
              statusFeed
                .filter((feed) => {
                  if (standupDeptFilter === 'all') return true;
                  return feed.department_id === standupDeptFilter;
                })
                .map((feed) => (
                  <div key={feed.id} className="p-5 flex items-start gap-3.5 hover:bg-slate-50/20 dark:hover:bg-slate-900/5 transition-all">
                    <div className="relative shrink-0">
                      <div className={`h-9 w-9 rounded-full border text-[10px] font-bold flex items-center justify-center ${getRoleAvatarStyle(feed.role).replace('flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold ', '')}`}>
                        {getInitials(feed.employee_name.split(' ')[0], feed.employee_name.split(' ')[1] || '')}
                      </div>
                      <span className="text-xs absolute -bottom-1 -right-1">
                        {feed.status_emoji || '💬'}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {feed.employee_name}
                          </span>
                          <span className={getRoleBadgeStyle(feed.role)}>
                            {feed.role}
                          </span>
                          {feed.department_name && (
                            <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded border border-border">
                              {feed.department_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                          {new Date(feed.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* 3-Question Structured Card Layout */}
                      <div className="space-y-2 text-xs">
                        {/* Q1: Accomplished */}
                        {feed.yesterday_accomplished && (
                          <div className="p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Yesterday's Accomplishments</span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium">
                              {feed.yesterday_accomplished}
                            </p>
                          </div>
                        )}

                        {/* Q2: Focus Today */}
                        {(feed.today_focus || (!feed.yesterday_accomplished && feed.status_message)) && (
                          <div className="p-2.5 rounded-lg border border-sky-200/60 dark:border-sky-950 bg-sky-50/30 dark:bg-sky-950/20 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                              <Rocket className="h-3 w-3" />
                              <span>Focus Today</span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium">
                              {feed.today_focus || feed.status_message}
                            </p>
                          </div>
                        )}

                        {/* Q3: Blockers */}
                        {feed.has_blockers ? (
                          <div className="p-2.5 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 space-y-1 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                                <AlertOctagon className="h-3 w-3 animate-pulse" />
                                <span>🚨 Active Blocker ({feed.blocker_severity || 'High'})</span>
                              </div>
                              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.2 rounded uppercase">
                                Action Required
                              </span>
                            </div>
                            <p className="text-red-900 dark:text-red-200 font-bold whitespace-pre-line leading-relaxed">
                              {feed.blockers_description || feed.status_message}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            <span>No active blockers reported</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground italic">
                No daily status updates logged yet for this department.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: INVITATIONS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'invitations' && canManageInvites && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Quick Stats Grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Invitations</span>
              <span className="text-2xl font-bold text-slate-800 dark:text-white">{invitations?.length || 0}</span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Invites</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {invitations?.filter((i) => i.status === 'pending').length || 0}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Accepted & Active</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {invitations?.filter((i) => i.status === 'accepted').length || 0}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Revoked / Expired</span>
              <span className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                {invitations?.filter((i) => ['expired', 'revoked'].includes(i.status)).length || 0}
              </span>
            </Card>
          </div>

          <Card className="border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Team Invitations
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track email invitations, resend magic onboarding links, or revoke pending requests.
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {invitationsLoading ? (
                <div className="flex h-56 w-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : invitations && invitations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3.5">Recipient & Invited By</th>
                        <th className="px-5 py-3.5">Role & Department</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5">Sent / Expires</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invitations.map((invite) => {
                        const isExpired = invite.status === 'expired' || (invite.status === 'pending' && new Date(invite.expires_at) < new Date());
                        const displayStatus = isExpired && invite.status === 'pending' ? 'expired' : invite.status;

                        return (
                          <tr key={invite.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0 border border-border">
                                  <Mail className="h-4 w-4 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 dark:text-white block">
                                    {invite.email}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    Invited by <span className="font-semibold text-slate-700 dark:text-slate-300">{invite.invited_by_name || invite.invited_by_email}</span>
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={getRoleBadgeStyle(invite.role)}>
                                  {invite.role.toUpperCase()}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  {invite.department_name || 'No Department'}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {displayStatus === 'pending' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </span>
                              )}
                              {displayStatus === 'accepted' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Accepted
                                </span>
                              )}
                              {displayStatus === 'revoked' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                  <Ban className="h-3 w-3" />
                                  Revoked
                                </span>
                              )}
                              {displayStatus === 'expired' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40">
                                  <XCircle className="h-3 w-3" />
                                  Expired
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              <div className="space-y-0.5">
                                <div>
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Sent: </span>
                                  <span>{new Date(invite.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                {displayStatus === 'accepted' ? (
                                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                    Joined {invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">
                                    Expires {new Date(invite.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              {displayStatus === 'pending' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {invite.invite_link && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyInviteLink(invite)}
                                      className="h-7 px-2.5 text-[11px] font-semibold gap-1 text-slate-700 dark:text-slate-200 border-border"
                                      title="Copy magic invite link"
                                    >
                                      {copiedInviteId === invite.id ? (
                                        <>
                                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                                          <span className="text-emerald-600">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5" />
                                          <span>Copy Link</span>
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resendInviteMutation.mutate(invite.id)}
                                    disabled={resendInviteMutation.isPending}
                                    className="h-7 px-2.5 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                    title="Resend invitation email"
                                  >
                                    <RotateCcw className={`h-3.5 w-3.5 ${resendInviteMutation.isPending ? 'animate-spin' : ''}`} />
                                    <span>Resend</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      const confirmed = await coreConfirm({
                                        title: 'Revoke Invitation',
                                        description: `Are you sure you want to revoke the invitation for ${invite.email}?`,
                                        variant: 'destructive',
                                        confirmLabel: 'Revoke Invitation',
                                        warning: 'The invitation link will immediately expire and the invitee cannot use it to join.',
                                      });
                                      if (confirmed) {
                                        revokeInviteMutation.mutate(invite.id);
                                      }
                                    }}
                                    disabled={revokeInviteMutation.isPending}
                                    className="h-7 px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                                    title="Revoke invitation"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : displayStatus === 'accepted' ? (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Active Member
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  Inactive
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Invitations Sent Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Invite colleagues by sending them a secure 1-click magic link directly to their email.
                  </p>
                  <Button
                    onClick={() => {
                      setInviteEmail('');
                      setInviteRole('employee');
                      setInviteDeptId('');
                      setInviteModalError(null);
                      setShowInviteModal(true);
                    }}
                    className="mt-2 text-xs font-semibold"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Invite First Member
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: RECURRING 1-ON-1 WORKSPACES
          ───────────────────────────────────────────────────────────── */}
      {activeTab === '1-on-1s' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Quick Metrics Bar */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">1-on-1 Partnerships</span>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{oneOnOneWorkspaces?.length || 0}</span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Weekly / Bi-Weekly</span>
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                {oneOnOneWorkspaces?.filter((w: any) => ['weekly', 'biweekly'].includes(w.cadence))?.length || 0}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Open Action Items</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {oneOnOneWorkspaces?.reduce((acc: number, w: any) => acc + (w.action_items?.filter((a: any) => a.status === 'pending')?.length || 0), 0)}
              </span>
            </Card>
            <Card className="border-border bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Tasks Converted to CORE</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {oneOnOneWorkspaces?.reduce((acc: number, w: any) => acc + (w.action_items?.filter((a: any) => a.converted_to_task_id)?.length || 0), 0)}
              </span>
            </Card>
          </div>

          {/* Workspaces List / Card Container */}
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Manager & Report 1-on-1 Workspaces
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Private collaborative spaces for managers and direct reports with continuous agenda, discussion talking points, and 1-click CORE task sync.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedOneOnOneWorkspaceId(null);
                  setSelectedOneOnOneEmployeeId(null);
                  setShowOneOnOneModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> New 1-on-1 Workspace
              </Button>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {oneOnOnesLoading ? (
                <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <span>Loading 1-on-1 workspaces...</span>
                </div>
              ) : oneOnOneWorkspaces.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mx-auto">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">No 1-on-1 Workspaces Initialized</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Empower team growth by establishing regular 1-on-1 cadences with shared agendas and automated task conversion.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedOneOnOneWorkspaceId(null);
                      setSelectedOneOnOneEmployeeId(null);
                      setShowOneOnOneModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Start First 1-on-1
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {oneOnOneWorkspaces.map((ws: any) => {
                    const pendingActions = ws.action_items?.filter((a: any) => a.status === 'pending')?.length || 0;
                    const convertedTasks = ws.action_items?.filter((a: any) => a.converted_to_task_id)?.length || 0;
                    return (
                      <div
                        key={ws.id}
                        className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/40 p-4 hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {ws.cadence}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {ws.department_name || 'Organization'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            {/* Manager */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                {getInitials(ws.manager_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{ws.manager_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">Manager</div>
                              </div>
                            </div>

                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                            {/* Report */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-secondary/30 text-foreground font-bold text-xs flex items-center justify-center shrink-0">
                                {getInitials(ws.employee_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{ws.employee_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">Report</div>
                              </div>
                            </div>
                          </div>

                          {/* Meeting Schedule & Action items status */}
                          <div className="rounded-lg bg-background p-2.5 border border-border text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-purple-500" /> Next Session:
                              </span>
                              <span className="font-semibold text-foreground">
                                {ws.next_meeting_date ? new Date(ws.next_meeting_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unscheduled'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ListTodo className="h-3 w-3 text-amber-500" /> Action Items:
                              </span>
                              <span className="font-semibold text-foreground">
                                {pendingActions} pending ({convertedTasks} synced to CORE)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedOneOnOneWorkspaceId(ws.id);
                              setShowOneOnOneModal(true);
                            }}
                            className="flex-1 text-xs font-semibold h-8 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            Open Workspace
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOneOnOneWorkspaceId(ws.id);
                              setShowOneOnOneModal(true);
                            }}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                            title="Join Video Room"
                          >
                            <Video className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 7: DEPARTMENT SKILL MATRIX & TALENT DIRECTORY
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Hero Search Banner */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-secondary/10 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Department Skill Matrix & Cross-Pod Talent Finder
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Natural language search across all competencies: e.g. "Find me someone in Marketing who knows SQL" or "Kubernetes expert in Engineering".
                </p>
              </div>
            </div>

            {/* Natural Query Input & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-8 relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={skillSearchQuery}
                  onChange={(e) => {
                    setSkillSearchQuery(e.target.value);
                    if (selectedSkillTag) setSelectedSkillTag(null);
                  }}
                  placeholder="Find someone with React, PostgreSQL, Cold Outreach, Kubernetes, AWS..."
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                />
              </div>

              <div className="sm:col-span-4 flex gap-2">
                <select
                  value={selectedSkillDeptFilter}
                  onChange={(e) => setSelectedSkillDeptFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                >
                  <option value="all">🏢 All Departments</option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {(skillSearchQuery || selectedSkillTag || selectedSkillDeptFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSkillSearchQuery('');
                      setSelectedSkillTag(null);
                      setSelectedSkillDeptFilter('all');
                    }}
                    className="h-8.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Popular Skills Tags Cloud */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Popular Competencies:
              </span>
              {(skillMatrixData?.top_skills || [
                { skill: 'React', count: 4 },
                { skill: 'TypeScript', count: 3 },
                { skill: 'Django', count: 3 },
                { skill: 'PostgreSQL', count: 2 },
                { skill: 'Kubernetes', count: 1 },
                { skill: 'AWS', count: 2 },
                { skill: 'Docker', count: 2 },
                { skill: 'Figma', count: 1 },
                { skill: 'Cold Outreach', count: 1 },
              ]).map((sObj: any) => {
                const sName = typeof sObj === 'string' ? sObj : sObj.skill;
                const isSelected = selectedSkillTag === sName || skillSearchQuery.toLowerCase().includes(sName.toLowerCase());
                return (
                  <button
                    key={sName}
                    onClick={() => {
                      if (selectedSkillTag === sName) {
                        setSelectedSkillTag(null);
                        setSkillSearchQuery('');
                      } else {
                        setSelectedSkillTag(sName);
                        setSkillSearchQuery(sName);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    <span>{sName}</span>
                    {typeof sObj !== 'string' && sObj.count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-primary-foreground/20 text-white' : 'bg-background text-muted-foreground'}`}>
                        {sObj.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Results Talent Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Matching Talent ({skillMatrixData?.total_employees || skillMatrixData?.results?.length || 0})
              </div>
            </div>

            {skillMatrixLoading ? (
              <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Searching competencies and cross-department squads...</span>
              </div>
            ) : (skillMatrixData?.results || []).length === 0 ? (
              <div className="py-16 text-center space-y-2 border border-dashed border-border rounded-xl">
                <Search className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                <h4 className="text-sm font-bold text-foreground">No matching talent found</h4>
                <p className="text-xs text-muted-foreground">
                  Try another keyword like "React", "SQL", "DevOps" or clear your department filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(skillMatrixData?.results || []).map((talent: any) => {
                  const matched = talent.matched_skills || [];
                  const other = (talent.skills || []).filter((s: string) => !matched.includes(s));
                  return (
                    <Card
                      key={talent.employee_id || talent.user_id}
                      className="border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden hover:border-primary/50 transition-all flex flex-col justify-between"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm border border-primary/30">
                              {getInitials(talent.full_name)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate">{talent.full_name}</h4>
                              <p className="text-xs text-muted-foreground truncate">{talent.email}</p>
                            </div>
                          </div>
                          {talent.match_score > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Matched
                            </span>
                          )}
                        </div>

                        {/* Department Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-primary" />
                            <span>{talent.department_name || 'Unassigned'} (Primary)</span>
                          </span>
                          {(talent.secondary_departments || []).map((sd: any) => (
                            <span
                              key={sd.id}
                              className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            >
                              {sd.name} (Pod)
                            </span>
                          ))}
                        </div>

                        {/* Skills Cloud */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            Verified Skills:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {matched.map((sk: string) => (
                              <span
                                key={sk}
                                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-xs flex items-center gap-1"
                              >
                                <Sparkles className="h-3 w-3 text-emerald-500" />
                                <span>{sk}</span>
                              </span>
                            ))}
                            {other.map((sk: string) => (
                              <span
                                key={sk}
                                className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-medium"
                              >
                                {sk}
                              </span>
                            ))}
                            {(talent.skills || []).length === 0 && (
                              <span className="text-xs text-muted-foreground italic">No skills listed yet</span>
                            )}
                          </div>
                        </div>
                      </CardContent>

                      {/* Card Footer Quick Actions */}
                      <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQuickSkillMember(talent);
                            setQuickSkillInput('');
                          }}
                          className="h-7 text-xs font-semibold px-2"
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit Skills
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedOneOnOneWorkspaceId(null);
                              setSelectedOneOnOneEmployeeId(talent.employee_id);
                              setSelectedOneOnOneDeptId(talent.department_id);
                              setShowOneOnOneModal(true);
                            }}
                            className="h-7 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white px-2.5"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> 1-on-1 Sync
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 8: DEPARTMENT ONBOARDING & OFFBOARDING RUNBOOKS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'runbooks' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-emerald-500" />
                  Departmental Onboarding & Offboarding Runbooks
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standardized multi-phase checklists ensuring Day 1 readiness, early leader 1-on-1s, and seamless departmental knowledge transfer.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRunbookEmployeeId(null);
                  setSelectedRunbookType('onboarding');
                  setShowRunbookModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" /> 1-Click Launch Runbook
              </Button>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {runbooksLoading ? (
                <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <span>Loading departmental runbooks...</span>
                </div>
              ) : runbookExecutions.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Active Runbooks</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Launch automated Day 1, Day 3, and Week 1 checklists when welcoming a new hire or coordinating a departing teammate.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRunbookEmployeeId(null);
                      setSelectedRunbookType('onboarding');
                      setShowRunbookModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs mt-2"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Onboard First Member
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {runbookExecutions.map((exec: any) => {
                    const completedCount = exec.steps?.filter((s: any) => s.completed)?.length || 0;
                    const totalSteps = exec.steps?.length || 1;
                    const pct = Math.round((completedCount / totalSteps) * 100);
                    return (
                      <div
                        key={exec.id}
                        className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/40 hover:border-emerald-500/50 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              exec.type === 'onboarding'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                              {exec.type}
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {exec.employee_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {exec.department_name}
                          </span>
                        </div>

                        {/* Progress */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Milestones Completed</span>
                            <span className="font-bold text-foreground">{completedCount} of {totalSteps} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Steps overview */}
                        <div className="space-y-1.5 pt-1">
                          {(exec.steps || []).slice(0, 3).map((st: any) => (
                            <div key={st.id} className="text-xs flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5 truncate">
                                {st.completed ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={st.completed ? 'line-through' : 'font-medium'}>{st.title}</span>
                              </span>
                              <span className="text-[10px] font-mono shrink-0 ml-2">{st.phase}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-border flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRunbookEmployeeId(exec.employee);
                              setSelectedRunbookDeptId(exec.department);
                              setSelectedRunbookType(exec.type);
                              setShowRunbookModal(true);
                            }}
                            className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Open Checklist &rarr;
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREATE & EDIT DEPARTMENT MODAL
          ───────────────────────────────────────────────────────────── */}
      {showCreateDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20 shadow-sm">
                  <FolderTree className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingDeptId ? 'Edit Department' : 'Create New Department'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editingDeptId
                      ? 'Update department details, assign leaders, and manage team member allocations.'
                      : 'Define department details, assign a leader, and select employees to join.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateDeptModal(false);
                  setEditingDeptId(null);
                  setDeptModalError(null);
                }}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveDept} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {deptModalError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 font-semibold text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{deptModalError}</span>
                  </div>
                )}

                {/* Grid for Name, Parent, Head */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Dept Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Product, Marketing, Sales"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Parent Department */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Parent Department (Optional)
                    </label>
                    <select
                      value={newDeptParent}
                      onChange={(e) => setNewDeptParent(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                    >
                      <option value="">None (Top-Level Root Department)</option>
                      {departments
                        ?.filter((dept) => !editingDeptId || dept.id !== editingDeptId)
                        .map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Department Head */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Department Head (Optional)
                    </label>
                    <select
                      value={newDeptHead}
                      onChange={(e) => setNewDeptHead(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                    >
                      <option value="">None Assigned</option>
                      {members?.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.first_name} {member.last_name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Team Members Assignment Multi-Selector */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Assign Team Members
                        <span className="bg-primary/10 text-primary text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20">
                          {selectedDeptMembers.length} Selected
                        </span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Selected employees will belong to this department. Unchecked employees will be unassigned from this department.
                      </p>
                    </div>

                    {/* Quick Selection Helper Buttons */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={handleSelectAllDeptMembers}
                        className="text-[10px] font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded border border-primary/20 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectUnassignedDeptMembers}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-2 py-1 rounded border border-amber-200 dark:border-amber-900/40 transition-colors"
                      >
                        Unassigned Only
                      </button>
                      {selectedDeptMembers.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearDeptMembers}
                          className="text-[10px] font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search employees by name, email, or role..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="flex h-8.5 w-full rounded-md border border-input bg-white pl-8 pr-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                    />
                  </div>

                  {/* Scrollable Member Checkbox List */}
                  <div className="border border-border rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
                    <div className="max-h-56 overflow-y-auto divide-y divide-border">
                      {filteredModalMembers.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground italic">
                          No employees match your search.
                        </div>
                      ) : (
                        filteredModalMembers.map((member) => {
                          const isSelected = selectedDeptMembers.includes(member.id);
                          const isUnassigned = !member.department_name || member.department_name === 'Unassigned' || member.department_name === 'No Dept';
                          return (
                            <div
                              key={member.id}
                              onClick={() => handleToggleDeptMember(member.id)}
                              className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/10'
                                  : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={getRoleAvatarStyle(member.role)}>
                                  {getInitials(member.first_name, member.last_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                      {member.first_name} {member.last_name}
                                    </span>
                                    <span className={getRoleBadgeStyle(member.role)}>
                                      {member.role}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                    <span className="truncate">{member.email}</span>
                                    <span>•</span>
                                    <span className={`font-semibold ${isUnassigned ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                                      {member.department_name || 'Unassigned'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 ml-3">
                                {isSelected ? (
                                  <CheckCircle2 className="h-5 w-5 text-primary fill-primary/15" />
                                ) : (
                                  <Circle className="h-5 w-5 text-border hover:text-slate-400" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateDeptModal(false);
                    setEditingDeptId(null);
                    setDeptModalError(null);
                  }}
                  className="text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createDeptMutation.isPending || updateDeptMutation.isPending || !newDeptName.trim()}
                  className="text-xs font-semibold px-5"
                >
                  {editingDeptId ? (
                    updateDeptMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )
                  ) : createDeptMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Creating...
                    </>
                  ) : (
                    'Create Department'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DELETE DEPARTMENT CONFIRMATION MODAL
          ───────────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        open={!!deptToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeptToDelete(null);
            setDeleteDeptError(null);
          }
        }}
        title="Delete Department"
        description={
          deptToDelete ? (
            <>
              Are you sure you want to delete <strong className="text-foreground font-semibold">"{deptToDelete.name}"</strong>?
            </>
          ) : ''
        }
        warning={
          deptToDelete ? (
            <>
              All <strong className="font-bold">{deptToDelete.employee_count} assigned {deptToDelete.employee_count === 1 ? 'member' : 'members'}</strong> will not be deleted, but will automatically be marked as <strong className="font-bold">Unassigned</strong>.
            </>
          ) : undefined
        }
        error={deleteDeptError}
        confirmLabel="Delete Department"
        isLoading={deleteDeptMutation.isPending}
        onConfirm={() => {
          if (deptToDelete) {
            deleteDeptMutation.mutate(deptToDelete.id);
          }
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          REMOVE / DELETE MEMBER CONFIRMATION MODAL
          ───────────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        open={!!memberToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToDelete(null);
          }
        }}
        title="Remove Member from Organization"
        description={
          memberToDelete ? (
            <>
              Are you sure you want to remove <strong className="text-foreground font-semibold">"{memberToDelete.first_name || memberToDelete.email}"</strong> from your organization?
            </>
          ) : ''
        }
        warning={
          memberToDelete ? (
            <>
              Their organization access will be revoked immediately and they will be unassigned from all departments.
            </>
          ) : undefined
        }
        confirmLabel="Remove Member"
        isLoading={deleteMemberMutation.isPending}
        onConfirm={() => {
          if (memberToDelete) {
            deleteMemberMutation.mutate(memberToDelete.id);
          }
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          EMPLOYEE DETAILS & EDIT MODAL
          ───────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          EMPLOYEE DETAILS & CONNECTED CONTEXT DRAWER MODAL
          ───────────────────────────────────────────────────────────── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className={getRoleAvatarStyle(selectedMember.role)}>
                  {getInitials(selectedMember.first_name, selectedMember.last_name)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {selectedMember.first_name} {selectedMember.last_name}
                    <span className={getRoleBadgeStyle(selectedMember.role)}>{selectedMember.role}</span>
                    {selectedMember.status_message && (
                      <span
                        title={selectedMember.status_message}
                        className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded text-[10px] text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40 font-bold"
                      >
                        <span>{selectedMember.status_emoji || '💬'}</span>
                        <span>{selectedMember.status_message}</span>
                      </span>
                    )}
                  </h2>
                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 text-slate-400" /> {selectedMember.email}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setModalSuccessMessage(null);
                  setModalErrorMessage(null);
                }}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-7 w-7 rounded-full flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            {/* Connected Context Navigation Tabs */}
            <div className="border-b border-border px-5 bg-slate-50/30 dark:bg-slate-950/40 flex items-center gap-1 text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                onClick={() => setMemberDrawerTab('profile')}
                className={`px-3 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  memberDrawerTab === 'profile'
                    ? 'border-primary text-primary font-bold bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Profile & Skills</span>
              </button>
              <button
                onClick={() => setMemberDrawerTab('workload')}
                className={`px-3 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  memberDrawerTab === 'workload'
                    ? 'border-primary text-primary font-bold bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Active Workload</span>
              </button>
              <button
                onClick={() => setMemberDrawerTab('leaves')}
                className={`px-3 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  memberDrawerTab === 'leaves'
                    ? 'border-primary text-primary font-bold bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Palmtree className="h-3.5 w-3.5" />
                <span>Leave Balances</span>
              </button>
              <button
                onClick={() => setMemberDrawerTab('org')}
                className={`px-3 py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  memberDrawerTab === 'org'
                    ? 'border-primary text-primary font-bold bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>Org Hierarchy</span>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs text-slate-800 dark:text-slate-200">
              
              {/* Alert Status Banners */}
              {modalSuccessMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{modalSuccessMessage}</span>
                </div>
              )}
              {modalErrorMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalErrorMessage}</span>
                </div>
              )}

              {/* TAB 1: Profile & Skills */}
              {memberDrawerTab === 'profile' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Quick Info Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Status:</span>
                      <span className={`font-bold ${selectedMember.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                        {selectedMember.is_active ? 'Active Account' : 'Suspended'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Joined Org:</span>
                      <span className="font-bold">{new Date(selectedMember.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Department:</span>
                      <span className="font-bold text-primary">{selectedMember.department_name || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Role:</span>
                      <span className="font-bold uppercase text-slate-700 dark:text-slate-300">{selectedMember.role}</span>
                    </div>
                  </div>

                  {/* Interactive Skills Matrix Tag Manager */}
                  <div className="space-y-2 p-4 rounded-xl border border-border bg-slate-50/30 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span>Skill Matrix & Competency Tags ({editSkills.length})</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">Type & press Enter to add</span>
                    </div>

                    {/* Skill Badges List */}
                    <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-border">
                      {editSkills.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic py-0.5">No skills tagged yet.</span>
                      ) : (
                        editSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2 py-0.5 rounded-md"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => setEditSkills(editSkills.filter((_, i) => i !== idx))}
                              className="text-primary/60 hover:text-primary font-bold text-xs"
                              title="Remove skill"
                            >
                              &times;
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add Skill Tag Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add skill (e.g. React, Python, Kubernetes, Figma)..."
                        value={newSkillInput}
                        onChange={(e) => setNewSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = newSkillInput.trim().replace(/^,|,$/g, '');
                            if (val && !editSkills.includes(val)) {
                              setEditSkills([...editSkills, val]);
                              setNewSkillInput('');
                            }
                          }
                        }}
                        className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-900 dark:border-slate-800"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const val = newSkillInput.trim().replace(/^,|,$/g, '');
                          if (val && !editSkills.includes(val)) {
                            setEditSkills([...editSkills, val]);
                            setNewSkillInput('');
                          }
                        }}
                        disabled={!newSkillInput.trim()}
                        className="h-8 text-xs font-semibold px-3 shrink-0"
                      >
                        Add
                      </Button>
                    </div>

                    {/* Quick Popular Suggestions */}
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[10px] text-muted-foreground font-semibold">Suggested:</span>
                      {['React', 'TypeScript', 'Python', 'Django', 'Kubernetes', 'AWS', 'Figma', 'Product Strategy', 'Enterprise Sales', 'SQL'].map(
                        (tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (!editSkills.includes(tag)) {
                                setEditSkills([...editSkills, tag]);
                              }
                            }}
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border transition-colors ${
                              editSkills.includes(tag)
                                ? 'bg-primary/20 text-primary border-primary/30 opacity-50 cursor-default'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-border hover:bg-primary/10 hover:text-primary'
                            }`}
                          >
                            +{tag}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Admin / Manager Access Controls & Assigners */}
                  {currentUser?.role === 'admin' && selectedMember.id !== currentUser?.id && (
                    <Card className="border-border bg-white dark:bg-slate-900/40">
                      <CardHeader className="py-2.5 px-4 border-b border-border">
                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" /> Edit Access Permissions & Reporting
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
                        {/* Role Dropdown */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Workspace Role
                          </label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="flex h-8.5 w-full rounded-md border border-input bg-white px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800 font-semibold"
                          >
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="hr">HR</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>

                        {/* Primary Department Selection */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" /> Primary Department
                          </label>
                          <select
                            value={editDept}
                            onChange={(e) => {
                              const newPrimary = e.target.value;
                              setEditDept(newPrimary);
                              if (newPrimary && !editDeptIds.includes(newPrimary)) {
                                setEditDeptIds([newPrimary, ...editDeptIds]);
                              }
                            }}
                            className="flex h-8.5 w-full rounded-md border border-input bg-white px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800 font-semibold"
                          >
                            <option value="">No Primary Department (Unassigned)</option>
                            {departments?.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cross-Departmental Matrix Pods Selection */}
                        <div className="space-y-1 sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Globe className="h-3.5 w-3.5 text-indigo-500" /> Cross-Departmental Matrix Pods ({editDeptIds.length} Total)
                            </label>
                            <div className="flex items-center gap-2 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditDeptIds(departments?.map((d) => d.id) || [])}
                                className="text-primary hover:underline font-semibold"
                              >
                                All
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                type="button"
                                onClick={() => setEditDeptIds(editDept ? [editDept] : [])}
                                className="text-muted-foreground hover:text-foreground font-semibold"
                              >
                                Reset to Primary
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg border border-input bg-slate-50/50 dark:bg-slate-950 max-h-32 overflow-y-auto">
                            {departments?.map((dept) => {
                              const isPrimary = editDept === dept.id;
                              const isChecked = editDeptIds.includes(dept.id) || isPrimary;
                              return (
                                <label
                                  key={dept.id}
                                  className={`flex items-center gap-2 p-1.5 rounded border text-[11px] cursor-pointer transition-colors ${
                                    isPrimary
                                      ? 'bg-primary/10 border-primary/50 text-primary font-bold'
                                      : isChecked
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold'
                                      : 'bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isPrimary}
                                    onChange={() => {
                                      if (isPrimary) return;
                                      if (isChecked) {
                                        setEditDeptIds(editDeptIds.filter((id) => id !== dept.id));
                                      } else {
                                        setEditDeptIds([...editDeptIds, dept.id]);
                                      }
                                    }}
                                    className="h-3 w-3 rounded text-primary"
                                  />
                                  <span className="truncate flex-1">{dept.name}</span>
                                  {isPrimary && (
                                    <span className="text-[8px] uppercase px-1 py-0.2 bg-primary/20 text-primary rounded font-extrabold">
                                      Primary
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Reporting Manager */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Reporting Manager (Hierarchy Line)
                          </label>
                          <select
                            value={editManager}
                            onChange={(e) => setEditManager(e.target.value)}
                            className="flex h-8.5 w-full rounded-md border border-input bg-white px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                          >
                            <option value="">No Direct Manager (Top-Level Root / Direct to Admin)</option>
                            {allEmployees
                              ?.filter((emp) => emp.id !== selectedMember.employee_profile_id && emp.user_id !== selectedMember.id)
                              .map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.full_name} ({emp.role.toUpperCase()}) {emp.department_name ? `• ${emp.department_name}` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* TAB 2: Active Workload (Projects Sync) */}
              {memberDrawerTab === 'workload' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Active Tasks</span>
                      <span className="text-2xl font-bold text-primary">
                        {(selectedMember.task_stats?.total || 0) - (selectedMember.task_stats?.completed || 0)}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-red-500 uppercase font-bold block">Overdue Tasks</span>
                      <span className={`text-2xl font-bold ${selectedMember.task_stats?.overdue ? 'text-red-500 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                        {selectedMember.task_stats?.overdue || 0}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block">Completed</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {selectedMember.task_stats?.completed || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        Connected Projects Panel
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        View active Kanban tasks, assign deliverables, and review sprint progress.
                      </p>
                    </div>
                    <Link
                      to="/projects"
                      onClick={() => setSelectedMember(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90"
                    >
                      <span>Open Projects</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {/* TAB 3: Leaves & Time-Off Sync */}
              {memberDrawerTab === 'leaves' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Annual Leave</span>
                      <span className="text-xl font-bold text-emerald-600">
                        {employeeDetail?.leave_balance?.annual ?? 20} Days
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Sick Leave</span>
                      <span className="text-xl font-bold text-blue-600">
                        {employeeDetail?.leave_balance?.sick ?? 10} Days
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Unpaid Leave</span>
                      <span className="text-xl font-bold text-slate-600 dark:text-slate-300">
                        {employeeDetail?.leave_balance?.unpaid ?? 0} Days
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Palmtree className="h-4 w-4 text-emerald-600" />
                        Time-Off & Leave Calendar
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Submit leave requests, review pending approvals, and inspect team calendar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(null);
                        setActiveTab('leaves');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-xs hover:bg-emerald-700"
                    >
                      <span>Open Leaves Hub</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: Org Hierarchy */}
              {memberDrawerTab === 'org' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Reporting Manager */}
                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Reports To (Manager)
                    </span>
                    {employeeDetail?.manager_name ? (
                      <div className="flex items-center gap-2.5 font-semibold text-xs text-slate-900 dark:text-white">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 flex items-center justify-center font-bold text-xs">
                          {getInitials(employeeDetail.manager_name.split(' ')[0], employeeDetail.manager_name.split(' ')[1] || '')}
                        </div>
                        <div>
                          <span className="font-bold block">{employeeDetail.manager_name}</span>
                          <span className="text-[10px] text-muted-foreground">Reporting Lead</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        No direct manager assigned (Reports directly to Root / Admin).
                      </div>
                    )}
                  </div>

                  {/* Direct Reports List */}
                  <div className="p-3.5 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Direct Reports
                    </span>
                    {(allEmployees || []).filter((emp) => emp.manager === selectedMember.employee_profile_id || emp.manager_id === selectedMember.employee_profile_id).length > 0 ? (
                      <div className="divide-y divide-border">
                        {(allEmployees || [])
                          .filter((emp) => emp.manager === selectedMember.employee_profile_id || emp.manager_id === selectedMember.employee_profile_id)
                          .map((report) => (
                            <div key={report.id} className="py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border flex items-center justify-center font-bold text-[10px]">
                                  {getInitials(report.first_name, report.last_name)}
                                </div>
                                <span className="font-semibold text-xs">{report.full_name}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">{report.role}</span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        No direct reports assigned to this employee.
                      </div>
                    )}
                  </div>

                  {/* Link to Org Chart */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMember(null);
                        setActiveTab('departments');
                        setDeptViewMode('tree');
                      }}
                      className="w-full text-xs font-semibold gap-1.5"
                    >
                      <Layers className="h-4 w-4 text-primary" />
                      <span>View Full Interactive Org Tree</span>
                    </Button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedMember(null);
                  setModalSuccessMessage(null);
                  setModalErrorMessage(null);
                }}
                className="text-xs font-semibold px-4"
              >
                Close
              </Button>
              {currentUser?.role === 'admin' && (
                <Button
                  size="sm"
                  onClick={handleSaveChanges}
                  className="text-xs font-semibold px-4"
                  disabled={updateMemberMutation.isPending || updateEmployeeMutation.isPending}
                >
                  {updateMemberMutation.isPending || updateEmployeeMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>

          </div>
        </div>
      )}
      {/* Set Daily Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Set Daily Status</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Emoji</label>
                <div className="flex gap-2.5 flex-wrap">
                  {['💬', '🚀', '☕', '🏠', '🩺', '🏝️', '💻', '📞', '🔥', '🎉'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStatusEmoji(emoji)}
                      className={`h-8 w-8 text-base rounded flex items-center justify-center border transition-all ${
                        statusEmoji === emoji
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border bg-slate-50 dark:bg-slate-950 hover:bg-slate-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status Message</label>
                <input
                  type="text"
                  placeholder="What are you working on today?"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  maxLength={100}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-slate-950 dark:border-slate-800"
                />
              </div>
            </div>
            <div className="p-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusText('');
                  setStatusEmoji('💬');
                }}
                className="text-[11px] h-8"
              >
                Clear Status
              </Button>
              <Button
                size="sm"
                onClick={handleSaveStatus}
                className="text-[11px] h-8"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INVITE TEAM MEMBER MODAL
          ───────────────────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20 shadow-sm">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Invite Team Member
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send a magic onboarding link to join your organization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteModalError(null);
                }}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) {
                  setInviteModalError('Email is required.');
                  return;
                }
                setInviteModalError(null);
                createInviteMutation.mutate({
                  email: inviteEmail.trim(),
                  role: inviteRole,
                  department_id: inviteDeptId || null,
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              {inviteModalError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 font-semibold text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{inviteModalError}</span>
                </div>
              )}

              {/* Recipient Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Assigned Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                >
                  <option value="employee">Employee (Standard Access)</option>
                  <option value="manager">Manager (Team & Task Lead)</option>
                  <option value="hr">HR (Member & Leaves Management)</option>
                  {currentUser?.role === 'admin' && (
                    <option value="admin">Admin (Full Organization Access)</option>
                  )}
                </select>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Department (Optional)
                </label>
                <select
                  value={inviteDeptId}
                  onChange={(e) => setInviteDeptId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                >
                  <option value="">No Department (Assign Later)</option>
                  {departments?.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notice Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-border text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  The invited member will receive a branded email with a secure 1-click magic link. They'll set their password and get instant access.
                </span>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteModalError(null);
                  }}
                  className="text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createInviteMutation.isPending}
                  className="text-xs font-semibold px-4 flex items-center gap-1.5"
                >
                  {createInviteMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Team CSV / Google Sheets Importer Modal */}
      <BulkTeamImportModal
        open={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['members'] });
          queryClient.invalidateQueries({ queryKey: ['all-employees'] });
          queryClient.invalidateQueries({ queryKey: ['departments'] });
          queryClient.invalidateQueries({ queryKey: ['invitations'] });
        }}
      />

      {/* AI Daily Standup Digest Modal */}
      <StandupDigestModal
        open={showDigestModal}
        onClose={() => setShowDigestModal(false)}
        departments={departments || []}
      />

      {/* Pillar 3: 3-Question Rapid Async Check-in Modal */}
      <DailyCheckinModal
        open={showDailyCheckinModal}
        onClose={() => setShowDailyCheckinModal(false)}
        currentUser={currentUser}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['status-feed'] });
          queryClient.invalidateQueries({ queryKey: ['members'] });
          queryClient.invalidateQueries({ queryKey: ['standup-banner'] });
          queryClient.invalidateQueries({ queryKey: ['department-command-center'] });
          if (checkSession) {
            checkSession();
          }
          setPageSuccessMessage('Your 3-question daily standup check-in was published successfully!');
          setTimeout(() => setPageSuccessMessage(null), 4000);
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          PILLAR 1 MODALS: BURNOUT, AVAILABLE CAPACITY, & LEAVE DETAILS
          ───────────────────────────────────────────────────────────── */}

      {/* Burnout Risk Details Modal */}
      {showBurnoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 flex items-center justify-center">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">High Burnout Risk Telemetry</h3>
                  <p className="text-[11px] text-muted-foreground">Staff flagged with &gt; 6 open high or critical priority tasks</p>
                </div>
              </div>
              <button
                onClick={() => setShowBurnoutModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {(commandCenter?.workload_gauge.burnout_risk_employees || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No staff currently flagged with high burnout risk. Bandwidth across projects is healthy!
                </div>
              ) : (
                commandCenter?.workload_gauge.burnout_risk_employees.map((emp) => (
                  <div
                    key={emp.employee_id}
                    className="p-3 rounded-lg border border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{emp.full_name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-semibold text-primary">{emp.department_name}</span>
                        <span>•</span>
                        <span>{emp.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                        {emp.high_priority_tasks} High/Crit Tasks
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        ({emp.total_tasks} Total, {emp.overdue_tasks} Overdue)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowBurnoutModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Available Capacity Modal */}
      {showAvailableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Available Capacity Staff</h3>
                  <p className="text-[11px] text-muted-foreground">Staff with 0 active assigned tasks ready for new project allocation</p>
                </div>
              </div>
              <button
                onClick={() => setShowAvailableModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {(commandCenter?.workload_gauge.available_capacity_employees || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  All team members currently have active tasks assigned across organizational projects.
                </div>
              ) : (
                commandCenter?.workload_gauge.available_capacity_employees.map((emp) => (
                  <div
                    key={emp.employee_id}
                    className="p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{emp.full_name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-semibold text-primary">{emp.department_name}</span>
                        <span>•</span>
                        <span>{emp.email}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      ⚡ Ready for Assignment
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowAvailableModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave & Out of Office Details Modal */}
      {showLeaveDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-sky-50/50 dark:bg-sky-950/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today's Absence & Remote Roster</h3>
                  <p className="text-[11px] text-muted-foreground">Staff on remote WFH, annual leave, or half-day today</p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaveDetailsModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {(commandCenter?.pulse.leave_details || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No staff on leave or remote WFH today. Everyone is in-office!
                </div>
              ) : (
                commandCenter?.pulse.leave_details.map((l) => (
                  <div
                    key={l.employee_id}
                    className="p-3 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{l.full_name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="uppercase font-semibold">{l.role}</span>
                        {l.notes && <span>• "{l.notes}"</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.is_wfh
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                          : l.is_half_day
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {l.leave_type_display}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {l.is_half_day ? (l.half_day_period || 'Half Day') : `Through ${new Date(l.end_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowLeaveDetailsModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pillar 2: Out-of-Office Manager Delegation Modal */}
      <ManagerDelegationModal
        open={showDelegationModal}
        onClose={() => {
          setShowDelegationModal(false);
          setSelectedDelegationManagerId(null);
        }}
        initialDelegatorId={selectedDelegationManagerId}
        members={members || []}
        departments={departments || []}
      />

      {/* Pillar 4: Quick Skill Edit Modal */}
      {quickSkillMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Update Technical Skills & Competencies
                </h3>
                <p className="text-xs text-muted-foreground">
                  {quickSkillMember.full_name} ({quickSkillMember.department_name || 'Member'})
                </p>
              </div>
              <button
                onClick={() => setQuickSkillMember(null)}
                className="text-muted-foreground hover:text-foreground text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickSkillInput}
                  onChange={(e) => setQuickSkillInput(e.target.value)}
                  placeholder="Add skill tag (e.g. Next.js, GraphQL, Redis)..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (quickSkillInput.trim()) {
                        const newSkills = Array.from(new Set([...(quickSkillMember.skills || []), quickSkillInput.trim()]));
                        setQuickSkillMember({ ...quickSkillMember, skills: newSkills });
                        setQuickSkillInput('');
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (quickSkillInput.trim()) {
                      const newSkills = Array.from(new Set([...(quickSkillMember.skills || []), quickSkillInput.trim()]));
                      setQuickSkillMember({ ...quickSkillMember, skills: newSkills });
                      setQuickSkillInput('');
                    }
                  }}
                  className="text-xs font-semibold h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Current Skills:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {(quickSkillMember.skills || []).map((sk: string) => (
                    <span
                      key={sk}
                      className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1.5"
                    >
                      <span>{sk}</span>
                      <button
                        onClick={() => {
                          const updated = (quickSkillMember.skills || []).filter((s: string) => s !== sk);
                          setQuickSkillMember({ ...quickSkillMember, skills: updated });
                        }}
                        className="text-muted-foreground hover:text-destructive text-xs"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {(quickSkillMember.skills || []).length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No skills tagged yet.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setQuickSkillMember(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  updateSkillsMutation.mutate({
                    employeeId: quickSkillMember.employee_id || quickSkillMember.user_id,
                    skills: quickSkillMember.skills || [],
                  });
                }}
                disabled={updateSkillsMutation.isPending}
                className="text-xs font-semibold"
              >
                {updateSkillsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save Skills
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pillar 4: Recurring 1-on-1 Workspace Modal */}
      <OneOnOneWorkspaceModal
        open={showOneOnOneModal}
        onClose={() => {
          setShowOneOnOneModal(false);
          setSelectedOneOnOneWorkspaceId(null);
          setSelectedOneOnOneEmployeeId(null);
        }}
        workspaceId={selectedOneOnOneWorkspaceId}
        initialEmployeeId={selectedOneOnOneEmployeeId}
        initialDepartmentId={selectedOneOnOneDeptId}
        currentUser={currentUser}
      />

      {/* Pillar 4: Departmental Runbook Modal */}
      <DepartmentRunbookModal
        open={showRunbookModal}
        onClose={() => {
          setShowRunbookModal(false);
          setSelectedRunbookEmployeeId(null);
        }}
        departmentId={selectedRunbookDeptId}
        members={members || []}
        currentUser={currentUser}
        initialEmployeeId={selectedRunbookEmployeeId}
        initialType={selectedRunbookType}
      />
    </div>
  );
};
