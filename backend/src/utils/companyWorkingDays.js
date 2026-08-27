/**
 * Company working-day calendar (IST date keys, YYYY-MM-DD).
 *
 * Shared holiday engine used by Daily Planner and Sales Forecasting.
 *
 * Holiday =
 *   Weekly holiday (location-aware)
 *   OR Declared company holiday (FY 2026–2027)
 *
 * Weekly holidays (Employee.location):
 * - Office (default): Sunday, 3rd Saturday, 4th Saturday
 * - Factory: Sunday only (Saturdays are working days)
 */

import { addCalendarDays, dateKeyFromDate, parseDateKey } from './salesQuotationDates.js';

export const COMPANY_HOLIDAY_MESSAGE =
  'This date is a company holiday. Regular planning is not available.';

/** Daily Planner task creation — holiday blocks all task types. */
export const COMPANY_HOLIDAY_TASK_CREATE_MESSAGE =
  'You cannot create a task on a holiday.';

export const EMPLOYEE_LOCATION_OFFICE = 'Office';
export const EMPLOYEE_LOCATION_FACTORY = 'Factory';

/**
 * Declared company holidays for Financial Year 2026–2027 (YYYY-MM-DD).
 * Applies to all locations (Office and Factory).
 */
export const DECLARED_COMPANY_HOLIDAYS_FY_2026_2027 = Object.freeze([
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-09-14', // Ganesh Festival
  '2026-09-15', // Ganesh Festival
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dassara / Vijayadashami
  '2026-11-09', // Diwali – Amavasya Laxmi Poojan
  '2026-11-10', // Diwali – Bali Pratipada
  '2026-11-11', // Diwali – Bhau Beej
  '2026-12-25', // Christmas
  '2027-01-26', // Republic Day
  '2027-03-23', // Holi
]);

const DECLARED_HOLIDAY_SET = new Set(DECLARED_COMPANY_HOLIDAYS_FY_2026_2027);

/** Normalize employee location; empty/unknown → Office rules. */
export function normalizeEmployeeLocation(location) {
  const value = String(location || '').trim();
  if (value === EMPLOYEE_LOCATION_FACTORY) return EMPLOYEE_LOCATION_FACTORY;
  return EMPLOYEE_LOCATION_OFFICE;
}

/** 1-based Saturday occurrence within the calendar month (1 = first Saturday). */
export function getSaturdayOccurrenceInMonth(dateKey) {
  const parsed = parseDateKey(dateKey);
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
export function isDeclaredCompanyHolidayDateKey(dateKey) {
  const key = String(dateKey || '').trim();
  return key ? DECLARED_HOLIDAY_SET.has(key) : false;
}

/**
 * Weekly holiday only (location-aware). Does not include declared holidays.
 * @param {string} dateKey
 * @param {string} [location] Office | Factory
 */
export function isWeeklyCompanyHolidayDateKey(dateKey, location) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return false;

  const dayOfWeek = parsed.getUTCDay();
  if (dayOfWeek === 0) return true;

  const normalized = normalizeEmployeeLocation(location);
  if (normalized === EMPLOYEE_LOCATION_FACTORY) {
    return false;
  }

  if (dayOfWeek === 6) {
    const saturdayNumber = getSaturdayOccurrenceInMonth(dateKey);
    if (!saturdayNumber) return false;
    return saturdayNumber === 3 || saturdayNumber === 4;
  }

  return false;
}

/**
 * Holiday = weekly holiday OR declared company holiday.
 * @param {string} dateKey
 * @param {string} [location] Office | Factory
 */
export function isCompanyHolidayDateKey(dateKey, location) {
  if (isDeclaredCompanyHolidayDateKey(dateKey)) return true;
  return isWeeklyCompanyHolidayDateKey(dateKey, location);
}

export function isCompanyWorkingDayDateKey(dateKey, location) {
  return !isCompanyHolidayDateKey(dateKey, location);
}

export function assertRegularPlanningAllowedOnDate(dateKey, location) {
  if (isCompanyHolidayDateKey(dateKey, location)) {
    const err = new Error(COMPANY_HOLIDAY_MESSAGE);
    err.statusCode = 400;
    throw err;
  }
}

/** Previous company working day before dateKey (exclusive). */
export function getPreviousWorkingDayDateKey(dateKey, location) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';

  for (let offset = 1; offset <= 366; offset += 1) {
    const cursor = addCalendarDays(parsed, -offset);
    const key = dateKeyFromDate(cursor);
    if (isCompanyWorkingDayDateKey(key, location)) return key;
  }
  return '';
}

/** Next company working day after dateKey (exclusive). */
export function getNextWorkingDayDateKey(dateKey, location) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';

  for (let offset = 1; offset <= 366; offset += 1) {
    const cursor = addCalendarDays(parsed, offset);
    const key = dateKeyFromDate(cursor);
    if (isCompanyWorkingDayDateKey(key, location)) return key;
  }
  return '';
}
