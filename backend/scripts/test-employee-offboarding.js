/**
 * Focused unit checks for Date-of-Exit offboarding helpers.
 * Run: node scripts/test-employee-offboarding.js
 */

import {
  isEmployeeActiveOnDate,
  normalizeEmployeeDateKey,
} from '../src/utils/employeeActiveStatus.js';
import {
  assertEmployeeEligibleForAuth,
  getEmployeeExitDate,
  isEmployeeEligibleForAuth,
  EMPLOYEE_EXITED_AUTH_MESSAGE,
} from '../src/services/employeeOffboarding.service.js';
import { todayIstDateKey } from '../src/utils/salesQuotationDates.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const today = todayIstDateKey();
const yesterday = addDays(today, -1);
const tomorrow = addDays(today, 1);

console.log('Reference today (IST):', today);

// --- isEmployeeActiveOnDate ---
assert(isEmployeeActiveOnDate('', today) === true, 'empty exit → active');
assert(isEmployeeActiveOnDate(null, today) === true, 'null exit → active');
assert(isEmployeeActiveOnDate(tomorrow, today) === true, 'future exit → active');
assert(isEmployeeActiveOnDate(today, today) === false, 'exit today → inactive');
assert(isEmployeeActiveOnDate(yesterday, today) === false, 'past exit → inactive');
assert(
  isEmployeeActiveOnDate(yesterday, yesterday) === false,
  'on exit day operation → inactive',
);
assert(
  isEmployeeActiveOnDate(today, yesterday) === true,
  'day before exit → still active',
);

// Date key normalization (no TZ shift for ISO dates)
assert(normalizeEmployeeDateKey('2026-03-15T18:30:00.000Z') === '2026-03-15', 'normalize ISO');
assert(normalizeEmployeeDateKey('2026-03-15') === '2026-03-15', 'normalize plain');

// --- eligibility helpers ---
assert(isEmployeeEligibleForAuth({ dateOfExit: '' }) === true, 'eligible empty');
assert(isEmployeeEligibleForAuth({ dateOfExit: tomorrow }) === true, 'eligible future');
assert(isEmployeeEligibleForAuth({ dateOfExit: today }) === false, 'not eligible today');
assert(isEmployeeEligibleForAuth({ date_of_exit: yesterday }) === false, 'snake_case past');
assert(isEmployeeEligibleForAuth(null) === false, 'null employee not eligible');
assert(getEmployeeExitDate({ dateOfExit: today }) === today, 'get exit camel');
assert(getEmployeeExitDate({ date_of_exit: yesterday }) === yesterday, 'get exit snake');

let threw = false;
try {
  assertEmployeeEligibleForAuth({ dateOfExit: yesterday });
} catch (err) {
  threw = true;
  assert(err.statusCode === 401, 'assert status 401');
  assert(err.code === 'EMPLOYEE_EXITED', 'assert code EMPLOYEE_EXITED');
  assert(String(err.message).includes('employment') || err.message === EMPLOYEE_EXITED_AUTH_MESSAGE, 'assert message');
}
assert(threw, 'assertEmployeeEligibleForAuth must throw for exited');

assertEmployeeEligibleForAuth({ dateOfExit: tomorrow }); // must not throw
assertEmployeeEligibleForAuth({ dateOfExit: '' }); // must not throw

console.log('All employee offboarding unit checks passed.');
