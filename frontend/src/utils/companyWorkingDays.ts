import { parseIsoDateOnly } from '../components/sales/planner/plannerUtils';

export const COMPANY_HOLIDAY_MESSAGE =
  'This date is a company holiday. Regular planning is not available.';

/** Daily Planner task creation — holiday blocks all task types. */
export const COMPANY_HOLIDAY_TASK_CREATE_MESSAGE =
  'You cannot create a task on a holiday.';

export const EMPLOYEE_LOCATION_OFFICE = 'Office';
export const EMPLOYEE_LOCATION_FACTORY = 'Factory';

/**
 * Declared company holidays for Financial Year 2026–2027 (YYYY-MM-DD → display name).
 * Applies to all locations (Office and Factory).
 * Date keys must stay in sync with backend/src/utils/companyWorkingDays.js
 */
export const DECLARED_COMPANY_HOLIDAYS_FY_2026_2027 = Object.freeze({
  '2026-05-01': 'Maharashtra Day',
  '2026-08-15': 'Independence Day',
  '2026-09-14': 'Ganesh Festival',
  '2026-09-15': 'Ganesh Festival',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dassara / Vijayadashami',
  '2026-11-09': 'Diwali – Amavasya Laxmi Poojan',
  '2026-11-10': 'Diwali – Bali Pratipada',
  '2026-11-11': 'Diwali – Bhau Beej',
  '2026-12-25': 'Christmas',
  '2027-01-26': 'Republic Day',
  '2027-03-23': 'Holi',
} as const);

const DECLARED_HOLIDAY_SET = new Set<string>(Object.keys(DECLARED_COMPANY_HOLIDAYS_FY_2026_2027));

export type CompanyHolidayType = 'weekly' | 'declared';

export type CompanyHolidayInfo = {
  isHoliday: boolean;
  holidayType: CompanyHolidayType | null;
  holidayName: string | null;
};

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

/** Declared company holiday (not weekly). */
export function isDeclaredCompanyHoliday(dateIso: string): boolean {
  const key = String(dateIso || '').trim();
  return key ? DECLARED_HOLIDAY_SET.has(key) : false;
}

/** Display name for a declared company holiday, or null. */
export function getDeclaredCompanyHolidayName(dateIso: string): string | null {
  const key = String(dateIso || '').trim();
  if (!key) return null;
  return (
    (DECLARED_COMPANY_HOLIDAYS_FY_2026_2027 as Readonly<Record<string, string>>)[key] ?? null
  );
}

/**
 * Weekly holiday only (location-aware). Does not include declared holidays.
 * Office (default): Sunday + 3rd/4th Saturday.
 * Factory: Sunday only.
 */
export function isWeeklyCompanyHoliday(dateIso: string, location?: string | null): boolean {
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

/**
 * Holiday = weekly holiday OR declared company holiday.
 * Shared by My Daily Planner, Team Daily Planner, and Sales Forecasting planners.
 */
export function isCompanyHoliday(dateIso: string, location?: string | null): boolean {
  if (isDeclaredCompanyHoliday(dateIso)) return true;
  return isWeeklyCompanyHoliday(dateIso, location);
}

/**
 * Calendar metadata for holiday UI.
 * Declared holidays include a display name; weekly holidays do not.
 */
export function getCompanyHolidayInfo(
  dateIso: string,
  location?: string | null,
): CompanyHolidayInfo {
  if (isDeclaredCompanyHoliday(dateIso)) {
    return {
      isHoliday: true,
      holidayType: 'declared',
      holidayName: getDeclaredCompanyHolidayName(dateIso),
    };
  }
  if (isWeeklyCompanyHoliday(dateIso, location)) {
    return {
      isHoliday: true,
      holidayType: 'weekly',
      holidayName: null,
    };
  }
  return {
    isHoliday: false,
    holidayType: null,
    holidayName: null,
  };
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
