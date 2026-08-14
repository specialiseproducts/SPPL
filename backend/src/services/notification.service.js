/**
 * Centralized Notification Service.
 * Modules must call NotificationService.create() — never write DynamoDB directly.
 */

import * as NotificationsModel from '../models/Notifications.js';
import * as UserAccessControlModel from '../models/UserAccessControl.js';
import * as EmployeeMasterModel from '../models/EmployeeMaster.js';
import {
  canAccessAllRecords,
  getEffectiveRole,
  isAdmin,
  isDeveloper,
  isSuperAdmin,
} from '../utils/accessControl.js';
import {
  ACTION_OUTCOMES,
  NOTIFICATION_MODULES,
  NOTIFICATION_SECTIONS,
  NOTIFICATION_STATUS,
  mapLegacyTypeToPriority,
} from '../constants/notifications.js';
import { parsePaginationOptions, toPaginatedResponse } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';
import { publishNotificationCreated } from './notificationRealtime.service.js';

function assertOwn(notification, authUser) {
  const code = String(authUser?.employeeCode || '').trim();
  const recipient =
    String(notification.recipientEmployeeCode || notification.employeeCode || '').trim();
  if (!code || recipient !== code) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Create one notification for a recipient.
 * @returns {Promise<object|null>}
 */
export async function create(input = {}) {
  try {
    const recipientEmployeeCode = String(
      input.recipientEmployeeCode || input.employeeCode || '',
    ).trim();
    if (!recipientEmployeeCode) return null;

    let recipientEmail = String(input.recipientEmail || '').trim();
    let recipientRole = String(input.recipientRole || '').trim();

    if (!recipientEmail || !recipientRole) {
      try {
        const [emp, ac] = await Promise.all([
          EmployeeMasterModel.getEmployeeByCode(recipientEmployeeCode),
          UserAccessControlModel.getByEmployeeCode(recipientEmployeeCode),
        ]);
        if (!recipientEmail) {
          recipientEmail = String(emp?.officialEmail || '').trim();
        }
        if (!recipientRole) {
          recipientRole = String(ac?.globalRole || '').trim();
        }
      } catch {
        /* best-effort enrichment */
      }
    }

    const item = await NotificationsModel.createNotification({
      recipientEmployeeCode,
      recipientRole,
      recipientEmail,
      module: input.module || NOTIFICATION_MODULES.SYSTEM,
      category: input.category || 'System',
      title: input.title || '',
      message: input.message || '',
      priority: input.priority || 'Normal',
      section: input.section || NOTIFICATION_SECTIONS.ACTIVITY,
      actionType: input.actionType || '',
      actionId: input.actionId || '',
      actionUrl: input.actionUrl || '',
      metadata: input.metadata || {},
      createdBy: input.createdBy || 'system',
      type: input.type || 'INFO',
    });

    const pub = NotificationsModel.toPublicNotification(item);
    try {
      publishNotificationCreated(pub);
    } catch (pushErr) {
      log.warn('Notification realtime push failed', { error: pushErr?.message || pushErr });
    }
    return pub;
  } catch (err) {
    log.error('NotificationService.create failed', { error: err?.message || err });
    return null;
  }
}

/**
 * Create the same notification for many recipients (deduped).
 */
export async function createMany(recipientCodes, input = {}) {
  const codes = [
    ...new Set(
      (recipientCodes || [])
        .map((c) => String(c || '').trim())
        .filter(Boolean),
    ),
  ];
  const results = [];
  for (const code of codes) {
    const row = await create({ ...input, recipientEmployeeCode: code });
    if (row) results.push(row);
  }
  return results;
}

function isModuleModerator(effectiveRole, moduleName) {
  if (moduleName === NOTIFICATION_MODULES.EXPENSES) {
    return isAdmin(effectiveRole) || isDeveloper(effectiveRole) || isSuperAdmin(effectiveRole);
  }
  return canAccessAllRecords(effectiveRole);
}

/**
 * Resolve employee codes who can moderate a given module.
 */
export async function resolveModuleAdminCodes(moduleName, { excludeEmployeeCode } = {}) {
  const exclude = String(excludeEmployeeCode || '').trim();
  try {
    const all = await UserAccessControlModel.getAll();
    return all
      .filter((ac) => {
        const code = String(ac.employeeCode || '').trim();
        if (!code || (exclude && code === exclude)) return false;
        const role = getEffectiveRole(ac, moduleName);
        return isModuleModerator(role, moduleName);
      })
      .map((ac) => String(ac.employeeCode).trim());
  } catch (err) {
    log.error('resolveModuleAdminCodes failed', { error: err?.message || err, moduleName });
    return [];
  }
}

/**
 * Notify all module admins (skip actor).
 */
export async function notifyModuleAdmins(moduleName, input = {}, options = {}) {
  const codes = await resolveModuleAdminCodes(moduleName, options);
  return createMany(codes, {
    ...input,
    module: moduleName,
  });
}

/**
 * Legacy Daily Planner helper shape → NotificationService.create
 */
export async function notifyUserLegacy(
  employeeCode,
  title,
  message,
  type = 'INFO',
  metadata = {},
) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  return create({
    recipientEmployeeCode: employeeCode,
    title,
    message,
    type,
    priority: mapLegacyTypeToPriority(type),
    module: meta.module || NOTIFICATION_MODULES.DAILY_PLANNER,
    category: meta.category || 'Tasks',
    section: meta.section || NOTIFICATION_SECTIONS.ACTIVITY,
    actionType: meta.actionType || '',
    actionId: meta.plannerTaskId || meta.actionId || '',
    actionUrl: meta.actionUrl || '',
    metadata: meta,
    createdBy: meta.createdBy || 'system',
  });
}

