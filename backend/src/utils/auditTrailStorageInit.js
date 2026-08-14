import { ensureAuditTrailStorage } from './ensureAuditTrailStorage.js';
import log from './logger.js';

export function initAuditTrailStorageOnStartup() {
  ensureAuditTrailStorage({
    log: (msg) => log.info(msg),
  }).catch((err) => {
    log.error('AuditTrail storage init failed (non-fatal)', err?.message || err);
  });
}
