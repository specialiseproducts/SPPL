/**
 * Notification Center API controller.
 */

import * as NotificationService from '../services/notification.service.js';
import * as NotificationSettingsService from '../services/notificationSettings.service.js';
import * as NotificationAnalyticsService from '../services/notificationAnalytics.service.js';
import { subscribe } from '../services/notificationRealtime.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

const SSE_HEARTBEAT_MS = 25_000;

/**
 * Authenticated SSE stream — one connection per browser tab for the user channel.
 */
export const streamNotifications = async (req, res) => {
  const employeeCode = String(req.user?.employeeCode || '').trim();
  if (!employeeCode) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  req.socket.setTimeout(0);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`event: connected\ndata: ${JSON.stringify({ employeeCode, at: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribe(employeeCode, res);
  const heartbeat = setInterval(() => {
    try {
      if (res.writableEnded) return;
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    } catch {
      /* connection likely closed */
    }
  }, SSE_HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('close', cleanup);
};

export const listNotifications = async (req, res, next) => {
  try {
    const result = await NotificationService.listForUser(req.user, {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor,
      status: req.query.status,
      module: req.query.module ?? req.query.tab,
      q: req.query.q ?? req.query.search,
      sort: req.query.sort,
    });
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('List notifications error:', error);
    next(error);
  }
};

export const unreadCount = async (req, res, next) => {
  try {
    const data = await NotificationService.unreadCount(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Unread notification count error:', error);
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const data = await NotificationService.markRead(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Mark notification read error:', error);
    next(error);
  }
};

export const markArchived = async (req, res, next) => {
  try {
    const data = await NotificationService.markArchived(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Archive notification error:', error);
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const data = await NotificationService.markAllRead(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Mark all notifications read error:', error);
    next(error);
  }
};

/** Settings framework endpoint — returns defaults only (no UI yet). */
export const getSettings = async (req, res, next) => {
  try {
    const data = await NotificationSettingsService.getSettingsForUser(
      req.user?.employeeCode,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get notification settings error:', error);
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const data = await NotificationSettingsService.updateSettingsForUser(
      req.user?.employeeCode,
      req.body || {},
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Update notification settings error:', error);
    next(error);
  }
};

/** Analytics JSON for authenticated user inbox (Phase 4A). */
export const getAnalytics = async (req, res, next) => {
  try {
    const data = await NotificationAnalyticsService.getAnalyticsForUser(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Notification analytics error:', error);
    next(error);
  }
};
