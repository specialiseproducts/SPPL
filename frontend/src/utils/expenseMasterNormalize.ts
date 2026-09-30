/**
 * Expense master dropdown normalization (mirrors backend).
 * Comparison key: trim → lowercase → remove all whitespace.
 */

export function normalizeDropdownValue(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** Human-readable canonical display (never the normalized key). */
export function canonicalizeDisplayValue(value: string): string {
  const collapsed = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!collapsed) return '';
  return collapsed.replace(/\S+/g, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/** Resolve typed input to an existing option display value, or a new canonical display. */
export function resolveMasterDisplayValue(raw: string, options: string[]): string {
  const normalized = normalizeDropdownValue(raw);
  if (!normalized) return '';
  const match = options.find((opt) => normalizeDropdownValue(opt) === normalized);
  if (match) return match;
  return canonicalizeDisplayValue(raw);
}
