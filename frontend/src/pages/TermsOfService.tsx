import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, CheckCircle2, Shield, Sparkles, Scale, Server, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';

export const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" />
            Enterprise Master Services Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms of Service & Usage Governance
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Effective Date: September 26, 2026 • Version 2.2 • Binding Agreement between Customer and CORE Workspace Inc.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">1.</span> Workspace Creation & Multi-Tenant Boundaries
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            When you register an Organization on CORE, you create an isolated enterprise workspace. The Organization Administrator has full administrative authority to invite members, assign roles (Admin, HR, Manager, Employee), configure security policies (2FA enforcement, session idle timeouts), and control document visibility.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">2.</span> Intellectual Property & Data Ownership
          </h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <p><strong>Customer Retains 100% Data Ownership:</strong> All documents, files, employee records, expense receipts, task descriptions, and communication logs uploaded by Customer or its Authorized Users remain the sole and exclusive intellectual property of the Customer.</p>
            <p><strong>License to Host:</strong> Customer grants CORE a limited, non-exclusive license solely to host, index, create vector embeddings for, and process Customer Data for the exclusive purpose of providing the service to Customer.</p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">3.</span> Acceptable Use Policy & Security Obligations
          </h2>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p>Authorized Users agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
              <li>Attempt to bypass tenant isolation boundaries, execute unauthorized SQL injection, or access other organizations' vector indices.</li>
              <li>Upload malicious code, viruses, or illegal contraband.</li>
              <li>Share authentication passkeys, TOTP secrets, or session credentials outside authorized personnel.</li>
              <li>Use automated scraping bots to extract proprietary knowledge base documents without API tokens.</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">4.</span> Service Level Agreement (SLA) & Availability
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            CORE maintains a <strong>99.9% uptime commitment</strong> for all active production workspace environments, backed by automated health checks, multi-region database replication, and daily automated encrypted backups.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">5.</span> Account Termination & Data Return
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Customers may terminate their organization at any time. Upon termination or invoking the Right to Erasure, all active sessions are revoked, and all document vector embeddings in Qdrant and relational database records are permanently purged within 30 days in compliance with GDPR Article 17 and DPDP Act 2023.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
