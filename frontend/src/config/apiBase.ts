/**
 * API base for Express routes mounted under `/api` (e.g. `POST /api/auth/login`).
 *
 * Uses only `import.meta.env.VITE_API_URL` (Vite-injected at build time).
 * Never concatenate literal strings like `VITE_API_URL=...` from config files.
 */

function sanitizeApiUrlInput(raw: string): string {
  let v = String(raw).trim();

  // Whole .env line or path-prefix pasted into Vercel/hosting value by mistake
  if (v.startsWith('/VITE_API_URL=')) {
    v = v.slice('/VITE_API_URL='.length).trim();
  } else if (v.startsWith('VITE_API_URL=')) {
    v = v.slice('VITE_API_URL='.length).trim();
  }

  // e.g. "/https://..." → "https://..."
  v = v.replace(/^\/+(?=https?:\/)/i, '');

  // Typo: "https:/host" → "https://host" (single slash after scheme)
  v = v.replace(/^https:\/(?!\/)/i, 'https://');
  v = v.replace(/^http:\/(?!\/)/i, 'http://');

  return v.trim();
}

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  const fallback = 'http://localhost:3001';
  const raw =
    fromEnv != null && String(fromEnv).trim() !== ''
      ? String(fromEnv)
      : fallback;

  let base = sanitizeApiUrlInput(raw).replace(/\/+$/, '');

  while (base.endsWith('/api/api')) {
    base = base.slice(0, -4);
  }
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}
