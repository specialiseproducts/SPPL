/**
 * Soft notification chime (Phase 4A).
 * Uses Web Audio API — no asset file required.
 * Master flag: VITE_NOTIFICATION_SOUND_ENABLED (default enabled).
 */

export function isNotificationSoundConfigEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const raw = String(env?.VITE_NOTIFICATION_SOUND_ENABLED ?? 'true')
    .trim()
    .toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** Short low-volume two-tone ping. */
export function playNotificationSound(volume = 0.12): void {
  if (!isNotificationSoundConfigEnabled()) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    void ctx.resume();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, Math.min(volume, 0.25)), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    gain.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, now);
    o1.connect(gain);
    o1.start(now);
    o1.stop(now + 0.14);

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1174.66, now + 0.1);
    o2.connect(gain);
    o2.start(now + 0.1);
    o2.stop(now + 0.28);
  } catch {
    /* ignore autoplay / unsupported */
  }
}
