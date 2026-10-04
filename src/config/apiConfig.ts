/**
 * Centralized API & WebSocket Configuration for Chatlaxy
 *
 * For local development:
 *   Defaults to current origin or http://localhost:3000
 *
 * For Render Static Site / Public Backend deployment:
 *   Set VITE_API_URL in your environment (e.g. https://your-public-backend.ngrok-free.app or your server URL)
 */

const envApiUrl = import.meta.env.VITE_API_URL;

// Determine HTTP API base URL
export const API_BASE_URL: string = (() => {
  if (envApiUrl && envApiUrl.trim().length > 0) {
    const clean = envApiUrl.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      return `https://${clean}`;
    }
    return clean;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
})();

// Determine WebSocket base URL
export const WS_BASE_URL: string = (() => {
  if (envApiUrl && envApiUrl.trim().length > 0) {
    const clean = envApiUrl.trim().replace(/\/+$/, '');
    const isSecure = clean.startsWith('https') || !clean.startsWith('http://');
    const hostOnly = clean.replace(/^https?:\/\//, '');
    return `${isSecure ? 'wss' : 'ws'}://${hostOnly}/ws`;
  }
  if (typeof window !== 'undefined' && window.location.host) {
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProto}://${window.location.host}/ws`;
  }
  return 'ws://localhost:3000/ws';
})();

// Token storage helpers
const TOKEN_KEY = 'chatlaxy_auth_token';

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Standard fetch wrapper that automatically attaches Authorization header
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    ...options,
    headers,
  });
}
