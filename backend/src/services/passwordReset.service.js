/**
 * Forgot-password / OTP password-reset service (Phase 1 backend).
 * Does not alter the existing login or admin reset-password flows.
 */

import * as EmployeeModel from '../models/EmployeeMaster.js';
import * as PasswordResetOtpsModel from '../models/PasswordResetOtps.js';
import { sendEmail } from './emailService.js';
import { hashPassword } from '../utils/password.js';
import { logActivity } from '../utils/activityLogger.js';
import log from '../utils/logger.js';
import {
  OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
  MAX_OTP_VERIFY_ATTEMPTS,
  generateSecureSixDigitOtp,
  hashOtpValue,
  verifyOtpHash,
  generateResetToken,
  hashResetToken,
  verifyResetTokenHash,
  maskOfficialEmail,
  isValidEmailFormat,
  validateNewPasswordPolicy,
  getPasswordResetFromAddress,
  toEpochSeconds,
  isPendingOtpStillValid,
} from '../utils/passwordReset.js';

function httpError(message, statusCode = 400, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function resolveEmployeeCode(payload) {
  // Never trust client-provided destination email — Official Email is resolved server-side only.
  return String(payload?.employeeCode || payload?.employeeId || '').trim();
}

async function invalidateResetCycle(employeeCode, email, meta = {}) {
  const now = Date.now();
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode,
    email: email || '',
    otpHash: null,
    status: 'invalidated',
    createdAt: meta.createdAt || new Date(now).toISOString(),
    expiresAt: new Date(now).toISOString(),
    verifiedAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    attemptCount: Number(meta.attemptCount) || 0,
    ttl: toEpochSeconds(now + 60 * 60 * 1000),
    lastError: meta.lastError || 'INVALIDATED',
  });
}

function buildOtpEmailBody(otp) {
  return [
    'Your password reset OTP is:',
    '',
    String(otp),
    '',
    'This OTP will expire in 3 minutes.',
    '',
    'If you did not request a password reset, you can ignore this email.',
  ].join('\n');
}

/**
 * Request or resend a password-reset OTP.
 * Always invalidates any previously active OTP for the employee.
 */
export async function requestPasswordResetOtp(payload) {
  const employeeCode = resolveEmployeeCode(payload);
  if (!employeeCode) {
    throw httpError('Employee ID is required', 400, 'EMPLOYEE_ID_REQUIRED');
  }

  const employee = await EmployeeModel.getEmployeeByCode(employeeCode);
  if (!employee) {
    throw httpError('Employee ID not found', 404, 'EMPLOYEE_NOT_FOUND');
  }

  const officialEmail = String(employee.officialEmail || '').trim();
  if (!officialEmail) {
    throw httpError(
      'No Official Email is registered for this Employee ID',
      400,
      'OFFICIAL_EMAIL_MISSING',
    );
  }
  if (!isValidEmailFormat(officialEmail)) {
    throw httpError('Registered Official Email is invalid', 400, 'OFFICIAL_EMAIL_INVALID');
  }

  // Server-side: block resend/request while a pending OTP is still within its 3-minute window.
  // Frontend also disables Resend until expiry; this prevents API abuse / email spam.
  const existing = await PasswordResetOtpsModel.getByEmployeeCode(employeeCode);
  if (isPendingOtpStillValid(existing)) {
    throw httpError(
      'An OTP was already sent. Please wait until it expires before requesting a new one.',
      429,
      'OTP_STILL_ACTIVE',
    );
  }

  const otp = generateSecureSixDigitOtp();
  const now = Date.now();
  const expiresAtMs = now + OTP_TTL_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const createdAt = new Date(now).toISOString();

  // Persist hashed OTP before sending email (invalidates prior cycle via put).
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode,
    email: officialEmail,
    otpHash: hashOtpValue(otp),
    status: 'pending',
    createdAt,
    expiresAt,
    verifiedAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    attemptCount: 0,
    // DynamoDB TTL cleanup (app still enforces expiry independently)
    ttl: toEpochSeconds(expiresAtMs + 24 * 60 * 60 * 1000),
  });

  const sendResult = await sendEmail({
    to: officialEmail,
    from: getPasswordResetFromAddress(),
    subject: 'Password Reset OTP',
    text: buildOtpEmailBody(otp),
  });

  if (!sendResult?.ok) {
    // Invalidate stored OTP if email failed so a stale code cannot be used.
    await invalidateResetCycle(employeeCode, officialEmail, {
      createdAt,
      lastError: 'EMAIL_SEND_FAILED',
    });
    throw httpError(
      'Unable to send OTP email. Please try again later.',
      502,
      'OTP_EMAIL_SEND_FAILED',
    );
  }

  log.info('Password reset OTP sent', {
    employeeCode,
    maskedEmail: maskOfficialEmail(officialEmail),
    expiresAt,
  });

  return {
    success: true,
    message: 'OTP sent to registered Official Email',
    maskedEmail: maskOfficialEmail(officialEmail),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

/**
 * Verify OTP and issue a short-lived reset token (does not change password).
 */
export async function verifyPasswordResetOtp(payload) {
  const employeeCode = resolveEmployeeCode(payload);
  const otp = String(payload?.otp || '').trim();

  if (!employeeCode) {
    throw httpError('Employee ID is required', 400, 'EMPLOYEE_ID_REQUIRED');
  }
  if (!/^\d{6}$/.test(otp)) {
    throw httpError('OTP must be a 6-digit code', 400, 'OTP_INVALID_FORMAT');
  }

  const record = await PasswordResetOtpsModel.getByEmployeeCode(employeeCode);
  if (!record || !record.otpHash || record.status === 'invalidated') {
    throw httpError('No active password reset OTP found', 400, 'OTP_NOT_FOUND');
  }

  if (record.status === 'consumed') {
    throw httpError('OTP has already been used', 400, 'OTP_ALREADY_USED');
  }

  const now = Date.now();
  const expiresAtMs = Date.parse(String(record.expiresAt || ''));
  if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
    throw httpError('OTP has expired', 400, 'OTP_EXPIRED');
  }

  // After verification, OTP itself is no longer re-usable; only reset token is.
  if (record.status === 'verified') {
    throw httpError(
      'OTP already verified. Use the reset token to set a new password, or request a new OTP.',
      400,
      'OTP_ALREADY_VERIFIED',
    );
  }

  const attempts = Number(record.attemptCount) || 0;
  if (attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    await invalidateResetCycle(employeeCode, record.email, {
      createdAt: record.createdAt,
      attemptCount: attempts,
      lastError: 'OTP_ATTEMPTS_EXCEEDED',
    });
    throw httpError(
      'Too many invalid OTP attempts. Please request a new OTP.',
      429,
      'OTP_ATTEMPTS_EXCEEDED',
    );
  }

  const valid = verifyOtpHash(otp, record.otpHash);
  if (!valid) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await invalidateResetCycle(employeeCode, record.email, {
        createdAt: record.createdAt,
        attemptCount: nextAttempts,
        lastError: 'OTP_ATTEMPTS_EXCEEDED',
      });
      throw httpError(
        'Too many invalid OTP attempts. Please request a new OTP.',
        429,
        'OTP_ATTEMPTS_EXCEEDED',
      );
    }
    await PasswordResetOtpsModel.updateResetRecord(employeeCode, {
      attemptCount: nextAttempts,
    });
    throw httpError('Invalid OTP', 400, 'OTP_INVALID');
  }

  const resetToken = generateResetToken();
  const resetTokenExpiresAt = new Date(now + RESET_TOKEN_TTL_MS).toISOString();

  await PasswordResetOtpsModel.updateResetRecord(employeeCode, {
    status: 'verified',
    verifiedAt: new Date(now).toISOString(),
    resetTokenHash: hashResetToken(resetToken),
    resetTokenExpiresAt,
    // Clear OTP hash so the OTP code cannot be reused after verification.
    otpHash: null,
    attemptCount: attempts,
    ttl: toEpochSeconds(now + RESET_TOKEN_TTL_MS + 24 * 60 * 60 * 1000),
  });

  return {
    success: true,
    message: 'OTP verified successfully',
    resetToken,
    expiresInSeconds: Math.floor(RESET_TOKEN_TTL_MS / 1000),
  };
}

