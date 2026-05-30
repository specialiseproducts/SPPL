/** Matches backend `normalizeToken` used for principal map `sk` / model `principalId`. */
export function principalNameToId(principalName: string): string {
  return String(principalName || '').trim().toLowerCase();
}
