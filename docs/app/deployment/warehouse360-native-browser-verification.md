# Warehouse360 Native API — Browser Verification Log

**Domain:** Warehouse360
**Routes:** `GET /api/warehouse360/{overview,inbound,outbound,staging,exceptions}`
**Source schema:** Unity Catalog — `connected_plant_uat.wh360.*`
**Adapters:** `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`
**Routes file:** `apps/api/routes/warehouse360.py`

> **Authoritative status lives in [`docs/deployment/uat-evidence-ledger.md`](./uat-evidence-ledger.md)** — this file is the per-route detail log.

---

## Current Status: SCHEMA-BLOCKED on 4 of 5 routes (2026-05-18, commit `491c6a6`)

| Route | Status | View | Reason |
|---|---|---|---|
| W1 Overview | **API BV passed** | `wh360_kpi_snapshot_v` | HTTP 200, 12-key global KPI payload. LIMIT 1. No `WHERE`. |
| W2 Inbound | **query/schema blocked** | `wh360_inbound_v` (exists) | View has 19 columns, NO warehouse column at all. Adapter expects `WAREHOUSE_NUMBER`/`PURCHASE_ORDER_ID`/etc. |
| W3 Outbound | **query/schema blocked** | `wh360_deliveries_v` (exists) | Warehouse column is `lgnum`, dates are `planned_gi_date`/`actual_gi_date`. Adapter expects different names. |
| W4 Staging | **source/config blocked** | `staging_orders_v` (does not exist) | `SHOW TABLES LIKE 'staging*'` returns 0. Candidate: `wh360_process_orders_v` (schema not yet probed). |
| W5 Exceptions | **source/config + query/schema blocked** | `wh360_imwm_exceptions_v` (wrong name; actual is `imwm_exceptions_v`) | Real view has 13 cols, no warehouse, severity is `int`, no UoM/expiry/document refs. |

**Important:** `wh360_kpi_snapshot_v` is a single-row **global** KPI snapshot — not warehouse-filtered. The `warehouse_id` query param is sent but ignored by the SQL. UI/docs must say "Overview KPI snapshot is global/site-level, not filtered by warehouse." (Remediation backlog WH-005.)

---

## DDL Evidence (direct Databricks statement API, 2026-05-18)

### `connected_plant_uat.wh360.wh360_inbound_v` (19 columns)

```
po_id              string  Purchasing Document Number
po_item            string  Item Number of Purchasing Document
doc_type           string  Purchasing Document Type
doc_cat            string  Purchasing Document Category
vendor_id          string  Suppliers Account Number
vendor_name        string
plant_id           string  Plant
storage_loc        string  Storage Location
material_id        string  Material Number
material_name      string  Material Description
ordered_qty        decimal(13,3)
gr_qty             decimal(13,3)
uom                string
delivery_date      string
po_date            string
delivery_complete  string
open_qty           decimal(13,3)
qa_lot_id          string
qa_status          string
```

There is **no `warehouse_number` column** — this view is plant-scoped only.

### `connected_plant_uat.wh360.wh360_deliveries_v` (20 columns)

```
delivery_id        string  Delivery
delivery_type      string  Delivery Type
plant_id           string  Receiving plant for deliveries
customer_id        string  Sold-To Party
customer_name      string
carrier            string  Route
lgnum              string  Warehouse Number / Warehouse Complex   ← warehouse filter goes here
planned_gi_date    string  Planned goods movement date
actual_gi_date     string  Actual Goods Movement Date
loading_date       string  Loading Date
delivery_date      string  Delivery Date
gross_weight       decimal(15,3)
weight_uom         string
packages           string
wm_status          string  Distribution Status (Decentralized WM)
mins_to_cutoff     decimal(27,6)
pick_pct           decimal(38,11)
line_count         bigint
risk               string
shipped            boolean
```

### `connected_plant_uat.wh360.imwm_exceptions_v` (13 columns — NOT `wh360_imwm_exceptions_v`)

```
exception_type     string
severity           int      ← integer, not string
sla_hours          int
material_id        string
material_name      string
plant_id           string
storage_loc        string
storage_loc_name   string
qty                decimal(25,3)
batch_id           string
bin_id             string
detail_text        string
detected_date      date
```

### `staging_orders_v` — does not exist

`SHOW TABLES IN connected_plant_uat.wh360 LIKE 'staging*'` → 0 rows.
Possible replacement to probe: `wh360_process_orders_v` (exists).

### Full view inventory in `connected_plant_uat.wh360` (15 views)

