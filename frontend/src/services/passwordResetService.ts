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

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
