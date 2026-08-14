/**
 * Backward-compatible notifyUser — delegates to NotificationService.create().
 */

import * as NotificationService from '../services/notification.service.js';

export async function notifyUser(employeeCode, title, message, type = 'INFO', metadata = {}) {
  if (!employeeCode) return null;
  return NotificationService.notifyUserLegacy(employeeCode, title, message, type, metadata);
}

export { NotificationService };
