/**
 * Ensure PasswordResetOtps DynamoDB table exists (and TTL is enabled).
 * Run: npm run dynamodb:ensure-password-reset-otp-table
 */

import dotenv from 'dotenv';
import { ensurePasswordResetOtpStorage } from '../src/utils/ensurePasswordResetOtpStorage.js';

dotenv.config();

ensurePasswordResetOtpStorage({ log: console.log })
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err?.message || err);
    process.exit(1);
  });
