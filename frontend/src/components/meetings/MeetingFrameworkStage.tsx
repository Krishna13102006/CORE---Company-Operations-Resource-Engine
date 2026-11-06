import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Kanban,
  ThumbsUp,
  Plus,
  Play,
  Pause,
  RotateCcw,
  User,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  Timer,
  X
} from 'lucide-react';

interface FrameworkProps {
  roomCode: string;
  templateType: string;
  isHost?: boolean;
  userEmail?: string;
  userName?: string;
  onClose?: () => void;
}

export const MeetingFrameworkStage: React.FC<FrameworkProps> = ({
  roomCode,
  templateType,
  isHost,
  userEmail = '',
  userName = 'Member',
  onClose,
}) => {
  const queryClient = useQueryClient();

  // Framework data query
  const { data: frameworkResponse } = useQuery({
    queryKey: ['meeting-framework', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/framework/`),
    refetchInterval: 3000,
  });

  const fwData = (frameworkResponse as any)?.data || frameworkResponse || {};

  const initialFw = (templateType === '1on1' || templateType === 'standup') ? templateType : 'retro';
  const [selectedFramework, setSelectedFramework] = useState<'retro' | '1on1' | 'standup'>(initialFw);

  // Fallback pre-populated columns if empty
  const defaultColumns = {
    keep: [
      { id: 'k1', text: 'Fast delivery on sprint milestones', author: userName || 'Team', votes: 2, voters: [] },
      { id: 'k2', text: 'Strong pair programming velocity', author: 'Team', votes: 1, voters: [] },
    ],
    stop: [
      { id: 's1', text: 'Context switching and ad-hoc interrupts', author: 'Team', votes: 3, voters: [] },
    ],
    start: [
      { id: 'st1', text: 'Automate deployment smoke tests', author: 'Team', votes: 4, voters: [] },
    ],
  };

  const retroColumns = (fwData.columns && Object.keys(fwData.columns).length > 0)
    ? fwData.columns
    : defaultColumns;

  // State for Retro
  const [retroInputs, setRetroInputs] = useState<Record<string, string>>({
    keep: '',
    stop: '',
    start: '',
  });

  // State for 1-on-1
  const [oneOnOneData, setOneOnOneData] = useState({
    wins: '',
    blockers: '',
    growth: '',
    private_notes: '',
  });

  // State for Standup timer
  const [standupSeconds, setStandupSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (fwData) {
      setOneOnOneData({
        wins: fwData.wins || 'Completed sprint user stories and code review on schedule...',
        blockers: fwData.blockers || 'Cross-team dependencies waiting on API docs...',
        growth: fwData.growth || 'Deepen skills in distributed event architecture...',
        private_notes: fwData.private_notes || '',
      });
    }
  }, [fwData]);

  // Timer interval for Standup
  useEffect(() => {
    let timer: any = null;
    if (isTimerRunning && standupSeconds > 0) {
      timer = setInterval(() => {
        setStandupSeconds((s) => s - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, standupSeconds]);

  // Action mutation
  const frameworkMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/meetings/room/${roomCode}/framework/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-framework', roomCode] });
    },
  });

  // Retro handlers
  const handleAddRetroCard = (column: 'keep' | 'stop' | 'start') => {
    const text = (retroInputs[column] || '').trim();
    if (!text) return;
    frameworkMutation.mutate({
      action: 'add_retro_card',
      column,
      text,
    });
    setRetroInputs({ ...retroInputs, [column]: '' });
  };

  const handleVoteRetroCard = (cardId: string) => {
    frameworkMutation.mutate({
      action: 'vote_retro_card',
      card_id: cardId,
    });
  };

  // 1-on-1 save
  const handleSave1on1 = () => {
    frameworkMutation.mutate({
      action: 'update_1on1',
      ...oneOnOneData,
    });
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Header with Interactive Framework Switcher */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Kanban className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs text-white hidden sm:inline">Meeting Framework</span>
        </div>

        {/* 1-Click Interactive Framework Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedFramework('retro')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFramework === 'retro'
                ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔄 Sprint Retro
          </button>
          <button
            type="button"
            onClick={() => setSelectedFramework('1on1')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFramework === '1on1'
                ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🤝 1-on-1 Sync
          </button>
          <button
            type="button"
            onClick={() => setSelectedFramework('standup')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFramework === 'standup'
                ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Daily Standup
          </button>
        </div>

        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* FRAMEWORK 1: SPRINT RETROSPECTIVE */}
      {selectedFramework === 'retro' && (
        <div className="flex-1 min-h-0 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
          {/* Column 1: Keep Doing */}
          <div className="flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                KEEP DOING (Wins)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {(retroColumns.keep || []).length} cards
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="What went exceptionally well?"
                value={retroInputs.keep || ''}
                onChange={(e) => setRetroInputs({ ...retroInputs, keep: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRetroCard('keep')}
                className="h-8 text-xs bg-slate-950 border-slate-800 text-slate-200"
              />
              <Button
                size="sm"
                onClick={() => handleAddRetroCard('keep')}
                className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(retroColumns.keep || []).map((card: any) => {
                const hasVoted = (card.voters || []).includes(userEmail.toLowerCase());
                return (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs space-y-2 shadow-sm"
                  >
                    <p className="text-slate-200 leading-relaxed">{card.text}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-500">
                      <span>{card.author}</span>
                      <button
                        type="button"
                        onClick={() => handleVoteRetroCard(card.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all ${
                          hasVoted
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{card.votes || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Stop Doing */}
          <div className="flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-xs text-rose-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                STOP DOING (Blockers)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {(retroColumns.stop || []).length} cards
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="What slowed us down or caused friction?"
                value={retroInputs.stop || ''}
                onChange={(e) => setRetroInputs({ ...retroInputs, stop: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRetroCard('stop')}
                className="h-8 text-xs bg-slate-950 border-slate-800 text-slate-200"
              />
              <Button
                size="sm"
                onClick={() => handleAddRetroCard('stop')}
                className="h-8 px-2.5 bg-rose-600 hover:bg-rose-500 text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(retroColumns.stop || []).map((card: any) => {
                const hasVoted = (card.voters || []).includes(userEmail.toLowerCase());
                return (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs space-y-2 shadow-sm"
                  >
                    <p className="text-slate-200 leading-relaxed">{card.text}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-500">
                      <span>{card.author}</span>
                      <button
                        type="button"
                        onClick={() => handleVoteRetroCard(card.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all ${
                          hasVoted
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{card.votes || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 3: Start Doing */}
          <div className="flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                START DOING (Ideas)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {(retroColumns.start || []).length} cards
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="What should we experiment with next?"
                value={retroInputs.start || ''}
                onChange={(e) => setRetroInputs({ ...retroInputs, start: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRetroCard('start')}
                className="h-8 text-xs bg-slate-950 border-slate-800 text-slate-200"
              />
              <Button
                size="sm"
                onClick={() => handleAddRetroCard('start')}
                className="h-8 px-2.5 bg-amber-600 hover:bg-amber-500 text-white shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(retroColumns.start || []).map((card: any) => {
                const hasVoted = (card.voters || []).includes(userEmail.toLowerCase());
                return (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs space-y-2 shadow-sm"
                  >
                    <p className="text-slate-200 leading-relaxed">{card.text}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-500">
                      <span>{card.author}</span>
                      <button
                        type="button"
                        onClick={() => handleVoteRetroCard(card.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all ${
                          hasVoted
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{card.votes || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FRAMEWORK 2: 1-ON-1 SYNC */}
      {selectedFramework === '1on1' && (
        <div className="flex-1 min-h-0 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wins */}
            <div className="space-y-2 p-4 bg-slate-900/90 rounded-2xl border border-slate-800">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                🌟 Wins & Highlights This Period
              </label>
              <textarea
                rows={3}
                value={oneOnOneData.wins}
                onChange={(e) => setOneOnOneData({ ...oneOnOneData, wins: e.target.value })}
                placeholder="Key accomplishments, closed deals, major milestones..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Blockers */}
            <div className="space-y-2 p-4 bg-slate-900/90 rounded-2xl border border-slate-800">
              <label className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                🚧 Current Obstacles & Blockers
              </label>
              <textarea
                rows={3}
                value={oneOnOneData.blockers}
                onChange={(e) => setOneOnOneData({ ...oneOnOneData, blockers: e.target.value })}
                placeholder="Dependencies, cross-team friction, resource constraints..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Growth */}
            <div className="space-y-2 p-4 bg-slate-900/90 rounded-2xl border border-slate-800">
              <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                🎯 Career Growth & Skill Development
              </label>
              <textarea
                rows={3}
                value={oneOnOneData.growth}
                onChange={(e) => setOneOnOneData({ ...oneOnOneData, growth: e.target.value })}
                placeholder="Skills to acquire, stretch assignments, mentorship goals..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Private Notes */}
            <div className="space-y-2 p-4 bg-slate-900/90 rounded-2xl border border-slate-800">
              <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Private Manager Feedback & Takeaways
              </label>
              <textarea
                rows={3}
                value={oneOnOneData.private_notes}
                onChange={(e) => setOneOnOneData({ ...oneOnOneData, private_notes: e.target.value })}
                placeholder="Confidential notes saved on the employee record..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave1on1}
              disabled={frameworkMutation.isPending}
              className="bg-primary text-white font-bold text-xs h-9 px-6 gap-2 shadow-md"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{frameworkMutation.isPending ? 'Syncing...' : 'Save 1-on-1 Framework Notes'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* FRAMEWORK 3: DAILY STANDUP */}
      {selectedFramework === 'standup' && (
        <div className="flex-1 min-h-0 p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-6 text-center">
          {/* Round Robin Timer */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl w-full space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center justify-center gap-1.5">
              <Timer className="h-4 w-4" />
              Speaker Allotted Time
            </span>

            <div className={`font-mono text-6xl font-extrabold ${standupSeconds < 15 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
              00:{standupSeconds.toString().padStart(2, '0')}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`font-bold text-xs h-9 px-4 gap-1.5 ${
                  isTimerRunning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isTimerRunning ? 'Pause' : 'Start Timer'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStandupSeconds(60);
                  setIsTimerRunning(false);
                }}
                className="h-9 px-3 text-xs border-slate-700 bg-slate-950 text-slate-300 hover:text-white gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset (60s)</span>
              </Button>
            </div>
          </div>

          {/* Discussion prompts */}
          <div className="grid grid-cols-3 gap-3 w-full text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <strong className="block text-emerald-400 pb-1">1. Yesterday</strong>
              What did you complete?
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <strong className="block text-indigo-400 pb-1">2. Today</strong>
              What are your top commits?
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <strong className="block text-rose-400 pb-1">3. Blockers</strong>
              Any bottlenecks?
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
