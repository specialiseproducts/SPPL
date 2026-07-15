/**
 * Sales master data — dropdown values, principal map, FX rates, quotation serial counters.
 * PK/SK pattern: pk = MASTER#<CATEGORY>, sk = normalized dedupe key
 * Principal map: pk = MASTER#PRINCIPAL_MAP, sk = normalize(principalName)
 * Counter: pk = INTERNAL, sk = SEQ#SP2L#<fyLabel>
 *
 * List items support optional isActive (default true when missing — backward compatible).
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDB, TABLES } from '../config/dynamodb.js';
import { normalizeToken } from '../utils/salesQuotationRef.js';

const TABLE_NAME = TABLES.SALES_MASTER_DATA;

const MASTER_PK = (category) => `MASTER#${String(category || '').trim().toUpperCase()}`;

const isRowActive = (row) => row?.isActive !== false;

/** Sort master rows for stable admin UI */
function sortByValue(items) {
  return [...items].sort((a, b) =>
    String(a.value || a.principalName || '').localeCompare(String(b.value || b.principalName || ''), undefined, {
      sensitivity: 'base',
    })
  );
}

/**
 * Simple MASTER#CAT rows (value-based).
 * @returns {Promise<Array<{pk:string,sk:string,value:string,isActive:boolean,createdAt?:string}>>}
 */
async function querySimpleMasterRows(category) {
  const pk = MASTER_PK(category);
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  return result.Items || [];
}

/**
 * @param {string} category
 * @param {{ activeOnly?: boolean }} [opts]
 * @returns {Promise<string[]>} display values sorted
 */
export const listMasterValues = async (category, opts = {}) => {
  const activeOnly = opts.activeOnly !== false;
  const cat = String(category || '').trim().toUpperCase();
  if (cat === 'PRINCIPAL') {
    const maps = await queryPrincipalMapRows({ activeOnly });
    if (maps.length) {
      return maps
        .map((m) => String(m.principalName || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    const legacy = await querySimpleMasterRows('PRINCIPAL');
    const filtered = activeOnly ? legacy.filter(isRowActive) : legacy;
    const map = new Map();
    for (const row of filtered) {
      const v = String(row.value || '').trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!map.has(key)) map.set(key, v);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  const rows = await querySimpleMasterRows(cat);
  const filtered = activeOnly ? rows.filter(isRowActive) : rows;
  const map = new Map();
  for (const row of filtered) {
    const v = String(row.value || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!map.has(key)) map.set(key, v);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};

/**
 * Admin: list simple master rows with flags.
 * @returns {Promise<Array<{ sk: string, value: string, isActive: boolean }>>}
 */
export const listSimpleMasterAdmin = async (category) => {
  const cat = String(category || '').trim().toUpperCase();
  if (cat === 'PRINCIPAL' || cat === 'PRINCIPAL_MAP' || cat === 'ORGANIZATION_MAP' || cat === 'EXCHANGE_RATE') {
    return [];
  }
  const rows = sortByValue(await querySimpleMasterRows(cat));
  return rows.map((row) => ({
    sk: String(row.sk || ''),
    value: String(row.value || '').trim(),
    isActive: isRowActive(row),
  }));
};

export const upsertSimpleMasterItem = async (category, value, { isActive = true } = {}) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    const err = new Error('Value is required');
    err.statusCode = 400;
    throw err;
  }
  const pk = MASTER_PK(category);
  const sk = normalizeToken(trimmed);
  if (!sk) {
    const err = new Error('Invalid value');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk,
        value: trimmed,
        isActive: !!isActive,
        updatedAt: now,
        createdAt: now,
      },
    })
    .promise();
  return { sk, value: trimmed, isActive: !!isActive };
};

export const updateSimpleMasterItem = async (category, sk, { value, isActive } = {}) => {
  const pk = MASTER_PK(category);
  const oldSk = String(sk || '').trim().toLowerCase();
  if (!oldSk) {
    const err = new Error('Invalid key');
    err.statusCode = 400;
    throw err;
  }
  const existing = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk: oldSk } }).promise();
  if (!existing.Item) {
    const err = new Error('Master item not found');
    err.statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  const nextValue = value != null ? String(value).trim() : String(existing.Item.value || '').trim();
  const nextActive = isActive !== undefined ? !!isActive : isRowActive(existing.Item);
  const newSk = value != null ? normalizeToken(nextValue) : oldSk;
  if (newSk !== oldSk) {
    await dynamoDB.delete({ TableName: TABLE_NAME, Key: { pk, sk: oldSk } }).promise();
  }
  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk: newSk,
        value: nextValue,
        isActive: nextActive,
        updatedAt: now,
        createdAt: existing.Item.createdAt || now,
      },
    })
    .promise();
  return { sk: newSk, value: nextValue, isActive: nextActive };
};

