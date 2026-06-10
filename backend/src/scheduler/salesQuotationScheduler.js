/**
 * Daily scheduler for sales quotation email notifications at 10:00 AM IST.
 */

import cron from 'node-cron';
import log from '../utils/logger.js';
import { runScheduledQuotationEmails } from '../services/salesQuotationNotificationService.js';

const CRON_EXPRESSION = '0 10 * * *';
const TIMEZONE = 'Asia/Kolkata';

let scheduledTask = null;

export function initSalesQuotationScheduler() {
  if (scheduledTask) return scheduledTask;

  if (!cron.validate(CRON_EXPRESSION)) {
    log.error('Invalid sales quotation scheduler cron expression');
    return null;
  }

  scheduledTask = cron.schedule(
    CRON_EXPRESSION,
    () => {
      runScheduledQuotationEmails().catch((err) => {
        log.error('Sales quotation scheduler run failed', err?.message || err);
      });
    },
    {
      timezone: TIMEZONE,
      scheduled: true,
    }
  );

  log.info(`Sales quotation email scheduler started (${CRON_EXPRESSION} ${TIMEZONE})`);
  return scheduledTask;
}
