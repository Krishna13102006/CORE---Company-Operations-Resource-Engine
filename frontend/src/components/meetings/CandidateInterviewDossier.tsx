import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Briefcase,
  Star,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileText,
  Lock,
  ChevronRight,
  User,
  Sparkles,
  Award,
  ThumbsUp,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';

interface CandidateDossierProps {
  roomCode: string;
  isHost: boolean;
  userEmail?: string;
  onClose?: () => void;
}

interface StandardizedQuestionCategory {
  category: string;
  questions: string[];
}

interface PastScorecard {
  id: string;
  stage: string;
  reviewer: string;
  scores: Record<string, number>;
  recommendation: string;
  strengths: string;
  concerns: string;
  submitted_at: string | null;
}

interface DossierResponse {
  has_linked_candidate: boolean;
  application_id?: string;
  candidate_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  stage?: string;
  match_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  parsed_experience?: string[];
  parsed_education?: string[];
  parsed_projects?: any[];
  standardized_questions?: StandardizedQuestionCategory[];
  past_scorecards?: PastScorecard[];
  evaluation_submitted?: boolean;
  detail?: string;
}

export const CandidateInterviewDossier: React.FC<CandidateDossierProps> = ({
  roomCode,
  isHost,
  userEmail,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'scorecard' | 'questions' | 'resume'>('scorecard');
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);

  // Scorecard state
  const [scores, setScores] = useState<Record<string, number>>({
    technical_depth: 4,
    problem_solving: 4,
    communication: 4,
    culture_fit: 4,
    overall: 4,
  });
  const [recommendation, setRecommendation] = useState<'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'>('yes');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [advanceStage, setAdvanceStage] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch candidate dossier
  const { data: dossier, isLoading, error } = useQuery<DossierResponse>({
    queryKey: ['meeting-candidate-dossier', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/candidate-dossier/`),
    refetchInterval: 15000,
  });

  // Submit scorecard mutation
  const submitScorecardMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/meetings/room/${roomCode}/candidate-scorecard/`, payload),
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['meeting-candidate-dossier', roomCode] });
      queryClient.invalidateQueries({ queryKey: ['meeting-detail', roomCode] });
    },
    onError: (err: any) => {
      setSubmitError(extractErrorMessage(err));
    },
  });

  const handleSubmitScorecard = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    submitScorecardMutation.mutate({
      scores,
      recommendation,
      strengths,
      concerns,
      private_notes: privateNotes,
      advance_stage: advanceStage ? 'offer' : undefined,
    });
  };

  const handleCopyQuestion = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestion(text);
    setTimeout(() => setCopiedQuestion(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading Candidate Dossier & Scoring Guide...</p>
      </div>
    );
  }

  if (error || !dossier?.has_linked_candidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Briefcase className="h-10 w-10 text-slate-400 opacity-60" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Candidate Profile Linked</h4>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          {dossier?.detail || 'This meeting room is not currently connected to an active applicant in the Hiring Pipeline.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      {/* Privacy Guard Banner */}
      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-semibold shrink-0">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-amber-600" />
          Confidential Interviewer Panel (Guest cannot see this)
        </span>
      </div>

      {/* Candidate Profile Summary Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 shrink-0 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" />
              {dossier.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Applied for: <span className="text-slate-700 dark:text-slate-200 font-semibold">{dossier.job_title}</span>
            </p>
          </div>
          {typeof dossier.match_score === 'number' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
              {Math.round(dossier.match_score * 100)}% Match
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>Stage: <strong className="text-primary uppercase">{dossier.stage}</strong></span>
          {dossier.email && <span>• {dossier.email}</span>}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 p-1.5 bg-slate-100 dark:bg-slate-950/60 shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('scorecard')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'scorecard'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          Live Scorecard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'questions'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Question Guide
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resume')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'resume'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Resume Snapshot
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: LIVE SCORECARD */}
        {activeTab === 'scorecard' && (
          <form onSubmit={handleSubmitScorecard} className="space-y-4">
            {submitSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Evaluation submitted! Synced to Hiring Pipeline profile.</span>
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Dimensional Star Ratings */}
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                Structured Star Ratings (1 - 5)
              </label>

              {[
                { key: 'technical_depth', label: 'Technical Depth & Architecture' },
                { key: 'problem_solving', label: 'Problem Solving & Rigor' },
                { key: 'communication', label: 'Communication & Articulation' },
                { key: 'culture_fit', label: 'Culture & Collaboration Fit' },
                { key: 'overall', label: 'Overall Evaluation Score' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setScores({ ...scores, [key]: val })}
                        className="p-1 hover:scale-110 transition-transform"
                        title={`${val} Stars`}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            val <= (scores[key] || 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300 dark:text-slate-700'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-1 font-bold text-slate-700 dark:text-slate-300 font-mono w-3 text-right">
                      {scores[key] || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hiring Recommendation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hiring Recommendation *
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-primary"
              >
                <option value="strong_yes">🟢 Strong Yes (Top 5% Candidate)</option>
                <option value="yes">🟢 Yes (Meets Standard)</option>
                <option value="maybe">🟡 Maybe / Neutral (Needs Follow-up)</option>
                <option value="no">🔴 No (Does Not Meet Standard)</option>
                <option value="strong_no">🔴 Strong No (Definite Pass)</option>
              </select>
            </div>

            {/* Strengths */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Key Strengths & Highlights
              </label>
              <textarea
                rows={2}
                placeholder="What stood out about their responses, code quality, or domain knowledge?"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            {/* Concerns */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Concerns & Red Flags
              </label>
              <textarea
                rows={2}
                placeholder="Any gaps in fundamentals, communication friction, or missing competencies?"
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            {/* Private Interviewer Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Private Interviewer Log (Stored on Candidate Profile)
              </label>
              <textarea
                rows={3}
                placeholder="Detailed raw notes taken during the live session..."
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary"
              />
            </div>

            {/* Fast-track Advance Stage */}
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                checked={advanceStage}
                onChange={(e) => setAdvanceStage(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Immediately advance candidate to <strong>Offer Stage</strong> upon submission
              </span>
            </label>

            <Button
              type="submit"
              disabled={submitScorecardMutation.isPending}
              className="w-full font-bold text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitScorecardMutation.isPending ? 'Recording Evaluation...' : 'Submit Evaluation & Update Pipeline'}
            </Button>
          </form>
        )}

        {/* TAB 2: STANDARDIZED QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Standardized question rubric tailored for <strong>{dossier.job_title}</strong>. Click any prompt to copy it to clipboard.
            </p>

            {(dossier.standardized_questions || []).map((cat, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {cat.category}
                </h4>

                <div className="space-y-1.5 pt-1">
                  {cat.questions.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      onClick={() => handleCopyQuestion(q)}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-colors flex items-start justify-between gap-2 group"
                    >
                      <p className="leading-relaxed">{q}</p>
                      <button
                        type="button"
                        className="text-slate-400 group-hover:text-primary shrink-0 mt-0.5"
                        title="Copy question text"
                      >
                        {copiedQuestion === q ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: RESUME SNAPSHOT */}
        {activeTab === 'resume' && (
          <div className="space-y-4">
            {/* Skills Breakdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                Verified Candidate Skills
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(dossier.matched_skills || []).map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    ✓ {s}
                  </span>
                ))}
                {(dossier.missing_skills || []).map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  >
                    ? {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Experience History */}
            {dossier.parsed_experience && dossier.parsed_experience.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Experience History
                </label>
                <div className="space-y-1.5">
                  {dossier.parsed_experience.map((exp, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
                    >
                      {exp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {dossier.parsed_education && dossier.parsed_education.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Education
                </label>
                <div className="space-y-1.5">
                  {dossier.parsed_education.map((edu, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
                    >
                      {edu}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
