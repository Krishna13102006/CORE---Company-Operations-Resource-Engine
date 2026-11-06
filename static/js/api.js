// api.js — Central API utility for CORE
// All API calls go through this file. Never use fetch() directly in panel JS.

const API_BASE = '/api';

// Token storage — sessionStorage only, never localStorage
const TokenStore = {
  getAccess()  { return sessionStorage.getItem('core_access'); },
  getRefresh() { return sessionStorage.getItem('core_refresh'); },
  setTokens(access, refresh) {
    sessionStorage.setItem('core_access', access);
    sessionStorage.setItem('core_refresh', refresh);
  },
  getUser() {
    const raw = sessionStorage.getItem('core_user');
    return raw ? JSON.parse(raw) : null;
  },
  setUser(user) {
    sessionStorage.setItem('core_user', JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem('core_access');
    sessionStorage.removeItem('core_refresh');
    sessionStorage.removeItem('core_user');
  },
  isAuthenticated() {
    return !!this.getAccess();
  }
};

// Decode JWT payload without a library (payload is just base64)
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Check if access token is expired (with 30s buffer)
function isTokenExpired(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  return (payload.exp * 1000) < (Date.now() + 30000);
}

// Silently refresh the access token using the refresh token
async function refreshAccessToken() {
  const refresh = TokenStore.getRefresh();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });

    if (!response.ok) {
      TokenStore.clear();
      return false;
    }

    const data = await response.json();
    TokenStore.setTokens(data.access, data.refresh || refresh);
    return true;
  } catch {
    TokenStore.clear();
    return false;
  }
}

// Core request function — all API calls use this
async function apiRequest(method, endpoint, body = null, isPublic = false) {
  const headers = { 'Content-Type': 'application/json' };

  if (!isPublic) {
    let access = TokenStore.getAccess();

    if (!access) {
      redirectToLogin();
      return null;
    }

    if (isTokenExpired(access)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        redirectToLogin();
        return null;
      }
      access = TokenStore.getAccess();
    }

    headers['Authorization'] = `Bearer ${access}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      redirectToLogin();
      return null;
    }
    // retry once after refresh
    headers['Authorization'] = `Bearer ${TokenStore.getAccess()}`;
    return fetch(`${API_BASE}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null });
  }

  return response;
}

// Convenience methods
const api = {
  get:    (endpoint, isPublic = false) => apiRequest('GET', endpoint, null, isPublic),
  post:   (endpoint, body, isPublic = false) => apiRequest('POST', endpoint, body, isPublic),
  patch:  (endpoint, body) => apiRequest('PATCH', endpoint, body),
  put:    (endpoint, body) => apiRequest('PUT', endpoint, body),
  delete: (endpoint) => apiRequest('DELETE', endpoint),
};

function redirectToLogin() {
  TokenStore.clear();
  const path = window.location.pathname;
  if (!path.includes('/login') && path !== '/') {
    window.location.href = '/login/';
  }
}

function redirectToDashboard() {
  window.location.href = '/dashboard/';
}

// Get current user's role from token
function getCurrentUserRole() {
  const token = TokenStore.getAccess();
  if (!token) return null;
  const payload = decodeJWT(token);
  return payload ? payload.role : null;
}

function getCurrentOrgId() {
  const token = TokenStore.getAccess();
  if (!token) return null;
  const payload = decodeJWT(token);
  return payload ? payload.org_id : null;
}
