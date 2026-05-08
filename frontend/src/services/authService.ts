const TOKEN_KEY = 'sppl_auth_token';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function readDataEnvelope(payload: any) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload || {};
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function login(employeeCode: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ employeeCode, password }),
  });

  const payload = await res.json();
  const data = readDataEnvelope(payload);
  const token = data.token || payload.token;
  const user = data.user || payload.user;
  const accessControl = data.accessControl || payload.accessControl;

  if (!res.ok || !payload?.success || !token || !user) {
    throw new Error(payload?.message || 'Invalid employee ID or password');
  }

  storeToken(token);
  return { token, user, accessControl };
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) {
    throw new Error('Missing token');
  }

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await res.json();
  const data = readDataEnvelope(payload);
  const user = data.user || payload.user;
  const accessControl = data.accessControl || payload.accessControl;

  if (!res.ok || !payload?.success || !user) {
    throw new Error(payload?.message || 'Session invalid');
  }

  return { user, accessControl, token };
}

export function logout() {
  removeToken();
}

