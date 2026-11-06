import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage, API_BASE, getApiUrl, getMediaUrl } from '../lib/api';
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
  Receipt,
  CreditCard,
  Sparkles,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  FileText,
  UploadCloud,
  Eye,
  Trash2,
  Building,
  UserCheck,
  Plane,
  Utensils,
  Laptop,
  Layers,
  Wrench,
  GraduationCap,
  Wifi,
  Heart,
  Briefcase,
  Search,
  Filter,
  Check,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet,
  BarChart3,
  CheckSquare,
  Zap,
  Loader2,
  Target,
  ShieldAlert,
  ShieldCheck,
  PieChart,
  FolderGit2,
  ArrowUpRight,
  TrendingDown,
  Repeat,
  Radio,
  Send,
  Building2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Camera,
  Navigation,
  MapPin,
  Calendar,
  Compass,
  Files,
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  History,
  ListChecks
} from 'lucide-react';
import { SpreadsheetAnalyst } from '../components/finance/SpreadsheetAnalyst';

interface ExpenseClaimItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department_id?: string | null;
  department_name: string | null;
  title: string;
  merchant: string;
  expense_date: string;
  category: string;
  category_display: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_converted: number;
  tax_amount: number;
  description: string;
  receipt_file: string | null;
  receipt_file_url: string | null;
  receipt_url: string;
  receipt_hash: string;
  project_id: string | null;
  project_name: string | null;
  task_id: string | null;
  task_title: string | null;
  client_name: string;
  is_billable: boolean;
  billing_status: string;
  policy_violations: string[];
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'payment_queued' | 'rejected' | 'reimbursed';
  approval_tier?: string;
  approval_tier_display?: string;
  approval_history?: Array<{
    action: string;
    tier: string;
    by_name: string;
    by_id?: string;
    timestamp: string;
    notes?: string;
  }>;
  settlement_method?: string;
  settlement_method_display?: string;
  settled_at?: string | null;
  rejection_reason: string;
  approved_by_name: string | null;
  approved_at: string | null;
  reimbursed_by_name: string | null;
  reimbursed_at: string | null;
  payout_reference: string;
  ocr_raw_data: any;
  created_at: string;
}

interface ExpenseSummaryData {
  employee_id: string;
  pending_total: number;
  pending_count: number;
  approved_total: number;
  reimbursed_ytd: number;
  total_claims_count: number;
  recent_claims: ExpenseClaimItem[];
}

interface SpendAnalyticsData {
  year: number;
  total_spend_ytd: number;
  pending_payout: number;
  in_review_total: number;
  by_category: Array<{ category: string; total: number; count: number }>;
  by_department: Array<{ employee__department__name: string | null; total: number; count: number }>;
  monthly_trend: Array<{ month: number; month_name: string; total: number }>;
  top_merchants: Array<{ merchant: string; total: number; count: number }>;
}

interface ProjectCostData {
  project_id: string;
  project_name: string;
  status: string;
  owner_name: string;
  start_date: string | null;
  end_date: string | null;
  claims_count: number;
  billable_expenses: number;
  non_billable_expenses: number;
  total_expenses: number;
  logged_hours: number;
  estimated_labor_cost: number;
  total_project_cost: number;
  estimated_revenue: number;
  gross_profit: number;
  profit_margin_percent: number;
}

interface SpendBudgetData {
  id: string;
  target_type: 'department' | 'project';
  department: string | null;
  department_name: string | null;
  project: string | null;
  project_name: string | null;
  period: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  currency: string;
  alert_threshold_percent: number;
  notes: string;
  spent_amount: number;
  pending_amount: number;
  remaining: number;
  utilization_pct: number;
  status_badge: 'healthy' | 'warning' | 'exceeded';
}

interface SubscriptionRadarData {
  total_mrr: number;
  total_arr: number;
  tracked_subscriptions_count: number;
  duplicate_risk_count: number;
  subscriptions: Array<{
    vendor_name: string;
    monthly_spend: number;
    annualized_run_rate: number;
    currency: string;
    claims_count: number;
    employees_using: string[];
    departments: string[];
    duplicate_license_risk: boolean;
    risk_note: string;
    price_change_pct: number;
    last_payment_date: string;
    last_payment_amount: number;
    status: string;
  }>;
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  meals_entertainment: {
    label: 'Meals & Entertainment',
    icon: Utensils,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/40',
  },
  travel_transport: {
    label: 'Travel & Transportation',
    icon: Plane,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-900/40',
  },
  software_subscriptions: {
    label: 'Software & Subscriptions',
    icon: Laptop,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-900/40',
  },
  office_supplies: {
    label: 'Office Supplies',
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-900/40',
  },
  hardware_equipment: {
    label: 'Hardware & Equipment',
    icon: Wrench,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-900/40',
  },
  professional_dev: {
    label: 'Training & Development',
    icon: GraduationCap,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-900/40',
  },
  utilities_internet: {
    label: 'Internet & Utilities',
    icon: Wifi,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900/40',
  },
  wellness_health: {
    label: 'Wellness & Health',
    icon: Heart,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-900/40',
  },
  client_relations: {
    label: 'Client Relations',
    icon: Briefcase,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-900/40',
  },
  other: {
    label: 'Other Operations',
    icon: Receipt,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-200 dark:border-slate-800',
  },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft: {
    label: 'Draft',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
  submitted: {
    label: 'Submitted',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/50',
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-900/50',
  },
  approved: {
    label: 'Approved (Awaiting Payout)',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-900/50',
  },
  payment_queued: {
    label: 'Payment Queued',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-900/50',
  },
  reimbursed: {
    label: 'Settled / Reimbursed',
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
};

const APPROVAL_TIER_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  auto_approved: {
    label: '⚡ Auto-Approved (< $100)',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900/50',
  },
  manager_review: {
    label: 'Tier 1: Direct Manager',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-900/50',
  },
  dept_head_review: {
    label: 'Tier 2: Dept Head',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/50',
  },
  finance_review: {
    label: 'Tier 3: Finance / CFO',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-900/50',
  },
  approved: {
    label: 'Fully Approved',
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
};

const SETTLEMENT_METHODS = [
  { id: 'direct_bank', label: 'Direct Bank Transfer', icon: Building2, desc: 'Direct ACH/NEFT settlement to employee account' },
  { id: 'payroll', label: 'Paid via Payroll', icon: CheckSquare, desc: 'Consolidated into monthly payroll cycle' },
  { id: 'corporate_card', label: 'Corporate Card / ACH', icon: CreditCard, desc: 'Company corporate card payout or automated clearing house' },
  { id: 'cash', label: 'Cash / Petty Cash', icon: DollarSign, desc: 'Immediate physical cash disbursement from office float' },
];

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'payment_queued', label: 'Queued' },
  { key: 'reimbursed', label: 'Settled' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'CHF'];

const safeNum = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
};

