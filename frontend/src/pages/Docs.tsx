import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';
import {
  Sparkles,
  Search,
  BookOpen,
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
  FileText,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Lock,
  Server,
  Terminal,
  Clock,
  Code2,
  Menu,
  X,
  Check,
  Copy,
  AlertTriangle,
  Info,
  Key,
  ShieldAlert,
  GitBranch,
  CreditCard,
  FileSpreadsheet,
  Globe,
  Sliders,
  Scale,
  Workflow,
  CheckSquare,
  BarChart3,
  Flame,
  Activity,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

export const Docs: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navSections = [
    { id: 'overview', title: '1. Architecture & System Topology', icon: Layers },
    { id: 'getting-started', title: '2. Setup, Config & 4-Tier RBAC', icon: Sparkles },
    { id: 'dashboard', title: '3. Executive Dashboard & Action Hub', icon: LayoutDashboard },
    { id: 'knowledge', title: '4. AI Knowledge Base & Semantic RAG', icon: Bot },
    { id: 'finance', title: '5. Finance & Spreadsheet AI Analyst', icon: CreditCard },
    { id: 'hiring', title: '6. Talent Acquisition & ATS Funnel', icon: Briefcase },
    { id: 'projects', title: '7. Projects, Kanban & Gantt Timelines', icon: FolderGit2 },
    { id: 'teams', title: '8. Org Tree, Standups & Leave Feed', icon: Users },
    { id: 'mail', title: '9. Communications & Threaded Mail', icon: Mail },
    { id: 'database', title: '10. Database Admin & SQL Console', icon: Database },
    { id: 'security', title: '11. Security, SOC 2 & Compliance', icon: ShieldCheck },
    { id: 'faqs', title: '12. Enterprise FAQs & Troubleshooting', icon: HelpCircle },
  ];

  const faqs = [
    {
      q: 'How does CORE guarantee complete multi-tenant data isolation at the database and vector level?',
      a: 'CORE implements defense-in-depth isolation. At the relational database layer, all ORM queries are scoped through authenticated JWT tenant middleware using an immutable org_id foreign key. At the vector database layer, document embeddings indexed into Qdrant are segregated into per-tenant vector collections (org_<UUID>_knowledge) with cryptographic metadata filters. It is mathematically impossible for search queries or generative prompts to retrieve vectors belonging to another tenant.',
    },
    {
      q: 'How fast is the AI Knowledge RAG answer generation, and does it train public foundation models?',
      a: 'CORE leverages high-throughput Groq Cloud Language Processing Units (LPUs) delivering token generation speeds in excess of 300 tokens/second, resulting in full grounded responses in under 500ms. In compliance with the EU AI Act Article 50, all uploaded files, chats, and vector embeddings remain strictly confidential within your tenant perimeter and are never used to train or fine-tune public foundation AI models.',
    },
    {
      q: 'How does the PDF Page Preview render cache prevent server thread locks during concurrent usage?',
      a: 'When an employee views a multi-page PDF citation, CORE rasterizes the requested page once using pypdfium2 and saves it to a structured disk cache at media/cache/pdf_previews/<doc_id>/page_<idx>.jpg with immutable HTTP caching headers. All subsequent requests are served directly from disk or CDN edge in under 15ms without invoking Python interpreters or acquiring thread locks.',
    },
    {
      q: 'How does automated leave balance deduction work during time-off requests?',
      a: "When an employee submits a time-off request, CORE validates working business days against configured company holidays. Upon a designated manager or HR admin approving the request, CORE executes a single atomic database transaction that updates the request status to 'Approved' and automatically deducts the calculated working days from the employee's JSON leave_balance ledger.",
    },
    {
      q: 'Can approved team vacations and interviews be synchronized with Google Calendar and Apple Calendar?',
      a: 'Yes! Every employee has access to a cryptographically signed iCal feed URL (/api/teams/calendar-feed/?token=...). Subscribing to this feed URL in Google Calendar, Apple Calendar, or Microsoft Outlook automatically synchronizes all approved team vacations, leave windows, and scheduled applicant interviews in real time.',
    },
    {
      q: 'What safeguards protect the Database Admin SQL Web Console against accidental data loss?',
      a: 'The SQL console features Proactive Safe-Mode guards. Destructive DDL and DML statements (including DROP TABLE, TRUNCATE, and UPDATE/DELETE statements lacking a WHERE clause) are blocked by default. To execute destructive maintenance operations, an organization Superadmin must explicitly toggle the high-visibility Safe-Mode Override safeguard.',
    },
    {
      q: 'How does CORE handle GDPR and DPDP compliance rights (Right to Portability & Erasure)?',
      a: 'CORE provides automated self-service compliance tools in Account Settings. Users can generate a complete machine-readable archive (.json) of their personal profile, activity history, and tasks in 1 click (GDPR Art. 20 / DPDP Sec. 12). If an employee or admin triggers the Right to Erasure (GDPR Art. 17), CORE scrubs all personal identifers from relational logs and triggers delete_document_vectors to permanently purge all chunk embeddings from Qdrant vector memory.',
    },
    {
      q: 'Can CORE be deployed self-hosted on private on-premise servers for 100% free?',
      a: 'Yes! CORE is 100% open architecture and includes pre-configured production Docker Compose configurations (docker-compose.prod.yml). It can be deployed on any Linux cloud instance (including Oracle Cloud Always Free Tier with 4 ARM CPUs and 24GB RAM) or private bare-metal server behind a reverse proxy or Cloudflare Zero Trust tunnel with $0 per-seat licensing fees.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white font-sans antialiased">
      <PublicNavbar />

      {/* Main Documentation Shell */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 sm:pt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Mobile Nav Toggle */}
            <div className="lg:hidden">
              <Button
                variant="outline"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="w-full justify-between border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Menu className="h-4 w-4" />
                  Jump to Chapter...
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Sticky Sidebar Menu */}
            <div
              className={`space-y-4 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin ${
                mobileNavOpen ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* Search Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter chapters & topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-xs"
                />
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {navSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      onClick={() => {
                        setActiveSection(sec.id);
                        setMobileNavOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary dark:text-purple-400" />
                      <span className="truncate">{sec.title}</span>
                    </a>
                  );
                })}
              </nav>

              {/* System Specs Badge */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 text-[11px] shadow-xs">
                <div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px] flex items-center justify-between">
                  <span>Architecture Specs</span>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-1.5 font-mono text-[10.5px]">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Backend Core:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">Django 5 DRF</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Frontend UI:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">React 18 + Vite</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Vector Engine:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">Qdrant Vector DB</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Task Queues:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">Celery + Redis</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>AI Inference:</span>
                    <span className="text-primary dark:text-purple-400 font-bold">Groq LPU Cloud</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Content */}
          <main className="lg:col-span-9 space-y-16 pb-24">
            
            {/* Header Hero Banner */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-8 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                <BookOpen className="w-3.5 h-3.5" />
                CORE Enterprise Documentation & Operations Handbook
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                System Manual & Platform Reference
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                Comprehensive technical guide for administrators, developers, HR leaders, and team members. Learn how to configure multi-tenant boundaries, ingest document embeddings, manage projects with Gantt dependencies, process expense OCR, and enforce SOC 2 security governance.
              </p>
            </div>

            {/* ========================================================================= */}
            {/* CHAPTER 1: Platform Overview & System Architecture */}
            {/* ========================================================================= */}
            <section id="overview" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 01</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Platform Overview & System Architecture</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                CORE is engineered as an open-source, monolithic modular enterprise workspace. It combines grounded generative document AI, finance expense OCR, applicant tracking (ATS), Kanban/Gantt project scheduling, interactive org hierarchies, threaded mail, and raw SQL administrative tooling into a unified high-velocity platform.
              </p>

              {/* Topology Architecture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4 text-primary" /> Monolithic Django 5 REST Backend
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    A centralized, battle-tested Python framework managing all business rules, relational transactions in PostgreSQL, tenant-aware model managers, JWT cookie security, and connection pool reuse.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    Directory: <code>core/config/</code> & <code>core/apps/</code>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 text-sm">
                    <Cpu className="h-4 w-4 text-primary" /> Qdrant 1.12 Vector Database
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    High-dimensional vector database indexing dense semantic embeddings. Uses HNSW graphs for cosine similarity searches, scoped by payload metadata to guarantee zero cross-tenant leakage.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    Collection pattern: <code>org_&lt;UUID&gt;_knowledge</code>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 text-sm">
                    <Workflow className="h-4 w-4 text-primary" /> Asynchronous Celery & Redis Queues
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Multi-worker task distribution preventing synchronous web worker blocking. High-priority transactional tasks (emails, webhooks) run on the <code>priority</code> queue; heavy document OCR and vectorization run on <code>indexing</code>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    Queues: <code>priority</code>, <code>indexing</code>, <code>analytics</code>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" /> Groq Cloud LPU Inference Engine
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ultra-fast Language Processing Units (LPUs) executing LLaMA 3.3 70B & 3.1 8B inference at 300+ tokens/second. Streams grounded answers in under 500ms with 0 local server GPU load.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    Streaming endpoint: <code>/api/knowledge/chat/stream/</code>
                  </div>
                </div>
              </div>

              {/* Deep Architectural Guarantees Callout */}
              <div className="p-5 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-3 text-xs">
                <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Core Architectural Guarantees
                </div>
                <ul className="space-y-2.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Mathematical Data Isolation:</strong> Every database model inherits from <code>TenantScopedModel</code>. All read/write queries are dynamically bound to the current authenticated organization token.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Zero-Lock PDF Preview Rasterization:</strong> Rendered page previews are saved with immutable CDN headers (<code>media/cache/pdf_previews/</code>), completely eliminating Python thread lock contention on repeat views.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Multi-Region Relational Resilience:</strong> Structured database transactions use atomic blocks with connection pooling for seamless failover and high throughput under burst load.</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 2: Setup, Configuration & 4-Tier RBAC */}
            {/* ========================================================================= */}
            <section id="getting-started" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 02</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Installation, Configuration & 4-Tier RBAC</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Deploying CORE is streamlined through containerized Docker Compose configurations. Access permissions are strictly enforced through a 4-tier Role-Based Access Control (RBAC) engine.
              </p>

              {/* Docker Quickstart Box */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-purple-400" />
                    <span className="font-bold text-xs text-purple-300 font-mono">Production Deployment Script</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard('docker compose -f docker-compose.prod.yml up -d --build', 'deploy_cmd')}
                    className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 font-semibold transition-colors self-start sm:self-auto"
                  >
                    {copiedCode === 'deploy_cmd' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCode === 'deploy_cmd' ? 'Copied to Clipboard!' : 'Copy Shell Command'}</span>
                  </button>
                </div>
                <code className="text-xs font-mono text-purple-200 block bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto">
                  git clone https://github.com/skesur/Core.git && cd Core<br />
                  cp .env.example .env<br />
                  docker compose -f docker-compose.prod.yml up -d --build
                </code>
              </div>

              {/* Environment Variables Reference Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" /> Key Configuration Variables (.env)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-slate-600 dark:text-slate-400 text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Variable</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5">Default / Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      <tr>
                        <td className="px-4 py-2.5 text-primary font-bold">SECRET_KEY</td>
                        <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-400">Cryptographic signing secret for JWT tokens and sessions.</td>
                        <td className="px-4 py-2.5 text-slate-500">django-insecure-prod-...</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-primary font-bold">GROQ_API_KEY</td>
                        <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-400">Groq Cloud API key for ultra-fast LPU RAG generation.</td>
                        <td className="px-4 py-2.5 text-slate-500">gsk_...</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-primary font-bold">QDRANT_URL</td>
                        <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-400">Qdrant vector database HTTP endpoint URL.</td>
                        <td className="px-4 py-2.5 text-slate-500">http://qdrant:6333</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-primary font-bold">REDIS_URL</td>
                        <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-400">Redis instance for Celery task broker and caching.</td>
                        <td className="px-4 py-2.5 text-slate-500">redis://redis:6379/0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-Tier RBAC Breakdown Grid */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" /> 4-Tier Role-Based Access Control (RBAC) Matrix
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                    <div className="font-bold text-purple-800 dark:text-purple-300 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>1. Administrator (Superadmin)</span>
                      <span className="px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-[10px] font-bold">Full Scope</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Complete organizational authority: manage subscription quotas, invite/revoke users, mandate 2FA policies, inspect immutable audit trails, and execute queries in the Database Admin SQL console.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>2. HR Specialist</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Talent & People</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      End-to-end recruitment ATS funnel management, resume parsing, interview scheduling, scorecard reviews, employee onboarding, and department vacation/sick leave approvals.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>3. Department Manager</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Projects & Reports</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Project task assignments, Gantt milestone scheduling, predecessor dependency configuration, candidate interview scorecards, and direct-report leave request approvals.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>4. Employee</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Standard User</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Personal daily agenda, grounded AI knowledge assistant, assigned tasks, time-off requests with automated balance deductions, signed iCal calendar feeds, and threaded internal mail.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 3: Executive Dashboard & Operational Command Center */}
            {/* ========================================================================= */}
            <section id="dashboard" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 03</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Executive Dashboard & Action Hub</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                The Executive Dashboard is the unified command center presented upon login. It dynamically curates personal daily checklists, pending manager approval queues, one-click quick actions, and organization audit alerts.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Personal Daily Agenda
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Aggregates today's interviews, overdue project milestones, and teammates on leave into a clear, actionable checklist.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Pending Action Counters
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Live counters alerting managers to unapproved vacations, pending candidate scorecards, and reimbursement requests.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> 1-Click Quick Actions
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Shortcuts to request time-off, upload knowledge assets, log an expense, or draft mail without navigating deep menus.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 4: AI Knowledge Base & Semantic RAG Engine */}
            {/* ========================================================================= */}
            <section id="knowledge" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 04</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">AI Knowledge Base & Semantic RAG Engine</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Transform employee handbooks, technical runbooks, and SOPs into an interactive generative intelligence assistant. Receive verified answers in under 500ms with paragraph-level source grounding and instant PDF page preview citations.
              </p>

              {/* Step-by-Step RAG Pipeline */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">End-to-End RAG Ingestion & Query Lifecycle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-primary block text-[11px] uppercase">Step 1: Multi-Doc Ingest</span>
                    <p className="text-slate-600 dark:text-slate-400">Upload PDF, DOCX, TXT documents or author rich Notion-style wiki articles in the browser.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-primary block text-[11px] uppercase">Step 2: Dense Chunking</span>
                    <p className="text-slate-600 dark:text-slate-400">Documents split into 500-token semantic chunks with 100-token sliding overlap windows.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-primary block text-[11px] uppercase">Step 3: Vector Indexing</span>
                    <p className="text-slate-600 dark:text-slate-400">Embeddings stored in Qdrant with tenant payload tagging for strict cross-org filtering.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="font-bold text-primary block text-[11px] uppercase">Step 4: LPU Streaming</span>
                    <p className="text-slate-600 dark:text-slate-400">Groq Cloud LPUs stream grounded answers with paragraph citations in &lt; 500ms.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 5: Finance & Spreadsheet AI Intelligence Hub */}
            {/* ========================================================================= */}
            <section id="finance" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 05</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Finance & Spreadsheet AI Analyst</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Streamline organizational spend governance and spreadsheet analysis. Features AI Vision receipt OCR, automated manager approval queues, and spreadsheet CSV analytics with interactive chart generation.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> AI Vision Receipt OCR
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Upload scanned receipts (JPG, PNG, PDF). Gemini Vision automatically extracts the merchant name, invoice date, currency, line items, and total amount, pre-filling expense reimbursement vouchers.
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-primary" /> Interactive CSV Spreadsheet Analyst
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Upload massive CSV data files. CORE parses schemas, generates statistical executive summaries, highlights anomalies, and generates responsive charts (bar, line, breakdown) in real time.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 6: Talent Acquisition & ATS Funnel */}
            {/* ========================================================================= */}
            <section id="hiring" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 06</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Talent Acquisition & ATS Funnel</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                A modern Applicant Tracking System (ATS) managing candidate pipelines across 6 visual Kanban stages: Applied, Screening, Technical Review, Culture Fit, Offer Extended, and Hired.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">Layout Resume Parser</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Auto-extracts candidate email, phone number, years of experience, and structured competency skills on PDF upload.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">Scorecard Rating Rubrics</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Standardized 1-to-5 star evaluation matrix with qualitative feedback and hiring decisions (Strong Yes, Yes, No).</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">Inbound Email Timeline</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Captures candidate email replies and automatically appends them directly to the applicant's activity record.</p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 7: Projects, Kanban & Gantt Timelines */}
            {/* ========================================================================= */}
            <section id="projects" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 07</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Projects, Kanban & Gantt Timelines</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Coordinate complex cross-functional initiatives with fluid 4-column drag-and-drop Kanban task boards, predecessor task blocking dependencies, 4-tier urgency matrices, and interactive Gantt milestone timelines.
              </p>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 text-xs">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Project Scheduling & Predecessor Dependencies</h3>
                <div className="space-y-2 text-slate-600 dark:text-slate-400 leading-relaxed">
                  <div><strong>4-Column Kanban:</strong> Seamless card dragging across <em>Backlog</em>, <em>In Progress</em>, <em>In Review</em>, and <em>Done</em>.</div>
                  <div><strong>4-Tier Urgency Matrix:</strong> Categorize tasks by <span className="text-rose-600 font-bold">Critical</span>, <span className="text-amber-600 font-bold">High</span>, <span className="text-purple-600 font-bold">Medium</span>, and <span className="text-slate-500 font-bold">Low</span> priority.</div>
                  <div><strong>Predecessor Dependency Guard:</strong> Enforces task completion ordering, preventing downstream deliverables from closing prematurely.</div>
                  <div><strong>Interactive Gantt Timelines:</strong> Visual calendar timeline showing milestone dates, dependency connectors, and live progress bars.</div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 8: Dynamic Org Tree, Standups & Leave Feed */}
            {/* ========================================================================= */}
            <section id="teams" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 08</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Org Tree, Standups & Leave Feed</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Explore reporting structures through an interactive Org Tree, automate vacation deductions upon manager approval, and subscribe to cryptographically signed iCal calendar feeds.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">Dynamic Org Tree Hierarchy</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Interactive canvas with collapsible department branches, executive reporting lines, and employee cards.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                  <span className="font-bold text-purple-900 dark:text-purple-200 block text-sm">Signed iCal Calendar Sync</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Paste your signed calendar token (<code>/api/teams/calendar-feed/?token=...</code>) into Google Calendar or Outlook for real-time leave and interview synchronization.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 9: Internal Communications & Mail */}
            {/* ========================================================================= */}
            <section id="mail" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 09</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Communications & Threaded Mail</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                A distraction-free internal mail system featuring subject conversation threading, secure blob attachment uploads, and rich-text editing.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Conversation Threading</span>
                  <p className="text-slate-600 dark:text-slate-400">Keeps discussions grouped by subject rather than flooding inboxes.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Multi-File Attachments</span>
                  <p className="text-slate-600 dark:text-slate-400">Stream PDFs, spreadsheets, and images with authenticated token checks.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Rich-Text Composer</span>
                  <p className="text-slate-600 dark:text-slate-400">Supports markdown formatting, code snippets, lists, and tables.</p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 10: Database Admin & Safe-Mode SQL Console */}
            {/* ========================================================================= */}
            <section id="database" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 10</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Database Admin & SQL Console</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                An administrator suite for inspecting schema Entity Relationship (ER) diagrams, foreign key connections, and executing raw SQL queries with safe-mode destructive guards.
              </p>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Interactive Schema ER Visualizer</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Inspects live Django ORM models across all installed apps, detailing column data types, nullability, primary keys, and foreign key relations.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 text-sm">
                    <ShieldAlert className="h-4 w-4 text-amber-600" /> Safe-Mode Destructive Guards
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Blocks destructive queries (<code>DROP TABLE</code>, <code>TRUNCATE</code>, <code>DELETE/UPDATE</code> lacking a <code>WHERE</code> clause) unless the administrator explicitly toggles the Safe-Mode Override.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 11: Security, SOC 2 & Compliance */}
            {/* ========================================================================= */}
            <section id="security" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 11</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Security, SOC 2 & Compliance</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                CORE is engineered with enterprise security controls aligned with SOC 2 Type II, ISO 27001, GDPR, UK GDPR, and India DPDP Act 2023 statutory obligations.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> AES-256 & TLS 1.3 Encryption
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">All database records, documents, and vector embeddings are encrypted at rest with tenant keys and secured in transit via TLS 1.3.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-primary" /> Mandatory Org-Wide 2FA
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">Admins can enforce TOTP two-factor authentication (Google Authenticator, Authy, 1Password) across all workspace accounts.</p>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* CHAPTER 12: Enterprise FAQs & Troubleshooting */}
            {/* ========================================================================= */}
            <section id="faqs" className="space-y-6 scroll-mt-24">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">Chapter 12</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">Enterprise FAQs & Troubleshooting</h2>
              </div>

              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:text-primary transition-colors gap-3"
                      >
                        <span className="break-words leading-snug">{faq.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-primary' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 animate-in fade-in">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};
