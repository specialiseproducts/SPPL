/**
 * Unit tests for password-reset helpers (no network / no DynamoDB required).
 * Run: node scripts/test-password-reset-phase1.js
 */

import assert from 'assert';
import {
  OTP_LENGTH,
  OTP_TTL_MS,
  generateSecureSixDigitOtp,
  hashOtpValue,
  verifyOtpHash,
  generateResetToken,
  hashResetToken,
  verifyResetTokenHash,
  maskOfficialEmail,
  isValidEmailFormat,
  validateNewPasswordPolicy,
} from '../src/utils/passwordReset.js';

function assertFail(policy, includes) {
  assert.strictEqual(policy.ok, false);
  assert.ok(String(policy.message).toLowerCase().includes(String(includes).toLowerCase()));
}

console.log('=== Password Reset Phase 1 unit tests ===');

// OTP generation
const otps = new Set();
for (let i = 0; i < 50; i++) {
  const otp = generateSecureSixDigitOtp();
  assert.strictEqual(otp.length, OTP_LENGTH);
  assert.ok(/^\d{6}$/.test(otp));
  otps.add(otp);
}
assert.ok(otps.size > 1, 'OTPs should vary');
console.log('✓ secure 6-digit OTP generation');

// OTP hashing
const sample = '123456';
const hash = hashOtpValue(sample);
assert.ok(hash && hash !== sample);
assert.strictEqual(verifyOtpHash(sample, hash), true);
assert.strictEqual(verifyOtpHash('000000', hash), false);
assert.strictEqual(verifyOtpHash('123456', hashOtpValue('654321')), false);
console.log('✓ OTP hash verify (no plaintext equality)');

// Reset token
const token = generateResetToken();
assert.ok(token.length >= 32);
const tokenHash = hashResetToken(token);
assert.strictEqual(verifyResetTokenHash(token, tokenHash), true);
assert.strictEqual(verifyResetTokenHash('nope', tokenHash), false);
console.log('✓ reset token hash verify');

// Email mask / format
assert.strictEqual(maskOfficialEmail('Shreyaverma1279@gmail.com').startsWith('Sh'), true);
assert.ok(maskOfficialEmail('Shreyaverma1279@gmail.com').includes('@gmail.com'));
assert.ok(!maskOfficialEmail('Shreyaverma1279@gmail.com').toLowerCase().includes('reyaverma'));
assert.strictEqual(isValidEmailFormat('a@b.com'), true);
assert.strictEqual(isValidEmailFormat('bad'), false);
console.log('✓ email mask + format');

// Password policy
assert.strictEqual(validateNewPasswordPolicy('Abcdef1!', 'Abcdef1!').ok, true);
assertFail(validateNewPasswordPolicy('Ab1!', 'Ab1!'), '8');
assertFail(validateNewPasswordPolicy('abcdef1!', 'abcdef1!'), 'uppercase');
assertFail(validateNewPasswordPolicy('ABCDEF1!', 'ABCDEF1!'), 'lowercase');
assertFail(validateNewPasswordPolicy('Abcdefg!', 'Abcdefg!'), 'number');
assertFail(validateNewPasswordPolicy('Abcdef12', 'Abcdef12'), 'special');
assertFail(validateNewPasswordPolicy('Abcdef1!', 'Abcdef1?'), 'match');
console.log('✓ password policy rules');

assert.strictEqual(OTP_TTL_MS, 3 * 60 * 1000);
console.log('✓ OTP TTL is exactly 3 minutes');

console.log('\nAll Phase 1 unit tests passed.');
