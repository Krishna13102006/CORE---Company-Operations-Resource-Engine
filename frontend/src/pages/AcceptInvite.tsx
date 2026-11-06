import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, extractErrorMessage } from '../lib/api';
import { EMOJI_AND_SYMBOLS_REGEX } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  ShieldAlert,
  Sparkles,
  UserCheck,
  Building2,
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface InviteInfo {
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_display: string;
  org_name: string;
  org_slug: string;
  department_id?: string | null;
  department_name?: string | null;
  inviter_name: string;
  expires_at: string;
}

export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { checkSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided. Please check your invitation email link.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<InviteInfo>(`/tenants/invitations/verify/?token=${encodeURIComponent(token)}`);
        setInviteInfo(data);
        if (data.first_name) setFirstName(data.first_name);
        if (data.last_name) setLastName(data.last_name);
      } catch (err: any) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (EMOJI_AND_SYMBOLS_REGEX.test(firstName) || EMOJI_AND_SYMBOLS_REGEX.test(lastName)) {
      setSubmitError('First and Last names cannot contain emojis, icons, or decorative symbols.');
      return;
    }

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const response = await api.post<{ status: string; access: string; refresh: string; user: any }>(
        '/tenants/invitations/accept/',
        {
          token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
        }
      );

      if (response.access) {
        localStorage.setItem('access_token', response.access);
      }
      await checkSession();
      setAcceptedSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setSubmitError(extractErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <Card className="relative z-10 w-full max-w-lg border-border bg-white shadow-xl dark:bg-slate-900">
        {loading ? (
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Verifying invitation token...</p>
          </CardContent>
        ) : error ? (
          <>
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Invalid Invitation</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col space-y-3">
              <Button asChild className="w-full">
                <Link to="/login">Go to Sign In</Link>
              </Button>
              <Link to="/" className="text-xs text-center text-muted-foreground hover:text-foreground">
                Back to Homepage
              </Link>
            </CardFooter>
          </>
        ) : acceptedSuccess ? (
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Welcome Aboard!</h2>
              <p className="text-sm text-muted-foreground">
                Your account is activated. Redirecting you to your workspace...
              </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-primary mt-2" />
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-2 text-center pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Join Your Workspace</CardTitle>
              <CardDescription>
                <strong>{inviteInfo?.inviter_name}</strong> invited you to join{' '}
                <strong className="text-foreground">{inviteInfo?.org_name}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Organization and Role Badges */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-slate-50/80 p-3.5 text-xs dark:bg-slate-950/50">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="truncate">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Workspace</span>
                    <span className="font-medium text-foreground truncate block">{inviteInfo?.org_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="truncate">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Assigned Role</span>
                    <span className="font-medium text-foreground capitalize block">{inviteInfo?.role_display}</span>
                  </div>
                </div>
                {inviteInfo?.department_name && (
                  <div className="col-span-2 flex items-center gap-2 pt-2 border-t border-border/60">
                    <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Department</span>
                      <span className="font-medium text-foreground">{inviteInfo.department_name}</span>
                    </div>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive dark:bg-destructive/20">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wider">Error</p>
                    <p className="text-xs">{submitError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Pre-filled Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={inviteInfo?.email || ''}
                      disabled
                      className="pl-9 bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-not-allowed font-medium"
                    />
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      First Name
                    </label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={submitting}
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="lastName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Last Name
                    </label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={submitting}
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={submitting}
                      className="pl-9 pr-10 bg-white dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Password must contain at least 8 characters.
                  </p>
                </div>

                <Button type="submit" className="w-full mt-2 font-medium" disabled={submitting}>
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Setting up your account...</span>
                    </div>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" /> Accept & Join {inviteInfo?.org_name}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-2 text-center text-xs text-muted-foreground border-t border-border pt-4">
              <p>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};
