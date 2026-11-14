/**
 * Automatic employee offboarding based on Date of Exit.
 *
 * - Auth/login/middleware reject exited employees (centralized).
 * - Access Management rows are revoked when exit becomes effective.
 * - Does not delete EmployeeMaster or historical business records.
 * - Clearing exit does NOT restore Access Management (admin must re-assign).
 * - Soft-deleted accounts remain blocked independently of exit date.
 */

import * as UserAccessControlModel from '../models/UserAccessControl.js';
import {
  isEmployeeActiveOnDate,
  normalizeEmployeeDateKey,
} from '../utils/employeeActiveStatus.js';
import { todayIstDateKey } from '../utils/salesQuotationDates.js';
import { logActivity } from '../utils/activityLogger.js';
import log from '../utils/logger.js';

export const EMPLOYEE_EXITED_AUTH_MESSAGE =
  'Your employment has ended (Date of Exit reached). Access to the ERP portal is no longer available.';

/** Extract Date of Exit from an employee row (camelCase or snake_case). */
export function getEmployeeExitDate(employee) {
  if (!employee || typeof employee !== 'object') return '';
  return normalizeEmployeeDateKey(employee.dateOfExit || employee.date_of_exit || '');
}

/** True when the employee may authenticate / call protected APIs today (IST). */
export function isEmployeeEligibleForAuth(employee, referenceDate = todayIstDateKey()) {
  if (!employee) return false;
  return isEmployeeActiveOnDate(getEmployeeExitDate(employee), referenceDate);
}

/**
 * Throw 401 when the employee is missing or exit date is effective.
 * Used by login, getMe, and authenticateToken.
 */
export function assertEmployeeEligibleForAuth(employee, message = EMPLOYEE_EXITED_AUTH_MESSAGE) {
  if (!employee) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  if (isEmployeeEligibleForAuth(employee)) return;
  const err = new Error(message);
  err.statusCode = 401;
  err.code = 'EMPLOYEE_EXITED';
  throw err;
}

/**
 * Remove Access Management assignment for an exited employee.
 * Idempotent — safe if no row exists.
 */
export async function revokeAccessControlForEmployee(
  employeeCode,
  actor = null,
  { reason = 'date_of_exit' } = {},
) {
  const code = String(employeeCode || '').trim();
  if (!code) return { revoked: false, employeeCode: '' };

  const existing = await UserAccessControlModel.getByEmployeeCode(code);
  if (!existing) {
    return { revoked: false, employeeCode: code };
  }

  await UserAccessControlModel.deleteByEmployeeCode(code);
  log.info('Access Management revoked for exited employee:', code, reason);
  await logActivity({
    actorEmployeeCode: actor?.employeeCode || 'SYSTEM',
    actorName: actor?.fullName || 'System Offboarding',
    actorRole: actor?.role || 'System',
    module: 'userManagement',
    actionType: 'DELETE',
    targetEntity: 'accessControl',
    targetId: code,
    metadata: {
      action: 'offboarding_revoke_access',
      reason,
      description: 'Access revoked due to Date of Exit',
    },
  });
  return { revoked: true, employeeCode: code };
}

/**
 * If Date of Exit is effective as of today (IST), revoke Access Management.
 * Call after employee create/update when exit is set or changed.
 */
export async function revokeAccessIfExitEffective(employee, actor = null) {
  if (!employee) return { revoked: false };
  if (isEmployeeEligibleForAuth(employee)) {
    return { revoked: false, employeeCode: String(employee.employeeCode || '').trim() };
  }
  return revokeAccessControlForEmployee(employee.employeeCode, actor, {
    reason: 'date_of_exit_effective',
  });
}
