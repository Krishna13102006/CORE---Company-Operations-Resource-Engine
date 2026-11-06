const rawBase = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const API_BASE = rawBase ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`) : '/api';

export function getApiUrl(endpoint: string): string {
  if (!endpoint) return API_BASE;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (API_BASE.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4); // remove duplicate '/api'
  }
  return `${API_BASE}${cleanEndpoint}`;
}

export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const backendBase = API_BASE.replace(/\/api\/?$/, '');
  return `${backendBase}${cleanUrl}`;
}


export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiRequest<T = any>(
  method: string,
  endpoint: string,
  body: any = null,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers = new Headers(options.headers || {});
  if (body && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Fallback authorization header if cookies are blocked by cross-site policies
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Configurable timeout to prevent endless hanging (default 90s to support cloud server cold-starts)
  const timeoutMs = options.timeoutMs ?? 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config: RequestInit = {
    ...options,
    method,
    headers,
    credentials: 'include', // CRITICAL: Send cookies (access/refresh JWTs) automatically
    signal: options.signal || controller.signal,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // Payload wasn't JSON
      }
      let formattedMsg = `Request failed with status ${response.status}`;
      if (errorData) {
        if (typeof errorData.error === 'string') {
          formattedMsg = errorData.error;
        } else if (typeof errorData.detail === 'string') {
          formattedMsg = errorData.detail;
        } else if (typeof errorData === 'object') {
          const extracted = extractObjectMessages(errorData);
          if (extracted) formattedMsg = extracted;
        }
      } else if (response.status === 401) {
        formattedMsg = 'Invalid email address or password. Please check your credentials and try again.';
      } else if (response.status === 429) {
        formattedMsg = 'Too many requests. Please wait a moment and try again.';
      }
      throw new ApiError(
        response.status,
        formattedMsg,
        errorData
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new ApiError(
        408,
        'The server took too long to respond. If it was sleeping, it is waking up now. Please try again.',
        null
      );
    }
    // Network / CORS / offline failure
    throw new ApiError(
      0,
      err.message || 'Unable to reach the server. Please check your network connection.',
      null
    );
  }
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit & { timeoutMs?: number }) =>
    apiRequest<T>('GET', endpoint, null, options),
  post: <T = any>(endpoint: string, body?: any, options?: RequestInit & { timeoutMs?: number }) =>
    apiRequest<T>('POST', endpoint, body, options),
  put: <T = any>(endpoint: string, body?: any, options?: RequestInit & { timeoutMs?: number }) =>
    apiRequest<T>('PUT', endpoint, body, options),
  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit & { timeoutMs?: number }) =>
    apiRequest<T>('PATCH', endpoint, body, options),
  delete: <T = any>(endpoint: string, options?: RequestInit & { timeoutMs?: number }) =>
    apiRequest<T>('DELETE', endpoint, null, options),
};

export function extractErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred.';
  
  if (typeof err === 'string') return cleanFriendlyMessage(err);
  
  const message = err.message;
  const data = err.data;

  // 1. Check response payload for specific backend messages
  if (data) {
    if (typeof data === 'string') return cleanFriendlyMessage(data);
    
    if (data.detail && typeof data.detail === 'string') {
      return cleanFriendlyMessage(data.detail);
    }

    if (data.error) {
      if (typeof data.error === 'string') return cleanFriendlyMessage(data.error);
      if (typeof data.error === 'object') {
        return cleanFriendlyMessage(extractObjectMessages(data.error));
      }
    }
    
    const extracted = extractObjectMessages(data);
    if (extracted) return cleanFriendlyMessage(extracted);
  }

  // 2. Check message on error object
  if (message && typeof message === 'string' && message !== '[object Object]') {
    return cleanFriendlyMessage(message);
  }

  // 3. Fallback by status code
  if (err.status === 401) {
    return 'Invalid email address or password. Please check your credentials and try again.';
  }
  if (err.status === 429) {
    return 'Too many login attempts. Please wait a minute and try again.';
  }
  
  return 'An unexpected error occurred. Please try again.';
}

function cleanFriendlyMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred.';
  
  if (
    msg.includes('No active account found with the given credentials') ||
    msg.includes('no_active_account') ||
    msg.toLowerCase().includes('credentials')
  ) {
    return 'Invalid email address or password. Please check your credentials and try again.';
  }

  if (msg.toLowerCase().includes('throttled') || msg.toLowerCase().includes('too many requests')) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  // Clean raw prefixes like "Detail: ", "Error: "
  let cleaned = msg
    .replace(/^Error:\s*/i, '')
    .replace(/^Detail:\s*/i, '')
    .trim();

  return cleaned || 'An unexpected error occurred.';
}

function extractObjectMessages(obj: any): string {
  if (!obj || typeof obj !== 'object') return '';
  
  const parts: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'status' || key === 'success') continue;
    
    const formattedKey = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
      
    if (typeof value === 'string') {
      parts.push(`${formattedKey}: ${value}`);
    } else if (Array.isArray(value)) {
      const msgs = value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ');
      parts.push(`${formattedKey}: ${msgs}`);
    } else if (typeof value === 'object') {
      const nested = extractObjectMessages(value);
      if (nested) parts.push(`${formattedKey}: ${nested}`);
    }
  }
  
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(obj);
}
