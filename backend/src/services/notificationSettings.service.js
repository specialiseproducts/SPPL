/**
 * Per-user notification preferences (UX Phase 4A).
 * Stored as PREFS#{employeeCode} items in the existing Notifications table.
 * Does not alter NotificationService create/list/approve business logic.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { NOTIFICATION_MODULES } from '../constants/notifications.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.NOTIFICATIONS;

/** Preference keys shown in Profile → Notification Preferences */
export const PREFERENCE_KEYS = [
  { key: NOTIFICATION_MODULES.SALES, label: 'Sales' },
  { key: NOTIFICATION_MODULES.EXPENSES, label: 'Expenses' },
  { key: NOTIFICATION_MODULES.DAILY_PLANNER, label: 'Daily Planner' },
  { key: NOTIFICATION_MODULES.CRM, label: 'CRM' },
  { key: NOTIFICATION_MODULES.PAYROLL, label: 'Payroll' },
  { key: NOTIFICATION_MODULES.PURCHASES, label: 'Purchases' },
  { key: NOTIFICATION_MODULES.ORDER_PROCESSING, label: 'Order Processing' },
  { key: NOTIFICATION_MODULES.SYSTEM, label: 'System' },
  { key: 'approvals', label: 'Approvals' },
];

export const CHANNEL_DEFAULTS = {
  inApp: true,
  browser: true,
  sound: true,
  email: false, // future only
};

function prefsId(employeeCode) {
  return `PREFS#${String(employeeCode || '').trim()}`;
}

function defaultModuleChannels() {
  const modules = {};
  for (const row of PREFERENCE_KEYS) {
    modules[row.key] = { ...CHANNEL_DEFAULTS };
  }
  return modules;
}

export function buildDefaultSettings() {
  return {
    version: 2,
    soundEnabled: true,
    browserEnabled: true,
    modules: defaultModuleChannels(),
    labels: PREFERENCE_KEYS,
  };
}

function mergeSettings(stored) {
  const defaults = buildDefaultSettings();
  if (!stored || typeof stored !== 'object') return defaults;
  const modules = { ...defaults.modules };
  const incoming = stored.modules && typeof stored.modules === 'object' ? stored.modules : {};
  for (const row of PREFERENCE_KEYS) {
    const prev = incoming[row.key] || {};
    modules[row.key] = {
      inApp: prev.inApp !== false,
      browser: prev.browser !== false,
      sound: prev.sound !== false,
      email: Boolean(prev.email), // future — keep false unless explicitly true later
    };
  }
  return {
    version: 2,
    soundEnabled: stored.soundEnabled !== false,
    browserEnabled: stored.browserEnabled !== false,
    modules,
    labels: PREFERENCE_KEYS,
  };
}

export async function getSettingsForUser(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return buildDefaultSettings();

  try {
    const result = await dynamoDB
      .get({
        TableName: TABLE_NAME,
        Key: { notificationId: prefsId(code) },
      })
      .promise();
    if (!result.Item || result.Item.recordType !== 'notification_preferences') {
      return buildDefaultSettings();
    }
    return mergeSettings(result.Item.settings || result.Item);
  } catch (err) {
    log.warn('getSettingsForUser failed — using defaults', { error: err?.message || err });
    return buildDefaultSettings();
  }
}

export async function updateSettingsForUser(employeeCode, patch = {}) {
  const code = String(employeeCode || '').trim();
  if (!code) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }

  const current = await getSettingsForUser(code);
  const nextModules = { ...current.modules };
  if (patch.modules && typeof patch.modules === 'object') {
    for (const row of PREFERENCE_KEYS) {
      if (!patch.modules[row.key]) continue;
      const incoming = patch.modules[row.key] || {};
      nextModules[row.key] = {
        inApp: incoming.inApp !== false,
        browser: incoming.browser !== false,
        sound: incoming.sound !== false,
        email: Boolean(incoming.email),
      };
    }
  }

  const settings = {
    version: 2,
    soundEnabled: patch.soundEnabled !== undefined ? Boolean(patch.soundEnabled) : current.soundEnabled,
    browserEnabled:
      patch.browserEnabled !== undefined ? Boolean(patch.browserEnabled) : current.browserEnabled,
    modules: nextModules,
  };

  const now = new Date().toISOString();
  const item = {
    notificationId: prefsId(code),
    recordType: 'notification_preferences',
    // Deliberately omit recipientEmployeeCode so prefs are not queried into user feeds.
    ownerEmployeeCode: code,
    settings,
    updatedAt: now,
    createdAt: now,
  };

  await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  return mergeSettings(settings);
}

/** Whether a channel is enabled for a module (and Approvals category). */
export async function isChannelEnabled(employeeCode, moduleName, channel, { category } = {}) {
  const settings = await getSettingsForUser(employeeCode);
  if (channel === 'sound' && settings.soundEnabled === false) return false;
  if (channel === 'browser' && settings.browserEnabled === false) return false;

  const modKey = String(moduleName || '').trim();
  const cat = String(category || '').trim();
  if (cat === NOTIFICATION_CATEGORIES.APPROVALS || cat === 'Approvals') {
    const approvals = settings.modules.approvals || CHANNEL_DEFAULTS;
    if (approvals[channel] === false) return false;
  }
  const row = settings.modules[modKey] || CHANNEL_DEFAULTS;
  return row[channel] !== false;
}

/** @deprecated stub name retained — always true at emit time (Phase 4A does not mute creation). */
export async function isInAppEnabled(_employeeCode, _moduleName) {
  return true;
}

export const DEFAULT_NOTIFICATION_SETTINGS = buildDefaultSettings();
