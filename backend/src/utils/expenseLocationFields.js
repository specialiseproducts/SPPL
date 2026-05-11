import { EXPENSE_LEGACY_COMBINED_LOCATION_ATTR } from '../constants/expenseLegacy.js';

/**
 * Resolve `location` and `purpose` from a row (API or Dynamo).
 * Prefers explicit `location` / `purpose`; falls back to legacy combined attribute only when needed.
 */
export function resolveLocationFieldsFromRow(row) {
  let location = String(row?.location ?? '').trim();
  let purpose = String(row?.purpose ?? '').trim();
  const legacy = String(row?.[EXPENSE_LEGACY_COMBINED_LOCATION_ATTR] ?? '').trim();
  if (!location && legacy) {
    location = legacy;
  }
  if (!purpose && legacy) {
    purpose = legacy;
  }
  return { location, purpose };
}
