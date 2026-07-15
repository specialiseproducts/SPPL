/**
 * Daily scheduler for sales quotation email notifications at 10:00 AM IST.
 */

import cron from 'node-cron';
import log from '../utils/logger.js';
import { runScheduledQuotationEmails } from '../services/salesQuotationNotificationService.js';
import { IST_OFFSET_MS } from '../utils/planningRecognition.js';

const CRON_EXPRESSION = '0 10 * * *';
const TIMEZONE = 'Asia/Kolkata';
const SCHEDULED_HOUR_IST = 10;

let scheduledTask = null;
let catchUpInProgress = false;

function isSchedulerEnabled() {
  return String(process.env.SALES_QUOTATION_SCHEDULER_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function isPrimarySchedulerProcess() {
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance === undefined || instance === null || instance === '') return true;
  return String(instance) === '0';
}

function getIstHourMinute(reference = new Date()) {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  return {
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}

/** True when the server starts after today's 10:00 AM IST scheduled run time. */
function isPastTodaysScheduledRunTime(reference = new Date()) {
  const { hour, minute } = getIstHourMinute(reference);
  return hour > SCHEDULED_HOUR_IST || (hour === SCHEDULED_HOUR_IST && minute >= 0);
}

function runCatchUpIfNeeded(reason) {
  if (!isPastTodaysScheduledRunTime()) {
    log.info('Sales quotation scheduler catch-up skipped — before 10:00 AM IST', { reason });
    return;
  }
  if (catchUpInProgress) {
    log.warn('Sales quotation scheduler catch-up skipped — already in progress', { reason });
    return;
  }

  catchUpInProgress = true;
  log.info('Sales quotation scheduler catch-up — running today scheduled emails', { reason });

  runScheduledQuotationEmails()
    .catch((err) => {
      log.error('Sales quotation scheduler catch-up failed', {
        reason,
        error: err?.message || err,
        stack: err?.stack,
      });
    })
    .finally(() => {
      catchUpInProgress = false;
    });
}

export function initSalesQuotationScheduler() {
  if (scheduledTask) return scheduledTask;

  if (!isSchedulerEnabled()) {
    log.info('Sales quotation email scheduler disabled (SALES_QUOTATION_SCHEDULER_ENABLED=false)');
    return null;
  }

  if (!isPrimarySchedulerProcess()) {
    log.info('Sales quotation email scheduler skipped on non-primary process instance', {
      nodeAppInstance: process.env.NODE_APP_INSTANCE,
    });
    return null;
  }

  if (!cron.validate(CRON_EXPRESSION)) {
    log.error('Invalid sales quotation scheduler cron expression');
    return null;
  }

  scheduledTask = cron.schedule(
    CRON_EXPRESSION,
    () => {
      log.info('Sales quotation scheduler tick — invoking runScheduledQuotationEmails');
      runScheduledQuotationEmails().catch((err) => {
        log.error('Sales quotation scheduler run failed', {
          error: err?.message || err,
          stack: err?.stack,
        });
      });
    },
    {
      timezone: TIMEZONE,
      name: 'sales-quotation-emails',
      noOverlap: true,
    },
  );

  scheduledTask.on('execution:missed', (context) => {
    log.warn('Sales quotation scheduler missed a scheduled execution', {
      missedAt: context?.dateLocalIso || null,
    });
    runCatchUpIfNeeded('missed-execution');
  });

  const nextRun = scheduledTask.getNextRun?.();
  log.info(`Sales quotation email scheduler started (${CRON_EXPRESSION} ${TIMEZONE})`, {
    nextRun: nextRun ? nextRun.toISOString() : null,
    pastTodaysRunTime: isPastTodaysScheduledRunTime(),
  });

  runCatchUpIfNeeded('startup');

  return scheduledTask;
}

export function stopSalesQuotationScheduler() {
  if (!scheduledTask) return;
  scheduledTask.stop();
  scheduledTask = null;
  log.info('Sales quotation email scheduler stopped');
}
