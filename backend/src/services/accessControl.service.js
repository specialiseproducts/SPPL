import * as AccessModel from '../models/UserAccessControl.js';
import * as EmployeeModel from '../models/EmployeeMaster.js';
import { logActivity } from '../utils/activityLogger.js';
import * as UserNotificationEmitters from './notificationEmitters.js';
import { diffChangedFields } from '../utils/auditTrailDiff.js';
import {
  isEmployeeEligibleForAuth,
  revokeAccessControlForEmployee,
} from './employeeOffboarding.service.js';

const GLOBAL_ROLES = new Set(['Developer', 'Admin', 'Super Admin', 'User']);
const OVERRIDE_ROLES = new Set(['Developer', 'Admin', 'Super Admin', 'User', 'None']);
const MODULES = new Set(['salesForecasting', 'expenses', 'payroll', 'purchases', 'crm', 'userManagement', 'dailyPlanner', 'orderProcessing']);

function validatePayload(payload = {}) {
  if (!GLOBAL_ROLES.has(payload.globalRole)) {
    const err = new Error('Invalid globalRole');
    err.statusCode = 400;
    throw err;
  }
  const overrides = payload.moduleOverrides || {};
  for (const [moduleName, role] of Object.entries(overrides)) {
    if (!MODULES.has(moduleName)) {
      const err = new Error(`Invalid module override: ${moduleName}`);
      err.statusCode = 400;
      throw err;
    }
    if (!OVERRIDE_ROLES.has(String(role))) {
      const err = new Error(`Invalid override role for ${moduleName}`);
      err.statusCode = 400;
      throw err;
    }
  }
}

/** Block Access Management assignment for employees whose Date of Exit is effective. */
async function assertEmployeeEligibleForAccessAssignment(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) {
    const err = new Error('employeeCode is required');
    err.statusCode = 400;
    throw err;
  }
  const employee = await EmployeeModel.getEmployeeByCode(code);
  if (!employee) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }
  if (!isEmployeeEligibleForAuth(employee)) {
    const err = new Error(
      'Cannot assign Access Management roles to an employee whose Date of Exit is effective.',
    );
    err.statusCode = 400;
    err.code = 'EMPLOYEE_EXITED';
    throw err;
  }
}

export const getAllAccessControl = async () => {
  const all = await AccessModel.getAll();
  const kept = [];
  // Reconcile: drop + revoke rows for employees whose exit is already effective.
  await Promise.all(
    (all || []).map(async (row) => {
      const code = String(row?.employeeCode || '').trim();
      if (!code) return;
      const employee = await EmployeeModel.getEmployeeByCode(code);
      if (!employee || !isEmployeeEligibleForAuth(employee)) {
        await revokeAccessControlForEmployee(code, null, {
          reason: 'access_list_reconcile_exit',
        });
        return;
      }
      kept.push(row);
    }),
  );
  return kept;
};
export const getAccessControlByCode = async (employeeCode) => AccessModel.getByEmployeeCode(employeeCode);

export const createAccessControl = async (payload, actor) => {
  validatePayload(payload);
  await assertEmployeeEligibleForAccessAssignment(payload?.employeeCode);
  const item = await AccessModel.createOrUpdateAccessControl({
    ...payload,
    updatedBy: actor?.employeeCode || 'system',
    updatedByName: actor?.fullName || '',
  });
  await logActivity({
    actorEmployeeCode: actor?.employeeCode || '',
    actorName: actor?.fullName || '',
    actorRole: actor?.role || '',
    module: 'userManagement',
    actionType: 'CREATE',
    targetEntity: 'accessControl',
    targetId: item.employeeCode,
    newValue: item,
  });
  void UserNotificationEmitters.emitRoleUpdated(item.employeeCode, actor?.employeeCode);
  return item;
};

export const updateAccessControl = async (employeeCode, payload, actor) => {
  validatePayload(payload);
  await assertEmployeeEligibleForAccessAssignment(employeeCode);
  const prev = await AccessModel.getByEmployeeCode(employeeCode);
  const item = await AccessModel.createOrUpdateAccessControl({
    ...payload,
    employeeCode,
    updatedBy: actor?.employeeCode || 'system',
    updatedByName: actor?.fullName || '',
  });
  const diff = diffChangedFields(prev || {}, item, ['globalRole', 'moduleOverrides']);
  const roleChanged =
    String(prev?.globalRole || '') !== String(item?.globalRole || '');
  await logActivity({
    actorEmployeeCode: actor?.employeeCode || '',
    actorName: actor?.fullName || '',
    actorRole: actor?.role || '',
    module: 'userManagement',
    actionType: 'UPDATE',
    targetEntity: 'accessControl',
    targetId: item.employeeCode,
    oldValue: diff.oldValues,
    newValue: diff.newValues,
    metadata: {
      action: roleChanged ? 'role_change' : 'permission_change',
      description: roleChanged ? 'Role Changed' : 'Permission Changed',
    },
  });
  void UserNotificationEmitters.emitRoleUpdated(item.employeeCode, actor?.employeeCode);
  return item;
};

export const deleteAccessControl = async (employeeCode, actor) => {
  await AccessModel.deleteByEmployeeCode(employeeCode);
  await logActivity({
    actorEmployeeCode: actor?.employeeCode || '',
    actorName: actor?.fullName || '',
    actorRole: actor?.role || '',
    module: 'userManagement',
    actionType: 'DELETE',
    targetEntity: 'accessControl',
    targetId: employeeCode,
  });
  return { employeeCode };
};

