import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group inline-flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 text-white shrink-0 shadow-md shadow-purple-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">CORE</span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              The unified open-source enterprise operating system. Grounded document AI, finance intelligence, recruitment ATS, project Gantt, and organizational governance in one blazing-fast workspace.
            </p>
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational &middot; Multi-Tenant Isolated
              </div>
            </div>
          </div>

          {/* Workspace Modules */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">Workspace Hubs</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <a href="/#features" className="hover:text-primary dark:hover:text-purple-400 transition-colors">AI Knowledge & RAG</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Finance & Spreadsheet AI</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Hiring ATS Pipeline</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Projects & Gantt</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Departments & Leave Feed</a>
              </li>
            </ul>
          </div>

          {/* Compliance & Legal */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">Compliance & Trust</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link to="/privacy" className="hover:text-primary dark:hover:text-purple-400 transition-colors font-medium">Privacy Policy (GDPR / DPDP)</Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-primary dark:hover:text-purple-400 transition-colors font-medium">Terms of Service (MSA)</Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-primary dark:hover:text-purple-400 transition-colors font-medium">Security & SOC 2 Controls</Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-cookie-preferences'))}
                  className="hover:text-primary dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>

          {/* Resources & Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">Resources</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link to="/docs" className="hover:text-primary dark:hover:text-purple-400 transition-colors font-medium">Documentation & Handbook</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Member Sign In</Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Create Free Organization</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} CORE Workspace Inc. Built for modern high-velocity organizations.
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link to="/privacy" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Terms of Service</Link>
            <Link to="/security" className="hover:text-primary dark:hover:text-purple-400 transition-colors">Security Architecture</Link>
            <ThemeToggle showLabel className="border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs" />
          </div>
        </div>
      </div>
    </footer>
  );
};