async function queryPrincipalMapRows({ activeOnly = true } = {}) {
  const pk = MASTER_PK('PRINCIPAL_MAP');
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  let rows = result.Items || [];
  if (activeOnly) rows = rows.filter(isRowActive);
  return sortByValue(rows);
}

export const listPrincipalMap = async (opts = {}) => {
  const rows = await queryPrincipalMapRows({ activeOnly: opts.activeOnly !== false });
  return rows.map((row) => ({
    principalName: String(row.principalName || row.value || '').trim(),
    shortCode: String(row.shortCode || '').trim(),
    isActive: isRowActive(row),
    sk: String(row.sk || ''),
  }));
};

export const listPrincipalMapAdmin = async () => listPrincipalMap({ activeOnly: false });

export const upsertPrincipalMapEntry = async ({ principalName, shortCode, isActive = true, previousSk } = {}) => {
  const name = String(principalName || '').trim();
  const code = String(shortCode || '').trim().toUpperCase();
  if (!name || !code) {
    const err = new Error('Principal name and short code are required');
    err.statusCode = 400;
    throw err;
  }
  const pk = MASTER_PK('PRINCIPAL_MAP');
  const skNew = normalizeToken(name);
  const now = new Date().toISOString();

  if (previousSk && String(previousSk).trim().toLowerCase() !== skNew) {
    await dynamoDB
      .delete({ TableName: TABLE_NAME, Key: { pk, sk: String(previousSk).trim().toLowerCase() } })
      .promise();
  }

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk: skNew,
        principalName: name,
        shortCode: code,
        value: name,
        isActive: !!isActive,
        updatedAt: now,
        createdAt: now,
      },
    })
    .promise();

  return { principalName: name, shortCode: code, isActive: !!isActive, sk: skNew };
};

export const getPrincipalShortCode = async (principalName) => {
  const pk = MASTER_PK('PRINCIPAL_MAP');
  const sk = normalizeToken(principalName);
  if (!sk) return '';
  const got = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
  if (!got.Item || !isRowActive(got.Item)) return '';
  return String(got.Item.shortCode || '').trim();
};

/** Principal-scoped product models — pk MASTER#MODEL#<principalId>, sk modelId (uuid). */
const MODEL_PK = (principalId) => `MASTER#MODEL#${String(principalId || '').trim().toLowerCase()}`;

