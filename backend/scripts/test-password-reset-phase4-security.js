/**
 * Phase 4 security/unit verification for Forgot Password helpers.
 * Run: npm run test:password-reset-phase4
 */

import assert from 'assert';
import {
  OTP_TTL_MS,
  MAX_OTP_VERIFY_ATTEMPTS,
  generateSecureSixDigitOtp,
  hashOtpValue,
  verifyOtpHash,
  generateResetToken,
  hashResetToken,
  verifyResetTokenHash,
  maskOfficialEmail,
  validateNewPasswordPolicy,
  isPendingOtpStillValid,
} from '../src/utils/passwordReset.js';

assert.strictEqual(OTP_TTL_MS, 180_000);
assert.strictEqual(MAX_OTP_VERIFY_ATTEMPTS, 5);

console.log('=== Phase 4 security unit checks ===');

const masked = maskOfficialEmail('shreyaverma1279@gmail.com');
assert.ok(masked.startsWith('sh'));
assert.ok(masked.includes('@gmail.com'));
assert.ok(!masked.toLowerCase().includes('reyaverma'));
assert.ok(!masked.includes('1279'));
console.log('✓ email masking hides most of local part:', masked);

const otpA = generateSecureSixDigitOtp();
const otpB = generateSecureSixDigitOtp();
const hashA = hashOtpValue(otpA);
assert.notStrictEqual(hashA, otpA);
assert.strictEqual(verifyOtpHash(otpA, hashA), true);
assert.strictEqual(verifyOtpHash(otpB, hashA), false);
console.log('✓ OTP stored/verified via HMAC hash only');

const hashB = hashOtpValue(otpB);
assert.strictEqual(verifyOtpHash(otpA, hashB), false);
assert.strictEqual(verifyOtpHash(otpB, hashB), true);
console.log('✓ old OTP hash invalid after new OTP hash (resend model)');

const now = Date.now();
assert.strictEqual(
  isPendingOtpStillValid({
    status: 'pending',
    otpHash: hashA,
    expiresAt: new Date(now + 60_000).toISOString(),
  }, now),
  true,
);
assert.strictEqual(
  isPendingOtpStillValid({
    status: 'pending',
    otpHash: hashA,
    expiresAt: new Date(now - 1000).toISOString(),
  }, now),
  false,
);
assert.strictEqual(
  isPendingOtpStillValid({
    status: 'invalidated',
    otpHash: hashA,
    expiresAt: new Date(now + 60_000).toISOString(),
  }, now),
  false,
);
console.log('✓ pending OTP validity helper (server resend gate)');

const token = generateResetToken();
const tokenHash = hashResetToken(token);
assert.strictEqual(verifyResetTokenHash(token, tokenHash), true);
assert.strictEqual(verifyResetTokenHash('forged', tokenHash), false);
console.log('✓ reset token hash verification');

assert.strictEqual(validateNewPasswordPolicy('Ab1!', 'Ab1!').ok, false);
assert.strictEqual(validateNewPasswordPolicy('abcdef1!', 'abcdef1!').ok, false);
assert.strictEqual(validateNewPasswordPolicy('ABCDEF1!', 'ABCDEF1!').ok, false);
assert.strictEqual(validateNewPasswordPolicy('Abcdefg!', 'Abcdefg!').ok, false);
assert.strictEqual(validateNewPasswordPolicy('Abcdef12', 'Abcdef12').ok, false);
assert.strictEqual(validateNewPasswordPolicy('Password@123', 'Password@456').ok, false);
assert.strictEqual(validateNewPasswordPolicy('Password@123', 'Password@123').ok, true);
console.log('✓ password policy matrix');

console.log('\nPhase 4 unit security checks passed.');