/**
 * Reset password using verified reset token.
 */
export async function resetPasswordWithVerifiedToken(payload) {
  const employeeCode = resolveEmployeeCode(payload);
  const resetToken = String(payload?.resetToken || '').trim();
  const newPassword = payload?.newPassword;
  const confirmPassword = payload?.confirmPassword;

  if (!employeeCode) {
    throw httpError('Employee ID is required', 400, 'EMPLOYEE_ID_REQUIRED');
  }
  if (!resetToken) {
    throw httpError('Reset authorization token is required', 400, 'RESET_TOKEN_REQUIRED');
  }

  const policy = validateNewPasswordPolicy(newPassword, confirmPassword);
  if (!policy.ok) {
    throw httpError(policy.message, 400, 'PASSWORD_POLICY');
  }

  const record = await PasswordResetOtpsModel.getByEmployeeCode(employeeCode);
  if (!record || record.status !== 'verified' || !record.resetTokenHash) {
    throw httpError(
      'Password reset is not authorized. Verify OTP first.',
      403,
      'RESET_NOT_AUTHORIZED',
    );
  }

  const tokenExpiresMs = Date.parse(String(record.resetTokenExpiresAt || ''));
  if (!Number.isFinite(tokenExpiresMs) || Date.now() > tokenExpiresMs) {
    throw httpError('Password reset authorization has expired. Request a new OTP.', 400, 'RESET_TOKEN_EXPIRED');
  }

  if (!verifyResetTokenHash(resetToken, record.resetTokenHash)) {
    throw httpError('Invalid password reset authorization', 403, 'RESET_TOKEN_INVALID');
  }

  const employee = await EmployeeModel.getEmployeeByCode(employeeCode);
  if (!employee?.employeeId) {
    throw httpError('Employee ID not found', 404, 'EMPLOYEE_NOT_FOUND');
  }

  // Use the same password persistence strategy as the current login system.
  const storedPassword = await hashPassword(String(newPassword));
  const passwordPatch = { password: storedPassword };
  if (String(employee.temporaryPassword || '').trim()) {
    passwordPatch.temporaryPassword = storedPassword;
  }
  if (String(employee.plainPassword || '').trim()) {
    passwordPatch.plainPassword = storedPassword;
  }
  await EmployeeModel.updateEmployee(employee.employeeId, passwordPatch);

  // Consume reset authorization completely.
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode,
    email: record.email || employee.officialEmail || '',
    otpHash: null,
    status: 'consumed',
    createdAt: record.createdAt || new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    verifiedAt: record.verifiedAt || null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    attemptCount: Number(record.attemptCount) || 0,
    consumedAt: new Date().toISOString(),
    ttl: toEpochSeconds(Date.now() + 60 * 60 * 1000),
  });

  await logActivity({
    actorEmployeeCode: employeeCode,
    actorName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    actorRole: 'User',
    module: 'auth',
    actionType: 'PASSWORD_RESET_OTP',
    targetEntity: 'employee',
    targetId: employee.employeeId,
  });

  log.info('Password reset via OTP completed', { employeeCode });

  return {
    success: true,
    message: 'Password updated successfully. You can now log in with your new password.',
  };
}
