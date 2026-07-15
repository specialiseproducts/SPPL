import { parseIsoDateOnly, toIsoDateOnly } from '../components/sales/planner/plannerUtils';

export const COMPANY_HOLIDAY_MESSAGE =
  'This date is a company holiday. Regular planning is not available.';

export const EMPLOYEE_LOCATION_OFFICE = 'Office';
export const EMPLOYEE_LOCATION_FACTORY = 'Factory';

/** Normalize employee location; empty/unknown → Office rules. */
export function normalizeEmployeeLocation(location?: string | null): string {
  const value = String(location || '').trim();
  if (value === EMPLOYEE_LOCATION_FACTORY) return EMPLOYEE_LOCATION_FACTORY;
  return EMPLOYEE_LOCATION_OFFICE;
}

/** 1-based Saturday occurrence within the calendar month (1 = first Saturday). */
export function getSaturdayOccurrenceInMonth(dateIso: string): number | null {
  const parsed = parseIsoDateOnly(dateIso);
  if (!parsed || parsed.getUTCDay() !== 6) return null;

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const dayOfMonth = parsed.getUTCDate();
  let count = 0;

  for (let day = 1; day <= dayOfMonth; day += 1) {
    const cursor = new Date(Date.UTC(year, month, day));
    if (cursor.getUTCDay() === 6) count += 1;
  }

  return count;
}

/**
 * Holiday rules depend on employee Location.
 * Office (default): Sunday + 3rd/4th Saturday.
 * Factory: Sunday only.
 */
export function isCompanyHoliday(dateIso: string, location?: string | null): boolean {
  const parsed = parseIsoDateOnly(dateIso);
  if (!parsed) return false;

  const dayOfWeek = parsed.getUTCDay();
  if (dayOfWeek === 0) return true;

  if (normalizeEmployeeLocation(location) === EMPLOYEE_LOCATION_FACTORY) {
    return false;
  }

  if (dayOfWeek === 6) {
    const saturdayNumber = getSaturdayOccurrenceInMonth(dateIso);
    if (!saturdayNumber) return false;
    return saturdayNumber === 3 || saturdayNumber === 4;
  }

  return false;
}

export function isCompanyWorkingDay(dateIso: string, location?: string | null): boolean {
  return !isCompanyHoliday(dateIso, location);
}

export function assertRegularPlanningAllowedOnDate(
  dateIso: string,
  location?: string | null,
): void {
  if (isCompanyHoliday(dateIso, location)) {
    throw new Error(COMPANY_HOLIDAY_MESSAGE);
  }
}
