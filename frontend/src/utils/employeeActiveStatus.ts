/**
 * Employee lifecycle eligibility for NEW/CURRENT operations.
 * Must stay aligned with backend/src/utils/employeeActiveStatus.js
 *
 * Date of Exit filled → former employee from that calendar date onward.
 * Do not use this to hide historical records.
 */

/** Normalize to YYYY-MM-DD without timezone shift. */
export function normalizeEmployeeDateKey(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [ys, ms, ds] = iso.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return '';
  }
  return iso;
}

/** Today as YYYY-MM-DD in local calendar (UI selectors). */
export function todayLocalDateKey(reference = new Date()): string {
  const y = reference.getFullYear();
  const m = String(reference.getMonth() + 1).padStart(2, '0');
  const d = String(reference.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * True if the employee may participate in NEW/CURRENT work on operationDate.
 * Empty exit → active. operationDate >= exit → not active.
 */
export function isEmployeeActiveOnDate(
  dateOfExit?: string | null,
  operationDate?: string | null,
): boolean {
  const exit = normalizeEmployeeDateKey(dateOfExit);
  if (!exit) return true;
  const op = normalizeEmployeeDateKey(operationDate) || todayLocalDateKey();
  if (!op) return true;
  return op < exit;
}

/** True if employee was active on any day of the given calendar month. */
export function isEmployeeActiveDuringMonth(
  dateOfExit: string | null | undefined,
  year: number,
  month: number,
): boolean {
  const exit = normalizeEmployeeDateKey(dateOfExit);
  if (!exit) return true;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return isEmployeeActiveOnDate(dateOfExit, todayLocalDateKey());
  }
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  return exit > monthStart;
}

export function getEmployeeExitDate(emp: {
  dateOfExit?: string | null;
  date_of_exit?: string | null;
} | null | undefined): string {
  if (!emp) return '';
  return normalizeEmployeeDateKey(emp.dateOfExit || emp.date_of_exit || '');
}
