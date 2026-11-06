import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiError, getApiUrl } from '../lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr' | 'manager' | 'employee';
  is_superuser?: boolean;
  is_2fa_enabled?: boolean;
  org_enforce_2fa?: boolean;
  session_idle_timeout_minutes?: number;
  org: string | null;
  org_name: string | null;
  org_slug?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  employee_profile_id?: string | null;
  status_message?: string | null;
  status_emoji?: string | null;
  status_updated_at?: string | null;
  calendar_feed_url?: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
  last_seen_display?: string;
}

interface LoginResult {
  requires2FA?: boolean;
  email?: string;
  twoFactorTicket?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string, twoFactorTicket?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearTwoFactorState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stored2FATicket, setStored2FATicket] = useState<string | null>(null);

  const checkSession = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<User>('/auth/me/');
      setUser(data);
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();

    // Background keep-alive to keep the cloud backend and database awake while tab is active
    const keepAlive = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch(getApiUrl('/health/?check_db=1')).catch(() => {});
      }
    }, 4 * 60 * 1000);

    // Real-time Presence Heartbeat: updates user.last_seen_at immediately & while tab is active
    const pingHeartbeat = () => {
      const token = localStorage.getItem('access_token');
      if (token && document.visibilityState === 'visible') {
        api.post('/auth/heartbeat/').catch(() => {});
      }
    };
    pingHeartbeat();
    const heartbeat = setInterval(pingHeartbeat, 60 * 1000);
    window.addEventListener('focus', pingHeartbeat);
    document.addEventListener('visibilitychange', pingHeartbeat);

    return () => {
      clearInterval(keepAlive);
      clearInterval(heartbeat);
      window.removeEventListener('focus', pingHeartbeat);
      document.removeEventListener('visibilitychange', pingHeartbeat);
    };
  }, []);

  const clearTwoFactorState = () => {
    setStored2FATicket(null);
  };

  const login = async (
    email: string,
    password: string,
    twoFactorCode?: string,
    twoFactorTicket?: string
  ): Promise<LoginResult> => {
    const ticket = twoFactorTicket || stored2FATicket;
    const payload: Record<string, string> = {
      email: email.trim(),
      password,
    };
    if (twoFactorCode && twoFactorCode.trim()) {
      payload.two_factor_code = twoFactorCode.trim();
    }
    if (ticket) {
      payload.two_factor_ticket = ticket;
    }

    const data = await api.post<{
      status: string;
      requires_2fa?: boolean;
      two_factor_ticket?: string;
      email?: string;
      user?: User;
      access?: string;
    }>('/auth/login/', payload);

    if (data.requires_2fa || data.status === '2fa_required') {
      if (data.two_factor_ticket) {
        setStored2FATicket(data.two_factor_ticket);
      }
      return {
        requires2FA: true,
        email: data.email || email.trim(),
        twoFactorTicket: data.two_factor_ticket,
      };
    }

    // Clean up on successful login
    setStored2FATicket(null);

    if (data.access) {
      localStorage.setItem('access_token', data.access);
    }
    if (data.user) {
      setUser(data.user);
    }
    return { requires2FA: false };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout/');
    } catch (err) {
      console.error('Logout request failed', err);
    } finally {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkSession,
    clearTwoFactorState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
