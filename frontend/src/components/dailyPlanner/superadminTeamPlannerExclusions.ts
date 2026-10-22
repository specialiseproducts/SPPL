/**
 * Superadmin-only Team Daily Planner employee dropdown exclusions.
 * Identified by exact employeeCode (not name substring matching).
 * Does not affect Admin dropdowns, My Daily Planner, User Management, or master data.
 */
export const SUPERADMIN_TEAM_DP_EXCLUDED_EMPLOYEE_CODES = new Set<string>([
  'SPPL 013', // Anupam Verma
  'SPPL 008', // Bhavanaben Patel
  'DUMMY3', // Demo Dummy
  'DUMMY', // Developer Tester
  'SPPL 009', // Ujwala Yewale
]);

export function isExcludedFromSuperadminTeamPlannerDropdown(employeeCode: string): boolean {
  return SUPERADMIN_TEAM_DP_EXCLUDED_EMPLOYEE_CODES.has(String(employeeCode || '').trim());
}