function toPrincipalModelDto(row) {
  return {
    modelId: String(row.modelId || row.sk || ''),
    principalId: String(row.principalId || '').trim().toLowerCase(),
    principalName: String(row.principalName || '').trim(),
    modelNumber: String(row.modelNumber || '').trim(),
    productDescription: String(row.productDescription || '').trim(),
    isActive: isRowActive(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function queryPrincipalModelRows(principalId) {
  const pk = MODEL_PK(principalId);
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  return result.Items || [];
}

async function getPrincipalMapRowOrThrow(principalId) {
  const pk = MASTER_PK('PRINCIPAL_MAP');
  const sk = String(principalId || '').trim().toLowerCase();
  if (!sk) {
    const err = new Error('principalId is required');
    err.statusCode = 400;
    throw err;
  }
  const got = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
  if (!got.Item) {
    const err = new Error('Principal not found');
    err.statusCode = 404;
    throw err;
  }
  return got.Item;
}

async function findDuplicateModelNumber(principalId, modelNumber, excludeModelId) {
  const norm = normalizeToken(modelNumber);
  if (!norm) return null;
  const rows = await queryPrincipalModelRows(principalId);
  for (const row of rows) {
    const id = String(row.modelId || row.sk || '');
    if (excludeModelId && id === excludeModelId) continue;
    if (normalizeToken(row.modelNumber) === norm) return row;
  }
  return null;
}

/**
 * @param {string} principalId — principal map sk (normalized principal name key)
 * @param {{ activeOnly?: boolean }} [opts]
 */
export const listPrincipalModels = async (principalId, opts = {}) => {
  const activeOnly = opts.activeOnly !== false;
  const principalRow = await getPrincipalMapRowOrThrow(principalId);
  const pid = String(principalId).trim().toLowerCase();
  let rows = await queryPrincipalModelRows(pid);
  if (activeOnly) rows = rows.filter(isRowActive);
  return rows
    .map((row) =>
      toPrincipalModelDto({
        ...row,
        principalId: pid,
        principalName: row.principalName || principalRow.principalName,
      })
    )
    .sort((a, b) =>
      a.modelNumber.localeCompare(b.modelNumber, undefined, { sensitivity: 'base' })
    );
};

export const upsertPrincipalModel = async ({
  principalId,
  principalName,
  modelNumber,
  productDescription,
  isActive = true,
  modelId,
} = {}) => {
  const principalRow = await getPrincipalMapRowOrThrow(principalId);
  const pid = String(principalId).trim().toLowerCase();
  const pName = String(principalName || principalRow.principalName || principalRow.value || '').trim();
  const mNum = String(modelNumber || '').trim();
  const desc = String(productDescription || '').trim();
  if (!mNum || !desc) {
    const err = new Error('Model number and product description are required');
    err.statusCode = 400;
    throw err;
  }

  const pk = MODEL_PK(pid);
  const now = new Date().toISOString();
  let sk = modelId ? String(modelId).trim() : '';
  let createdAt = now;

  if (sk) {
    const existing = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
    if (!existing.Item) {
      const err = new Error('Model not found');
      err.statusCode = 404;
      throw err;
    }
    createdAt = existing.Item.createdAt || now;
    const dup = await findDuplicateModelNumber(pid, mNum, sk);
    if (dup) {
      const err = new Error('Model number already exists for this principal');
      err.statusCode = 409;
      throw err;
    }
  } else {
    const dup = await findDuplicateModelNumber(pid, mNum, null);
    if (dup) {
      const err = new Error('Model number already exists for this principal');
      err.statusCode = 409;
      throw err;
    }
    sk = uuidv4();
  }

  const item = {
    pk,
    sk,
    modelId: sk,
    principalId: pid,
    principalName: pName,
    modelNumber: mNum,
    productDescription: desc,
    isActive: !!isActive,
    createdAt,
    updatedAt: now,
  };

  await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  return toPrincipalModelDto(item);
};

/** Customer organizations — pk MASTER#ORGANIZATION_MAP, sk normalize(organizationName). */
async function queryOrganizationMapRows({ activeOnly = true } = {}) {
  const pk = MASTER_PK('ORGANIZATION_MAP');
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  let rows = result.Items || [];
  if (activeOnly) rows = rows.filter(isRowActive);
  return sortByValue(rows);
}

export const listOrganizationMap = async (opts = {}) => {
  const rows = await queryOrganizationMapRows({ activeOnly: opts.activeOnly !== false });
  return rows.map((row) => ({
    organizationName: String(row.organizationName || row.value || '').trim(),
    address: String(row.address || '').trim(),
    isActive: isRowActive(row),
    sk: String(row.sk || ''),
  }));
};

export const listOrganizationMapAdmin = async () => listOrganizationMap({ activeOnly: false });

export const upsertOrganizationMapEntry = async ({
  organizationName,
  address,
  isActive = true,
  previousSk,
} = {}) => {
  const name = String(organizationName || '').trim();
  const addr = String(address || '').trim();
  if (!name || !addr) {
    const err = new Error('Customer organization and address are required');
    err.statusCode = 400;
    throw err;
  }
  const pk = MASTER_PK('ORGANIZATION_MAP');
  const skNew = normalizeToken(name);
  const now = new Date().toISOString();

  if (previousSk && String(previousSk).trim().toLowerCase() !== skNew) {
    await dynamoDB
      .delete({ TableName: TABLE_NAME, Key: { pk, sk: String(previousSk).trim().toLowerCase() } })
      .promise();
  }

  await dynamoDB
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk: skNew,
        organizationName: name,
        address: addr,
        value: name,
        isActive: !!isActive,
        updatedAt: now,
        createdAt: now,
      },
    })
    .promise();

  return { organizationName: name, address: addr, isActive: !!isActive, sk: skNew };
};

