import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractErrorMessage } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft, Mail, Sparkles, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [debugWarning, setDebugWarning] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebugUrl(null);
    setDebugWarning(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/password-reset/request/', { email });
      setMessage(
        res.message ||
          'If an account is associated with this email, a password reset link has been dispatched to your inbox.'
      );
      if (res.debug_reset_url) {
        setDebugUrl(res.debug_reset_url);
      }
      if (res.debug_warning) {
        setDebugWarning(res.debug_warning);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <Card className="relative z-10 w-full max-w-md border-border bg-white shadow-xl dark:bg-slate-900">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {submitted ? 'Check your email' : 'Forgot password?'}
          </CardTitle>
          <CardDescription>
            {submitted
              ? 'We have sent password reset instructions to your address.'
              : 'Enter your registered email address to receive a secure password reset link.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              {debugWarning ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-center text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400 mb-2" />
                  <h4 className="font-semibold text-sm mb-1">Notice</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {debugWarning}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <h4 className="font-semibold text-base mb-1">Reset Link Dispatched</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {message}
                  </p>
                  <div className="mt-3 rounded-lg bg-white/70 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono font-medium text-foreground border border-border">
                    {email}
                  </div>
                </div>
              )}

              {debugUrl && (
                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 p-3.5 border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      ⚡ Quick Reset Link (Dev Mode)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can click below to test the reset form immediately:
                  </p>
                  <a
                    href={debugUrl}
                    className="block w-full text-center py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors"
                  >
                    Open Reset Password Form →
                  </a>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-3 text-xs text-muted-foreground space-y-1 border border-border">
                <p className="font-semibold text-foreground">Didn't receive the email?</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Check your spam or junk folder</li>
                  <li>Verify you typed the correct work email</li>
                  <li>The reset link will expire in 30 minutes</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="w-full"
                >
                  Try another email address
                </Button>
                <Link to="/login" className="w-full">
                  <Button className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Work Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="bg-white dark:bg-slate-950"
                />
              </div>

              <Button type="submit" className="w-full mt-2 font-medium" disabled={loading || !email}>
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" /> Send Reset Link
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>

        {!submitted && (
          <CardFooter className="flex flex-col space-y-3 text-center text-xs sm:text-sm text-muted-foreground">
            <p>
              Remembered your password?{' '}
              <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign In
              </Link>
            </p>
            <div className="flex items-center justify-center gap-4 text-xs pt-1 border-t border-border">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Back to Homepage
              </Link>
              <Link to="/docs" className="text-indigo-500 hover:text-indigo-400 font-medium transition-colors">
                Help & Documentation
              </Link>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
