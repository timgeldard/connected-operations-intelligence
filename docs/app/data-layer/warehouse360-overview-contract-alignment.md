# Warehouse360 Overview Contract Alignment Analysis

**Date:** 2026-05-22
**Branch:** `feature/envmon-swab-contract-alignment`
**Status:** **ANALYSIS COMPLETE — Databricks verification done — Option C confirmed; data platform schema work required before any WH360 native route can be trusted**
**Relates to:** `backend-contract-enforcement-plan.md` — `GET /api/warehouse360/overview` skip-contract-mismatch (unresolved)

---

## Background

`GET /api/warehouse360/overview` was skipped from backend `response_model` enforcement in PR #71 (branch `feature/backend-contract-enforcement`) because the mapper output shape is completely different from the `Warehouse360Overview` Pydantic model.

This document analyses the mismatch, checks for a promotable native schema in the frontend, performs live Databricks schema verification, and recommends a safe resolution path.

---

## What the mapper returns (`map_warehouse_overview_rows`)

`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` — `map_warehouse_overview_rows()`

Source view: `wh360_kpi_snapshot_v` — **global single-row KPI snapshot**. The SQL has no `WHERE` clause and ignores the `plant_id`/`date_from`/`date_to` request parameters.

SQL selects:

```sql
SELECT
    orders_total, orders_red, orders_amber,
    trs_open, tos_open,
    deliveries_today, deliveries_at_risk,
    inbound_open,
    bins_blocked, bins_total, bin_util_pct
FROM {catalog}.{schema}.wh360_kpi_snapshot_v
LIMIT 1
```

The mapper emits 12 camelCase keys: `warehouseId`, `ordersTotal`, `ordersRed`, `ordersAmber`, `trsOpen`, `tosOpen`, `deliveriesToday`, `deliveriesAtRisk`, `inboundOpen`, `binsBlocked`, `binsTotal`, `binUtilPct`.

---

## Existing `Warehouse360OverviewSchema`

`packages/data-contracts/src/schemas/warehouse-360-overview.ts` — `Warehouse360OverviewSchema`

13 fields: `plantId` (required string), `warehouseId` (required string), `inboundDueCount`, `inboundOverdueCount`, `outboundDueCount`, `outboundOverdueCount`, `stagingOpenCount`, `stagingOverdueCount`, `nearExpiryCount`, `reconciliationExceptionCount`, `blockedStockCount` (all required int ≥ 0), `source` (optional string), `warnings` (optional string[]).

---

## Frontend adapter check (the EnvMon discriminator)

`domain-integrations/warehouse/src/adapters/warehouse-360-legacy-api-adapter.ts` — `getWarehouseOverview()` lines 149–161:

```typescript
const mapped: Warehouse360Overview = {
  plantId: String(raw.plantId ?? ''),
  warehouseId: String(raw.warehouseId ?? request.warehouseId),
  inboundDueCount: Number(raw.inboundDueCount ?? 0),
  ...
  blockedStockCount: Number(raw.blockedStockCount ?? 0),
}
```

- The frontend already expects the `Warehouse360Overview` contract shape — not the V1 KPI shape.
- `isBrowserVerified('getWarehouseOverview')` = `true`.
- **No local frontend schema matching V1 KPI keys exists** — different from the EnvMon case.
- Current live behavior: backend returns V1 KPI keys → frontend maps `raw.inboundDueCount ?? 0` for all count fields → **all 9 counts silently return 0**. The mismatch is actively masking missing data.

---

## Databricks verification — confirmed DDL (2026-05-22)

Live queries run against `connected_plant_uat` warehouse (`e76480b94bea6ed5`) as `tim.geldard@kerry.com`.

### `connected_plant_uat.wh360.wh360_kpi_snapshot_v` — CONFIRMED COLUMNS

```
orders_total    bigint
orders_red      bigint
orders_amber    bigint
trs_open        bigint
tos_open        bigint
deliveries_today    bigint
deliveries_at_risk  bigint
inbound_open    bigint
bins_blocked    bigint
bins_total      bigint
bin_util_pct    decimal(26,1)
```

**11 columns total. None of the 9 required contract count fields exist. `plant_id` does not exist.** The view is a global single-row aggregate with no per-plant breakdown. UAT data shows: `orders_total=24`, `trs_open=9574125`, `inbound_open=18671`, `bins_blocked=16614`, `bins_total=362846`, `bin_util_pct=57.4`.

### Other views in `connected_plant_uat.wh360` — available for count derivation

`SHOW TABLES IN connected_plant_uat.wh360` returns 15 objects. Views most relevant to the overview contract:

