/**
 * CloudWatch-friendly structured logging (JSON when LOG_FORMAT=json).
 */

import log from './logger.js';

const useJson = String(process.env.LOG_FORMAT || '').toLowerCase() === 'json';

export function logStructured(event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    service: 'design-company-management-api',
    environment: process.env.NODE_ENV || 'development',
    ...fields,
  };

  if (useJson) {
    console.log(JSON.stringify(entry));
    return;
  }

  const summary = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  log.info(`[${event}] ${summary}`);
}

export function logErrorStructured(event, error, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    level: 'error',
    service: 'design-company-management-api',
    message: error?.message || String(error),
    stack: error?.stack,
    code: error?.code,
    statusCode: error?.statusCode,
    ...fields,
  };

  if (useJson) {
    console.error(JSON.stringify(entry));
    return;
  }

  log.error(`[${event}] ${entry.message}`, fields);
}
