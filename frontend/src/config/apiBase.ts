/**
 * Backend API root. Production includes the /api suffix, e.g.
 * https://host.example/api
 */
export function getApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
  return String(raw).replace(/\/$/, '');
}
