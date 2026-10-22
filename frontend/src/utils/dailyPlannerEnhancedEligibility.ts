/**
 * Enhanced Daily Planner features eligibility.
 * Must stay aligned with backend/src/utils/dailyPlannerEnhancedEligibility.js
 *
 * Factory → eligible (any access role).
 * Office → eligible (any access role).
 *
 * Documents, Progress Done fields (where shown), Project Progress, and Raise Flag
 * follow this gate. Location-specific min hours / holidays stay separate.
 */

import {
  EMPLOYEE_LOCATION_FACTORY,
  EMPLOYEE_LOCATION_OFFICE,
  normalizeEmployeeLocation,
} from './companyWorkingDays';
import { isSuperAdmin } from './accessControl';

export function isEnhancedDailyPlannerEligible(
  location?: string | null,
  accessRole?: string | null,
): boolean {
  const loc = normalizeEmployeeLocation(location);
  if (loc === EMPLOYEE_LOCATION_FACTORY || loc === EMPLOYEE_LOCATION_OFFICE) return true;
  return isSuperAdmin(String(accessRole || ''));
}
