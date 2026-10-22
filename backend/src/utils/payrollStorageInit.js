/**
 * Startup hook — ensures Payroll DynamoDB tables exist.
 */

import log from './logger.js';
import { ensurePayrollStorage } from './ensurePayrollStorage.js';

let readyPromise = null;

export function ensurePayrollStorageReady() {
  if (!readyPromise) {
    readyPromise = ensurePayrollStorage({
      log: (message) => log.info(message),
    }).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Fire-and-forget startup hook (server boot). */
export function initPayrollStorageOnStartup() {
  ensurePayrollStorageReady().catch((err) => {
    log.error('Payroll storage startup provisioning failed:', err?.message || err);
  });
}
