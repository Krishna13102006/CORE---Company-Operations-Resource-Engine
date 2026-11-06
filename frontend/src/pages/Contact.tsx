import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Mail,
  Shield,
  MessageSquare,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  Globe,
  MapPin,
  Headphones,
  Scale,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { PublicNavbar } from '../components/PublicNavbar';
import { PublicFooter } from '../components/PublicFooter';

export const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [category, setCategory] = useState<'sales' | 'security' | 'support' | 'grievance'>('sales');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate instantaneous enterprise ticket dispatch
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      <PublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
            <Headphones className="w-3.5 h-3.5" />
            Global Enterprise Support & Governance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Contact CORE Workspace
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Have questions about enterprise deployment, SOC 2 compliance reports, privacy rights, or custom integrations? Our specialized engineering & compliance teams are ready to assist.
          </p>
        </div>

        {/* Contact Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Interactive Form */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            {submitted ? (
              <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Message Dispatched Successfully
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    Thank you for reaching out, <span className="font-semibold text-slate-800 dark:text-slate-200">{name}</span>. A designated specialist from our {category === 'sales' ? 'Enterprise Sales' : category === 'security' ? 'Security & DPO' : category === 'grievance' ? 'Grievance Redressal' : 'Technical Support'} desk has received your request and will respond to <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span> within 24 business hours.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setMessage('');
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold mt-4"
                >
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Submit a Direct Request
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your inquiry category to route your message directly to the appropriate team.
                  </p>
                </div>

                {/* Inquiry Category Pills */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Inquiry Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'sales', label: 'Enterprise Sales', icon: Building2 },
                      { id: 'security', label: 'Security & DPO', icon: Shield },
                      { id: 'support', label: 'Tech Support', icon: Headphones },
                      { id: 'grievance', label: 'Grievance / DPDP', icon: Scale },
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id as any)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300 shadow-2xs'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-primary dark:text-purple-400' : 'text-slate-400'}`} />
                          <span className="text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Your Full Name</label>
                    <Input
                      required
                      placeholder="e.g. Saumya Kesur"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Work Email Address</label>
                    <Input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Organization / Company Name</label>
                  <Input
                    placeholder="e.g. Acme Corp Inc."
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Message / Details</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details regarding your requirements, compliance inquiries, or technical questions..."
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !email.trim() || !message.trim()}
                  className="w-full sm:w-auto font-semibold bg-primary hover:bg-primary/90 text-white flex items-center gap-2 shadow-md shadow-primary/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Routing Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Inquiry
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Right Column: Direct Channels & Compliance Office */}
          <div className="space-y-4">
            {/* Direct Channel 1: Security & DPO */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-purple-400">
                <Shield className="w-4 h-4" />
                Security & Data Protection Office
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                For GDPR Art. 15-22 requests, SOC 2 audits, DPIA reviews, and vulnerability reporting.
              </p>
              <div className="pt-1 text-xs space-y-1">
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Security Team:</span> <a href="mailto:security@coreworkspace.com" className="text-primary hover:underline">security@coreworkspace.com</a></p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Privacy & DPO:</span> <a href="mailto:privacy@coreworkspace.com" className="text-primary hover:underline">privacy@coreworkspace.com</a></p>
              </div>
            </div>

            {/* Direct Channel 2: Enterprise Sales */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-purple-400">
                <Building2 className="w-4 h-4" />
                Enterprise Sales & Pilots
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Custom on-premise deployments, multi-region database replication, and custom SLAs.
              </p>
              <div className="pt-1 text-xs">
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Sales Desk:</span> <a href="mailto:sales@coreworkspace.com" className="text-primary hover:underline">sales@coreworkspace.com</a></p>
              </div>
            </div>

            {/* Direct Channel 3: Grievance Officer */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-purple-400">
                <Scale className="w-4 h-4" />
                Grievance Redressal (India DPDP)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Statutory Grievance Redressal Mechanism under Section 8 of the Indian DPDP Act 2023.
              </p>
              <div className="pt-1 text-xs">
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Grievance Officer:</span> <a href="mailto:grievance@coreworkspace.com" className="text-primary hover:underline">grievance@coreworkspace.com</a></p>
              </div>
            </div>

            {/* SLA Badge */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
              <Clock className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Standard Enterprise Response SLA: <strong>&lt; 24 business hours</strong></span>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};
