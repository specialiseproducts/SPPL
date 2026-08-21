/**
 * Planning Recognition schedulers:
 * - Morning validation: 11:05 AM IST — min 7 hours warning
 * - Evening review: 5:35 PM IST — pending completion reminder
 * - Daily: 8:00 PM IST — finalize day + refresh monthly summary
 * - Monthly: 12:05 AM IST on the 1st — finalize previous month
 */

import cron from 'node-cron';
import log from '../utils/logger.js';
import {
  runDailyPlanningRecognitionJob,
  runMonthlyPlanningFinalizationJob,
  runMorningMinimumTasksValidationJob,
  runEveningTaskReviewValidationJob,
} from '../services/planningRecognitionBatch.service.js';
import { IST_OFFSET_MS } from '../utils/planningRecognition.js';

const MORNING_VALIDATION_CRON = '5 11 * * *';
const EVENING_REVIEW_CRON = '35 17 * * *';
const DAILY_CRON_EXPRESSION = '0 20 * * *';
const MONTHLY_CRON_EXPRESSION = '5 0 1 * *';
const TIMEZONE = 'Asia/Kolkata';
const DAILY_SCHEDULED_HOUR_IST = 20;
const MONTHLY_SCHEDULED_HOUR_IST = 0;
const MONTHLY_SCHEDULED_MINUTE_IST = 5;

let morningTask = null;
let eveningTask = null;
let dailyTask = null;
let monthlyTask = null;
let dailyCatchUpInProgress = false;
let monthlyCatchUpInProgress = false;

function isSchedulerEnabled() {
  return (
    String(process.env.PLANNING_RECOGNITION_SCHEDULER_ENABLED || 'true').trim().toLowerCase() !==
    'false'
  );
}

function isPrimarySchedulerProcess() {
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance === undefined || instance === null || instance === '') return true;
  return String(instance) === '0';
}

function getIstParts(reference = new Date()) {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  return {
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
    day: ist.getUTCDate(),
  };
}

function isPastTodaysDailyRunTime(reference = new Date()) {
  const { hour, minute } = getIstParts(reference);
  return hour > DAILY_SCHEDULED_HOUR_IST || (hour === DAILY_SCHEDULED_HOUR_IST && minute >= 0);
}

function isPastTodaysMonthlyRunTime(reference = new Date()) {
  const { day, hour, minute } = getIstParts(reference);
  if (day !== 1) return false;
  return (
    hour > MONTHLY_SCHEDULED_HOUR_IST ||
    (hour === MONTHLY_SCHEDULED_HOUR_IST && minute >= MONTHLY_SCHEDULED_MINUTE_IST)
  );
}

function isPastMorningValidation(reference = new Date()) {
  const { hour, minute } = getIstParts(reference);
  return hour > 11 || (hour === 11 && minute >= 5);
}

function runDailyCatchUpIfNeeded(reason) {
  if (!isPastTodaysDailyRunTime()) {
    log.info('Planning recognition daily catch-up skipped — before 8:00 PM IST', { reason });
    return;
  }
  if (dailyCatchUpInProgress) {
    log.warn('Planning recognition daily catch-up skipped — already in progress', { reason });
    return;
  }

  dailyCatchUpInProgress = true;
  log.info('Planning recognition daily catch-up — running scheduled job', { reason });

  runDailyPlanningRecognitionJob()
    .then((result) => {
      log.info('Planning recognition daily catch-up completed', result);
    })
    .catch((err) => {
      log.error('Planning recognition daily catch-up failed', {
        reason,
        error: err?.message || err,
        stack: err?.stack,
      });
    })
    .finally(() => {
      dailyCatchUpInProgress = false;
    });
}

function runMonthlyCatchUpIfNeeded(reason) {
  if (!isPastTodaysMonthlyRunTime()) {
    log.info('Planning recognition monthly catch-up skipped — not 1st after 12:05 AM IST', {
      reason,
    });
    return;
  }
  if (monthlyCatchUpInProgress) {
    log.warn('Planning recognition monthly catch-up skipped — already in progress', { reason });
    return;
  }

  monthlyCatchUpInProgress = true;
  log.info('Planning recognition monthly catch-up — running scheduled job', { reason });

  runMonthlyPlanningFinalizationJob()
    .then((result) => {
      log.info('Planning recognition monthly catch-up completed', result);
    })
    .catch((err) => {
      log.error('Planning recognition monthly catch-up failed', {
        reason,
        error: err?.message || err,
        stack: err?.stack,
      });
    })
    .finally(() => {
      monthlyCatchUpInProgress = false;
    });
}

