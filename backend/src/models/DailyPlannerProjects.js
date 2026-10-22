/**
 * Daily Planner projects — catalog + managed project definitions.
 * PK: projectKey (lowercase trimmed name) — natural uniqueness.
 *
 * Managed projects store projectTasks[] with contribution % and multi-employee
 * assignments. Soft-delete via is_deleted / task status Inactive.
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { GSI_NAMES } from '../config/dynamodbIndexes.js';
import { isGsiMissingError, warnGsiFallback } from '../utils/dynamoGsi.js';
import log from '../utils/logger.js';

const TABLE_NAME = TABLES.DAILY_PLANNER_PROJECTS || 'DailyPlannerProjects';
/** GSI partition value for active managed projects (Query instead of Scan). */
export const MANAGED_LIST_KEY = 'MANAGED';

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

function normalizeProjectTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const status = String(raw.status || 'Active').trim() || 'Active';
  const codes = Array.isArray(raw.assignedEmployeeCodes)
    ? [...new Set(raw.assignedEmployeeCodes.map((c) => String(c || '').trim()).filter(Boolean))]
    : [];
  const contribution = Number(raw.contributionPercent);
  return {
    projectTaskId: String(raw.projectTaskId || '').trim() || uuidv4(),
    taskName: String(raw.taskName || '').trim(),
    contributionPercent: Number.isFinite(contribution) ? contribution : 0,
    assignedEmployeeCodes: codes,
    status: status === 'Inactive' ? 'Inactive' : 'Active',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export const PROJECT_VISIBILITY_VALUES = ['Everyone', 'ProjectTeamOnly', 'OnlyMe'];
export const DEFAULT_PROJECT_VISIBILITY = 'ProjectTeamOnly';

function parseStoredShowInProjectProgress(row) {
  // Explicit false/true on the record.
  if (row?.showInProjectProgress === false || row?.showInProjectProgress === true) {
    return {
      showInProjectProgress: Boolean(row.showInProjectProgress),
      showInProjectProgressImplicit: false,
    };
  }
  const raw = String(row?.showInProjectProgress ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') {
    return { showInProjectProgress: false, showInProjectProgressImplicit: false };
  }
  if (raw === 'true' || raw === '1' || raw === 'yes') {
    return { showInProjectProgress: true, showInProjectProgressImplicit: false };
  }
  // Legacy (attribute missing): keep prior Project Progress listing behavior (show when visible).
  return { showInProjectProgress: true, showInProjectProgressImplicit: true };
}

function toDto(row) {
  if (!row || row.is_deleted) return null;
  const projectTasks = Array.isArray(row.projectTasks)
    ? row.projectTasks.map(normalizeProjectTask).filter((t) => t && t.taskName)
    : [];
  const rawVisibility = String(row.visibility || '').trim();
  const visibilityExplicit = PROJECT_VISIBILITY_VALUES.includes(rawVisibility);
  const progressFlag = parseStoredShowInProjectProgress(row);
  return {
    projectKey: String(row.projectKey || '').trim(),
    projectName: String(row.displayName || row.projectName || '').trim(),
    managed: Boolean(row.managed),
    status: String(row.status || 'Active').trim() || 'Active',
    // Missing attribute (pre-visibility records) is treated as ProjectTeamOnly.
    visibility: visibilityExplicit ? rawVisibility : DEFAULT_PROJECT_VISIBILITY,
    // True when the record has no stored visibility (legacy); lets services keep legacy admin access.
    visibilityImplicit: !visibilityExplicit,
    showInProjectProgress: progressFlag.showInProjectProgress,
    showInProjectProgressImplicit: progressFlag.showInProjectProgressImplicit,
    projectTasks,
    createdBy: String(row.createdBy || '').trim(),
    createdByName: String(row.createdByName || '').trim(),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

async function scanAllProjects() {
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
  return items;
}

export async function listProjects() {
  try {
    const items = await scanAllProjects();
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

/**
 * Active managed projects only.
 * Prefers GSI_ManagedList Query; falls back to Scan when the GSI is missing or empty
 * (legacy rows may lack managedListKey until rewritten).
 */
export async function listManagedProjects() {
  try {
    const items = [];
    let lastKey;
    let usedGsi = true;
    try {
      do {
        const result = await dynamoDB
          .query({
            TableName: TABLE_NAME,
            IndexName: GSI_NAMES.DAILY_PLANNER_PROJECTS_MANAGED,
            KeyConditionExpression: 'managedListKey = :mk',
            ExpressionAttributeValues: { ':mk': MANAGED_LIST_KEY },
            ExclusiveStartKey: lastKey,
          })
          .promise();
        for (const row of result.Items || []) {
          const dto = toDto(row);
          if (dto?.managed && dto.status !== 'Inactive' && dto.projectName) {
            items.push(dto);
          }
        }
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
    } catch (err) {
      if (!isGsiMissingError(err)) throw err;
      warnGsiFallback('DailyPlannerProjects.listManagedProjects', err);
      usedGsi = false;
    }

    // GSI may be empty while legacy managed rows lack managedListKey — scan once as fallback.
    if (!usedGsi || items.length === 0) {
      const scanned = (await scanAllProjects()).filter(
        (p) => p.managed && p.status !== 'Inactive',
      );
      if (!usedGsi || scanned.length > items.length) {
        scanned.sort((a, b) => a.projectName.localeCompare(b.projectName));
        return scanned;
      }
    }

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

export async function getProjectByKey(projectKey) {
  const key = normalizeProjectKey(projectKey);
  if (!key) return null;
  try {
    const result = await dynamoDB.get({ TableName: TABLE_NAME, Key: { projectKey: key } }).promise();
    return toDto(result.Item);
  } catch (err) {
    if (isTableMissingError(err)) return null;
    throw err;
  }
}

export async function getProjectByName(projectName) {
  return getProjectByKey(normalizeProjectKey(projectName));
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
      managed: false,
      status: 'Active',
      projectTasks: [],
      createdBy: String(createdBy || '').trim(),
      createdByName: '',
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

/**
 * Create or fully replace a managed project definition (tasks + assignments).
 */
export async function putManagedProject(payload) {
  const displayName = String(payload.projectName || '').trim();
  const projectKey = normalizeProjectKey(
    payload.projectKey ? payload.projectKey : displayName,
  );
  if (!projectKey || !displayName) {
    const err = new Error('Project Name is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const existing = await getProjectByKey(projectKey);
  const incomingTasks = Array.isArray(payload.projectTasks) ? payload.projectTasks : [];
  const projectTasks = incomingTasks
    .map((t) => {
      const normalized = normalizeProjectTask({
        ...t,
        createdAt: t.createdAt || now,
        updatedAt: now,
      });
      return normalized;
    })
    .filter((t) => t && t.taskName);

  const status =
    String(payload.status || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active';
  const item = {
    projectKey,
    displayName,
    projectName: displayName,
    managed: true,
    status,
    projectTasks,
    createdBy: String(payload.createdBy || existing?.createdBy || '').trim(),
    createdByName: String(payload.createdByName || existing?.createdByName || '').trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    is_deleted: false,
  };
  // Enables GSI_ManagedList Query for active managed projects.
  if (status === 'Active') {
    item.managedListKey = MANAGED_LIST_KEY;
  }
  // Persist only an explicit value; legacy records without one stay without one.
  const visibility = PROJECT_VISIBILITY_VALUES.includes(payload.visibility)
    ? payload.visibility
    : existing && !existing.visibilityImplicit
      ? existing.visibility
      : null;
  if (visibility) item.visibility = visibility;

  // Always persist an explicit boolean for new writes.
  // Create: default false when omitted. Update: keep existing when omitted.
  if (payload.showInProjectProgress === true || payload.showInProjectProgress === false) {
    item.showInProjectProgress = payload.showInProjectProgress;
  } else if (existing && !existing.showInProjectProgressImplicit) {
    item.showInProjectProgress = Boolean(existing.showInProjectProgress);
  } else if (!existing) {
    item.showInProjectProgress = false;
  } else {
    // Legacy update without the field in payload: leave attribute unset (implicit true on read).
  }

  try {
    await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
    return toDto(item);
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

export async function softDeleteProject(projectKey, actorCode) {
  const key = normalizeProjectKey(projectKey);
  if (!key) {
    const err = new Error('projectKey is required');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  try {
    await dynamoDB
      .update({
        TableName: TABLE_NAME,
        Key: { projectKey: key },
        UpdateExpression:
          'SET is_deleted = :t, #st = :inactive, updatedAt = :now, deletedBy = :by REMOVE managedListKey',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':t': true,
          ':inactive': 'Inactive',
          ':now': now,
          ':by': String(actorCode || '').trim(),
        },
      })
      .promise();
    return { success: true, projectKey: key };
  } catch (err) {
    if (isTableMissingError(err)) {
      const missing = new Error('Daily Planner Projects storage is not provisioned');
      missing.statusCode = 503;
      throw missing;
    }
    throw err;
  }
}

export { toDto as projectToDto };
