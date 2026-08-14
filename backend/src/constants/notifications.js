/**
 * Notification domain constants — shared by NotificationService and modules.
 */

export const NOTIFICATION_MODULES = {
  EXPENSES: 'expenses',
  SALES: 'salesForecasting',
  DAILY_PLANNER: 'dailyPlanner',
  USER_MANAGEMENT: 'userManagement',
  SYSTEM: 'system',
  CRM: 'crm',
  PAYROLL: 'payroll',
  PURCHASES: 'purchases',
  ORDER_PROCESSING: 'orderProcessing',
};

export const NOTIFICATION_CATEGORIES = {
  APPROVALS: 'Approvals',
  TASKS: 'Tasks',
  EXPENSES: 'Expenses',
  SALES: 'Sales',
  DAILY_PLANNER: 'Daily Planner',
  SYSTEM: 'System',
};

/** Tabs in Notification Center */
export const NOTIFICATION_TABS = [
  'All',
  'Approvals',
  'Tasks',
  'Expenses',
  'Sales',
  'Daily Planner',
  'System',
];

export const NOTIFICATION_PRIORITIES = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

export const NOTIFICATION_STATUS = {
  UNREAD: 'Unread',
  READ: 'Read',
  ARCHIVED: 'Archived',
};

/** action_required stays elevated until archived; activity is informational. */
export const NOTIFICATION_SECTIONS = {
  ACTION_REQUIRED: 'action_required',
  ACTIVITY: 'activity',
};

/**
 * Generic Action Required kinds — modules register handlers keyed by these values.
 * Stored on notification.metadata.actionKind (no schema change).
 */
export const ACTION_KINDS = {
  QUOTATION_EDIT_REQUEST: 'quotation_edit_request',
};

export const ACTION_OUTCOMES = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

export function prioritySortValue(priority) {
  switch (String(priority || '').trim()) {
    case NOTIFICATION_PRIORITIES.CRITICAL:
      return 0;
    case NOTIFICATION_PRIORITIES.HIGH:
      return 1;
    case NOTIFICATION_PRIORITIES.NORMAL:
      return 2;
    case NOTIFICATION_PRIORITIES.LOW:
      return 3;
    default:
      return 2;
  }
}

export function mapLegacyTypeToPriority(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'ERROR' || t === 'CRITICAL') return NOTIFICATION_PRIORITIES.CRITICAL;
  if (t === 'WARNING' || t === 'HIGH') return NOTIFICATION_PRIORITIES.HIGH;
  if (t === 'LOW') return NOTIFICATION_PRIORITIES.LOW;
  return NOTIFICATION_PRIORITIES.NORMAL;
}