export async function listForUser(authUser, options = {}) {
  const code = String(authUser?.employeeCode || '').trim();
  if (!code) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const pagination = parsePaginationOptions({
    limit: options.limit ?? 50,
    cursor: options.cursor,
  });
  if (!pagination.limit) {
    pagination.limit = 50;
    pagination.paginated = true;
  }

  const page = await NotificationsModel.listByRecipientPage(code, {
    limit: pagination.limit,
    cursor: options.cursor,
  });

  let items = page.items.map(NotificationsModel.toPublicNotification).filter(Boolean);

  const statusFilter = String(options.status || '').trim();
  if (statusFilter === 'Unread' || statusFilter === 'Read' || statusFilter === 'Archived') {
    items = items.filter((n) => n.status === statusFilter);
  } else if (statusFilter !== 'All') {
    // Default main view: exclude Archived
    items = items.filter((n) => n.status !== NOTIFICATION_STATUS.ARCHIVED);
  }

  const moduleFilter = String(options.module || '').trim();
  if (moduleFilter && moduleFilter !== 'All') {
    const map = {
      Approvals: null, // handled via section/category
      Tasks: NOTIFICATION_MODULES.DAILY_PLANNER,
      Expenses: NOTIFICATION_MODULES.EXPENSES,
      Sales: NOTIFICATION_MODULES.SALES,
      'Daily Planner': NOTIFICATION_MODULES.DAILY_PLANNER,
      System: NOTIFICATION_MODULES.SYSTEM,
    };
    if (moduleFilter === 'Approvals') {
      items = items.filter(
        (n) =>
          n.section === NOTIFICATION_SECTIONS.ACTION_REQUIRED ||
          n.category === 'Approvals',
      );
    } else if (map[moduleFilter]) {
      items = items.filter((n) => n.module === map[moduleFilter]);
    } else {
      items = items.filter((n) => n.module === moduleFilter);
    }
  }

  const q = String(options.q || options.search || '')
    .trim()
    .toLowerCase();
  if (q) {
    items = items.filter((n) => {
      const blob = [
        n.module,
        n.title,
        n.message,
        n.category,
        n.actionId,
        JSON.stringify(n.metadata || {}),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }

  const sort = String(options.sort || 'newest').toLowerCase();
  items = [...items].sort((a, b) => {
    if (sort === 'oldest') {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    }
    if (sort === 'priority') {
      const d = (a.prioritySort ?? 2) - (b.prioritySort ?? 2);
      if (d !== 0) return d;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
    if (sort === 'module') {
      const d = String(a.module || '').localeCompare(String(b.module || ''));
      if (d !== 0) return d;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  // Action Required first within page
  items.sort((a, b) => {
    const sa = a.section === NOTIFICATION_SECTIONS.ACTION_REQUIRED ? 0 : 1;
    const sb = b.section === NOTIFICATION_SECTIONS.ACTION_REQUIRED ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return 0;
  });

  return toPaginatedResponse(items, page.lastEvaluatedKey);
}

export async function unreadCount(authUser) {
  const code = String(authUser?.employeeCode || '').trim();
  if (!code) return { count: 0 };
  const count = await NotificationsModel.countUnreadByRecipient(code);
  return { count };
}

export async function markRead(notificationId, authUser) {
  const existing = await NotificationsModel.getNotificationById(notificationId);
  if (!existing) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  assertOwn(existing, authUser);
  const now = new Date().toISOString();
  const updated = await NotificationsModel.updateNotification(notificationId, {
    status: NOTIFICATION_STATUS.READ,
    isRead: true,
    readAt: now,
  });
  return NotificationsModel.toPublicNotification(updated);
}

export async function markArchived(notificationId, authUser) {
  const existing = await NotificationsModel.getNotificationById(notificationId);
  if (!existing) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  assertOwn(existing, authUser);
  const now = new Date().toISOString();
  const updated = await NotificationsModel.updateNotification(notificationId, {
    status: NOTIFICATION_STATUS.ARCHIVED,
    isRead: true,
    archivedAt: now,
    readAt: existing.readAt || now,
  });
  return NotificationsModel.toPublicNotification(updated);
}

export async function markAllRead(authUser) {
  const code = String(authUser?.employeeCode || '').trim();
  if (!code) return { updated: 0 };

  let updated = 0;
  let cursor;
  do {
    const page = await NotificationsModel.listByRecipientPage(code, {
      limit: 100,
      cursor,
    });
    const unread = page.items.filter((row) => {
      const pub = NotificationsModel.toPublicNotification(row);
      return pub.status === NOTIFICATION_STATUS.UNREAD;
    });

    // Parallel updates within each page — same outcome, much lower latency.
    const results = await Promise.all(
      unread.map((row) =>
        NotificationsModel.updateNotification(row.notificationId, {
          status: NOTIFICATION_STATUS.READ,
          isRead: true,
          readAt: new Date().toISOString(),
        }),
      ),
    );
    updated += results.length;

    cursor = page.lastEvaluatedKey
      ? NotificationsModel.encodeCursor(page.lastEvaluatedKey)
      : undefined;
  } while (cursor);

  return { updated };
}

/**
 * Resolve Action Required notifications after an approval workflow completes.
 * Looks up module moderators (existing resolveModuleAdminCodes) and updates matching
 * recipient notifications via GSI list — no table scan.
 *
 * @param {{
 *   moduleName: string,
 *   actionKind: string,
 *   actionId: string,
 *   outcome: 'Completed' | 'Rejected' | string,
 *   title?: string,
 *   message?: string,
 *   remark?: string,
 * }} input
 */
export async function resolveActionRequired(input = {}) {
  const moduleName = String(input.moduleName || '').trim();
  const actionKind = String(input.actionKind || '').trim();
  const actionId = String(input.actionId || '').trim();
  const outcome = String(input.outcome || ACTION_OUTCOMES.COMPLETED).trim();
  if (!moduleName || !actionKind || !actionId) return { updated: 0 };

  const codes = await resolveModuleAdminCodes(moduleName);
  const now = new Date().toISOString();
  let updated = 0;

  for (const code of codes) {
    let cursor;
    do {
      const page = await NotificationsModel.listByRecipientPage(code, {
        limit: 100,
        cursor,
      });
      for (const row of page.items) {
        const pub = NotificationsModel.toPublicNotification(row);
        if (!pub) continue;
        if (pub.section !== NOTIFICATION_SECTIONS.ACTION_REQUIRED) continue;
        const meta = pub.metadata && typeof pub.metadata === 'object' ? pub.metadata : {};
        const kind = String(meta.actionKind || '').trim();
        const metaRequestId = String(meta.requestId || pub.actionId || '').trim();
        if (kind !== actionKind || metaRequestId !== actionId) continue;

        const nextMeta = {
          ...meta,
          approvalStatus: outcome,
          remark: input.remark != null ? String(input.remark) : meta.remark || '',
          resolvedAt: now,
          actionable: false,
        };

        await NotificationsModel.updateNotification(pub.notificationId, {
          section: NOTIFICATION_SECTIONS.ACTIVITY,
          title: input.title || pub.title,
          message: input.message || pub.message,
          actionType: 'View',
          metadata: nextMeta,
        });
        updated += 1;
      }
      cursor = page.lastEvaluatedKey
        ? NotificationsModel.encodeCursor(page.lastEvaluatedKey)
        : undefined;
    } while (cursor);
  }

  return { updated };
}
