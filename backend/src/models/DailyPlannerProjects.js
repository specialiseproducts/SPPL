/**
 * Daily Planner reusable project names.
 * PK: projectKey (lowercase trimmed name) — natural uniqueness.
 */

import { dynamoDB, TABLES } from '../config/dynamodb.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.DAILY_PLANNER_PROJECTS || 'DailyPlannerProjects';

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

function normalizeProjectKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toDto(row) {
  if (!row || row.is_deleted) return null;
  return {
    projectKey: String(row.projectKey || '').trim(),
    projectName: String(row.displayName || row.projectName || '').trim(),
    createdBy: String(row.createdBy || '').trim(),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function listProjects() {
  try {
    const items = [];
    let lastKey;
    do {
      const result = await dynamoDB
        .scan({
          TableName: TABLE_NAME,
          ExclusiveStartKey: lastKey,
          FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :f',
          ExpressionAttributeValues: { ':f': false },
        })
        .promise();
      for (const row of result.Items || []) {
        const dto = toDto(row);
        if (dto?.projectName) items.push(dto);
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    items.sort((a, b) => a.projectName.localeCompare(b.projectName));
    return items;
  } catch (err) {
    if (isTableMissingError(err)) {
      log.warn('[DynamoDB] DailyPlannerProjects unavailable, returning empty');
      return [];
    }
    throw err;
  }
}

export async function upsertProject(projectName, createdBy) {
  const displayName = String(projectName || '').trim();
  const projectKey = normalizeProjectKey(displayName);
  if (!projectKey) {
    const err = new Error('Project Name is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  try {
    const existing = await dynamoDB
      .get({ TableName: TABLE_NAME, Key: { projectKey } })
      .promise();
    if (existing.Item && !existing.Item.is_deleted) {
      return toDto(existing.Item);
    }

    const item = {
      projectKey,
      displayName,
      projectName: displayName,
      createdBy: String(createdBy || '').trim(),
      createdAt: now,
      updatedAt: now,
      is_deleted: false,
    };
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(projectKey)',
      })
      .promise()
      .catch(async (err) => {
        if (err.code === 'ConditionalCheckFailedException') {
          const again = await dynamoDB
            .get({ TableName: TABLE_NAME, Key: { projectKey } })
            .promise();
          return again.Item;
        }
        throw err;
      });

    const saved = await dynamoDB.get({ TableName: TABLE_NAME, Key: { projectKey } }).promise();
    return toDto(saved.Item);
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error(
        'Daily Planner Projects storage is not provisioned. Create table DailyPlannerProjects with PK projectKey.',
      );
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}
