# Warehouse Adapter Migration Strategy

**Date:** 2026-05-16
**Domain:** `di-warehouse`
**Reference:** `docs/adapters/adapter-migration-strategy.md` (general lifecycle)

---

## Lifecycle Overview

```
mock
  → legacy-api (FastAPI proxy → V1 WH360 backend)
  → databricks-api (direct Databricks SQL / Unity Catalog)
```

The `Warehouse360LegacyApiAdapter` class extends `Warehouse360Adapter` and overrides methods one at a time as V1 endpoints are confirmed and browser-verified. The `ProductionStagingAdapter` currently has no legacy-api override.

---

## Current State (2026-05-16)

### Warehouse360Adapter

| Method | V2 tier | V1 endpoint | Proxy route | Browser verified |
|---|---|---|---|---|
| `getWarehouse360Context` | mock | `GET /api/wh360/plants` | No | No |
| `getWarehouse360Summary` | legacy-api (unverified) | `POST /api/wh360/warehouse-summary` | Yes (exists in `apps/api/routes/wh360.py`) | No |
| `getStockOverview` | mock | `GET /api/wh360/inventory/bins/summary` | No | No |
| `getOpenHolds` | mock | `GET /api/wh360/inventory/bins` (hold_type filter) | No | No |
| `getGoodsMovements` | mock | `GET /api/wh360/imwm/movements` | No | No |
| `getReplenishmentNeeds` | mock | `GET /api/wh360/inventory/lineside` | No | No |
| `getLocationCapacities` | mock | `GET /api/wh360/inventory/bins/summary` (bin-level) | No | No |
| `getNearExpiryStock` | mock | `GET /api/wh360/inventory/near-expiry` | No | No |
| `getWarehouseExceptions` | mock | `GET /api/wh360/imwm/exceptions` | No | No |

### ProductionStagingAdapter

| Method | V2 tier | V1 endpoint | Proxy route | Browser verified |
|---|---|---|---|---|
| `getProductionStagingContext` | mock | — | No | No |
| `getStagingReadinessSummary` | mock | `staging_orders_v` aggregate | No | No |
| `getStagingOrderSummaries` | mock | `staging_orders_v` | No | No |
| `getStagingPickTasks` | mock | `staging_pick_tasks_v` | No | No |
| `getStagingZoneCapacity` | mock | `staging_pick_tasks_v` (zone agg) | No | No |
| `getStagingShortfalls` | mock | `staging_orders_v` (unfulfilled) | No | No |
| `getStagingMoveRequests` | mock | — | No | No |
| `getStagingPickingWaves` | mock | `staging_pick_tasks_v` (wave grouping) | No | No |
| `getStagingAlerts` | mock | — | No | No |

---

## What Can Remain Mock Temporarily

| Method | Reason acceptable at mock |
|---|---|
| `getWarehouse360Context` | Context frame; operators know their plant |
| `getReplenishmentNeeds` | Directional — operators will verify at source |
| `getLocationCapacities` | Supplementary to zone overview; not action-critical |
| All `ProductionStaging*` methods | Staging data is plant-specific; mock is clearly labelled |

---

## What Must Use V1/Legacy API to Prove Parity

| Method | Why V1 is required | V1 endpoint |
|---|---|---|
| `getWarehouse360Summary` | KPIs drive operational decisions; unverified mapping may silently report wrong counts | `POST /api/wh360/warehouse-summary` |
| `getNearExpiryStock` | Expired and near-expiry batches require immediate real-data response | `GET /api/wh360/inventory/near-expiry` |
| `getWarehouseExceptions` | IM/WM exceptions are the primary data quality alert; mock exceptions are misleading | `GET /api/wh360/imwm/exceptions` |
| `getGoodsMovements` | Movement feed is the audit trail; mock movements show wrong activity | `GET /api/wh360/imwm/movements` |
| `getOpenHolds` | Hold status drives batch release decisions | `GET /api/wh360/inventory/bins` (filtered) |

---

## What Should Eventually Be Native Databricks API

| Method | Likely Databricks source |
|---|---|
| `getWarehouse360Summary` | `wh360_kpis_v` or `wh360_cockpit_summary_v` aggregate |
| `getNearExpiryStock` | `wh360_near_expiry_batches_v` |
| `getWarehouseExceptions` | `wh360_imwm_exceptions_v` |
| `getGoodsMovements` | `wh360_imwm_movements_v` |
| `getOpenHolds` | `wh360_bin_stock_v` WHERE hold_type IS NOT NULL |
| `getStockOverview` | `wh360_bin_stock_v` (zone aggregation) |
| `getReplenishmentNeeds` | `wh360_lineside_v` |
| `getLocationCapacities` | `wh360_bin_stock_v` (capacity aggregation) |

