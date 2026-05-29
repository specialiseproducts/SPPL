/**
 * API timing + response size metrics middleware.
 */

import { recordRequest } from '../utils/metricsStore.js';
import { logStructured } from '../utils/structuredLog.js';

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 500);
const LARGE_BYTES = Number(process.env.LARGE_PAYLOAD_BYTES || 1024 * 1024);

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

function normalizePath(req) {
  const raw = req.originalUrl || req.url || req.path || '/';
  return raw.split('?')[0];
}

export function requestMetricsMiddleware(req, res, next) {
  if (req.path === '/health' || req.path === '/api/metrics') {
    return next();
  }

  const start = process.hrtime.bigint();
  let responseBytes = 0;

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function jsonWithMetrics(body) {
    try {
      responseBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      responseBytes = 0;
    }
    return originalJson(body);
  };

  res.send = function sendWithMetrics(body) {
    if (body != null) {
      responseBytes =
        typeof body === 'string'
          ? Buffer.byteLength(body, 'utf8')
          : Buffer.isBuffer(body)
            ? body.length
            : responseBytes;
    }
    return originalSend(body);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const path = normalizePath(req);
    const statusCode = res.statusCode;

    recordRequest({
      method: req.method,
      path,
      statusCode,
      durationMs,
      responseBytes,
    });

    const line = `${req.method} ${path} → ${Math.round(durationMs)}ms → ${formatBytes(responseBytes)}`;
    const isSlow = durationMs >= SLOW_MS;
    const isLarge = responseBytes >= LARGE_BYTES;

    logStructured('api_request', {
      method: req.method,
      path,
      statusCode,
      durationMs: Math.round(durationMs),
      responseBytes,
      slow: isSlow,
      largePayload: isLarge,
    });

    if (isSlow || isLarge) {
      const prefix = isSlow && isLarge ? 'SLOW+LARGE' : isSlow ? 'SLOW' : 'LARGE';
      logStructured('api_request_alert', {
        alert: prefix,
        message: line,
        method: req.method,
        path,
        durationMs: Math.round(durationMs),
        responseBytes,
      });
    }
  });

  next();
}
