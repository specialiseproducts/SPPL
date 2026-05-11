import * as AccessModel from '../models/UserAccessControl.js';
import { logActivity } from '../utils/activityLogger.js';

const GLOBAL_ROLES = new Set(['Developer', 'Admin', 'Super Admin', 'User']);
const OVERRIDE_ROLES = new Set(['Developer', 'Admin', 'Super Admin', 'User', 'None']);
const MODULES = new Set(['salesForecasting', 'expenses', 'payroll', 'purchases', 'crm', 'userManagement']);

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

export const getAllAccessControl = async () => AccessModel.getAll();
export const getAccessControlByCode = async (employeeCode) => AccessModel.getByEmployeeCode(employeeCode);

export const createAccessControl = async (payload, actor) => {
  validatePayload(payload);
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
  return item;
};

export const updateAccessControl = async (employeeCode, payload, actor) => {
  validatePayload(payload);
  const prev = await AccessModel.getByEmployeeCode(employeeCode);
  const item = await AccessModel.createOrUpdateAccessControl({
    ...payload,
    employeeCode,
    updatedBy: actor?.employeeCode || 'system',
    updatedByName: actor?.fullName || '',
  });
  await logActivity({
    actorEmployeeCode: actor?.employeeCode || '',
    actorName: actor?.fullName || '',
    actorRole: actor?.role || '',
    module: 'userManagement',
    actionType: 'UPDATE',
    targetEntity: 'accessControl',
    targetId: item.employeeCode,
    oldValue: prev || {},
    newValue: item,
  });
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

