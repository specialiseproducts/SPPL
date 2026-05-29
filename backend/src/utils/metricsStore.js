/**
 * In-memory operational metrics (rolling window). Suitable for single-instance or dev;
 * export via GET /api/metrics for admin dashboards. Reset on process restart.
 */

const MAX_SLOW_REQUESTS = 100;
const MAX_FRONTEND_EVENTS = 80;
const MAX_DYNAMO_SLOW = 50;

const state = {
  startedAt: new Date().toISOString(),
  requests: {
    total: 0,
    byEndpoint: new Map(),
    slow: [],
    largePayload: 0,
    errors5xx: 0,
    errors4xx: 0,
  },
  dynamo: {
    query: 0,
    scan: 0,
    get: 0,
    put: 0,
    update: 0,
    delete: 0,
    batchWrite: 0,
    other: 0,
    totalRcu: 0,
    totalWcu: 0,
    throttled: 0,
    slow: [],
    gsiUsage: new Map(),
  },
  frontend: [],
};

function endpointKey(method, path) {
  return `${method} ${path}`;
}

export function recordRequest({ method, path, statusCode, durationMs, responseBytes }) {
  state.requests.total += 1;
  const key = endpointKey(method, path);
  const prev = state.requests.byEndpoint.get(key) || {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    totalBytes: 0,
    slowCount: 0,
  };
  prev.count += 1;
  prev.totalMs += durationMs;
  prev.maxMs = Math.max(prev.maxMs, durationMs);
  prev.totalBytes += responseBytes;
  if (durationMs >= 500) prev.slowCount += 1;
  state.requests.byEndpoint.set(key, prev);

  if (durationMs >= 500) {
    state.requests.slow.unshift({
      at: new Date().toISOString(),
      method,
      path,
      statusCode,
      durationMs: Math.round(durationMs),
      responseBytes,
    });
    if (state.requests.slow.length > MAX_SLOW_REQUESTS) state.requests.slow.pop();
  }

  if (responseBytes >= 1024 * 1024) state.requests.largePayload += 1;

  if (statusCode >= 500) state.requests.errors5xx += 1;
  else if (statusCode >= 400) state.requests.errors4xx += 1;
}

export function recordDynamoOp({
  operation,
  tableName,
  indexName,
  durationMs,
  consumedRead,
  consumedWrite,
  throttled,
  error,
}) {
  const op = String(operation || 'other').toLowerCase();
  if (state.dynamo[op] !== undefined) state.dynamo[op] += 1;
  else state.dynamo.other += 1;

  if (consumedRead) state.dynamo.totalRcu += consumedRead;
  if (consumedWrite) state.dynamo.totalWcu += consumedWrite;
  if (throttled) state.dynamo.throttled += 1;

  if (indexName) {
    const gsiKey = `${tableName || 'unknown'}:${indexName}`;
    state.dynamo.gsiUsage.set(gsiKey, (state.dynamo.gsiUsage.get(gsiKey) || 0) + 1);
  }

  if (durationMs >= 200 || throttled || error) {
    state.dynamo.slow.unshift({
      at: new Date().toISOString(),
      operation: op,
      tableName,
      indexName: indexName || null,
      durationMs: Math.round(durationMs),
      consumedRead: consumedRead || 0,
      consumedWrite: consumedWrite || 0,
      throttled: !!throttled,
      error: error ? String(error.message || error) : null,
    });
    if (state.dynamo.slow.length > MAX_DYNAMO_SLOW) state.dynamo.slow.pop();
  }
}

export function recordFrontendEvent(event) {
  state.frontend.unshift({ ...event, at: event.at || new Date().toISOString() });
  if (state.frontend.length > MAX_FRONTEND_EVENTS) state.frontend.pop();
}

function mapToSortedArray(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([key, v]) => ({
      endpoint: key,
      count: v.count,
      avgMs: v.count ? Math.round(v.totalMs / v.count) : 0,
      maxMs: Math.round(v.maxMs),
      avgBytes: v.count ? Math.round(v.totalBytes / v.count) : 0,
      slowCount: v.slowCount,
    }));
}

export function getMetricsSnapshot() {
  const gsi = [...state.dynamo.gsiUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ index: name, count }));

  return {
    startedAt: state.startedAt,
    uptimeSeconds: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000),
    requests: {
      total: state.requests.total,
      slowCount: state.requests.slow.length,
      largePayloadCount: state.requests.largePayload,
      errors5xx: state.requests.errors5xx,
      errors4xx: state.requests.errors4xx,
      topEndpoints: mapToSortedArray(state.requests.byEndpoint),
      recentSlow: state.requests.slow.slice(0, 25),
    },
    dynamodb: {
      operations: {
        query: state.dynamo.query,
        scan: state.dynamo.scan,
        get: state.dynamo.get,
        put: state.dynamo.put,
        update: state.dynamo.update,
        delete: state.dynamo.delete,
        batchWrite: state.dynamo.batchWrite,
        other: state.dynamo.other,
      },
      estimatedRcu: Math.round(state.dynamo.totalRcu * 100) / 100,
      estimatedWcu: Math.round(state.dynamo.totalWcu * 100) / 100,
      throttled: state.dynamo.throttled,
      gsiUsage: gsi,
      recentSlow: state.dynamo.slow.slice(0, 20),
    },
    frontend: state.frontend.slice(0, 40),
  };
}
