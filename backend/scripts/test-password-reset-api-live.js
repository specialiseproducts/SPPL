/**
 * Optional live integration test for forgot-password APIs.
 *
 * Requires:
 * - Backend running (default http://localhost:3001)
 * - Env TEST_EMPLOYEE_CODE with a real employee that has officialEmail
 * - Env TEST_NEW_PASSWORD meeting policy (optional; if set, runs full reset — USE WITH CARE)
 *
 * Skips SES verification of inbox contents; asserts API responses only.
 *
 * Run:
 *   TEST_EMPLOYEE_CODE=DUMMY node scripts/test-password-reset-api-live.js
 */

import dotenv from 'dotenv';

dotenv.config();

const BASE = String(process.env.TEST_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const CODE = String(process.env.TEST_EMPLOYEE_CODE || '').trim();
const NEW_PASSWORD = String(process.env.TEST_NEW_PASSWORD || '').trim();

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!CODE) {
    console.log('Skipping live API test — set TEST_EMPLOYEE_CODE to run.');
    process.exit(0);
  }

  console.log('Requesting OTP for', CODE);
  const req1 = await post('/api/auth/forgot-password/request-otp', { employeeCode: CODE });
  console.log(req1.status, req1.json);
  if (req1.status !== 200 || !req1.json?.success) {
    throw new Error('request-otp failed');
  }
  if (!req1.json?.data?.maskedEmail) {
    throw new Error('maskedEmail missing');
  }

  const bad = await post('/api/auth/forgot-password/verify-otp', {
    employeeCode: CODE,
    otp: '000000',
  });
  console.log('invalid otp =>', bad.status, bad.json?.message || bad.json);
  if (bad.status === 200) throw new Error('invalid OTP should fail');

  const noAuth = await post('/api/auth/forgot-password/reset-password', {
    employeeCode: CODE,
    resetToken: 'not-a-real-token',
    newPassword: 'Abcdef1!',
    confirmPassword: 'Abcdef1!',
  });
  console.log('reset without verify =>', noAuth.status, noAuth.json?.message || noAuth.json);
  if (noAuth.status === 200) throw new Error('reset without verify must fail');

  if (!NEW_PASSWORD) {
    console.log(
      '\nLive smoke checks passed (request + invalid verify + unauthorized reset).',
    );
    console.log(
      'To complete full reset, set TEST_NEW_PASSWORD and provide a valid OTP from email manually via verify then reset.',
    );
    return;
  }

  console.log('TEST_NEW_PASSWORD set — full automated reset still requires reading OTP from email; skipping auto reset.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
