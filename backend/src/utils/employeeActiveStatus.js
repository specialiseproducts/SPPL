/**
 * Employee lifecycle eligibility for NEW/CURRENT operations.
 *
 * Date of Exit filled → former employee from that calendar date onward.
 * Historical reads must not use this to hide past records.
 */

import { normalizeDateKey, todayIstDateKey } from './salesQuotationDates.js';

export const EMPLOYEE_EXITED_OPERATION_MESSAGE =
  'This employee is no longer active (Date of Exit reached) and cannot be used for new operations on the selected date.';

/** Normalize exit / operation dates to YYYY-MM-DD (empty if invalid). */
export function normalizeEmployeeDateKey(value) {
  return normalizeDateKey(value) || '';
}

/**
 * True if the employee may participate in NEW/CURRENT work on operationDate.
 * - Empty Date of Exit → active
 * - operationDate < Date of Exit → active
 * - operationDate >= Date of Exit → not active
 *
 * @param {string|null|undefined} dateOfExit
 * @param {string|null|undefined} operationDate YYYY-MM-DD (defaults to today IST when omitted)
 */
export function isEmployeeActiveOnDate(dateOfExit, operationDate) {
  const exit = normalizeEmployeeDateKey(dateOfExit);
  if (!exit) return true;
  const op = normalizeEmployeeDateKey(operationDate) || todayIstDateKey();
  if (!op) return true;
  return op < exit;
}

/**
 * True if the employee was active on at least one calendar day of the month
 * (for Team Planner / historical month selectors).
 */
export function isEmployeeActiveDuringMonth(dateOfExit, year, month) {
  const exit = normalizeEmployeeDateKey(dateOfExit);
  if (!exit) return true;
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return isEmployeeActiveOnDate(dateOfExit, todayIstDateKey());
  }
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  return exit > monthStart;
}

export function assertEmployeeActiveOnDate(dateOfExit, operationDate, message) {
  if (isEmployeeActiveOnDate(dateOfExit, operationDate)) return;
  const err = new Error(message || EMPLOYEE_EXITED_OPERATION_MESSAGE);
  err.statusCode = 400;
  throw err;
}
