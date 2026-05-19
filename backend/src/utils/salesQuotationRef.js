/**
 * Indian financial year label (April–March) as YY-YY, e.g. 26-27 for FY 2026-04-01 .. 2027-03-31.
 * @param {Date} [date]
 * @returns {string}
 */
export function indianFinancialYearLabel(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const fyStartYear = m >= 3 ? y : y - 1;
  const a = fyStartYear % 100;
  const b = (fyStartYear + 1) % 100;
  return `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
}

/**
 * @param {string} fyLabel e.g. 26-27
 * @param {string} middle e.g. ___ or IND
 * @param {number} serial
 */
export function buildQuotationRef(fyLabel, middle, serial) {
  const padded = String(Math.max(0, Number(serial) || 0)).padStart(3, '0');
  return `SP2L/${fyLabel}/${middle}/${padded}`;
}

export function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}
