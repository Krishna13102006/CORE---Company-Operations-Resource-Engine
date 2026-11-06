import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { api, getApiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { 
  Briefcase, Users, Plus, Award, Loader2, RefreshCw, ChevronRight, UserPlus, 
  CheckCircle, CheckCircle2, XCircle, FileText, Send, Phone, Mail, Clock, Shield, Star, 
  MessageSquare, Trash2, Edit3, ArrowRight, BookOpen, User, Check, AlertCircle, FileUp,
  Calendar, Trophy, Sliders, X, BarChart3, Sparkles, ExternalLink, Copy, CheckCheck, UserCheck, Video, Download
} from 'lucide-react';

export interface PipelineStageConfig {
  id: string;
  name: string;
  color?: string;
  order?: number;
}

interface Job {
  id: string;
  title: string;
  department: string;
  status: 'draft' | 'open' | 'closed';
  application_count: number;
  description: string;
  requirements: string;
  experience_requirements: string;
  created_at: string;
  pipeline_stages?: PipelineStageConfig[];
}

interface ApplicationSummary {
  id: string;
  candidate_name: string;
  candidate_email: string;
  has_resume: boolean;
  stage: string;
  match_score?: number;
  source?: string;
  created_at: string;
}

interface StageHistory {
  id: string;
  from_stage: string;
  to_stage: string;
  moved_by_name: string;
  moved_at: string;
  notes: string;
}

interface InterviewNote {
  id: string;
  interviewer_name: string;
  score: number;
  notes: string;
  created_at: string;
}

interface InterviewSchedule {
  id: string;
  scheduled_at: string;
  duration_min: number;
  interview_type: 'video' | 'phone' | 'in_person' | 'technical';
  meeting_link: string;
  interviewers: string[];
  agenda: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  created_by_name: string;
  created_at: string;
  google_calendar_url?: string;
  ics_url?: string;
}

interface InterviewInvitation {
  id: string;
  token: string;
  duration_min: number;
  interview_type: string;
  interviewers: string[];
  status: 'pending' | 'booked' | 'expired' | 'cancelled';
  expires_at: string;
  invite_url?: string;
  created_at: string;
}

interface Scorecard {
  id: string;
  stage: string;
  reviewer_name: string;
  scores: Record<string, number>;
  dimensions: string[];
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
  strengths: string;
  concerns: string;
  submitted_at: string;
}

interface ScorecardSummary {
  total_reviews: number;
  average_score: number;
  dimension_averages: Record<string, number>;
  recommendations: {
    strong_yes: number;
    yes: number;
    maybe: number;
    no: number;
    strong_no: number;
  };
  consensus: string;
  consensus_variant: 'emerald' | 'blue' | 'amber' | 'rose';
}

interface Offer {
  id: string;
  salary: number;
  start_date: string;
  expiration_date: string | null;
  notes: string;
  status: 'draft' | 'extended' | 'accepted' | 'declined' | 'cancelled';
  extended_at: string | null;
  signed_at: string | null;
  offer_letter_text: string;
  benefits_summary?: string;
  work_location?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  template_type: 'applied' | 'interview' | 'offer' | 'rejected';
  subject: string;
  body: string;
}

interface EmailLog {
  id: string;
  to_email: string;
  from_email?: string;
  direction?: 'outbound' | 'inbound';
  subject: string;
  body: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'received';
}

interface ApplicationDetail extends ApplicationSummary {
  candidate_id: string;
  candidate_phone: string;
  rejection_reason: string;
  stage_history: StageHistory[];
  interview_notes: InterviewNote[];
  interview_schedules: InterviewSchedule[];
  scorecards: Scorecard[];
  scorecard_summary?: ScorecardSummary;
  offer?: Offer;
  candidate_skills: string[];
  candidate_education: string[];
  candidate_experience: string[];
  candidate_projects: string[];
  matched_skills: string[];
  missing_skills: string[];
  resume_processed: boolean;
  score_skills: number | null;
  score_experience: number | null;
  score_projects: number | null;
  score_education: number | null;
  source_details?: string;
}

interface HiringStats {
  open_positions: number;
  applications_month: number;
  applications_week: number;
  avg_days_to_hire: number;
}

interface UploadingResume {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'parsing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  file?: File;
}

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Rich Markdown Renderer for Talent Assistant Chat with full GFM tables, lists, and formatting
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Sanitize em-dashes and table rows for robust GFM table parsing
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
            <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-primary/10 dark:bg-primary/20 font-bold uppercase tracking-wider text-[10px] text-primary" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 align-top text-[11px]" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 my-1.5 space-y-1 text-slate-800 dark:text-slate-200" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 my-1.5 space-y-1 text-slate-800 dark:text-slate-200" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed text-[11.5px]" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xs font-bold text-slate-900 dark:text-white mt-2.5 mb-1" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-1 leading-relaxed text-[11.5px]" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-slate-900 dark:text-slate-100" {...props} />
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
                <div className="relative my-2 rounded-xl bg-slate-950 text-slate-100 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed border border-slate-800 shadow-xs">
                  {match && (
                    <div className="absolute top-1 right-2 text-[8px] uppercase text-primary font-bold select-none">
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
              <code className="px-1 py-0.5 mx-0.5 rounded bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 font-mono text-[10px]" {...props}>
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

const STAGE_DIMENSIONS: Record<string, string[]> = {
  screening:  ['communication', 'role_understanding', 'motivation', 'culture_fit'],
  interview:  ['problem_solving', 'technical_depth', 'experience_relevance', 'communication'],
  technical:  ['code_quality', 'system_design', 'debugging', 'technical_depth'],
  offer:      ['leadership', 'culture_fit', 'growth_potential', 'overall'],
  default:    ['communication', 'technical_depth', 'culture_fit', 'overall'],
};

export const Hiring: React.FC = () => {
  const queryClient = useQueryClient();
  const { confirm: coreConfirm, alert: coreAlert } = useCoreModal();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Modal / Dialog States
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Edit Job Form State (pre-populated when editingJob is set)
  const [editTitle, setEditTitle] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editReqs, setEditReqs] = useState('');
  const [editExp, setEditExp] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'open' | 'closed'>('open');

  // Candidate comparison
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // Interview scheduling form state
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedDateOnly, setSchedDateOnly] = useState(getTomorrowDateStr);
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedType, setSchedType] = useState<'video'|'phone'|'in_person'|'technical'>('video');
  const [schedDuration, setSchedDuration] = useState(60);
  const [schedLink, setSchedLink] = useState('');
  const [schedInterviewers, setSchedInterviewers] = useState('');
  const [schedAgenda, setSchedAgenda] = useState('');

  // Scorecard form state
  const [showScorecardForm, setShowScorecardForm] = useState(false);
  const [scorecardScores, setScorecardScores] = useState<Record<string, number>>({});
  const [scorecardRec, setScorecardRec] = useState<'strong_yes'|'yes'|'maybe'|'no'|'strong_no'>('yes');
  const [scorecardStrengths, setScorecardStrengths] = useState('');
  const [scorecardConcerns, setScorecardConcerns] = useState('');

  // Create Job Posting Form State
  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobReqs, setJobReqs] = useState('');
  const [jobExp, setJobExp] = useState('');
  const [jobStatus, setJobStatus] = useState<'draft' | 'open' | 'closed'>('open');

  // Single Candidate Form State
  const [candFirst, setCandFirst] = useState('');
  const [candLast, setCandLast] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candPhone, setCandPhone] = useState('');
  const [candResume, setCandResume] = useState<File | null>(null);
  const [candSource, setCandSource] = useState('linkedin');
  const [candSourceDetails, setCandSourceDetails] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume Upload State & Queue
  const [resumeUploadQueue, setResumeUploadQueue] = useState<UploadingResume[]>([]);
  const [resumeDragActive, setResumeDragActive] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Interview Note Form State
  const [noteScore, setNoteScore] = useState<number>(5);
  const [noteText, setNoteText] = useState('');

  // Drawer Tabs & Sub-feature States
  const [activeDrawerTab, setActiveDrawerTab] = useState<'eval' | 'emails' | 'offer'>('eval');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Email Compose State
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Offer Form State
  const [offerSalary, setOfferSalary] = useState('');
  const [offerStartDate, setOfferStartDate] = useState('');
  const [offerExpirationDate, setOfferExpirationDate] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [offerLetterText, setOfferLetterText] = useState('');
  const [offerBenefits, setOfferBenefits] = useState('Comprehensive Health, Dental, Vision & 401(k) retirement match');
  const [offerWorkLocation, setOfferWorkLocation] = useState('Remote');

  // Stage change transition details
  const [stageNotes, setStageNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isPromoting, setIsPromoting] = useState<string | null>(null);
  const [rejectionSendEmail, setRejectionSendEmail] = useState(true);
  const [rejectionCustomEmail, setRejectionCustomEmail] = useState('');

  // Offer PDF State
  const [isDownloadingOfferPdf, setIsDownloadingOfferPdf] = useState(false);

  // 1-Click Convert to Employee Onboarding State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardRole, setOnboardRole] = useState<'employee' | 'manager' | 'hr' | 'admin'>('employee');
  const [onboardDeptId, setOnboardDeptId] = useState('');
  const [onboardJobTitle, setOnboardJobTitle] = useState('');
  const [onboardManagerId, setOnboardManagerId] = useState('');
  const [onboardStartDate, setOnboardStartDate] = useState('');
  const [onboardCreateTasks, setOnboardCreateTasks] = useState(true);
  const [onboardScheduleOrientation, setOnboardScheduleOrientation] = useState(true);
  const [onboardResult, setOnboardResult] = useState<any>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);



  // AI Interview Questions Generator State
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [copiedQId, setCopiedQId] = useState<string | null>(null);

  // CORE Meeting Room Integration for Interviews
  const [useCoreMeeting, setUseCoreMeeting] = useState(true);

  // Public Careers Page Link Copied Indicator
  const [careersCopied, setCareersCopied] = useState(false);

  // Two-Way Inbound Messaging Simulation State
  const [showSimulateReplyModal, setShowSimulateReplyModal] = useState(false);
  const [simulatedSubject, setSimulatedSubject] = useState('Re: Update regarding my application');
  const [simulatedBody, setSimulatedBody] = useState('Thank you for reaching out! I would love to proceed with the next stage and speak with the team.');

  // Customizable Job Stages State
  const [showCustomizeStagesModal, setShowCustomizeStagesModal] = useState(false);
  const [customStagesDraft, setCustomStagesDraft] = useState<PipelineStageConfig[]>([]);
  const [newStageName, setNewStageName] = useState('');

  // Self-Service Interview Invitations State
  const [showSelfScheduleModal, setShowSelfScheduleModal] = useState(false);
  const [selfSchedDuration, setSelfSchedDuration] = useState('45');
  const [selfSchedType, setSelfSchedType] = useState('video');
  const [selfSchedInterviewers, setSelfSchedInterviewers] = useState('');
  const [selfSchedExpireDays, setSelfSchedExpireDays] = useState(7);
  const [newlyCreatedInviteToken, setNewlyCreatedInviteToken] = useState<string | null>(null);
  const [copiedInviteToken, setCopiedInviteToken] = useState(false);

  // Candidate Intelligence / Talent Assistant Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! I am your Talent Assistant. I can help you evaluate applicants for this role, compare qualifications, identify key skill matches, and summarize candidate experience.' }
  ]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();

  // Fetch Tenant Info for Careers Link
  const { data: tenant } = useQuery<{ id: string; name: string; slug: string }>({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me/'),
    retry: false,
  });
  const tenantSlug = tenant?.slug || user?.org_slug || 'company';

  // Fetch Departments and Employees for Onboarding
  const { data: rawDepartments } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['teams-departments'],
    queryFn: () => api.get('/teams/departments/'),
  });

  const { data: rawEmployees } = useQuery<{ id: string; first_name: string; last_name: string; email: string }[]>({
    queryKey: ['teams-employees'],
    queryFn: () => api.get('/teams/employees/?all=true'),
  });

  const departments: { id: string; name: string }[] = Array.isArray(rawDepartments)
    ? rawDepartments
    : Array.isArray((rawDepartments as any)?.results)
    ? (rawDepartments as any).results
    : [];

  const employees: { id: string; first_name: string; last_name: string; email: string }[] = Array.isArray(rawEmployees)
    ? rawEmployees
    : Array.isArray((rawEmployees as any)?.results)
    ? (rawEmployees as any).results
    : [];

  // 1. Fetch Hiring stats
  const { data: stats } = useQuery<HiringStats>({
    queryKey: ['hiring-stats'],
    queryFn: () => api.get('/hiring/stats/'),
  });

  // 2. Fetch Jobs List
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/hiring/jobs/'),
  });
  const jobs: Job[] = Array.isArray(jobsData)
    ? (jobsData as Job[])
    : Array.isArray((jobsData as any)?.results)
    ? (jobsData as any).results
    : [];

  // Find active job title for UI headers
  const activeJob = jobs.find(j => j.id === selectedJobId);

  // 3. Fetch Applications for selected job
  const { data: appsData, isLoading: appsLoading, isError: appsError, refetch: refetchApps } = useQuery({
    queryKey: ['applications', selectedJobId],
    queryFn: () => api.get(`/hiring/jobs/${selectedJobId}/applications/`, { timeoutMs: 15000 }),
    enabled: !!selectedJobId,
    retry: 2,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      const list = Array.isArray(data) ? data : data?.results;
      if (
        list &&
        Array.isArray(list) &&
        list.some((app: any) => app.has_resume && (app.match_score === null || app.match_score === undefined))
      ) {
        return 3000;
      }
      return false;
    }
  });
  const applications: ApplicationSummary[] = Array.isArray(appsData)
    ? (appsData as ApplicationSummary[])
    : Array.isArray((appsData as any)?.results)
    ? (appsData as any).results
    : [];

  // 4. Fetch details of selected application (for evaluations drawer)
  const { data: appDetail, isLoading: detailLoading } = useQuery<ApplicationDetail>({
    queryKey: ['application-detail', selectedAppId],
    queryFn: () => api.get(`/hiring/applications/${selectedAppId}/`),
    enabled: !!selectedAppId,
  });

  // Candidate Resume Blob Preview State
  const [resumeBlobUrl, setResumeBlobUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    if (!appDetail?.candidate_id || !appDetail?.has_resume) {
      setResumeBlobUrl(null);
      setResumeLoading(false);
      setResumeError(null);
      return;
    }

    let isSubscribed = true;
    setResumeLoading(true);
    setResumeError(null);

    const loadResume = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(getApiUrl(`/hiring/candidates/${appDetail.candidate_id}/resume/`), {
          headers,
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`Resume preview failed (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        if (!isSubscribed) return;

        const objectUrl = URL.createObjectURL(blob);
        setResumeBlobUrl(objectUrl);
      } catch (err: any) {
        if (isSubscribed) {
          setResumeError(err.message || 'Failed to load resume');
        }
      } finally {
        if (isSubscribed) {
          setResumeLoading(false);
        }
      }
    };

    loadResume();

    return () => {
      isSubscribed = false;
      if (resumeBlobUrl) {
        URL.revokeObjectURL(resumeBlobUrl);
      }
    };
  }, [appDetail?.candidate_id, appDetail?.has_resume]);

  const resumeDirectUrl = appDetail?.has_resume && appDetail?.candidate_id
    ? `${getApiUrl(`/hiring/candidates/${appDetail.candidate_id}/resume/`)}?token=${(typeof window !== 'undefined' ? localStorage.getItem('access_token') : '') || ''}`
    : null;


  // 4.1 Fetch details of selected applications for comparison
  const { data: rawCompareDetails = [], isLoading: compareLoading } = useQuery<ApplicationDetail[]>({
    queryKey: ['applications-compare', compareIds],
    queryFn: async () => {
      if (compareIds.length === 0) return [];
      const results = await Promise.all(
        compareIds.map(id => api.get(`/hiring/applications/${id}/`))
      );
      return results as ApplicationDetail[];
    },
    enabled: showCompare && compareIds.length > 0,
  });
  const compareDetails: ApplicationDetail[] = Array.isArray(rawCompareDetails) ? rawCompareDetails : [];

  // 5. Auto-trigger match recompute when scores are stale (cleared after job edit)
  const [isRecomputing, setIsRecomputing] = useState(false);
  useEffect(() => {
    // Reset spinner when switching candidates
    setIsRecomputing(false);
  }, [selectedAppId]);
  useEffect(() => {
    if (
      appDetail &&
      appDetail.has_resume &&
      (appDetail.score_skills == null || appDetail.match_score == null) &&
      !isRecomputing
    ) {
      setIsRecomputing(true);
      api.get(`/hiring/applications/${appDetail.id}/match/`)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['application-detail', appDetail.id] });
          queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
        })
        .catch(() => {/* silent — will show stale scores */})
        .finally(() => setIsRecomputing(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appDetail?.id, appDetail?.score_skills, appDetail?.match_score, appDetail?.has_resume]);

  // Auto scroll Copilot chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: (newJob: any) => api.post('/hiring/jobs/', newJob),
    onSuccess: (data: any) => {
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return [data, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      setShowCreateJob(false);
      // Reset form
      setJobTitle('');
      setJobDept('');
      setJobDesc('');
      setJobReqs('');
      setJobExp('');
      setJobStatus('open');
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => api.delete(`/hiring/jobs/${jobId}/`),
    onSuccess: (_data, jobId) => {
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((j: any) => j.id !== jobId);
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      setSelectedJobId(null);
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: any }) =>
      api.patch(`/hiring/jobs/${jobId}/`, data),
    onSuccess: (updatedJob, variables) => {
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j: any) => j.id === variables.jobId ? { ...j, ...updatedJob } : j);
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      setEditingJob(null);
    }
  });

  const createCandidateMutation = useMutation({
    mutationFn: (formData: FormData) => api.post(`/hiring/jobs/${selectedJobId}/applications/`, formData),
    onSuccess: (newApp) => {
      queryClient.setQueryData(['applications', selectedJobId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return [newApp, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      setShowAddCandidate(false);
      // Reset form
      setCandFirst('');
      setCandLast('');
      setCandEmail('');
      setCandPhone('');
      setCandResume(null);
      setCandSource('linkedin');
      setCandSourceDetails('');
    }
  });



  const updateStageMutation = useMutation({
    mutationFn: ({ appId, stage, notes, rejection_reason, send_email, custom_message }: { appId: string; stage: string; notes: string; rejection_reason?: string; send_email?: boolean; custom_message?: string }) =>
      api.patch(`/hiring/applications/${appId}/stage/`, { stage, notes, rejection_reason, send_email, custom_message }),
    onSuccess: (updatedApp, variables) => {
      queryClient.setQueryData(['application-detail', variables.appId], (old: any) => {
        if (!old) return updatedApp;
        return { ...old, ...updatedApp };
      });
      queryClient.setQueryData(['applications', selectedJobId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((app: any) => app.id === variables.appId ? { ...app, stage: variables.stage } : app);
      });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.appId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      setIsPromoting(null);
      setStageNotes('');
      setRejectionReason('');
      setRejectionSendEmail(true);
      setRejectionCustomEmail('');

      if (variables.stage === 'rejected') {
        coreAlert({
          title: 'Candidate Rejected',
          description: variables.send_email !== false 
            ? `Candidate has been moved to Rejected and a courteous rejection email was sent.` 
            : `Candidate has been moved to Rejected (no email sent).`,
          variant: 'info'
        });
      }
    }
  });

  const addInterviewNoteMutation = useMutation({
    mutationFn: ({ appId, score, notes }: { appId: string; score: number; notes: string }) =>
      api.post(`/hiring/applications/${appId}/notes/`, { score, notes }),
    onSuccess: (newNote, variables) => {
      queryClient.setQueryData(['application-detail', variables.appId], (old: any) => {
        if (!old) return old;
        const notes = old.interview_notes || [];
        return { ...old, interview_notes: [newNote, ...notes] };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', variables.appId] });
      setNoteText('');
      setNoteScore(5);
    }
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/hiring/applications/${selectedAppId}/interviews/`, data),
    onSuccess: (newSchedule) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        const schedules = old.interview_schedules || [];
        return { ...old, interview_schedules: [...schedules, newSchedule] };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      setShowScheduleForm(false);
      setSchedDateOnly(getTomorrowDateStr()); setSchedTime('10:00'); setSchedLink(''); setSchedInterviewers(''); setSchedAgenda('');
      setSchedDuration(60); setSchedType('video');
      coreAlert({
        title: 'Interview Scheduled',
        description: `Interview session successfully scheduled for ${appDetail?.candidate_name || 'candidate'}.`,
        variant: 'success',
        icon: <CheckCircle2 className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Schedule Interview',
        description: err?.data?.error || err?.response?.data?.error || err?.message || 'Could not schedule interview.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const updateScheduleStatusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: string; status: string }) =>
      api.patch(`/hiring/applications/${selectedAppId}/interviews/${scheduleId}/`, { status }),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        const schedules = (old.interview_schedules || []).map((s: any) =>
          s.id === variables.scheduleId ? { ...s, status: variables.status } : s
        );
        return { ...old, interview_schedules: schedules };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      api.delete(`/hiring/applications/${selectedAppId}/interviews/${scheduleId}/`),
    onSuccess: (_, scheduleId) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        const schedules = (old.interview_schedules || []).filter((s: any) => s.id !== scheduleId);
        return { ...old, interview_schedules: schedules };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
    },
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: (appId: string) => api.delete(`/hiring/applications/${appId}/`),
    onSuccess: (_, appId) => {
      queryClient.setQueryData(['applications', selectedJobId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((app: any) => app.id !== appId);
      });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['governance-stats'] });
      if (selectedAppId === appId) {
        setSelectedAppId(null);
      }
      setCompareIds(prev => prev.filter(id => id !== appId));
      setCandidateToDelete(null);
      coreAlert({
        title: 'Candidate Deleted',
        description: 'Candidate application, resume document, and AI vector embeddings have been deleted permanently.',
        variant: 'success',
        icon: <CheckCircle2 className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      setCandidateToDelete(null);
      coreAlert({
        title: 'Deletion Failed',
        description: err?.response?.data?.error || err?.message || 'Could not delete candidate application.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const submitScorecardMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/hiring/applications/${selectedAppId}/scorecards/`, data),
    onSuccess: (newScorecard) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        const scorecards = old.scorecards || [];
        return { ...old, scorecards: [...scorecards, newScorecard] };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      setShowScorecardForm(false);
      setScorecardScores({}); setScorecardStrengths(''); setScorecardConcerns('');
      setScorecardRec('yes');
    }
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['hiring-analytics', selectedJobId],
    queryFn: () => selectedJobId 
      ? api.get(`/hiring/jobs/${selectedJobId}/analytics/`)
      : api.get('/hiring/analytics/'),
    enabled: showAnalytics
  });

  const { data: rawEmailTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: () => api.get('/hiring/email-templates/'),
    enabled: !!selectedAppId && activeDrawerTab === 'emails'
  });
  const emailTemplates: EmailTemplate[] = Array.isArray(rawEmailTemplates)
    ? rawEmailTemplates
    : Array.isArray((rawEmailTemplates as any)?.results)
    ? (rawEmailTemplates as any).results
    : [];

  const { data: rawEmailLogs, refetch: refetchEmailLogs } = useQuery<EmailLog[]>({
    queryKey: ['email-logs', selectedAppId],
    queryFn: () => api.get(`/hiring/applications/${selectedAppId}/emails/`),
    enabled: !!selectedAppId && activeDrawerTab === 'emails'
  });
  const emailLogs: EmailLog[] = Array.isArray(rawEmailLogs)
    ? rawEmailLogs
    : Array.isArray((rawEmailLogs as any)?.results)
    ? (rawEmailLogs as any).results
    : [];

  const sendManualEmailMutation = useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      api.post(`/hiring/applications/${selectedAppId}/emails/send/`, data),
    onSuccess: () => {
      refetchEmailLogs();
      queryClient.invalidateQueries({ queryKey: ['email-logs', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      setComposeSubject('');
      setComposeBody('');
      setSelectedTemplateId('');
      coreAlert({
        title: 'Email Sent Successfully',
        description: `Candidate email has been dispatched to ${appDetail?.candidate_name || 'the candidate'}.`,
        variant: 'success',
        icon: <Mail className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Send Email',
        description: err?.response?.data?.error || err?.message || 'Could not send email to candidate.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const simulateInboundReplyMutation = useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      api.post(`/hiring/applications/${selectedAppId}/emails/simulate-reply/`, data),
    onSuccess: () => {
      refetchEmailLogs();
      queryClient.invalidateQueries({ queryKey: ['email-logs', selectedAppId] });
      setShowSimulateReplyModal(false);
      coreAlert({
        title: 'Inbound Reply Logged',
        description: 'Simulated reply from candidate received and added to conversation history.',
        variant: 'success',
        icon: <MessageSquare className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Simulation Failed',
        description: err?.data?.error || err?.message || 'Could not simulate candidate reply.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const updateJobStagesMutation = useMutation({
    mutationFn: (stages: PipelineStageConfig[]) =>
      api.patch(`/hiring/jobs/${selectedJobId}/stages/`, { pipeline_stages: stages }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-jobs'] });
      setShowCustomizeStagesModal(false);
      coreAlert({
        title: 'Pipeline Stages Saved',
        description: 'Job pipeline stages have been successfully updated.',
        variant: 'success',
        icon: <Sliders className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Update Failed',
        description: err?.data?.error || err?.message || 'Could not update pipeline stages.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const { data: rawInvitations, refetch: refetchInvitations } = useQuery<InterviewInvitation[]>({
    queryKey: ['interview-invitations', selectedAppId],
    queryFn: () => api.get(`/hiring/applications/${selectedAppId}/invitations/`),
    enabled: !!selectedAppId && activeDrawerTab === 'eval'
  });
  const invitations: InterviewInvitation[] = Array.isArray(rawInvitations)
    ? rawInvitations
    : Array.isArray((rawInvitations as any)?.results)
    ? (rawInvitations as any).results
    : [];

  const createInvitationMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/hiring/applications/${selectedAppId}/invitations/`, data),
    onSuccess: (newInv: any) => {
      refetchInvitations();
      queryClient.invalidateQueries({ queryKey: ['interview-invitations', selectedAppId] });
      setNewlyCreatedInviteToken(newInv.token);
      coreAlert({
        title: 'Booking Link Generated',
        description: 'Candidate self-service scheduling link is ready to share.',
        variant: 'success',
        icon: <Calendar className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Generation Failed',
        description: err?.data?.error || err?.message || 'Could not generate self-service link.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const saveOfferMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/hiring/applications/${selectedAppId}/offer/`, data),
    onSuccess: (newOffer) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        return { ...old, offer: newOffer };
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      coreAlert({
        title: 'Draft Offer Saved',
        description: 'Candidate offer letter terms and compensation details have been stored as a draft.',
        variant: 'success',
        icon: <FileText className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Save Offer',
        description: err?.response?.data?.error || err?.message || 'Could not save draft offer.',
        variant: 'destructive'
      });
    }
  });

  const extendOfferMutation = useMutation({
    mutationFn: () =>
      api.post(`/hiring/applications/${selectedAppId}/offer/extend/`),
    onSuccess: (data) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        return { ...old, offer: data, stage: 'offer' };
      });
      queryClient.setQueryData(['applications', selectedJobId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((app: any) => app.id === selectedAppId ? { ...app, stage: 'offer' } : app);
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      coreAlert({
        title: 'Offer Extended!',
        description: `The job offer has been officially extended to ${appDetail?.candidate_name || 'the candidate'}.`,
        variant: 'success',
        icon: <Send className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Extend Offer',
        description: err?.response?.data?.error || err?.message || 'Could not extend offer to candidate.',
        variant: 'destructive'
      });
    }
  });

  const respondOfferMutation = useMutation({
    mutationFn: (response: 'accepted' | 'declined') =>
      api.post(`/hiring/applications/${selectedAppId}/offer/respond/`, { response }),
    onSuccess: (data) => {
      queryClient.setQueryData(['application-detail', selectedAppId], (old: any) => {
        if (!old) return old;
        const newStage = data.status === 'accepted' ? 'hired' : old.stage;
        return { ...old, offer: data, stage: newStage };
      });
      queryClient.setQueryData(['applications', selectedJobId], (old: any) => {
        if (!Array.isArray(old)) return old;
        const newStage = data.status === 'accepted' ? 'hired' : undefined;
        return old.map((app: any) => app.id === selectedAppId ? { ...app, stage: newStage || app.stage } : app);
      });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      coreAlert({
        title: 'Offer Status Updated',
        description: `Offer marked as ${data.status} for ${appDetail?.candidate_name || 'the candidate'}.`,
        variant: data.status === 'accepted' ? 'success' : 'destructive',
        icon: data.status === 'accepted' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Update Offer',
        description: err?.response?.data?.error || err?.message || 'Could not update offer status.',
        variant: 'destructive'
      });
    }
  });

  const handleDownloadOfferPdf = async () => {
    if (!selectedAppId) return;
    try {
      setIsDownloadingOfferPdf(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(getApiUrl(`/hiring/applications/${selectedAppId}/offer/pdf/`), {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let errMsg = 'Could not generate or download offer letter PDF.';
        try {
          const errJson = await res.json();
          if (errJson.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Offer_Letter_${(appDetail?.candidate_name || 'Candidate').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      coreAlert({
        title: 'Download Failed',
        description: err?.message || 'Could not generate or download offer letter PDF.',
        variant: 'destructive'
      });
    } finally {
      setIsDownloadingOfferPdf(false);
    }
  };

  const sendOfferPdfEmailMutation = useMutation({
    mutationFn: () =>
      api.post(`/hiring/applications/${selectedAppId}/offer/send-email/`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['application-emails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      coreAlert({
        title: 'Offer Letter Emailed!',
        description: data?.message || `Official offer letter with PDF attachment was sent to ${appDetail?.candidate_email}.`,
        variant: 'success',
        icon: <Send className="h-5 w-5" />
      });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Failed to Send Offer Email',
        description: err?.response?.data?.error || err?.message || 'Could not email offer letter.',
        variant: 'destructive'
      });
    }
  });

  const copilotMutation = useMutation({
    mutationFn: (param: string | { question: string; history?: { role: string; content: string }[] }) => {
      const payload = typeof param === 'string' ? { question: param } : param;
      return api.post<{ answer: string }>(`/hiring/jobs/${selectedJobId}/chat/`, payload, { timeoutMs: 45000 });
    },
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'No response.' }]);
    },
    onError: (err: any) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message || 'Failed to generate response.'}` }]);
    }
  });

  const onboardCandidateMutation = useMutation({
    mutationFn: (data: any) => api.post(`/hiring/applications/${selectedAppId}/onboard/`, data),
    onSuccess: (data: any) => {
      setOnboardResult(data);
      queryClient.invalidateQueries({ queryKey: ['application-detail', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
      queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hiring-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeesList'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Onboarding Failed',
        description: err?.data?.error || err?.response?.data?.error || err?.message || 'Failed to onboard candidate.',
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: () => api.post(`/hiring/applications/${selectedAppId}/generate-questions/`, {}),
    onSuccess: (data: any) => {
      setGeneratedQuestions(data.questions || []);
    },
    onError: (err: any) => {
      coreAlert({
        title: 'Question Generation Failed',
        description: err?.response?.data?.error || err?.message || 'Failed to generate interview questions.',
        variant: 'warning',
        icon: <AlertCircle className="h-5 w-5" />
      });
    }
  });

  // Submit handlers
  const handleCreateJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    createJobMutation.mutate({
      title: jobTitle,
      department: jobDept,
      description: jobDesc,
      requirements: jobReqs,
      experience_requirements: jobExp,
      status: jobStatus
    });
  };

  const handleAddCandidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candFirst.trim() || !candLast.trim() || !candEmail.trim()) return;

    const fd = new FormData();
    fd.append('first_name', candFirst);
    fd.append('last_name', candLast);
    fd.append('email', candEmail);
    fd.append('phone', candPhone);
    fd.append('source', candSource);
    fd.append('source_details', candSourceDetails);
    if (candResume) {
      fd.append('resume', candResume);
    }
    createCandidateMutation.mutate(fd);
  };

  const handleResumeDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setResumeDragActive(true);
    } else if (e.type === "dragleave") {
      setResumeDragActive(false);
    }
  };

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResumeDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadResumeFiles(e.dataTransfer.files);
    }
  };

  const handleResumeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadResumeFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  const startSingleFileUpload = (fileObj: File, itemId: string) => {
    if (!selectedJobId) return;

    setResumeUploadQueue((prev) =>
      prev.map((f) => (f.id === itemId ? { ...f, status: 'uploading', progress: 0, error: undefined } : f))
    );

    const formData = new FormData();
    formData.append('resumes', fileObj);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.timeout = 120000; // 2 minutes timeout to tolerate free-tier server cold-starts & container restarts
    xhr.open('POST', getApiUrl(`/hiring/jobs/${selectedJobId}/bulk-upload/`), true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // CSRF token if cookie is present
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    if (csrfMatch) {
      xhr.setRequestHeader('X-CSRFToken', csrfMatch[1]);
    }

    // Track actual upload progress
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        setResumeUploadQueue((prev) =>
          prev.map((f) => (f.id === itemId ? { ...f, progress: Math.min(percentage, 95) } : f))
        );
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setResumeUploadQueue((prev) =>
          prev.map((f) => (f.id === itemId ? { ...f, status: 'parsing', progress: 100 } : f))
        );

        // Instantly refresh pipelines so parsed candidates populate in background
        queryClient.invalidateQueries({ queryKey: ['applications', selectedJobId] });
        queryClient.invalidateQueries({ queryKey: ['hiring-stats'] });
        queryClient.invalidateQueries({ queryKey: ['hiring-analytics', selectedJobId] });

        setTimeout(() => {
          setResumeUploadQueue((prev) =>
            prev.map((f) => (f.id === itemId ? { ...f, status: 'completed' } : f))
          );
        }, 1500);
      } else {
        let errorMsg = `Upload failed (${xhr.status || 'unknown'})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            errorMsg = parsed.errors.join(', ');
          } else if (typeof parsed.error === 'string') {
            errorMsg = parsed.error;
          } else if (typeof parsed.detail === 'string') {
            errorMsg = parsed.detail;
          } else if (parsed.error && typeof parsed.error === 'object' && parsed.error.detail) {
            errorMsg = parsed.error.detail;
          }
        } catch {
          if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
            errorMsg = 'Backend server is restarting or deploying. Please click Retry.';
          } else if (xhr.statusText) {
            errorMsg = `${xhr.statusText} (${xhr.status})`;
          }
        }
        setResumeUploadQueue((prev) =>
          prev.map((f) => (f.id === itemId ? { ...f, status: 'failed', progress: 100, error: errorMsg } : f))
        );
      }
    };

    xhr.onerror = () => {
      setResumeUploadQueue((prev) =>
        prev.map((f) => (f.id === itemId ? { ...f, status: 'failed', progress: 100, error: 'Network error (server waking up or deploying). Click Retry.' } : f))
      );
    };

    xhr.ontimeout = () => {
      setResumeUploadQueue((prev) =>
        prev.map((f) => (f.id === itemId ? { ...f, status: 'failed', progress: 100, error: 'Request timed out (server warming up). Click Retry.' } : f))
      );
    };

    xhr.send(formData);
  };

  const uploadResumeFiles = (files: FileList | File[]) => {
    if (!selectedJobId || !files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newItems: UploadingResume[] = fileArray.map((file) => ({
      id: `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
      file: file,
    }));

    setResumeUploadQueue((prev) => [...newItems, ...prev]);

    fileArray.forEach((fileObj, index) => {
      startSingleFileUpload(fileObj, newItems[index].id);
    });
  };

  const handleStageUpdate = (stage: string) => {
    if (!selectedAppId) return;
    updateStageMutation.mutate({
      appId: selectedAppId,
      stage,
      notes: stageNotes,
      rejection_reason: stage === 'rejected' ? rejectionReason : undefined,
      send_email: stage === 'rejected' ? rejectionSendEmail : true,
      custom_message: stage === 'rejected' && rejectionSendEmail ? rejectionCustomEmail : undefined,
    });
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId || !noteText.trim()) return;
    addInterviewNoteMutation.mutate({
      appId: selectedAppId,
      score: noteScore,
      notes: noteText
    });
  };

  const handleCopilotSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || copilotMutation.isPending) return;

    const query = chatInput.trim();
    const currentHistory = chatMessages
      .filter((m) => !m.content.startsWith('Error:'))
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));
    setChatMessages((prev) => [...prev, { role: 'user', content: query }]);
    setChatInput('');
    copilotMutation.mutate({ question: query, history: currentHistory });
  };

  const getStageColor = (stage: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ";
    switch (stage?.toLowerCase()) {
      case 'applied':
        return base + "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400";
      case 'screening':
        return base + "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400";
      case 'interview':
        return base + "bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400";
      case 'offer':
        return base + "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400";
      case 'hired':
        return base + "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400";
      case 'rejected':
        return base + "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400";
      default:
        return base + "bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800";
    }
  };

  const getStageLabel = (stageId: string) => {
    if (!stageId) return '';
    if (activeJob?.pipeline_stages && activeJob.pipeline_stages.length > 0) {
      const found = activeJob.pipeline_stages.find(s => s.id.toLowerCase() === stageId.toLowerCase());
      if (found) return found.name;
    }
    return stageId.charAt(0).toUpperCase() + stageId.slice(1).replace(/_/g, ' ');
  };

  const getMatchScoreBadge = (score?: number) => {
    if (score === undefined || score === null) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3 animate-pulse text-amber-500" /> Analyzing...
        </span>
      );
    }
    const percent = Math.round(score * 100);
    let color = "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20";
    if (percent >= 75) {
      color = "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20";
    } else if (percent >= 50) {
      color = "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20";
    }

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${color}`}>
        <Award className="h-3.5 w-3.5" /> {percent}% Fit
      </span>
    );
  };

  const getWinner = (key: 'match_score' | 'score_skills' | 'score_experience' | 'score_projects' | 'score_education') => {
    if (!compareDetails || compareDetails.length === 0) return null;
    let maxVal = -1;
    let winnerId: string | null = null;
    compareDetails.forEach(c => {
      const val = (c as any)[key] ?? 0;
      if (val > maxVal) {
        maxVal = val;
        winnerId = c.id;
      }
    });
    if (maxVal <= 0) return null;
    return winnerId;
  };

  const setQuickSchedule = (daysFromNow: number, timeStr: string) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setSchedDateOnly(d.toISOString().split('T')[0]);
    setSchedTime(timeStr);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedDateOnly) return;
    const timeVal = schedTime || '10:00';
    const parsedDate = new Date(`${schedDateOnly}T${timeVal}:00`);
    const scheduledIso = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
    scheduleInterviewMutation.mutate({
      scheduled_at: scheduledIso,
      duration_min: Number(schedDuration),
      interview_type: schedType,
      meeting_link: schedLink,
      interviewers: schedInterviewers.split(',').map(name => name.trim()).filter(Boolean),
      agenda: schedAgenda,
      use_core_meeting: useCoreMeeting,
    });
  };

  const handleScorecardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentStage = appDetail?.stage || 'screening';
    const dims = STAGE_DIMENSIONS[currentStage] || STAGE_DIMENSIONS['default'];
    
    const finalScores: Record<string, number> = {};
    dims.forEach(d => {
      finalScores[d] = scorecardScores[d] || 3;
    });

    submitScorecardMutation.mutate({
      stage: currentStage,
      scores: finalScores,
      recommendation: scorecardRec,
      strengths: scorecardStrengths,
      concerns: scorecardConcerns,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ATS Header with Statistics */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Hiring Pipeline & ATS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 leading-snug">
            Manage organization job postings, AI resume scoring, candidate stages, and interview pipelines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:self-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const careersUrl = `${window.location.origin}/careers/${tenantSlug}`;
              window.open(careersUrl, '_blank');
            }}
            className="text-xs font-bold gap-1.5 h-9"
            title="Open Public Careers Portal in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            Careers Portal
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const careersUrl = `${window.location.origin}/careers/${tenantSlug}`;
              if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(careersUrl);
              }
              setCareersCopied(true);
              setTimeout(() => setCareersCopied(false), 2000);
            }}
            className="h-9 w-9"
            title="Copy Public Careers Portal Link"
          >
            {careersCopied ? <CheckCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
          </Button>
          <Button onClick={() => setShowCreateJob(true)} className="text-xs font-bold gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4" /> Create Job Opening
          </Button>
        </div>
      </div>

      {/* Dashboard Overview Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Open Positions</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {stats?.open_positions ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Total Apps (Month)</span>
            <span className="text-2xl font-black text-primary">
              {stats?.applications_month ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Active Apps (Week)</span>
            <span className="text-2xl font-black text-amber-500">
              {stats?.applications_week ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Avg Time To Hire</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {stats?.avg_days_to_hire ? `${stats.avg_days_to_hire} Days` : 'N/A'}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: Job Openings List */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Briefcase className="h-4.5 w-4.5 text-primary" />
                Active Openings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {jobsLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : jobs && jobs.length > 0 ? (
                  jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full text-left p-3.5 border rounded-xl flex items-center justify-between transition-all duration-200 ${
                        selectedJobId === job.id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                          : 'border-border bg-slate-50/40 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-950/30'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 block truncate">
                          {job.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                            {job.department || 'General'}
                          </span>
                          <span className="h-1 w-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                          <span className="text-[9px] uppercase font-extrabold text-primary">
                            {job.application_count} Apps
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingJob(job);
                            setEditTitle(job.title);
                            setEditDept(job.department || '');
                            setEditDesc(job.description || '');
                            setEditReqs(job.requirements || '');
                            setEditExp(job.experience_requirements || '');
                            setEditStatus(job.status);
                          }}
                          className="h-7 w-7 text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10 rounded-lg p-0"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingJobId(job.id);
                          }}
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg p-0"
                          disabled={deleteJobMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-16">No open job postings listed.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Candidate Applications Table */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border shadow-sm bg-white dark:bg-slate-900 min-h-[560px] flex flex-col">
            <CardHeader className="border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 sm:py-4">
              <CardTitle className="text-sm font-black flex items-center gap-2 truncate">
                <Users className="h-4.5 w-4.5 text-primary shrink-0" />
                <span className="truncate">Pipeline: {activeJob ? activeJob.title : 'None Selected'}</span>
              </CardTitle>

              {/* Action Buttons for selected job */}
              {selectedJobId && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const stages = activeJob?.pipeline_stages && activeJob.pipeline_stages.length > 0
                        ? activeJob.pipeline_stages
                        : [
                            { id: 'applied', name: 'Applied' },
                            { id: 'screening', name: 'Screening' },
                            { id: 'interview', name: 'Interview' },
                            { id: 'offer', name: 'Offer' },
                            { id: 'hired', name: 'Hired' },
                          ];
                      setCustomStagesDraft(stages);
                      setNewStageName('');
                      setShowCustomizeStagesModal(true);
                    }}
                    className="text-xs font-semibold h-8.5 gap-1.5 px-3 flex-1 sm:flex-none text-slate-800 dark:text-slate-200 border-border hover:bg-primary/5 hover:text-primary transition-colors"
                    title="Customize Pipeline Stages for this Job"
                  >
                    <Sliders className="h-4 w-4 text-primary" /> Stages
                  </Button>
                  <Button 
                    type="button"
                    variant={showAnalytics ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setShowAnalytics(!showAnalytics)} 
                    className={`text-xs font-semibold h-8.5 gap-1.5 px-3 flex-1 sm:flex-none ${showAnalytics ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                  >
                    <BarChart3 className="h-4 w-4" /> {showAnalytics ? 'Pipeline' : 'Analytics'}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowCopilot(true)}
                    className="text-xs font-semibold h-8.5 gap-1.5 px-3 flex-1 sm:flex-none text-slate-800 dark:text-slate-200 border-border hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowBulkUpload(true)} 
                    className="text-xs font-semibold h-8.5 gap-1.5 px-3 flex-1 sm:flex-none text-slate-800 dark:text-slate-200 border-border hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <FileUp className="h-4 w-4 text-primary" /> Upload Resumes
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col justify-between">
              {selectedJobId ? (
                showAnalytics ? (
                  <div className="p-6 space-y-6 animate-in fade-in duration-200">
                    {analyticsLoading ? (
                      <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : analyticsData ? (
                      <div className="space-y-6">
                        {/* 4 Executive Metric Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                          <div className="bg-slate-50 dark:bg-slate-950/25 p-4 rounded-2xl border border-border">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider mb-1 flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-primary" /> Total In Funnel
                            </span>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{analyticsData.total_applications}</span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Active & archived</span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950/25 p-4 rounded-2xl border border-border">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider mb-1 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-violet-500" /> Avg Time to Hire
                            </span>
                            <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
                              {analyticsData.avg_time_to_hire_days != null ? `${analyticsData.avg_time_to_hire_days}d` : 'N/A'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Application to offer accept</span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950/25 p-4 rounded-2xl border border-border">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider mb-1 flex items-center gap-1.5">
                              <Trophy className="h-3.5 w-3.5 text-emerald-500" /> Offer Acceptance
                            </span>
                            <span className="text-2xl font-black text-emerald-600">
                              {analyticsData.offer_acceptance_rate != null 
                                ? `${Math.round(analyticsData.offer_acceptance_rate * 100)}%` 
                                : '0%'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Signed candidate offers</span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-950/25 p-4 rounded-2xl border border-border">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider mb-1 flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-amber-500" /> Scorecard Rating
                            </span>
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                              {analyticsData.avg_scorecard_rating != null ? `${analyticsData.avg_scorecard_rating} / 5.0` : 'N/A'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Average interviewer score</span>
                          </div>
                        </div>

                        {/* Conversion Funnel with Drop-off % */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                              Funnel Velocity & Drop-off Analysis
                            </h4>
                            <span className="text-[10px] font-semibold text-slate-500">Pipeline conversion health</span>
                          </div>

                          <div className="border border-border rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3.5 shadow-sm">
                            {analyticsData.stage_funnel?.map((f: any, idx: number) => (
                              <div key={f.stage} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-500">
                                      {idx + 1}
                                    </span>
                                    <span className="font-extrabold uppercase text-[11px] text-slate-800 dark:text-slate-200">
                                      {f.stage}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <span className="text-slate-900 dark:text-slate-100 font-mono">{f.count} candidates</span>
                                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      Conv: {Math.round(f.conversion_rate * 100)}%
                                    </span>
                                    {f.drop_off_pct != null && f.drop_off_pct > 0 && (
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        f.drop_off_pct >= 50 
                                          ? 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30' 
                                          : 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30'
                                      }`}>
                                        Drop-off: {f.drop_off_pct}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.max(4, Math.round(f.conversion_rate * 100))}%` }} 
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Stage Velocity & Scorecard Review Consensus */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Velocity Metric */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Velocity: Average Days in Stage</h4>
                            <div className="grid grid-cols-2 gap-2.5">
                              {analyticsData.avg_stage_time?.map((t: any) => (
                                <div key={t.stage} className="flex justify-between items-center bg-slate-50/70 dark:bg-slate-950/30 border border-border p-3 rounded-xl">
                                  <span className="font-extrabold text-[10px] uppercase text-slate-500">{t.stage}</span>
                                  <span className="font-black text-slate-800 dark:text-slate-100 text-xs">
                                    {t.avg_days != null ? `${Number(t.avg_days).toFixed(1)}d` : '0.0d'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Scorecard Consensus Breakdown */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Scorecard Recommendations</h4>
                            <div className="bg-slate-50/70 dark:bg-slate-950/30 border border-border p-3 rounded-xl space-y-2">
                              {analyticsData.scorecard_recommendations ? (
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-border">
                                    <span className="text-[9px] font-bold uppercase text-emerald-600 block">Strong Yes / Yes</span>
                                    <span className="font-black text-sm text-emerald-600">
                                      {(analyticsData.scorecard_recommendations['strong_yes'] || 0) + (analyticsData.scorecard_recommendations['yes'] || 0)}
                                    </span>
                                  </div>
                                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-border">
                                    <span className="text-[9px] font-bold uppercase text-amber-500 block">Maybe</span>
                                    <span className="font-black text-sm text-amber-500">
                                      {analyticsData.scorecard_recommendations['maybe'] || 0}
                                    </span>
                                  </div>
                                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-border">
                                    <span className="text-[9px] font-bold uppercase text-rose-500 block">No / Strong No</span>
                                    <span className="font-black text-sm text-rose-500">
                                      {(analyticsData.scorecard_recommendations['no'] || 0) + (analyticsData.scorecard_recommendations['strong_no'] || 0)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-xs text-muted-foreground py-2">No scorecards recorded yet.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sourcing Channels Metric */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Candidate Sourcing Channels & Quality</h4>
                          <div className="border border-border rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                            {analyticsData.source_metrics && analyticsData.source_metrics.length > 0 ? (
                              analyticsData.source_metrics.map((s: any) => (
                                <div key={s.source} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-extrabold uppercase text-[10px] text-slate-700 dark:text-slate-350">{s.source}</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold">
                                      <span className="text-slate-900 dark:text-slate-100">{s.count} candidates</span>
                                      <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        Hired: {s.hired_count} (Conv: {Math.round(s.conversion_rate * 100)}%)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div 
                                      className="h-full bg-violet-500 rounded-full transition-all duration-500" 
                                      style={{ width: `${Math.round(s.conversion_rate * 100)}%` }} 
                                    />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-[10px] text-muted-foreground py-2">No sourcing data recorded.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-xs text-muted-foreground py-10">No analytics data available yet.</div>
                    )}
                  </div>
                ) : appsLoading ? (
                  <div className="flex flex-1 items-center justify-center py-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : appsError ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground gap-3 py-32">
                    <AlertCircle className="h-10 w-10 text-rose-500" />
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Failed to load candidate applications.</span>
                    <p className="text-[10px] max-w-xs text-muted-foreground">The server took too long to respond or encountered an issue.</p>
                    <Button size="sm" variant="outline" onClick={() => refetchApps()} className="text-xs">
                      Retry
                    </Button>
                  </div>
                ) : applications && applications.length > 0 ? (
                  <>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 dark:bg-slate-900/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-border">
                            <th className="pl-4 pr-2 py-3.5 w-8"></th>
                            <th className="px-4 py-3.5">Candidate</th>
                            <th className="px-6 py-3.5">AI Suitability</th>
                            <th className="px-6 py-3.5">Pipeline Stage</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-xs">
                          {applications.map((app) => (
                            <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all duration-150 group/row">
                              {/* Compare checkbox */}
                              <td className="pl-4 pr-2 py-4 w-8">
                                <input
                                  type="checkbox"
                                  checked={compareIds.includes(app.id)}
                                  disabled={!compareIds.includes(app.id) && compareIds.length >= 3}
                                  onChange={(e) => {
                                    if (e.target.checked) setCompareIds(prev => [...prev, app.id]);
                                    else setCompareIds(prev => prev.filter(id => id !== app.id));
                                  }}
                                  className="h-3.5 w-3.5 rounded accent-primary cursor-pointer opacity-0 group-hover/row:opacity-100 checked:opacity-100 transition-opacity"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <button 
                                  onClick={() => setSelectedAppId(app.id)}
                                  className="text-left group outline-none"
                                >
                                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block group-hover:underline group-hover:text-primary transition-all">
                                    {app.candidate_name}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-mono mt-0.5">{app.candidate_email}</span>
                                </button>
                              </td>
                              <td className="px-6 py-4">
                                {getMatchScoreBadge(app.match_score)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={getStageColor(app.stage)}>{app.stage}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedAppId(app.id)}
                                    className="text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                  >
                                    Evaluate <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCandidateToDelete({ id: app.id, name: app.candidate_name });
                                    }}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    title={`Delete candidate ${app.candidate_name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Floating Compare Action Bar */}
                    {compareIds.length >= 2 && (
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-full shadow-2xl border border-border animate-in slide-in-from-bottom-4 duration-300">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-bold">{compareIds.length} candidates selected</span>
                        <Button
                          size="sm"
                          className="h-7 text-[11px] font-bold bg-primary text-white hover:bg-primary/90 rounded-full px-4"
                          onClick={() => setShowCompare(true)}
                        >
                          Compare Side-by-Side
                        </Button>
                        <button onClick={() => setCompareIds([])} className="text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 transition-colors ml-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground gap-2 py-32">
                    <UserPlus className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-bounce" />
                    <span className="text-xs font-bold">No candidate applications added to this opening yet.</span>
                    <p className="text-[10px] max-w-xs text-muted-foreground/80">Upload resume PDFs using single or bulk import methods above to trigger the parsing engine.</p>
                  </div>
                )
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground gap-2 py-32">
                  <Briefcase className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-bold">Select a job opening from the sidebar.</span>
                  <p className="text-[10px] max-w-xs text-muted-foreground/80">View candidate pipelines, match metrics, and manage stage progressions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* dialog 1: Create Job Opening */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Create Job Opening
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateJobSubmit} className="space-y-4 my-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Job Title *</label>
              <Input
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
              <Input
                value={jobDept}
                onChange={(e) => setJobDept(e.target.value)}
                placeholder="e.g. Engineering"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Job Description</label>
              <textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Write key duties, work expectations..."
                rows={3}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Required Skills (for AI Matching) *</label>
              <textarea
                required
                value={jobReqs}
                onChange={(e) => setJobReqs(e.target.value)}
                placeholder="List required skills (e.g. React, Django, Python, SQL) separated by commas or lines."
                rows={3}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Experience Requirements (for AI Matching)</label>
              <textarea
                value={jobExp}
                onChange={(e) => setJobExp(e.target.value)}
                placeholder="e.g. 3+ years of backend development, experience with distributed systems, prior team lead role..."
                rows={2}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreateJob(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={createJobMutation.isPending} className="h-9 text-xs font-bold">
                {createJobMutation.isPending ? 'Saving...' : 'Post Job'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Job Posting Dialog */}
      <Dialog open={!!editingJob} onOpenChange={() => setEditingJob(null)}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" /> Edit Job Opening
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground mt-1">
              Saving changes will automatically re-evaluate all candidate scores for this job.
            </p>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingJob || !editTitle.trim()) return;
              updateJobMutation.mutate({
                jobId: editingJob.id,
                data: {
                  title: editTitle,
                  department: editDept,
                  description: editDesc,
                  requirements: editReqs,
                  experience_requirements: editExp,
                  status: editStatus,
                }
              });
            }}
            className="space-y-3 my-2 text-xs"
          >
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Job Title *</label>
              <Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer" className="text-xs h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                <Input value={editDept} onChange={(e) => setEditDept(e.target.value)}
                  placeholder="e.g. Engineering" className="text-xs h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-9 border border-input bg-background rounded-md px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="open">Open</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Job Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Key duties and responsibilities..." rows={2}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Required Skills (for AI Matching)</label>
              <textarea value={editReqs} onChange={(e) => setEditReqs(e.target.value)}
                placeholder="e.g. React, Django, Python, SQL..." rows={2}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Experience Requirements (for AI Matching)</label>
              <textarea value={editExp} onChange={(e) => setEditExp(e.target.value)}
                placeholder="e.g. 3+ years of backend development, prior team lead role..." rows={2}
                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingJob(null)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={updateJobMutation.isPending} className="h-9 text-xs font-bold">
                {updateJobMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Styled Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={!!deletingJobId}
        onOpenChange={(open) => !open && setDeletingJobId(null)}
        title="Delete Job Opening"
        description={
          <>
            Are you sure you want to delete <strong className="text-foreground font-semibold">"{jobs?.find(j => j.id === deletingJobId)?.title || 'this job'}"</strong>?
          </>
        }
        warning="All associated candidate applications, resumes, evaluations, and interviewer notes will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Opening"
        isLoading={deleteJobMutation.isPending}
        onConfirm={() => {
          if (deletingJobId) {
            deleteJobMutation.mutate(deletingJobId);
            setDeletingJobId(null);
          }
        }}
      />

      {/* Styled Interview Schedule Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={!!deletingScheduleId}
        onOpenChange={(open) => !open && setDeletingScheduleId(null)}
        title="Delete Interview Schedule"
        description="Are you sure you want to delete this scheduled interview session?"
        warning="This scheduled session will be removed from the candidate's interview timeline. This action cannot be undone."
        confirmLabel="Delete Schedule"
        isLoading={deleteScheduleMutation.isPending}
        onConfirm={() => {
          if (deletingScheduleId) {
            deleteScheduleMutation.mutate(deletingScheduleId, {
              onSettled: () => setDeletingScheduleId(null)
            });
          }
        }}
      />

      {/* Styled Candidate / Resume Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={!!candidateToDelete}
        onOpenChange={(open) => !open && setCandidateToDelete(null)}
        title="Delete Candidate & Resume"
        description={
          <>
            Are you sure you want to delete <strong className="text-foreground font-semibold">"{candidateToDelete?.name || 'this candidate'}"</strong>?
          </>
        }
        warning="All parsed resume data, AI vector embeddings, interview evaluations, and the uploaded resume file will be permanently removed. This action cannot be undone."
        confirmLabel="Delete Candidate"
        isLoading={deleteApplicationMutation.isPending}
        onConfirm={() => {
          if (candidateToDelete) {
            deleteApplicationMutation.mutate(candidateToDelete.id);
          }
        }}
      />

      {/* dialog 2: Add Single Candidate */}
      <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add Candidate Profile
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCandidateSubmit} className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                <Input
                  required
                  value={candFirst}
                  onChange={(e) => setCandFirst(e.target.value)}
                  placeholder="John"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Last Name *</label>
                <Input
                  required
                  value={candLast}
                  onChange={(e) => setCandLast(e.target.value)}
                  placeholder="Doe"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Email *</label>
              <Input
                required
                type="email"
                value={candEmail}
                onChange={(e) => setCandEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Phone</label>
              <Input
                value={candPhone}
                onChange={(e) => setCandPhone(e.target.value)}
                placeholder="+1 234 567 890"
                className="text-xs h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Sourcing Channel</label>
                <select
                  value={candSource}
                  onChange={(e) => setCandSource(e.target.value)}
                  className="w-full h-9 border border-input bg-background rounded-md px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="indeed">Indeed</option>
                  <option value="referral">Referral</option>
                  <option value="careers_page">Careers Page</option>
                  <option value="github">GitHub</option>
                  <option value="direct">Direct Sourcing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Source Details</label>
                <Input
                  value={candSourceDetails}
                  onChange={(e) => setCandSourceDetails(e.target.value)}
                  placeholder="e.g. Referred by Alice"
                  className="text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">Resume PDF *</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-all flex flex-col items-center justify-center gap-1.5"
              >
                <FileText className="h-8 w-8 text-slate-400 animate-pulse" />
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  {candResume ? candResume.name : 'Click to select candidate PDF resume'}
                </span>
                <span className="text-[10px] text-slate-400">PDF formats under 20MB supported.</span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                onChange={(e) => setCandResume(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowAddCandidate(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={createCandidateMutation.isPending} className="h-9 text-xs font-bold">
                {createCandidateMutation.isPending ? 'Processing...' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* dialog 3: Upload Resumes with live progress */}
      <Dialog 
        open={showBulkUpload} 
        onOpenChange={(open) => {
          setShowBulkUpload(open);
          if (!open) {
            const hasActive = resumeUploadQueue.some(f => f.status === 'uploading' || f.status === 'parsing');
            if (!hasActive) {
              setResumeUploadQueue([]);
            }
          }
        }}
      >
        <DialogContent className="max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-0">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" /> Upload Resumes
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              Upload PDF or DOCX candidate resumes for <strong className="text-foreground font-semibold">{activeJob?.title}</strong>. Profiles, skills, and AI suitability scores will parse automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleResumeDrag}
              onDragOver={handleResumeDrag}
              onDragLeave={handleResumeDrag}
              onDrop={handleResumeDrop}
              onClick={() => bulkInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                resumeDragActive
                  ? 'border-primary bg-primary/10 scale-[0.99]'
                  : 'border-border bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-950/40'
              }`}
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <FileUp className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  Click to browse or drag & drop resume files
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Accepts multiple .pdf and .docx files (up to 15MB each)
                </span>
              </div>
            </div>

            <input
              type="file"
              ref={bulkInputRef}
              multiple
              accept=".pdf,.docx"
              onChange={handleResumeFileInput}
              className="hidden"
            />

            {/* Upload Queue Progress List */}
            {resumeUploadQueue.length > 0 && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Uploading Queue ({resumeUploadQueue.filter(f => f.status === 'uploading' || f.status === 'parsing').length} Active)</span>
                  {resumeUploadQueue.some(f => f.status === 'completed') && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {resumeUploadQueue.filter(f => f.status === 'completed').length} / {resumeUploadQueue.length} Imported
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {resumeUploadQueue.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/20 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                              {formatSize(file.size)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                file.status === 'failed'
                                  ? 'bg-destructive'
                                  : file.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : file.status === 'parsing'
                                  ? 'bg-yellow-500'
                                  : 'bg-primary'
                              }`}
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 font-semibold text-[11px]">
                        {file.status === 'uploading' && (
                          <span className="text-primary flex items-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading ({file.progress}%)
                          </span>
                        )}
                        {file.status === 'parsing' && (
                          <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1 animate-pulse">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing Profile
                          </span>
                        )}
                        {file.status === 'completed' && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-destructive flex items-center gap-1 font-bold" title={file.error}>
                              <AlertCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                            {file.error && (
                              <span className="text-[10px] text-destructive/90 max-w-[180px] text-right truncate" title={file.error}>
                                {file.error}
                              </span>
                            )}
                            {file.file && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startSingleFileUpload(file.file!, file.id);
                                }}
                                className="text-[10px] text-primary hover:underline font-bold mt-0.5"
                              >
                                ↻ Click to Retry
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-border shrink-0 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground font-medium truncate">
              {resumeUploadQueue.some(f => f.status === 'uploading' || f.status === 'parsing')
                ? 'Processing in background...'
                : resumeUploadQueue.length > 0
                ? `${resumeUploadQueue.filter(f => f.status === 'completed').length} candidates added to pipeline`
                : 'Select files to begin upload'}
            </span>
            <Button
              type="button"
              variant={resumeUploadQueue.some(f => f.status === 'completed') ? 'default' : 'outline'}
              onClick={() => {
                setShowBulkUpload(false);
                setResumeUploadQueue([]);
              }}
              className="h-8.5 text-xs font-semibold px-4 rounded-xl shrink-0"
            >
              {resumeUploadQueue.some(f => f.status === 'completed') ? 'Done' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate Evaluation Modal - Full Screen Centered Dialog */}
      <Dialog open={!!selectedAppId} onOpenChange={() => { setSelectedAppId(null); setIsPromoting(null); }}>
        <DialogContent className="max-w-[92vw] w-full max-h-[92vh] h-full bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-0 overflow-hidden flex flex-col">
          
          {/* Modal Header */}
          <div className="shrink-0 px-6 py-4 border-b border-border bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading candidate...
              </div>
            ) : appDetail ? (
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                    {appDetail.candidate_name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {appDetail.candidate_email}</span>
                    {appDetail.candidate_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {appDetail.candidate_phone}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> Applied: {new Date(appDetail.created_at).toLocaleDateString()}</span>
                    <span className={`px-1.5 py-0.5 rounded-md border font-black uppercase text-[8px] ${
                      appDetail.source === 'linkedin' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20' :
                      appDetail.source === 'referral' ? 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-950/20' :
                      appDetail.source === 'indeed' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20' :
                      appDetail.source === 'github' ? 'bg-slate-100 border-slate-350 text-slate-700 dark:bg-slate-800' :
                      appDetail.source === 'careers_page' ? 'bg-emerald-50 border-emerald-250 text-emerald-600' :
                      'bg-slate-50 border-border text-slate-500'
                    }`}>
                      Source: {appDetail.source || 'other'} {appDetail.source_details ? `(${appDetail.source_details})` : ''}
                    </span>
                  </div>
                </div>
                <div className="ml-auto shrink-0 flex items-center gap-2.5">
                  {(appDetail.stage === 'hired' || appDetail.stage === 'offer' || appDetail.offer?.status === 'accepted') && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setOnboardJobTitle(activeJob?.title || '');
                        const matchedDept = departments?.find(d => d.name.toLowerCase() === (activeJob?.department || '').toLowerCase());
                        if (matchedDept) setOnboardDeptId(matchedDept.id);
                        else if (departments && departments.length > 0) setOnboardDeptId(departments[0].id);
                        
                        if (appDetail.offer?.start_date) {
                          setOnboardStartDate(appDetail.offer.start_date);
                        } else {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          setOnboardStartDate(d.toISOString().split('T')[0]);
                        }
                        setOnboardResult(null);
                        setShowOnboardModal(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 h-8 px-3 shadow-md animate-in fade-in transition-all"
                    >
                      <UserCheck className="h-4 w-4" />
                      + Onboard as Employee
                    </Button>
                  )}
                  {getMatchScoreBadge(appDetail.match_score)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCandidateToDelete({ id: appDetail.id, name: appDetail.candidate_name })}
                    className="text-xs font-semibold h-8 px-3 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5"
                    title="Delete Candidate Application, Resume, and Vectors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Candidate</span>
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Failed to load candidate details.</span>
            )}
          </div>

          {/* Two Column Body */}
          {!detailLoading && appDetail && (
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Left Column: Resume PDF Preview */}
              <div className="w-[52%] shrink-0 border-r border-border flex flex-col bg-slate-50 dark:bg-slate-950/30">
                <div className="px-5 py-3 border-b border-border bg-white dark:bg-slate-900 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                    Resume Preview
                  </span>
                  <div className="flex items-center gap-3">
                    {appDetail.has_resume && (resumeBlobUrl || resumeDirectUrl) && (
                      <a
                        href={resumeBlobUrl || resumeDirectUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (resumeBlobUrl) {
                            e.preventDefault();
                            window.open(resumeBlobUrl, '_blank');
                          }
                        }}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open full PDF in a new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open in New Tab</span>
                      </a>
                    )}
                    <button
                      onClick={() => setCandidateToDelete({ id: appDetail.id, name: appDetail.candidate_name })}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline flex items-center gap-1 transition-colors"
                      title="Delete resume file, parsed vectors, and candidate record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Resume</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {appDetail.has_resume ? (
                    resumeBlobUrl ? (
                      <iframe
                        src={resumeBlobUrl}
                        className="w-full h-full border-0"
                        title="Resume Preview"
                      />
                    ) : resumeLoading ? (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground">Loading Resume Document...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-6 text-muted-foreground">
                        <FileText className="h-10 w-10 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {resumeError || 'Resume preview unavailable'}
                        </span>
                        {(resumeBlobUrl || resumeDirectUrl) && (
                          <a
                            href={resumeBlobUrl || resumeDirectUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (resumeBlobUrl) {
                                e.preventDefault();
                                window.open(resumeBlobUrl, '_blank');
                              }
                            }}
                            className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open / Download Resume
                          </a>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
                      <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                      <span className="text-xs font-bold">No resume uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Tabbed Evaluation Details */}
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
                {/* Horizontal Tab Selector */}
                <div className="shrink-0 flex border-b border-border bg-slate-50/50 dark:bg-slate-950/10 px-5 py-2.5 gap-2">
                  {[
                    { id: 'eval',   label: 'Evaluation & Notes', icon: Award },
                    { id: 'emails', label: 'Email Candidate',    icon: Mail },
                    { id: 'offer',  label: 'Offer Letter',       icon: FileText },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeDrawerTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveDrawerTab(tab.id as any);
                          if (tab.id === 'offer' && appDetail.offer) {
                            setOfferSalary(appDetail.offer.salary.toString());
                            setOfferStartDate(appDetail.offer.start_date);
                            setOfferExpirationDate(appDetail.offer.expiration_date || '');
                            setOfferNotes(appDetail.offer.notes || '');
                            setOfferLetterText(appDetail.offer.offer_letter_text || '');
                            setOfferBenefits(appDetail.offer.benefits_summary !== undefined ? appDetail.offer.benefits_summary : 'Comprehensive Health, Dental, Vision & 401(k) retirement match');
                            setOfferWorkLocation(appDetail.offer.work_location || 'Remote');
                          } else if (tab.id === 'offer' && !appDetail.offer) {
                            setOfferSalary('85000');
                            const defaultStart = new Date();
                            defaultStart.setDate(defaultStart.getDate() + 14);
                            setOfferStartDate(defaultStart.toISOString().split('T')[0]);
                            const defaultExp = new Date();
                            defaultExp.setDate(defaultExp.getDate() + 7);
                            setOfferExpirationDate(defaultExp.toISOString().split('T')[0]);
                            setOfferNotes('');
                            setOfferBenefits('Comprehensive Health, Dental, Vision & 401(k) retirement match');
                            setOfferWorkLocation('Remote');
                            setOfferLetterText(
                              `Dear ${appDetail.candidate_name},\n\n` +
                              `We are thrilled to offer you the position of ${activeJob?.title || 'Data Scientist'} at our company.\n\n` +
                              `Your annual base salary will be $85,000, starting on ${defaultStart.toLocaleDateString()}.\n\n` +
                              `Work Location: Remote\n\n` +
                              `Please review this offer and sign below to accept.\n\n` +
                              `Best regards,\n` +
                              `The Recruiting Team`
                            );
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border transition-all ${
                          active
                            ? 'bg-white dark:bg-slate-800 text-primary border-border shadow-sm'
                            : 'bg-transparent text-muted-foreground border-transparent hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs leading-normal">
                  {activeDrawerTab === 'eval' && (
                    <>

                {/* AI Competency Match */}
                <div className="space-y-2.5">
                  <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
                    AI Competency Breakdown
                    {isRecomputing && (
                      <span className="flex items-center gap-1 text-primary font-semibold normal-case">
                        <Loader2 className="h-3 w-3 animate-spin" /> Re-evaluating...
                      </span>
                    )}
                  </h3>
                  <div className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                    {/* 4-Category Score Bars */}
                    {[
                      { label: 'Skills',     key: 'score_skills',     color: 'bg-primary',         icon: '🛠' },
                      { label: 'Experience', key: 'score_experience', color: 'bg-violet-500',       icon: '💼' },
                      { label: 'Projects',   key: 'score_projects',   color: 'bg-amber-500',        icon: '🚀' },
                      { label: 'Education',  key: 'score_education',  color: 'bg-emerald-500',      icon: '🎓' },
                    ].map(({ label, key, color, icon }) => {
                      const score = (appDetail as any)[key] as number | null | undefined;
                      const pct = score != null ? Math.round(score * 100) : null;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              {icon} {label}
                            </span>
                            <span className={`text-[10px] font-black ${pct == null ? 'text-muted-foreground' : pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-500'}`}>
                              {pct != null ? `${pct}%` : isRecomputing ? '...' : 'N/A'}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            {isRecomputing && pct == null ? (
                              <div className="h-full rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse w-full" />
                            ) : (
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${color}`}
                                style={{ width: pct != null ? `${pct}%` : '0%' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Matched / Missing Skills */}
                  <div className="grid grid-cols-2 gap-3 border border-border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-extrabold text-emerald-600 block uppercase tracking-wider">✓ Matched Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {appDetail.matched_skills && appDetail.matched_skills.length > 0 ? (
                          appDetail.matched_skills.map((s, idx) => (
                            <span key={idx} className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[9px] font-bold">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">None detected</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-extrabold text-rose-500 block uppercase tracking-wider">✗ Missing Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {appDetail.missing_skills && appDetail.missing_skills.length > 0 ? (
                          appDetail.missing_skills.map((s, idx) => (
                            <span key={idx} className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded text-[9px] font-bold">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">All covered</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Stage Management */}
                <div className="space-y-2.5">
                  <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Pipeline Stage</h3>
                  <div className="border border-border rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {((activeJob?.pipeline_stages && activeJob.pipeline_stages.length > 0)
                        ? [...activeJob.pipeline_stages.map(s => s.id), 'rejected']
                        : ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
                      ).map((stg) => {
                        const active = appDetail.stage === stg;
                        return (
                          <button
                            key={stg}
                            onClick={() => { if (active) return; setIsPromoting(stg); }}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                              active
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-border dark:hover:bg-slate-800'
                            }`}
                          >
                            {getStageLabel(stg)}
                          </button>
                        );
                      })}
                    </div>
                    {isPromoting && (
                      <div className="border-t border-border pt-3 space-y-3 animate-in fade-in duration-200">
                        {isPromoting === 'rejected' ? (
                          <div className="space-y-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl p-3.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4" /> Move Candidate to Rejected
                              </span>
                              <span className="text-[10px] text-muted-foreground">Professional & Courteous Feedback</span>
                            </div>

                            {/* Preset Reason Selector */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Reason for Rejection *
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  'Experience / Skill Mismatch',
                                  'Position Filled with Other Candidate',
                                  'Compensation / Expectation Gap',
                                  'Culture / Alignment Fit',
                                  'Candidate Withdrew',
                                ].map((reason) => (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setRejectionReason(reason)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                      rejectionReason === reason
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                        : 'bg-white dark:bg-slate-900 border-border text-slate-700 dark:text-slate-300 hover:border-rose-300'
                                    }`}
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>
                              <Input
                                required
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Specify custom rejection reason..."
                                className="text-xs h-8 mt-1 bg-white dark:bg-slate-900"
                              />
                            </div>

                            {/* Send Email Toggle */}
                            <div className="flex items-center justify-between border-t border-rose-200/50 dark:border-rose-900/40 pt-2.5">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={rejectionSendEmail}
                                  onChange={(e) => {
                                    setRejectionSendEmail(e.target.checked);
                                    if (e.target.checked && !rejectionCustomEmail) {
                                      setRejectionCustomEmail(
                                        `Dear ${appDetail.candidate_name},\n\nThank you for taking the time to speak with our team regarding the ${activeJob?.title || 'open'} position.\n\nAfter careful deliberation, we have decided to move forward with other candidates whose profiles align more closely with our current requirements.\n\nWe genuinely appreciate the time you invested with us and wish you continued success in your career.\n\nBest regards,\nThe Hiring Team`
                                      );
                                    }
                                  }}
                                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                />
                                <span>Send courteous rejection email to candidate</span>
                              </label>
                              <span className="text-[10px] text-muted-foreground">
                                {rejectionSendEmail ? 'Candidate will receive email' : 'Silent rejection (no email)'}
                              </span>
                            </div>

                            {/* Editable Rejection Email Template Preview */}
                            {rejectionSendEmail && (
                              <div className="space-y-1.5 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                                  <span>Candidate Email Preview & Custom Note:</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRejectionCustomEmail(
                                        `Dear ${appDetail.candidate_name},\n\nThank you for taking the time to speak with our team regarding the ${activeJob?.title || 'open'} position.\n\nAfter careful deliberation, we have decided to move forward with other candidates whose profiles align more closely with our current requirements.\n\nWe genuinely appreciate the time you invested with us and wish you continued success in your career.\n\nBest regards,\nThe Hiring Team`
                                      )
                                    }
                                    className="text-primary hover:underline font-bold"
                                  >
                                    Reset to Default Template
                                  </button>
                                </div>
                                <textarea
                                  value={
                                    rejectionCustomEmail ||
                                    `Dear ${appDetail.candidate_name},\n\nThank you for taking the time to speak with our team regarding the ${activeJob?.title || 'open'} position.\n\nAfter careful deliberation, we have decided to move forward with other candidates whose profiles align more closely with our current requirements.\n\nWe genuinely appreciate the time you invested with us and wish you continued success in your career.\n\nBest regards,\nThe Hiring Team`
                                  }
                                  onChange={(e) => setRejectionCustomEmail(e.target.value)}
                                  rows={4}
                                  className="w-full border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 rounded-md p-2.5 text-xs text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 font-sans"
                                  placeholder="Customize rejection email text..."
                                />
                              </div>
                            )}

                            {/* Internal HR Notes */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Internal HR Evaluation Notes (Private)
                              </label>
                              <textarea
                                value={stageNotes}
                                onChange={(e) => setStageNotes(e.target.value)}
                                placeholder="Add private notes for the hiring team (not sent to candidate)..."
                                rows={2}
                                className="w-full border border-input bg-white dark:bg-slate-900 rounded-md px-3 py-1.5 text-xs leading-normal"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleStageUpdate('rejected')}
                                disabled={updateStageMutation.isPending}
                                className="h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                              >
                                {updateStageMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                {rejectionSendEmail ? 'Confirm Rejection & Send Email' : 'Confirm Silent Rejection'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setIsPromoting(null);
                                  setRejectionReason('');
                                  setRejectionCustomEmail('');
                                }}
                                className="h-8 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300 block">
                              Move to <span className="text-primary uppercase">{isPromoting}</span> — add notes:
                            </span>
                            <textarea
                              value={stageNotes}
                              onChange={(e) => setStageNotes(e.target.value)}
                              placeholder="Add evaluation comments..."
                              rows={2}
                              className="w-full border border-input bg-background rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal"
                            />
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" onClick={() => handleStageUpdate(isPromoting)} disabled={updateStageMutation.isPending} className="h-7 text-[10px]">
                                Confirm
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsPromoting(null)} className="h-7 text-[10px]">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>


                {/* Interview Schedules Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider">Interview Schedules</h3>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-semibold gap-1.5 px-2.5 text-primary border-primary/30 hover:bg-primary/10 transition-colors"
                        onClick={() => {
                          setNewlyCreatedInviteToken(null);
                          setShowSelfScheduleModal(true);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Self-Service Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-semibold gap-1.5 px-2.5 text-slate-700 dark:text-slate-200 border-border hover:bg-primary/5 hover:text-primary transition-colors"
                        onClick={() => setShowScheduleForm(!showScheduleForm)}
                      >
                        <Calendar className="h-3.5 w-3.5 text-primary" /> {showScheduleForm ? 'Hide Form' : 'Schedule'}
                      </Button>
                    </div>
                  </div>

                  {/* Active Self-Schedule Invitations Banner */}
                  {invitations && invitations.length > 0 && (
                    <div className="space-y-2 border border-dashed border-primary/30 rounded-xl p-3 bg-primary/5 dark:bg-primary/10">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block flex items-center justify-between">
                        <span>Active Self-Scheduling Links ({invitations.length})</span>
                        <span className="text-[9px] font-normal text-muted-foreground">Calendly-style booking active</span>
                      </span>
                      <div className="space-y-2">
                        {invitations.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-border p-2.5 rounded-lg text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{inv.duration_min}m {inv.interview_type}</span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  inv.status === 'booked' 
                                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                                    : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                                }`}>
                                  {inv.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                                Expires: {new Date(inv.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6.5 text-[10px] font-bold px-2 gap-1"
                                onClick={() => {
                                  const url = `${window.location.origin}/careers/schedule/${inv.token}`;
                                  navigator.clipboard.writeText(url);
                                  coreAlert({ title: 'Link Copied', description: url, variant: 'success' });
                                }}
                              >
                                <Copy className="h-3 w-3" /> Copy Link
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {showScheduleForm && (
                    <form onSubmit={handleScheduleSubmit} className="border border-border rounded-xl p-4 bg-slate-50/70 dark:bg-slate-950/40 space-y-3.5 animate-in fade-in duration-200 shadow-xs">
                      {/* Date & Time with Friendly Selectors */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                              <span>Date *</span>
                              <span className="text-[11px] font-normal text-muted-foreground">Pick calendar day</span>
                            </label>
                            <Input
                              required
                              type="date"
                              value={schedDateOnly}
                              onChange={(e) => setSchedDateOnly(e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border-border text-xs text-slate-900 dark:text-slate-100"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                              <span>Time *</span>
                              <span className="text-[11px] font-normal text-muted-foreground">Type or pick clock</span>
                            </label>
                            <Input
                              required
                              type="time"
                              value={schedTime}
                              onChange={(e) => setSchedTime(e.target.value)}
                              className="w-full h-9 bg-white dark:bg-slate-900 border-border text-xs text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Quick Pick:</span>
                          <button
                            type="button"
                            onClick={() => setQuickSchedule(1, '10:00')}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                          >
                            Tomorrow 10 AM
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickSchedule(1, '14:00')}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                          >
                            Tomorrow 2 PM
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickSchedule(2, '11:00')}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                          >
                            In 2 Days 11 AM
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Duration</label>
                          <select
                            value={schedDuration}
                            onChange={(e) => setSchedDuration(Number(e.target.value))}
                            className="w-full h-9 border border-input bg-white dark:bg-slate-900 rounded-md px-3 py-1 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value={15}>15 mins</option>
                            <option value={30}>30 mins</option>
                            <option value={45}>45 mins</option>
                            <option value={60}>60 mins (1 hr)</option>
                            <option value={90}>90 mins (1.5 hrs)</option>
                            <option value={120}>120 mins (2 hrs)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Custom Link (optional)</label>
                          <Input
                            type="url"
                            value={schedLink}
                            onChange={(e) => setSchedLink(e.target.value)}
                            placeholder={useCoreMeeting && schedType === 'video' ? "Auto-generates CORE Meeting Room" : "https://meet.google.com/..."}
                            disabled={useCoreMeeting && schedType === 'video'}
                            className="h-9 text-xs bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>

                      {schedType === 'video' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Video className="h-4.5 w-4.5 text-primary shrink-0" />
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                Generate CORE Virtual Meeting Room
                              </span>
                              <span className="text-xs text-muted-foreground block mt-0.5">
                                Creates secure in-app video room with calendar invites, room code, and live notes.
                              </span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={useCoreMeeting}
                            onChange={(e) => setUseCoreMeeting(e.target.checked)}
                            className="h-4.5 w-4.5 rounded accent-primary cursor-pointer shrink-0 ml-3"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Interviewers (comma-separated)</label>
                        <Input
                          value={schedInterviewers}
                          onChange={(e) => setSchedInterviewers(e.target.value)}
                          placeholder="e.g. Alice Smith, Bob Jones"
                          className="h-9 text-xs bg-white dark:bg-slate-900"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Agenda / Notes</label>
                        <textarea
                          value={schedAgenda}
                          onChange={(e) => setSchedAgenda(e.target.value)}
                          placeholder="What will be covered in this round..."
                          rows={2}
                          className="w-full border border-input bg-white dark:bg-slate-900 rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-xs leading-normal text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setShowScheduleForm(false)}
                          className="h-8 text-xs font-semibold px-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          disabled={scheduleInterviewMutation.isPending}
                          className="h-8 text-xs font-bold px-4"
                        >
                          {scheduleInterviewMutation.isPending ? 'Scheduling...' : 'Save Schedule'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* AI Interview Question Generator & Resume Gap Prober */}
                  <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                        <span className="text-xs uppercase font-extrabold text-primary tracking-wider">
                          AI Interview Questions & Gap Prober
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generateQuestionsMutation.isPending}
                        onClick={() => generateQuestionsMutation.mutate()}
                        className="h-7 text-xs font-bold gap-1.5 px-3 bg-white dark:bg-slate-900 border-primary/30 text-primary shadow-sm hover:bg-primary/5"
                      >
                        {generateQuestionsMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing Gaps...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" /> {generatedQuestions.length > 0 ? 'Regenerate Questions' : 'Generate Questions'}
                          </>
                        )}
                      </Button>
                    </div>

                    {generatedQuestions.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Gemini analyzed <strong className="text-foreground">{appDetail.candidate_name}</strong>'s resume against <strong className="text-foreground">{activeJob?.title}</strong> requirements:
                        </p>
                        <div className="space-y-2.5">
                          {generatedQuestions.map((q, idx) => (
                            <div key={q.id || idx} className="bg-white dark:bg-slate-900 border border-border rounded-xl p-3.5 space-y-2 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-extrabold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border/50">
                                    {q.category?.replace('_', ' ') || 'General'}
                                  </span>
                                  {q.difficulty && (
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                      q.difficulty === 'hard' || q.difficulty === 'advanced'
                                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20'
                                        : q.difficulty === 'medium'
                                        ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20'
                                    }`}>
                                      {q.difficulty}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(q.question);
                                    setCopiedQId(q.id || String(idx));
                                    setTimeout(() => setCopiedQId(null), 2000);
                                  }}
                                  className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Copy question to clipboard"
                                >
                                  {copiedQId === (q.id || String(idx)) ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" /> Copied</span>
                                  ) : (
                                    <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy</span>
                                  )}
                                </button>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                "{q.question}"
                              </p>
                              {q.rationale && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-normal">
                                  💡 <span className="font-semibold text-slate-700 dark:text-slate-200">Why probe:</span> {q.rationale}
                                </p>
                              )}
                              {q.what_to_look_for && (
                                <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-border/60">
                                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] block mb-1">What to Look For:</strong>
                                  {q.what_to_look_for}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Probe candidate resume gaps against job requirements and generate 5 tailored interview questions with Gemini AI.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {appDetail.interview_schedules && appDetail.interview_schedules.length > 0 ? (
                      appDetail.interview_schedules.map((s) => {
                        const localTime = new Date(s.scheduled_at).toLocaleString();
                        const isScheduled = s.status === 'scheduled';
                        
                        return (
                          <div key={s.id} className="border border-border rounded-xl p-3.5 bg-white dark:bg-slate-900/60 flex flex-col gap-2.5 shadow-sm border-l-4 border-l-primary">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {s.interview_type === 'video' ? '🎥' : s.interview_type === 'phone' ? '📞' : s.interview_type === 'technical' ? '💻' : '🏢'}
                                </span>
                                <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-100">
                                  {s.interview_type.replace('_', ' ')}
                                </span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                  s.status === 'completed'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20'
                                    : s.status === 'cancelled'
                                    ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20'
                                    : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20'
                                }`}>
                                  {s.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isScheduled && (
                                  <>
                                    <button
                                      onClick={() => updateScheduleStatusMutation.mutate({ scheduleId: s.id, status: 'completed' })}
                                      className="h-6.5 px-2.5 rounded-md text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                      title="Mark as Completed"
                                    >
                                      ✓ Complete
                                    </button>
                                    <button
                                      onClick={() => updateScheduleStatusMutation.mutate({ scheduleId: s.id, status: 'cancelled' })}
                                      className="h-6.5 px-2.5 rounded-md text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white transition-colors"
                                      title="Cancel Interview"
                                    >
                                      ✗ Cancel
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setDeletingScheduleId(s.id)}
                                  className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded p-1.5 transition-colors"
                                  title="Delete Schedule"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-200">
                              <div>📅 <span className="font-semibold text-slate-900 dark:text-slate-100">{localTime}</span></div>
                              <div>⏱ <span className="font-semibold text-slate-900 dark:text-slate-100">{s.duration_min} mins</span></div>
                              {s.meeting_link && (
                                <div className="col-span-2 mt-1">
                                  <a 
                                    href={s.meeting_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1.5 rounded-lg transition-colors break-all"
                                  >
                                    <span>🔗</span>
                                    <span>{s.meeting_link}</span>
                                  </a>
                                </div>
                              )}
                              {s.interviewers && s.interviewers.length > 0 && (
                                <div className="col-span-2">
                                  👥 Interviewers: <span className="font-semibold text-slate-900 dark:text-slate-100">{s.interviewers.join(', ')}</span>
                                </div>
                              )}
                              {s.agenda && (
                                <div className="col-span-2 border-t border-border pt-1.5 mt-1 text-slate-600 dark:text-slate-300">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">Agenda:</span> {s.agenda}
                                </div>
                              )}

                              {/* Calendar Sync & Download Actions */}
                              <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-border/70">
                                {s.google_calendar_url && (
                                  <a
                                    href={s.google_calendar_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-border/80 transition-colors shadow-2xs"
                                    title="Add to Google Calendar"
                                  >
                                    <Calendar className="h-3 w-3 text-blue-500" />
                                    <span>+ Google Calendar</span>
                                  </a>
                                )}
                                <a
                                  href={`/api/hiring/applications/${selectedAppId}/interviews/${s.id}/ics/`}
                                  download={`interview-${s.id}.ics`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-border/80 transition-colors shadow-2xs"
                                  title="Download .ics invite for Outlook, Apple Calendar, etc."
                                >
                                  <Download className="h-3 w-3 text-slate-500" />
                                  <span>Download .ics</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-xs text-muted-foreground py-4 border border-dashed border-border rounded-xl">
                        No interviews scheduled.
                      </div>
                    )}
                  </div>
                </div>

                {/* Structured Scorecards Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Structured Scorecards</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[9px] font-bold gap-1 px-2"
                      onClick={() => {
                        setShowScorecardForm(!showScorecardForm);
                        const currentStage = appDetail.stage || 'screening';
                        const dims = STAGE_DIMENSIONS[currentStage] || STAGE_DIMENSIONS['default'];
                        const initialScores: Record<string, number> = {};
                        dims.forEach(d => {
                          initialScores[d] = 3;
                        });
                        setScorecardScores(initialScores);
                      }}
                    >
                      <Sliders className="h-3 w-3 text-primary" /> {showScorecardForm ? 'Hide Form' : 'Submit Scorecard'}
                    </Button>
                  </div>

                  {/* Multi-Interviewer Scorecard Aggregation Executive Summary Banner */}
                  {appDetail.scorecard_summary && appDetail.scorecard_summary.total_reviews > 0 && (
                    <div className="border border-border/80 bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3.5 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm shrink-0">
                            ★ {appDetail.scorecard_summary.average_score}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-foreground">
                                Executive Review Summary
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                appDetail.scorecard_summary.consensus_variant === 'emerald'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : appDetail.scorecard_summary.consensus_variant === 'blue'
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                  : appDetail.scorecard_summary.consensus_variant === 'rose'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                  : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}>
                                {appDetail.scorecard_summary.consensus}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Aggregated across {appDetail.scorecard_summary.total_reviews} scorecard{appDetail.scorecard_summary.total_reviews > 1 ? 's' : ''} ({appDetail.scorecard_summary.average_score} / 5.0 avg)
                            </span>
                          </div>
                        </div>

                        {/* Recommendation Pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {appDetail.scorecard_summary.recommendations.strong_yes > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              {appDetail.scorecard_summary.recommendations.strong_yes} Strong Yes
                            </span>
                          )}
                          {appDetail.scorecard_summary.recommendations.yes > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                              {appDetail.scorecard_summary.recommendations.yes} Yes
                            </span>
                          )}
                          {appDetail.scorecard_summary.recommendations.maybe > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              {appDetail.scorecard_summary.recommendations.maybe} Maybe
                            </span>
                          )}
                          {appDetail.scorecard_summary.recommendations.no > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              {appDetail.scorecard_summary.recommendations.no} No
                            </span>
                          )}
                          {appDetail.scorecard_summary.recommendations.strong_no > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-700/10 text-rose-800 dark:text-rose-200 border border-rose-700/20">
                              {appDetail.scorecard_summary.recommendations.strong_no} Strong No
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dimension Averages Grid */}
                      {Object.keys(appDetail.scorecard_summary.dimension_averages).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                          {Object.entries(appDetail.scorecard_summary.dimension_averages).map(([dim, score]) => (
                            <div key={dim} className="bg-white dark:bg-slate-900 border border-border rounded-lg p-2 text-center shadow-2xs">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate" title={dim.replace('_', ' ')}>
                                {dim.replace('_', ' ')}
                              </span>
                              <span className="text-xs font-black text-primary">
                                {score} / 5
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {showScorecardForm && (
                    <form onSubmit={handleScorecardSubmit} className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-4 animate-in fade-in duration-200">
                      <span className="font-extrabold text-[10px] text-slate-700 dark:text-slate-300 block uppercase">
                        Submit Scorecard for <span className="text-primary">{appDetail.stage}</span> stage
                      </span>

                      <div className="space-y-3">
                        {(() => {
                          const currentStage = appDetail.stage || 'screening';
                          const dims = STAGE_DIMENSIONS[currentStage] || STAGE_DIMENSIONS['default'];
                          return dims.map(d => (
                            <div key={d} className="flex items-center justify-between border-b border-border pb-2">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 capitalize">
                                {d.replace('_', ' ')}:
                              </span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((val) => {
                                  const selected = scorecardScores[d] === val;
                                  return (
                                    <button
                                      type="button"
                                      key={val}
                                      onClick={() => setScorecardScores(prev => ({ ...prev, [d]: val }))}
                                      className={`h-6 w-6 rounded-full text-[10px] font-extrabold border transition-all ${
                                        selected
                                          ? 'bg-primary text-white border-primary shadow-sm scale-110'
                                          : 'bg-white hover:bg-slate-100 border-border text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Overall Recommendation</label>
                        <select
                          value={scorecardRec}
                          onChange={(e: any) => setScorecardRec(e.target.value)}
                          className="w-full border border-input bg-background rounded-md px-2.5 py-1 text-xs leading-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                        >
                          <option value="strong_yes">🟢 Strong Yes</option>
                          <option value="yes">🟢 Yes</option>
                          <option value="maybe">🟡 Maybe / Neutral</option>
                          <option value="no">🔴 No</option>
                          <option value="strong_no">🔴 Strong No</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Key Strengths</label>
                        <textarea
                          required
                          value={scorecardStrengths}
                          onChange={(e) => setScorecardStrengths(e.target.value)}
                          placeholder="What makes this candidate stand out..."
                          rows={2}
                          className="w-full border border-input bg-background rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-xs leading-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Key Concerns</label>
                        <textarea
                          value={scorecardConcerns}
                          onChange={(e) => setScorecardConcerns(e.target.value)}
                          placeholder="Any red flags or risks..."
                          rows={2}
                          className="w-full border border-input bg-background rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-xs leading-normal"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setShowScorecardForm(false)}
                          className="h-7 text-[10px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          disabled={submitScorecardMutation.isPending}
                          className="h-7 text-[10px] font-bold"
                        >
                          {submitScorecardMutation.isPending ? 'Submitting...' : 'Save Scorecard'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* List of Scorecards */}
                  <div className="space-y-2">
                    {appDetail.scorecards && appDetail.scorecards.length > 0 ? (
                      appDetail.scorecards.map((sc) => {
                        const isPositive = sc.recommendation.includes('yes');
                        const isNegative = sc.recommendation.includes('no');
                        
                        return (
                          <div key={sc.id} className="border border-border rounded-xl p-3.5 bg-white dark:bg-slate-900/60 space-y-3 shadow-sm border-l-4 border-l-violet-500">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-extrabold text-[10px] text-slate-800 dark:text-slate-200">{sc.reviewer_name}</span>
                                <span className="text-[8px] text-muted-foreground uppercase font-mono block">Stage: {sc.stage}</span>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                isPositive
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20'
                                  : isNegative
                                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20'
                                  : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20'
                              }`}>
                                {sc.recommendation.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Dimension Score Badge Grid */}
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-950/20 p-2 rounded-lg border border-border">
                              {Object.entries(sc.scores).map(([dim, score]) => (
                                <div key={dim} className="flex justify-between text-[9px] font-bold">
                                  <span className="capitalize text-slate-500">{dim.replace('_', ' ')}</span>
                                  <span className="text-primary">{score} / 5</span>
                                </div>
                              ))}
                            </div>

                            {sc.strengths && (
                              <div className="text-[9px] leading-normal">
                                <span className="font-extrabold text-emerald-600 block">✓ STRENGTHS:</span>
                                <p className="text-slate-700 dark:text-slate-300 italic">{sc.strengths}</p>
                              </div>
                            )}

                            {sc.concerns && (
                              <div className="text-[9px] leading-normal">
                                <span className="font-extrabold text-rose-500 block">⚠ CONCERNS:</span>
                                <p className="text-slate-700 dark:text-slate-300 italic">{sc.concerns}</p>
                              </div>
                            )}

                            <span className="text-[8px] text-muted-foreground block font-mono">
                              Submitted: {new Date(sc.submitted_at).toLocaleString()}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-[10px] text-muted-foreground py-3 border border-dashed border-border rounded-xl">
                        No scorecards submitted yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Interview Notes & Ratings */}
                <div className="space-y-2.5">
                  <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Quick Notes</h3>
                  <form onSubmit={handleAddNoteSubmit} className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">Rating:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button type="button" key={star} onClick={() => setNoteScore(star)} className="outline-none">
                            <Star className={`h-4 w-4 ${star <= noteScore ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      required
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write interview comments, feedback, scoring criteria..."
                      rows={2}
                      className="w-full border border-input bg-background rounded-md px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs leading-normal"
                    />
                    <Button type="submit" disabled={addInterviewNoteMutation.isPending} className="text-[10px] h-7 font-bold">
                      {addInterviewNoteMutation.isPending ? 'Submitting...' : 'Add Note'}
                    </Button>
                  </form>
                  <div className="space-y-2">
                    {appDetail.interview_notes && appDetail.interview_notes.length > 0 ? (
                      appDetail.interview_notes.map((n) => (
                        <div key={n.id} className="border border-border rounded-xl p-3 bg-white dark:bg-slate-900/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[10px] text-slate-800 dark:text-slate-200">{n.interviewer_name}</span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`h-3 w-3 ${s <= n.score ? 'text-amber-500 fill-amber-500' : 'text-slate-200 dark:text-slate-800'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-700 dark:text-slate-300">{n.notes}</p>
                          <span className="text-[9px] text-muted-foreground block font-mono">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-[10px] text-muted-foreground py-3 border border-dashed border-border rounded-xl">
                        No notes posted yet.
                      </div>
                    )}
                  </div>
                </div>


                {/* Stage Audit Trail */}
                <div className="space-y-2.5">
                  <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Stage Audit Trail</h3>
                  <div className="border border-border rounded-xl p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/10">
                    {appDetail.stage_history && appDetail.stage_history.length > 0 ? (
                      appDetail.stage_history.map((h, idx) => (
                        <div key={h.id} className="flex gap-3 text-[10px]">
                          <div className="flex flex-col items-center">
                            <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[9px]">
                              {idx + 1}
                            </div>
                            {idx < appDetail.stage_history.length - 1 && <div className="w-0.5 flex-1 bg-border/60 my-1" />}
                          </div>
                          <div className="flex-1 space-y-0.5 pb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">Stage Shifted:</span>
                              {h.from_stage && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase font-bold text-[8px]">{h.from_stage}</span>}
                              {h.from_stage && <ArrowRight className="h-3 w-3 text-slate-400" />}
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold text-[8px]">{h.to_stage}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300">{h.notes || 'No notes.'}</p>
                            <span className="text-[9px] text-muted-foreground block font-mono">
                              {h.moved_by_name} · {new Date(h.moved_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No stage history recorded.</span>
                    )}
                  </div>
                </div>

                    </>
                  )}

                  {activeDrawerTab === 'emails' && (
                    <>
                      {/* Email Candidate Composer */}
                      <div className="space-y-3">
                        <h3 className="text-xs uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider">Send Email to Candidate</h3>
                        
                        <div className="border border-border rounded-xl p-4 bg-slate-50/70 dark:bg-slate-950/40 space-y-3 shadow-xs">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Select Email Template</label>
                            <select
                              value={selectedTemplateId}
                              onChange={(e) => {
                                const tid = e.target.value;
                                setSelectedTemplateId(tid);
                                const selected = emailTemplates?.find(t => t.id === tid);
                                if (selected) {
                                  const formattedSubject = selected.subject
                                    .replace('{candidate_name}', appDetail.candidate_name)
                                    .replace('{job_title}', activeJob?.title || 'Open Position')
                                    .replace('{company_name}', 'Our Company');
                                  const formattedBody = selected.body
                                    .replace('{candidate_name}', appDetail.candidate_name)
                                    .replace('{job_title}', activeJob?.title || 'Open Position')
                                    .replace('{company_name}', 'Our Company');
                                  setComposeSubject(formattedSubject);
                                  setComposeBody(formattedBody);
                                }
                              }}
                              className="w-full h-9 border border-input bg-white dark:bg-slate-900 rounded-md px-3 py-1 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">-- Choose Template --</option>
                              {emailTemplates?.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.template_type})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Subject *</label>
                            <Input
                              required
                              value={composeSubject}
                              onChange={(e) => setComposeSubject(e.target.value)}
                              placeholder="Email Subject"
                              className="h-9 text-xs bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Body *</label>
                            <textarea
                              required
                              value={composeBody}
                              onChange={(e) => setComposeBody(e.target.value)}
                              placeholder="Write your message here..."
                              rows={8}
                              className="w-full border border-input bg-white dark:bg-slate-900 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
                            />
                          </div>

                          <Button
                            type="button"
                            onClick={async () => {
                              const confirmed = await coreConfirm({
                                title: 'Send Candidate Email',
                                description: `Send this email to ${appDetail.candidate_name}?`,
                                variant: 'primary',
                                icon: <Mail className="h-5 w-5" />,
                                confirmLabel: 'Send Email',
                                details: (
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Recipient:</span>
                                      <span className="font-semibold text-foreground">{appDetail.candidate_email}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Subject:</span>
                                      <span className="font-semibold text-foreground truncate max-w-[240px]">{composeSubject}</span>
                                    </div>
                                  </div>
                                ),
                              });
                              if (confirmed) {
                                sendManualEmailMutation.mutate({ subject: composeSubject, body: composeBody });
                              }
                            }}
                            disabled={sendManualEmailMutation.isPending || !composeSubject || !composeBody}
                            className="w-full text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-white shadow-xs"
                          >
                            {sendManualEmailMutation.isPending ? 'Sending Email...' : 'Send Custom Email'}
                          </Button>
                        </div>
                      </div>

                      {/* Two-Way Message Stream & History */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider">
                            Conversation & Email History
                          </h3>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const lastEmail = emailLogs && emailLogs.length > 0 ? emailLogs[emailLogs.length - 1] : null;
                                if (lastEmail && lastEmail.subject) {
                                  setSimulatedSubject(lastEmail.subject.startsWith('Re:') ? lastEmail.subject : `Re: ${lastEmail.subject}`);
                                } else {
                                  setSimulatedSubject(`Re: Application for ${activeJob?.title || 'Open Position'}`);
                                }
                                setShowSimulateReplyModal(true);
                              }}
                              className="h-7 text-xs font-semibold gap-1.5 px-2.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Simulate Candidate Reply
                            </Button>
                          </div>
                        </div>

                        {/* Two-Way Sync Banner */}
                        <div className="bg-slate-50 dark:bg-slate-950/30 border border-border rounded-xl p-2.5 text-[11px] text-slate-500 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            Live Inbound Sync Active: Candidate replies via email append here automatically.
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">Webhook: /api/hiring/inbound/</span>
                        </div>

                        <div className="space-y-3">
                          {emailLogs && emailLogs.length > 0 ? (
                            emailLogs.map((log) => {
                              const isInbound = log.direction === 'inbound' || log.status === 'received';
                              return (
                                <div 
                                  key={log.id} 
                                  className={`border rounded-2xl p-4 space-y-2.5 shadow-xs transition-all ${
                                    isInbound
                                      ? 'border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/25 ml-0 mr-4'
                                      : 'border-border bg-white dark:bg-slate-900 ml-4 mr-0'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                        isInbound
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                          : 'bg-primary/10 text-primary'
                                      }`}>
                                        {isInbound ? '📥 Inbound Candidate Reply' : '📤 HR Outbound Message'}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                        {isInbound ? `From: ${log.from_email || log.to_email}` : `To: ${log.to_email}`}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {new Date(log.sent_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50/80 dark:bg-slate-950/50 p-3 rounded-xl border border-border text-xs leading-relaxed space-y-1.5">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                                      <span>Subject: {log.subject}</span>
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap pt-1.5 border-t border-border/60 font-sans leading-relaxed">
                                      {log.body}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-xl">
                              No email messages recorded yet with this candidate.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {activeDrawerTab === 'offer' && (
                    <>
                      {/* Offer Status & Management Header */}
                      <div className="space-y-2.5">
                        <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Offer Summary</h3>
                        
                        {appDetail.offer ? (
                          <div className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Offer Status:</span>
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                appDetail.offer.status === 'accepted'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20'
                                  : appDetail.offer.status === 'declined'
                                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20'
                                  : appDetail.offer.status === 'extended'
                                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 animate-pulse'
                                  : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20'
                              }`}>
                                {appDetail.offer.status.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Details List */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-b border-border py-3 text-[10px]">
                              <div>
                                <span className="text-slate-400 block font-bold uppercase text-[8px]">Annual Base Salary</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">${Number(appDetail.offer.salary).toLocaleString()} USD</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-bold uppercase text-[8px]">Start Date</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{new Date(appDetail.offer.start_date).toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-bold uppercase text-[8px]">Work Location</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs truncate block" title={appDetail.offer.work_location || 'Remote'}>
                                  {appDetail.offer.work_location || 'Remote'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-bold uppercase text-[8px]">Expiration</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
                                  {appDetail.offer.expiration_date ? new Date(appDetail.offer.expiration_date).toLocaleDateString() : '14 days from receipt'}
                                </span>
                              </div>
                            </div>

                            {/* Benefits & Coverage summary banner */}
                            {appDetail.offer.benefits_summary && (
                              <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-border rounded-xl p-2.5 flex items-start gap-2">
                                <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1 text-[10px]">
                                  <span className="text-slate-400 block font-bold uppercase text-[8px]">Benefits &amp; Coverage</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-medium leading-snug">
                                    {appDetail.offer.benefits_summary}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Signed status */}
                            {appDetail.offer.signed_at && (
                              <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50/50 p-2 rounded border border-emerald-100 flex items-center gap-1.5">
                                <Check className="h-4 w-4 shrink-0" /> Signed & Completed at {new Date(appDetail.offer.signed_at).toLocaleString()}
                              </div>
                            )}

                            {/* Letter preview */}
                            <div className="space-y-1 pt-1">
                              <span className="text-slate-400 block font-bold uppercase text-[8px]">Offer Letter Text</span>
                              <div className="bg-white dark:bg-slate-900 border border-border rounded-xl p-3 text-[10px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                                {appDetail.offer.offer_letter_text}
                              </div>
                            </div>

                            {/* PDF Download & Email Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleDownloadOfferPdf}
                                disabled={isDownloadingOfferPdf}
                                className="flex-1 text-[11px] font-bold h-8.5 gap-1.5 border-border hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                {isDownloadingOfferPdf ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-primary" />
                                )}
                                <span>Download Official PDF Offer</span>
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => sendOfferPdfEmailMutation.mutate()}
                                disabled={sendOfferPdfEmailMutation.isPending}
                                className="flex-1 text-[11px] font-bold h-8.5 gap-1.5 border-border hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                {sendOfferPdfEmailMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                ) : (
                                  <Send className="h-3.5 w-3.5 text-primary" />
                                )}
                                <span>Email PDF to Candidate</span>
                              </Button>
                            </div>

                            {/* Offer Management Actions */}
                            {appDetail.offer.status === 'draft' && (
                              <Button
                                type="button"
                                onClick={async () => {
                                  const confirmed = await coreConfirm({
                                    title: 'Extend Job Offer',
                                    description: `Are you sure you want to officially extend this job offer to ${appDetail.candidate_name}?`,
                                    variant: 'primary',
                                    icon: <Send className="h-5 w-5" />,
                                    confirmLabel: 'Extend Offer',
                                    details: (
                                      <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Candidate:</span>
                                          <span className="font-bold text-foreground">{appDetail.candidate_name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Base Salary:</span>
                                          <span className="font-bold text-emerald-600">${Number(appDetail.offer?.salary || 0).toLocaleString()} USD</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Start Date:</span>
                                          <span className="font-semibold text-foreground">{appDetail.offer?.start_date ? new Date(appDetail.offer.start_date).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                      </div>
                                    ),
                                  });
                                  if (confirmed) {
                                    extendOfferMutation.mutate();
                                  }
                                }}
                                disabled={extendOfferMutation.isPending}
                                className="w-full text-[10px] font-bold h-8.5"
                              >
                                {extendOfferMutation.isPending ? 'Extending...' : '✉ Extend Offer to Candidate'}
                              </Button>
                            )}

                            {appDetail.offer.status === 'extended' && (
                              <div className="space-y-2 pt-2 border-t border-border">
                                <span className="text-slate-400 font-bold uppercase text-[8px] block text-center">Recruiter Simulation (Accept / Decline)</span>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    onClick={async () => {
                                      const confirmed = await coreConfirm({
                                        title: 'Accept Candidate Offer',
                                        description: `Confirm that candidate ${appDetail.candidate_name} has accepted the offer?`,
                                        variant: 'success',
                                        icon: <CheckCircle2 className="h-5 w-5" />,
                                        confirmLabel: 'Mark as Accepted',
                                        details: (
                                          <p className="text-xs text-muted-foreground">
                                            This will advance candidate status to <strong>Accepted</strong> and enable the 1-click employee onboarding workflow.
                                          </p>
                                        ),
                                      });
                                      if (confirmed) {
                                        respondOfferMutation.mutate('accepted');
                                      }
                                    }}
                                    disabled={respondOfferMutation.isPending}
                                    className="flex-1 text-[10px] font-bold h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    ✓ Accept Offer
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={async () => {
                                      const confirmed = await coreConfirm({
                                        title: 'Decline Candidate Offer',
                                        description: `Confirm that candidate ${appDetail.candidate_name} has declined the offer?`,
                                        variant: 'destructive',
                                        icon: <XCircle className="h-5 w-5" />,
                                        confirmLabel: 'Mark as Declined',
                                        warning: 'The offer will be marked as declined and recorded in the candidate hiring timeline.',
                                      });
                                      if (confirmed) {
                                        respondOfferMutation.mutate('declined');
                                      }
                                    }}
                                    disabled={respondOfferMutation.isPending}
                                    variant="outline"
                                    className="flex-1 text-[10px] font-bold h-8 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    ✗ Decline Offer
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-[10px] text-muted-foreground py-6 border border-dashed border-border rounded-xl">
                            No offer details set. Fill in the form below to generate a draft.
                          </div>
                        )}
                      </div>

                      {/* Offer Form: Edit Draft if Status is Draft or None */}
                      {(!appDetail.offer || appDetail.offer.status === 'draft') && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                            {appDetail.offer ? 'Edit Draft Offer Letter' : 'Draft Job Offer Details'}
                          </h3>
                          
                          <div className="border border-border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Annual Base Salary (USD) *</label>
                                <Input
                                  required
                                  type="number"
                                  value={offerSalary}
                                  onChange={(e) => setOfferSalary(e.target.value)}
                                  placeholder="e.g. 90000"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Target Start Date *</label>
                                <input
                                  required
                                  type="date"
                                  value={offerStartDate}
                                  onChange={(e) => setOfferStartDate(e.target.value)}
                                  className="w-full border border-input bg-background rounded-md px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Offer Expiration Date</label>
                                <input
                                  type="date"
                                  value={offerExpirationDate}
                                  onChange={(e) => setOfferExpirationDate(e.target.value)}
                                  className="w-full border border-input bg-background rounded-md px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Work Location / Office Address</label>
                                <Input
                                  value={offerWorkLocation}
                                  onChange={(e) => setOfferWorkLocation(e.target.value)}
                                  placeholder="e.g. Remote, or 100 Tech Park, Suite 400"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>

                            {/* Quick location presets */}
                            <div className="flex items-center gap-1.5 -mt-1">
                              <span className="text-[9px] text-muted-foreground font-semibold">Presets:</span>
                              {['Remote', 'Hybrid (3 days in office)', 'On-Site Office'].map((loc) => (
                                <button
                                  key={loc}
                                  type="button"
                                  onClick={() => setOfferWorkLocation(loc)}
                                  className="text-[9px] px-2 py-0.5 rounded-full border border-border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-colors"
                                >
                                  {loc}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Benefits &amp; Coverage</label>
                                <button
                                  type="button"
                                  onClick={() => setOfferBenefits('')}
                                  className="text-[9px] text-rose-500 hover:underline font-semibold"
                                >
                                  Clear (No Benefits Offered)
                                </button>
                              </div>
                              <Input
                                value={offerBenefits}
                                onChange={(e) => setOfferBenefits(e.target.value)}
                                placeholder="e.g. Comprehensive Health, Dental, Vision & 401(k) match (leave blank if none)"
                                className="h-8 text-xs"
                              />
                              <p className="text-[9px] text-muted-foreground">
                                Leave blank if your company does not provide benefits or if this role is exempt.
                              </p>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Internal Recruiter Notes</label>
                              <Input
                                value={offerNotes}
                                onChange={(e) => setOfferNotes(e.target.value)}
                                placeholder="e.g. Negotiated stock options"
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Custom Letter Body Text *</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOfferLetterText(
                                      `Dear ${appDetail.candidate_name},\n\n` +
                                      `We are thrilled to offer you the position of ${activeJob?.title || 'Specialist'} at our company.\n\n` +
                                      `Your annual base salary will be $${Number(offerSalary || 85000).toLocaleString()}, with an anticipated start date of ${offerStartDate ? new Date(offerStartDate).toLocaleDateString() : 'TBD'}.\n\n` +
                                      `Work Location: ${offerWorkLocation || 'Remote'}\n` +
                                      (offerBenefits.trim() ? `Benefits: ${offerBenefits.trim()}\n\n` : `\n`) +
                                      `Please review this offer and sign below to accept.\n\n` +
                                      `Best regards,\n` +
                                      `The Recruiting Team`
                                    );
                                  }}
                                  className="text-[9px] text-primary hover:underline font-semibold"
                                >
                                  Sync Letter with Above Fields
                                </button>
                              </div>
                              <textarea
                                required
                                value={offerLetterText}
                                onChange={(e) => setOfferLetterText(e.target.value)}
                                placeholder="Formal offer agreement terms..."
                                rows={7}
                                className="w-full border border-input bg-background rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-xs leading-normal"
                              />
                            </div>

                            <Button
                              type="button"
                              onClick={() => saveOfferMutation.mutate({
                                salary: Number(offerSalary),
                                start_date: offerStartDate,
                                expiration_date: offerExpirationDate || null,
                                notes: offerNotes,
                                offer_letter_text: offerLetterText,
                                benefits_summary: offerBenefits,
                                work_location: offerWorkLocation,
                              })}
                              disabled={saveOfferMutation.isPending || !offerSalary || !offerStartDate}
                              className="w-full text-[10px] font-bold h-8.5"
                            >
                              {saveOfferMutation.isPending ? 'Saving Offer...' : appDetail.offer ? 'Update Draft Offer' : 'Save Offer Details'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading state for the entire body */}
          {detailLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Centered Modal: Candidate Intelligence / Talent Assistant */}
      <Dialog open={showCopilot} onOpenChange={setShowCopilot}>
        <DialogContent className="max-w-3xl w-full max-h-[93vh] overflow-hidden p-0 bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl flex flex-col">
          <DialogHeader className="p-5 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                  Candidate Intelligence
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
                  Talent Assistant · <span className="font-semibold text-primary">{activeJob?.title}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Chat dialog message contents */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-50/40 dark:bg-slate-950/10 min-h-[320px] max-h-[460px]">
            {chatMessages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`p-1.5 rounded-lg border text-xs shrink-0 ${isUser ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 border-border text-primary'}`}>
                    {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 text-xs shadow-sm border leading-relaxed ${isUser ? 'max-w-[80%] bg-primary text-primary-foreground border-primary font-semibold' : 'max-w-[92%] sm:max-w-[90%] bg-white dark:bg-slate-900 border-border text-slate-800 dark:text-slate-200 overflow-hidden'}`}>
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : msg.content.startsWith('Error:') ? (
                      <div className="space-y-2 py-0.5">
                        <p className="text-rose-600 dark:text-rose-400 font-medium leading-relaxed">{msg.content}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
                            if (lastUser) {
                              const validHistory = chatMessages.filter(m => !m.content.startsWith('Error:') && m !== lastUser).slice(-6).map(m => ({ role: m.role, content: m.content }));
                              copilotMutation.mutate({ question: lastUser.content, history: validHistory });
                            }
                          }}
                          disabled={copilotMutation.isPending}
                          className="h-7 text-[11px] px-2.5 rounded-lg border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
                        >
                          Retry Question
                        </Button>
                      </div>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>
                </div>
              );
            })}
            {copilotMutation.isPending && (
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 text-xs shrink-0 text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-xs border border-border bg-white dark:bg-slate-900 text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" /> Talent Assistant is analyzing candidate profiles...
                </div>
              </div>
            )}
          </div>

          {/* Chat input submit footer */}
          <div className="px-6 sm:px-8 pt-5 pb-9 sm:pb-12 border-t border-border shrink-0 bg-slate-50/80 dark:bg-slate-950/40">
            <form onSubmit={handleCopilotSend} className="flex gap-3 items-center">
              <Input
                required
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask: 'Who has React & Docker experience?' or 'Compare candidates for this position'"
                className="text-xs h-11 flex-1 rounded-xl bg-white dark:bg-slate-900 border-border shadow-sm px-4 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <Button 
                type="submit" 
                disabled={copilotMutation.isPending || !chatInput.trim()} 
                className="h-11 px-5 rounded-xl shrink-0 flex items-center gap-2 font-bold text-xs shadow-md"
              >
                <Send className="h-4 w-4" /> Send
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground/80 text-center font-medium mt-3.5">
              Candidate Intelligence is scoped strictly to <span className="font-semibold text-slate-700 dark:text-slate-300">{activeJob?.title}</span> applicants.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Side-by-Side Candidate Comparison Dialog */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-hidden p-0 bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl flex flex-col">
          <DialogHeader className="p-6 border-b border-border shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Candidate Comparison
            </DialogTitle>
          </DialogHeader>

          {compareLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-bold">Loading candidate comparisons...</span>
            </div>
          ) : compareDetails.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20 text-xs text-muted-foreground italic">
              No candidates selected for comparison.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-6 items-stretch" style={{ gridTemplateColumns: `repeat(${compareDetails.length}, minmax(0, 1fr))` }}>
                {compareDetails.map((c) => {
                  const isBestOverall = getWinner('match_score') === c.id;
                  const isBestSkills = getWinner('score_skills') === c.id;
                  const isBestExp = getWinner('score_experience') === c.id;
                  const isBestProjects = getWinner('score_projects') === c.id;
                  const isBestEdu = getWinner('score_education') === c.id;

                  return (
                    <div key={c.id} className="border border-border rounded-2xl p-5 bg-slate-50/30 dark:bg-slate-950/10 space-y-5 flex flex-col justify-between h-full relative">
                      {/* Close button to remove from comparison */}
                      <button
                        onClick={() => {
                          const updated = compareIds.filter(id => id !== c.id);
                          setCompareIds(updated);
                          if (updated.length < 2) setShowCompare(false);
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Remove from comparison"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div className="space-y-5">
                        {/* Name & Basic details */}
                        <div className="text-center pb-4 border-b border-border">
                          <div className="inline-flex h-12 w-12 rounded-full bg-primary/10 border border-primary/20 items-center justify-center mb-2">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5 px-2">
                            <span className="truncate">{c.candidate_name}</span>
                            {isBestOverall && <span title="Highest overall score"><Trophy className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0 animate-bounce" /></span>}
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{c.candidate_email}</p>
                          <div className="mt-2.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${getStageColor(c.stage)}`}>
                              {c.stage}
                            </span>
                          </div>
                        </div>

                        {/* Match Score */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-border text-center space-y-1 shadow-sm">
                          <span className="text-[9px] uppercase font-extrabold text-slate-400">Overall Fit Score</span>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-2xl font-black text-primary">
                              {c.match_score != null ? `${Math.round(c.match_score * 100)}%` : 'N/A'}
                            </span>
                            {isBestOverall && <span className="text-[8px] font-black text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded">Top Fit</span>}
                          </div>
                        </div>

                        {/* Score Breakdown Progress Bars */}
                        <div className="space-y-3 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-border shadow-sm">
                          <h4 className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">AI Breakdown</h4>
                          {[
                            { label: 'Skills',     val: c.score_skills,     best: isBestSkills,     color: 'bg-primary' },
                            { label: 'Experience', val: c.score_experience, best: isBestExp,        color: 'bg-violet-500' },
                            { label: 'Projects',   val: c.score_projects,   best: isBestProjects,   color: 'bg-amber-500' },
                            { label: 'Education',  val: c.score_education,  best: isBestEdu,        color: 'bg-emerald-500' },
                          ].map((item) => {
                            const pct = item.val != null ? Math.round(item.val * 100) : null;
                            return (
                              <div key={item.label} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    {item.label}
                                    {item.best && <span title="Highest in category"><Trophy className="h-3 w-3 text-amber-500 fill-amber-500" /></span>}
                                  </span>
                                  <span className="font-black text-slate-900 dark:text-slate-100">
                                    {pct != null ? `${pct}%` : 'N/A'}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-300 ${item.color}`} style={{ width: pct != null ? `${pct}%` : '0%' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Matched & Missing Skills */}
                        <div className="space-y-2.5 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-border shadow-sm">
                          <h4 className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Skills Overlap</h4>
                          <div className="space-y-2">
                            <div>
                              <span className="text-[8px] font-extrabold text-emerald-600 block uppercase tracking-wider mb-1">Matched ({c.matched_skills?.length || 0})</span>
                              <div className="flex flex-wrap gap-1">
                                {c.matched_skills && c.matched_skills.length > 0 ? (
                                  c.matched_skills.map((s, idx) => (
                                    <span key={idx} className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-muted-foreground italic">None</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] font-extrabold text-rose-500 block uppercase tracking-wider mb-1">Missing ({c.missing_skills?.length || 0})</span>
                              <div className="flex flex-wrap gap-1">
                                {c.missing_skills && c.missing_skills.length > 0 ? (
                                  c.missing_skills.map((s, idx) => (
                                    <span key={idx} className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-emerald-600 font-bold italic">None</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Experience Highlights */}
                        <div className="space-y-2.5 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-border shadow-sm">
                          <h4 className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Experience Summary</h4>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {c.candidate_experience && c.candidate_experience.length > 0 ? (
                              c.candidate_experience.map((exp, idx) => (
                                <p key={idx} className="text-[9px] text-slate-700 dark:text-slate-300 leading-normal border-l border-primary/20 pl-2">
                                  {exp}
                                </p>
                              ))
                            ) : (
                              <span className="text-[9px] text-muted-foreground italic">No detailed experience parsed.</span>
                            )}
                          </div>
                        </div>

                        {/* Projects Highlights */}
                        <div className="space-y-2.5 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-border shadow-sm">
                          <h4 className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Projects</h4>
                          <div className="space-y-1.5 max-h-28 overflow-y-auto">
                            {c.candidate_projects && c.candidate_projects.length > 0 ? (
                              c.candidate_projects.map((p, idx) => (
                                <p key={idx} className="text-[9px] text-slate-700 dark:text-slate-300 leading-normal pl-2 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                                  {p}
                                </p>
                              ))
                            ) : (
                              <span className="text-[9px] text-muted-foreground italic">No projects detected.</span>
                            )}
                          </div>
                        </div>

                        {/* Education Highlights */}
                        <div className="space-y-2.5 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-border shadow-sm">
                          <h4 className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Education</h4>
                          <div className="space-y-1.5">
                            {c.candidate_education && c.candidate_education.length > 0 ? (
                              c.candidate_education.map((edu, idx) => (
                                <p key={idx} className="text-[9px] text-slate-800 dark:text-slate-200 font-medium">
                                  🎓 {edu}
                                </p>
                              ))
                            ) : (
                              <span className="text-[9px] text-muted-foreground italic">No education details parsed.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border shrink-0">
                        <Button
                          size="sm"
                          className="w-full text-[10px] h-8.5 font-bold"
                          onClick={() => { setShowCompare(false); setSelectedAppId(c.id); }}
                        >
                          Open Candidate Evaluation
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: 1-Click Convert Hired Candidate to Employee */}
      <Dialog open={showOnboardModal} onOpenChange={setShowOnboardModal}>
        <DialogContent className="max-w-lg w-full bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-5 border-b border-border bg-emerald-500/10 dark:bg-emerald-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Seamless Employee Onboarding
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Send a secure Magic Link invitation to <strong className="text-foreground">{appDetail?.candidate_name}</strong>. Their account, 30-60-90 day plan, and orientation will activate upon sign-up.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {onboardResult ? (
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
                  <CheckCircle2 className="h-5 w-5" /> {onboardResult.invitation_sent ? 'Magic Link Invitation Dispatched!' : 'Onboarding Activated!'}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs">
                  {onboardResult.message}
                </p>
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground uppercase font-bold text-[8px] block">Candidate Email</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{onboardResult.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase font-bold text-[8px] block">Status</span>
                    <span className="font-bold text-emerald-600">
                      {onboardResult.invitation_sent ? 'Pending Candidate Sign-Up' : 'Active Account Linked'}
                    </span>
                  </div>
                  {onboardResult.invite_url && (
                    <div className="col-span-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-border space-y-1.5 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-primary uppercase font-bold text-[9px] flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Magic Link Invitation URL
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(onboardResult.invite_url);
                            setCopiedInviteUrl(true);
                            setTimeout(() => setCopiedInviteUrl(false), 2000);
                          }}
                          className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 gap-1"
                        >
                          {copiedInviteUrl ? <CheckCheck className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedInviteUrl ? 'Copied Link!' : 'Copy Invitation Link'}</span>
                        </Button>
                      </div>
                      <div className="p-1.5 bg-slate-50 dark:bg-slate-950 rounded border border-border/60 text-[10px] font-mono text-muted-foreground truncate select-all">
                        {onboardResult.invite_url}
                      </div>
                      <span className="text-[9px] text-muted-foreground block">
                        An email invitation was automatically sent to {onboardResult.email}. You can also copy and send this link directly to the candidate.
                      </span>
                    </div>
                  )}
                  {onboardResult.project_id && (
                    <div className="col-span-2 bg-white dark:bg-slate-900 p-2 rounded border border-border">
                      <span className="text-primary uppercase font-bold text-[8px] block">Onboarding Checklist</span>
                      <span>✓ 30-60-90 Day Plan created in Projects & Tasks</span>
                    </div>
                  )}
                  {onboardResult.meeting_room_code && (
                    <div className="col-span-2 bg-white dark:bg-slate-900 p-2 rounded border border-border">
                      <span className="text-primary uppercase font-bold text-[8px] block">Orientation Meeting</span>
                      <span>🎥 Day 1 Orientation scheduled in CORE Meetings (Room: <span className="font-mono font-bold">{onboardResult.meeting_room_code}</span>)</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowOnboardModal(false);
                    setOnboardResult(null);
                  }}
                  className="w-full text-xs font-bold"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const confirmed = await coreConfirm({
                  title: 'Send Onboarding Invitation',
                  description: `Ready to send an onboarding magic link invitation to ${appDetail?.candidate_name}?`,
                  variant: 'success',
                  icon: <UserCheck className="h-5 w-5" />,
                  confirmLabel: 'Send Magic Link Invite',
                  details: (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Candidate:</span>
                        <span className="font-bold text-foreground">{appDetail?.candidate_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recipient Email:</span>
                        <span className="font-mono text-foreground">{appDetail?.candidate_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Job Title:</span>
                        <span className="font-semibold text-foreground">{onboardJobTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Start Date:</span>
                        <span className="font-semibold text-foreground">{onboardStartDate}</span>
                      </div>
                    </div>
                  ),
                });
                if (confirmed) {
                  const selectedDept = departments.find((d) => d.id === onboardDeptId);
                  onboardCandidateMutation.mutate({
                    role: onboardRole,
                    department_id: onboardDeptId,
                    department: selectedDept?.name || '',
                    job_title: onboardJobTitle,
                    manager_id: onboardManagerId || null,
                    start_date: onboardStartDate,
                    create_onboarding_tasks: onboardCreateTasks,
                    schedule_orientation_meeting: onboardScheduleOrientation,
                  });
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Job Title *</label>
                  <Input
                    required
                    value={onboardJobTitle}
                    onChange={(e) => setOnboardJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Department *</label>
                  <select
                    required
                    value={onboardDeptId}
                    onChange={(e) => setOnboardDeptId(e.target.value)}
                    className="w-full h-8.5 border border-input bg-background rounded-md px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">CORE System Role *</label>
                  <select
                    value={onboardRole}
                    onChange={(e: any) => setOnboardRole(e.target.value)}
                    className="w-full h-8.5 border border-input bg-background rounded-md px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR Administrator</option>
                    <option value="admin">Organization Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Reporting Manager</label>
                  <select
                    value={onboardManagerId}
                    onChange={(e) => setOnboardManagerId(e.target.value)}
                    className="w-full h-8.5 border border-input bg-background rounded-md px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- None (Direct Report) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Start Date *</label>
                <input
                  required
                  type="date"
                  value={onboardStartDate}
                  onChange={(e) => setOnboardStartDate(e.target.value)}
                  className="w-full border border-input bg-background rounded-md px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2.5 border-t border-border pt-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onboardCreateTasks}
                    onChange={(e) => setOnboardCreateTasks(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Auto-generate 30-60-90 Day Onboarding Plan in Tasks & Projects
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Populates IT setup, security compliance, knowledge base reading, and goal review tasks.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onboardScheduleOrientation}
                    onChange={(e) => setOnboardScheduleOrientation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Schedule Day 1 Welcome Orientation in CORE Meetings
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Generates a virtual orientation room with agenda items and adds host + new hire to attendees.
                    </span>
                  </div>
                </label>
              </div>

              <DialogFooter className="pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowOnboardModal(false)}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={onboardCandidateMutation.isPending || !onboardJobTitle || !onboardDeptId || !onboardStartDate}
                  className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {onboardCandidateMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dispatching Magic Link...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Send Magic Link & Onboard
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 1. Modal: Customize Pipeline Stages per Job Posting */}
      <Dialog open={showCustomizeStagesModal} onOpenChange={setShowCustomizeStagesModal}>
        <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl bg-white dark:bg-slate-900 border-border p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Customize Pipeline Stages
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the progression stages for <strong>{activeJob?.title}</strong>. Candidates will flow through these steps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Stages List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {customStagesDraft.map((stg, idx) => (
                <div key={stg.id || idx} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950/40 border border-border p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <Input
                      value={stg.name}
                      onChange={(e) => {
                        const updated = [...customStagesDraft];
                        updated[idx].name = e.target.value;
                        setCustomStagesDraft(updated);
                      }}
                      className="h-8 text-xs bg-white dark:bg-slate-900 w-44"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => {
                        const updated = [...customStagesDraft];
                        const temp = updated[idx - 1];
                        updated[idx - 1] = updated[idx];
                        updated[idx] = temp;
                        setCustomStagesDraft(updated);
                      }}
                      className="h-7 w-7 p-0 text-slate-500 hover:text-foreground"
                      title="Move Up"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === customStagesDraft.length - 1}
                      onClick={() => {
                        const updated = [...customStagesDraft];
                        const temp = updated[idx + 1];
                        updated[idx + 1] = updated[idx];
                        updated[idx] = temp;
                        setCustomStagesDraft(updated);
                      }}
                      className="h-7 w-7 p-0 text-slate-500 hover:text-foreground"
                      title="Move Down"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={customStagesDraft.length <= 2}
                      onClick={() => {
                        setCustomStagesDraft(customStagesDraft.filter((_, i) => i !== idx));
                      }}
                      className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Remove Stage"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Stage Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="e.g. Technical Assessment, System Design..."
                className="h-8.5 text-xs bg-white dark:bg-slate-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newStageName.trim()) {
                    e.preventDefault();
                    const newId = newStageName.trim().toLowerCase().replace(/\s+/g, '_');
                    setCustomStagesDraft([
                      ...customStagesDraft,
                      { id: newId, name: newStageName.trim(), order: customStagesDraft.length }
                    ]);
                    setNewStageName('');
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!newStageName.trim()}
                onClick={() => {
                  const newId = newStageName.trim().toLowerCase().replace(/\s+/g, '_');
                  setCustomStagesDraft([
                    ...customStagesDraft,
                    { id: newId, name: newStageName.trim(), order: customStagesDraft.length }
                  ]);
                  setNewStageName('');
                }}
                className="h-8.5 text-xs font-bold gap-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCustomizeStagesModal(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updateJobStagesMutation.isPending || customStagesDraft.length === 0}
              onClick={() => {
                const normalized = customStagesDraft.map((stg, i) => ({
                  ...stg,
                  id: stg.id || stg.name.toLowerCase().replace(/\s+/g, '_'),
                  order: i
                }));
                updateJobStagesMutation.mutate(normalized);
              }}
              className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white"
            >
              {updateJobStagesMutation.isPending ? 'Saving...' : 'Save Pipeline Stages'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modal: Simulate Inbound Candidate Email Reply */}
      <Dialog open={showSimulateReplyModal} onOpenChange={setShowSimulateReplyModal}>
        <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl bg-white dark:bg-slate-900 border-border p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Simulate Candidate Inbound Reply
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Test two-way candidate email parsing. This creates an inbound message from <strong>{appDetail?.candidate_email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Reply Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Accept Interview', text: 'Hi! Thank you for the invitation. I would love to proceed with the technical interview at the earliest convenience.' },
                  { label: 'Confirm Availability', text: 'Sounds great! I am free anytime Thursday afternoon or Friday morning. Looking forward to speaking!' },
                  { label: 'Question on Benefits', text: 'Thank you for the update! Could you provide more details regarding health insurance and retirement plans?' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSimulatedBody(preset.text)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-border"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject</label>
              <Input
                value={simulatedSubject}
                onChange={(e) => setSimulatedSubject(e.target.value)}
                className="h-8.5 text-xs bg-white dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reply Message</label>
              <textarea
                value={simulatedBody}
                onChange={(e) => setSimulatedBody(e.target.value)}
                rows={5}
                className="w-full border border-input bg-white dark:bg-slate-900 rounded-md p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowSimulateReplyModal(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={simulateInboundReplyMutation.isPending || !simulatedBody.trim()}
              onClick={() => {
                simulateInboundReplyMutation.mutate({
                  subject: simulatedSubject.trim(),
                  body: simulatedBody.trim()
                });
              }}
              className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {simulateInboundReplyMutation.isPending ? 'Simulating...' : 'Log Inbound Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modal: Generate Self-Service Candidate Interview Invite Link */}
      <Dialog open={showSelfScheduleModal} onOpenChange={setShowSelfScheduleModal}>
        <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl bg-white dark:bg-slate-900 border-border p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Self-Service Interview Booking (Calendly-style)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate a shareable booking link allowing <strong>{appDetail?.candidate_name}</strong> to pick from conflict-free interviewer slots.
            </DialogDescription>
          </DialogHeader>

          {newlyCreatedInviteToken ? (
            <div className="space-y-4 py-3 animate-in fade-in duration-200">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <h4 className="font-black text-sm text-emerald-800 dark:text-emerald-200">Booking Link Ready!</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Share this personalized link with the candidate to let them choose an interview slot:
                </p>
                <div className="bg-white dark:bg-slate-900 border border-border p-2.5 rounded-xl flex items-center justify-between gap-2 mt-2">
                  <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                    {`${window.location.origin}/careers/schedule/${newlyCreatedInviteToken}`}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/careers/schedule/${newlyCreatedInviteToken}`;
                      navigator.clipboard.writeText(url);
                      setCopiedInviteToken(true);
                      setTimeout(() => setCopiedInviteToken(false), 2000);
                    }}
                    className="h-7 text-[10px] font-bold px-2.5 shrink-0"
                  >
                    {copiedInviteToken ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedInviteToken ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSelfScheduleModal(false)}
                  className="h-9 text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setActiveDrawerTab('emails');
                    setShowSelfScheduleModal(false);
                    const link = `${window.location.origin}/careers/schedule/${newlyCreatedInviteToken}`;
                    setComposeSubject(`Schedule your interview for ${activeJob?.title || 'Open Position'}`);
                    setComposeBody(`Hi ${appDetail?.candidate_name},\n\nWe would love to move forward and invite you to interview for the ${activeJob?.title} role!\n\nPlease pick a date and time that works best for you using our self-service scheduling link below:\n${link}\n\nLooking forward to speaking with you!\n\nBest regards,\nHiring Team`);
                  }}
                  className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" /> Compose Email with Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Duration</label>
                  <select
                    value={selfSchedDuration}
                    onChange={(e) => setSelfSchedDuration(e.target.value)}
                    className="w-full h-8.5 border border-input bg-white dark:bg-slate-900 rounded-md px-2.5 text-xs"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Format</label>
                  <select
                    value={selfSchedType}
                    onChange={(e) => setSelfSchedType(e.target.value)}
                    className="w-full h-8.5 border border-input bg-white dark:bg-slate-900 rounded-md px-2.5 text-xs"
                  >
                    <option value="video">🎥 CORE Video Room</option>
                    <option value="technical">💻 Technical Screen</option>
                    <option value="phone">📞 Phone Call</option>
                    <option value="in_person">🏢 In Person</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Interviewer Names</label>
                <Input
                  value={selfSchedInterviewers}
                  onChange={(e) => setSelfSchedInterviewers(e.target.value)}
                  placeholder="e.g. Alice Smith, Saumya Keshari"
                  className="h-8.5 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Link Validity</label>
                <select
                  value={selfSchedExpireDays}
                  onChange={(e) => setSelfSchedExpireDays(Number(e.target.value))}
                  className="w-full h-8.5 border border-input bg-white dark:bg-slate-900 rounded-md px-2.5 text-xs"
                >
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (Recommended)</option>
                  <option value={14}>14 Days</option>
                </select>
              </div>

              <DialogFooter className="pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSelfScheduleModal(false)}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={createInvitationMutation.isPending}
                  onClick={() => {
                    createInvitationMutation.mutate({
                      duration_min: Number(selfSchedDuration),
                      interview_type: selfSchedType,
                      interviewers: selfSchedInterviewers.split(',').map(s => s.trim()).filter(Boolean),
                      expiration_days: selfSchedExpireDays
                    });
                  }}
                  className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5"
                >
                  {createInvitationMutation.isPending ? 'Generating...' : 'Generate Booking Link'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
};
