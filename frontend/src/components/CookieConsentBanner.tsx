import React, { useState, useEffect } from 'react';
import { Shield, Cookie, Check, X, Settings2, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Link } from 'react-router-dom';

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_STORAGE_KEY = 'core_cookie_consent_v1';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [functionalCookies, setFunctionalCookies] = useState(true);
  const [analyticsCookies, setAnalyticsCookies] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!saved) {
      // Small delay for smooth entry animation
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    } else {
      try {
        const parsed: CookiePreferences = JSON.parse(saved);
        setFunctionalCookies(Boolean(parsed.functional));
        setAnalyticsCookies(Boolean(parsed.analytics));
      } catch (e) {
        setIsVisible(true);
      }
    }
  }, []);

  useEffect(() => {
    const handleOpenPreferences = () => {
      setIsCustomizeOpen(true);
      setIsVisible(true);
    };

    window.addEventListener('open-cookie-preferences', handleOpenPreferences);
    return () => window.removeEventListener('open-cookie-preferences', handleOpenPreferences);
  }, []);

  const saveConsent = (functional: boolean, analytics: boolean) => {
    const payload: CookiePreferences = {
      necessary: true,
      functional,
      analytics,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    setFunctionalCookies(functional);
    setAnalyticsCookies(analytics);
    setIsVisible(false);
    setIsCustomizeOpen(false);
  };

  const handleAcceptAll = () => saveConsent(true, true);
  const handleRejectNonEssential = () => saveConsent(false, false);
  const handleSaveCustom = () => saveConsent(functionalCookies, analyticsCookies);

  if (!isVisible) return null;

  return (
    <aside aria-label="Cookie consent banner" className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 md:p-6 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 pointer-events-auto transition-all animate-in slide-in-from-bottom-6 duration-300">
        {!isCustomizeOpen ? (
          /* Collapsed Quick Banner */
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Cookie & Privacy Preferences
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    GDPR • DPDP • CCPA
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  We use essential cookies to maintain secure sessions and prevent CSRF attacks. With your consent, we also store functional preferences to personalize your workspace. Read our{' '}
                  <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 font-semibold underline hover:text-indigo-700">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/security" className="text-indigo-600 dark:text-indigo-400 font-semibold underline hover:text-indigo-700">
                    Security Architecture
                  </Link>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomizeOpen(true)}
                className="text-xs font-semibold flex items-center gap-1.5 h-9"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Customize
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectNonEssential}
                className="text-xs font-semibold h-9"
              >
                Reject Non-Essential
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-9"
              >
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          /* Detailed Customization Panel */
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Granular Cookie Consent Controls
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure your data and tracking preferences. Essential security cookies cannot be disabled.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomizeOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Category 1: Strictly Necessary */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Strictly Necessary
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    Always Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Required for JWT authentication cookies, CSRF defense, 2FA validation, and multi-tenant organization boundary isolation.
                </p>
              </div>

              {/* Category 2: Functional */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Functional Preferences
                  </span>
                  <button
                    type="button"
                    onClick={() => setFunctionalCookies(!functionalCookies)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      functionalCookies ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        functionalCookies ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Remembers your dark/light theme mode, collapsed sidebar status, notification filters, and table sorting layouts.
                </p>
              </div>

              {/* Category 3: Analytics */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Telemetry & Latency
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalyticsCookies(!analyticsCookies)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      analyticsCookies ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        analyticsCookies ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Aggregated, anonymized performance telemetry for API response benchmarks and AI generation latency monitoring.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <Link
                to="/privacy"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                Learn more in our Privacy Policy
                <ExternalLink className="w-3 h-3" />
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomizeOpen(false)}
                  className="text-xs font-semibold h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCustom}
                  className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                >
                  Save My Preferences
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