```
imwm_analytics_aging_v
imwm_exceptions_v
imwm_movements_v
imwm_stock_comparison_v
wh360_bin_stock_v
wh360_deliveries_v
wh360_dispensary_tasks_v
wh360_handling_units_v
wh360_inbound_v
wh360_kpi_snapshot_v
wh360_lineside_stock_v
wh360_near_expiry_batches_v
wh360_process_orders_v
wh360_transfer_orders_v
wh360_transfer_requirements_v
```

---

## API Verification Records

### W1 — Overview — **API BV PASSED**

```
GET /api/warehouse360/overview?warehouse_id=104
```

- HTTP 200, x-data-source: databricks-api, x-query-name: `warehouse360.get_overview`
- 12 keys: `warehouseId, ordersTotal, ordersRed, ordersAmber, trsOpen, tosOpen, deliveriesToday, deliveriesAtRisk, inboundOpen, binsBlocked, binsTotal, binUtilPct`
- View: `wh360_kpi_snapshot_v` (LIMIT 1, no WHERE — global)
- **Caveat:** result is global, not warehouse-filtered (P1 copy fix WH-005).

### W2 — Inbound — **query/schema blocked**

```
GET /api/warehouse360/inbound?warehouse_id=104&plant_id=C061&date_from=2026-01-01&date_to=2026-05-18&limit=100
```

- HTTP 502, body `{"detail":"Databricks query execution failed"}`
- App log captured the actual error (after `491c6a6` added logging):
  `Databricks query 'warehouse360.get_inbound' failed: [UNRESOLVED_COLUMN.WITH_SUGGESTION] WAREHOUSE_NUMBER cannot be resolved. Suggestions: delivery_date, doc_cat, doc_type, gr_qty, material_id. SQLSTATE: 42703; line 22 pos 10`
- Cause: adapter SELECT/WHERE references columns that do not exist. View is PO-tracking, not warehouse-tracking.
- Unblock: P0 backlog item WH-001 (adapter rewrite).

### W3 — Outbound — **query/schema blocked**

- HTTP 502. Adapter expects `WAREHOUSE_NUMBER`; actual column is `lgnum`. Also `PLANNED_GOODS_ISSUE_DATE` vs `planned_gi_date`, `ACTUAL_GOODS_ISSUE_DATE` vs `actual_gi_date`, and several other adapter columns (`delivery_item_id`, `sales_order_id`, `material_id`, `storage_location`, `status`, `exception_reason`) are not in the view.
- Unblock: P0 backlog item WH-002.

### W4 — Staging — **source/config blocked**

- HTTP 502. View `staging_orders_v` does not exist.
- Unblock: P0 backlog item WH-003 (probe `wh360_process_orders_v` first).

### W5 — Exceptions — **source/config + query/schema blocked**

- HTTP 502. View `wh360_imwm_exceptions_v` does not exist (actual is `imwm_exceptions_v`). Even with renamed view, schema is materially different (no warehouse col, severity is int, no UoM/expiry/document refs).
- Unblock: P0 backlog item WH-004.

---

## Pre-UAT Config Checklist

- [x] `WH360_CATALOG=connected_plant_uat` confirmed in `app.yaml`
- [x] `WH360_SCHEMA=wh360` (default, confirmed correct via DDL probe)
- [x] Known `warehouse_id` for UAT: **104** and **105**
- [x] App deployed from commit `491c6a6` via `npm run deploy:databricks` (active deployment `01f152f3...`)
- [x] State: RUNNING

---

## Verification History

| Date | Commit | Route | Status | HTTP | Notes |
|------|--------|-------|--------|------|-------|
| 2026-05-18 | `0b9d868` | all 5 | CONFIG-BLOCKED | 503 | WH360_CATALOG not yet set |
| 2026-05-18 | `9b50467` | overview | SOURCE-PENDING | n/a | `wh360_cockpit_summary_v` does not exist |
| 2026-05-18 | `9d23a04` | all 4 lists | 502 | 502 | `LIMIT :max_rows` incompatible — fixed via literal LIMIT |
| 2026-05-18 | `dac5146` | overview | **HTTP 200** | 200 | `wh360_kpi_snapshot_v` confirmed, LIMIT 1, no WHERE |
| 2026-05-18 | `dac5146` | outbound | DDL-BLOCKED | 502 | `wh360_deliveries_v` exists, no `WAREHOUSE_NUMBER` |
| 2026-05-18 | `dac5146` | staging | SOURCE-BLOCKED | 502 | `staging_orders_v` does not exist |
| 2026-05-18 | `dac5146` | exceptions | SOURCE-BLOCKED | 502 | `wh360_imwm_exceptions_v` does not exist |
| 2026-05-18 | `491c6a6` | **all 5** | **DDL evidence captured** | n/a | Direct DESCRIBE TABLE via statement API; W2 inbound also confirmed schema-blocked; exceptions view name found (`imwm_exceptions_v`). See ledger. |
