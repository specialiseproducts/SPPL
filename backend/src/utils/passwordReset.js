/**
 * Password-reset helpers: OTP crypto, email masking, password policy.
 * Isolated from the existing login password util (do not change login hashing).
 */

import crypto from 'crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 3 * 60 * 1000;
/** Short-lived authorization after OTP verification (before password is set). */
export const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_VERIFY_ATTEMPTS = 5;

function getOtpPepper() {
  return (
    String(process.env.PASSWORD_RESET_OTP_PEPPER || '').trim() ||
    String(process.env.JWT_SECRET || '').trim() ||
    'dev-password-reset-pepper-change-this'
  );
}

export function generateSecureSixDigitOtp() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(OTP_LENGTH, '0');
}

export function hashOtpValue(otp) {
  return crypto.createHmac('sha256', getOtpPepper()).update(String(otp || '')).digest('hex');
}

export function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyOtpHash(otp, otpHash) {
  if (!otpHash) return false;
  const candidate = hashOtpValue(otp);
  return timingSafeEqualHex(candidate, otpHash);
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashResetToken(token) {
  return crypto.createHmac('sha256', getOtpPepper()).update(String(token || '')).digest('hex');
}

export function verifyResetTokenHash(token, tokenHash) {
  if (!tokenHash) return false;
  return timingSafeEqualHex(hashResetToken(token), tokenHash);
}

export function maskOfficialEmail(email) {
  const value = String(email || '').trim();
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain) return '***';
  // Show at most 2 local characters; mask the rest (e.g. sh************@gmail.com).
  const visibleCount = Math.min(2, local.length);
  const visible = local.slice(0, visibleCount);
  const maskedLen = Math.max(8, Math.max(0, local.length - visibleCount));
  return `${visible}${'*'.repeat(maskedLen)}@${domain}`;
}

export function isValidEmailFormat(email) {
  const value = String(email || '').trim();
  // Practical RFC-lite check used for Official Email gating
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * New password policy for forgot-password reset.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateNewPasswordPolicy(newPassword, confirmPassword) {
  const password = String(newPassword ?? '');
  const confirm = String(confirmPassword ?? '');

  if (!password || !confirm) {
    return { ok: false, message: 'New password and confirm password are required' };
  }
  if (password !== confirm) {
    return { ok: false, message: 'New password and confirm password do not match' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Password must contain at least 1 uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: 'Password must contain at least 1 lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must contain at least 1 number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: 'Password must contain at least 1 special character' };
  }
  return { ok: true };
}

export function getPasswordResetFromAddress() {
  return (
    String(process.env.PASSWORD_RESET_FROM_EMAIL || '').trim() ||
    String(process.env.SMTP_FROM || '').trim() ||
    'mridulverma@specialiseproducts.com'
  );
}

export function isPendingOtpStillValid(record, nowMs = Date.now()) {
  if (!record || record.status !== 'pending' || !record.otpHash) return false;
  const expiresAtMs = Date.parse(String(record.expiresAt || ''));
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs <= expiresAtMs;
}

export function toEpochSeconds(isoOrMs) {
  if (typeof isoOrMs === 'number') {
    return Math.floor(isoOrMs / 1000);
  }
  const ms = Date.parse(String(isoOrMs || ''));
  if (Number.isNaN(ms)) return Math.floor(Date.now() / 1000);
  return Math.floor(ms / 1000);
}
