/**
 * Daily Planner v2 workflow eligibility (mandatory Project Name, task navigator,
 * batch completion drafts, time slots, observations, multi-doc PDF combine,
 * 12h inputs, etc.).
 *
 * Must stay aligned with backend/src/utils/dailyPlannerFactoryEligibility.js
 *
 * Applies when Location is Factory OR Office (any access role).
 * Location-specific business rules (min hours, holidays, planning windows)
 * remain separate and continue to use the task owner's Location.
 *
 * Do NOT conflate with isEnhancedDailyPlannerEligible, which gates documents /
 * Progress fields / Project Progress / Raise Flag (also Factory + Office).
 */

import {
  EMPLOYEE_LOCATION_FACTORY,
  EMPLOYEE_LOCATION_OFFICE,
  normalizeEmployeeLocation,
} from './companyWorkingDays';

export function isFactoryDailyPlannerEligible(location?: string | null): boolean {
  const loc = normalizeEmployeeLocation(location);
  return loc === EMPLOYEE_LOCATION_FACTORY || loc === EMPLOYEE_LOCATION_OFFICE;
}
