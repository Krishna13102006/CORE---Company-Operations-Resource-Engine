import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { api, extractErrorMessage } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Briefcase,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  FileUp,
  ArrowRight,
  Sparkles,
  Sun,
  Moon,
  Clock,
  Send,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Zap,
  Users,
  Compass,
  X,
  Check,
  ChevronRight
} from 'lucide-react';

interface PublicJob {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string;
  experience_requirements: string;
  created_at: string;
}

interface CareersData {
  org_name: string;
  slug: string;
  total_open_jobs: number;
  jobs: PublicJob[];
}

export const PublicCareers: React.FC = () => {
  const { slug, jobId } = useParams<{ slug: string; jobId?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [viewingJob, setViewingJob] = useState<PublicJob | null>(null);

  // Application modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme state synchronized with global ThemeContext
  const { isDark, toggleTheme } = useTheme();

  // Fetch Public Careers Data
  const { data: careersData, isLoading, error } = useQuery<CareersData>({
    queryKey: ['public-careers', slug],
    queryFn: () => api.get(`/hiring/public/careers/${slug}/`),
    enabled: !!slug,
  });

  // Automatically select job if jobId URL parameter is present
  useEffect(() => {
    if (jobId && careersData?.jobs) {
      const matched = careersData.jobs.find((j) => j.id === jobId);
      if (matched) {
        setViewingJob(matched);
      }
    }
  }, [jobId, careersData]);

  const jobs = careersData?.jobs || [];
  const departments = ['all', ...Array.from(new Set(jobs.map((j) => j.department || 'General')))];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || (job.department || 'General') === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleOpenApplyModal = (job: PublicJob) => {
    setViewingJob(job);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setResumeFile(null);
    setApplyError(null);
    setApplySuccess(null);
    setIsApplyModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setApplyError('Please upload a PDF resume file.');
        setResumeFile(null);
        return;
      }
      setResumeFile(file);
      setApplyError(null);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingJob || !slug) return;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setApplyError('First name, last name, and email are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setApplyError(null);

      const formData = new FormData();
      formData.append('first_name', firstName.trim());
      formData.append('last_name', lastName.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('phone', phone.trim());
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const res: any = await api.post(
        `/hiring/public/careers/${slug}/jobs/${viewingJob.id}/apply/`,
        formData
      );

      setApplySuccess(res.message || 'Application submitted successfully!');
    } catch (err: any) {
      setApplyError(extractErrorMessage(err) || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center gap-4 transition-colors">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 shadow-xl shadow-purple-500/25 flex items-center justify-center text-white animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
              Loading Careers Portal
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Retrieving open opportunities...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !careersData) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-6 text-center transition-colors">
          <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-md">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
            Company Portal Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
            The careers portal for <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">"{slug}"</span> could not be located or is currently inactive.
          </p>
          <Link to="/">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-5 shadow-md shadow-purple-500/25">
              Return to CORE Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-100/90 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-purple-500/20 selection:text-purple-600 dark:selection:text-purple-300 transition-colors duration-200">
        
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 dark:bg-slate-950/95 border-b-2 border-slate-200 dark:border-slate-800/80 shadow-xs transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            
            {/* Left: Organization Branding */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-purple-500/25 shrink-0">
                {careersData.org_name[0]?.toUpperCase() || 'C'}
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight leading-none">
                  {careersData.org_name}
                </span>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1">
                  Careers & Opportunities
                </span>
              </div>
            </div>

            {/* Right: Badges & Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border-2 border-emerald-300/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                {careersData.total_open_jobs} Open Position{careersData.total_open_jobs === 1 ? '' : 's'}
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shadow-xs"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700" />
                )}
              </button>

              {/* Powered By CORE Pill */}
              <Link
                to="/"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-400 hover:border-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-xs font-bold transition-all shadow-xs"
                title="Powered by CORE Enterprise Workspace"
              >
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span>CORE</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-purple-100/60 via-slate-100/70 to-slate-200/50 dark:from-slate-950 dark:via-[#0e1424] dark:to-[#0b0f19] border-b-2 border-slate-300/80 dark:border-slate-800/80 pt-16 pb-14 px-4 sm:px-6 shadow-xs">
          
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-72 bg-gradient-to-r from-purple-500/15 via-violet-500/15 to-indigo-500/15 blur-3xl pointer-events-none rounded-full" />

          <div className="max-w-4xl mx-auto text-center space-y-5 relative z-10">
            
            {/* Hero Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-800/60 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" />
              <span>We Are Hiring</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
              Build the future at{' '}
              <span className="bg-gradient-to-r from-purple-700 via-violet-700 to-indigo-700 dark:from-purple-400 dark:via-violet-400 dark:to-indigo-300 bg-clip-text text-transparent drop-shadow-xs">
                {careersData.org_name}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
              We are assembling a team of passionate, exceptional problem-solvers to build high-impact solutions. Explore our open roles and find your next career challenge below.
            </p>

            {/* Culture / Value Pills */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 shadow-xs">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>High Autonomy & Impact</span>
              </div>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 shadow-xs">
                <Compass className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span>Flexible Work Culture</span>
              </div>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                <span>Growth & Modern Tooling</span>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section: Search, Filters & Job List */}
        <main className="max-w-5xl mx-auto w-full flex-1 px-4 sm:px-6 py-10 space-y-8">
          
          {/* Search Bar & Department Filter Controls */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md shadow-slate-200/50 dark:shadow-none space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <Input
                placeholder="Search by job title, department, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 text-sm h-11 rounded-xl focus-visible:ring-purple-600 focus-visible:border-purple-600 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Department Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-400 mr-1">
                Department:
              </span>
              {departments.map((dept) => {
                const isSelected = selectedDept === dept;
                const deptCount = dept === 'all'
                  ? jobs.length
                  : jobs.filter((j) => (j.department || 'General') === dept).length;

                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 border-2 border-purple-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border-2 border-slate-300/80 dark:border-slate-700'
                    }`}
                  >
                    <span>{dept === 'all' ? 'All Roles' : dept}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-purple-700 text-purple-100'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-400'
                    }`}>
                      {deptCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Job Section Header */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-300 dark:border-slate-800">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span>Available Openings</span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 ml-1">
                {filteredJobs.length}
              </span>
            </h2>

            {(searchQuery || selectedDept !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDept('all');
                }}
                className="text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Job Listings List or Empty State */}
          {filteredJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-md shadow-slate-200/50 dark:shadow-none">
              <div className="h-16 w-16 rounded-2xl bg-purple-100 dark:bg-purple-950/50 border-2 border-purple-200 dark:border-purple-800/50 flex items-center justify-center mx-auto text-purple-700 dark:text-purple-400 shadow-xs">
                <Briefcase className="h-8 w-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {jobs.length === 0 ? 'No open positions right now' : 'No roles match your search'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {jobs.length === 0
                    ? `Our team at ${careersData.org_name} is currently fully staffed, but we're continuously growing. Check back soon for upcoming openings.`
                    : 'Try broadening your search terms or clearing the department filter to discover other opportunities.'}
                </p>
              </div>

              {jobs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDept('all');
                  }}
                  className="border-2 border-slate-300 dark:border-slate-700 text-xs font-bold mt-2"
                >
                  Reset Filter Settings
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="group bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-600/70 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  {/* Left Column: Job Meta & Title */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60">
                        {job.department || 'General'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        <Clock className="h-3 w-3" /> Full-time
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        <MapPin className="h-3 w-3" /> Remote / Hybrid
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {job.title}
                    </h3>

                    {job.experience_requirements ? (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        <span className="font-bold text-slate-800 dark:text-slate-300">Experience: </span>
                        {job.experience_requirements}
                      </p>
                    ) : job.description ? (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {job.description.replace(/[#*`_]/g, '')}
                      </p>
                    ) : null}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingJob(job)}
                      className="border-2 border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 h-9"
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenApplyModal(job)}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-9 px-4 shadow-md shadow-purple-500/25 gap-1.5"
                    >
                      <span>Apply Now</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t-2 border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-8 px-6 text-center text-xs text-slate-600 dark:text-slate-400 transition-colors shadow-xs">
          <div className="max-w-4xl mx-auto space-y-2">
            <p className="font-bold text-slate-700 dark:text-slate-300">
              © {new Date().getFullYear()} {careersData.org_name}. All rights reserved.
            </p>
            <p className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
              <span>Powered by</span>
              <Link to="/" className="font-extrabold text-purple-700 dark:text-purple-400 hover:underline inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> CORE Enterprise ATS
              </Link>
              <span>&bull; Automated AI Candidate Screening</span>
            </p>
          </div>
        </footer>

      </div>

      {/* Modal: Job Details */}
      {viewingJob && !isApplyModalOpen && (
        <Dialog open={!!viewingJob} onOpenChange={(open) => !open && setViewingJob(null)}>
          <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <DialogHeader className="border-b-2 border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60">
                  {viewingJob.department || 'General'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Full-time Opportunity
                </span>
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {viewingJob.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Posted by {careersData.org_name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-6 text-xs leading-relaxed text-slate-700 dark:text-slate-300 pr-2">
              {viewingJob.description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    About The Role
                  </h4>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {viewingJob.description}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {viewingJob.requirements && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Key Requirements & Skillset
                  </h4>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {viewingJob.requirements}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {viewingJob.experience_requirements && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Required Experience
                  </h4>
                  <div className="text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-950/60 p-3.5 rounded-xl border-2 border-slate-250 dark:border-slate-800 font-medium">
                    {viewingJob.experience_requirements}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t-2 border-slate-200 dark:border-slate-800 pt-4 flex gap-2 justify-between items-center sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingJob(null)}
                className="border-2 border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-300"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenApplyModal(viewingJob)}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5 shadow-md shadow-purple-500/25 px-5"
              >
                <span>Apply for this Role</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Submit Application */}
      {isApplyModalOpen && viewingJob && (
        <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span>Apply: {viewingJob.title}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Submit your profile and resume to {careersData.org_name}.
              </DialogDescription>
            </DialogHeader>

            {applySuccess ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in duration-300">
                <div className="h-14 w-14 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-md">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Application Submitted!
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 max-w-sm mx-auto leading-relaxed font-medium">
                    {applySuccess}
                  </p>
                </div>
                <Button
                  onClick={() => setIsApplyModalOpen(false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold mt-2 px-6 shadow-md shadow-purple-500/20"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitApplication} className="space-y-4 py-2">
                {applyError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                    <X className="h-4 w-4 shrink-0" />
                    <span>{applyError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
                      First Name *
                    </label>
                    <Input
                      required
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
                      Last Name *
                    </label>
                    <Input
                      required
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
                      Email Address *
                    </label>
                    <Input
                      required
                      type="email"
                      placeholder="jane.doe@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Resume Upload Dropzone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
                    Resume Document (PDF) *
                  </label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-400 dark:border-slate-700 hover:border-purple-600 rounded-xl p-5 cursor-pointer bg-slate-50 dark:bg-slate-950/70 transition-colors shadow-2xs">
                    <FileText className="h-7 w-7 text-purple-600 dark:text-purple-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {resumeFile ? resumeFile.name : 'Click to select PDF resume'}
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                      {resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF format up to 10MB'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <DialogFooter className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsApplyModalOpen(false)}
                    className="border-2 border-slate-300 dark:border-slate-800 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5 px-5 shadow-md shadow-purple-500/25"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