/** Organization-scoped part numbers — pk MASTER#PART#<organizationId>, sk partId (uuid). */
const PART_PK = (organizationId) =>
  `MASTER#PART#${String(organizationId || '').trim().toLowerCase()}`;

function toOrganizationPartDto(row) {
  return {
    partId: String(row.partId || row.sk || ''),
    organizationId: String(row.organizationId || '').trim().toLowerCase(),
    organizationName: String(row.organizationName || '').trim(),
    partNumber: String(row.partNumber || '').trim(),
    itemDescription: String(row.itemDescription || '').trim(),
    isActive: isRowActive(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function queryOrganizationPartRows(organizationId) {
  const pk = PART_PK(organizationId);
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();
  return result.Items || [];
}

async function getOrganizationMapRowOrThrow(organizationId) {
  const pk = MASTER_PK('ORGANIZATION_MAP');
  const sk = String(organizationId || '').trim().toLowerCase();
  if (!sk) {
    const err = new Error('organizationId is required');
    err.statusCode = 400;
    throw err;
  }
  const got = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
  if (!got.Item) {
    const err = new Error('Customer organization not found');
    err.statusCode = 404;
    throw err;
  }
  return got.Item;
}

async function findDuplicatePartNumber(organizationId, partNumber, excludePartId) {
  const norm = normalizeToken(partNumber);
  if (!norm) return null;
  const rows = await queryOrganizationPartRows(organizationId);
  for (const row of rows) {
    const id = String(row.partId || row.sk || '');
    if (excludePartId && id === excludePartId) continue;
    if (normalizeToken(row.partNumber) === norm) return row;
  }
  return null;
}

/**
 * @param {string} organizationId — organization map sk (normalized organization name key)
 * @param {{ activeOnly?: boolean }} [opts]
 */
export const listOrganizationParts = async (organizationId, opts = {}) => {
  const activeOnly = opts.activeOnly !== false;
  const orgRow = await getOrganizationMapRowOrThrow(organizationId);
  const oid = String(organizationId).trim().toLowerCase();
  let rows = await queryOrganizationPartRows(oid);
  if (activeOnly) rows = rows.filter(isRowActive);
  return rows
    .map((row) =>
      toOrganizationPartDto({
        ...row,
        organizationId: oid,
        organizationName: row.organizationName || orgRow.organizationName,
      })
    )
    .sort((a, b) =>
      a.partNumber.localeCompare(b.partNumber, undefined, { sensitivity: 'base' })
    );
};

export const upsertOrganizationPart = async ({
  organizationId,
  organizationName,
  partNumber,
  itemDescription,
  isActive = true,
  partId,
} = {}) => {
  const orgRow = await getOrganizationMapRowOrThrow(organizationId);
  const oid = String(organizationId).trim().toLowerCase();
  const oName = String(
    organizationName || orgRow.organizationName || orgRow.value || ''
  ).trim();
  const pNum = String(partNumber || '').trim();
  const desc = String(itemDescription || '').trim();
  if (!pNum || !desc) {
    const err = new Error('Part number and item description are required');
    err.statusCode = 400;
    throw err;
  }

  const pk = PART_PK(oid);
  const now = new Date().toISOString();
  let sk = partId ? String(partId).trim() : '';
  let createdAt = now;

  if (sk) {
    const existing = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
    if (!existing.Item) {
      const err = new Error('Part number record not found');
      err.statusCode = 404;
      throw err;
    }
    createdAt = existing.Item.createdAt || now;
    const dup = await findDuplicatePartNumber(oid, pNum, sk);
    if (dup) {
      const err = new Error('Part number already exists for this customer organization');
      err.statusCode = 409;
      throw err;
    }
  } else {
    const dup = await findDuplicatePartNumber(oid, pNum, null);
    if (dup) {
      const err = new Error('Part number already exists for this customer organization');
      err.statusCode = 409;
      throw err;
    }
    sk = uuidv4();
  }

  const item = {
    pk,
    sk,
    partId: sk,
    organizationId: oid,
    organizationName: oName,
    partNumber: pNum,
    itemDescription: desc,
    isActive: !!isActive,
    createdAt,
    updatedAt: now,
  };

  await dynamoDB.put({ TableName: TABLE_NAME, Item: item }).promise();
  return toOrganizationPartDto(item);
};

/**
 * @deprecated User flows must not auto-create masters. Kept for backward compatibility / scripts only.
 */
export const ensureMasterValue = async (category, rawValue) => {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '';

  const pk = MASTER_PK(category);
  const sk = normalizeToken(trimmed);
  if (!sk) return '';

  const existing = await dynamoDB
    .get({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
    .promise();

  if (existing.Item?.value) {
    return String(existing.Item.value).trim();
  }

  try {
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk,
          value: trimmed,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      })
      .promise();
    return trimmed;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      const again = await dynamoDB.get({ TableName: TABLE_NAME, Key: { pk, sk } }).promise();
      return String(again.Item?.value || trimmed).trim();
    }
    throw err;
  }
};

/** @returns {Promise<number>} next serial (1-based) */
export const incrementQuotationSerial = async (fyLabel) => {
  const pk = 'INTERNAL';
  const sk = `SEQ#SP2L#${fyLabel}`;

  const result = await dynamoDB
    .update({
      TableName: TABLE_NAME,
      Key: { pk, sk },
      UpdateExpression: 'ADD serial :one SET updatedAt = :now',
      ExpressionAttributeValues: {
        ':one': 1,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'UPDATED_NEW',
    })
    .promise();

  return Number(result.Attributes?.serial || 0);
};

export const getExchangeRates = async () => {
  const pk = MASTER_PK('EXCHANGE_RATE');
  const result = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    })
    .promise();

  const map = {};
  for (const row of result.Items || []) {
    if (!isRowActive(row)) continue;
    const label = String(row.displayLabel || row.currencyKey || '').trim();
    if (label) map[label] = Number(row.rateToInr || 0);
  }
  return map;
};

export const putExchangeRates = async (rates = {}) => {
  const pk = MASTER_PK('EXCHANGE_RATE');
  const now = new Date().toISOString();
  const entries = Object.entries(rates);
  for (const [displayLabel, rate] of entries) {
    const label = String(displayLabel || '').trim();
    if (!label) continue;
    const sk = normalizeToken(label);
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk,
          displayLabel: label,
          currencyKey: label,
          rateToInr: Number(rate) || 0,
          isActive: true,
          updatedAt: now,
        },
      })
      .promise();
  }
  return getExchangeRates();
};