| View | Key columns | Contract field potential |
|---|---|---|
| `wh360_inbound_v` | `po_id`, `po_item`, `doc_type`, `doc_cat`, `vendor_id`, `vendor_name`, `plant_id`, `storage_loc`, `material_id`, `material_name`, `ordered_qty`, `gr_qty`, `uom`, `delivery_date`, `po_date`, `delivery_complete`, `open_qty`, `qa_lot_id`, `qa_status` | `inboundDueCount`, `inboundOverdueCount` — derivable via `delivery_date` and `delivery_complete` |
| `wh360_deliveries_v` | `delivery_id`, `delivery_type`, `plant_id`, `customer_id`, `customer_name`, `carrier`, `lgnum`, `planned_gi_date`, `actual_gi_date`, `loading_date`, `delivery_date`, `gross_weight`, `weight_uom`, `packages`, `wm_status`, `mins_to_cutoff`, `pick_pct`, `line_count`, `risk`, `shipped` | `outboundDueCount`, `outboundOverdueCount` — derivable via `shipped` and `planned_gi_date` |
| `wh360_process_orders_v` | `order_id`, `material_id`, `plant_id`, `order_qty`, `uom`, `material_name`, `planned_start`, `planned_finish`, `sched_start`, `sched_finish`, `staging_pct`, `to_items_total`, `to_items_done`, `mins_to_start`, `risk`, `reservation_no`, `batch_id`, `sap_order` | `stagingOpenCount`, `stagingOverdueCount` — derivable via `staging_pct` and `risk`/dates |
| `wh360_near_expiry_batches_v` | `material_id`, `material_name`, `batch_id`, `plant_id`, `plant_name`, `manufacture_date`, `expiry_date`, `days_to_expiry` (int), `total_stock`, `uom`, `last_movement_date`, `aged_days` | `nearExpiryCount` — **blocked: threshold unknown** (see below) |
| `imwm_exceptions_v` | `exception_type`, `severity` (int), `sla_hours`, `material_id`, `material_name`, `plant_id`, `storage_loc`, `storage_loc_name`, `qty`, `batch_id`, `bin_id`, `detail_text`, `detected_date` | `reconciliationExceptionCount` — **blocked: semantics unclear** (see below) |
| `imwm_stock_comparison_v` | `material_id`, `material_name`, `material_type`, `uom`, `plant_id`, `plant_name`, `storage_loc`, `storage_loc_name`, `unrestricted_qty`, `qi_qty`, `blocked_qty`, `restricted_qty`, `interim_qty`, `im_total_qty`, `wm_total_qty`, `delta_qty`, `inventory_value_eur`, `batch_count`, `open_tos`, `mismatch_kind`, `abc_class` | `blockedStockCount` — derivable as `COUNT(*) WHERE blocked_qty > 0` |

---

## Field-by-field alignment table — updated with Databricks evidence

| Contract field | Current mapper field | Source view | Derivation | Confidence | Safe action |
|---|---|---|---|---|---|
| `plantId` | absent | N/A — not in `wh360_kpi_snapshot_v` | from request param `:plant_id` | code-inferred | **map-directly** from request (same as `warehouseId`) |
| `warehouseId` | `warehouseId` | request param | from request `:warehouse_id` | code-inferred | **map-directly** (already done) |
| `inboundDueCount` | absent (`inboundOpen` ≠ due) | `wh360_inbound_v` | `COUNT(*) WHERE delivery_date >= CURRENT_DATE AND delivery_complete != 'Y' AND open_qty > 0 AND plant_id = :plant_id` | DDL-confirmed source; business rule: **governance-pending** | **derive-with-evidence-pending-governance** |
| `inboundOverdueCount` | absent | `wh360_inbound_v` | `COUNT(*) WHERE delivery_date < CURRENT_DATE AND delivery_date != '0000-00-00' AND delivery_complete != 'Y' AND open_qty > 0 AND plant_id = :plant_id` | DDL-confirmed source; business rule: governance-pending | **derive-with-evidence-pending-governance** |
| `outboundDueCount` | absent | `wh360_deliveries_v` | `COUNT(DISTINCT delivery_id) WHERE shipped = false AND delivery_date >= CURRENT_DATE AND plant_id = :plant_id` | DDL-confirmed source; business rule: governance-pending | **derive-with-evidence-pending-governance** |
| `outboundOverdueCount` | absent | `wh360_deliveries_v` | `COUNT(DISTINCT delivery_id) WHERE shipped = false AND planned_gi_date < CURRENT_DATE AND plant_id = :plant_id` | DDL-confirmed source; business rule: governance-pending | **derive-with-evidence-pending-governance** |
| `stagingOpenCount` | absent | `wh360_process_orders_v` | `COUNT(*) WHERE staging_pct < 1 AND plant_id = :plant_id` (or `to_items_done < to_items_total`) | DDL-confirmed source; business rule: governance-pending | **derive-with-evidence-pending-governance** |
| `stagingOverdueCount` | absent | `wh360_process_orders_v` | `COUNT(*) WHERE sched_start < CURRENT_DATE AND sched_start != '0000-00-00' AND staging_pct < 1 AND plant_id = :plant_id` | DDL-confirmed source; business rule: governance-pending | **derive-with-evidence-pending-governance** |
| `nearExpiryCount` | absent | `wh360_near_expiry_batches_v` | `COUNT(*) WHERE days_to_expiry BETWEEN 0 AND ? AND plant_id = :plant_id` | DDL-confirmed; **threshold unknown** — view contains rows from -3505 to +90 days; not filtered to "near" | **leave-unavailable — threshold governance-required** |
| `reconciliationExceptionCount` | absent | `imwm_exceptions_v` | `COUNT(*) WHERE plant_id = :plant_id` | DDL-confirmed; **semantic unclear** — 90%+ of rows are `EXPIRED_BATCH_WITH_STOCK` (not IM/WM quantity mismatch) | **leave-unavailable — exception type governance-required** |
| `blockedStockCount` | absent (`binsBlocked` ≠ stock lines) | `imwm_stock_comparison_v` | `COUNT(*) WHERE blocked_qty > 0 AND plant_id = :plant_id` | DDL-confirmed; blocked_qty column exists and is semantically clear | **derive-with-evidence — safe** |
| `source` | absent | N/A | hardcode `"databricks-api"` | code-inferred | **add-to-mapper** |
| `warnings` | absent | N/A | omit initially | N/A | **leave-unavailable** |

