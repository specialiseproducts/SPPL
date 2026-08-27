/**
 * Public forgot-password APIs (Phase 1 backend).
 * Does not store OTP or passwords in localStorage/sessionStorage.
 */

import { getApiBaseUrl } from '../config/apiBase';

function readDataEnvelope(payload: Record<string, unknown> | null) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data as Record<string, unknown>;
  }
  return payload || {};
}

async function postAuthJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const message =
    (typeof payload?.message === 'string' && payload.message.trim()) ||
    (typeof payload?.error === 'string' && payload.error.trim()) ||
    `Request failed (${res.status})`;

  if (!res.ok || !payload?.success) {
    throw new Error(message);
  }
  return readDataEnvelope(payload);
}

export type RequestOtpResult = {
  success: boolean;
  message: string;
  maskedEmail: string;
  expiresInSeconds: number;
};

export type VerifyOtpResult = {
  success: boolean;
  message: string;
  resetToken: string;
  expiresInSeconds: number;
};

export type ResetPasswordResult = {
  success: boolean;
  message: string;
};

export async function requestPasswordResetOtp(employeeCode: string): Promise<RequestOtpResult> {
  const data = await postAuthJson('/auth/forgot-password/request-otp', {
    employeeCode: String(employeeCode || '').trim(),
  });
  return {
    success: Boolean(data.success ?? true),
    message: String(data.message || 'OTP sent to registered Official Email'),
    maskedEmail: String(data.maskedEmail || ''),
    expiresInSeconds: Number(data.expiresInSeconds) || 180,
  };
}

export async function verifyPasswordResetOtp(
  employeeCode: string,
  otp: string,
): Promise<VerifyOtpResult> {
  const data = await postAuthJson('/auth/forgot-password/verify-otp', {
    employeeCode: String(employeeCode || '').trim(),
    otp: String(otp || '').trim(),
  });
  const resetToken = String(data.resetToken || '').trim();
  if (!resetToken) {
    throw new Error('OTP verification did not return a reset authorization');
  }
  return {
    success: Boolean(data.success ?? true),
    message: String(data.message || 'OTP verified successfully'),
    resetToken,
    expiresInSeconds: Number(data.expiresInSeconds) || 600,
  };
}

export async function resetPasswordWithToken(payload: {
  employeeCode: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ResetPasswordResult> {
  const data = await postAuthJson('/auth/forgot-password/reset-password', {
    employeeCode: String(payload.employeeCode || '').trim(),
    resetToken: String(payload.resetToken || '').trim(),
    newPassword: payload.newPassword,
    confirmPassword: payload.confirmPassword,
  });
  return {
    success: Boolean(data.success ?? true),
    message: String(data.message || 'Password updated successfully'),
  };
}

/** Frontend UX validation — backend remains authoritative. */
export type NewPasswordRequirementId =
  | 'minLength'
  | 'hasUppercase'
  | 'hasLowercase'
  | 'hasNumber'
  | 'hasSpecial';

export type NewPasswordRequirementChecks = Record<NewPasswordRequirementId, boolean>;

/** Same rules as validateNewPasswordClient — use for live requirement indicators. */
export function evaluateNewPasswordRequirements(password: string): NewPasswordRequirementChecks {
  const value = String(password ?? '');
  return {
    minLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasLowercase: /[a-z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };
}

export const NEW_PASSWORD_REQUIREMENT_LABELS: { id: NewPasswordRequirementId; label: string }[] = [
  { id: 'minLength', label: 'At least 8 characters' },
  { id: 'hasUppercase', label: 'At least 1 uppercase letter' },
  { id: 'hasLowercase', label: 'At least 1 lowercase letter' },
  { id: 'hasNumber', label: 'At least 1 number' },
  { id: 'hasSpecial', label: 'At least 1 special character' },
];

export function validateNewPasswordClient(
  newPassword: string,
  confirmPassword: string,
): { ok: true } | { ok: false; message: string } {
  const password = String(newPassword ?? '');
  const confirm = String(confirmPassword ?? '');
  if (!password || !confirm) {
    return { ok: false, message: 'New password and confirm password are required' };
  }
  if (password !== confirm) {
    return { ok: false, message: 'New password and confirm password do not match' };
  }
  const requirements = evaluateNewPasswordRequirements(password);
  if (!requirements.minLength) {
    return { ok: false, message: 'Password must be at least 8 characters' };
  }
  if (!requirements.hasUppercase) {
    return { ok: false, message: 'Password must contain at least 1 uppercase letter' };
  }
  if (!requirements.hasLowercase) {
    return { ok: false, message: 'Password must contain at least 1 lowercase letter' };
  }
  if (!requirements.hasNumber) {
    return { ok: false, message: 'Password must contain at least 1 number' };
  }
  if (!requirements.hasSpecial) {
    return { ok: false, message: 'Password must contain at least 1 special character' };
  }
  return { ok: true };
}

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
