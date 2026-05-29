# Phase 4 — DynamoDB GSI optimization

## GSIs created (run once per environment)

DynamoDB allows **only one online GSI create/delete at a time per table**. The provision script creates **at most one GSI per run** (then exits). For **SalesForecasts** you need **two runs**: first `GSI_OwnerUpdated`, then `GSI_EntityUpdated` (order in `dynamodbIndexes.js`).

```bash
cd backend && npm run dynamodb:ensure-gsis
```

| Table | Index | Partition key | Sort key | Hot path |
|-------|--------|---------------|----------|----------|
| EmployeeMaster | `GSI_EmployeeCode` | `employeeCode` | — | Auth (`getEmployeeByCode`) |
| SalesForecasts | `GSI_OwnerUpdated` | `ownerEmployeeCode` | `updatedAt` | User opportunity lists |
| SalesForecasts | `GSI_EntityUpdated` | `entityType` (`OPPORTUNITY`) | `updatedAt` | Admin / bootstrap lists |
| PurchaseLineItems | `GSI_PurchaseHeader` | `purchaseHeaderId` | `purchaseLineItemId` | Purchase detail + list N+1 |
| Expenses | `GSI_EmployeeUpdated` | `created_by_employee_code` | `updatedAt` | User expense lists |

### Legacy sales backfill

Existing opportunities need valid GSI key attributes (DynamoDB rejects `""` on index keys). The backfill script sanitizes `entityType`, `updatedAt`, and `ownerEmployeeCode` — it never writes empty strings to indexed fields.

```bash
npm run dynamodb:backfill-sales-gsi
```

- `entityType` → `OPPORTUNITY` if missing/blank  
- `updatedAt` → valid ISO from `updatedAt` / `createdAt` / now if missing/blank  
- `ownerEmployeeCode` → set from `created_by_employee_code` when possible; **REMOVE** if stored as `""` and no fallback (logged as skipped-owner)

New writes set `entityType`, `ownerEmployeeCode`, and `updatedAt` automatically.

---

## scan() → query() migrations

| Location | Before | After |
|----------|--------|-------|
| `EmployeeMaster.getEmployeeByCode` | Table scan | `query` on `GSI_EmployeeCode` |
| `SalesForecasts` list (owner) | Scan + filter | `query` on `GSI_OwnerUpdated` |
| `SalesForecasts` list (admin) | Full scan | `query` on `GSI_EntityUpdated` |
| `PurchaseLineItems.getLineItemsByPurchaseHeaderId` | Scan + filter | `query` on `GSI_PurchaseHeader` |
| `Expenses` (user scope) | Scan | `query` on `GSI_EmployeeUpdated` |

All query paths fall back to scan only when the GSI is missing (pre-migration), with a single warning log.

---

## Remaining unavoidable / future scans

| File | Method | Category | Notes |
|------|--------|----------|-------|
| `EmployeeMaster.getAllEmployees` | scan | Admin directory | Needs `GSI_EntityActive` (future) for full employee query |
| `PurchaseHeaders.getPurchaseHeaders` | scan | Purchase list | Needs header list GSI (e.g. `entityType` + `updatedAt`) |
| `Expenses.getAllExpenses` | scan | Admin expense list | Uses paginated scan; user path uses GSI |
| `UserAccessControl.getAll` | scan | Admin access UI | Low volume; PK is `employeeCode` for single lookups |
| `Notifications` | scan | Per-user filter | Needs `GSI_UserCreated` (future) |
| `ExpenseDocuments` | scan | By expenseId filter | Needs `GSI_ExpenseId` (future) |
| `AuditLogs` | scan | Reporting | Append-only; acceptable for admin |

---

## Pagination (opt-in)

Query params: `?limit=50&cursor=<base64url LastEvaluatedKey>`

Response when paginated:

```json
{ "success": true, "data": [...], "nextCursor": "..." }
```

Without `limit`, APIs return the full list (unchanged frontend contract).

Endpoints: `GET /api/sales-forecasts`, `GET /api/expenses`, `GET /api/purchases`

---

## List vs detail payloads

- **Expenses list:** `documents` omitted; `hasDocuments` boolean returned.
- **Sales:** `toPublicOpportunity()` remains the list DTO; detail uses `GET /:id` (full record).
- **Purchases:** List still returns header + line items (indexed line-item fetch per header).

---

## Performance expectations (estimates)

Assumptions: ~500 employees, ~2k sales rows, ~500 purchase headers, ~2k line items.

| Path | Before (RCU order) | After (RCU order) | Latency |
|------|-------------------|-------------------|---------|
| Auth per request | ~0.5–2 RCU (full employee scan) | ~0.5 RCU (1 query item) | **~10–50× faster** at scale |
| Sales list (user) | Full table scan | Partition query (~owner’s rows) | **~N/table × faster** |
| Sales bootstrap (admin) | Full scan | Entity partition query | **~N/table × faster** |
| Purchase line items × N headers | N full line-item scans | N partition queries | **~lineItems/table × per header** |

**Rough RCU reduction (steady state after GSI + backfill):**

- Auth middleware: **~95%+** fewer RCUs vs scanning EmployeeMaster on every request.
- Sales lists: **~90–99%** depending on owner partition size vs table size.
- Purchases list: Line-item portion **~90%+**; headers still scan until header GSI exists.

Measure in CloudWatch: `ConsumedReadCapacityUnits`, `SuccessfulRequestLatency`, and count `Scan` vs `Query` in DynamoDB metrics.

---

## Deploy checklist

1. `npm run dynamodb:ensure-gsis` — re-run until output says all GSIs present (one index per run; SalesForecasts needs two runs)
2. `npm run dynamodb:backfill-sales-gsi`
3. Deploy backend
4. Verify logs: no repeated GSI fallback warnings
5. CloudWatch: Query operations dominate; Scan spikes drop on hot tables