---

## Critical finding: existing WH360 native routes are broken in production

Live Databricks verification revealed that **3 of the 4 other native warehouse routes reference non-existent views or non-existent columns**:

| Route | View referenced in SQL | Status | Issue |
|---|---|---|---|
| `GET /api/warehouse360/inbound` | `connected_plant_uat.wh360.wh360_inbound_v` | View EXISTS but SQL is wrong | Adapter SQL selects `DOCUMENT_TYPE`, `PURCHASE_ORDER_ID`, `WAREHOUSE_NUMBER`, `EXPECTED_DATE`, etc. — **none of these columns exist** in the view (actual columns: `po_id`, `doc_type`, `delivery_date`, etc.). Databricks returns: `UNRESOLVED_COLUMN: A column with name DOCUMENT_TYPE cannot be resolved`. |
| `GET /api/warehouse360/outbound` | `connected_plant_uat.wh360.wh360_deliveries_v` | Requires verification | View exists with correct-looking schema. Column names appear to match (`planned_gi_date`, `delivery_id`, `plant_id`). **Likely works.** |
| `GET /api/warehouse360/staging` | `connected_plant_uat.wh360.staging_orders_v` | **DOES NOT EXIST** | `TABLE_OR_VIEW_NOT_FOUND: connected_plant_uat.wh360.staging_orders_v`. The view was never created in UAT. Staging route will return HTTP 500 in production. |
| `GET /api/warehouse360/exceptions` | `connected_plant_uat.wh360.wh360_imwm_exceptions_v` | **DOES NOT EXIST** | `TABLE_OR_VIEW_NOT_FOUND: connected_plant_uat.wh360.wh360_imwm_exceptions_v`. The correct view name is `imwm_exceptions_v` (without `wh360_` prefix). Exceptions route will return HTTP 500 in production. |

These routes have `response_model` enforcement, tests pass (using mock Databricks), and are documented as `complete-contract-binding` — but they **fail against live Databricks** due to schema mismatches. This must be raised with the data platform team.

---

## Why `nearExpiryCount` and `reconciliationExceptionCount` require governance

**`nearExpiryCount` — threshold undefined:**
`wh360_near_expiry_batches_v` contains ALL batches with days_to_expiry from -3505 (expired 9+ years ago) to +90. The view name implies a "near expiry" filter exists at the view level — it does not. The data platform has not defined what "near" means (30 days? 45 days? 90 days?). Selecting all rows in the view would be misleading. A business-confirmed threshold is required.

**`reconciliationExceptionCount` — exception semantics:**
`imwm_exceptions_v` in UAT is dominated by `EXPIRED_BATCH_WITH_STOCK` across all 109 plants (33K–50K rows per plant). These are not IM/WM quantity reconciliation mismatches — they represent stock records where the batch expiry date has passed but stock is still recorded as present. Whether these count as "reconciliation exceptions" in the `Warehouse360Overview` context is a governance question.

---

## Recommended decision: Option C — confirmed

### What Databricks verification confirmed

