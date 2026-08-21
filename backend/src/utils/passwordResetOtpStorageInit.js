/**
 * Startup hook — ensures PasswordResetOtps DynamoDB table exists.
 */

import log from './logger.js';
import { ensurePasswordResetOtpStorage } from './ensurePasswordResetOtpStorage.js';

let readyPromise = null;

export function ensurePasswordResetOtpStorageReady() {
  if (!readyPromise) {
    readyPromise = ensurePasswordResetOtpStorage({
      log: (message) => log.info(message),
    }).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Fire-and-forget startup hook (server boot). */
export function initPasswordResetOtpStorageOnStartup() {
  ensurePasswordResetOtpStorageReady().catch((err) => {
    log.error('Password reset OTP storage startup provisioning failed:', err?.message || err);
  });
}
