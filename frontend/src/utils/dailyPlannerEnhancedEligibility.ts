/**
 * Enhanced Daily Planner features eligibility.
 * Must stay aligned with backend/src/utils/dailyPlannerEnhancedEligibility.js
 *
 * Factory → eligible (any access role).
 * Office + Super Admin → eligible.
 * Office + User/Admin → NOT eligible.
 */

import { normalizeEmployeeLocation } from './companyWorkingDays';
import { isSuperAdmin } from './accessControl';

export function isEnhancedDailyPlannerEligible(
  location?: string | null,
  accessRole?: string | null,
): boolean {
  const loc = normalizeEmployeeLocation(location);
  if (loc === 'Factory') return true;
  return isSuperAdmin(String(accessRole || ''));
}
