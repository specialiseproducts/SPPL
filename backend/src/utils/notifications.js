import { createNotification } from '../models/Notifications.js';

export async function notifyUser(employeeCode, title, message, type = 'INFO', metadata = {}) {
  if (!employeeCode) return null;
  return createNotification({
    employeeCode,
    title,
    message,
    type,
    metadata,
  });
}

