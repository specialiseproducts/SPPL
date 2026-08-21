/**
 * Local DynamoDB lifecycle test for password-reset OTP records
 * (does not send email; does not change employee passwords).
 *
 * Run: node scripts/test-password-reset-dynamodb-lifecycle.js
 */

import dotenv from 'dotenv';
import assert from 'assert';
import * as PasswordResetOtpsModel from '../src/models/PasswordResetOtps.js';
import {
  OTP_TTL_MS,
  hashOtpValue,
  verifyOtpHash,
  generateSecureSixDigitOtp,
  generateResetToken,
  hashResetToken,
  verifyResetTokenHash,
  toEpochSeconds,
} from '../src/utils/passwordReset.js';

dotenv.config();

const CODE = `TEST_OTP_${Date.now()}`;

async function main() {
  console.log('Using synthetic employeeCode:', CODE);

  const otp1 = generateSecureSixDigitOtp();
  const now = Date.now();
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode: CODE,
    email: 'test@example.com',
    otpHash: hashOtpValue(otp1),
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    attemptCount: 0,
    ttl: toEpochSeconds(now + 60 * 60 * 1000),
  });

  let row = await PasswordResetOtpsModel.getByEmployeeCode(CODE);
  assert.ok(row);
  assert.strictEqual(row.status, 'pending');
  assert.strictEqual(verifyOtpHash(otp1, row.otpHash), true);
  console.log('✓ store + verify first OTP');

  // Resend invalidates previous OTP
  const otp2 = generateSecureSixDigitOtp();
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode: CODE,
    email: 'test@example.com',
    otpHash: hashOtpValue(otp2),
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attemptCount: 0,
    ttl: toEpochSeconds(Date.now() + 60 * 60 * 1000),
  });
  row = await PasswordResetOtpsModel.getByEmployeeCode(CODE);
  assert.strictEqual(verifyOtpHash(otp1, row.otpHash), false, 'old OTP must be invalid after resend');
  assert.strictEqual(verifyOtpHash(otp2, row.otpHash), true);
  console.log('✓ resend invalidates previous OTP');

  // Expiry enforcement (application-level)
  await PasswordResetOtpsModel.putResetRecord({
    employeeCode: CODE,
    email: 'test@example.com',
    otpHash: hashOtpValue(otp2),
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    attemptCount: 0,
    ttl: toEpochSeconds(Date.now() + 60 * 60 * 1000),
  });
  row = await PasswordResetOtpsModel.getByEmployeeCode(CODE);
  const expired = Date.now() > Date.parse(row.expiresAt);
  assert.ok(expired);
  console.log('✓ expired OTP detectable by application clock');

  // Verified reset token cycle
  const token = generateResetToken();
  await PasswordResetOtpsModel.updateResetRecord(CODE, {
    status: 'verified',
    otpHash: null,
    resetTokenHash: hashResetToken(token),
    resetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  row = await PasswordResetOtpsModel.getByEmployeeCode(CODE);
  assert.strictEqual(row.status, 'verified');
  assert.ok(!row.otpHash);
  assert.strictEqual(verifyResetTokenHash(token, row.resetTokenHash), true);
  console.log('✓ verified state + reset token');

  await PasswordResetOtpsModel.deleteByEmployeeCode(CODE);
  row = await PasswordResetOtpsModel.getByEmployeeCode(CODE);
  assert.strictEqual(row, null);
  console.log('✓ cleanup');

  console.log('\nDynamoDB lifecycle tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
