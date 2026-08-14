import { createAuditLog } from '../models/AuditLogs.js';
import * as AuditTrailService from '../services/auditTrail.service.js';
import log from './logger.js';

/**
 * Legacy ActivityLogs writer + dual-write to Enterprise Audit Trail.
 * ActivityLogs behavior unchanged; Audit Trail failures never affect callers.
 */
export async function logActivity(payload = {}) {
  try {
    const item = await createAuditLog(payload);
    void AuditTrailService.logFromActivityPayload(payload);
    return item;
  } catch (error) {
    log.error('Activity log write failed:', error);
    return null;
  }
}