1. **`wh360_kpi_snapshot_v`**: only 11 V1 KPI columns. None of the contract fields exist. Confirmed blocked.
2. **Derivation path exists for 7 of 9 count fields** from other views (`wh360_inbound_v`, `wh360_deliveries_v`, `wh360_process_orders_v`, `imwm_stock_comparison_v`). Each requires a multi-subquery overview SQL.
3. **2 count fields blocked by governance**: `nearExpiryCount` (threshold) and `reconciliationExceptionCount` (exception type semantics).
4. **`plantId`**: safely populated from the request param (same pattern as `warehouseId`).
5. **3 of 4 other WH360 native routes are broken in production** due to schema mismatches — the data platform must fix these before the WH360 overview makes sense to wire.

### Implementation prerequisites (raised with data platform)

Before the overview mapper can be safely rewritten:

1. **Fix `wh360_inbound_v` column names**: the view has `po_id`, `doc_type`, `delivery_date`, `delivery_complete`, `open_qty` etc. The inbound adapter SQL references `DOCUMENT_TYPE`, `PURCHASE_ORDER_ID`, `WAREHOUSE_NUMBER`, `EXPECTED_DATE`, `RECEIVED_DATE`, `QUANTITY`, `UNIT_OF_MEASURE`, `STATUS`, `EXCEPTION_REASON`. Either the view needs to be updated or the adapter SQL needs to be rewritten to match the actual columns.

2. **Create or rename `staging_orders_v`**: the staging route adapter references `connected_plant_uat.wh360.staging_orders_v` which does not exist. The closest available view is `wh360_process_orders_v`. Either create a new view with the right schema, or update the adapter SQL to use `wh360_process_orders_v` with correct column mapping.

3. **Create or rename `wh360_imwm_exceptions_v`**: the exceptions route references `wh360_imwm_exceptions_v` which does not exist. The correct name is `imwm_exceptions_v`. Either rename the view or update the adapter SQL.

4. **Confirm near-expiry threshold**: what `days_to_expiry` range constitutes "near expiry" in the overview KPI?

5. **Confirm reconciliation exception type filter**: should `reconciliationExceptionCount` include all `imwm_exceptions_v` rows, or only specific `exception_type` values (excluding `EXPIRED_BATCH_WITH_STOCK`)?

### When implementation is unblocked

Once the above prerequisites are resolved, the overview mapper rewrite is a deterministic SQL implementation:

```sql
SELECT
    :warehouse_id                                                     AS warehouse_id,
    :plant_id                                                         AS plant_id,
    COUNT(CASE WHEN delivery_date >= CURRENT_DATE
               AND delivery_complete != 'Y'
               AND open_qty > 0 THEN 1 END)                           AS inbound_due_count,
    COUNT(CASE WHEN delivery_date < CURRENT_DATE
               AND delivery_date != '0000-00-00'
               AND delivery_complete != 'Y'
               AND open_qty > 0 THEN 1 END)                           AS inbound_overdue_count,
    -- + similar subqueries for outbound (wh360_deliveries_v), staging (wh360_process_orders_v),
    -- near_expiry (wh360_near_expiry_batches_v, threshold TBD),
    -- reconciliation_exception (imwm_exceptions_v, filter TBD),
    -- blocked_stock (imwm_stock_comparison_v, blocked_qty > 0)
FROM connected_plant_uat.wh360.wh360_inbound_v
WHERE plant_id = :plant_id
```

Or structured as a single-row result from a multi-subquery:

```sql
SELECT
    (SELECT COUNT(*) FROM ... WHERE ...) AS inbound_due_count,
    (SELECT COUNT(*) FROM ... WHERE ...) AS inbound_overdue_count,
    ...
```

---

## Impact on existing tests

`apps/api/tests/routes/test_warehouse360_routes.py` — `test_returns_200_with_mapped_overview` asserts V1-style keys (`ordersTotal`, `inboundOpen`, `binUtilPct`). This test remains correct until the mapper is rewritten — it documents current V1 KPI behaviour.

---

## Summary

| Item | Status |
|---|---|
| `wh360_kpi_snapshot_v` DDL | **Confirmed** — 11 V1 KPI columns only; no contract fields |
| Available alternative views | 6 views identified with DDL confirmed |
| Fields safely derivable from confirmed views | 7 of 9 count fields + `plantId` + `warehouseId` |
| Fields blocked by governance | 2: `nearExpiryCount` (threshold unknown), `reconciliationExceptionCount` (exception type semantics) |
| WH360 schema mismatches found | **3 of 4 other native routes broken**: `wh360_inbound_v` wrong column names; `staging_orders_v` missing; `wh360_imwm_exceptions_v` missing |
| Frontend adapter expectation | Already expects contract shape; silently returns 0 for all counts |
| `response_model` safe to add now? | **No** |
| Recommended option | **C** — no runtime changes until: (1) data platform fixes view name/column mismatches; (2) governance confirms near-expiry threshold and exception type filter |