---

## Required Tests Before Advancing to Legacy-API

Each method must satisfy the following before a FastAPI proxy route is added:

1. **V1 endpoint confirmed** — URL, HTTP method, request and response field names verified from V1 source code.
2. **Proxy route created** in `apps/api/routes/wh360.py`.
3. **Browser-verified** — end-to-end call from V2 workspace to V1 backend confirmed for at least one plant.
4. **Contract tests written** in `warehouse-360-legacy-api-adapter.test.ts`:
   - Success case with representative data
   - 401 Unauthorized
   - 404 Not Found
   - 500 Internal Server Error
   - Network failure / timeout
   - Fallback to mock when `warehouseId` is missing

**Do not advance to legacy-api based on field name assumptions.** The V1 WH360 backend uses snake_case; V2 schemas use camelCase. The mapping layer must be verified against live V1 responses.

---

## Required Tests Before Advancing to Databricks-API

1. V1 WH360 backend retired or scheduled for retirement.
2. Gold views confirmed queryable in Unity Catalog.
3. V2 `@connectio/data-contracts` Zod schemas validated against Databricks responses without field renames.
4. Pilot sign-off on legacy-api tier for at least `getWarehouse360Summary` and `getNearExpiryStock`.
5. `warehouse-360-databricks-api-adapter.test.ts` created covering same cases as legacy adapter tests.

---

## Advance Order Recommendation

Priority order for V1 wiring:

1. **Browser-verify `getWarehouse360Summary`** — already wired, just needs verification
2. **`getNearExpiryStock`** — highest daily visibility; simple V1 mapping
3. **`getWarehouseExceptions`** — primary data quality signal
4. **`getGoodsMovements`** — movement audit trail
5. **`getOpenHolds`** — batch release dependency
6. **`getStockOverview`** — zone aggregates from bins summary
7. **`getReplenishmentNeeds`** — lower urgency; lineside data
8. **`getLocationCapacities`** — supplementary

---

## FastAPI Proxy Routes (current state)

```python
# apps/api/routes/wh360.py
POST /api/wh360/warehouse-summary   # exists — not browser-verified
```

Routes not yet created (require V1 endpoint shape confirmation first):
```python
GET /api/wh360/inventory/near-expiry
GET /api/wh360/imwm/exceptions
GET /api/wh360/imwm/movements
GET /api/wh360/inventory/bins
GET /api/wh360/inventory/bins/summary
GET /api/wh360/inventory/lineside
GET /api/wh360/plants
```

---

## Warehouse360 Cockpit Layout and Query Behavior

### Overview KPIs
The cockpit sends the active request context to all query hooks. Detailed tabs are expected to apply warehouse/date/limit filters. Overview KPIs are site-level from the pre-aggregated snapshot and must not be interpreted as warehouse-filtered unless the backend view changes.

### Wired Cockpit Filters
The detailed view tabs (Inbound, Outbound, Staging, and Exceptions) retrieve data filtered dynamically. The following 5 parameters are fully wired and passed in all detailed queries:
- `warehouseId` (Required): Filters detailed tabs to the selected warehouse.
- `plantId` (Optional): Restricts results to the selected plant context.
- `dateFrom` (Optional): Restricts results to records on or after the specified start date.
- `dateTo` (Optional): Restricts results to records on or before the specified end date.
- `limit` (Optional): Sets a maximum number of records to retrieve (clamped between 1 and 500).

### Diagnostic Exception Actions
When inspecting items on the **Exceptions & Alerts** tab, the cockpit provides advisory guidance only. Warehouse360 is a read-only visibility cockpit — no actions are instructed without review and authority confirmation.
- **Quantity Mismatch**: Indicates IM/WM discrepancies. *Review guidance:* Review IM/WM reconciliation using appropriate SAP warehouse transactions and confirm physical/bin status before posting corrections.
- **Expiry Warnings**: Batch is near or past expiration. *Review guidance:* Review batch status and escalate to QA/QM for block, retest, or disposal decision if required.
- **Hold Status**: Batch is under an active quality or warehouse hold. *Review guidance:* Review the block reason and release authority in the Quality Batch Release workspace before moving or releasing stock.
- **General Exception**: General warehouse exception detected. *Review guidance:* Review bin assignment history, physical counts, and storage unit status in SAP before making corrections.
