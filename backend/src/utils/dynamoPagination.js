/**
 * Shared DynamoDB pagination helpers (limit + ExclusiveStartKey cursors).
 */

export const DEFAULT_QUERY_LIMIT = 50;
export const MAX_QUERY_LIMIT = 200;

export function parsePaginationOptions(options = {}) {
  const rawLimit = options.limit ?? options.Limit;
  let limit;
  if (rawLimit !== undefined && rawLimit !== null && rawLimit !== '') {
    const n = Number(rawLimit);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(Math.floor(n), MAX_QUERY_LIMIT);
    }
  }

  if (options.exclusiveStartKey && typeof options.exclusiveStartKey === 'object') {
    return { limit, exclusiveStartKey: options.exclusiveStartKey, paginated: limit != null };
  }

  const cursor = options.cursor ?? options.nextCursor;
  const exclusiveStartKey = decodeCursor(cursor);

  return { limit, exclusiveStartKey, paginated: limit != null };
}

export function encodeCursor(lastEvaluatedKey) {
  if (!lastEvaluatedKey || typeof lastEvaluatedKey !== 'object') return null;
  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {object} params - base DynamoDB query params (without ExclusiveStartKey/Limit loop)
 * @param {{ limit?: number, exclusiveStartKey?: object }} pagination
 * @param {(item: object) => boolean} [filterFn]
 */
export async function runQueryPage(dynamoDB, params, pagination = {}, filterFn) {
  const { limit, exclusiveStartKey } = pagination;
  const queryParams = { ...params };
  if (limit != null) queryParams.Limit = limit;
  if (exclusiveStartKey) queryParams.ExclusiveStartKey = exclusiveStartKey;

  const result = await dynamoDB.query(queryParams).promise();
  let items = result.Items || [];
  if (filterFn) items = items.filter(filterFn);

  return {
    items,
    lastEvaluatedKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Fetch all pages for a query (used when API must return full list, e.g. bootstrap).
 */
export async function queryAllPages(dynamoDB, params, filterFn) {
  let items = [];
  let startKey;
  do {
    const page = await runQueryPage(
      dynamoDB,
      { ...params, ExclusiveStartKey: startKey },
      {},
      filterFn
    );
    items = items.concat(page.items);
    startKey = page.lastEvaluatedKey || undefined;
  } while (startKey);
  return items;
}

export function toPaginatedResponse(items, lastEvaluatedKey) {
  return {
    data: items,
    nextCursor: encodeCursor(lastEvaluatedKey),
  };
}

/**
 * Paginate a fully sorted in-memory array (scan / GSI-missing fallback).
 * Cursor shape: { _sortOffset: number } — encoded via encodeCursor.
 */
export function paginateSortedSlice(sortedItems, pagination = {}) {
  const { limit, exclusiveStartKey, paginated } = pagination;
  if (!paginated || limit == null) {
    return { items: sortedItems, lastEvaluatedKey: null };
  }

  let offset = 0;
  if (exclusiveStartKey && typeof exclusiveStartKey === 'object') {
    const raw = exclusiveStartKey._sortOffset;
    if (Number.isFinite(raw)) {
      offset = Math.max(0, Math.floor(raw));
    }
  }

  const items = sortedItems.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const lastEvaluatedKey =
    items.length === limit && nextOffset < sortedItems.length ? { _sortOffset: nextOffset } : null;

  return { items, lastEvaluatedKey };
}
