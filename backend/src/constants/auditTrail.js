/**
 * Enterprise Audit Trail — action / module constants.
 * Future modules may add action strings freely; known values are documented here.
 */

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  VERIFY: 'VERIFY',
  EXPORT: 'EXPORT',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  WORKFLOW_CHANGE: 'WORKFLOW_CHANGE',
  CUSTOM: 'CUSTOM',
};

export const AUDIT_MODULES = {
  EXPENSES: 'expenses',
  SALES_FORECASTING: 'salesForecasting',
  DAILY_PLANNER: 'dailyPlanner',
  USER_MANAGEMENT: 'userManagement',
  ORDER_PROCESSING: 'orderProcessing',
  AUTH: 'auth',
  ACCESS_CONTROL: 'accessControl',
  NOTIFICATIONS: 'notifications',
  SYSTEM: 'system',
  CRM: 'crm',
  PAYROLL: 'payroll',
  PURCHASES: 'purchases',
  INVENTORY: 'inventory',
  VENDOR_MANAGEMENT: 'vendorManagement',
  CUSTOMER_MANAGEMENT: 'customerManagement',
};

export const AUDIT_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
};

/** Map legacy ActivityLogs actionType (+ metadata) → Audit Trail action. */
export function resolveAuditAction(actionType, metadata = {}) {
  const raw = String(actionType || '').trim().toUpperCase();
  const metaAction = String(metadata?.action || '').toLowerCase();

    if (metaAction.includes('audit_approve') || metaAction === 'approve') return AUDIT_ACTIONS.APPROVE;
  if (metaAction.includes('audit_reject') || metaAction === 'reject') return AUDIT_ACTIONS.REJECT;
  if (metaAction.includes('export')) return AUDIT_ACTIONS.EXPORT;
  if (metaAction.includes('withdraw')) return AUDIT_ACTIONS.STATUS_CHANGE;
  if (metaAction.includes('role') || metaAction === 'role_change') return AUDIT_ACTIONS.ROLE_CHANGE;
  if (metaAction.includes('permission')) return AUDIT_ACTIONS.PERMISSION_CHANGE;
  if (metaAction.includes('status')) return AUDIT_ACTIONS.STATUS_CHANGE;
  if (metaAction.includes('submit')) return AUDIT_ACTIONS.WORKFLOW_CHANGE;

  if (raw === 'PASSWORD_RESET') return AUDIT_ACTIONS.UPDATE;
  if (Object.values(AUDIT_ACTIONS).includes(raw)) return raw;
  if (raw) return raw;
  return AUDIT_ACTIONS.CUSTOM;
}

export function buildEntityKey(entityType, entityId) {
  const t = String(entityType || '').trim();
  const id = String(entityId || '').trim();
  if (!t || !id) return '';
  return `${t}#${id}`;
}