const SEED_LISTS = {
  STATUS: [
    'Lead Generated',
    'Budgetary Quotation',
    'Quotation against Tender',
    'Final Quotation',
    'Under Negotiation',
    'Order Finalized',
    'PO Received',
    'Lost - Price',
    'Lost - Competition',
    'Lost - Technical',
    'Lost - Other',
    'On Hold',
    'Refloating',
  ],
  CURRENCY: ['INR', 'US$', 'Euro', 'GBP'],
  PROBABILITY_OPTION: [
    '10% - Initial Contact',
    '20% - Tender Enquiry ( Not Our Specs)',
    '25% - Budgetary Quotation',
    '50% - Final Quotation',
    '51% - Tender Enquiry (Our Specs)',
    '60% - Technically Qualified',
    '75% - Negotiations Advanced',
    '90% - Order Finalized',
    '95% - PO Expected This Week',
    '0% - Lost Opportunity',
  ],
  CUSTOMER_SEGMENT: [
    'Aerospace',
    'Defense',
    'Space/ISRO',
    'Research Institute',
    'University/Education',
    'Private R&D',
    'DAE',
    'Manufacturing',
    'OEM / SI',
    'Medical/Healthcare',
    'Other',
  ],
  ENQUIRY_TYPE: [
    'Tender',
    'Generated through Visit',
    'Enquiry from Principal',
    'Enquiry through Past Contacts',
    'Enquiry from colleagues',
    'Follow-up',
    'Repeat Order',
  ],
  DELIVERY_DAYS: ['60', '90', '120', '150', '180', '360'],
  WARRANTY: ['60 days', '90 days', '1 year', '2 years', '3 years'],
  CONTACT_TITLE: ['Mr.', 'Dr.', 'Miss.', 'Mrs.'],
};

