/**
 * Expense master dropdown normalization.
 * Comparison key: trim → lowercase → remove all whitespace.
 * Display value: trimmed, collapsed spaces, title-cased words.
 */

export function normalizeDropdownValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** Human-readable canonical display (never the normalized key). */
export function canonicalizeDisplayValue(value) {
  const collapsed = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!collapsed) return '';
  return collapsed.replace(/\S+/g, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}
