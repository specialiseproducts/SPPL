import { getMetricsSnapshot, recordFrontendEvent } from '../utils/metricsStore.js';
import { isDeveloper, isAdmin, isSuperAdmin } from '../utils/accessControl.js';

function canViewMetrics(user) {
  const role = user?.accessControl?.globalRole || user?.role || 'User';
  return isDeveloper(role) || isAdmin(role) || isSuperAdmin(role);
}

export const getMetrics = async (req, res, next) => {
  try {
    if (!canViewMetrics(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.status(200).json({ success: true, data: getMetricsSnapshot() });
  } catch (error) {
    next(error);
  }
};

export const ingestFrontendEvents = async (req, res, next) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [req.body].filter(Boolean);
    const employeeCode = req.user?.employeeCode || 'anonymous';
    for (const ev of events.slice(0, 20)) {
      recordFrontendEvent({
        ...ev,
        employeeCode,
      });
    }
    res.status(202).json({ success: true, accepted: events.length });
  } catch (error) {
    next(error);
  }
};
