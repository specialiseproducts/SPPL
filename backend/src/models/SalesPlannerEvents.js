/**
 * Sales Planner events — visit / follow-up calendar entries.
 * Table schema: partition key eventId (String), no sort key.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.SALES_PLANNER_EVENTS;

function logPlannerDynamo(operation, params) {
  console.log({
    operation,
    table: params?.TableName || TABLE_NAME,
    key: params?.Key,
    updateExpression: params?.UpdateExpression,
    keyConditionExpression: params?.KeyConditionExpression,
    filterExpression: params?.FilterExpression,
  });
}

function toDateOnly(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toPlannerEventDto(row) {
  if (!row || row.is_deleted) return null;
  const visitDate = toDateOnly(row.visitDate);
  const organizationName = String(row.organizationName || row.customerOrganization || '').trim();
  const organizationAddress = String(row.organizationAddress || row.address || '').trim();
  const contactTitle = String(row.contactTitle || row.title || '').trim();
  const contactFullName = String(row.contactFullName || row.fullName || '').trim();
  const contactAddress = String(row.contactAddress || row.address || '').trim();
  const contactNumber = String(row.contactNumber || row.phoneNumber || '').trim();
  const contactEmail = String(row.contactEmail || row.email || '').trim();
  const visitReport = String(row.visitReport || row.report || '').trim();
  const notVisitedReason = String(row.notVisitedReason || row.reason || '').trim();
  const nextAction = String(row.nextAction || '').trim();
  const newVisitDate = toDateOnly(row.newVisitDate || '');
  return {
    eventId: String(row.eventId || '').trim(),
    ownerEmployeeCode: String(row.ownerEmployeeCode || '').trim(),
    ownerEmployeeName: String(row.ownerEmployeeName || '').trim(),
    visitDate,
    organizationId: String(row.organizationId || '').trim(),
    organizationName,
    customerOrganization: organizationName,
    organizationAddress,
    modeOfMeeting: String(row.modeOfMeeting || row.meetingMode || '').trim(),
    contactTitle,
    title: contactTitle,
    contactFullName,
    fullName: contactFullName,
    contactAddress,
    address: contactAddress,
    contactNumber,
    phoneNumber: contactNumber,
    contactEmail,
    email: contactEmail,
    purpose: String(row.purpose || '').trim(),
    status: String(row.status || 'Planned').trim(),
    notVisitedReason,
    reason: notVisitedReason,
    visitReport,
    report: visitReport,
    nextAction,
    newVisitDate,
    parentEventId: row.parentEventId ? String(row.parentEventId).trim() : null,
    linkedForecastId: row.linkedForecastId ? String(row.linkedForecastId).trim() : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const getPlannerEventById = async (eventId) => {
  const id = String(eventId || '').trim();
  if (!id) return null;

  const params = {
    TableName: TABLE_NAME,
    Key: { eventId: id },
  };
  logPlannerDynamo('get', params);

  const result = await dynamoDB.get(params).promise();
  return toPlannerEventDto(result.Item);
};

export const listPlannerEventsForMonth = async (
  ownerEmployeeCode,
  year,
  month,
  startDate,
  endDate,
) => {
  let items = [];
  let lastKey;
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression:
        '(attribute_not_exists(is_deleted) OR is_deleted = :f) AND ownerEmployeeCode = :owner',
      ExpressionAttributeValues: {
        ':f': false,
        ':owner': String(ownerEmployeeCode || '').trim(),
      },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };
    logPlannerDynamo('scan', params);

    const result = await dynamoDB.scan(params).promise();
    items = items.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const rows = items
    .map(toPlannerEventDto)
    .filter(Boolean)
    .filter((row) => {
      if (!row.visitDate) return false;
      if (startDate && row.visitDate < startDate) return false;
      if (endDate && row.visitDate > endDate) return false;
      return true;
    })
    .sort((a, b) => {
      const d = a.visitDate.localeCompare(b.visitDate);
      if (d !== 0) return d;
      return (a.contactFullName || '').localeCompare(b.contactFullName || '', undefined, {
        sensitivity: 'base',
      });
    });

  log.info('Planner month scan complete', {
    ownerEmployeeCode: String(ownerEmployeeCode || '').trim(),
    startDate: startDate || '',
    endDate: endDate || '',
    scannedCount: items.length,
    matchedCount: rows.length,
  });
  return rows;
};

export const createPlannerEvent = async (payload) => {
  const ownerEmployeeCode = String(payload.ownerEmployeeCode || '').trim();
  const visitDate = toDateOnly(payload.visitDate);
  if (!ownerEmployeeCode || !visitDate) {
    const err = new Error('ownerEmployeeCode and visitDate are required');
    err.statusCode = 400;
    throw err;
  }

  const eventId = uuidv4();
  const now = new Date().toISOString();

  const item = {
    eventId,
    ownerEmployeeCode,
    ownerEmployeeName: String(payload.ownerEmployeeName || '').trim(),
    visitDate,
    organizationId: String(payload.organizationId || '').trim(),
    organizationName: String(payload.organizationName || payload.customerOrganization || '').trim(),
    customerOrganization: String(payload.organizationName || payload.customerOrganization || '').trim(),
    organizationAddress: String(payload.organizationAddress || payload.address || '').trim(),
    modeOfMeeting: String(payload.modeOfMeeting || payload.meetingMode || '').trim(),
    contactTitle: String(payload.contactTitle || payload.title || '').trim(),
    title: String(payload.contactTitle || payload.title || '').trim(),
    contactFullName: String(payload.contactFullName || payload.fullName || '').trim(),
    fullName: String(payload.contactFullName || payload.fullName || '').trim(),
    contactAddress: String(payload.contactAddress || payload.address || '').trim(),
    address: String(payload.contactAddress || payload.address || '').trim(),
    contactNumber: String(payload.contactNumber || payload.phoneNumber || '').trim(),
    phoneNumber: String(payload.contactNumber || payload.phoneNumber || '').trim(),
    contactEmail: String(payload.contactEmail || payload.email || '').trim(),
    email: String(payload.contactEmail || payload.email || '').trim(),
    purpose: String(payload.purpose || '').trim(),
    status: String(payload.status || 'Planned').trim(),
    notVisitedReason: String(payload.notVisitedReason || '').trim(),
    reason: String(payload.notVisitedReason || payload.reason || '').trim(),
    visitReport: String(payload.visitReport || '').trim(),
    report: String(payload.visitReport || payload.report || '').trim(),
    nextAction: String(payload.nextAction || '').trim(),
    newVisitDate: toDateOnly(payload.newVisitDate || ''),
    parentEventId: payload.parentEventId ? String(payload.parentEventId).trim() : null,
    linkedForecastId: payload.linkedForecastId ? String(payload.linkedForecastId).trim() : null,
    createdAt: now,
    updatedAt: now,
    is_deleted: false,
  };

  const params = { TableName: TABLE_NAME, Item: item };
  logPlannerDynamo('put', params);
  await dynamoDB.put(params).promise();
  return toPlannerEventDto(item);
};

export const updatePlannerEvent = async (eventId, patch) => {
  const id = String(eventId || '').trim();
  if (!id) {
    const err = new Error('eventId is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await getPlannerEventById(id);
  if (!existing) {
    const err = new Error('Planner event not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const updates = {
    ...patch,
    updatedAt: now,
  };

  if (patch.visitDate !== undefined) {
    updates.visitDate = toDateOnly(patch.visitDate);
  }
  if (patch.newVisitDate !== undefined) {
    updates.newVisitDate = toDateOnly(patch.newVisitDate);
  }
  if (patch.notVisitedReason !== undefined) {
    const reason = String(patch.notVisitedReason || '').trim();
    updates.notVisitedReason = reason;
    updates.reason = reason;
  }
  if (patch.visitReport !== undefined) {
    const report = String(patch.visitReport || '').trim();
    updates.visitReport = report;
    updates.report = report;
  }
  if (patch.contactTitle !== undefined) {
    const title = String(patch.contactTitle || '').trim();
    updates.contactTitle = title;
    updates.title = title;
  }
  if (patch.contactFullName !== undefined) {
    const fullName = String(patch.contactFullName || '').trim();
    updates.contactFullName = fullName;
    updates.fullName = fullName;
  }
  if (patch.organizationName !== undefined) {
    const orgName = String(patch.organizationName || '').trim();
    updates.organizationName = orgName;
    updates.customerOrganization = orgName;
  }

  const entries = Object.entries(updates).filter(
    ([key, value]) => key !== 'eventId' && value !== undefined,
  );
  if (entries.length === 0) {
    return existing;
  }

  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const setExpressions = [];

  entries.forEach(([key, value], index) => {
    const keyToken = `#k${index}`;
    const valueToken = `:v${index}`;
    expressionAttributeNames[keyToken] = key;
    expressionAttributeValues[valueToken] = value;
    setExpressions.push(`${keyToken} = ${valueToken}`);
  });

  const params = {
    TableName: TABLE_NAME,
    Key: { eventId: id },
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };
  logPlannerDynamo('update', params);

  const result = await dynamoDB.update(params).promise();
  return toPlannerEventDto(result.Attributes);
};

export const deletePlannerEvent = async (eventId) => {
  const id = String(eventId || '').trim();
  if (!id) {
    const err = new Error('eventId is required');
    err.statusCode = 400;
    throw err;
  }

  const params = {
    TableName: TABLE_NAME,
    Key: { eventId: id },
  };
  logPlannerDynamo('delete', params);
  await dynamoDB.delete(params).promise();
};
