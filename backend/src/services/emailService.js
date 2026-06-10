/**
 * Amazon SES SMTP email service — single transporter, graceful failure handling.
 */

import nodemailer from 'nodemailer';
import log from '../utils/logger.js';

let transporter = null;
let initAttempted = false;

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

function getTransporter() {
  if (transporter) return transporter;
  if (initAttempted) return null;

  initAttempted = true;
  const config = getSmtpConfig();
  if (!config) {
    log.warn('Email service: SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    log.info('Email service: SMTP transporter initialized');
  } catch (err) {
    log.error('Email service: failed to initialize transporter', err?.message || err);
    transporter = null;
  }

  return transporter;
}

/**
 * Send an email. Returns { ok: true } or { ok: false, error } — never throws.
 */
export async function sendEmail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients' };
  }

  const tx = getTransporter();
  if (!tx) {
    return { ok: false, error: 'SMTP not configured' };
  }

  const from = String(process.env.SMTP_USER || '').trim();

  try {
    await tx.sendMail({
      from,
      to: recipients.join(', '),
      subject: String(subject || '').trim(),
      text: String(text || ''),
      html: html || undefined,
    });
    return { ok: true };
  } catch (err) {
    log.error('Email send failed', { to: recipients, subject, error: err?.message || err });
    return { ok: false, error: err?.message || String(err) };
  }
}

export function getAdminEmail() {
  return String(process.env.ADMIN_EMAIL || '').trim();
}
