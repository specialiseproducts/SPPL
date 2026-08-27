/**
 * Warranty helpers for planner Create Event → Review.
 * Master defaults: "60 days", "90 days", "1 year", "2 years", "3 years"
 * (case-insensitive; also accepts month-based values).
 */

export type WarrantyStatusLabel = 'Within Warranty' | 'Warranty Expired' | 'Unable to determine';

export type ParsedWarrantyDuration = {
  amount: number;
  unit: 'day' | 'month' | 'year';
};

/** Parse YYYY-MM-DD (or ISO datetime) into UTC calendar parts. */
export function parseDateOnlyParts(value: string): { y: number; m: number; d: number } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function formatYmdUtc(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Interpret free-text warranty values used in Sales History / master WARRANTY list.
 * Returns null when the period cannot be parsed.
 */
export function parseWarrantyDuration(warranty: string): ParsedWarrantyDuration | null {
  const s = String(warranty || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const match = s.match(/^(\d+)\s*(days?|months?|years?)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unitToken = match[2];
  const unit: ParsedWarrantyDuration['unit'] = unitToken.startsWith('day')
    ? 'day'
    : unitToken.startsWith('month')
      ? 'month'
      : 'year';
  return { amount, unit };
}

/** Calendar-accurate expiry: Invoice Date + Warranty Period (UTC date-only). */
export function computeWarrantyExpiryDate(
  invoiceDate: string,
  warranty: string,
): string | null {
  const start = parseDateOnlyParts(invoiceDate);
  const duration = parseWarrantyDuration(warranty);
  if (!start || !duration) return null;

  const date = new Date(Date.UTC(start.y, start.m - 1, start.d));
  if (Number.isNaN(date.getTime())) return null;

  if (duration.unit === 'day') {
    date.setUTCDate(date.getUTCDate() + duration.amount);
  } else if (duration.unit === 'month') {
    date.setUTCMonth(date.getUTCMonth() + duration.amount);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + duration.amount);
  }

  return formatYmdUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Event date on or before expiry → Within Warranty.
 * Event date after expiry → Warranty Expired.
 */
export function getWarrantyStatus(
  invoiceDate: string,
  warranty: string,
  eventDate: string,
): WarrantyStatusLabel {
  const event = parseDateOnlyParts(eventDate);
  const expiry = computeWarrantyExpiryDate(invoiceDate, warranty);
  if (!event || !expiry) return 'Unable to determine';
  const eventYmd = formatYmdUtc(event.y, event.m, event.d);
  return eventYmd <= expiry ? 'Within Warranty' : 'Warranty Expired';
}

export function productLabel(row: {
  partNumber?: string;
  itemDescription?: string;
  principal?: string;
}): string {
  const part = String(row.partNumber || '').trim();
  const desc = String(row.itemDescription || '').trim();
  if (part && desc) return `${part} — ${desc}`;
  if (part) return part;
  if (desc) return desc;
  const principal = String(row.principal || '').trim();
  return principal || 'Unnamed product';
}
