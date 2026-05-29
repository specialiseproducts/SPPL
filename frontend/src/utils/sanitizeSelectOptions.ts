/**
 * Radix Select rejects empty-string item values. Strip nullish / blank values before rendering.
 */
export function sanitizeSelectOptions(values: readonly (string | null | undefined)[]): string[] {
  return values.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/** Dedupe case-insensitively while preserving first trimmed casing. */
export function sanitizeSelectOptionsUnique(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
