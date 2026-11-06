import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Server, Sparkles, Key, CheckCircle2, Cpu, Database, Eye, Terminal, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';

export const SecurityCompliance: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            SOC 2 Type II • ISO 27001 • Zero-Trust Isolation
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Security & Enterprise Compliance Architecture
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            A comprehensive overview of the cryptographic safeguards, zero-trust tenant boundaries, access policies, and compliance controls protecting your data in CORE.
          </p>
        </div>

        {/* Pillar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-400 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">AES-256 Encryption at Rest</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All stored relational data, document attachments, and vector chunks are encrypted using industry-standard AES-256 with tenant-scoped encryption keys.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-400 flex items-center justify-center font-bold">
              <Server className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">TLS 1.3 In-Transit Defense</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All browser communications, REST API queries, and AI generation webhooks are secured via TLS 1.3 encryption with strict HTTP Strict Transport Security (HSTS).
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-400 flex items-center justify-center font-bold">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mandatory Org-Wide 2FA</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Administrators can mandate Two-Factor Authentication (TOTP via Google Authenticator, Authy, or 1Password) across all workspace accounts with non-dismissible setup modals.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Automated Session Idle Timeout</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Inactivity watchdog tracking keyboard, mouse, and scroll events; warns users with a 60-second countdown before securely terminating sessions to prevent unattended device exposure.
            </p>
          </div>
        </div>

        {/* Section 1: Tenant Isolation & Vector Engine */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">1.</span> Strict Multi-Tenant Isolation & Qdrant Collections
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Multi-tenancy in CORE enforces strict logical separation at the database and vector levels:
          </p>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p><strong>Relational Query Scoping:</strong> All database queries are filtered automatically by the authenticated user's `org_id` token claim.</p>
            <p><strong>Vector Collection Partitioning:</strong> Document embeddings indexed in Qdrant are isolated into per-organization collections (`org_UUID_knowledge`), preventing cross-tenant vector leakage or search bleed.</p>
            <p><strong>Immediate Vector Scrubber:</strong> When a document is soft-deleted or an account erasure is requested under GDPR Art. 17, `delete_document_vectors` purges all chunk vectors from Qdrant memory immediately.</p>
          </div>
        </section>

        {/* Section 2: Audit Logs & Incident Alerts */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">2.</span> Immutable Audit Logs & Event Tracing
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every critical administrative action, member invitation, passkey rotation, document upload, and login attempt is logged to an immutable `AuditLog` table containing actor IP, timestamp, target ID, and action descriptor.
          </p>
        </section>

        {/* Section 3: Responsible Disclosure */}
        <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span className="text-primary font-mono">3.</span> Vulnerability Reporting & Security Team
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We welcome vulnerability disclosures from security researchers. If you discover a potential vulnerability, please email <a href="mailto:security@coreworkspace.com" className="text-primary hover:underline">security@coreworkspace.com</a> with reproduction steps. We respond to all reports within 24 hours.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
