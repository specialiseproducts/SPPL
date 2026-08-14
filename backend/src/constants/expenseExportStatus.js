/**
 * Expense export tracking statuses (My Expenses → Export Data).
 */

export const EXPENSE_EXPORT_STATUS = {
  PENDING: 'Pending Export',
  EXPORTED: 'Exported',
  SKIPPED: 'Skipped',
};

export const EXPENSE_EXPORT_STATUSES = Object.values(EXPENSE_EXPORT_STATUS);

/** MonthYear stored as MM-YYYY → comparable YYYYMM number. */
export function monthYearSortKey(monthYear) {
  const raw = String(monthYear ?? '').trim();
  const [mm, yyyy] = raw.split('-');
  const m = Number.parseInt(mm, 10);
  const y = Number.parseInt(yyyy, 10);
  if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12) {
    return null;
  }
  return y * 100 + m;
}

export function isMonthYearBefore(candidate, reference) {
  const a = monthYearSortKey(candidate);
  const b = monthYearSortKey(reference);
  if (a == null || b == null) return false;
  return a < b;
}

/**
 * Effective export status for an Approved expense.
 * Legacy approved rows without exportStatus are treated as Pending Export.
 */
export function resolveExportStatus(row) {
  const raw = String(row?.exportStatus ?? '').trim();
  if (raw === EXPENSE_EXPORT_STATUS.EXPORTED) return EXPENSE_EXPORT_STATUS.EXPORTED;
  if (raw === EXPENSE_EXPORT_STATUS.SKIPPED) return EXPENSE_EXPORT_STATUS.SKIPPED;
  if (raw === EXPENSE_EXPORT_STATUS.PENDING) return EXPENSE_EXPORT_STATUS.PENDING;
  return EXPENSE_EXPORT_STATUS.PENDING;
}

export function isApprovedExpense(row) {
  const status = String(row?.auditStatus ?? row?.approval_status ?? '').trim();
  return status === 'Approved';
}