const safeToFixed = (val: any, decimals = 2): string => {
  return safeNum(val).toFixed(decimals);
};

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  const isManagerOrAdmin = ['admin', 'hr', 'manager'].includes(user?.role || '');
  const isHRorAdmin = ['admin', 'hr'].includes(user?.role || '');

  // Active Tab Navigation
  const [activeTab, setActiveTab] = useState<
    'my_claims' | 'approvals' | 'project_costs' | 'budgets' | 'saas_radar' | 'analyst' | 'analytics' | 'exports'
  >('my_claims');

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<string>('all');
  const [analyticsYear, setAnalyticsYear] = useState<number>(new Date().getFullYear());

  // Batch Payout State
  const [selectedBatchClaims, setSelectedBatchClaims] = useState<string[]>([]);
  const [batchPayoutRef, setBatchPayoutRef] = useState<string>('');
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Bank Export Format
  const [isBankExportModalOpen, setIsBankExportModalOpen] = useState(false);

  // Modals
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectExpenseId, setRejectExpenseId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [isReimburseModalOpen, setIsReimburseModalOpen] = useState(false);
  const [reimburseExpenseId, setReimburseExpenseId] = useState<string | null>(null);
  const [payoutReference, setPayoutReference] = useState<string>('');
  const [reimburseMethod, setReimburseMethod] = useState<string>('direct_bank');
  const [batchPayoutMethod, setBatchPayoutMethod] = useState<string>('direct_bank');

  // Pillar 3: Multi-Tier Approvals & Rapid Review State
  const [selectedApprovalClaims, setSelectedApprovalClaims] = useState<string[]>([]);
  const [isRapidReviewOpen, setIsRapidReviewOpen] = useState(false);
  const [rapidReviewIndex, setRapidReviewIndex] = useState(0);
  const [rapidReviewNote, setRapidReviewNote] = useState('');
  const [viewingAuditClaim, setViewingAuditClaim] = useState<ExpenseClaimItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // --- PILLAR 1: SMART EXPENSE COMPOSER STATE ---
  const [composerMode, setComposerMode] = useState<'receipt' | 'mileage' | 'per_diem' | 'bulk'>('receipt');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptRotation, setReceiptRotation] = useState<number>(0);
  const [receiptZoom, setReceiptZoom] = useState<number>(1);
  const [isDropzoneActive, setIsDropzoneActive] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Mileage Calculator State
  const [mileageDistance, setMileageDistance] = useState<string>('25');
  const [mileageUnit, setMileageUnit] = useState<'miles' | 'km'>('miles');
  const [mileageStart, setMileageStart] = useState<string>('');
  const [mileageEnd, setMileageEnd] = useState<string>('');
  const [mileageIsRoundTrip, setMileageIsRoundTrip] = useState<boolean>(false);
  const [mileageVehicleType, setMileageVehicleType] = useState<string>('Personal Automobile');

  // Per-Diem Calculator State
  const [perDiemDays, setPerDiemDays] = useState<string>('3');
  const [perDiemDestination, setPerDiemDestination] = useState<string>('metro');
  const [perDiemTripPurpose, setPerDiemTripPurpose] = useState<string>('Client On-Site Review');

  // Bulk Multi-Receipt State
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkScanning, setBulkScanning] = useState<boolean>(false);
  const [bulkScanResults, setBulkScanResults] = useState<any[]>([]);
  const [bulkActiveIndex, setBulkActiveIndex] = useState<number>(0);

  // Claim Form State
  const [claimTitle, setClaimTitle] = useState('');
  const [claimMerchant, setClaimMerchant] = useState('');
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
  const [claimCategory, setClaimCategory] = useState('other');
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [claimCurrency, setClaimCurrency] = useState('USD');
  const [claimTaxAmount, setClaimTaxAmount] = useState<string>('0.00');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimDepartmentId, setClaimDepartmentId] = useState<string>('');
  const [claimProjectId, setClaimProjectId] = useState<string>('');
  const [claimClientName, setClaimClientName] = useState('');
  const [claimIsBillable, setClaimIsBillable] = useState(false);
  const [claimReceiptFile, setClaimReceiptFile] = useState<File | null>(null);
  const [claimOCRData, setClaimOCRData] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
  const [policyHardBlocks, setPolicyHardBlocks] = useState<string[]>([]);
  const [duplicateMatchInfo, setDuplicateMatchInfo] = useState<any | null>(null);

  // Budget Form State
  const [budgetTargetType, setBudgetTargetType] = useState<'department' | 'project'>('department');
  const [budgetDeptId, setBudgetDeptId] = useState<string>('');
  const [budgetProjId, setBudgetProjId] = useState<string>('');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetCurrency, setBudgetCurrency] = useState('USD');
  const [budgetThreshold, setBudgetThreshold] = useState<number>(80);
  const [budgetNotes, setBudgetNotes] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // OCR Upload State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);

  // Multi-Currency Live Exchange Rates
  const { data: exchangeRateData } = useQuery<any>({
    queryKey: ['exchangeRates'],
    queryFn: () => api.get('/expenses/exchange-rates/'),
    staleTime: 1000 * 60 * 30,
  });

  const currentRate = useMemo(() => {
    if (!exchangeRateData?.rates) return 1.0;
    return exchangeRateData.rates[claimCurrency] || 1.0;
  }, [exchangeRateData, claimCurrency]);

  const convertedEstimatedAmount = useMemo(() => {
    const amt = parseFloat(claimAmount) || 0;
    if (claimCurrency === 'USD') return amt;
    return (amt * currentRate).toFixed(2);
  }, [claimAmount, claimCurrency, currentRate]);

  // Queries
  const { data: summary, isLoading: isSummaryLoading } = useQuery<ExpenseSummaryData>({
    queryKey: ['expenseSummary'],
    queryFn: () => api.get('/expenses/my-summary/'),
  });

  const { data: claims, isLoading: isClaimsLoading } = useQuery<any>({
    queryKey: ['myClaims', filterStatus, filterCategory, filterProject, searchQuery],
    queryFn: () => {
      const qs = new URLSearchParams({ all: 'true' });
      if (filterStatus && filterStatus !== 'all') qs.append('status', filterStatus);
      if (filterCategory && filterCategory !== 'all') qs.append('category', filterCategory);
      if (filterProject && filterProject !== 'all') qs.append('project', filterProject);
      if (searchQuery.trim()) qs.append('search', searchQuery.trim());
      return api.get(`/expenses/?${qs.toString()}`);
    },
  });

  const { data: approvalClaims, isLoading: isApprovalsLoading } = useQuery<any>({
    queryKey: ['approvalClaims', approvalFilterStatus],
    queryFn: () => {
      const qs = new URLSearchParams({ all: 'true' });
      if (approvalFilterStatus && approvalFilterStatus !== 'all') qs.append('status', approvalFilterStatus);
      return api.get(`/expenses/?${qs.toString()}`);
    },
    enabled: isManagerOrAdmin,
  });

  const { data: projectCosts, isLoading: isProjectCostsLoading } = useQuery<any>({
    queryKey: ['projectCosts'],
    queryFn: () => api.get('/expenses/project-costs/'),
    enabled: activeTab === 'project_costs' || isManagerOrAdmin,
  });

  const { data: spendBudgets, isLoading: isBudgetsLoading } = useQuery<any>({
    queryKey: ['spendBudgets'],
    queryFn: () => api.get('/expenses/budgets/'),
    enabled: activeTab === 'budgets' || isManagerOrAdmin,
  });

  const { data: saasRadar, isLoading: isSaasRadarLoading } = useQuery<any>({
    queryKey: ['subscriptionRadar'],
    queryFn: () => api.get('/expenses/subscription-radar/'),
    enabled: activeTab === 'saas_radar' || isManagerOrAdmin,
  });

  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery<SpendAnalyticsData>({
    queryKey: ['spendAnalytics', analyticsYear],
    queryFn: () => api.get(`/expenses/analytics/?year=${analyticsYear}`),
    enabled: isHRorAdmin,
  });

  const { data: projectList } = useQuery<any>({
    queryKey: ['projectsAll'],
    queryFn: () => api.get('/projects/?all=true'),
  });

  const { data: departmentList } = useQuery<any>({
    queryKey: ['departmentsAll'],
    queryFn: () => api.get('/teams/departments/'),
  });

  // Safe Array Extractions (Prevents pagination object crash)
  const claimItems: ExpenseClaimItem[] = useMemo(() => {
    if (!claims) return [];
    const raw = claims?.results || claims;
    return Array.isArray(raw) ? raw : [];
  }, [claims]);

  const approvalItems: ExpenseClaimItem[] = useMemo(() => {
    if (!approvalClaims) return [];
    const raw = approvalClaims?.results || approvalClaims;
    return Array.isArray(raw) ? raw : [];
  }, [approvalClaims]);

  // Pillar 3: Multi-Tier Approval Metrics & Memos
  const pendingApprovalClaims = useMemo(() => {
    return approvalItems.filter((c: ExpenseClaimItem) => ['submitted', 'under_review'].includes(c.status));
  }, [approvalItems]);

  const pendingApprovalTotal = useMemo(() => {
    return pendingApprovalClaims.reduce((acc, c) => acc + (parseFloat(String(c.amount_converted || c.amount)) || 0), 0);
  }, [pendingApprovalClaims]);

  const directReportsCount = useMemo(() => {
    return new Set(pendingApprovalClaims.map((c) => c.employee_name || c.employee_id)).size;
  }, [pendingApprovalClaims]);

  const compliantPendingClaims = useMemo(() => {
    return pendingApprovalClaims.filter((c) => !c.policy_violations || c.policy_violations.length === 0);
  }, [pendingApprovalClaims]);

  const tier1Count = useMemo(() => {
    return pendingApprovalClaims.filter((c) => (parseFloat(String(c.amount_converted || c.amount)) || 0) < 100).length;
  }, [pendingApprovalClaims]);

  const tier2Count = useMemo(() => {
    return pendingApprovalClaims.filter((c) => {
      const a = parseFloat(String(c.amount_converted || c.amount)) || 0;
      return a >= 100 && a <= 1000;
    }).length;
  }, [pendingApprovalClaims]);

  const tier3Count = useMemo(() => {
    return pendingApprovalClaims.filter((c) => (parseFloat(String(c.amount_converted || c.amount)) || 0) > 1000).length;
  }, [pendingApprovalClaims]);

  const renderLifecycleStepper = (status: string) => {
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
          <XCircle className="h-3 w-3" /> Rejected
        </span>
      );
    }

    const stepOrder = ['draft', 'submitted', 'under_review', 'approved', 'payment_queued', 'reimbursed'];
    const currentIndex = Math.max(0, stepOrder.indexOf(status));

    return (
      <div className="flex items-center gap-1 text-[10px] flex-wrap">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <React.Fragment key={step.key}>
              {idx > 0 && (
                <span className={`text-[9px] ${idx <= currentIndex ? 'text-emerald-500 font-bold' : 'text-slate-300 dark:text-slate-700'}`}>
                  ➔
                </span>
              )}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  isCurrent
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-xs'
                    : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-600 font-normal'
                }`}
              >
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const projectCostItems: ProjectCostData[] = useMemo(() => {
    if (!projectCosts) return [];
    const raw = projectCosts?.results || projectCosts;
    return Array.isArray(raw) ? raw : [];
  }, [projectCosts]);

  const budgetItems: SpendBudgetData[] = useMemo(() => {
    if (!spendBudgets) return [];
    const raw = spendBudgets?.results || spendBudgets;
    return Array.isArray(raw) ? raw : [];
  }, [spendBudgets]);

  const subscriptionItems = useMemo(() => {
    if (!saasRadar?.subscriptions) return [];
    return Array.isArray(saasRadar.subscriptions) ? saasRadar.subscriptions : [];
  }, [saasRadar]);

  const projects = useMemo(() => {
    if (!projectList) return [];
    const raw = projectList?.results || projectList;
    return Array.isArray(raw) ? raw : [];
  }, [projectList]);

  const departments = useMemo(() => {
    if (!departmentList) return [];
    const raw = departmentList?.results || departmentList;
    return Array.isArray(raw) ? raw : [];
  }, [departmentList]);

  const categoryList = useMemo(() => {
    if (!analytics?.by_category) return [];
    return Array.isArray(analytics.by_category) ? analytics.by_category : [];
  }, [analytics]);

  const merchantList = useMemo(() => {
    if (!analytics?.top_merchants) return [];
    return Array.isArray(analytics.top_merchants) ? analytics.top_merchants : [];
  }, [analytics]);

  // Mutations
  const createClaimMutation = useMutation({
    mutationFn: (formData: FormData) => api.post('/expenses/', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptionRadar'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setIsClaimModalOpen(false);
      resetClaimForm();
    },
    onError: (err: any) => {
      setFormError(extractErrorMessage(err));
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/budgets/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      setIsBudgetModalOpen(false);
      setBudgetAmount('');
      setBudgetNotes('');
      setBudgetError(null);
    },
    onError: (err: any) => {
      setBudgetError(extractErrorMessage(err));
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/budgets/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (payload: string | { id: string; notes?: string }) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      const notes = typeof payload === 'string' ? '' : (payload.notes || '');
      return api.post(`/expenses/${id}/approve/`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Approval Failed',
        description: extractErrorMessage(err) || 'Failed to approve claim.',
        variant: 'destructive',
      });
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: (data: { claim_ids: string[]; notes?: string }) =>
      api.post('/expenses/batch-approve/', data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setSelectedApprovalClaims([]);
      coreAlert({
        title: 'Batch Approval Processed',
        description: data.message || `Successfully approved ${data.count} expense claim(s).`,
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Batch Approval Failed',
        description: extractErrorMessage(err) || 'Failed to batch approve claims.',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/expenses/${id}/reject/`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setIsRejectModalOpen(false);
      setRejectExpenseId(null);
      setRejectReason('');
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Rejection Failed',
        description: extractErrorMessage(err) || 'Failed to reject claim.',
        variant: 'destructive',
      });
    },
  });

  const reimburseMutation = useMutation({
    mutationFn: ({ id, ref, method }: { id: string; ref: string; method?: string }) =>
      api.post(`/expenses/${id}/reimburse/`, {
        payout_reference: ref,
        settlement_method: method || 'direct_bank',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setIsReimburseModalOpen(false);
      setReimburseExpenseId(null);
      setPayoutReference('');
      setReimburseMethod('direct_bank');
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Reimbursement Failed',
        description: extractErrorMessage(err) || 'Failed to process reimbursement.',
        variant: 'destructive',
      });
    },
  });

  const batchPayoutMutation = useMutation({
    mutationFn: (data: { claim_ids: string[]; payout_reference: string; settlement_method?: string }) =>
      api.post('/expenses/batch-payout/', data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setSelectedBatchClaims([]);
      setBatchPayoutRef('');
      setBatchPayoutMethod('direct_bank');
      setBatchSuccessMessage(data.message || 'Batch payout completed successfully!');
      setTimeout(() => setBatchSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Payout Failed',
        description: extractErrorMessage(err) || 'Failed to process batch payout.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClaims'] });
      queryClient.invalidateQueries({ queryKey: ['approvalClaims'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      queryClient.invalidateQueries({ queryKey: ['projectCosts'] });
      queryClient.invalidateQueries({ queryKey: ['spendBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['spendAnalytics'] });
      setIsDeleteModalOpen(false);
      setDeleteExpenseId(null);
    },
  });

  const resetClaimForm = () => {
    setComposerMode('receipt');
    setReceiptPreviewUrl(null);
    setReceiptRotation(0);
    setReceiptZoom(1);
    setIsDropzoneActive(false);
    setCopiedToken(null);
    setClaimTitle('');
    setClaimMerchant('');
    setClaimDate(new Date().toISOString().split('T')[0]);
    setClaimCategory('other');
    setClaimAmount('');
    setClaimCurrency('USD');
    setClaimTaxAmount('0.00');
    setClaimDescription('');
    setClaimDepartmentId('');
    setClaimProjectId('');
    setClaimClientName('');
    setClaimIsBillable(false);
    setClaimReceiptFile(null);
    setClaimOCRData(null);
    setFormError(null);
    setPolicyWarnings([]);
    setPolicyHardBlocks([]);
    setDuplicateMatchInfo(null);
    setOcrFile(null);
    setOcrScanning(false);
    setOcrResult(null);
    setBulkFiles([]);
    setBulkScanning(false);
    setBulkScanResults([]);
    setBulkActiveIndex(0);
  };

  // Real-time Policy Guard Check with parameters
  const checkPolicyGuardWithParams = async (
    amt: string | number,
    curr: string,
    dt: string,
    cat: string,
    merch: string,
    hash?: string,
    customOcrData?: any
  ) => {
    if (!amt || parseFloat(String(amt)) <= 0) return;
    try {
      const formData = new FormData();
      formData.append('amount', String(amt));
      formData.append('currency', curr);
      formData.append('expense_date', dt);
      formData.append('category', cat);
      formData.append('merchant', merch);
      if (claimReceiptFile) {
        formData.append('receipt_file', claimReceiptFile);
      }
      if (hash || claimOCRData?.receipt_hash) {
        formData.append('receipt_hash', hash || claimOCRData.receipt_hash);
      }
      const activeOcr = customOcrData || claimOCRData;
      if (activeOcr) {
        formData.append('ocr_data', JSON.stringify(activeOcr));
      }
      const res: any = await api.post('/expenses/policy-check/', formData);
      setPolicyWarnings(res.soft_warnings || res.violations || []);
      setPolicyHardBlocks(res.hard_blocks || []);
      setDuplicateMatchInfo(res.duplicate_match || null);
    } catch (e) {
      console.error(e);
    }
  };

  // Real-time Policy Guard Check
  const checkPolicyGuard = async () => {
    checkPolicyGuardWithParams(claimAmount, claimCurrency, claimDate, claimCategory, claimMerchant);
  };

  // Process Receipt File (OCR with Gemini Vision)
  const handleProcessReceiptFile = async (file: File) => {
    setOcrFile(file);
    setClaimReceiptFile(file);
    setReceiptRotation(0);
    setReceiptZoom(1);

    const preview = URL.createObjectURL(file);
    setReceiptPreviewUrl(preview);

    setOcrScanning(true);
    setOcrResult(null);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const resp: any = await api.post('/expenses/scan-receipt/', formData);
      setOcrResult(resp);
      setClaimOCRData(resp);

      if (resp.title) setClaimTitle(resp.title);
      if (resp.merchant) setClaimMerchant(resp.merchant);
      if (resp.expense_date) setClaimDate(resp.expense_date);
      if (resp.category) setClaimCategory(resp.category);
      if (resp.amount) setClaimAmount(String(resp.amount));
      if (resp.currency) setClaimCurrency(resp.currency);
      if (resp.tax_amount !== undefined) setClaimTaxAmount(String(resp.tax_amount));
      if (resp.summary) setClaimDescription(resp.summary);

      if (resp.amount) {
        checkPolicyGuardWithParams(
          resp.amount,
          resp.currency || 'USD',
          resp.expense_date || claimDate,
          resp.category || 'other',
          resp.merchant || '',
          resp.receipt_hash,
          resp
        );
      }
    } catch (err: any) {
      coreAlert({
        title: 'OCR Notice',
        description: extractErrorMessage(err) || 'Could not auto-extract fields. Please fill details manually.',
        variant: 'destructive',
      });
    } finally {
      setOcrScanning(false);
    }
  };

  // Batch Multi-Receipt Processing
  const handleBatchScan = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, 10);
    if (fileArray.length === 0) return;

    setBulkFiles(fileArray);
    setBulkScanning(true);
    setBulkScanResults([]);
    setComposerMode('bulk');

    const formData = new FormData();
    fileArray.forEach((f) => formData.append('receipts', f));

    try {
      const resp: any = await api.post('/expenses/scan-receipt-batch/', formData);
      setBulkScanResults(resp.results || []);
    } catch (err: any) {
      coreAlert({
        title: 'Batch Scan Failed',
        description: extractErrorMessage(err) || 'Failed to process batch receipts.',
        variant: 'destructive',
      });
    } finally {
      setBulkScanning(false);
    }
  };

  // Mileage Reimbursement Auto-Calculation Effect
  React.useEffect(() => {
    if (composerMode === 'mileage') {
      const dist = parseFloat(mileageDistance) || 0;
      const effectiveDist = mileageIsRoundTrip ? dist * 2 : dist;
      const rate = mileageUnit === 'miles' 
        ? (exchangeRateData?.mileage_policy?.rate_per_mile_usd || 0.67) 
        : (exchangeRateData?.mileage_policy?.rate_per_km_usd || 0.42);
      const total = (effectiveDist * rate).toFixed(2);
      setClaimAmount(total);
      setClaimCurrency('USD');
      setClaimCategory('travel_transport');
      setClaimMerchant('Personal Vehicle Mileage');
      setClaimTitle(`Mileage Reimbursement: ${effectiveDist} ${mileageUnit}${mileageStart && mileageEnd ? ` (${mileageStart} ➔ ${mileageEnd})` : ''}`);
      setClaimDescription(`Mileage Travel Claim: ${effectiveDist} ${mileageUnit} @ $${rate}/${mileageUnit}. Vehicle: ${mileageVehicleType}.${mileageStart ? ` Route: ${mileageStart} to ${mileageEnd}` : ''}${mileageIsRoundTrip ? ' (Round-trip)' : ''}`);
    }
  }, [composerMode, mileageDistance, mileageUnit, mileageIsRoundTrip, mileageStart, mileageEnd, mileageVehicleType, exchangeRateData]);

  // Per-Diem Allowance Auto-Calculation Effect
  React.useEffect(() => {
    if (composerMode === 'per_diem') {
      const days = parseInt(perDiemDays, 10) || 1;
      let dailyRate = exchangeRateData?.per_diem_policy?.default_daily_rate_usd || 75.0;
      if (perDiemDestination === 'metro') {
        dailyRate = exchangeRateData?.per_diem_policy?.metro_daily_rate_usd || 110.0;
      } else if (perDiemDestination === 'international') {
        dailyRate = exchangeRateData?.per_diem_policy?.international_daily_rate_usd || 140.0;
      }
      const total = (days * dailyRate).toFixed(2);
      setClaimAmount(total);
      setClaimCurrency('USD');
      setClaimCategory('meals_entertainment');
      setClaimMerchant('Standard Business Per-Diem');
      setClaimTitle(`Per-Diem Allowance: ${days} Days (${perDiemDestination.toUpperCase()})`);
      setClaimDescription(`Corporate Per-Diem Allowance: ${days} days @ $${dailyRate}/day (${perDiemDestination} rate). Purpose: ${perDiemTripPurpose}.`);
    }
  }, [composerMode, perDiemDays, perDiemDestination, perDiemTripPurpose, exchangeRateData]);

  // Global Clipboard (Ctrl+V) Paste Listener for Receipts
  React.useEffect(() => {
    if (!isClaimModalOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const pastedFile = new File([blob], `pasted_receipt_${Date.now()}.png`, { type: blob.type });
            setComposerMode('receipt');
            handleProcessReceiptFile(pastedFile);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isClaimModalOpen]);

  // Global Keyboard Shortcut ('c' to create new expense)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      if (e.key === 'c' && !isClaimModalOpen && !isOCRModalOpen) {
        e.preventDefault();
        resetClaimForm();
        setIsClaimModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClaimModalOpen, isOCRModalOpen]);

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!claimTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!claimAmount || parseFloat(claimAmount) <= 0) {
      setFormError('Please enter a valid expense amount.');
      return;
    }

    // 🛑 Pillar 2 Hard Block Enforcement
    if (policyHardBlocks.length > 0) {
      setFormError(`Submission Blocked by Corporate Policy: ${policyHardBlocks[0]}`);
      return;
    }

    // ⚠️ Mandatory justification if policy warnings exist
    if (policyWarnings.length > 0 && !claimDescription.trim()) {
      setFormError('Corporate policy requires a written business justification in Notes for this expense.');
      return;
    }

    const formData = new FormData();
    formData.append('title', claimTitle);
    formData.append('merchant', claimMerchant);
    formData.append('expense_date', claimDate);
    formData.append('category', claimCategory);
    formData.append('amount', claimAmount);
    formData.append('currency', claimCurrency);
    formData.append('tax_amount', claimTaxAmount || '0.00');
    formData.append('description', claimDescription);
    if (claimDepartmentId) {
      formData.append('department_id', claimDepartmentId);
    }
    if (claimProjectId) {
      formData.append('project_id', claimProjectId);
    }
    if (claimClientName) {
      formData.append('client_name', claimClientName);
    }
    formData.append('is_billable', String(claimIsBillable));
    if (claimReceiptFile) {
      formData.append('receipt_file', claimReceiptFile);
    }
    if (claimOCRData) {
      formData.append('ocr_raw_data', JSON.stringify(claimOCRData));
    }

    createClaimMutation.mutate(formData);
  };

  const handleRunOCR = async () => {
    if (!ocrFile) return;
    handleProcessReceiptFile(ocrFile);
  };

  const handleAcceptOCR = () => {
    if (!ocrResult) return;
    setIsOCRModalOpen(false);
    setIsClaimModalOpen(true);
  };

  const handleDownloadCSV = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(getApiUrl(`/expenses/export-csv/?year=${analyticsYear}`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export expenses CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      coreAlert({
        title: 'Export Failed',
        description: extractErrorMessage(err) || 'Failed to export CSV.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadBankPayout = async (fmt: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(getApiUrl(`/expenses/export-payout/?payout_format=${fmt}&format=${fmt}`), {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.detail || 'Failed to export bank payout file');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fmt}_batch_payout_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setIsBankExportModalOpen(false);
    } catch (err: any) {
      coreAlert({
        title: 'Payout Export Failed',
        description: extractErrorMessage(err) || 'Failed to download bank payout file.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetError(null);
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      setBudgetError('Please enter a valid budget amount.');
      return;
    }
    if (budgetTargetType === 'department' && !budgetDeptId) {
      setBudgetError('Please select a department.');
      return;
    }
    if (budgetTargetType === 'project' && !budgetProjId) {
      setBudgetError('Please select a project.');
      return;
    }

    createBudgetMutation.mutate({
      target_type: budgetTargetType,
      department_id: budgetTargetType === 'department' ? budgetDeptId : null,
      project_id: budgetTargetType === 'project' ? budgetProjId : null,
      period: budgetPeriod,
      amount: parseFloat(budgetAmount),
      currency: budgetCurrency,
      alert_threshold_percent: budgetThreshold,
      notes: budgetNotes,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Expenses & Finance Operations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            AI Gemini receipt OCR, cross-department budget guardrails, project profitability margins, and 1-click global bank payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {isHRorAdmin && (
            <Button
              onClick={() => setIsBankExportModalOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 shadow-xs flex-1 sm:flex-none h-8 sm:h-9 border-slate-300 dark:border-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              1-Click Bank Payout Export
            </Button>
          )}

          <Button
            onClick={() => {
              resetClaimForm();
              setComposerMode('receipt');
              setIsClaimModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10 text-xs font-semibold gap-1.5 shadow-xs flex-1 sm:flex-none h-8 sm:h-9"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Scan Receipt with AI
          </Button>

          <Button
            onClick={() => {
              resetClaimForm();
              setComposerMode('bulk');
              setIsClaimModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-semibold gap-1.5 shadow-xs flex-1 sm:flex-none h-8 sm:h-9"
          >
            <Files className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Bulk Receipts (⚡)
          </Button>

          <Button
            onClick={() => {
              resetClaimForm();
              setComposerMode('receipt');
              setIsClaimModalOpen(true);
            }}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-xs flex-1 sm:flex-none h-8 sm:h-9"
          >
            <Plus className="h-4 w-4" />
            File Claim
          </Button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Reimbursed YTD */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-xl sm:rounded-2xl p-3 sm:p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Reimbursed (YTD)
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
              ${(summary?.reimbursed_ytd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Paid out this calendar year</div>
          </div>
        </Card>

        {/* Pending Approval */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-xl sm:rounded-2xl p-3 sm:p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              In Review
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
              ${(summary?.pending_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
              {summary?.pending_count || 0} claims pending approval
            </div>
          </div>
        </Card>

        {/* Approved (Awaiting Payout) */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-xl sm:rounded-2xl p-3 sm:p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Approved
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
              ${(summary?.approved_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Ready for bank batch payout</div>
          </div>
        </Card>

        {/* Total Claims Filed */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-xl sm:rounded-2xl p-3 sm:p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Total Claims
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
              {summary?.total_claims_count || 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Filed across your organization</div>
          </div>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border pb-1 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('my_claims')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'my_claims'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Receipt className="h-4 w-4" />
          My Claims
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
              activeTab === 'approvals'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            Approvals Queue
            {approvalItems.filter((c: any) => c.status === 'submitted').length > 0 && (
              <span className="h-4 w-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-extrabold ml-1">
                {approvalItems.filter((c: any) => c.status === 'submitted').length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('project_costs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'project_costs'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Target className="h-4 w-4 text-amber-500" />
          Project Profitability
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'budgets'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="h-4 w-4 text-emerald-500" />
          Spend Budgets
        </button>

        <button
          onClick={() => setActiveTab('saas_radar')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'saas_radar'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Laptop className="h-4 w-4 text-indigo-500" />
          SaaS Radar
        </button>

        <button
          onClick={() => setActiveTab('analyst')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'analyst'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-sky-500" />
          AI Spreadsheet Analyst
        </button>

        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Spend Analytics
          </button>
        )}

        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('exports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'exports'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Download className="h-4 w-4" />
            Batch Payouts
          </button>
        )}
      </div>

      {/* ─────────────────── TAB 1: My Expenses & Claims ─────────────────── */}
      {activeTab === 'my_claims' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl">
          <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Submitted Expense Claims
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track status, attached receipts, project tags, and policy compliance.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search merchant or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950 w-40 h-8"
              />

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">In Review</option>
                <option value="approved">Approved</option>
                <option value="reimbursed">Paid / Reimbursed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isClaimsLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading your claims...</div>
            ) : claimItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <CreditCard className="h-8 w-8 mx-auto text-slate-400" />
                <p className="text-xs">No expense claims found matching this filter.</p>
                <Button
                  onClick={() => setIsClaimModalOpen(true)}
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  File Your First Expense Claim
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {claimItems.map((claim: ExpenseClaimItem) => {
                  const meta = CATEGORY_META[claim.category] || CATEGORY_META.other;
                  const Icon = meta.icon;
                  const badge = STATUS_BADGES[claim.status] || STATUS_BADGES.submitted;

                  return (
                    <div
                      key={claim.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`h-10 w-10 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 border ${meta.border}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {claim.title}
                            </span>
                            {claim.merchant && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {claim.merchant}
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                            {claim.approval_tier && APPROVAL_TIER_META[claim.approval_tier] && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${APPROVAL_TIER_META[claim.approval_tier].bg} ${APPROVAL_TIER_META[claim.approval_tier].text} ${APPROVAL_TIER_META[claim.approval_tier].border}`}
                              >
                                {APPROVAL_TIER_META[claim.approval_tier].label}
                              </span>
                            )}
                            {claim.settlement_method_display && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                                💳 {claim.settlement_method_display}
                              </span>
                            )}
                            {claim.project_name && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {claim.project_name}
                              </span>
                            )}
                            {claim.department_name && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {claim.department_name}
                              </span>
                            )}
                            {claim.is_billable && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                                Billable {claim.client_name ? `(${claim.client_name})` : ''}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>{claim.expense_date}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.label}</span>
                            {claim.tax_amount > 0 && (
                              <>
                                <span>•</span>
                                <span>Tax: ${claim.tax_amount}</span>
                              </>
                            )}
                            <span>•</span>
                            {renderLifecycleStepper(claim.status)}
                          </div>

                          {claim.policy_violations && claim.policy_violations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {claim.policy_violations.map((v, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 flex items-center gap-1"
                                >
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  {v.split(':')[0]}
                                </span>
                              ))}
                            </div>
                          )}

                          {claim.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic pt-0.5">
                              "{claim.description}"
                            </p>
                          )}

                          {claim.status === 'rejected' && claim.rejection_reason && (
                            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs">
                              <strong>Rejection reason:</strong> {claim.rejection_reason}
                            </div>
                          )}

                          {claim.status === 'reimbursed' && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Reimbursed on {claim.reimbursed_at ? claim.reimbursed_at.split('T')[0] : 'recent'}
                              {claim.payout_reference && ` (Ref: ${claim.payout_reference})`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side: Amount & Actions */}
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-base font-extrabold text-slate-900 dark:text-white">
                            {claim.amount} {claim.currency}
                          </div>
                          {claim.currency !== 'USD' && (
                            <div className="text-[11px] text-slate-400">
                              ≈ ${claim.amount_converted} USD
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setViewingAuditClaim(claim)}
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="View Approval History & Audit Trail"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {claim.receipt_file_url && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setPreviewReceiptUrl(claim.receipt_file_url)}
                              className="h-8 w-8 text-slate-600 hover:text-slate-900"
                              title="View Attached Receipt"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}

                          {['draft', 'submitted'].includes(claim.status) && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setDeleteExpenseId(claim.id);
                                setIsDeleteModalOpen(true);
                              }}
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Claim"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─────────────────── TAB 2: Approvals Queue & Multi-Tier Governance ─────────────────── */}
      {activeTab === 'approvals' && isManagerOrAdmin && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* ── Executive Digest Banner ── */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-r from-primary/10 via-primary/5 to-emerald-500/10 p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                    Executive Digest
                  </span>
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" /> Autonomous Multi-Tier Approval Engine
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  You have <span className="text-primary font-black">{pendingApprovalClaims.length}</span> pending claims totaling{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    ${safeToFixed(pendingApprovalTotal)}
                  </span>{' '}
                  from <span className="font-black text-slate-900 dark:text-white">{directReportsCount}</span> direct reports.
                </h3>
                <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 font-semibold text-[11px]">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {compliantPendingClaims.length} Compliant (0 Warnings)
                  </span>
                  {pendingApprovalClaims.length - compliantPendingClaims.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 font-semibold text-[11px]">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      {pendingApprovalClaims.length - compliantPendingClaims.length} Policy Alerts
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium">
                    &lt; $100: <strong className="font-bold">{tier1Count}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium">
                    $100 - $1,000: <strong className="font-bold">{tier2Count}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium">
                    &gt; $1,000 (CFO): <strong className="font-bold">{tier3Count}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <Button
                  onClick={() => {
                    setRapidReviewIndex(0);
                    setIsRapidReviewOpen(true);
                  }}
                  disabled={pendingApprovalClaims.length === 0}
                  variant="outline"
                  className="text-xs font-bold gap-1.5 border-primary/40 hover:bg-primary/10 shadow-xs"
                >
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  Rapid Review Carousel
                </Button>

                <Button
                  onClick={() => {
                    if (compliantPendingClaims.length === 0) return;
                    batchApproveMutation.mutate({
                      claim_ids: compliantPendingClaims.map((c) => c.id),
                      notes: 'Executive Digest: 1-Click Batch Approval for policy-compliant claims',
                    });
                  }}
                  disabled={compliantPendingClaims.length === 0 || batchApproveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                >
                  {batchApproveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  Approve All Compliant ({compliantPendingClaims.length})
                </Button>

                {selectedApprovalClaims.length > 0 && (
                  <Button
                    onClick={() => {
                      batchApproveMutation.mutate({
                        claim_ids: selectedApprovalClaims,
                        notes: 'Batch approved selected claims by reviewer',
                      });
                    }}
                    disabled={batchApproveMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                  >
                    <Check className="h-4 w-4" />
                    Approve Selected ({selectedApprovalClaims.length})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl">
            <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Team Expense Approvals & Governance
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Threshold routing: &lt; $100 auto/single-click, $100–$1,000 manager + dept head, &gt; $1,000 finance review.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {pendingApprovalClaims.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedApprovalClaims.length === pendingApprovalClaims.length) {
                        setSelectedApprovalClaims([]);
                      } else {
                        setSelectedApprovalClaims(pendingApprovalClaims.map((c) => c.id));
                      }
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    {selectedApprovalClaims.length === pendingApprovalClaims.length
                      ? 'Deselect All'
                      : 'Select All Pending'}
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Status:</span>
                  <select
                    value={approvalFilterStatus}
                    onChange={(e) => setApprovalFilterStatus(e.target.value)}
                    className="text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
                  >
                    <option value="all">All Claims</option>
                    <option value="submitted">Submitted (Needs Approval)</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved (Awaiting Payout)</option>
                    <option value="payment_queued">Payment Queued</option>
                    <option value="reimbursed">Settled / Reimbursed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isApprovalsLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading claims for review...</div>
              ) : approvalItems.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                  <p className="text-xs font-semibold">No claims pending action.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {approvalItems.map((claim: ExpenseClaimItem) => {
                    const meta = CATEGORY_META[claim.category] || CATEGORY_META.other;
                    const Icon = meta.icon;
                    const badge = STATUS_BADGES[claim.status] || STATUS_BADGES.submitted;
                    const tierMeta = claim.approval_tier
                      ? APPROVAL_TIER_META[claim.approval_tier]
                      : APPROVAL_TIER_META.manager_review;
                    const isPending = ['submitted', 'under_review'].includes(claim.status);
                    const isSelected = selectedApprovalClaims.includes(claim.id);

                    return (
                      <div
                        key={claim.id}
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedApprovalClaims((prev) => prev.filter((id) => id !== claim.id));
                                } else {
                                  setSelectedApprovalClaims((prev) => [...prev, claim.id]);
                                }
                              }}
                              className="mt-2.5 h-4 w-4 rounded-md border-slate-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                            />
                          )}

                          <div className={`h-10 w-10 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 border ${meta.border}`}>
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {claim.employee_name}
                              </span>
                              {claim.department_name && (
                                <span className="text-xs text-slate-400 font-medium">
                                  ({claim.department_name})
                                </span>
                              )}
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                {badge.label}
                              </span>
                              {tierMeta && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tierMeta.bg} ${tierMeta.text} ${tierMeta.border}`}
                                >
                                  {tierMeta.label}
                                </span>
                              )}
                              {claim.settlement_method_display && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                                  💳 {claim.settlement_method_display}
                                </span>
                              )}
                              {claim.approval_tier && APPROVAL_TIER_META[claim.approval_tier] && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${APPROVAL_TIER_META[claim.approval_tier].bg} ${APPROVAL_TIER_META[claim.approval_tier].text} ${APPROVAL_TIER_META[claim.approval_tier].border}`}
                              >
                                {APPROVAL_TIER_META[claim.approval_tier].label}
                              </span>
                            )}
                            {claim.settlement_method_display && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                                💳 {claim.settlement_method_display}
                              </span>
                            )}
                            {claim.project_name && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                  🎯 {claim.project_name}
                                </span>
                              )}
                              {claim.is_billable && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                                  Billable
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {claim.title} {claim.merchant && `• ${claim.merchant}`}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                              <span>{claim.expense_date}</span>
                              <span>•</span>
                              <span>{meta.label}</span>
                              <span>•</span>
                              {renderLifecycleStepper(claim.status)}
                            </div>

                            {/* AI Policy Violations Banner in Approval Queue */}
                            {claim.policy_violations && claim.policy_violations.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-1">
                                <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                  AI Policy Warnings ({claim.policy_violations.length})
                                </div>
                                <ul className="text-[10px] text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                                  {claim.policy_violations.map((v, i) => (
                                    <li key={i}>{v}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {claim.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                                "{claim.description}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Amount & Actions */}
                        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                          <div className="text-right pr-2">
                            <div className="text-base font-extrabold text-slate-900 dark:text-white">
                              {claim.amount} {claim.currency}
                            </div>
                            {claim.currency !== 'USD' && (
                              <div className="text-[11px] text-slate-400">
                                ≈ ${claim.amount_converted} USD
                              </div>
                            )}
                          </div>

                          {/* Audit Trail Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingAuditClaim(claim)}
                            className="text-xs font-semibold gap-1 text-slate-500 hover:text-slate-900"
                            title="View Full Approval History & Audit Trail"
                          >
                            <History className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden md:inline">History</span>
                          </Button>

                          {claim.receipt_file_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewReceiptUrl(claim.receipt_file_url)}
                              className="text-xs font-semibold gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Receipt
                            </Button>
                          )}

                          {isPending && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRejectExpenseId(claim.id);
                                  setRejectReason('');
                                  setIsRejectModalOpen(true);
                                }}
                                className="text-xs font-semibold text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(claim.id)}
                                disabled={approveMutation.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                              >
                                Approve
                              </Button>
                            </>
                          )}

                          {['approved', 'payment_queued'].includes(claim.status) && isHRorAdmin && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setReimburseExpenseId(claim.id);
                                setPayoutReference('');
                                setReimburseMethod('direct_bank');
                                setIsReimburseModalOpen(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1 shadow-xs"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark Paid
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
        </div>
      )}

      {/* ─────────────────── TAB 3: 🎯 Project Cost Allocation & Profitability ─────────────────── */}
      {activeTab === 'project_costs' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Real-Time Project Profitability & Cost Margins
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically consolidates logged labor hours, project expense claims, and billable revenue to determine actual gross margin per project.
              </p>
            </div>
          </div>

          {/* Project Margins Table */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Project & Owner</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Expenses (Billable / Non-Billable)</th>
                    <th className="py-3 px-4">Labor Cost ($60/hr)</th>
                    <th className="py-3 px-4">Total Cost</th>
                    <th className="py-3 px-4">Est. Revenue</th>
                    <th className="py-3 px-4">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isProjectCostsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Calculating project profitability...
                      </td>
                    </tr>
                  ) : projectCostItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No active projects found. Tag an expense to a project to start tracking profitability.
                      </td>
                    </tr>
                  ) : (
                    projectCostItems.map((p) => {
                      const isPositive = p.gross_profit >= 0;
                      return (
                        <tr key={p.project_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">{p.project_name}</div>
                            <div className="text-[10px] text-slate-400">Owner: {p.owner_name} • {p.claims_count} claims</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              ${safeToFixed(p.total_expenses)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ${safeToFixed(p.billable_expenses)} billable • ${safeToFixed(p.non_billable_expenses)} internal
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              ${safeToFixed(p.estimated_labor_cost)}
                            </div>
                            <div className="text-[10px] text-slate-400">{safeNum(p.logged_hours)} hrs logged</div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            ${safeToFixed(p.total_project_cost)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                            ${safeToFixed(p.estimated_revenue)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className={`font-extrabold flex items-center gap-1 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              ${safeToFixed(p.gross_profit)} ({safeToFixed(p.profit_margin_percent, 1)}%)
                            </div>
                            <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, Math.max(5, safeNum(p.profit_margin_percent)))}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─────────────────── TAB 4: 🏢 Spend Budgets & Department Caps ─────────────────── */}
      {activeTab === 'budgets' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                Department & Project Spend Budgets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set monthly/quarterly spend guardrails with visual burn meters and automatic 80% threshold warnings.
              </p>
            </div>

            {isManagerOrAdmin && (
              <Button
                onClick={() => {
                  setBudgetError(null);
                  setIsBudgetModalOpen(true);
                }}
                size="sm"
                className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Configure New Budget Cap
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isBudgetsLoading ? (
              <div className="col-span-full p-12 text-center text-xs text-slate-400">Loading spend budgets...</div>
            ) : budgetItems.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-500 space-y-3 bg-white dark:bg-slate-900 border border-border rounded-2xl">
                <Building2 className="h-8 w-8 mx-auto text-slate-400" />
                <p className="text-xs font-semibold">No spend budgets configured yet.</p>
                {isManagerOrAdmin && (
                  <Button
                    onClick={() => setIsBudgetModalOpen(true)}
                    size="sm"
                    className="bg-primary text-primary-foreground text-xs font-semibold"
                  >
                    Create First Budget
                  </Button>
                )}
              </div>
            ) : (
              budgetItems.map((b) => {
                const isExceeded = b.status_badge === 'exceeded';
                const isWarning = b.status_badge === 'warning';
                const targetLabel = b.target_type === 'department' ? b.department_name : b.project_name;

                return (
                  <Card key={b.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5 space-y-4 relative overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          {b.target_type === 'department' ? <Building className="h-3.5 w-3.5 text-primary" /> : <Target className="h-3.5 w-3.5 text-amber-500" />}
                          {targetLabel}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">{b.period} Budget ({b.currency})</div>
                      </div>

                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          isExceeded
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                            : isWarning
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}
                      >
                        {isExceeded ? 'Exceeded' : isWarning ? 'Warning (>80%)' : 'Healthy'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Spent: ${safeToFixed(b.spent_amount)}</span>
                        <span className="font-bold text-slate-900 dark:text-white">${safeToFixed(b.amount)} Cap</span>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, safeNum(b.utilization_pct)))}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                        <span>{safeNum(b.utilization_pct)}% Utilized</span>
                        <span>${safeToFixed(b.remaining)} Remaining</span>
                      </div>
                    </div>

                    {safeNum(b.pending_amount) > 0 && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <Clock className="h-3 w-3" />
                        ${safeToFixed(b.pending_amount)} additional pending approval
                      </div>
                    )}

                    {isHRorAdmin && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => deleteBudgetMutation.mutate(b.id)}
                          className="text-[10px] text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete Budget
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 5: 💳 Recurring SaaS & Vendor Subscription Radar ─────────────────── */}
      {activeTab === 'saas_radar' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Laptop className="h-5 w-5 text-indigo-500" />
                SaaS & Vendor Subscription Radar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically detects recurring software licenses, flags fragmented duplicate department purchases, and tracks MRR/ARR spend.
              </p>
            </div>
          </div>

          {/* SaaS KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Recurring Spend (MRR)</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                ${(saasRadar?.total_mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Estimated monthly cloud & SaaS software expenditure</div>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Annualized Run Rate (ARR)</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                ${(saasRadar?.total_arr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">12-month projected software subscription cost</div>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duplicate License Warnings</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {saasRadar?.duplicate_risk_count || 0} tools
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Separate departmental subscriptions that can be unified</div>
            </Card>
          </div>

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSaasRadarLoading ? (
              <div className="col-span-full p-12 text-center text-xs text-slate-400">Scanning SaaS vendor footprints...</div>
            ) : subscriptionItems.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-border rounded-2xl">
                <Laptop className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-semibold">No SaaS subscriptions identified yet.</p>
                <p className="text-[11px] text-slate-400">Submit claims with category "Software & Subscriptions" to activate radar.</p>
              </div>
            ) : (
              subscriptionItems.map((s, idx) => (
                <Card key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Laptop className="h-4 w-4 text-indigo-600" />
                        {s.vendor_name}
                      </h4>
                      <div className="text-[10px] text-slate-400">Last paid: {s.last_payment_date}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                        ${safeToFixed(s.monthly_spend)}/mo
                      </div>
                      <div className="text-[10px] text-slate-400">≈ ${safeToFixed(s.annualized_run_rate)}/yr</div>
                    </div>
                  </div>

                  {s.duplicate_license_risk && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[10px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>{s.risk_note}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pt-1 border-t border-border">
                    <div className="flex justify-between">
                      <span>Departments:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.departments.join(', ') || 'General'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Users claiming:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.employees_using.length} employees</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 6: AI Spreadsheet & CSV Analyst ─────────────────── */}
      {activeTab === 'analyst' && (
        <div className="animate-in fade-in duration-200">
          <SpreadsheetAnalyst />
        </div>
      )}

      {/* ─────────────────── TAB 7: Spend Analytics ─────────────────── */}
      {activeTab === 'analytics' && isHRorAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Company Spend ({analyticsYear})
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                ${(analytics?.total_spend_ytd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Approved + Reimbursed operational expenditure</div>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Pending Payout Backlog
              </div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                ${(analytics?.pending_payout || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Approved claims awaiting disbursement</div>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                In-Review Queue
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                ${(analytics?.in_review_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Submitted claims awaiting manager review</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spend by Category */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-6">
              <CardHeader className="p-0 pb-4 border-b border-border">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Spend by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-4 space-y-4">
                {categoryList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No category spend data available.</div>
                ) : (
                  categoryList.map((item) => {
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
                    const Icon = meta.icon;
                    const percent = analytics && analytics.total_spend_ytd > 0 ? (item.total / analytics.total_spend_ytd) * 100 : 0;

                    return (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            {meta.label} ({item.count} {item.count === 1 ? 'claim' : 'claims'})
                          </div>
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            ${safeToFixed(item.total)} ({safeToFixed(percent, 1)}%)
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, safeNum(percent)))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Top Merchants */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-6">
              <CardHeader className="p-0 pb-4 border-b border-border">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building className="h-4 w-4 text-indigo-600" />
                  Top Vendors & Merchants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-4 space-y-3">
                {merchantList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No merchant data recorded yet.</div>
                ) : (
                  merchantList.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-bold text-xs flex items-center justify-center">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{m.merchant}</div>
                          <div className="text-[10px] text-slate-400">{m.count} transactions</div>
                        </div>
                      </div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                        ${safeToFixed(m.total)}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 8: Batch Payouts & Global Bank Exporter ─────────────────── */}
      {activeTab === 'exports' && isHRorAdmin && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {batchSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{batchSuccessMessage}</span>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {/* Quick Bank Exporter Card */}
            <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-2xl p-6 md:col-span-1 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  1-Click Bank-Ready Files
                </h3>
                <p className="text-xs text-muted-foreground">
                  Export formatted files ready for upload directly into international payroll and payout systems.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                {[
                  { id: 'wise', label: 'Wise Batch CSV', desc: 'TransferWise Multi-Currency Batch' },
                  { id: 'stripe', label: 'Stripe Transfers CSV', desc: 'Direct Stripe Connect Payouts' },
                  { id: 'ach', label: 'US ACH / NACHA CSV', desc: 'Standard US Direct Deposit' },
                  { id: 'sepa', label: 'SEPA Credit CSV', desc: 'Eurozone Single Euro Payments' },
                  { id: 'upi', label: 'India UPI / NEFT CSV', desc: 'Indian Bank IMPS & UPI Payouts' },
                  { id: 'paypal', label: 'PayPal Mass Payout', desc: 'PayPal Batch Payments' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleDownloadBankPayout(item.id)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.desc}</div>
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </Card>

            {/* Batch Payout Manager */}
            <Card className="bg-white dark:bg-slate-900 border border-border shadow-xs rounded-2xl p-6 md:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    1-Click Batch Reimbursement Processing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Bulk mark approved claims as Paid / Reimbursed and assign a shared bank transfer or ACH reference code.
                  </p>
                </div>

                {selectedBatchClaims.length > 0 && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                    {selectedBatchClaims.length} selected
                  </span>
                )}
              </div>

              {/* Claims Awaiting Payout */}
              {(() => {
                const approvedClaims = approvalItems.filter((c: any) => c.status === 'approved');
                const selectedTotal = approvedClaims
                  .filter((c: any) => selectedBatchClaims.includes(c.id))
                  .reduce((acc: number, c: any) => acc + (parseFloat(c.amount_converted) || 0), 0);

                if (approvedClaims.length === 0) {
                  return (
                    <div className="p-10 text-center text-xs text-muted-foreground italic">
                      No approved claims currently awaiting payout disbursement.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBatchClaims.length === approvedClaims.length) {
                            setSelectedBatchClaims([]);
                          } else {
                            setSelectedBatchClaims(approvedClaims.map((c: any) => c.id));
                          }
                        }}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        {selectedBatchClaims.length === approvedClaims.length ? 'Deselect All' : 'Select All Approved'}
                      </button>

                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {approvedClaims.length} approved claims awaiting disbursement
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-slate-50 dark:bg-slate-950/50">
                      {approvedClaims.map((claim: any) => {
                        const isSelected = selectedBatchClaims.includes(claim.id);
                        return (
                          <div
                            key={claim.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedBatchClaims(selectedBatchClaims.filter((id) => id !== claim.id));
                              } else {
                                setSelectedBatchClaims([...selectedBatchClaims, claim.id]);
                              }
                            }}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{claim.title}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {claim.employee_name} ({claim.employee_email}) • {claim.merchant || 'General'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono">
                                ${safeToFixed(claim.amount_converted)}
                              </div>
                              <div className="text-[9px] text-emerald-600 font-bold uppercase">Approved</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                      <select
                        value={batchPayoutMethod}
                        onChange={(e) => setBatchPayoutMethod(e.target.value)}
                        className="text-xs h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
                      >
                        {SETTLEMENT_METHODS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Batch Payout Ref (e.g. ACH-2026-SEP-01)"
                        value={batchPayoutRef}
                        onChange={(e) => setBatchPayoutRef(e.target.value)}
                        className="text-xs h-10 flex-1"
                      />
                      <Button
                        onClick={() => {
                          batchPayoutMutation.mutate({
                            claim_ids: selectedBatchClaims,
                            payout_reference: batchPayoutRef,
                            settlement_method: batchPayoutMethod,
                          });
                        }}
                        disabled={selectedBatchClaims.length === 0 || batchPayoutMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 h-10 shrink-0 shadow-xs"
                      >
                        {batchPayoutMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Process Payout (${safeToFixed(selectedTotal)})
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* 🚀 Pillar 1: Unified Zero-Friction Expense Composer Dialog (Split-View, AI OCR, Live FX, Mileage, Per-Diem, Bulk) */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent className="sm:max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header & Mode Switcher */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Expense & Reimbursement Capture
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Pillar 1 Smart Zero-Friction
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  {composerMode === 'receipt' && 'Split-view: instant receipt OCR & interactive token extraction.'}
                  {composerMode === 'mileage' && 'Automatic distance × IRS rate calculation with zero receipts.'}
                  {composerMode === 'per_diem' && 'Tiered daily business allowance calculator.'}
                  {composerMode === 'bulk' && 'Bulk multi-receipt batch capture (up to 10 receipts in parallel).'}
                </p>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setComposerMode('receipt')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  composerMode === 'receipt'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Receipt (AI)
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('mileage')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  composerMode === 'mileage'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Mileage
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('per_diem')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  composerMode === 'per_diem'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Per-Diem
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('bulk')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  composerMode === 'bulk'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Files className="h-3.5 w-3.5" />
                Bulk Drop (⚡)
              </button>
            </div>
          </div>

          {/* Modal Body Container */}
          <div className="flex-1 overflow-y-auto">
            {/* ══════════════ MODE 1: RECEIPT (SPLIT-VIEW) ══════════════ */}
            {composerMode === 'receipt' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
                {/* Left 50%: Interactive Receipt Viewport & Tools */}
                <div className="lg:col-span-6 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between">
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <UploadCloud className="h-4 w-4 text-primary" />
                        Receipt Document Viewport
                      </span>
                      {receiptPreviewUrl && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => setReceiptZoom((z) => Math.max(0.6, z - 0.2))}
                            title="Zoom Out"
                          >
                            <ZoomOut className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-[10px] font-mono text-slate-400 px-1">
                            {Math.round(receiptZoom * 100)}%
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => setReceiptZoom((z) => Math.min(2.5, z + 0.2))}
                            title="Zoom In"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => setReceiptRotation((r) => (r + 90) % 360)}
                            title="Rotate 90°"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Viewport Box */}
                    {receiptPreviewUrl ? (
                      <div className="relative flex-1 min-h-[340px] rounded-2xl bg-slate-900/5 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center p-2 group">
                        <div
                          className="transition-transform duration-200 ease-out max-h-full max-w-full flex items-center justify-center"
                          style={{
                            transform: `scale(${receiptZoom}) rotate(${receiptRotation}deg)`,
                          }}
                        >
                          <img
                            src={receiptPreviewUrl}
                            alt="Receipt Preview"
                            className="max-h-[320px] max-w-full object-contain rounded-lg shadow-md"
                          />
                        </div>

                        {/* OCR Status Overlay */}
                        {ocrScanning && (
                          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="text-xs font-semibold tracking-wide">
                              Gemini Vision Reading Receipt...
                            </div>
                            <div className="text-[10px] text-slate-300">
                              Extracting merchant, totals, tax, and date
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Drag & Drop Zone */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDropzoneActive(true);
                        }}
                        onDragLeave={() => setIsDropzoneActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDropzoneActive(false);
                          if (e.dataTransfer.files?.[0]) {
                            handleProcessReceiptFile(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`flex-1 min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all ${
                          isDropzoneActive
                            ? 'border-primary bg-primary/5 scale-[0.99]'
                            : 'border-slate-300 dark:border-slate-800 hover:border-primary/50 bg-white dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                          <UploadCloud className="h-6 w-6" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Drag & drop receipt here or browse
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                          Supports PNG, JPG, WEBP, and PDF up to 15MB. Gemini extracts fields instantly.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            id="unifiedReceiptUpload"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleProcessReceiptFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="unifiedReceiptUpload"
                            className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
                          >
                            Browse Files
                          </label>

                          {/* Mobile Camera Capture */}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            id="mobileCameraSnap"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleProcessReceiptFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="mobileCameraSnap"
                            className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Camera className="h-3.5 w-3.5 text-primary" />
                            Camera Snap
                          </label>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9px] border">Ctrl</kbd>
                          +
                          <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[9px] border">V</kbd>
                          to paste screenshot directly
                        </div>
                      </div>
                    )}

                    {/* Interactive Click-to-Fill Extracted Token Chips */}
                    {claimOCRData && (
                      <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            AI Extracted Tokens (Click to Auto-fill)
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                            {claimOCRData.confidence ? `${Math.round(claimOCRData.confidence * 100)}% Confident` : '96% Confident'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {claimOCRData.merchant && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimMerchant(claimOCRData.merchant);
                                setCopiedToken('merchant');
                                setTimeout(() => setCopiedToken(null), 1500);
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-primary hover:text-primary transition-all flex items-center gap-1 shadow-2xs"
                              title="Click to fill Merchant"
                            >
                              <span className="text-slate-400 text-[10px]">Merchant:</span>
                              <strong>{claimOCRData.merchant}</strong>
                            </button>
                          )}

                          {claimOCRData.amount && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimAmount(String(claimOCRData.amount));
                                if (claimOCRData.currency) setClaimCurrency(claimOCRData.currency);
                                setCopiedToken('amount');
                                setTimeout(() => setCopiedToken(null), 1500);
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 transition-all flex items-center gap-1 shadow-2xs"
                              title="Click to fill Amount"
                            >
                              <span className="text-slate-400 text-[10px]">Total:</span>
                              <strong>{claimOCRData.amount} {claimOCRData.currency || 'USD'}</strong>
                            </button>
                          )}

                          {claimOCRData.expense_date && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimDate(claimOCRData.expense_date);
                                setCopiedToken('date');
                                setTimeout(() => setCopiedToken(null), 1500);
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-primary hover:text-primary transition-all flex items-center gap-1 shadow-2xs"
                              title="Click to fill Date"
                            >
                              <span className="text-slate-400 text-[10px]">Date:</span>
                              <strong>{claimOCRData.expense_date}</strong>
                            </button>
                          )}

                          {claimOCRData.tax_amount !== undefined && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimTaxAmount(String(claimOCRData.tax_amount));
                                setCopiedToken('tax');
                                setTimeout(() => setCopiedToken(null), 1500);
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-primary hover:text-primary transition-all flex items-center gap-1 shadow-2xs"
                              title="Click to fill Tax"
                            >
                              <span className="text-slate-400 text-[10px]">Tax:</span>
                              <strong>${claimOCRData.tax_amount}</strong>
                            </button>
                          )}
                        </div>

                        {copiedToken && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pt-0.5 animate-in fade-in">
                            ✓ {copiedToken.toUpperCase()} applied to claim input!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 50%: Form Details & Live Currency Converter */}
                <div className="lg:col-span-6 p-5 flex flex-col justify-between">
                  <form onSubmit={handleClaimSubmit} className="space-y-3.5 flex-1 flex flex-col">
                    {formError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                        {formError}
                      </div>
                    )}

                    {/* 🛑 Pillar 2 Hard Policy Blocks */}
                    {policyHardBlocks.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1.5 animate-in fade-in duration-200">
                        <div className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          Corporate Policy Hard Block ({policyHardBlocks.length})
                        </div>
                        <ul className="text-[11px] text-rose-700 dark:text-rose-400 list-disc list-inside space-y-0.5">
                          {policyHardBlocks.map((b, i) => (
                            <li key={i} className="leading-snug">{b}</li>
                          ))}
                        </ul>
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium pt-0.5">
                          Submission is disabled until policy block condition is resolved or pre-approved by Finance.
                        </div>
                      </div>
                    )}

                    {/* 🔍 Pillar 2 Duplicate Match Alert Card */}
                    {duplicateMatchInfo && (
                      <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 space-y-1">
                        <div className="text-[11px] font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                          <Copy className="h-3.5 w-3.5 text-purple-600" />
                          AI Duplicate Match Detected
                        </div>
                        <div className="text-[10px] text-purple-700 dark:text-purple-400">
                          Matches claim <strong>"{duplicateMatchInfo.title}"</strong> ({duplicateMatchInfo.amount} {duplicateMatchInfo.currency}) filed by {duplicateMatchInfo.employee_name} on {duplicateMatchInfo.date}.
                        </div>
                      </div>
                    )}

                    {/* ⚠️ Pillar 2 AI Policy Soft Warnings */}
                    {policyWarnings.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-1">
                        <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <ShieldAlert className="h-4 w-4 text-amber-600" />
                          Policy Guidelines Notice ({policyWarnings.length})
                        </div>
                        <ul className="text-[11px] text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                          {policyWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                        <div className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                          Written business justification in Notes is required for review.
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Claim Title / Purpose
                      </label>
                      <Input
                        placeholder="e.g. AWS Cloud Hosting, Team Dinner with Client"
                        value={claimTitle}
                        onChange={(e) => setClaimTitle(e.target.value)}
                        className="text-xs bg-slate-50 dark:bg-slate-950"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Merchant / Vendor
                        </label>
                        <Input
                          placeholder="e.g. Amazon, Uber, Delta, Figma"
                          value={claimMerchant}
                          onChange={(e) => setClaimMerchant(e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Expense Date
                        </label>
                        <Input
                          type="date"
                          value={claimDate}
                          onChange={(e) => setClaimDate(e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-slate-950"
                          required
                        />
                      </div>
                    </div>

                    {/* Currency & Amount with Live Exchange Rate Badge */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Amount
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={claimAmount}
                            onChange={(e) => setClaimAmount(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-slate-950 font-bold"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Currency
                          </label>
                          <select
                            value={claimCurrency}
                            onChange={(e) => setClaimCurrency(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Tax / VAT
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={claimTaxAmount}
                            onChange={(e) => setClaimTaxAmount(e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-slate-950"
                          />
                        </div>
                      </div>

                      {/* Live FX Calculation Info */}
                      {claimCurrency !== 'USD' && convertedEstimatedAmount && (
                        <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                          <span className="flex items-center gap-1 font-semibold">
                            <Compass className="h-3.5 w-3.5 text-emerald-600" />
                            Live Exchange Rate: 1 {claimCurrency} ≈ ${(exchangeRateData?.rates?.[claimCurrency] ? (1 / exchangeRateData.rates[claimCurrency]).toFixed(4) : '--')} USD
                          </span>
                          <span className="font-extrabold text-xs">
                            ≈ ${convertedEstimatedAmount} USD
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Category
                      </label>
                      <select
                        value={claimCategory}
                        onChange={(e) => setClaimCategory(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        {Object.entries(CATEGORY_META).map(([key, meta]) => (
                          <option key={key} value={key}>
                            {meta.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Department & Project Allocation */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-primary" />
                        Department & Project Cost Allocation
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Department
                          </label>
                          <select
                            value={claimDepartmentId}
                            onChange={(e) => setClaimDepartmentId(e.target.value)}
                            className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                          >
                            <option value="">Default (My Department)</option>
                            {departments.map((d: any) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Project (Optional)
                          </label>
                          <select
                            value={claimProjectId}
                            onChange={(e) => setClaimProjectId(e.target.value)}
                            className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                          >
                            <option value="">No Project Linked</option>
                            {projects.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 items-center">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Client Name
                          </label>
                          <Input
                            placeholder="e.g. Acme Corp"
                            value={claimClientName}
                            onChange={(e) => setClaimClientName(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <input
                            type="checkbox"
                            id="isBillableCheck"
                            checked={claimIsBillable}
                            onChange={(e) => setClaimIsBillable(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor="isBillableCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                            Mark as Billable Expense
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Notes & Business Justification
                      </label>
                      <textarea
                        value={claimDescription}
                        onChange={(e) => setClaimDescription(e.target.value)}
                        placeholder="Details of business purpose or client project..."
                        rows={2}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <DialogFooter className="flex gap-2 pt-2 mt-auto">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={checkPolicyGuard}
                        className="text-xs font-semibold gap-1 text-slate-700 dark:text-slate-300"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Check Policy
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsClaimModalOpen(false)} className="text-xs font-semibold">
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createClaimMutation.isPending || policyHardBlocks.length > 0}
                        className={`text-xs font-semibold ${
                          policyHardBlocks.length > 0
                            ? 'bg-rose-500/50 text-white cursor-not-allowed opacity-60'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {createClaimMutation.isPending
                          ? 'Submitting...'
                          : policyHardBlocks.length > 0
                          ? 'Blocked by Policy'
                          : 'Submit Claim'}
                      </Button>
                    </DialogFooter>
                  </form>
                </div>
              </div>
            )}

            {/* ══════════════ MODE 2: MILEAGE CALCULATOR ══════════════ */}
            {composerMode === 'mileage' && (
              <div className="p-6 max-w-2xl mx-auto space-y-5">
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-indigo-600" />
                    IRS Standard Business Mileage Reimbursement
                  </div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400">
                    No receipts needed! Mileage rate is calibrated to standard corporate rates: <strong>$0.67 per mile</strong> (or <strong>$0.42 per km</strong>). Total reimbursement is auto-calculated.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Origin / Starting Address
                    </label>
                    <Input
                      placeholder="e.g. Headquarters / Home"
                      value={mileageStart}
                      onChange={(e) => setMileageStart(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Destination / Client Office
                    </label>
                    <Input
                      placeholder="e.g. Client Site, Airport"
                      value={mileageEnd}
                      onChange={(e) => setMileageEnd(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      One-Way Distance
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 25"
                      value={mileageDistance}
                      onChange={(e) => setMileageDistance(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Unit
                    </label>
                    <select
                      value={mileageUnit}
                      onChange={(e) => setMileageUnit(e.target.value as any)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="miles">Miles ($0.67/mi)</option>
                      <option value="km">Kilometers ($0.42/km)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={mileageVehicleType}
                      onChange={(e) => setMileageVehicleType(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="Personal Car">Personal Car</option>
                      <option value="Electric Vehicle (EV)">Electric Vehicle (EV)</option>
                      <option value="Motorcycle">Motorcycle</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="roundTripCheck"
                    checked={mileageIsRoundTrip}
                    onChange={(e) => setMileageIsRoundTrip(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="roundTripCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Round-Trip Journey (Double Distance)
                  </label>
                </div>

                {/* Calculation Summary Card */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Auto-Calculated Reimbursement
                    </span>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {mileageIsRoundTrip ? (parseFloat(mileageDistance || '0') * 2).toFixed(1) : (parseFloat(mileageDistance || '0')).toFixed(1)} {mileageUnit} × ${mileageUnit === 'miles' ? '0.67' : '0.42'}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    ${claimAmount || '0.00'} USD
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsClaimModalOpen(false)} className="text-xs font-semibold">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClaimSubmit as any}
                    disabled={createClaimMutation.isPending || !claimAmount || parseFloat(claimAmount) <= 0}
                    className="bg-primary text-primary-foreground text-xs font-semibold"
                  >
                    {createClaimMutation.isPending ? 'Filing Claim...' : 'File Mileage Claim'}
                  </Button>
                </div>
              </div>
            )}

            {/* ══════════════ MODE 3: PER-DIEM CALCULATOR ══════════════ */}
            {composerMode === 'per_diem' && (
              <div className="p-6 max-w-2xl mx-auto space-y-5">
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-2">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    Corporate Per-Diem Daily Allowance
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Standard fixed daily allowances for meals, incidentals, and business travel tiers. Automatically applies corporate policy without requiring individual meal receipts.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Travel Duration (Days)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={perDiemDays}
                      onChange={(e) => setPerDiemDays(e.target.value)}
                      className="text-xs bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Destination Tier Rate
                    </label>
                    <select
                      value={perDiemDestination}
                      onChange={(e) => setPerDiemDestination(e.target.value as any)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="standard">Standard Domestic ($75 / day)</option>
                      <option value="metro">High-Cost Tier 1 Metro ($110 / day)</option>
                      <option value="international">International Travel ($140 / day)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Trip Purpose / Conference Name
                  </label>
                  <Input
                    placeholder="e.g. Q3 Sales Summit in New York, AWS re:Invent 2026"
                    value={perDiemTripPurpose}
                    onChange={(e) => setPerDiemTripPurpose(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                {/* Per-Diem Calculation Card */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Total Per-Diem Allowance
                    </span>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {perDiemDays} days × ${perDiemDestination === 'standard' ? '75' : perDiemDestination === 'metro' ? '110' : '140'}/day ({perDiemDestination.toUpperCase()})
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    ${claimAmount || '0.00'} USD
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsClaimModalOpen(false)} className="text-xs font-semibold">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClaimSubmit as any}
                    disabled={createClaimMutation.isPending || !claimAmount || parseFloat(claimAmount) <= 0}
                    className="bg-primary text-primary-foreground text-xs font-semibold"
                  >
                    {createClaimMutation.isPending ? 'Filing Claim...' : 'File Per-Diem Claim'}
                  </Button>
                </div>
              </div>
            )}

            {/* ══════════════ MODE 4: BULK MULTI-RECEIPT DROPZONE ══════════════ */}
            {composerMode === 'bulk' && (
              <div className="p-6 max-w-4xl mx-auto space-y-5">
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 space-y-1.5">
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <Files className="h-4 w-4 text-indigo-600" />
                    Multi-Receipt Parallel Batch Extraction (Up to 10 Receipts)
                  </div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400">
                    Drop a folder or batch of receipts. Gemini extracts merchant, total amount, taxes, and category for all files concurrently into separate line-item drafts.
                  </p>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDropzoneActive(true);
                  }}
                  onDragLeave={() => setIsDropzoneActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDropzoneActive(false);
                    if (e.dataTransfer.files?.length) {
                      handleBatchScan(e.dataTransfer.files);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isDropzoneActive
                      ? 'border-indigo-500 bg-indigo-50/40'
                      : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 bg-white dark:bg-slate-950'
                  }`}
                >
                  <UploadCloud className="h-10 w-10 mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Drop multiple receipt photos or PDFs here
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select up to 10 files simultaneously
                  </p>

                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    id="batchFileInput"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleBatchScan(e.target.files);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="batchFileInput"
                    className="mt-3 inline-block cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    Select Batch Files
                  </label>
                </div>

                {/* Scanning Progress Loader */}
                {bulkScanning && (
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Processing {bulkFiles.length} receipts in parallel with Gemini Vision...
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Extracting amounts, dates, tax breakdowns, and fraud hashes
                    </div>
                  </div>
                )}

                {/* Batch Extracted Results Carousel / List */}
                {bulkScanResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Extracted Draft Line-Items ({bulkScanResults.length})
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        Total Batch: $
                        {bulkScanResults
                          .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
                          .toFixed(2)}{' '}
                        USD
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                      {bulkScanResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-indigo-400 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {item.merchant || item.title || `Receipt #${idx + 1}`}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              {item.amount || '0.00'} {item.currency || 'USD'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{item.expense_date || 'No Date'}</span>
                            <span>•</span>
                            <span>{CATEGORY_META[item.category]?.label || item.category || 'Other'}</span>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Load this item into the single claim editor
                              setClaimTitle(item.title || item.merchant || `Expense #${idx + 1}`);
                              setClaimMerchant(item.merchant || '');
                              setClaimDate(item.expense_date || new Date().toISOString().split('T')[0]);
                              setClaimAmount(String(item.amount || '0'));
                              setClaimCurrency(item.currency || 'USD');
                              setClaimTaxAmount(String(item.tax_amount || '0'));
                              setClaimCategory(item.category || 'other');
                              setClaimDescription(item.summary || '');
                              if (bulkFiles[idx]) {
                                setClaimReceiptFile(bulkFiles[idx]);
                                setReceiptPreviewUrl(URL.createObjectURL(bulkFiles[idx]));
                              }
                              setComposerMode('receipt');
                            }}
                            className="w-full h-7 text-[11px] font-semibold text-indigo-600 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50"
                          >
                            Edit & File Separately
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBulkScanResults([])}
                        className="text-xs font-semibold"
                      >
                        Clear Batch
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          // 1-Click submit all batch claims
                          try {
                            for (let i = 0; i < bulkScanResults.length; i++) {
                              const item = bulkScanResults[i];
                              const fd = new FormData();
                              fd.append('title', item.title || item.merchant || `Receipt #${i + 1}`);
                              fd.append('merchant', item.merchant || '');
                              fd.append('expense_date', item.expense_date || new Date().toISOString().split('T')[0]);
                              fd.append('amount', String(item.amount || '0'));
                              fd.append('currency', item.currency || 'USD');
                              fd.append('tax_amount', String(item.tax_amount || '0'));
                              fd.append('category', item.category || 'other');
                              fd.append('description', item.summary || 'Batch multi-receipt extraction');
                              if (bulkFiles[i]) {
                                fd.append('receipt_file', bulkFiles[i]);
                              }
                              await api.post('/expenses/', fd);
                            }
                            queryClient.invalidateQueries({ queryKey: ['myClaims'] });
                            queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
                            setIsClaimModalOpen(false);
                            coreAlert({
                              title: 'Batch Claims Submitted',
                              description: `Successfully filed ${bulkScanResults.length} expense claims!`,
                            });
                          } catch (err: any) {
                            coreAlert({
                              title: 'Batch Submit Failed',
                              description: extractErrorMessage(err) || 'Some claims failed to submit.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        className="bg-primary text-primary-foreground text-xs font-bold"
                      >
                        Submit All {bulkScanResults.length} Claims at Once
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 🏢 Create Spend Budget Modal */}
      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Configure Spend Budget Cap
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateBudgetSubmit} className="space-y-3.5 py-2">
            {budgetError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {budgetError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBudgetTargetType('department')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    budgetTargetType === 'department'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Department Budget
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetTargetType('project')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    budgetTargetType === 'project'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Project Budget
                </button>
              </div>
            </div>

            {budgetTargetType === 'department' ? (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Department
                </label>
                <select
                  value={budgetDeptId}
                  onChange={(e) => setBudgetDeptId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  required
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Project
                </label>
                <select
                  value={budgetProjId}
                  onChange={(e) => setBudgetProjId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  required
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Budget Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5000.00"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-950"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Period Cycle
                </label>
                <select
                  value={budgetPeriod}
                  onChange={(e: any) => setBudgetPeriod(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Alert Warning Threshold ({budgetThreshold}%)
              </label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={budgetThreshold}
                onChange={(e) => setBudgetThreshold(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>50% Early Alert</span>
                <span>80% Standard</span>
                <span>100% Strict Hard Cap</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Notes & Description
              </label>
              <Input
                placeholder="e.g. Q3 Software & Travel Allocation"
                value={budgetNotes}
                onChange={(e) => setBudgetNotes(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBudgetModalOpen(false)} className="text-xs font-semibold">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createBudgetMutation.isPending}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                {createBudgetMutation.isPending ? 'Saving...' : 'Set Budget'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🏦 Global Bank Payout Format Modal */}
      <Dialog open={isBankExportModalOpen} onOpenChange={setIsBankExportModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              1-Click Bank Payout Exporter
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Select your payment disbursement provider. CORE will generate a formatted batch CSV ready to upload directly into your bank portal.
            </p>

            <div className="space-y-2">
              {[
                { id: 'wise', title: 'Wise (TransferWise) Batch CSV', desc: 'Direct international multi-currency payout format.' },
                { id: 'stripe', title: 'Stripe Transfers Batch CSV', desc: 'Pre-formatted for Stripe Connect accounts.' },
                { id: 'ach', title: 'US NACHA / ACH Direct Deposit', desc: 'Standard format for US commercial checking accounts.' },
                { id: 'sepa', title: 'European SEPA Credit Transfer', desc: 'Eurozone IBAN & BIC direct credit CSV.' },
                { id: 'upi', title: 'India UPI / NEFT Payout CSV', desc: 'Instant UPI VPA and IMPS/NEFT bank routing.' },
                { id: 'paypal', title: 'PayPal Mass Payouts CSV', desc: 'Direct PayPal email batch payout format.' },
              ].map((fmt) => (
                <div
                  key={fmt.id}
                  onClick={() => handleDownloadBankPayout(fmt.id)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{fmt.title}</div>
                    <div className="text-[10px] text-slate-400">{fmt.desc}</div>
                  </div>
                  <Download className="h-4 w-4 text-primary" />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              Reject Expense Claim
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Provide feedback to the employee regarding why this expense cannot be reimbursed.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing detailed receipt or exceeds allowable per-diem rate."
              rows={3}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={() => rejectExpenseId && rejectMutation.mutate({ id: rejectExpenseId, reason: rejectReason })}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Reimbursed / Payout Reference Modal */}
      <Dialog open={isReimburseModalOpen} onOpenChange={setIsReimburseModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Process Expense Reimbursement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <p className="text-xs text-slate-500">
              Select settlement channel and enter transaction reference for audit compliance.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Settlement Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SETTLEMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSel = reimburseMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setReimburseMethod(m.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                        isSel
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSel ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Payment Reference Number
              </label>
              <Input
                placeholder="e.g. ACH-90812 or Payroll Sep 15"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsReimburseModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={() =>
                reimburseExpenseId &&
                reimburseMutation.mutate({
                  id: reimburseExpenseId,
                  ref: payoutReference,
                  method: reimburseMethod,
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rapid Receipt Review Carousel Modal ─── */}
      <Dialog open={isRapidReviewOpen} onOpenChange={setIsRapidReviewOpen}>
        <DialogContent className="sm:max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          {(() => {
            const currentClaim = pendingApprovalClaims[rapidReviewIndex];
            const total = pendingApprovalClaims.length;

            if (!currentClaim || total === 0) {
              return (
                <div className="p-12 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    All Pending Claims Reviewed!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You have reviewed all claims in your approval queue.
                  </p>
                  <Button onClick={() => setIsRapidReviewOpen(false)} className="text-xs font-bold">
                    Close Carousel
                  </Button>
                </div>
              );
            }

            const meta = CATEGORY_META[currentClaim.category] || CATEGORY_META.other;
            const CatIcon = meta.icon;
            const tierMeta = currentClaim.approval_tier
              ? APPROVAL_TIER_META[currentClaim.approval_tier]
              : APPROVAL_TIER_META.manager_review;

            return (
              <div className="flex flex-col h-full max-h-[92vh]">
                {/* Header with Carousel Progress */}
                <div className="p-4 sm:p-5 border-b border-border bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-primary">
                        Rapid Receipt Review Carousel
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Claim {rapidReviewIndex + 1} of {total}
                      </div>
                    </div>
                  </div>

                  {/* Navigation controls */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setRapidReviewIndex((prev) => Math.max(0, prev - 1))}
                      disabled={rapidReviewIndex === 0}
                      className="h-8 w-8 rounded-lg"
                      title="Previous Claim"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                      {rapidReviewIndex + 1} / {total}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setRapidReviewIndex((prev) => Math.min(total - 1, prev + 1))}
                      disabled={rapidReviewIndex === total - 1}
                      className="h-8 w-8 rounded-lg"
                      title="Next Claim"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar across header */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1">
                  <div
                    className="bg-primary h-1 transition-all duration-300"
                    style={{ width: `${((rapidReviewIndex + 1) / total) * 100}%` }}
                  />
                </div>

                {/* Body: Split View (Receipt on Left, Review Metadata on Right) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-y-auto flex-1">
                  {/* Left: Receipt Preview */}
                  <div className="p-6 bg-slate-100/70 dark:bg-slate-950/70 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border min-h-[300px]">
                    {currentClaim.receipt_file_url ? (
                      currentClaim.receipt_file_url.endsWith('.pdf') ? (
                        <iframe
                          src={getMediaUrl(currentClaim.receipt_file_url)}
                          className="w-full h-80 rounded-xl border border-border shadow-xs"
                          title="Receipt PDF"
                        />
                      ) : (
                        <div className="relative group max-h-[420px] flex items-center justify-center">
                          <img
                            src={getMediaUrl(currentClaim.receipt_file_url)}
                            alt="Receipt"
                            className="max-h-[380px] max-w-full object-contain rounded-xl shadow-md border border-border"
                            onError={(e) => {
                              if (e.currentTarget.src !== currentClaim.receipt_file_url) {
                                e.currentTarget.src = currentClaim.receipt_file_url || '';
                              }
                            }}
                          />
                        </div>
                      )
                    ) : (
                      <div className="p-8 text-center space-y-2 text-slate-400">
                        <Receipt className="h-10 w-10 mx-auto opacity-50" />
                        <div className="text-xs font-semibold">No Attached Receipt Document</div>
                        <p className="text-[11px] text-slate-500">
                          Digital claim filed without physical receipt upload.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right: Claim Details & Decision Controls */}
                  <div className="p-6 space-y-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Amount Banner */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                        <div>
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {currentClaim.amount} {currentClaim.currency}
                          </div>
                          {currentClaim.currency !== 'USD' && (
                            <div className="text-xs font-semibold text-slate-400">
                              ≈ ${currentClaim.amount_converted} USD
                            </div>
                          )}
                        </div>

                        {tierMeta && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold border ${tierMeta.bg} ${tierMeta.text} ${tierMeta.border}`}
                          >
                            {tierMeta.label}
                          </span>
                        )}
                      </div>

                      {/* Employee & Category */}
                      <div className="space-y-1.5">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {currentClaim.employee_name}
                          {currentClaim.department_name && (
                            <span className="text-xs font-normal text-muted-foreground ml-1.5">
                              • {currentClaim.department_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {currentClaim.title} {currentClaim.merchant && `• ${currentClaim.merchant}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CatIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{meta.label}</span>
                          <span>•</span>
                          <span>{currentClaim.expense_date}</span>
                        </div>
                      </div>

                      {/* Lifecycle Progress Stepper */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-border">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Lifecycle Status
                        </div>
                        {renderLifecycleStepper(currentClaim.status)}
                      </div>

                      {/* AI Policy Warnings */}
                      {currentClaim.policy_violations && currentClaim.policy_violations.length > 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-1">
                          <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                            AI Policy Warnings ({currentClaim.policy_violations.length})
                          </div>
                          <ul className="text-[11px] text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                            {currentClaim.policy_violations.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          100% Policy Compliant — 0 Policy Violations Detected
                        </div>
                      )}

                      {/* Review Note Input */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Approval / Audit Note (Optional)
                        </label>
                        <Input
                          placeholder="e.g. Approved for client on-site visit."
                          value={rapidReviewNote}
                          onChange={(e) => setRapidReviewNote(e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-slate-950"
                        />
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 border-t border-border mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRejectExpenseId(currentClaim.id);
                          setRejectReason('');
                          setIsRejectModalOpen(true);
                        }}
                        className="flex-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Claim
                      </Button>

                      <Button
                        onClick={() => {
                          approveMutation.mutate({
                            id: currentClaim.id,
                            notes: rapidReviewNote || 'Approved via Rapid Review Carousel',
                          });
                          setRapidReviewNote('');
                          if (rapidReviewIndex < total - 1) {
                            setRapidReviewIndex((prev) => prev + 1);
                          } else {
                            setIsRapidReviewOpen(false);
                          }
                        }}
                        disabled={approveMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCheck className="h-4 w-4 mr-1" />
                        )}
                        Approve & Next
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Approval History Audit Trail Modal ─── */}
      <Dialog open={!!viewingAuditClaim} onOpenChange={(open) => !open && setViewingAuditClaim(null)}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Approval & Settlement Audit Trail
            </DialogTitle>
          </DialogHeader>

          {viewingAuditClaim && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-border flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {viewingAuditClaim.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {viewingAuditClaim.employee_name} • {viewingAuditClaim.expense_date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {viewingAuditClaim.amount} {viewingAuditClaim.currency}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ≈ ${safeToFixed(viewingAuditClaim.amount_converted)} USD
                  </div>
                </div>
              </div>

              {/* Audit Events Timeline */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {viewingAuditClaim.approval_history && viewingAuditClaim.approval_history.length > 0 ? (
                  viewingAuditClaim.approval_history.map((evt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="mt-1 h-3 w-3 rounded-full bg-primary/20 border-2 border-primary shrink-0" />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white capitalize">
                            {evt.action ? evt.action.replace(/_/g, ' ') : 'Review Action'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          By <strong className="text-slate-700 dark:text-slate-300">{evt.by_name}</strong>
                          {evt.tier && ` • Tier: ${evt.tier.replace(/_/g, ' ')}`}
                        </div>
                        {evt.notes && (
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300 italic">
                            "{evt.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground italic">
                    Claim submitted. Initial audit trail logged upon manager review.
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setViewingAuditClaim(null)} className="text-xs font-semibold">
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Image Preview Modal */}
      <Dialog open={!!previewReceiptUrl} onOpenChange={(open) => !open && setPreviewReceiptUrl(null)}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Receipt Preview
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 rounded-xl p-2">
            {previewReceiptUrl && (
              previewReceiptUrl.endsWith('.pdf') ? (
                <iframe src={getMediaUrl(previewReceiptUrl)} className="w-full h-96 rounded-lg" title="Receipt PDF" />
              ) : (
                <img
                  src={getMediaUrl(previewReceiptUrl)}
                  alt="Attached Receipt"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm"
                  onError={(e) => {
                    // Fallback to raw URL if getMediaUrl failed
                    if (e.currentTarget.src !== previewReceiptUrl) {
                      e.currentTarget.src = previewReceiptUrl;
                    }
                  }}
                />
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewReceiptUrl(null)} className="text-xs font-semibold">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Delete Expense Claim"
        description="Are you sure you want to delete this expense claim? This action cannot be undone."
        confirmLabel="Delete Claim"
        onConfirm={() => deleteExpenseId && deleteMutation.mutate(deleteExpenseId)}
      />
    </div>
  );
};
export default Expenses;
