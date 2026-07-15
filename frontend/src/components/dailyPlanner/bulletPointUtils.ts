/**
 * Bullet-point text helpers for Daily Planner (stored as formatted strings).
 */

/** Split stored text into bullet lines (backward compatible with plain text). */
export function parseBulletPoints(text: string | undefined | null): string[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [''];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*•\s*/, '').trim());

  if (lines.length === 1 && !raw.includes('•') && !raw.includes('\n')) {
    return [lines[0]];
  }

  const points = lines.filter((line) => line.length > 0);
  return points.length > 0 ? points : [''];
}

/** Format bullet points for storage. */
export function formatBulletPoints(points: string[]): string {
  return points
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `• ${p}`)
    .join('\n');
}

/** True if at least one non-empty bullet exists. */
export function hasBulletContent(points: string[]): boolean {
  return points.some((p) => p.trim().length > 0);
}