const PRINCIPAL_MAP_SEED = [
  ['Andeen Hagerling Inc', 'AHI'],
  ['Aurea Technology', 'AUR'],
  ['HWL Scientific', 'HWL'],
  ['indie Photonics', 'IND'],
  ['Laserpoint SRL', 'LPS'],
  ['LD4B', 'LD4'],
  ['MicroLight3D', 'ML3'],
  ['Pacific Laser Technology', 'PLT'],
  ['Photonis', 'PHO'],
  ['PiezoDrive, Australia', 'PDA'],
  ['SPPL Indigenous', 'SPI'],
  ['Surface Concept', 'SCG'],
  ['Tausand Electronics', 'TAU'],
  ['Teem Photonics, France', 'TPF'],
  ['Vortran', 'VOR'],
];

const DEFAULT_RATES = {
  INR: 1,
  'US$': 86,
  Euro: 95,
  GBP: 110,
};

export const seedSalesMasterDataIfEmpty = async () => {
  const probe = await dynamoDB
    .query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': MASTER_PK('STATUS') },
      Limit: 1,
    })
    .promise();

  if ((probe.Items || []).length > 0) {
    return { seeded: false };
  }

  const now = new Date().toISOString();
  for (const [cat, values] of Object.entries(SEED_LISTS)) {
    const pk = MASTER_PK(cat);
    for (const v of values) {
      const sk = normalizeToken(v);
      await dynamoDB
        .put({
          TableName: TABLE_NAME,
          Item: { pk, sk, value: v, isActive: true, createdAt: now },
        })
        .promise()
        .catch(() => {});
    }
  }

  const pkMap = MASTER_PK('PRINCIPAL_MAP');
  for (const [name, code] of PRINCIPAL_MAP_SEED) {
    const sk = normalizeToken(name);
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: {
          pk: pkMap,
          sk,
          principalName: name,
          shortCode: code,
          value: name,
          isActive: true,
          createdAt: now,
        },
      })
      .promise()
      .catch(() => {});
  }

  const pkRate = MASTER_PK('EXCHANGE_RATE');
  for (const [label, rate] of Object.entries(DEFAULT_RATES)) {
    const sk = normalizeToken(label);
    await dynamoDB
      .put({
        TableName: TABLE_NAME,
        Item: {
          pk: pkRate,
          sk,
          displayLabel: label,
          currencyKey: label,
          rateToInr: rate,
          isActive: true,
          createdAt: now,
        },
      })
      .promise()
      .catch(() => {});
  }

  return { seeded: true };
};

/** Seed new master categories on existing deployments (no-op if rows exist). */
export const ensureSalesMasterOptionalCategories = async () => {
  const optional = ['CONTACT_TITLE'];
  const now = new Date().toISOString();
  for (const cat of optional) {
    const pk = MASTER_PK(cat);
    const probe = await dynamoDB
      .query({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        Limit: 1,
      })
      .promise();
    if ((probe.Items || []).length > 0) continue;
    const values = SEED_LISTS[cat];
    if (!values) continue;
    for (const v of values) {
      const sk = normalizeToken(v);
      await dynamoDB
        .put({
          TableName: TABLE_NAME,
          Item: { pk, sk, value: v, isActive: true, createdAt: now },
        })
        .promise()
        .catch(() => {});
    }
  }
};
