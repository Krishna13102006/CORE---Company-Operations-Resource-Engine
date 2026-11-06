import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, extractErrorMessage } from '../lib/api';
import { EMOJI_AND_SYMBOLS_REGEX } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, UserPlus, Sparkles, Building2, User, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'hr' | 'manager' | 'employee'>('employee');

  // Join Org Fields
  const [orgSlug, setOrgSlug] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);

  // Create Org Fields (Admin registration)
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgPasskey, setNewOrgPasskey] = useState('');
  const [newOrgHrPasskey, setNewOrgHrPasskey] = useState('');
  const [newOrgManagerPasskey, setNewOrgManagerPasskey] = useState('');
  const [newOrgEmployeePasskey, setNewOrgEmployeePasskey] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (EMOJI_AND_SYMBOLS_REGEX.test(firstName) || EMOJI_AND_SYMBOLS_REGEX.test(lastName)) {
      setError('First and Last names cannot contain emojis, icons, or decorative symbols.');
      return;
    }

    if (tab === 'create' && EMOJI_AND_SYMBOLS_REGEX.test(newOrgName)) {
      setError('Organization name cannot contain emojis, icons, or decorative symbols.');
      return;
    }

    setLoading(true);

    const payload: any = {
      email: email.trim(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: tab === 'create' ? 'admin' : role,
    };

    if (tab === 'create') {
      payload.new_org_name = newOrgName.trim();
      payload.new_org_slug = newOrgSlug.trim();
      payload.new_org_passkey = newOrgPasskey;
      payload.new_org_hr_passkey = newOrgHrPasskey;
      payload.new_org_manager_passkey = newOrgManagerPasskey;
      payload.new_org_employee_passkey = newOrgEmployeePasskey;
    } else {
      payload.org_slug = orgSlug.trim();
      payload.passkey = passkey;
    }

    try {
      await api.post('/auth/register/', payload);
      // Registration successful, send to login
      navigate('/login');
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-purple-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200 dark:border-slate-800 shadow-xs" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <Card className="relative z-10 w-full max-w-2xl border-border bg-white shadow-xl dark:bg-slate-900">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
          <CardDescription>
            Join an existing workspace or set up a new multi-tenant organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Custom Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setRole('employee');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                tab === 'join'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" /> Join Organization
            </button>
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                tab === 'create'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" /> Create New Organization
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p className="line-clamp-2">{error}</p>
              </div>
            )}

            {/* Profile Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Name</label>
                <Input
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name</label>
                <Input
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <Input
                  type="email"
                  placeholder="john.doe@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
            </div>

            <div className="border-t border-border my-4 pt-4" />

            {/* Role Specific / Tab Fields */}
            {tab === 'join' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
                    <select
                      value={role}
                      onChange={(e: any) => setRole(e.target.value)}
                      className="w-full flex h-10 rounded-md border border-input bg-white/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/50"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                      <option value="admin">Admin (Join Existing)</option>
                    </select>
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Org Slug</label>
                    <Input
                      placeholder="acme"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Join Passkey</label>
                    <div className="relative">
                      <Input
                        type={showPasskey ? "text" : "password"}
                        placeholder="Organization Passkey"
                        value={passkey}
                        onChange={(e) => setPasskey(e.target.value)}
                        required
                        className="bg-white/50 dark:bg-slate-900/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasskey(!showPasskey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-hidden"
                        aria-label={showPasskey ? "Hide passkey" : "Show passkey"}
                      >
                        {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Org Name</label>
                    <Input
                      placeholder="Acme Corp"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Org Slug</label>
                    <Input
                      placeholder="acme"
                      value={newOrgSlug}
                      onChange={(e) => setNewOrgSlug(e.target.value)}
                      required
                      className="bg-white/50 dark:bg-slate-900/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-border">
                  <div className="space-y-2 col-span-2">
                    <span className="text-sm font-bold text-foreground">Set Passkeys for Roles</span>
                    <p className="text-xs text-muted-foreground">
                      Users joining your organization must input these passwords depending on their selected role.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Passkey</label>
                    <Input
                      type="password"
                      placeholder="Passkey for Admin joins"
                      value={newOrgPasskey}
                      onChange={(e) => setNewOrgPasskey(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">HR Passkey</label>
                    <Input
                      type="password"
                      placeholder="Passkey for HR joins"
                      value={newOrgHrPasskey}
                      onChange={(e) => setNewOrgHrPasskey(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manager Passkey</label>
                    <Input
                      type="password"
                      placeholder="Passkey for Manager joins"
                      value={newOrgManagerPasskey}
                      onChange={(e) => setNewOrgManagerPasskey(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee Passkey</label>
                    <Input
                      type="password"
                      placeholder="Passkey for Employee joins"
                      value={newOrgEmployeePasskey}
                      onChange={(e) => setNewOrgEmployeePasskey(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full mt-4 font-semibold" disabled={loading}>
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Create Workspace
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 text-center text-xs sm:text-sm text-muted-foreground">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              Sign In
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
