/**
 * Date helpers for sales quotation notification scheduling (IST calendar days).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Current calendar date in IST as YYYY-MM-DD. */
export function todayIstDateKey(reference = new Date()) {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month || parsed.getUTCDate() !== day) {
    return null;
  }
  return parsed;
}

export function dateKeyFromDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addCalendarDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calendarDayDiff(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Build 15-day follow-up intervals between quotation date and decision expected by (inclusive).
 * Each interval: { startKey, endKey } as YYYY-MM-DD strings.
 */
export function buildFollowUpIntervals(quotationDateKey, decisionExpectedByKey) {
  const start = parseDateKey(quotationDateKey);
  const end = parseDateKey(decisionExpectedByKey);
  if (!start || !end || start > end) return [];

  const intervals = [];
  let cursor = start;

  while (cursor <= end) {
    let intervalEnd = addCalendarDays(cursor, 14);
    if (intervalEnd > end) intervalEnd = end;
    intervals.push({
      startKey: dateKeyFromDate(cursor),
      endKey: dateKeyFromDate(intervalEnd),
    });
    cursor = addCalendarDays(intervalEnd, 1);
  }

  return intervals;
}

/** True when timestamp falls on a calendar day within [startKey, endKey] inclusive. */
export function timestampInDateRange(isoTimestamp, startKey, endKey) {
  if (!isoTimestamp) return false;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return false;
  const key = todayIstDateKey(d);
  return key >= startKey && key <= endKey;
}

export function formatDisplayDate(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return String(dateKey || '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getUTCDate();
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${String(day).padStart(2, '0')}-${mon}-${year}`;
}
