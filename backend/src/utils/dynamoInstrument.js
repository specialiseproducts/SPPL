/**
 * Wraps DynamoDB DocumentClient calls with timing, operation type, RCU/WCU, GSI, throttle tracking.
 */

import { recordDynamoOp } from './metricsStore.js';
import { logStructured } from './structuredLog.js';

const SLOW_DYNAMO_MS = Number(process.env.SLOW_DYNAMO_MS || 200);

function readConsumed(result) {
  const cc = result?.ConsumedCapacity;
  if (!cc) return { read: 0, write: 0 };
  if (typeof cc.CapacityUnits === 'number') {
    return { read: cc.CapacityUnits, write: 0 };
  }
  let read = 0;
  let write = 0;
  for (const key of Object.keys(cc)) {
    const entry = cc[key];
    if (entry?.ReadCapacityUnits) read += entry.ReadCapacityUnits;
    if (entry?.WriteCapacityUnits) write += entry.WriteCapacityUnits;
  }
  return { read, write };
}

function isThrottled(err) {
  const code = err?.code || '';
  return code === 'ProvisionedThroughputExceededException' || code === 'ThrottlingException';
}

function instrumentMethod(client, operation) {
  const original = client[operation].bind(client);
  if (typeof original !== 'function') return;

  client[operation] = function instrumented(params) {
    const tableName = params?.TableName;
    const indexName = params?.IndexName;
    const start = process.hrtime.bigint();

    const request = original(params);
    if (!request || typeof request.promise !== 'function') {
      return request;
    }

    return {
      ...request,
      promise: () =>
        request.promise().then(
          (result) => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            const { read, write } = readConsumed(result);
            recordDynamoOp({
              operation,
              tableName,
              indexName,
              durationMs,
              consumedRead: read,
              consumedWrite: write,
              throttled: false,
            });
            if (durationMs >= SLOW_DYNAMO_MS || operation === 'scan') {
              logStructured('dynamodb_op', {
                operation,
                tableName,
                indexName: indexName || undefined,
                durationMs: Math.round(durationMs),
                consumedRead: read,
                consumedWrite: write,
              });
            }
            return result;
          },
          (err) => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            const throttled = isThrottled(err);
            recordDynamoOp({
              operation,
              tableName,
              indexName,
              durationMs,
              throttled,
              error: err,
            });
            logStructured('dynamodb_error', {
              operation,
              tableName,
              indexName: indexName || undefined,
              durationMs: Math.round(durationMs),
              throttled,
              code: err?.code,
              message: err?.message,
            });
            throw err;
          }
        ),
    };
  };
}

const OPS = ['get', 'put', 'update', 'delete', 'query', 'scan', 'batchGet', 'batchWrite'];

export function instrumentDocumentClient(client) {
  for (const op of OPS) {
    instrumentMethod(client, op);
  }
  return client;
}
