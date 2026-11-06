import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';
import {
  Sparkles,
  ArrowRight,
  Bot,
  Briefcase,
  FolderGit2,
  Users,
  Mail,
  Database,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  Search,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  FileText,
  Calendar,
  BookOpen,
  Lock,
  Globe,
  TrendingUp,
  Check,
  ShieldAlert,
  Clock,
  Send,
  HelpCircle,
  Play,
  CornerDownRight,
  Plus,
  Shield,
  ExternalLink,
  Activity,
  CheckCircle,
  BarChart3,
  Server,
  Layers3,
  CreditCard,
  Video,
  FileSpreadsheet,
  XCircle,
} from 'lucide-react';

// Custom lightweight IntersectionObserver hook for buttery smooth scroll reveals
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(node);
    return () => {
      if (node) observer.unobserve(node);
    };
  }, []);

  return { ref, isVisible };
}

// Reveal Section wrapper component
const RevealSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const Landing: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [demoPromptIdx, setDemoPromptIdx] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [displayedAnswer, setDisplayedAnswer] = useState<string>('');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track window scroll progress for smooth top reading indicator
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight > 0) {
        const scroll = `${(totalScroll / windowHeight) * 100}`;
        setScrollProgress(Number(scroll));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const demoPrompts = [
    {
      q: "What is our remote vacation policy and rollover limit?",
      a: "Employees receive **25 days of paid annual leave** per calendar year. Up to **5 unused vacation days** may be carried over into the following year upon manager approval.",
      source: "Employee Handbook 2026 (Page 14, Paragraph 3)",
      latency: "280ms (Gemini & Qdrant)"
    },
    {
      q: "What are the core engineering competencies for Senior Fullstack candidates?",
      a: "Senior Fullstack candidates are evaluated on **System Architecture Design**, **Async Task Queues (Celery/Redis)**, and **Multi-Tenant Database Scaling**.",
      source: "Engineering Hiring Rubric (Page 4)",
      latency: "245ms (Gemini & Qdrant)"
    },
    {
      q: "What are the active milestones for the Q3 Platform Redesign?",
      a: "The active milestone is **Gantt Milestone V2 (85% completed)**. Predecessor task *'Backend Schema API'* is marked Done.",
      source: "Projects Task Registry #PRJ-104",
      latency: "210ms (Gemini & Qdrant)"
    }
  ];

  useEffect(() => {
    setIsTyping(true);
    setDisplayedAnswer('');
    const fullText = demoPrompts[demoPromptIdx].a;
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx <= fullText.length) {
        setDisplayedAnswer(fullText.slice(0, currentIdx));
        currentIdx += 3;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [demoPromptIdx]);

  const features = [
    {
      id: 'knowledge',
      title: 'AI Knowledge Base & Semantic RAG',
      subtitle: 'Sub-Second Grounded Answers from All Company Documents',
      icon: Bot,
      description:
        'Powered by Google Gemini and Qdrant high-dimensional vector embeddings. Ingest thousands of PDFs, DOCX files, and handbook pages. Employees get answers in under 500ms with paragraph-level citation grounding and zero hallucinations.',
      highlights: [
        'Sub-500ms streaming generative AI answers grounded in verified documents',
        'Direct PDF page thumbnail caching with layout-aware preview citations',
        'Strict zero-hallucination verification with exact paragraph references',
        'Granular document privacy controls and role-based access scoping',
      ],
      previewTag: 'Knowledge Base',
    },
    {
      id: 'finance',
      title: 'Finance & AI Intelligence Hub',
      subtitle: 'Receipt OCR, Spend Approvals & CSV Spreadsheet Analytics',
      icon: CreditCard,
      description:
        'Streamline expense claims with automated Gemini Vision OCR. Managers approve reimbursements in 1-click, and sales/ops teams upload CSV spreadsheets for instant AI executive summaries and interactive charts.',
      highlights: [
        'Instant AI Vision receipt OCR auto-extracting merchants, dates, and amounts',
        '1-Click manager approval queues and automated payout batch generation',
        'Interactive spreadsheet CSV analyst with automatic chart generation',
        'Live spending analytics categorized by department and monthly burn rate',
      ],
      previewTag: 'Finance & Intelligence',
    },
    {
      id: 'projects',
      title: 'Projects, Kanban & Gantt Timelines',
      subtitle: 'Fluid Project Scheduling with Predecessor Dependencies',
      icon: FolderGit2,
      description:
        'Coordinate multi-department initiatives with fluid 4-column drag-and-drop Kanban boards, interactive Gantt timelines, predecessor task dependencies, and 4-tier urgency levels (Critical, High, Medium, Low).',
      highlights: [
        'Fluid 4-column drag-and-drop task Kanban (Backlog to Done)',
        'Interactive Gantt timeline with visual predecessor connectors',
        'Milestone tracking with live completion percentage progress bars',
        'Color-coded urgency priority matrix (Critical, High, Medium, Low)',
      ],
      previewTag: 'Projects & Tasks',
    },
    {
      id: 'departments',
      title: 'Department Members & Leave Balances',
      subtitle: 'Organizational Directory, Standups & Time-Off Governance',
      icon: Users,
      description:
        'Explore your department hierarchy, employee reporting lines, daily standup status check-ins, and leave requests with automated balance deductions and signed iCal feed synchronization.',
      highlights: [
        'Multi-department directory with instant search and role filtering',
        'Automated vacation/sick leave balance deduction on manager approval',
        'Signed iCal calendar feed URLs for Google Calendar & Outlook',
        'Daily team presence status feed with custom emojis and notes',
      ],
      previewTag: 'Department Members',
    },
    {
      id: 'meetings',
      title: 'Meetings & Live AI Minutes',
      subtitle: 'HD Video Rooms with Live Transcription & Action Items',
      icon: Video,
      description:
        'Create instant or scheduled WebRTC meeting rooms with password protection, live speech transcription, and automated AI meeting minutes with extracted action item checklists.',
      highlights: [
        'Instant 1-click video meeting rooms with secure room codes and passkeys',
        'Live audio transcription and speaker recognition',
        'Automated AI executive minutes and key decision summaries',
        'Action item checklist generation synced directly with Project tasks',
      ],
      previewTag: 'Meetings & Video',
    },
    {
      id: 'hiring',
      title: 'Talent Acquisition & ATS Pipeline',
      subtitle: 'Visual 6-Stage Recruitment Funnel with AI Resume Matcher',
      icon: Briefcase,
      description:
        'Track job applicants across a visual 6-stage recruitment funnel. Automatically parse uploaded resumes using layout-aware PDF extraction, score candidate suitability with AI, and sync email reply chains.',
      highlights: [
        'Visual 6-stage candidate recruitment pipeline (Applied to Hired)',
        'Automatic PDF resume parsing & structured skill extraction',
        'AI Candidate-to-Job matching scorecards and fit analysis',
        'Inbound candidate email reply tracking & auto-syncing feed',
      ],
      previewTag: 'Hiring ATS',
    },
    {
      id: 'governance',
      title: 'Org Governance & Document Vault',
      subtitle: 'Central Cross-Panel Vault, AI Quota Telemetry & Security',
      icon: ShieldCheck,
      description:
        'Manage organizational policies, track AI token usage against monthly limits, monitor PostgreSQL and Qdrant storage health, and explore the unified cross-panel document vault.',
      highlights: [
        'Unified document vault indexing knowledge SOPs, receipts, and resumes',
        'Real-time Gemini token consumption telemetry and cost savings gauge',
        'Qdrant vector database chunk health and PostgreSQL isolation diagnostics',
        'Superadmin safe-mode read-only SQL terminal and ER schema visualizer',
      ],
      previewTag: 'Org Governance',
    },
    {
      id: 'mail',
      title: 'Internal Communications & Mail',
      subtitle: 'Threaded Messaging with Multi-File Attachments',
      icon: Mail,
      description:
        'A unified internal messaging and email system featuring conversation threading by subject, drag-and-drop multi-file attachments (PDFs, images, archives) with secure streaming.',
      highlights: [
        'Clean message threading by subject and reply chains',
        'Multi-file attachments with secure blob streaming downloads',
        'Rich-text WYSIWYG editor (bold, lists, blockquotes, tables)',
        'Real-time unread badges and instant search filtering',
      ],
      previewTag: 'Mail Center',
    },
  ];

  const comparisons = [
    {
      feature: 'AI Document Knowledge Base',
      core: 'Native Gemini RAG with <500ms answers & PDF preview citations',
      legacy: 'Separate Notion / Confluence ($10+/user/mo + slow add-on AI)'
    },
    {
      feature: 'Expense Claims & Spreadsheet AI',
      core: 'Vision Receipt OCR, 1-Click Payouts & Interactive CSV Analyst',
      legacy: 'Expensify + Tableau / Excel ($35+/user/mo disconnected tools)'
    },
    {
      feature: 'Applicant Tracking System (ATS)',
      core: 'Built-in 6-stage Kanban, PDF resume auto-parser, email sync',
      legacy: 'Greenhouse / Lever ($6,000+/year standalone subscription)'
    },
    {
      feature: 'Project & Task Management',
      core: 'Kanban + Interactive Gantt timelines + Predecessor dependencies',
      legacy: 'Jira / Asana ($15+/user/mo with complex configuration)'
    },
    {
      feature: 'Department & Time-Off Governance',
      core: 'Department Directory, auto balance deductions & signed iCal sync',
      legacy: 'BambooHR / Gusto ($10+/user/mo disconnected from daily tasks)'
    },
    {
      feature: 'Video Meetings & AI Transcripts',
      core: 'WebRTC video rooms with live speech transcription & AI minutes',
      legacy: 'Zoom + Otter.ai ($30+/user/mo separate apps)'
    },
    {
      feature: 'Org Governance & Document Vault',
      core: 'Cross-panel Vault, AI token telemetry & Superadmin SQL Console',
      legacy: 'Fragmented cloud drives with zero central RBAC compliance'
    }
  ];

  const landingFaqs = [
    {
      q: 'What is CORE and who is it designed for?',
      a: 'CORE is an all-in-one enterprise workspace operating system built for fast-moving startups, growing technology firms, and modern companies that want to eliminate SaaS bloat and unify knowledge, finance, recruitment, projects, departments, communications, meetings, and data governance into one intuitive, blazing-fast platform.'
    },
    {
      q: 'How does CORE achieve sub-500ms AI search response times?',
      a: 'CORE pairs high-speed LLMs with local Qdrant dense vector embeddings. Ingested documents and handbooks are parsed, chunked, and indexed with 768-dimensional vector spaces, returning precise semantic citations in milliseconds.'
    },
    {
      q: 'Can I self-host CORE on my own infrastructure?',
      a: 'Yes! CORE is 100% open-source and comes with pre-configured Docker Compose scripts. You can run it on cloud VMs (AWS, Oracle Cloud Always Free Tier, Render) or host it on your own servers with zero per-seat subscription fees.'
    },
    {
      q: 'How does CORE guarantee multi-tenant data isolation and privacy?',
      a: 'Every database query, document vault asset, and vector search payload is cryptographically bound to the authenticated organization ID (org_id). Cryptographic TenantMiddleware prevents cross-tenant data leakage, and all sensitive keys are automatically masked.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white font-sans antialiased overflow-x-hidden w-full transition-colors duration-200">
      
      {/* Top Scroll Progress Indicator */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-purple-600 via-violet-600 to-purple-500 z-[100] transition-all duration-150 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Navigation Bar */}
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-28 bg-gradient-to-b from-white via-purple-50/40 to-slate-100/70 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[1000px] h-[350px] sm:h-[450px] bg-gradient-to-tr from-purple-300/30 via-violet-200/20 to-fuchsia-200/30 dark:from-purple-900/20 dark:via-violet-900/15 dark:to-fuchsia-900/20 blur-[100px] sm:blur-[130px] rounded-full pointer-events-none -z-0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          {/* Hero Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 dark:bg-primary/10 text-primary dark:text-purple-400 text-[11px] sm:text-xs font-bold mb-6 sm:mb-8 shadow-xs max-w-full truncate">
            <Sparkles className="h-3.5 w-3.5 text-primary dark:text-purple-400 shrink-0" />
            <span className="truncate">The Unified Enterprise Workspace & AI Operating System</span>
            <ChevronRight className="h-3 w-3 text-primary/70 dark:text-purple-400/70 shrink-0" />
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-5xl mx-auto leading-[1.15] mb-5 sm:mb-6">
            One Unified Operating System for{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600">
              Modern Organizations
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed mb-8 sm:mb-10 px-2">
            Consolidate fragmented tools into an all-in-one platform. Supercharged by{' '}
            <strong className="text-slate-900 dark:text-white font-bold">Grounded AI Document Search</strong>, Finance & CSV intelligence,
            Kanban & Gantt timelines, candidate ATS, meetings, and cross-panel governance.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 w-full max-w-md mx-auto sm:max-w-none">
            {user ? (
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 shadow-xl shadow-primary/25 text-sm sm:text-base transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5">
                  Go to Workspace Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 shadow-xl shadow-primary/25 text-sm sm:text-base transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link to="/docs" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-6 h-12 text-sm sm:text-base shadow-xs transition-all duration-300 hover:-translate-y-0.5">
                    <BookOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Read Documentation & FAQs
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Interactive AI Live Sandbox Demo (Fully Responsive & Overflow-Safe) */}
          <div id="demo" className="max-w-4xl mx-auto relative w-full">
            
            {/* Demo Container Card */}
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2.5 sm:p-4 shadow-2xl shadow-slate-900/10 dark:shadow-purple-950/20 text-left relative transition-all duration-500 overflow-hidden">
              <div className="p-4 sm:p-6 bg-slate-950 rounded-xl text-slate-100 space-y-4 border border-slate-800 overflow-hidden">
                
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 shrink-0">
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-rose-500" />
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500" />
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-mono text-slate-400 truncate">
                      CORE AI Knowledge Assistant (Live Sandbox)
                    </span>
                  </div>
                  <div className="self-start sm:self-auto flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded-md border border-purple-500/40 shrink-0">
                    <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400" />
                    <span>{demoPrompts[demoPromptIdx].latency}</span>
                  </div>
                </div>

                {/* Sample Prompt Selector Buttons (Full Width Stack on Mobile to Prevent Overflow) */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Select a sample query to test live retrieval:
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    {demoPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDemoPromptIdx(idx)}
                        className={`w-full max-w-full text-xs p-3 rounded-xl font-bold transition-all duration-200 text-left flex items-start sm:items-center gap-2.5 border min-w-0 ${
                          demoPromptIdx === idx
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/30 ring-2 ring-primary/40'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white'
                        }`}
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 mt-0.5 sm:mt-0 text-purple-300" />
                        <span className="min-w-0 flex-1 break-words leading-snug">{p.q}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Streaming Answer Box */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2.5 transition-all duration-300 overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="truncate">AI Assistant Grounded Response</span>
                    </div>
                    {isTyping && <span className="text-[10px] text-purple-300 font-mono animate-pulse shrink-0">Streaming...</span>}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans min-h-[48px] break-words">
                    {displayedAnswer}
                    {isTyping && <span className="inline-block w-1.5 h-4 bg-purple-400 ml-1 animate-pulse" />}
                  </p>
                  <div className="pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-purple-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileText className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">Verified Source: {demoPrompts[demoPromptIdx].source}</span>
                    </div>
                    <span className="text-emerald-400 font-bold shrink-0">Zero-Hallucination Grounding</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics / Proof Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 max-w-4xl mx-auto pt-10 sm:pt-14 text-left">
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 border-t-primary shadow-xs transition-all duration-300 hover:-translate-y-1">
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-0.5">&lt; 500ms</div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold leading-tight">AI Answer Latency</div>
            </div>
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 border-t-purple-600 shadow-xs transition-all duration-300 hover:-translate-y-1">
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-0.5">8-in-1</div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold leading-tight">Unified Modules</div>
            </div>
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 border-t-emerald-600 shadow-xs transition-all duration-300 hover:-translate-y-1">
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-0.5">100%</div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold leading-tight">Tenant Isolation & RBAC</div>
            </div>
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 border-t-violet-600 shadow-xs transition-all duration-300 hover:-translate-y-1">
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-0.5">$0.00</div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold leading-tight">Deploy Free on Docker</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Complete Feature Ecosystem */}
      <section id="features" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <RevealSection className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Layers className="h-3.5 w-3.5" />
              Complete Feature Ecosystem
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Explore All 8 Integrated Workspace Panels
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base">
              Everything your organization needs to collaborate, recruit, manage finances, document, meet, and govern in one unified interface.
            </p>
          </RevealSection>

          {/* Panel Selector Tabs (Scrollable on Mobile, Clean Wrapped & Centered on Laptop/Desktop) */}
          <RevealSection delay={100}>
            <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap justify-start sm:justify-center pb-2 sm:pb-0 mb-6 sm:mb-8 max-sm:no-scrollbar max-sm:-mx-4 max-sm:px-4">
              {features.map((feat, index) => {
                const Icon = feat.icon;
                const isActive = activeTab === index;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => setActiveTab(index)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 border cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/25 scale-[1.02]'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{feat.previewTag}</span>
                  </button>
                );
              })}
            </div>
          </RevealSection>

          {/* Active Panel Showcase Card */}
          <RevealSection delay={200}>
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-5 sm:p-10 shadow-lg overflow-hidden transition-all duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                
                {/* Left Details */}
                <div className="lg:col-span-6 space-y-4 sm:space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary dark:text-purple-400 text-xs font-black">
                    <span>{features[activeTab].previewTag}</span>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1.5">
                      {features[activeTab].title}
                    </h3>
                    <p className="text-primary dark:text-purple-400 font-bold text-xs sm:text-sm mb-3">
                      {features[activeTab].subtitle}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm sm:leading-relaxed">
                      {features[activeTab].description}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {features[activeTab].highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-bold">{h}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3">
                    <Link to="/docs">
                      <Button variant="outline" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold shadow-xs">
                        Read Full Documentation for {features[activeTab].previewTag}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right Mockup Display */}
                <div className="lg:col-span-6 w-full overflow-hidden">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-100 p-4 sm:p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">core.workspace/{features[activeTab].id}</span>
                      </div>
                    </div>

                    {/* Dynamic Panel Mockup */}
                    {activeTab === 0 && (
                      <div className="space-y-3 font-sans text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
                          <Search className="h-4 w-4 text-purple-400 shrink-0" />
                          <span className="truncate">Ask AI: What is our remote leave policy and carryover limit?</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-slate-200 space-y-2">
                          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                            <Bot className="h-4 w-4" />
                            <span>AI Assistant (Answered in 280ms)</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-xs">
                            Employees receive <strong>25 days of paid annual leave</strong> per calendar year. Up to <strong>5 unused vacation days</strong> may be carried over into the following year upon manager approval.
                          </p>
                          <div className="pt-2 border-t border-purple-500/20 flex items-center gap-2 text-[10px] text-purple-300">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Source: Employee Handbook 2026 (Page 14)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 1 && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-400" />
                            <span className="font-bold text-slate-200">Receipt OCR Scanned</span>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold">$142.50 USD</span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-1.5">
                          <div className="flex justify-between text-slate-300 text-[11px]">
                            <span>Merchant: Delta Air Lines</span>
                            <span className="text-emerald-300 font-bold">Auto-Categorized: Travel</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Confidence Score: 98.4% • Receipt Attached</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-purple-300 flex items-center justify-between">
                          <span>AI Spreadsheet Analyst: Q3 Sales Summary</span>
                          <span className="text-xs font-bold text-emerald-400">+24% Peak Detected</span>
                        </div>
                      </div>
                    )}

                    {activeTab === 2 && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Core UI Redesign</span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">Critical</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full w-3/4" />
                            </div>
                            <div className="text-[10px] text-slate-400">Predecessor: Backend Schema API</div>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">Gantt Milestone V2</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">High</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full w-full" />
                            </div>
                            <div className="text-[10px] text-emerald-400 font-medium">Milestone Completed</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 3 && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-2">
                          <div className="inline-block px-3 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold">
                            Engineering Department (18 Members)
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-left pt-2">
                            <div className="p-2 rounded bg-slate-950 border border-slate-800 font-semibold text-slate-300 text-[11px]">
                              Lead: Sarah Chen
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800 font-semibold text-slate-300 text-[11px]">
                              Leaves: 1 Out Today
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-[10px] text-emerald-300 flex items-center justify-between">
                          <span>Auto Leave Deduction: 3 Vacation Days</span>
                          <span>Balance: 22 Days Remaining</span>
                        </div>
                      </div>
                    )}

                    {activeTab === 4 && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-indigo-400" />
                            <span className="font-bold text-slate-200">Sprint Planning Call</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">Live</span>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-1">
                          <div className="text-[10px] text-purple-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Meeting Action Items Extracted:</span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            • Finalize API response schemas before Thursday sprint freeze.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === 5 && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                            <div className="font-bold text-slate-300 text-[10px] mb-0.5">Applied (12)</div>
                            <div className="text-[10px] text-slate-400">Sarah Chen</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                            <div className="font-bold text-purple-400 text-[10px] mb-0.5">Review (4)</div>
                            <div className="text-[10px] text-purple-200">Score: 94%</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                            <div className="font-bold text-emerald-400 text-[10px] mb-0.5">Offer (2)</div>
                            <div className="text-[10px] text-emerald-200">Accepted</div>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300 flex items-center justify-between">
                          <span>AI Resume Extraction: Skills & Experience</span>
                          <span className="text-emerald-400 font-bold">100% Match</span>
                        </div>
                      </div>
                    )}

                    {activeTab === 6 && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="font-bold text-slate-200">Cross-Panel Document Vault</span>
                          <span className="text-emerald-400 text-[10px] font-bold">Zero Cross-Org Leakage</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">Gemini Token Quota:</span>
                          <span className="text-purple-300 font-bold font-mono">1.8M / 2.0M Remaining</span>
                        </div>
                      </div>
                    )}

                    {activeTab === 7 && (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="flex justify-between items-center font-bold text-slate-200">
                            <span className="truncate">Q3 Architecture Roadmap Sync</span>
                            <span className="text-[10px] text-slate-400 font-normal shrink-0">10:42 AM</span>
                          </div>
                          <p className="text-slate-300 text-[11px] line-clamp-2">
                            Please review the attached threat model and database indexes before our sync this Thursday.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 text-purple-300 text-[10px]">
                              <FileText className="h-3 w-3" /> threat-model.pdf (1.8 MB)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Section 2: Comparison Section (Flawlessly Responsive: Mobile Cards & Desktop Table) */}
      <section id="comparison" className="py-16 sm:py-24 bg-slate-100/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <RevealSection className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
              <TrendingUp className="h-3.5 w-3.5" />
              Consolidation Advantage
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Why Teams Choose CORE Over Fragmented SaaS
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base">
              Save thousands of dollars annually and stop wasting hours syncing data between disconnected tools.
            </p>
          </RevealSection>

          {/* Desktop Table View (md:) */}
          <RevealSection delay={150} className="hidden md:block">
            <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-2xl">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900 dark:bg-slate-950 text-white font-black uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Capability</th>
                    <th className="px-6 py-4 text-purple-300 bg-slate-950 dark:bg-slate-900">CORE All-in-One</th>
                    <th className="px-6 py-4 text-slate-400">Legacy Disconnected Stack</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {comparisons.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors duration-150">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{c.feature}</td>
                      <td className="px-6 py-4 font-bold text-primary dark:text-purple-400 bg-primary/5 dark:bg-purple-950/20 border-x border-primary/20 dark:border-purple-800/40">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{c.core}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{c.legacy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealSection>

          {/* Mobile Comparison Cards View (< md) */}
          <div className="md:hidden space-y-4">
            {comparisons.map((c, i) => (
              <RevealSection key={i} delay={i * 60}>
                <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span>{c.feature}</span>
                  </h4>
                  
                  {/* CORE Advantage */}
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/40 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-primary dark:text-purple-400 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>CORE All-in-One</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-snug">{c.core}</p>
                  </div>

                  {/* Legacy Tool */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 mb-1">
                      <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span>Fragmented Stack</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-snug">{c.legacy}</p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Architecture & Security */}
      <section id="architecture" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <RevealSection className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Cpu className="h-3.5 w-3.5" />
              Enterprise Engineering
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Engineered for Extreme Speed, Privacy & Scale
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base">
              Built on modern cloud-native standards. Multi-tenant isolation with zero data leaks and sub-50ms latency.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
            <RevealSection delay={100} className="h-full">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-primary/50 dark:hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-purple-100 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-primary dark:text-purple-400 shadow-xs">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">High-Speed AI Inference</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Experience near-instant streaming AI answers powered by specialized LLMs and vector indexing with zero latency bottlenecks.
                  </p>
                </div>
                <div className="text-xs font-bold text-primary dark:text-purple-400 flex items-center gap-1 pt-2">
                  <span>Sub-500ms Response Time</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </RevealSection>

            <RevealSection delay={200} className="h-full">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-primary/50 dark:hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-purple-100 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-primary dark:text-purple-400 shadow-xs">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Qdrant Vector Database</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    State-of-the-art vector similarity database with strict payload tenant filtering, enabling rapid semantic discovery across all company files.
                  </p>
                </div>
                <div className="text-xs font-bold text-primary dark:text-purple-400 flex items-center gap-1 pt-2">
                  <span>Dense Vector Embeddings</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </RevealSection>

            <RevealSection delay={300} className="h-full">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-primary/50 dark:hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-purple-100 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-primary dark:text-purple-400 shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Cryptographic Multi-Tenant RBAC</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Granular role-based access control (Admin, HR, Manager, Employee), anti-spoofing TenantMiddleware, and full audit logs.
                  </p>
                </div>
                <div className="text-xs font-bold text-primary dark:text-purple-400 flex items-center gap-1 pt-2">
                  <span>Zero Cross-Org Leakage</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* Section 4: FAQs */}
      <section className="py-16 sm:py-24 bg-slate-100/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
          
          <RevealSection className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Got Questions?
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">Frequently Asked Questions</h2>
          </RevealSection>

          <div className="space-y-3">
            {landingFaqs.map((faq, i) => {
              const isOpen = faqOpen === i;
              return (
                <RevealSection key={i} delay={i * 60}>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => setFaqOpen(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-purple-400 transition-colors gap-3"
                    >
                      <span className="break-words leading-snug">{faq.q}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary dark:text-purple-400' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 animate-in fade-in">
                        {faq.a}
                      </div>
                    )}
                  </div>
                </RevealSection>
              );
            })}
          </div>

          <RevealSection delay={300} className="text-center pt-2">
            <Link to="/docs" className="text-xs font-bold text-primary dark:text-purple-400 hover:underline inline-flex items-center gap-1.5 transition-colors">
              <span>View full technical documentation & user guide</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* Section 5: Final Call to Action */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-white via-purple-50/30 to-slate-100 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-900 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8">
          <RevealSection>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
              Ready to Transform Your Team's Operating System?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto mt-3">
              Deploy CORE in minutes with Docker or launch your workspace instantly. Free forever for small teams.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-6 sm:pt-8 w-full max-w-md mx-auto sm:max-w-none">
              {user ? (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 text-sm sm:text-base shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5">
                    Open Workspace Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 text-sm sm:text-base shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </Link>
                  <Link to="/docs" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 h-12 text-sm sm:text-base shadow-xs font-bold transition-all duration-300 hover:-translate-y-0.5">
                      <BookOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      Read Documentation & FAQs
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Comprehensive Enterprise Footer */}
      <PublicFooter />
    </div>
  );
};
