/**
 * Diff helper — only changed fields for Audit Trail old/new values.
 */

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function stableSerialize(v) {
  if (v === undefined) return '__undefined__';
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * @returns {{ oldValues: Record<string, unknown>|null, newValues: Record<string, unknown>|null }}
 */
export function diffChangedFields(before = {}, after = {}, keys) {
  const oldValues = {};
  const newValues = {};
  const fieldKeys =
    Array.isArray(keys) && keys.length
      ? keys
      : [
          ...new Set([
            ...Object.keys(isPlainObject(before) ? before : {}),
            ...Object.keys(isPlainObject(after) ? after : {}),
          ]),
        ];

  for (const key of fieldKeys) {
    const a = before?.[key];
    const b = after?.[key];
    if (stableSerialize(a) === stableSerialize(b)) continue;
    oldValues[key] = a === undefined ? null : a;
    newValues[key] = b === undefined ? null : b;
  }

  const hasOld = Object.keys(oldValues).length > 0;
  const hasNew = Object.keys(newValues).length > 0;
  return {
    oldValues: hasOld ? oldValues : null,
    newValues: hasNew ? newValues : null,
  };
}
