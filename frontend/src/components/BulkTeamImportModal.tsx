import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Copy,
  Check,
  Download,
  Send,
  HelpCircle,
  X,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, extractErrorMessage } from '../lib/api';

interface BulkTeamImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `First Name,Last Name,Email,Role,Department,Designation,Manager Email,Skills
Sarah,Connor,sarah.connor@acme.corp,manager,Engineering,VP of Engineering,,Python; Django; System Architecture; Kubernetes
Alex,Chen,alex.chen@acme.corp,employee,Engineering,Senior Frontend Engineer,sarah.connor@acme.corp,React; TypeScript; TailwindCSS; UI/UX
Maya,Lin,maya.lin@acme.corp,employee,Engineering,Backend Engineer,sarah.connor@acme.corp,Django; PostgreSQL; Redis; Docker
David,Miller,david.miller@acme.corp,manager,Design,Head of Product Design,,Figma; Design Systems; Prototyping
Elena,Rostova,elena.rostova@acme.corp,employee,Design,Product Designer,david.miller@acme.corp,Figma; User Research; Wireframing`;

export const BulkTeamImportModal: React.FC<BulkTeamImportModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [sendInvites, setSendInvites] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<any | null>(null);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState<number | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-close timer on success
  useEffect(() => {
    if (autoCloseSeconds === null) return;
    if (autoCloseSeconds <= 0) {
      handleClose();
      return;
    }
    const timer = setTimeout(() => {
      setAutoCloseSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoCloseSeconds]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setSuccessReport(null);
      setAutoCloseSeconds(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setAutoCloseSeconds(null);
    setSuccessReport(null);
    setErrorMessage(null);
    onClose();
  };

  // Robust client-side preview parsing
  const parseRows = () => {
    if (!csvContent.trim()) return [];
    const text = csvContent.trim();

    // Check JSON first
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.employees || parsed.members || []);
        return list.map((item: any) => ({
          first_name: item.first_name || item.name?.split(' ')[0] || '',
          last_name: item.last_name || item.name?.split(' ').slice(1).join(' ') || '',
          email: item.email || item.email_address || '',
          role: item.role || 'employee',
          department: item.department || item.team || '',
          manager_email: item.manager_email || item.manager || '',
          skills: Array.isArray(item.skills) ? item.skills.join(', ') : item.skills || '',
        })).filter((r: any) => r.email);
      } catch (e) {
        // Fall back to CSV
      }
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    // Helper to parse a single CSV line with quoted values
    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rawHeaders = parseCsvLine(lines[0]);
    const headerMap: Record<number, string> = {};
    rawHeaders.forEach((h, idx) => {
      const norm = h.toLowerCase().replace(/[\s\-_]/g, '');
      if (norm.includes('first') || norm === 'fname') headerMap[idx] = 'first_name';
      else if (norm.includes('last') || norm === 'lname') headerMap[idx] = 'last_name';
      else if (norm.includes('email') && !norm.includes('manager')) headerMap[idx] = 'email';
      else if (norm === 'role') headerMap[idx] = 'role';
      else if (norm.includes('dept') || norm.includes('department') || norm === 'team') headerMap[idx] = 'department';
      else if (norm.includes('manager')) headerMap[idx] = 'manager_email';
      else if (norm.includes('skill') || norm.includes('competenc')) headerMap[idx] = 'skills';
      else if (norm.includes('name') && !norm.includes('last') && !norm.includes('first')) headerMap[idx] = 'first_name';
      else headerMap[idx] = norm;
    });

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length === 0 || values.every((v) => !v)) continue;

      const row: Record<string, string> = {
        first_name: '',
        last_name: '',
        email: '',
        role: 'employee',
        department: '',
        manager_email: '',
        skills: '',
      };

      values.forEach((val, idx) => {
        const key = headerMap[idx];
        if (key) {
          row[key] = val;
        }
      });

      if (row.email) {
        rows.push(row);
      }
    }
    return rows;
  };

  const previewRows = parseRows();

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setCsvContent(content);
        setErrorMessage(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_CSV);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const handleLoadSample = () => {
    setCsvContent(SAMPLE_CSV);
    setErrorMessage(null);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'team_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!csvContent.trim()) {
      setErrorMessage('Please paste CSV roster content or upload a CSV/JSON file.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessReport(null);

    try {
      const payload = {
        csv_data: csvContent.trim(),
        data: csvContent.trim(),
        send_invites: sendInvites,
      };

      const res: any = await api.post('/teams/employees/bulk-import/', payload);
      setSuccessReport(res);
      setCsvContent(''); // Clear on success
      onSuccess();
      setAutoCloseSeconds(2); // Start 2s countdown to auto-close
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to import team roster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20 shadow-sm">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Team Roster Importer</span>
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                  CSV / Google Sheets
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Onboard whole departments in seconds: auto-creates accounts, matches departments, connects reporting managers, and indexes skill tags.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xl font-bold bg-slate-100 dark:bg-slate-800 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 font-semibold text-xs animate-in shake duration-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successReport && (
            <div className="p-5 rounded-xl bg-emerald-50/90 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800/60 space-y-3 shadow-sm animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Onboarding Invitations Dispatched!</span>
                </div>
                {autoCloseSeconds !== null && (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Closing in {autoCloseSeconds}s...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-emerald-200/60 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">Invitations Sent</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {successReport.invitations_sent || successReport.imported_count || 0}
                  </span>
                </div>
                <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-emerald-200/60 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">Updated Active</span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                    {successReport.updated_active || 0}
                  </span>
                </div>
                <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-emerald-200/60 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">Skipped / Invalid</span>
                  <span className="text-xl font-black text-slate-500 dark:text-slate-400">
                    {successReport.skipped_count || 0}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-900/30 p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                ✨ <strong>What happens next:</strong> Employees receive an email with their secure magic link. Once they set up their password, they will automatically appear in their assigned Department and the Visual Org Chart. You can track pending invitations in the <strong>Invitations</strong> tab.
              </div>

              {successReport.errors && successReport.errors.length > 0 && (
                <div className="mt-2 p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                  <strong>Notes / Warnings:</strong> {successReport.errors.join('; ')}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Done (Close Window)
                </Button>
              </div>
            </div>
          )}

          {!successReport && (
            <>
              {/* Drag & Drop File Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[0.99]'
                    : 'border-border bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-900'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  accept=".csv,.json,.txt"
                  className="hidden"
                />
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Drag & Drop your <span className="text-primary">.csv</span> or <span className="text-primary">.json</span> roster file here, or click to browse
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Compatible with BambooHR, Gusto, Workday, Rippling, and Google Sheets exports
                </p>
              </div>

              {/* CSV Raw Text Paste Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Or Paste CSV Content Directly
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      Load Sample
                    </button>
                    <span className="text-muted-foreground text-[10px]">·</span>
                    <button
                      type="button"
                      onClick={handleCopySample}
                      className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-foreground font-semibold flex items-center gap-1"
                    >
                      {copiedTemplate ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedTemplate ? 'Copied' : 'Copy Format'}
                    </button>
                    <span className="text-muted-foreground text-[10px]">·</span>
                    <button
                      type="button"
                      onClick={handleDownloadSample}
                      className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-foreground font-semibold flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Template.csv
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => {
                    setCsvContent(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder={`First Name,Last Name,Email,Role,Department,Designation,Manager Email,Skills\nSarah,Connor,sarah.connor@acme.corp,manager,Engineering,VP of Engineering,,Python; Django; Kubernetes\nAlex,Chen,alex.chen@acme.corp,employee,Engineering,Frontend Dev,sarah.connor@acme.corp,React; TypeScript`}
                  className="w-full font-mono text-xs rounded-lg border border-input bg-white p-3 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                />
              </div>

              {/* Preview Parsed Rows */}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      Parsed Preview ({previewRows.length} members ready for import)
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Ready
                    </span>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground uppercase text-[9px] font-bold border-b border-border">
                        <tr>
                          <th className="p-2">Name & Email</th>
                          <th className="p-2">Role</th>
                          <th className="p-2">Department</th>
                          <th className="p-2">Manager</th>
                          <th className="p-2">Skills</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <td className="p-2 font-medium">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {r.first_name || 'Member'} {r.last_name || ''}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">{r.email}</span>
                            </td>
                            <td className="p-2 uppercase font-bold text-[9px] text-primary">{r.role || 'employee'}</td>
                            <td className="p-2 font-semibold text-slate-600 dark:text-slate-300">{r.department || '—'}</td>
                            <td className="p-2 text-muted-foreground">{r.manager_email || '—'}</td>
                            <td className="p-2 text-slate-500 max-w-[150px] truncate">{r.skills || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Mandatory Security Banner: Magic Link Onboarding */}
              <div className="p-3.5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Secure Magic Link Onboarding
                      </span>
                      <span className="text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                        Enforced
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Each employee will receive a private invitation link to create their own password and profile. They will appear in the directory and org chart once they accept.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!successReport && (
          <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>Missing departments are automatically created and assigned.</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} className="text-xs font-semibold px-4">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !csvContent.trim()}
                className="text-xs font-semibold px-5 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing Roster...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Import {previewRows.length > 0 ? `${previewRows.length} Members` : 'Team'}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

