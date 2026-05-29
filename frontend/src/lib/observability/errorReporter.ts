/**
 * Centralized client error reporting (structured console + optional backend ingest).
 * Set VITE_SENTRY_DSN to enable Sentry when @sentry/react is added later.
 */

import { getApiBaseUrl } from '../../config/apiBase';
import { getToken } from '../../services/authService';

export type ErrorReportContext = {
  source: 'error_boundary' | 'api' | 'runtime' | 'query';
  module?: string;
  path?: string;
  status?: number;
  componentStack?: string;
  extra?: Record<string, unknown>;
};

const recentReports = new Set<string>();

function fingerprint(ctx: ErrorReportContext, error: Error): string {
  return `${ctx.source}|${ctx.module || ''}|${error.message}|${ctx.path || ''}`;
}

export function reportError(error: unknown, context: ErrorReportContext) {
  const err = error instanceof Error ? error : new Error(String(error));
  const fp = fingerprint(context, err);
  if (recentReports.has(fp)) return;
  recentReports.add(fp);
  if (recentReports.size > 200) recentReports.clear();

  const payload = {
    at: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    ...context,
  };

  console.error('[error-report]', payload);

  void sendToBackend(payload);

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn && typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureException: (e: Error, ctx?: object) => void } }).Sentry) {
    (window as unknown as { Sentry: { captureException: (e: Error, ctx?: object) => void } }).Sentry.captureException(err, {
      extra: context,
    });
  }
}

async function sendToBackend(payload: Record<string, unknown>) {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${getApiBaseUrl()}/metrics/frontend-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        events: [{ type: 'client_error', ...payload }],
      }),
    });
  } catch {
    /* ignore network failures for telemetry */
  }
}
