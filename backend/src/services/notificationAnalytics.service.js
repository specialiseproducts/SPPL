/**
 * Notification analytics (JSON only — Phase 4A).
 * Scoped to the authenticated recipient. Uses existing Notifications GSI lists.
 */

import * as NotificationsModel from '../models/Notifications.js';
import {
  NOTIFICATION_SECTIONS,
  NOTIFICATION_STATUS,
} from '../constants/notifications.js';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function msBetween(a, b) {
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return null;
  return t1 - t0;
}

async function listAllForRecipient(employeeCode, maxPages = 20) {
  const items = [];
  let cursor;
  let pages = 0;
  do {
    const page = await NotificationsModel.listByRecipientPage(employeeCode, {
      limit: 100,
      cursor,
    });
    for (const row of page.items || []) {
      if (row.recordType === 'notification_preferences') continue;
      items.push(row);
    }
    cursor = page.lastEvaluatedKey
      ? NotificationsModel.encodeCursor(page.lastEvaluatedKey)
      : undefined;
    pages += 1;
  } while (cursor && pages < maxPages);
  return items;
}

/**
 * @returns {Promise<object>} analytics JSON
 */
export async function getAnalyticsForUser(authUser) {
  const code = String(authUser?.employeeCode || '').trim();
  if (!code) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const rows = await listAllForRecipient(code);
  const now = new Date();
  const todayStart = startOfUtcDay(now).getTime();
  const weekStart = todayStart - 6 * 86400000;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  let unread = 0;
  let read = 0;
  let archived = 0;
  let pendingApprovals = 0;
  let today = 0;
  let week = 0;
  let month = 0;
  const moduleCounts = {};
  const readDurations = [];
  const approvalDurations = [];

  for (const row of rows) {
    const pub = NotificationsModel.toPublicNotification(row);
    if (!pub) continue;
    const status = pub.status;
    if (status === NOTIFICATION_STATUS.UNREAD) unread += 1;
    else if (status === NOTIFICATION_STATUS.ARCHIVED) archived += 1;
    else read += 1;

    if (pub.section === NOTIFICATION_SECTIONS.ACTION_REQUIRED) pendingApprovals += 1;

    const createdMs = new Date(pub.createdAt).getTime();
    if (Number.isFinite(createdMs)) {
      if (createdMs >= todayStart) today += 1;
      if (createdMs >= weekStart) week += 1;
      if (createdMs >= monthStart) month += 1;
    }

    const mod = String(pub.module || 'system');
    moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;

    if (pub.readAt) {
      const d = msBetween(pub.createdAt, pub.readAt);
      if (d != null) readDurations.push(d);
    }

    const resolvedAt = pub.metadata?.resolvedAt;
    if (resolvedAt) {
      const d = msBetween(pub.createdAt, resolvedAt);
      if (d != null) approvalDurations.push(d);
    }
  }

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  const topModules = Object.entries(moduleCounts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    unreadCount: unread,
    readCount: read,
    archivedCount: archived,
    pendingApprovals,
    averageReadTimeMs: avg(readDurations),
    averageApprovalTimeMs: avg(approvalDurations),
    notificationsToday: today,
    notificationsThisWeek: week,
    notificationsThisMonth: month,
    topModules,
    sampleSize: rows.length,
    generatedAt: now.toISOString(),
  };
}
