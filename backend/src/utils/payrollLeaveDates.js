/**
 * Inclusive calendar-day leave duration and advance-notice helpers (YYYY-MM-DD).
 */

import { parseDateKey, dateKeyFromDate } from './salesQuotationDates.js';
import { isCompanyWorkingDayDateKey } from './companyWorkingDays.js';

export const LEAVE_TYPES = Object.freeze({
  ONE_DAY: 'one_day',
  MULTIPLE_DAY: 'multiple_day',
  HALF_DAY: 'half_day',
});

export const HALF_DAY_PERIODS = Object.freeze({
  FIRST: 'first_half',
  SECOND: 'second_half',
});

/** Inclusive calendar days between start and end (same day = 1). */
export function inclusiveCalendarDays(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Count working days in an inclusive date range for the employee's location.
 * Excludes Sundays, location weekly holidays (e.g. Office 3rd/4th Saturday),
 * and declared company holidays via companyWorkingDays.
 */
export function countWorkingDaysInRange(startDateKey, endDateKey, location) {
  const keys = enumerateDateKeys(startDateKey, endDateKey);
  if (keys.length === 0) return null;
  let count = 0;
  for (const key of keys) {
    if (isCompanyWorkingDayDateKey(key, location)) count += 1;
  }
  return count;
}

/** Calendar days from applicationDate to startDate (same day = 0). */
export function calendarDaysUntilStart(applicationDateKey, startDateKey) {
  const app = parseDateKey(applicationDateKey);
  const start = parseDateKey(startDateKey);
  if (!app || !start) return null;
  const ms = start.getTime() - app.getTime();
  return Math.floor(ms / 86400000);
}

/**
 * True when multi-day leave longer than 2 days starts fewer than 15 calendar
 * days after the application date (warning-only rule).
 */
export function requiresAdvanceNoticeWarning(durationDays, applicationDateKey, startDateKey) {
  if (!Number.isFinite(durationDays) || durationDays <= 2) return false;
  const daysAway = calendarDaysUntilStart(applicationDateKey, startDateKey);
  if (daysAway == null) return false;
  return daysAway < 15;
}

/** Enumerate YYYY-MM-DD keys from start..end inclusive. */
export function enumerateDateKeys(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end || end.getTime() < start.getTime()) return [];
  const keys = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    keys.push(dateKeyFromDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function rangesOverlapMonth(startDateKey, endDateKey, year, month) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return false;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  return start.getTime() <= monthEnd.getTime() && end.getTime() >= monthStart.getTime();
}

/** Inclusive date-range overlap (YYYY-MM-DD string compare is safe for ISO keys). */
export function dateRangesOverlap(startA, endA, startB, endB) {
  const aStart = String(startA || '').trim().slice(0, 10);
  const aEnd = String(endA || '').trim().slice(0, 10);
  const bStart = String(startB || '').trim().slice(0, 10);
  const bEnd = String(endB || '').trim().slice(0, 10);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Statuses that block overlapping leave on the same dates. */
export function isActiveLeaveConflictStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value === 'deleted' || value === 'removed' || value === 'cancelled') {
    return false;
  }
  // Rejected does not block a new request (employee may re-apply).
  if (value === 'rejected') return false;
  // Pending + Approved (and any future active statuses) block conflicts.
  return true;
}
