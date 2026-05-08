/**
 * Auto-generated login password: First3.Last3@BiometricCode
 * Capitalize first letter of each segment only; trim internal spaces for letter extraction.
 */

function segmentFromPart(raw) {
  const t = String(raw || '').replace(/\s+/g, '');
  if (!t) return '';
  const lower = t.toLowerCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  return cap.slice(0, 3);
}

export function generateEmployeePassword(firstName, lastName, biometricCode) {
  const firstSeg = segmentFromPart(firstName);
  const lastSeg = segmentFromPart(lastName);
  const bio = String(biometricCode ?? '').replace(/\s+/g, '');
  const head = lastSeg ? `${firstSeg}.${lastSeg}` : `${firstSeg}.`;
  return `${head}@${bio}`;
}
