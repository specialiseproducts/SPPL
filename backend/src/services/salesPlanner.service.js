/**
 * Sales Planner — visit events, follow-ups, quotation automation.
 */

import * as SalesPlannerEventsModel from '../models/SalesPlannerEvents.js';
import * as SalesMasterDataModel from '../models/SalesMasterData.js';
import * as SalesForecastService from './salesForecast.service.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import log from '../utils/logger.js';
import {
  assertRegularPlanningAllowedOnDate,
  COMPANY_HOLIDAY_MESSAGE,
} from '../utils/companyWorkingDays.js';

const MEETING_MODES = ['Physical Visit', 'Phone Call', 'Video Call', 'Email'];
const STATUSES = ['Planned', 'Visited', 'Not Visited', 'Quotation Created', 'Rescheduled'];

function isDynamoInfraError(error) {
  const code = String(error?.code || error?.name || '');
  return (
    code === 'ResourceNotFoundException' ||
    code === 'AccessDeniedException' ||
    code === 'UnrecognizedClientException' ||
    code === 'CredentialsError' ||
    code === 'UnknownEndpoint'
  );
}

function toSafePlannerError(error, userMessage) {
  if (error?.statusCode && error.statusCode < 500) return error;
  if (!isDynamoInfraError(error)) return error;
  log.error('Planner DynamoDB operation failed', {
    message: error?.message || error,
    code: error?.code || error?.name || '',
  });
  const safe = new Error(userMessage);
  safe.statusCode = 500;
  return safe;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseMonthQuery(year, month) {
  const yRaw = String(year ?? '').trim();
  const mRaw = String(month ?? '').trim();
  if (!yRaw || !mRaw) {
    const err = new Error('year and month query parameters are required');
    err.statusCode = 400;
    throw err;
  }
  if (!/^\d+$/.test(yRaw) || !/^\d+$/.test(mRaw)) {
    const err = new Error('year and month must be integers');
    err.statusCode = 400;
    throw err;
  }
  const y = Number.parseInt(yRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isInteger(y) || y < 1900 || y > 9999) {
    const err = new Error('year must be a valid integer');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    const err = new Error('month must be an integer between 1 and 12');
    err.statusCode = 400;
    throw err;
  }
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { year: y, month: m, startDate, endDate };
}

function assertOwner(event, authUser) {
  const owner = String(event.ownerEmployeeCode || '').trim();
  const code = String(authUser?.employeeCode || '').trim();
  if (!owner || !code || owner !== code) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

function validateCreateBlock(block) {
  const orgName = String(block.organizationName || '').trim();
  const mode = String(block.modeOfMeeting || '').trim();
  const contactName = String(block.contactFullName || '').trim();
  const purpose = String(block.purpose || '').trim();
  if (!orgName) {
    const err = new Error('Customer organization is required');
    err.statusCode = 400;
    throw err;
  }
  if (!MEETING_MODES.includes(mode)) {
    const err = new Error('Invalid mode of meeting');
    err.statusCode = 400;
    throw err;
  }
  if (!contactName) {
    const err = new Error('Contact full name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!purpose) {
    const err = new Error('Purpose is required');
    err.statusCode = 400;
    throw err;
  }
}

export const listActiveOrganizations = async () => {
  try {
    const rows = await SalesMasterDataModel.listOrganizationMap({ activeOnly: true });
    return { organizations: rows };
  } catch (error) {
    throw toSafePlannerError(error, 'Unable to load planner organizations. Please try again.');
  }
};

export const listPlannerMonth = async (authUser, year, month, employeeCodeParam, effectiveRole) => {
  const requesterEmployeeCode = String(authUser?.employeeCode || authUser?.id || '').trim();
  if (!requesterEmployeeCode) {
    const err = new Error('Employee code required');
    err.statusCode = 400;
    throw err;
  }

  const requestedEmployeeCode = String(employeeCodeParam || '').trim();
  let ownerEmployeeCode = requesterEmployeeCode;
  if (requestedEmployeeCode && requestedEmployeeCode !== requesterEmployeeCode) {
    if (!canAccessAllRecords(effectiveRole)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    ownerEmployeeCode = requestedEmployeeCode;
  }
  let parsed;
  try {
    parsed = parseMonthQuery(year, month);
  } catch (error) {
    log.warn('Planner listMonth validation failed', {
      year,
      month,
      ownerEmployeeCode,
      message: error?.message || error,
    });
    throw error;
  }
  log.info('Planner listMonth date range', {
    ownerEmployeeCode,
    year: parsed.year,
    month: parsed.month,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  });
  try {
    const events = await SalesPlannerEventsModel.listPlannerEventsForMonth(
      ownerEmployeeCode,
      parsed.year,
      parsed.month,
      parsed.startDate,
      parsed.endDate
    );
    log.info('Planner listMonth items returned', {
      ownerEmployeeCode,
      year: parsed.year,
      month: parsed.month,
      count: events.length,
    });
    return { events, year: parsed.year, month: parsed.month };
  } catch (error) {
    throw toSafePlannerError(error, 'Unable to load planner events. Please try again.');
  }
};

export const getPlannerEvent = async (eventId, authUser) => {
  let event;
  try {
    event = await SalesPlannerEventsModel.getPlannerEventById(eventId);
    if (!event) {
      const err = new Error('Planner event not found');
      err.statusCode = 404;
      throw err;
    }
  } catch (error) {
    throw toSafePlannerError(error, 'Unable to load planner event. Please try again.');
  }
  assertOwner(event, authUser);
  return event;
};

export const createPlannerEvents = async (body, authUser) => {
  const visitDate = String(body.visitDate || '').trim();
  const blocks = Array.isArray(body.events) ? body.events : [];
  if (!visitDate) {
    const err = new Error('visitDate is required');
    err.statusCode = 400;
    throw err;
  }
  if (blocks.length === 0) {
    const err = new Error('At least one event is required');
    err.statusCode = 400;
    throw err;
  }

  try {
    assertRegularPlanningAllowedOnDate(visitDate);
  } catch (err) {
    const holidayErr = new Error(err?.message || COMPANY_HOLIDAY_MESSAGE);
    holidayErr.statusCode = 400;
    throw holidayErr;
  }

  const ownerEmployeeCode = String(authUser?.employeeCode || '').trim();
  const ownerEmployeeName = String(
    authUser?.fullName || `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim()
  ).trim();

  const created = [];
  try {
    for (const block of blocks) {
      validateCreateBlock(block);
      const row = await SalesPlannerEventsModel.createPlannerEvent({
        ownerEmployeeCode,
        ownerEmployeeName,
        visitDate,
        organizationId: block.organizationId,
        organizationName: block.organizationName,
        organizationAddress: block.organizationAddress || block.contactAddress,
        modeOfMeeting: block.modeOfMeeting,
        contactTitle: block.contactTitle,
        contactFullName: block.contactFullName,
        contactAddress: block.contactAddress,
        contactNumber: block.contactNumber,
        contactEmail: block.contactEmail,
        purpose: block.purpose,
        status: 'Planned',
      });
      created.push(row);
    }
  } catch (error) {
    throw toSafePlannerError(error, 'Unable to save Planner event. Please try again.');
  }

  log.info('Created planner events', { count: created.length, visitDate, ownerEmployeeCode });
  return { events: created };
};

export const updatePlannerEventVisit = async (eventId, body, authUser, effectiveRole) => {
  let existing;
  try {
    existing = await getPlannerEvent(eventId, authUser);
  } catch (error) {
    throw toSafePlannerError(error, 'Unable to load planner event. Please try again.');
  }
  const outcome = String(body.outcome || '').trim();

  if (outcome === 'not_visited') {
    const reason = String(body.notVisitedReason || '').trim();
    if (!reason) {
      const err = new Error('Reason is required when visit did not happen');
      err.statusCode = 400;
      throw err;
    }
    try {
      const updated = await SalesPlannerEventsModel.updatePlannerEvent(eventId, {
        status: 'Not Visited',
        notVisitedReason: reason,
        nextAction: '',
        newVisitDate: '',
      });
      return { event: updated };
    } catch (error) {
      throw toSafePlannerError(error, 'Unable to update Planner event. Please try again.');
    }
  }

  if (outcome === 'visited') {
    const report = String(body.visitReport || '').trim();
    const nextAction = String(body.nextAction || '').trim();
    if (!report) {
      const err = new Error('Visit report is required');
      err.statusCode = 400;
      throw err;
    }
    if (nextAction !== 'quotation' && nextAction !== 'next_visit') {
      const err = new Error('Next action is required');
      err.statusCode = 400;
      throw err;
    }

    if (nextAction === 'next_visit') {
      const newVisitDate = String(body.newVisitDate || '').trim();
      if (!newVisitDate) {
        const err = new Error('New visit date is required');
        err.statusCode = 400;
        throw err;
      }
      try {
        const updated = await SalesPlannerEventsModel.updatePlannerEvent(eventId, {
          status: 'Rescheduled',
          visitReport: report,
          nextAction: 'next_visit',
          newVisitDate,
        });
        const followUp = await SalesPlannerEventsModel.createPlannerEvent({
          ownerEmployeeCode: existing.ownerEmployeeCode,
          ownerEmployeeName: existing.ownerEmployeeName,
          visitDate: newVisitDate,
          organizationId: existing.organizationId,
          organizationName: existing.organizationName,
          organizationAddress: existing.organizationAddress,
          modeOfMeeting: existing.modeOfMeeting,
          contactTitle: existing.contactTitle,
          contactFullName: existing.contactFullName,
          contactAddress: existing.contactAddress,
          contactNumber: existing.contactNumber,
          contactEmail: existing.contactEmail,
          purpose: existing.purpose,
          status: 'Planned',
          parentEventId: existing.eventId,
          nextAction: '',
          newVisitDate: '',
        });
        return { event: updated, followUp, rescheduledFrom: eventId };
      } catch (error) {
        throw toSafePlannerError(error, 'Unable to update Planner event. Please try again.');
      }
    }

    const quotation = await SalesForecastService.createOpportunity(
      {
        mode: 'draft',
        quotationDate: todayIsoDate(),
        customerOrganization: existing.organizationName,
        contactTitle: existing.contactTitle,
        contactFullName: existing.contactFullName,
        contactAddress: existing.contactAddress,
        contactNumber: existing.contactNumber,
        contactEmail: existing.contactEmail,
        applicationDetails: existing.purpose,
        remarks: report ? `Visit report: ${report}` : '',
      },
      authUser,
      effectiveRole
    );

    try {
      const updated = await SalesPlannerEventsModel.updatePlannerEvent(eventId, {
        status: 'Quotation Created',
        visitReport: report,
        nextAction: 'quotation',
        newVisitDate: '',
        linkedForecastId: quotation.forecastId,
      });

      return { event: updated, quotation };
    } catch (error) {
      throw toSafePlannerError(error, 'Unable to update Planner event. Please try again.');
    }
  }

  const err = new Error('Invalid outcome');
  err.statusCode = 400;
  throw err;
};

export { MEETING_MODES, STATUSES };
