import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, FileText, Globe, CheckCircle2, Server, Eye, UserCheck, Key, Mail, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 space-y-10">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            GDPR • India DPDP Act 2023 • CCPA Compliant
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy & Data Sovereignty Charter
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Effective Date: September 26, 2026 • Version 2.4 • Applicable Globally (US, EU, UK, India, and International)
          </p>
        </div>

        {/* Quick Summary Box */}
        <div className="p-5 rounded-2xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
          <h2 className="text-sm font-bold text-purple-950 dark:text-purple-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary dark:text-purple-400" />
            Summary of Our Privacy Commitments
          </h2>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <li><strong>Strict Multi-Tenant Isolation:</strong> Your organization’s documents, chats, and vector embeddings are cryptographically and logically segregated.</li>
            <li><strong>Zero AI Model Training on Tenant Data:</strong> Under the EU AI Act Article 50, your proprietary data is never used to train or fine-tune public foundation AI models.</li>
            <li><strong>Instant Data Portability & Erasure:</strong> One-click export of your complete profile archive (.json) and permanent automated vector purging in accordance with GDPR Art. 17 & 20 and India DPDP Act Sec. 12.</li>
          </ul>
        </div>

        {/* Section 1 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">1.</span> Roles: Data Controller vs. Data Processor
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Under the General Data Protection Regulation (GDPR - EU 2016/679) and the Digital Personal Data Protection Act 2023 (India DPDP Act), roles are structured as follows:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
              <h3 className="text-xs font-bold uppercase text-primary dark:text-purple-400">Your Organization (Data Fiduciary / Controller)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Determines the purpose and lawful basis for collecting employee, applicant, and knowledge base document data uploaded to your workspace.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
              <h3 className="text-xs font-bold uppercase text-primary dark:text-purple-400">CORE Platform (Data Processor)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Processes workspace data strictly under instructions of the tenant organization, enforcing tenant isolation, role-based access control, and AES-256 encryption.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">2.</span> Data We Collect & Lawful Basis
          </h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>We process the following categories of data strictly for legitimate operational purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 text-xs">
              <li><strong>Account Identity:</strong> Work email address, first name, last name, encrypted password hash (Argon2 / PBKDF2), and user role (Admin, HR, Manager, Employee).</li>
              <li><strong>Authentication & Security:</strong> TOTP secret keys, one-time recovery backup codes, active session tokens, and security audit log metadata (IP address, user agent, timestamp).</li>
              <li><strong>Workspace Documents:</strong> Knowledge base PDFs, DOCX, TXT documents, expense receipts, candidate resumes, and vector semantic chunks.</li>
              <li><strong>Collaboration & Activity:</strong> Tasks, leave applications, meeting transcripts, and project notifications.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">3.</span> AI Governance & EU AI Act Article 50 Compliance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            In accordance with the <strong>European Union Artificial Intelligence Act (EU AI Act 2024/1689, Article 50)</strong> on transparency obligations for AI systems:
          </p>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p><strong>1. Identification of AI-Generated Content:</strong> All summaries, responses, and analyses produced by the platform's AI Assistant are prominently labeled with AI transparency indicators.</p>
            <p><strong>2. Zero Foundation Training:</strong> User documents and queries indexed into Qdrant vector memory are used solely for Retrieval-Augmented Generation (RAG) during the active user session and are never supplied to third-party models for training.</p>
            <p><strong>3. Human in the Loop:</strong> Critical HR hiring scorecards, leave approvals, and expense approvals are advisory and require authorized human personnel sign-off.</p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">4.</span> Your Statutory Rights (GDPR, DPDP, CCPA)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every user is equipped with self-service cryptographic tools in their Account Settings:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">Right to Access & Portability (Art. 20)</span>
              <p className="text-slate-500">Instant download of your personal data archive in machine-readable JSON format via Account Settings.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">Right to Erasure / Forgotten (Art. 17)</span>
              <p className="text-slate-500">Self-service permanent erasure with automated PII scrubbing and Qdrant vector memory purging.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">Right to Rectification (Art. 16)</span>
              <p className="text-slate-500">Update your name, email address, password, and security preferences directly at any time.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">Right to Withdraw Consent</span>
              <p className="text-slate-500">Modify your cookie and telemetry consent preferences through our dynamic preferences center.</p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">5.</span> Data Protection Officer (DPO) Contact
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            For privacy inquiries, Data Protection Impact Assessments (DPIA), or to exercise regulatory rights through our compliance team, contact our appointed Data Protection Officer:
          </p>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 text-xs">
            <Mail className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">Data Protection & Privacy Office</p>
              <p className="text-slate-500">Email: <a href="mailto:privacy@coreworkspace.com" className="text-primary hover:underline">privacy@coreworkspace.com</a> • Response SLA: Within 48 business hours</p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
