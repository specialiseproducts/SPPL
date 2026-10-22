/**
 * Factory Daily Planner project observations.
 * PK: projectKey (lowercase trimmed name, same normalization as DailyPlannerProjects)
 * SK: observationId
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import log from '../utils/logger.js';

const TABLE_NAME =
  TABLES.DAILY_PLANNER_PROJECT_OBSERVATIONS || 'DailyPlannerProjectObservations';

function isTableMissingError(err) {
  if (!err) return false;
  if (err.code === 'ResourceNotFoundException') {
    const msg = String(err.message || '');
    return !/specified index|Index not found|does not have the specified index/i.test(msg);
  }
  const msg = String(err.message || '');
  return (
    msg.includes('Requested resource not found') ||
    msg.includes('Cannot do operations on a non-existent table')
  );
}

export function normalizeProjectKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    projectKey: String(row.projectKey || '').trim(),
    projectName: String(row.projectName || row.displayName || '').trim(),
    observationId: String(row.observationId || '').trim(),
    observationText: String(row.observationText || ''),
    employeeCode: String(row.employeeCode || '').trim(),
    employeeName: String(row.employeeName || '').trim(),
    plannerTaskId: String(row.plannerTaskId || '').trim(),
    submittedAt: row.submittedAt || row.createdAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function storageMissingError() {
  const missing = new Error(
    'Daily Planner Project Observations storage is not provisioned. Create table DailyPlannerProjectObservations with PK projectKey and SK observationId.',
  );
  missing.statusCode = 503;
  return missing;
}

/**
 * Create or replace an observation row (idempotent by projectKey + observationId).
 */
export async function putObservation({
  projectName,
  observationId,
  observationText,
  employeeCode,
  employeeName,
  plannerTaskId,
  submittedAt,
}) {
  const displayName = String(projectName || '').trim();
  const projectKey = normalizeProjectKey(displayName);
  const obsId = String(observationId || '').trim();
  const text = String(observationText || '').trim();
  if (!projectKey) {
    const err = new Error('Project Name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!obsId) {
    const err = new Error('observationId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!text) {
    const err = new Error('Observation text is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  try {
    const existing = await dynamoDB
      .get({ TableName: TABLE_NAME, Key: { projectKey, observationId: obsId } })
      .promise();
    const prev = existing.Item && !existing.Item.is_deleted ? existing.Item : null;

    const item = {
      projectKey,
      observationId: obsId,
      projectName: displayName,
      displayName,
      observationText: text,
      employeeCode: String(employeeCode || prev?.employeeCode || '').trim(),
      employeeName: String(employeeName || prev?.employeeName || '').trim(),
      plannerTaskId: String(plannerTaskId || prev?.plannerTaskId || '').trim(),
      submittedAt: submittedAt || prev?.submittedAt || now,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      is_deleted: false,
    };
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
    return toDto(item);
  } catch (err) {
    if (isTableMissingError(err)) throw storageMissingError();
    throw err;
  }
}

/**
 * Patch an existing observation (used for pending-edit text updates).
 * Allowed patch fields: observationText, employeeName.
 */
export async function updateObservation(projectKey, observationId, patch = {}) {
  const key = normalizeProjectKey(projectKey);
  const obsId = String(observationId || '').trim();
  if (!key || !obsId) {
    const err = new Error('projectKey and observationId are required');
    err.statusCode = 400;
    throw err;
  }

  const names = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': new Date().toISOString(), ':f': false };
  const sets = ['#updatedAt = :updatedAt'];

  if (patch.observationText !== undefined) {
    const text = String(patch.observationText || '').trim();
    if (!text) {
      const err = new Error('Observation text is required');
      err.statusCode = 400;
      throw err;
    }
    names['#observationText'] = 'observationText';
    values[':observationText'] = text;
    sets.push('#observationText = :observationText');
  }
  if (patch.employeeName !== undefined) {
    names['#employeeName'] = 'employeeName';
    values[':employeeName'] = String(patch.employeeName || '').trim();
    sets.push('#employeeName = :employeeName');
  }

  try {
    const result = await dynamoDB
      .update({
        TableName: TABLE_NAME,
        Key: { projectKey: key, observationId: obsId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression:
          'attribute_exists(projectKey) AND (attribute_not_exists(is_deleted) OR is_deleted = :f)',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
      .promise();
    return toDto(result.Attributes);
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      const notFound = new Error('Observation not found');
      notFound.statusCode = 404;
      throw notFound;
    }
    if (isTableMissingError(err)) throw storageMissingError();
    throw err;
  }
}

export async function listByProjectKey(projectKey) {
  const key = normalizeProjectKey(projectKey);
  if (!key) return [];
  try {
    const items = [];
    let lastKey;
    do {
      const result = await dynamoDB
        .query({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'projectKey = :pk',
          FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
          ExpressionAttributeValues: { ':pk': key, ':f': false },
          ExclusiveStartKey: lastKey,
        })
        .promise();
      for (const row of result.Items || []) {
        const dto = toDto(row);
        if (dto?.observationId) items.push(dto);
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    items.sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
    return items;
  } catch (err) {
    if (isTableMissingError(err)) {
      log.warn('[DynamoDB] DailyPlannerProjectObservations unavailable, returning empty');
      return [];
    }
    throw err;
  }
}

export async function listByProjectName(projectName) {
  return listByProjectKey(normalizeProjectKey(projectName));
}
