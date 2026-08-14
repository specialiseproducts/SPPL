/**
 * In-process SSE fan-out for notifications (per-user channels).
 * Scale note: sticky sessions / Redis pub-sub can replace this Map later.
 */

import log from '../utils/logger.js';

/** @type {Map<string, Set<import('http').ServerResponse>>} */
const channels = new Map();

function channelKey(employeeCode) {
  return String(employeeCode || '').trim();
}

export function subscribe(employeeCode, res) {
  const key = channelKey(employeeCode);
  if (!key) return () => {};

  let set = channels.get(key);
  if (!set) {
    set = new Set();
    channels.set(key, set);
  }
  set.add(res);
  log.info('SSE notification channel subscribed', { employeeCode: key, connections: set.size });

  return () => {
    const current = channels.get(key);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) channels.delete(key);
    log.info('SSE notification channel unsubscribed', {
      employeeCode: key,
      connections: current.size,
    });
  };
}

export function publishToUser(employeeCode, eventName, data) {
  const key = channelKey(employeeCode);
  if (!key) return 0;
  const set = channels.get(key);
  if (!set || set.size === 0) return 0;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  let delivered = 0;
  for (const res of [...set]) {
    try {
      if (res.writableEnded) {
        set.delete(res);
        continue;
      }
      res.write(payload);
      delivered += 1;
    } catch (err) {
      set.delete(res);
      log.warn('SSE write failed — dropping connection', {
        employeeCode: key,
        error: err?.message || err,
      });
    }
  }
  if (set.size === 0) channels.delete(key);
  return delivered;
}

/** Push a newly created public notification to its recipient. */
export function publishNotificationCreated(publicNotification) {
  if (!publicNotification) return 0;
  const code = String(
    publicNotification.recipientEmployeeCode || publicNotification.employeeCode || '',
  ).trim();
  if (!code) return 0;
  return publishToUser(code, 'notification.created', {
    notification: publicNotification,
    at: new Date().toISOString(),
  });
}

export function activeConnectionCount(employeeCode) {
  const set = channels.get(channelKey(employeeCode));
  return set ? set.size : 0;
}
