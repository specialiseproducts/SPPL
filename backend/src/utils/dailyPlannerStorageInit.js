/**
 * Startup hook — ensures Daily Planner DynamoDB tables (including planning scores) exist.
 */

import log from './logger.js';
import { ensureDailyPlannerStorage } from './ensureDailyPlannerStorage.js';

let readyPromise = null;

export function ensureDailyPlannerStorageReady() {
  if (!readyPromise) {
    readyPromise = ensureDailyPlannerStorage({
      log: (message) => log.info(message),
    }).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Fire-and-forget startup hook (server boot). */
export function initDailyPlannerStorageOnStartup() {
  ensureDailyPlannerStorageReady().catch((err) => {
    log.error('Daily Planner storage startup provisioning failed:', err?.message || err);
  });
}
