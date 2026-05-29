# Phase 5 — Pagination + list performance

## Server pagination (default `limit=50`)

| Endpoint | Query params | Response |
|----------|--------------|----------|
| `GET /api/expenses` | `limit`, `cursor` | `{ success, data[], nextCursor? }` |
| `GET /api/purchases` | `limit`, `cursor` | `{ success, data[], nextCursor? }` |
| `GET /api/sales-forecasts` | `limit`, `cursor` | `{ success, data[], nextCursor? }` |
| `GET /api/employees` | `limit`, `cursor` | `{ success, data[], nextCursor? }` |
| `GET /api/sales-forecasts/bootstrap` | — | `{ masters, rates }` only (no opportunities) |

Cursors are base64url-encoded DynamoDB `LastEvaluatedKey` values.

## List DTOs (`backend/src/utils/listDtos.js`)

- **Expenses:** strips `documents` / `supportingDocument`; adds `hasDocuments`
- **Sales:** summary fields for table (detail via `GET /:id`)
- **Purchases:** slim header + line item fields per row
- **Employees:** strips passwords and file blobs (`documents`, `pastExperience`, `profilePhoto`); includes scalar HR/contact fields + `documentsUrl` / `pastExperienceUrl` / `profilePhotoUrl` for the admin table

## Frontend

- `@tanstack/react-virtual` + `VirtualizedTableBody` (Sales table)
- `useInfiniteQuery` for expenses, purchases, sales forecasts, employee admin list
- `useDebouncedValue(300ms)` on search inputs
- **Load more** buttons when `hasNextPage`
- Employee filter dropdowns still use `useEmployeesListQuery()` (auto-fetches all pages for selects)
