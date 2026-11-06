import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Bot,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Mail,
  Send,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Flame,
  X,
  Target,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, extractErrorMessage } from '../lib/api';

interface StandupDigestModalProps {
  open: boolean;
  onClose: () => void;
  departments: any[];
}

export const StandupDigestModal: React.FC<StandupDigestModalProps> = ({
  open,
  onClose,
  departments,
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [summaryText, setSummaryText] = useState<string>('');
  const [shippedList, setShippedList] = useState<string[]>([]);
  const [inFlightList, setInFlightList] = useState<string[]>([]);
  const [blockersList, setBlockersList] = useState<string[]>([]);
  const [teamMood, setTeamMood] = useState<string>('Steady');
  const [activeBlockersCount, setActiveBlockersCount] = useState<number>(0);
  const [updateCount, setUpdateCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDispatchingBrevo, setIsDispatchingBrevo] = useState<boolean>(false);
  const [brevoSuccess, setBrevoSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');

  const fetchSummary = async (deptId?: string, dispatchEmail = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    setBrevoSuccess(null);

    try {
      const res: any = await api.post('/teams/status-feed/summary/', {
        department_id: deptId || null,
        dispatch_email: dispatchEmail,
      });

      setSummaryText(res.summary || res.summary_markdown || '');
      setShippedList(res.shipped_summary || res.key_accomplishments || []);
      setInFlightList(res.in_flight_summary || res.daily_priorities || []);
      setBlockersList(res.blockers_summary || res.blockers || []);
      setTeamMood(res.team_mood || 'Steady');
      setUpdateCount(res.standup_count || res.update_count || 0);
      setActiveBlockersCount(res.active_blockers_count || 0);

      if (res.email_dispatched) {
        setBrevoSuccess(`Dispatched Morning Digest via Brevo to ${res.email_recipient || "Department Head's inbox"}!`);
      }
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to generate AI standup digest.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchBrevo = async () => {
    setIsDispatchingBrevo(true);
    setBrevoSuccess(null);
    setErrorMessage(null);

    try {
      const res: any = await api.post('/teams/status-feed/summary/', {
        department_id: selectedDeptId || null,
        dispatch_email: true,
      });

      setBrevoSuccess(`Digest dispatched via Brevo to ${res.email_recipient || "Department Head"}!`);
      setTimeout(() => setBrevoSuccess(null), 6000);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to dispatch Brevo relay.');
    } finally {
      setIsDispatchingBrevo(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSummary(selectedDeptId);
    }
  }, [open, selectedDeptId]);

  if (!open) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([summaryText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const deptName = departments.find((d) => d.id === selectedDeptId)?.name || 'all_departments';
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `standup_digest_${deptName.toLowerCase().replace(/\s+/g, '_')}_${dateStr}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI Departmental Standup Rollup</span>
                <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                  <Bot className="h-3 w-3" /> Gemini 9:30 AM Digest
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Executive 3-bullet rollup: 🎯 Shipped &bull; 🚀 In Flight &bull; 🚨 Active Blockers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter and Action Bar */}
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Department:
            </span>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="h-8 rounded-md border border-input bg-white px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-900 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="">All Departments (Org-Wide)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <span className="text-muted-foreground text-[11px] font-semibold">
              ({updateCount} check-ins &bull; Mood: <span className="text-primary font-bold">{teamMood}</span>)
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Executive 3-Bullet
              </button>
              <button
                type="button"
                onClick={() => setViewMode('markdown')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  viewMode === 'markdown' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Markdown
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSummary(selectedDeptId)}
              disabled={isLoading}
              className="h-8 text-xs font-semibold px-2.5 gap-1.5 border-border"
              title="Regenerate Digest with Gemini"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </Button>

            {/* Brevo Relay Dispatch Button */}
            <Button
              size="sm"
              onClick={handleDispatchBrevo}
              disabled={isLoading || isDispatchingBrevo}
              className="h-8 text-xs font-bold px-3 gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm hover:from-indigo-700 hover:to-purple-700"
              title="Dispatch formatted Morning Digest directly to Department Head's email via Brevo"
            >
              {isDispatchingBrevo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              <span>Dispatch via Brevo</span>
            </Button>
          </div>
        </div>

        {brevoSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{brevoSuccess}</span>
          </div>
        )}

        {/* Scrollable Digest Viewport */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-slate-800 dark:text-slate-200 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Gemini is consolidating member check-ins into an executive 3-bullet rollup...
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Extracting releases, active sprint priorities, and flagging blockers requiring Department Head intervention.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 font-semibold text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : viewMode === 'cards' ? (
            /* Executive 3-Bullet Structured Card View */
            <div className="space-y-4">
              {/* Bullet 1: 🎯 Shipped */}
              <div className="p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/15 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    <Target className="h-4 w-4" />
                    <span>🎯 Shipped (Key Releases & Merged Work)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                    {shippedList.length} items
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {shippedList.length === 0 ? (
                    <p className="text-muted-foreground italic text-[11px]">No items reported shipped yesterday.</p>
                  ) : (
                    shippedList.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-950 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bullet 2: 🚀 In Flight */}
              <div className="p-4 rounded-xl border border-sky-200/70 dark:border-sky-900/40 bg-sky-50/30 dark:bg-sky-950/15 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                    <Rocket className="h-4 w-4" />
                    <span>🚀 In Flight (Primary Sprint Priorities Today)</span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 rounded-full">
                    {inFlightList.length} priorities
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {inFlightList.length === 0 ? (
                    <p className="text-muted-foreground italic text-[11px]">No active sprint priorities logged today.</p>
                  ) : (
                    inFlightList.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-sky-100 dark:border-sky-950 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 mt-1.5" />
                        <span>{item}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bullet 3: 🚨 Active Blockers */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                blockersList.length > 0
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${
                    blockersList.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>🚨 Active Blockers (Requires Leadership Intervention)</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    blockersList.length > 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {blockersList.length} blockers
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {blockersList.length === 0 ? (
                    <div className="flex items-center gap-2 p-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Zero impediments reported. Team execution is unimpeded! 👍</span>
                    </div>
                  ) : (
                    blockersList.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-red-100/60 dark:bg-red-900/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800 text-xs font-bold text-red-800 dark:text-red-200">
                        <Flame className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Raw Markdown View */
            <div className="bg-slate-50/70 dark:bg-slate-950/60 p-5 rounded-xl border border-border space-y-3 prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryText}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs font-semibold gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              className="text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .md</span>
            </Button>
          </div>

          <Button size="sm" onClick={onClose} className="text-xs font-bold px-4">
            Done
          </Button>
        </div>

      </div>
    </div>
  );
};
