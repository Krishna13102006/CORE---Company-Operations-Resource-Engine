import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage, getApiUrl } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, LogIn, Sparkles, KeyRound, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const Login: React.FC = () => {
  const { login, clearTwoFactorState } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slowServerNotice, setSlowServerNotice] = useState(false);

  // Proactively pre-warm both cloud backend instance and database as soon as the login page loads
  useEffect(() => {
    fetch(getApiUrl('/health/?check_db=1')).catch(() => {});
  }, []);

  const [retryingNotice, setRetryingNotice] = useState(false);

  // If server is cold-starting on free tier, notify the user so they know it's waking up
  useEffect(() => {
    let timer: any;
    if (loading && !retryingNotice) {
      timer = setTimeout(() => {
        setSlowServerNotice(true);
      }, 5000);
    } else {
      setSlowServerNotice(false);
    }
    return () => clearTimeout(timer);
  }, [loading, retryingNotice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSlowServerNotice(false);
    setRetryingNotice(false);

    const executeLogin = async (attempt: number = 1): Promise<void> => {
      try {
        const result = await login(
          email,
          password,
          twoFactorRequired ? twoFactorCode : undefined
        );

        if (result.requires2FA) {
          setTwoFactorRequired(true);
          setError(null);
        } else {
          navigate('/dashboard');
        }
      } catch (err: any) {
        const status = err?.status;
        const msg = String(err?.message || '').toLowerCase();
        const isColdBootError = 
          status === 408 || 
          status === 502 || 
          status === 503 || 
          status === 504 || 
          msg.includes('server took too long') || 
          msg.includes('waking up') ||
          msg.includes('network error');

        // Self-healing: if server was sleeping, retry up to 2 times automatically without failing
        if (isColdBootError && attempt < 3) {
          setRetryingNotice(true);
          setSlowServerNotice(false);
          // Wait 3.5s for the server container & database to finish waking up
          await new Promise((resolve) => setTimeout(resolve, 3500));
          return executeLogin(attempt + 1);
        }

        setError(extractErrorMessage(err));
      } finally {
        if (!retryingNotice) {
          setLoading(false);
        }
      }
    };

    await executeLogin(1);
    setLoading(false);
    setRetryingNotice(false);
  };

  const handleBackToPassword = () => {
    setTwoFactorRequired(false);
    setTwoFactorCode('');
    setError(null);
    clearTwoFactorState();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200 dark:border-slate-800 shadow-xs" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <Card className="relative z-10 w-full max-w-md border-border bg-white shadow-xl dark:bg-slate-900">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
            {twoFactorRequired ? <KeyRound className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {twoFactorRequired ? 'Two-Factor Verification' : 'Welcome back'}
          </CardTitle>
          <CardDescription>
            {twoFactorRequired
              ? 'Enter the 6-digit code from your authenticator app or backup code'
              : 'Enter your credentials to access your organization workspace'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive dark:bg-destructive/20">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-xs uppercase tracking-wider">Authentication Error</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {retryingNotice ? (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-700 dark:text-indigo-300 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
                <p>Server instance was asleep. Auto-waking database and retrying authentication now...</p>
              </div>
            ) : slowServerNotice ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <p>Connecting to cloud backend (waking up server instance, please wait)...</p>
              </div>
            ) : null}
            
            {!twoFactorRequired ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      required
                      disabled={loading}
                      autoComplete="current-password"
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
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="twoFactorCode" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Authentication Code / Backup Code
                  </label>
                  <Input
                    id="twoFactorCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(e) => {
                      setTwoFactorCode(e.target.value);
                      if (error) setError(null);
                    }}
                    required
                    disabled={loading}
                    autoFocus
                    className="bg-white dark:bg-slate-950 text-center tracking-widest text-lg font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBackToPassword}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to email & password
                </button>
              </div>
            )}

            <Button type="submit" className="w-full mt-2 font-medium" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{retryingNotice ? 'Waking server & retrying...' : twoFactorRequired ? 'Verifying...' : 'Signing in...'}</span>
                </div>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" /> {twoFactorRequired ? 'Verify & Continue' : 'Sign In'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 text-center text-xs sm:text-sm text-muted-foreground">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs pt-1 border-t border-border">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Back to Homepage
            </Link>
            <Link to="/docs" className="text-indigo-500 hover:text-indigo-400 font-medium transition-colors">
              Read Documentation & FAQs
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
