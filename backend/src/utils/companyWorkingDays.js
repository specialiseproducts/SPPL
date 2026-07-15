/**
 * Company working-day calendar (IST date keys, YYYY-MM-DD).
 *
 * Location-aware holidays (Employee.location):
 * - Office (default): Sunday, 3rd Saturday, 4th Saturday
 * - Factory: Sunday only (Saturdays are working days)
 */

import { addCalendarDays, dateKeyFromDate, parseDateKey } from './salesQuotationDates.js';

export const COMPANY_HOLIDAY_MESSAGE =
  'This date is a company holiday. Regular planning is not available.';

export const EMPLOYEE_LOCATION_OFFICE = 'Office';
export const EMPLOYEE_LOCATION_FACTORY = 'Factory';

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

/**
 * @param {string} dateKey
 * @param {string} [location] Office | Factory
 */
export function isCompanyHolidayDateKey(dateKey, location) {
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
