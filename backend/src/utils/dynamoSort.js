/**
 * Shared descending sort helpers for list endpoints (newest first).
 */

export function descLocaleCompare(a, b) {
  return String(b ?? '').localeCompare(String(a ?? ''));
}

/**
 * @param {object} a
 * @param {object} b
 * @param {Array<(row: object) => string|number|undefined|null>} getters
 */
export function compareDescFields(a, b, getters) {
  for (const get of getters) {
    const cmp = descLocaleCompare(get(a), get(b));
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/**
 * @param {object[]} items
 * @param {Array<(row: object) => string|number|undefined|null>} getters
 */
export function sortRecordsDesc(items, getters) {
  return [...items].sort((a, b) => compareDescFields(a, b, getters));
}

const expenseCreatedAt = (row) => row.createdAt || row.created_at || '';
const expenseDate = (row) => row.date || row.expenseDate || '';

const salesUpdatedAt = (row) => row.updatedAt || row.updated_at || '';
const salesCreatedAt = (row) => row.createdAt || row.created_at || '';

const employeeCreatedAt = (row) => row.createdAt || row.created_at || '';
const employeeDateOfJoining = (row) => row.dateOfJoining || row.date_of_joining || '';

export function sortExpensesDesc(items) {
  return sortRecordsDesc(items, [expenseCreatedAt, expenseDate]);
}

export function sortSalesForecastsDesc(items) {
  return sortRecordsDesc(items, [salesUpdatedAt, salesCreatedAt]);
}

export function sortEmployeesDesc(items) {
  return sortRecordsDesc(items, [employeeCreatedAt, employeeDateOfJoining]);
}
