import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { api, extractErrorMessage } from '../lib/api';
import { EMOJI_AND_SYMBOLS_REGEX } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  FolderGit2,
  LogOut,
  Sparkles,
  User as UserIcon,
  Database,
  Menu,
  X,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Bell,
  Mail,
  BookOpen,
  Home,
  Video,
  Palmtree,
  CreditCard,
  ShieldCheck,
  Zap,
  CheckCheck,
  Trash2,
  UserPlus,
  MessageSquare,
  ArrowRight,
  Clock,
  QrCode,
  Key,
  Copy,
  Download,
  Check,
  Lock,
  Shield,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const formatTimeAgo = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
};

const getNotificationMetadata = (type: string) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return {
        icon: FolderGit2,
        iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
        badge: 'Task Assigned',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
      };
    case 'TASK_COMPLETED':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
        badge: 'Task Done',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      };
    case 'TASK_OVERDUE':
      return {
        icon: AlertCircle,
        iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
        badge: 'Overdue',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
      };
    case 'LEAVE_REQUESTED':
      return {
        icon: Palmtree,
        iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
        badge: 'Leave Request',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      };
    case 'LEAVE_APPROVED':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
        badge: 'Leave Approved',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      };
    case 'LEAVE_REJECTED':
      return {
        icon: AlertCircle,
        iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
        badge: 'Leave Rejected',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
      };
    case 'INVITATION_ACCEPTED':
      return {
        icon: UserPlus,
        iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
        badge: 'Member Joined',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
      };
    case 'MENTION':
      return {
        icon: MessageSquare,
        iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
        badge: 'Comment',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
      };
    default:
      return {
        icon: Sparkles,
        iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        badge: 'System',
        badgeBg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      };
  }
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, checkSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Fetch Notifications with real-time 5s polling & window focus refetch
  const { data: notifications } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/auth/notifications/'),
    enabled: !!user,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/auth/notifications/'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Clear all notifications mutation
  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/auth/notifications/'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark single as read mutation
  const markSingleReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/auth/notifications/${id}/read/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Dismiss single notification mutation
  const dismissSingleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/notifications/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const filteredNotifications = (notifications || []).filter(
    (n) => notifFilter === 'all' || !n.is_read
  );

  // Profile Form States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | '2fa' | 'privacy'>('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data Portability & Erasure States (GDPR / DPDP / CCPA)
  const [isExportingData, setIsExportingData] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isErasureModalOpen, setIsErasureModalOpen] = useState(false);
  const [erasurePassword, setErasurePassword] = useState('');
  const [erasure2FACode, setErasure2FACode] = useState('');
  const [erasureConfirmed, setErasureConfirmed] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [erasureError, setErasureError] = useState<string | null>(null);

  // 2FA Workflow States
  const [twoFactorStep, setTwoFactorStep] = useState<'overview' | 'setup' | 'backup_codes' | 'disable'>('overview');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorQrUri, setTwoFactorQrUri] = useState('');
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Mandatory 2FA Enforcement State
  const requiresMandatory2FA = Boolean(user?.org_enforce_2fa && !user?.is_2fa_enabled);

  // Session Inactivity Idle Timer (SOC 2 / ISO 27001 Compliance)
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const lastActivityRef = React.useRef(Date.now());

  const handleStaySignedIn = () => {
    lastActivityRef.current = Date.now();
    setShowIdleWarning(false);
  };

  useEffect(() => {
    const timeoutMinutes = user?.session_idle_timeout_minutes ?? 30;
    if (!user || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = Math.max(0, timeoutMs - 60000); // 60 seconds before expiration

    const handleActivity = () => {
      if (!showIdleWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        clearInterval(interval);
        logout();
        navigate('/login');
      } else if (elapsed >= warningMs) {
        setShowIdleWarning(true);
        const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
        setIdleCountdown(remaining);
      } else {
        if (showIdleWarning) {
          setShowIdleWarning(false);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [user, showIdleWarning, logout, navigate]);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setEmail(user.email);
      setPassword('');
      setSuccessMessage(null);
      setErrorMessage(null);
      setTwoFactorStep('overview');
      setTwoFactorError(null);
      setTwoFactorSuccess(null);
      setTwoFactorVerifyCode('');
      setTwoFactorDisablePassword('');
    }
  }, [user, isProfileOpen]);

  const handleStart2FASetup = async () => {
    try {
      setTwoFactorLoading(true);
      setTwoFactorError(null);
      const data = await api.post<{ status: string; secret: string; otpauth_url: string; qr_code_data_uri: string }>('/auth/2fa/setup/');
      setTwoFactorSecret(data.secret);
      setTwoFactorQrUri(data.qr_code_data_uri);
      setTwoFactorVerifyCode('');
      setTwoFactorStep('setup');
    } catch (err: any) {
      setTwoFactorError(extractErrorMessage(err) || 'Failed to initiate 2FA setup.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyAndEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorVerifyCode || twoFactorVerifyCode.length !== 6) {
      setTwoFactorError('Please enter the 6-digit verification code from your authenticator app.');
      return;
    }

    try {
      setTwoFactorLoading(true);
      setTwoFactorError(null);
      const data = await api.post<{ status: string; backup_codes: string[]; message: string }>(
        '/auth/2fa/enable/',
        {
          secret: twoFactorSecret,
          token: twoFactorVerifyCode.trim(),
        }
      );
      setTwoFactorBackupCodes(data.backup_codes || []);
      setTwoFactorStep('backup_codes');
      setTwoFactorSuccess('Two-factor authentication successfully enabled!');
      await checkSession();
    } catch (err: any) {
      setTwoFactorError(extractErrorMessage(err) || 'Invalid verification code. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorDisablePassword && !twoFactorVerifyCode) {
      setTwoFactorError('Please enter your account password or a 6-digit authenticator code to confirm.');
      return;
    }

    try {
      setTwoFactorLoading(true);
      setTwoFactorError(null);
      await api.post('/auth/2fa/disable/', {
        password: twoFactorDisablePassword || undefined,
        token: twoFactorVerifyCode || undefined,
      });
      await checkSession();
      setTwoFactorStep('overview');
      setTwoFactorSuccess('Two-factor authentication has been disabled.');
      setTwoFactorDisablePassword('');
      setTwoFactorVerifyCode('');
    } catch (err: any) {
      setTwoFactorError(extractErrorMessage(err) || 'Failed to disable 2FA. Please verify your password or code.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(twoFactorSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(twoFactorBackupCodes.join('\n'));
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const content = `CORE Workspace - Two-Factor Authentication Backup Codes\nAccount: ${user?.email}\nGenerated: ${new Date().toLocaleString()}\n\nTreat these codes like your password. Each code can be used once:\n\n${twoFactorBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core_2fa_backup_codes_${user?.email?.split('@')[0] || 'account'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (EMOJI_AND_SYMBOLS_REGEX.test(firstName) || EMOJI_AND_SYMBOLS_REGEX.test(lastName)) {
      setErrorMessage('Names cannot contain emojis, icons, or decorative symbols.');
      return;
    }

    try {
      setIsUpdating(true);
      await api.patch('/auth/me/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: password || undefined,
      });
      await checkSession();
      setSuccessMessage('Profile details updated successfully!');
      setPassword('');
      
      setTimeout(() => {
        setIsProfileOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to update profile details.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExportingData(true);
      setExportSuccess(null);
      setErrorMessage(null);
      const res = await api.get('/auth/export-data/');
      const blob = new Blob([JSON.stringify(res, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `core_personal_data_export_${user?.email?.replace(/[@.]/g, '_') || 'user'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess('Personal data archive (.json) generated and downloaded successfully!');
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || 'Failed to export personal data archive.');
    } finally {
      setIsExportingData(false);
    }
  };

  const handleExecuteErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!erasureConfirmed) {
      setErasureError('Please check the authorization box to proceed with data erasure.');
      return;
    }
    if (!erasurePassword) {
      setErasureError('Password verification is required.');
      return;
    }

    try {
      setIsErasing(true);
      setErasureError(null);
      await api.post('/auth/delete-account/', {
        password: erasurePassword,
        two_factor_code: erasure2FACode || undefined,
      });
      setIsErasureModalOpen(false);
      setIsProfileOpen(false);
      await logout();
      navigate('/login');
    } catch (err: any) {
      setErasureError(extractErrorMessage(err) || 'Failed to execute account erasure.');
    } finally {
      setIsErasing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Knowledge Base',
      path: '/documents',
      icon: FileText,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Projects',
      path: '/projects',
      icon: FolderGit2,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Department Members',
      path: '/departments',
      icon: Users,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Finance & Intelligence',
      path: '/finance',
      icon: CreditCard,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Mail Center',
      path: '/mail',
      icon: Mail,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Meetings',
      path: '/meetings',
      icon: Video,
      roles: ['admin', 'hr', 'manager', 'employee'],
    },
    {
      name: 'Hiring Pipeline',
      path: '/hiring',
      icon: Briefcase,
      roles: ['admin', 'hr'],
    },
    {
      name: 'Automations & Hub',
      path: '/automations',
      icon: Zap,
      roles: ['admin'],
    },
    {
      name: 'Org Governance',
      path: '/governance',
      icon: ShieldCheck,
      roles: ['admin'],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Collapsible & Mobile Slide-Out Drawer) */}
      <aside
        className={`border-r border-border bg-white dark:bg-slate-900 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out z-50 overflow-hidden ${
          // Mobile state
          isMobileDrawerOpen
            ? 'fixed inset-y-0 left-0 w-72 shadow-2xl flex translate-x-0'
            : 'fixed inset-y-0 left-0 w-72 -translate-x-full lg:translate-x-0 lg:static'
        } ${
          // Desktop collapsed state
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        {/* Brand */}
        <div className="h-16 border-b border-border flex items-center px-[18px] justify-between transition-all duration-300 shrink-0 overflow-hidden">
          <Link to="/" className="flex items-center min-w-0">
            <div className="w-11 h-11 min-w-[44px] shrink-0 flex items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isCollapsed && !isMobileDrawerOpen
                  ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                  : 'max-w-[200px] opacity-100 translate-x-0 ml-3'
              }`}
            >
              <span className="font-bold text-base leading-none block text-foreground truncate">CORE</span>
              {user?.org_name && (
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider truncate block mt-1">
                  {user.org_name}
                </span>
              )}
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-5 space-y-1.5 overflow-y-auto px-[18px] transition-all duration-300 overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed && !isMobileDrawerOpen ? item.name : undefined}
                className={`flex items-center rounded-xl text-sm font-semibold transition-colors duration-200 h-11 w-full overflow-hidden shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {/* 1:1 Icon container perfectly centered and anchored */}
                <div className="w-11 h-11 min-w-[44px] shrink-0 flex items-center justify-center">
                  <Icon className="h-5 w-5 shrink-0" />
                </div>
                {/* Smooth sliding & fading label */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                    isCollapsed && !isMobileDrawerOpen
                      ? 'max-w-0 opacity-0 -translate-x-2'
                      : 'max-w-[200px] opacity-100 translate-x-0 pr-2'
                  }`}
                >
                  <span className="truncate block">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="border-t border-border bg-slate-50 dark:bg-slate-900 p-[18px] transition-all duration-300 shrink-0 overflow-hidden space-y-3">
          {/* Avatar & Info Row */}
          <div
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsProfileOpen(true)}
            title="My Account"
          >
            <div className="w-11 h-11 min-w-[44px] shrink-0 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm border border-border">
              <UserIcon className="h-5 w-5" />
            </div>
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isCollapsed && !isMobileDrawerOpen
                  ? 'max-w-0 opacity-0 -translate-x-2'
                  : 'max-w-[200px] opacity-100 translate-x-0 ml-3'
              }`}
            >
              <span className="font-bold text-sm block truncate text-foreground leading-none mb-1">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                {user?.role}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive flex items-center justify-start gap-0 font-semibold overflow-hidden p-0 transition-colors duration-200 shrink-0"
            title="Sign Out"
          >
            <div className="w-11 h-11 min-w-[44px] shrink-0 flex items-center justify-center">
              <LogOut className="h-5 w-5 shrink-0" />
            </div>
            <div
              className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
                isCollapsed && !isMobileDrawerOpen
                  ? 'max-w-0 opacity-0'
                  : 'max-w-[140px] opacity-100 pr-3'
              }`}
            >
              Sign Out
            </div>
          </Button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-white dark:bg-slate-900 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            {/* Desktop Collapse Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex h-9 w-9 text-slate-500 hover:text-foreground"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Mobile Drawer Trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden h-9 w-9 text-slate-500 hover:text-foreground"
              title="Open Navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative">
            {/* Quick Docs Link in Header */}
            <Link to="/docs">
              <Button variant="ghost" size="sm" className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                Docs & FAQs
              </Button>
            </Link>

            {/* Global Theme Toggle */}
            <ThemeToggle />

            <div className="text-xs font-medium text-muted-foreground hidden xl:block">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className={`h-9 w-9 relative transition-colors ${
                  showNotifications ? 'bg-accent text-foreground' : 'text-slate-500 hover:text-foreground'
                }`}
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] flex flex-col rounded-2xl border border-border bg-white dark:bg-slate-900 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                    {/* Popover Header */}
                    <div className="p-3.5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={() => markAllReadMutation.mutate()}
                              disabled={markAllReadMutation.isPending}
                              title="Mark all as read"
                              className="text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors flex items-center gap-1"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              <span>Mark all read</span>
                            </button>
                          )}
                          {notifications && notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() => clearAllMutation.mutate()}
                              disabled={clearAllMutation.isPending}
                              title="Clear all notifications"
                              className="text-[11px] font-medium text-slate-400 hover:text-destructive px-1.5 py-1 rounded-md hover:bg-destructive/5 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setNotifFilter('all')}
                          className={`flex-1 py-1 px-2 rounded-md transition-all text-center ${
                            notifFilter === 'all'
                              ? 'bg-white dark:bg-slate-900 text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          All ({notifications?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifFilter('unread')}
                          className={`flex-1 py-1 px-2 rounded-md transition-all text-center ${
                            notifFilter === 'unread'
                              ? 'bg-white dark:bg-slate-900 text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Unread ({unreadCount})
                        </button>
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-border/60">
                      {notifications === undefined ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Loading notifications...
                        </div>
                      ) : filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n) => {
                          const meta = getNotificationMetadata(n.type);
                          const Icon = meta.icon;
                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (!n.is_read) {
                                  markSingleReadMutation.mutate(n.id);
                                }
                                setShowNotifications(false);
                                if (n.target_url) {
                                  navigate(n.target_url);
                                }
                              }}
                              className={`group relative p-3 text-xs transition-colors flex items-start gap-3 cursor-pointer ${
                                n.is_read
                                  ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                  : 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30'
                              }`}
                            >
                              {/* Icon */}
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}>
                                <Icon className="h-4 w-4" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pr-6">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${meta.badgeBg}`}>
                                    {meta.badge}
                                  </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {n.title}
                                  </span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                                  {n.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                  {n.actor_name && (
                                    <span className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                      By {n.actor_name}
                                    </span>
                                  )}
                                  <span>&bull;</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeAgo(n.created_at)}
                                  </span>
                                  {n.target_url && (
                                    <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:underline">
                                      View <ArrowRight className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Actions / Unread Dot */}
                              <div className="absolute right-2.5 top-3 flex flex-col items-center gap-2">
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-primary" />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissSingleMutation.mutate(n.id);
                                  }}
                                  title="Dismiss"
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-opacity"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Bell className="h-5 w-5 opacity-40" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {notifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                          </p>
                          <p className="text-[11px] text-muted-foreground max-w-[200px]">
                            {notifFilter === 'unread'
                              ? 'You have caught up with all updates!'
                              : 'When you are assigned tasks or receive team updates, they will appear here.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Responsive Panel View Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          {children}
        </div>
      </main>

      {/* Account & Security Settings Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary" />
                  Account & Security Settings
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your personal identity, credentials, and two-factor authentication.
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('profile');
                  setSuccessMessage(null);
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  settingsTab === 'profile'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <UserIcon className="h-3.5 w-3.5" />
                Profile & Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('2fa');
                  setTwoFactorError(null);
                  setTwoFactorSuccess(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  settingsTab === '2fa'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Two-Factor Auth (2FA)
                {user?.is_2fa_enabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('privacy');
                  setExportSuccess(null);
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  settingsTab === 'privacy'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Privacy & Data Rights
              </button>
            </div>
          </DialogHeader>

          {/* TAB 1: PROFILE & CREDENTIALS */}
          {settingsTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4 p-5 max-h-[75vh] overflow-y-auto">
              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  {errorMessage}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">First Name</label>
                  <Input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Last Name</label>
                  <Input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Email Address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">New Password</label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground font-semibold">User Role</label>
                <div className="p-2.5 border border-border bg-slate-50 dark:bg-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span>{user?.role}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground lowercase">managed by organization admin</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Button type="submit" className="w-full font-semibold" disabled={isUpdating}>
                  {isUpdating ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: TWO-FACTOR AUTHENTICATION (2FA) */}
          {settingsTab === '2fa' && (
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {twoFactorSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  {twoFactorSuccess}
                </div>
              )}
              {twoFactorError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-300">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  {twoFactorError}
                </div>
              )}

              {/* OVERVIEW / CURRENT STATUS */}
              {twoFactorStep === 'overview' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                    user?.is_2fa_enabled
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                      : 'bg-slate-50 dark:bg-slate-950 border-border'
                  }`}>
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      user?.is_2fa_enabled
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">
                          {user?.is_2fa_enabled ? 'Two-Factor Authentication is Enabled' : 'Two-Factor Authentication is Disabled'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user?.is_2fa_enabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {user?.is_2fa_enabled ? 'Protected' : 'Off'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {user?.is_2fa_enabled
                          ? 'Your account requires a 6-digit verification code from your authenticator app (Google Authenticator, Authy, Apple Passwords) each time you log in.'
                          : 'Add an extra layer of security to prevent unauthorized access. When enabled, you will need a verification code in addition to your password.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {user?.is_2fa_enabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTwoFactorStep('disable');
                          setTwoFactorError(null);
                        }}
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive font-semibold"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Disable Two-Factor Authentication
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleStart2FASetup}
                        disabled={twoFactorLoading}
                        className="w-full font-semibold"
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        {twoFactorLoading ? 'Preparing Setup...' : 'Enable Two-Factor Authentication (2FA)'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 1: SCAN QR CODE & ENTER 6-DIGIT CODE */}
              {twoFactorStep === 'setup' && (
                <form onSubmit={handleVerifyAndEnable2FA} className="space-y-4">
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
                    <QrCode className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <p className="font-bold">Step 1: Scan QR Code</p>
                      <p className="mt-0.5 text-indigo-700 dark:text-indigo-400">
                        Open Google Authenticator, Authy, or Apple Passwords on your phone and scan the code below.
                      </p>
                    </div>
                  </div>

                  {/* QR Code Graphic & Secret */}
                  <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-xl border border-border shadow-xs space-y-3">
                    {twoFactorQrUri ? (
                      <img
                        src={twoFactorQrUri}
                        alt="2FA QR Code"
                        className="w-48 h-48 rounded-lg border border-border bg-white p-1"
                      />
                    ) : (
                      <div className="w-48 h-48 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                        Loading QR code...
                      </div>
                    )}

                    <div className="w-full text-center space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                        Can't scan QR code? Use this manual key:
                      </span>
                      <div className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-border">
                        <span className="font-mono text-xs font-bold text-primary select-all">
                          {twoFactorSecret}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="p-1 text-slate-400 hover:text-foreground rounded transition-colors"
                          title="Copy Key"
                        >
                          {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Verification Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Step 2: Enter 6-Digit Authenticator Code
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={twoFactorVerifyCode}
                      onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center font-mono text-lg tracking-widest font-bold"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTwoFactorStep('overview');
                        setTwoFactorError(null);
                      }}
                      className="flex-1 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={twoFactorLoading || twoFactorVerifyCode.length !== 6}
                      className="flex-1 text-xs font-semibold"
                    >
                      {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 3: BACKUP CODES MODAL */}
              {twoFactorStep === 'backup_codes' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                    <Key className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-bold">Save Your Emergency Backup Codes</p>
                      <p className="mt-0.5 text-amber-800 dark:text-amber-400 leading-relaxed">
                        If you lose access to your phone or authenticator app, these single-use codes are the <strong>only way</strong> to access your account.
                      </p>
                    </div>
                  </div>

                  {/* Codes Grid */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border grid grid-cols-2 gap-2 font-mono text-xs font-bold text-center">
                    {twoFactorBackupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-900 border border-border/80 p-2 rounded-lg text-foreground select-all"
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyBackupCodes}
                      className="flex-1 text-xs font-semibold flex items-center gap-1.5"
                    >
                      {copiedBackupCodes ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedBackupCodes ? 'Copied to Clipboard' : 'Copy All Codes'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadBackupCodes}
                      className="flex-1 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download (.txt)
                    </Button>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      setTwoFactorStep('overview');
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-xs font-semibold mt-2"
                  >
                    I Have Saved My Backup Codes
                  </Button>
                </div>
              )}

              {/* DISABLE 2FA CONFIRMATION */}
              {twoFactorStep === 'disable' && (
                <form onSubmit={handleDisable2FA} className="space-y-4">
                  <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2.5">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <div>
                      <p className="font-bold">Turn Off Two-Factor Authentication?</p>
                      <p className="mt-0.5 text-rose-800 dark:text-rose-400">
                        Disabling 2FA decreases your account security. Please verify your password or authenticator code to proceed.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Confirm Account Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter your current password"
                      value={twoFactorDisablePassword}
                      onChange={(e) => setTwoFactorDisablePassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTwoFactorStep('overview');
                        setTwoFactorError(null);
                        setTwoFactorDisablePassword('');
                      }}
                      className="flex-1 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={twoFactorLoading || !twoFactorDisablePassword}
                      className="flex-1 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      {twoFactorLoading ? 'Disabling...' : 'Confirm & Disable'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: PRIVACY & DATA RIGHTS (GDPR / DPDP ACT 2023 / CCPA) */}
          {settingsTab === 'privacy' && (
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Privacy & Regulatory Data Rights
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exercise your statutory rights under GDPR (EU), India DPDP Act 2023, and CCPA (USA).
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                  GDPR • DPDP • CCPA
                </span>
              </div>

              {exportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  {exportSuccess}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  {errorMessage}
                </div>
              )}

              {/* CARD 1: RIGHT TO DATA PORTABILITY */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5 text-indigo-600" />
                      Right to Data Portability (Article 20 / DPDP Sec. 12)
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Download a structured, machine-readable JSON archive of all your personal data, security audit trails, authored documents, activity logs, and workspace preferences.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleExportData}
                    disabled={isExportingData}
                    className="w-full sm:w-auto text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
                  >
                    {isExportingData ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating Data Archive...
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Export My Personal Data (.json)
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* CARD 2: RIGHT TO ERASURE & VECTOR SCRUBBER */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400 tracking-wider flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Right to Erasure & Vector Scrubber (Article 17 / DPDP Sec. 12(3))
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Request permanent erasure (Right to be Forgotten). This will permanently scrub your personally identifiable information (PII), purge your private document embeddings from Qdrant vector memory, and terminate all active sessions.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsErasureModalOpen(true);
                      setErasureError(null);
                      setErasurePassword('');
                      setErasure2FACode('');
                      setErasureConfirmed(false);
                    }}
                    className="w-full sm:w-auto text-xs font-semibold text-rose-600 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Request Permanent Account & Data Erasure
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DEDICATED GDPR / DPDP DATA ERASURE CONFIRMATION MODAL */}
      <Dialog open={isErasureModalOpen} onOpenChange={setIsErasureModalOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-foreground">
              Confirm Permanent Account & Data Erasure
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteErasure} className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-900 dark:text-rose-300 leading-relaxed">
              <p className="font-bold">⚠️ This action is permanent and irreversible:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-800 dark:text-rose-400">
                <li>All profile PII will be irreversibly anonymized.</li>
                <li>Your private document embeddings will be purged from Qdrant vector memory.</li>
                <li>All active refresh tokens and sessions will be instantly revoked.</li>
              </ul>
            </div>

            {erasureError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                {erasureError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Enter your current password"
                value={erasurePassword}
                onChange={(e) => setErasurePassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            {user?.is_2fa_enabled && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Two-Factor Authentication Code (or Backup Code)
                </label>
                <Input
                  placeholder="6-digit TOTP or 8-char backup code"
                  value={erasure2FACode}
                  onChange={(e) => setErasure2FACode(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="erasure-confirm-check"
                checked={erasureConfirmed}
                onChange={(e) => setErasureConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="erasure-confirm-check" className="text-muted-foreground cursor-pointer select-none leading-snug">
                I explicitly authorize the permanent erasure of my account and vector data in accordance with GDPR Art. 17 and DPDP Act 2023.
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsErasureModalOpen(false)}
                className="flex-1 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isErasing || !erasurePassword || !erasureConfirmed}
                className="flex-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isErasing ? 'Erasing Data...' : 'Permanently Erase Data'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MANDATORY ORG-WIDE 2FA ENFORCEMENT MODAL */}
      <Dialog open={requiresMandatory2FA} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-lg max-w-[calc(100vw-2rem)] p-0 overflow-hidden [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-5 border-b border-border bg-amber-500/10 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Security Mandate: Enable Two-Factor Authentication
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your organization administrator requires all members to enable 2FA to protect workspace data.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {twoFactorError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                {twoFactorError}
              </div>
            )}

            {/* Overview Step */}
            {twoFactorStep === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border space-y-2">
                  <p className="font-semibold text-foreground">
                    To comply with enterprise security standards (SOC 2, ISO 27001, and GDPR), all accounts in <strong>{user?.org_name || 'your workspace'}</strong> must use an authenticator app.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Setting up takes less than 60 seconds with Google Authenticator, Authy, Apple Passwords, or 1Password.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleStart2FASetup}
                  disabled={twoFactorLoading}
                  className="w-full text-xs font-semibold"
                >
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  {twoFactorLoading ? 'Preparing Setup...' : 'Set Up Two-Factor Authentication Now'}
                </Button>
              </div>
            )}

            {/* Setup QR Step */}
            {twoFactorStep === 'setup' && (
              <form onSubmit={handleVerifyAndEnable2FA} className="space-y-4 text-xs">
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-xl border border-border space-y-3">
                  {twoFactorQrUri ? (
                    <img
                      src={twoFactorQrUri}
                      alt="2FA QR Code"
                      className="w-44 h-44 rounded-lg border border-border bg-white p-1"
                    />
                  ) : (
                    <div className="w-44 h-44 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                      Loading QR code...
                    </div>
                  )}

                  <div className="w-full text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Manual Secret Key:
                    </span>
                    <div className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-border">
                      <span className="font-mono text-xs font-bold text-primary select-all">
                        {twoFactorSecret}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="p-1 text-slate-400 hover:text-foreground rounded"
                        title="Copy Key"
                      >
                        {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Enter 6-Digit Authenticator Code
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={twoFactorVerifyCode}
                    onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-lg tracking-widest font-bold"
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorVerifyCode.length !== 6}
                  className="w-full text-xs font-semibold"
                >
                  {twoFactorLoading ? 'Verifying...' : 'Verify & Activate Account'}
                </Button>
              </form>
            )}

            {/* Backup Codes Step */}
            {twoFactorStep === 'backup_codes' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300">
                  <p className="font-bold">Save Emergency Backup Codes</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    Save these single-use recovery codes in a safe place.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-border grid grid-cols-2 gap-2 font-mono font-bold text-center">
                  {twoFactorBackupCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-border/80 p-2 rounded-lg text-foreground select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyBackupCodes}
                    className="flex-1 text-xs font-semibold gap-1.5"
                  >
                    {copiedBackupCodes ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedBackupCodes ? 'Copied' : 'Copy Codes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadBackupCodes}
                    className="flex-1 text-xs font-semibold gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download (.txt)
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    setTwoFactorStep('overview');
                    checkSession();
                  }}
                  className="w-full text-xs font-semibold mt-2"
                >
                  Proceed to Workspace
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SESSION INACTIVITY TIMEOUT WARNING DIALOG (SOC 2 / ISO 27001) */}
      <Dialog open={showIdleWarning} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md max-w-[calc(100vw-2rem)]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-2">
              <Clock className="h-6 w-6 animate-pulse" />
            </div>
            <DialogTitle className="text-center text-base font-bold">
              Session Inactivity Warning
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              For security and compliance with organization access policies, your session will automatically expire due to inactivity.
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl inline-block">
              <span className="text-muted-foreground font-semibold">Auto logging out in: </span>
              <span className="font-mono font-bold text-amber-600 text-sm">{idleCountdown}s</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex-1 text-xs font-semibold"
            >
              Sign Out Now
            </Button>
            <Button
              type="button"
              onClick={handleStaySignedIn}
              className="flex-1 text-xs font-semibold"
            >
              Stay Signed In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