function runMorningCatchUpIfNeeded(reason) {
  if (!isPastMorningValidation()) return;
  log.info('Planning recognition morning validation catch-up', { reason });
  runMorningMinimumTasksValidationJob().catch((err) => {
    log.error('Planning recognition morning validation catch-up failed', {
      reason,
      error: err?.message || err,
    });
  });
}

export function initPlanningRecognitionScheduler() {
  if (dailyTask || monthlyTask || morningTask || eveningTask) {
    return { dailyTask, monthlyTask, morningTask, eveningTask };
  }

  if (!isSchedulerEnabled()) {
    log.info('Planning recognition scheduler disabled (PLANNING_RECOGNITION_SCHEDULER_ENABLED=false)');
    return null;
  }

  if (!isPrimarySchedulerProcess()) {
    log.info('Planning recognition scheduler skipped on non-primary process instance', {
      nodeAppInstance: process.env.NODE_APP_INSTANCE,
    });
    return null;
  }

  if (
    !cron.validate(DAILY_CRON_EXPRESSION) ||
    !cron.validate(MONTHLY_CRON_EXPRESSION) ||
    !cron.validate(MORNING_VALIDATION_CRON) ||
    !cron.validate(EVENING_REVIEW_CRON)
  ) {
    log.error('Invalid planning recognition scheduler cron expression');
    return null;
  }

  morningTask = cron.schedule(
    MORNING_VALIDATION_CRON,
    () => {
      log.info('Planning recognition morning validation tick');
      runMorningMinimumTasksValidationJob().catch((err) => {
        log.error('Planning recognition morning validation failed', {
          error: err?.message || err,
          stack: err?.stack,
        });
      });
    },
    { timezone: TIMEZONE, name: 'planning-recognition-morning-validation', noOverlap: true },
  );

  eveningTask = cron.schedule(
    EVENING_REVIEW_CRON,
    () => {
      log.info('Planning recognition evening review tick');
      runEveningTaskReviewValidationJob().catch((err) => {
        log.error('Planning recognition evening review failed', {
          error: err?.message || err,
          stack: err?.stack,
        });
      });
    },
    { timezone: TIMEZONE, name: 'planning-recognition-evening-review', noOverlap: true },
  );

  dailyTask = cron.schedule(
    DAILY_CRON_EXPRESSION,
    () => {
      log.info('Planning recognition daily scheduler tick');
      runDailyPlanningRecognitionJob()
        .then(() => runEveningTaskReviewValidationJob())
        .catch((err) => {
          log.error('Planning recognition daily scheduler run failed', {
            error: err?.message || err,
            stack: err?.stack,
          });
        });
    },
    {
      timezone: TIMEZONE,
      name: 'planning-recognition-daily',
      noOverlap: true,
    },
  );

  monthlyTask = cron.schedule(
    MONTHLY_CRON_EXPRESSION,
    () => {
      log.info('Planning recognition monthly scheduler tick');
      runMonthlyPlanningFinalizationJob().catch((err) => {
        log.error('Planning recognition monthly scheduler run failed', {
          error: err?.message || err,
          stack: err?.stack,
        });
      });
    },
    {
      timezone: TIMEZONE,
      name: 'planning-recognition-monthly',
      noOverlap: true,
    },
  );

  dailyTask.on('execution:missed', () => {
    log.warn('Planning recognition daily scheduler missed a scheduled execution');
    runDailyCatchUpIfNeeded('missed-execution');
  });

  monthlyTask.on('execution:missed', () => {
    log.warn('Planning recognition monthly scheduler missed a scheduled execution');
    runMonthlyCatchUpIfNeeded('missed-execution');
  });

  log.info('Planning recognition schedulers started', {
    morning: `${MORNING_VALIDATION_CRON} ${TIMEZONE}`,
    evening: `${EVENING_REVIEW_CRON} ${TIMEZONE}`,
    daily: `${DAILY_CRON_EXPRESSION} ${TIMEZONE}`,
    monthly: `${MONTHLY_CRON_EXPRESSION} ${TIMEZONE}`,
  });

  runMorningCatchUpIfNeeded('startup');
  runDailyCatchUpIfNeeded('startup');
  runMonthlyCatchUpIfNeeded('startup');

  return { dailyTask, monthlyTask, morningTask, eveningTask };
}

export function stopPlanningRecognitionScheduler() {
  if (morningTask) {
    morningTask.stop();
    morningTask = null;
  }
  if (eveningTask) {
    eveningTask.stop();
    eveningTask = null;
  }
  if (dailyTask) {
    dailyTask.stop();
    dailyTask = null;
  }
  if (monthlyTask) {
    monthlyTask.stop();
    monthlyTask = null;
  }
  log.info('Planning recognition schedulers stopped');
}
