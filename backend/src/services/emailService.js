/**
 * Amazon SES SMTP email service — single transporter, graceful failure handling.
 */

import nodemailer from 'nodemailer';
import log from '../utils/logger.js';

let transporter = null;
let initAttempted = false;
let verifyPromise = null;

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, user, pass };
}

/** SES SMTP user is an IAM username — use verified sender email as FROM when needed. */
function getFromAddress() {
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  if (smtpFrom) return smtpFrom;

  const smtpUser = String(process.env.SMTP_USER || '').trim();
  if (smtpUser.includes('@')) return smtpUser;

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (adminEmail) return adminEmail;

  return smtpUser;
}

function createTransporterInstance() {
  const config = getSmtpConfig();
  if (!config) {
    log.warn('Email service: SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
    return null;
  }

  try {
    const tx = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    log.info('Email service: SMTP transporter initialized');
    return tx;
  } catch (err) {
    log.error('Email service: failed to initialize transporter', {
      error: err?.message || err,
      stack: err?.stack,
    });
    return null;
  }
}

function getTransporter() {
  if (transporter) return transporter;
  if (initAttempted) return null;

  initAttempted = true;
  transporter = createTransporterInstance();
  return transporter;
}

/**
 * Verify SMTP credentials at startup.
 */
export async function initEmailService() {
  if (verifyPromise) return verifyPromise;

  verifyPromise = (async () => {
    const tx = getTransporter();
    if (!tx) {
      log.error('SMTP verification failed — transporter not available');
      return false;
    }

    try {
      await tx.verify();
      log.info('SMTP verified successfully', { from: getFromAddress() });
      return true;
    } catch (err) {
      log.error('SMTP verification failed', {
        error: err?.message || err,
        stack: err?.stack,
      });
      return false;
    }
  })();

  return verifyPromise;
}

/** Collapse 3+ consecutive newlines to a single paragraph break; trim trailing whitespace. */
function normalizeEmailText(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/**
 * Send an email. Returns { ok: true } or { ok: false, error } — never throws.
 * Optional `from` overrides the default sender (used by password-reset OTP mail).
 */
export async function sendEmail({ to, subject, text, html, from: fromOverride }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    log.error('Email send aborted — no recipients');
    return { ok: false, error: 'No recipients' };
  }

  const tx = getTransporter();
  if (!tx) {
    log.error('Email send aborted — SMTP not configured');
    return { ok: false, error: 'SMTP not configured' };
  }

  const from = String(fromOverride || '').trim() || getFromAddress();

  log.info('Attempting email send', {
    FROM: from,
    TO: recipients.join(', '),
    SUBJECT: String(subject || '').trim(),
  });

  const normalizedText = normalizeEmailText(text);

  try {
    await tx.sendMail({
      from,
      to: recipients.join(', '),
      subject: String(subject || '').trim(),
      text: normalizedText,
      html: html || undefined,
    });
    log.info('Email sent successfully', { TO: recipients.join(', '), SUBJECT: String(subject || '').trim() });
    return { ok: true };
  } catch (err) {
    log.error('Email send failed — full SMTP error', {
      TO: recipients.join(', '),
      SUBJECT: String(subject || '').trim(),
      error: err?.message || err,
      stack: err?.stack,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
    });
    return { ok: false, error: err?.message || String(err) };
  }
}

export function getAdminEmail() {
  return String(process.env.ADMIN_EMAIL || '').trim();
}
