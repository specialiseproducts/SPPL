import { EXPENSE_LEGACY_COMBINED_LOCATION_ATTR } from '../constants/expenseLegacy.js';

/**
 * Resolve `location` and `purpose` from a row (API or Dynamo).
 * Prefers explicit `location` / `purpose`; falls back to legacy combined attribute only when needed.
 * UI label is "City"; storage/API key remains `location` (never persist a separate `city` attr).
 */
export function resolveLocationFieldsFromRow(row) {
  let location = String(row?.location ?? '').trim();
  if (!location) {
    // Accept transient `city` alias from clients that renamed the UI field.
    location = String(row?.city ?? '').trim();
  }
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

/**
 * Pick city/location from a create/update payload.
 * Order: location → city → legacy locationPurpose.
 */
export function pickLocationFromPayload(raw) {
  const location = String(raw?.location ?? '').trim();
  if (location) return location;
  const city = String(raw?.city ?? '').trim();
  if (city) return city;
  return String(raw?.[EXPENSE_LEGACY_COMBINED_LOCATION_ATTR] ?? '').trim();
}
