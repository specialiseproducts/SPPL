/**
 * Daily Planner v2 workflow eligibility.
 * Must stay aligned with frontend/src/utils/dailyPlannerFactoryEligibility.ts
 *
 * Applies when Location is Factory OR Office (any access role).
 * Office and Factory employees receive the same v2 workflow features.
 * Location-specific min hours / holidays / planning windows remain separate.
 *
 * Existing enhanced features (docs / Progress / Project Progress / Flag) use
 * dailyPlannerEnhancedEligibility.js (also Factory + Office).
 */

import {
  EMPLOYEE_LOCATION_FACTORY,
  EMPLOYEE_LOCATION_OFFICE,
  normalizeEmployeeLocation,
} from './companyWorkingDays.js';
import { getEmployeeLocation } from './employeeLocation.js';

/**
 * @param {string|null|undefined} location
 */
export function isFactoryDailyPlannerEligible(location) {
  const loc = normalizeEmployeeLocation(location);
  return loc === EMPLOYEE_LOCATION_FACTORY || loc === EMPLOYEE_LOCATION_OFFICE;
}

/**
 * @param {string} employeeCode
 */
export async function resolveFactoryEligibilityForEmployeeCode(employeeCode) {
  const code = String(employeeCode || '').trim();
  if (!code) return false;
  const location = await getEmployeeLocation(code);
  return isFactoryDailyPlannerEligible(location);
}

/**
 * @param {object} authUser
 */
export async function resolveFactoryEligibilityForAuthUser(authUser) {
  const code = String(authUser?.employeeCode || authUser?.id || '').trim();
  if (!code) return false;
  const location = await getEmployeeLocation(code);
  return isFactoryDailyPlannerEligible(location);
}

export function assertFactoryDailyPlannerEligible(eligible, message) {
  if (eligible) return;
  const err = new Error(
    message ||
      'This Daily Planner feature is only available for Factory and Office employees.',
  );
  err.statusCode = 403;
  throw err;
}
