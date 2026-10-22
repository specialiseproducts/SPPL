/**
 * Enhanced Daily Planner features eligibility.
 *
 * Factory → eligible (any access role).
 * Office → eligible (any access role).
 *
 * Documents, Progress Done fields (where shown), Project Progress, and Raise Flag
 * follow this gate. Location-specific min hours / holidays stay separate.
 */

import * as UserAccessControlModel from '../models/UserAccessControl.js';
import {
  EMPLOYEE_LOCATION_FACTORY,
  EMPLOYEE_LOCATION_OFFICE,
  normalizeEmployeeLocation,
} from './companyWorkingDays.js';
import { getEffectiveRole, isSuperAdmin } from './accessControl.js';
import { getEmployeeLocation } from './employeeLocation.js';

/**
 * Pure rule from already-resolved location + Daily Planner access role.
 * @param {string|null|undefined} location
 * @param {string|null|undefined} accessRole Daily Planner effective role
 */
export function isEnhancedDailyPlannerEligible(location, accessRole) {
  const loc = normalizeEmployeeLocation(location);
  if (loc === EMPLOYEE_LOCATION_FACTORY || loc === EMPLOYEE_LOCATION_OFFICE) return true;
  return isSuperAdmin(accessRole);
}

/**
 * Resolve eligibility for an employee code using EmployeeMaster + UserAccessControl.
 */
export async function resolveEnhancedEligibilityForEmployeeCode(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return false;
  const [location, accessRow] = await Promise.all([
    getEmployeeLocation(code),
    UserAccessControlModel.getByEmployeeCode(code),
  ]);
  const accessRole = getEffectiveRole(accessRow || {}, 'dailyPlanner');
  return isEnhancedDailyPlannerEligible(location, accessRole);
}

/**
 * Resolve eligibility for the authenticated request user.
 */
export async function resolveEnhancedEligibilityForAuthUser(authUser, effectiveRole) {
  const code = String(authUser?.employeeCode || authUser?.id || '').trim();
  if (!code) return false;
  const location = await getEmployeeLocation(code);
  return isEnhancedDailyPlannerEligible(location, effectiveRole);
}

export function assertEnhancedDailyPlannerEligible(eligible, message) {
  if (eligible) return;
  const err = new Error(
    message || 'Enhanced Daily Planner features are not available for this employee.',
  );
  err.statusCode = 403;
  throw err;
}
