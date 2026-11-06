import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, extractErrorMessage } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, KeyRound, Sparkles, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!uid || !token) {
      setError('Invalid or missing password reset link parameters.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm/', {
        uid,
        token,
        new_password: password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isLinkInvalid = !uid || !token;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <Card className="relative z-10 w-full max-w-md border-border bg-white shadow-xl dark:bg-slate-900">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {success ? 'Password Reset Complete' : 'Reset your password'}
          </CardTitle>
          <CardDescription>
            {success
              ? 'Your password has been securely updated. You can now sign in.'
              : isLinkInvalid
              ? 'This password reset link is invalid or incomplete.'
              : 'Create a new secure password for your organization account.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                <h4 className="font-semibold text-base mb-1">Password Changed Successfully</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All active sessions have been invalidated and your credentials are up to date.
                </p>
              </div>

              <Button
                onClick={() => navigate('/login')}
                className="w-full mt-2 font-medium"
              >
                Continue to Sign In <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : isLinkInvalid ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20 text-left">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p>The reset link is missing required authorization parameters.</p>
              </div>
              <Link to="/forgot-password" className="w-full block">
                <Button className="w-full">
                  Request New Reset Link
                </Button>
              </Link>
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
                  htmlFor="password"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={8}
                    className="bg-white dark:bg-slate-950 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-hidden"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="bg-white dark:bg-slate-950 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-hidden"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2 font-medium"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 text-center text-xs sm:text-sm text-muted-foreground">
          <p>
            Remember your credentials?{' '}
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
      </Card>
    </div>
  );
};
