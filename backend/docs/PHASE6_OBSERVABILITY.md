# Phase 6 — Observability + production monitoring

## API timing middleware

`requestMetrics.middleware.js` logs every request on `finish`:

- Duration (ms)
- Response size (bytes → KB/MB in logs)
- Slow flag: `durationMs >= 500` (env: `SLOW_REQUEST_MS`)
- Large payload: `>= 1MB` (env: `LARGE_PAYLOAD_BYTES`)

Example log line (JSON when `LOG_FORMAT=json`):

```json
{"event":"api_request","method":"GET","path":"/api/sales-forecasts","durationMs":142,"responseBytes":38912}
```

Alerts: `api_request_alert` for slow and/or large responses.

## DynamoDB metrics

`dynamoInstrument.js` wraps the shared DocumentClient:

- Counts: `query`, `scan`, `get`, `put`, `update`, `delete`, `batchWrite`
- Estimated RCU/WCU from `ConsumedCapacity`
- GSI usage (`TableName:IndexName`)
- Throttling (`ProvisionedThroughputExceededException`)
- Slow ops (`>= 200ms`, env: `SLOW_DYNAMO_MS`)

## Metrics API (admin dashboard)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/metrics` | Token + Admin/Developer/Super Admin | Snapshot of in-memory metrics |
| `POST /api/metrics/frontend-events` | Token | Ingest frontend perf/error events |

## Compression

`compression()` middleware enabled (threshold 1KB). Clients sending `Accept-Encoding: gzip` receive compressed JSON.

## Frontend

- `lib/observability/performance.ts` — marks for bootstrap, pagination, module render
- `lib/observability/errorReporter.ts` — boundaries, API failures, query errors
- `React.lazy` + `Suspense` for Sales, Expenses, Purchases, User Management, Performance dashboard
- Developer-only **System Metrics** module

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_FORMAT` | text | Set `json` for CloudWatch Logs Insights |
| `SLOW_REQUEST_MS` | 500 | Slow API threshold |
| `LARGE_PAYLOAD_BYTES` | 1048576 | Large response threshold |
| `SLOW_DYNAMO_MS` | 200 | Slow DynamoDB op threshold |
| `VITE_SENTRY_DSN` | — | Optional Sentry (hook ready) |

## Limitations

- Metrics store is **in-memory per process** (not shared across horizontal scale without external sink).
- For production at scale: pipe `LOG_FORMAT=json` to CloudWatch, add Sentry DSN, or export metrics to Prometheus/Datadog.
