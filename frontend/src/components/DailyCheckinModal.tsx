import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  Flame,
  Clock,
  Layers,
  ArrowRight,
  Loader2,
  X,
  ListTodo,
  Check,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, extractErrorMessage } from '../lib/api';

interface DailyCheckinModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: any;
  onSuccess?: () => void;
}

export const DailyCheckinModal: React.FC<DailyCheckinModalProps> = ({
  open,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [yesterdayText, setYesterdayText] = useState('');
  const [todayText, setTodayText] = useState('');
  const [hasBlockers, setHasBlockers] = useState(false);
  const [blockersDescription, setBlockersDescription] = useState('');
  const [blockerSeverity, setBlockerSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [statusEmoji, setStatusEmoji] = useState('🚀');

  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load user's active & completed tasks from CORE Tasks
  const [userTasks, setUserTasks] = useState<{
    completed_yesterday: Array<{ id: string; title: string; project_name: string; priority: string }>;
    assigned_today: Array<{ id: string; title: string; project_name: string; priority: string; status: string }>;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      // Pre-fill existing status if available
      if (currentUser?.status_message) {
        setTodayText(currentUser.status_message);
      }
      if (currentUser?.status_emoji) {
        setStatusEmoji(currentUser.status_emoji);
      }

      setIsLoadingTasks(true);
      api.get('/teams/daily-status/my-tasks/')
        .then((data: any) => setUserTasks(data))
        .catch(() => {})
        .finally(() => setIsLoadingTasks(false));
    }
  }, [open, currentUser]);

  if (!open) return null;

  // 1-Click Auto-fill completed tasks into Question 1
  const handleAutoFillCompletedTasks = () => {
    if (!userTasks || userTasks.completed_yesterday.length === 0) {
      setYesterdayText((prev) => (prev ? `${prev}\n• Wrapped up active sprint review deliverables.` : '• Wrapped up active sprint review deliverables.'));
      return;
    }
    const lines = userTasks.completed_yesterday.map(
      (t) => `• [${t.project_name}] Shipped task: ${t.title}`
    );
    setYesterdayText(lines.join('\n'));
  };

  // 1-Click Link assigned tasks into Question 2
  const handleLinkAssignedTasks = () => {
    if (!userTasks || userTasks.assigned_today.length === 0) {
      setTodayText((prev) => (prev ? `${prev}\n• Executing sprint backlog milestones.` : '• Executing sprint backlog milestones.'));
      return;
    }
    const lines = userTasks.assigned_today.slice(0, 5).map(
      (t) => `• [${t.project_name}] Priority: ${t.title} (${t.priority.toUpperCase()})`
    );
    setTodayText(lines.join('\n'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.post('/teams/daily-status/', {
        yesterday_accomplished: yesterdayText.trim(),
        today_focus: todayText.trim(),
        has_blockers: hasBlockers,
        blockers_description: hasBlockers ? blockersDescription.trim() : '',
        blocker_severity: hasBlockers ? blockerSeverity : 'none',
        status_emoji: hasBlockers ? '🚨' : statusEmoji,
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to submit daily check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>3-Question Rapid Async Check-in</span>
                <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20">
                  Daily Standup
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share your daily progress in under 60 seconds. Auto-fills from CORE tasks and rolls up into the executive digest.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-bold flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Question 1: What did you accomplish yesterday? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>What did you accomplish yesterday?</span>
              </label>

              <button
                type="button"
                onClick={handleAutoFillCompletedTasks}
                disabled={isLoadingTasks}
                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 transition-all hover:bg-primary/20"
                title="1-Click auto-fills recently completed tasks from CORE"
              >
                <Sparkles className="h-3 w-3" />
                <span>1-Click Auto-fill ({userTasks?.completed_yesterday.length || 0} completed)</span>
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="e.g. Completed API authentication refresh token route, merged PR #142..."
              value={yesterdayText}
              onChange={(e) => setYesterdayText(e.target.value)}
              className="w-full rounded-xl border border-input bg-slate-50/50 dark:bg-slate-950/50 p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          {/* Question 2: What are you focusing on today? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-extrabold flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>What are you focusing on today?</span>
              </label>

              <button
                type="button"
                onClick={handleLinkAssignedTasks}
                disabled={isLoadingTasks}
                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center gap-1 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800 transition-all hover:bg-sky-100"
                title="1-Click links your assigned sprint tasks"
              >
                <ListTodo className="h-3 w-3" />
                <span>Link Sprint Tasks ({userTasks?.assigned_today.length || 0} assigned)</span>
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="e.g. Rolling out Brevo Notification Relay, reviewing database indexes for Qdrant..."
              value={todayText}
              onChange={(e) => setTodayText(e.target.value)}
              className="w-full rounded-xl border border-input bg-slate-50/50 dark:bg-slate-950/50 p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          {/* Question 3: Any blockers? */}
          <div className="space-y-3 p-4 rounded-xl border border-border bg-slate-50/40 dark:bg-slate-950/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className={`h-5 w-5 rounded-md font-extrabold flex items-center justify-center text-[11px] ${
                  hasBlockers
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  3
                </span>
                <span>Any blockers or impediments?</span>
              </label>

              <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setHasBlockers(false)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    !hasBlockers
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  No Blockers 👍
                </button>
                <button
                  type="button"
                  onClick={() => setHasBlockers(true)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                    hasBlockers
                      ? 'bg-red-600 text-white shadow-sm animate-pulse'
                      : 'text-slate-600 dark:text-slate-400 hover:text-red-500'
                  }`}
                >
                  <AlertOctagon className="h-3 w-3" />
                  <span>Yes, I'm Blocked 🚨</span>
                </button>
              </div>
            </div>

            {hasBlockers && (
              <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Blocker Severity:
                  </span>
                  {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setBlockerSeverity(sev)}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all border ${
                        blockerSeverity === sev
                          ? sev === 'critical' || sev === 'high'
                            ? 'bg-red-600 text-white border-red-700 shadow-sm'
                            : 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-border hover:bg-slate-100'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                  <span className="text-[10px] text-red-500 font-semibold ml-auto">
                    * Alerts Department Head & Manager via Brevo
                  </span>
                </div>

                <textarea
                  rows={2}
                  placeholder="Describe what is blocking you (e.g. Waiting on AWS production RDS access credentials, Redis latency spike)..."
                  value={blockersDescription}
                  onChange={(e) => setBlockersDescription(e.target.value)}
                  required={hasBlockers}
                  className="w-full rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-red-400/60 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            )}
          </div>

          {/* Quick Emoji Status */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Profile Mood Emoji:
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {['🚀', '💬', '☕', '🔥', '💻', '🩺', '🏠', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setStatusEmoji(emoji)}
                  className={`h-7 w-7 text-xs rounded-lg flex items-center justify-center border transition-all ${
                    statusEmoji === emoji
                      ? 'border-primary bg-primary/10 shadow-sm scale-110'
                      : 'border-border bg-slate-50 dark:bg-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-xs font-bold gap-1.5 px-4 bg-gradient-to-r from-primary to-purple-600 text-white shadow-md shadow-primary/20 hover:from-primary/90 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Publishing Standup...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Submit 3-Question Check-in</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
