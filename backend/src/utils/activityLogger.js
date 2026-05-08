import { createAuditLog } from '../models/AuditLogs.js';
import log from './logger.js';

export async function logActivity(payload = {}) {
  try {
    return await createAuditLog(payload);
  } catch (error) {
    log.error('Activity log write failed:', error);
    return null;
  }
}

