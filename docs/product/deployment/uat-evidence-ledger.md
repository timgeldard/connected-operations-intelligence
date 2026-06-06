# UAT Evidence Ledger

**Single source of truth for current UAT verification status.**
Every claim in this file is tied to a dated, SHA-anchored test executed against the deployed Databricks App. Speculative status is not allowed.

---

## Test environment

| Field | Value |
|---|---|
| App URL | https://connectio-v2-604667594731808.8.azure.databricksapps.com |
| Commit SHA tested | `491c6a6` (g.txt + h.txt sweep, deploy script with force restart) |
| Deployment | `npm run deploy:databricks` → bundle deploy + apps stop/start (force restart) |
| Active deployment | `01f152f051f21275bb063953244fd5e7` SUCCEEDED 2026-05-18T19:33:08Z (then `01f152f3...` for the logging fix) |
| Catalog | `connected_plant_uat` |
| Local tests | 690 API pytests pass; di-traceability vitest pass |
| Static assets | Rebuilt and committed in `b6813b3`, `518d9bb`, `7f572d9` |
| Tester | Tim Geldard (UAT browser + Claude direct SQL via Databricks statement API) |
| Date | 2026-05-18 |

**Runtime config confirmed (apps/api/app.yaml):**
- `BACKEND_ADAPTER_MODE=databricks-api`
- `DATABRICKS_HOST=https://adb-604667594731808.8.azuredatabricks.net`
- `SQL_WAREHOUSE_ID=e76480b94bea6ed5`
- `user_api_scopes: [sql]`
- `TRACE_CATALOG=connected_plant_uat`, `TRACE_SCHEMA=gold` (default)
- `WH360_CATALOG=connected_plant_uat`, `WH360_SCHEMA=wh360` (default in `object_resolver.py`)
- POH/CQ: `POH_CATALOG=connected_plant_uat`, schema defaults to `csm_process_order_history`
- EnvMon shares `TRACE_CATALOG`/`TRACE_SCHEMA`
- No SPN/PAT fallback. OAuth user token only.

---

## Status taxonomy

Allowed statuses (no others):
- `API BV passed` — API HTTP fetch returned valid data with correct headers
- `UI BV passed` — UI route rendered real data end-to-end in browser
- `partial BV` — some routes/views verified, others outstanding within the same domain
- `executable pending BV` — code/SQL works locally, browser fetch not yet run
- `source/config blocked` — required UAT source object (view/catalog/schema) does not exist
- `permission blocked` — OAuth user cannot read the resource
- `query/schema blocked` — view exists but adapter SQL is incompatible with actual columns
- `mock/demo only` — explicitly mock by design, banner present
- `deferred/out of scope` — explicitly out of scope for current tranche

---

## Trace

| Domain | Screen URL | Status |
|---|---|---|
| Traceability | `?workspace=traceability-workspace` | **API BV passed**, **UI BV passed** |

### API

| Route | Payload | HTTP | x-data-source | x-query-name | Result | Source |
|---|---|---|---|---|---|---|
| `POST /api/trace2/trace-graph` | `{material_id:20052009, batch_id:0008602411, plant_id:C061, direction:both, max_depth:2, max_edges:100}` | **200** | `databricks-api` | `trace2.get_trace_graph` | 7 nodes, 7 edges, depthReached=1, truncated=false, no warnings | `gold_batch_lineage` (WITH RECURSIVE) |

### UI

- Screen: real Trace Investigation workspace, not a placeholder.
- `TraceQueryForm` visible. Material/batch/plant fields populated from URL/payload.
- `Run Trace` calls native route; graph renders real Databricks data.
- Layout fix (this tranche): hid action sidebar for `trace-tree` view (`commit 55171f3`) and added `gridColumn: '1 / -1'` so the graph spans the full grid width (`commit 518d9bb`). Previously squashed into ~400 px column.
- Header chips, summary stats, direction toggle, link-type legend, timeline, exposure indicators, source banner all render.
- `BatchHeaderPanel` failure (V1 not running) does not break the graph.
- `RiskSignalsPanel` correctly absent from `trace-tree` view.

### Issues & fixes (this tranche)
- Action sidebar squashed graph — fixed.
- Single-column trace-tree didn't span full grid width — fixed.

### Remaining gaps
- None for the trace-graph route. Other Trace views (mass-balance, customer-exposure, supplier-exposure, timeline-events, recall-readiness) still on mock context and not part of g.txt/h.txt scope.

---

## EnvMon

| Domain | Screen URL | Status |
|---|---|---|
| EnvMon | `?workspace=envmon-monitoring` | **API BV passed**, **UI BV passed** |

### API

| Route | HTTP | x-data-source | x-query-name | Result |
|---|---|---|---|---|
| `GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18` | **200** | `databricks-api` | `envmon.get_site_summary` | 12-key summary object (plantId, zonesMonitored, positiveCount, positiveRate, openCorrectiveActions, overdueActions, complianceRate, riskStatus, highestSeverity, confidence, …). complianceRate=0 = truthful empty for this period. |
| `GET /api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18&limit=100` | **200** | `databricks-api` | `envmon.get_swab_results` | 0 rows — truthful empty for this plant/period |

### UI
- Confirmed by user 2026-05-18: native-monitoring renders, plant/date inputs visible, source banner visible, no CAPA, no write-back.

### Issues / Remaining gaps
- None this tranche. Domain stable.

---

## Warehouse360

| Domain | Screen URL | Status |
|---|---|---|
| Warehouse360 | `?workspace=warehouse-360-overview` | **partial BV** — 1 of 5 routes passed |

### Known UAT warehouse IDs
- `104`, `105`. WH001 is NOT real.

### Per-route results

| Route | HTTP | x-query-name | View | Result | Status |
|---|---|---|---|---|---|
| `GET /api/warehouse360/overview?warehouse_id=104` | **200** | `warehouse360.get_overview` | `wh360_kpi_snapshot_v` | 12-key payload: warehouseId, ordersTotal, ordersRed, ordersAmber, trsOpen, tosOpen, deliveriesToday, deliveriesAtRisk, inboundOpen, binsBlocked, binsTotal, binUtilPct | **API BV passed** |
| `GET /api/warehouse360/inbound?warehouse_id=104&...` | **502** | `warehouse360.get_inbound` (logged) | `wh360_inbound_v` | `[UNRESOLVED_COLUMN.WITH_SUGGESTION] WAREHOUSE_NUMBER cannot be resolved. Suggestions: delivery_date, doc_cat, doc_type, gr_qty, material_id`. SQLSTATE 42703. Actual schema: 19 columns, PO-centric (`po_id, po_item, doc_type, vendor_id, plant_id, material_id, ordered_qty, gr_qty, delivery_date, …`). No warehouse column at all. | **query/schema blocked** |
| `GET /api/warehouse360/outbound?warehouse_id=104&...` | **502** | `warehouse360.get_outbound` | `wh360_deliveries_v` | View exists with 20 columns including `lgnum` ("Warehouse Number / Warehouse Complex"). Adapter expects `WAREHOUSE_NUMBER`, `PLANNED_GOODS_ISSUE_DATE`, `ACTUAL_GOODS_ISSUE_DATE`, `DELIVERY_ITEM_ID`, `SALES_ORDER_ID`, `STORAGE_LOCATION`, `STATUS`, `EXCEPTION_REASON`. Actual cols: `delivery_id, delivery_type, plant_id, customer_id, customer_name, carrier, lgnum, planned_gi_date, actual_gi_date, loading_date, delivery_date, gross_weight, weight_uom, packages, wm_status, mins_to_cutoff, pick_pct, line_count, risk, shipped`. | **query/schema blocked** |
| `GET /api/warehouse360/staging?warehouse_id=104&...` | **502** | `warehouse360.get_staging` | `staging_orders_v` | `SHOW TABLES LIKE 'staging*'` returned 0 rows. View does not exist in `connected_plant_uat.wh360`. Candidate replacement: `wh360_process_orders_v` (schema not yet probed). | **source/config blocked** |
| `GET /api/warehouse360/exceptions?warehouse_id=104&...` | **502** | `warehouse360.get_exceptions` | `wh360_imwm_exceptions_v` | View name wrong: actual is `imwm_exceptions_v` (13 cols: exception_type, severity (int!), sla_hours, material_id, material_name, plant_id, storage_loc, storage_loc_name, qty, batch_id, bin_id, detail_text, detected_date). Even with renamed view, adapter expects `WAREHOUSE_NUMBER`, `UNIT_OF_MEASURE`, `EXPIRY_DATE`, `DAYS_TO_EXPIRY`, `DOCUMENT_ID`, `PROCESS_ORDER_ID`, `DELIVERY_ID`, `PURCHASE_ORDER_ID`, `REASON`, `RECOMMENDED_REVIEW_ACTION` — none of these exist. | **source/config + query/schema blocked** |

### Source object inventory (`SHOW TABLES IN connected_plant_uat.wh360` — 15 views found)

```
imwm_analytics_aging_v
imwm_exceptions_v              ← exists, but adapter has wrong name and schema
imwm_movements_v
imwm_stock_comparison_v
wh360_bin_stock_v
wh360_deliveries_v             ← exists, schema mismatch (lgnum vs WAREHOUSE_NUMBER)
wh360_dispensary_tasks_v
wh360_handling_units_v
wh360_inbound_v                ← exists, no warehouse column at all
wh360_kpi_snapshot_v           ← used by Overview, PASSED
wh360_lineside_stock_v
wh360_near_expiry_batches_v
wh360_process_orders_v         ← candidate replacement for staging_orders_v
wh360_transfer_orders_v
wh360_transfer_requirements_v
```

### Overview = global, not warehouse-filtered

`wh360_kpi_snapshot_v` is a single-row global KPI snapshot.
The adapter has `params={}` and `WHERE` clause omitted. `LIMIT 1` returns the global row regardless of `warehouse_id`.
UI/docs MUST state this. Currently `warehouse_id` is in the URL but is not applied — needs UI copy correction (P1).

### Issues / fixes (this tranche)
- Added server-side logging of `DatabricksQueryError` detail in `routes/_databricks.py` (commit `491c6a6`) so future UAT diagnostics show the actual SQL error in logs rather than the generic "Databricks query execution failed".
- Verified actual UAT DDL for all 5 views by direct `DESCRIBE TABLE` via the Databricks statement API.

### Remaining gaps
- W2/W3/W4/W5 all require an adapter rewrite tranche. Schema mismatch is too broad for the "small fix only" scope. See remediation backlog P0 items.

---

## Process Order History

| Domain | Screen URL | Status |
|---|---|---|
| Process Order History | `?workspace=process-order-review` | **API BV passed (SQL layer)**, **executable pending BV (HTTP/UI layer)** |

### Test orders
- `7006965038` (h.txt candidate): exists, plant=`C113` (NOT IE10 as h.txt suggested), status=CLOSED, material `70373871` "MIXED BERRY FLV LQD". Header + 11 ops present, 0 confirmations, 0 movements (sparse — likely archived).
- `7006965039` (better test): plant `C113`, BLOOD ORANGE MP-01565, 13 ops, **15 confirmations** (sample: 375 KG, real timestamps 2025-10-31, 2025-11-03), 0 movements.
- `7006965479`: 901 movements (sample: MATERIAL_ID 20029773, MOVEMENT_TYPE=261 "Goods Issues").

### Per-route SQL evidence (direct DESCRIBE + SELECT via Databricks statement API)

| Route | View | Schema match | Rows | Status |
|---|---|---|---|---|
| `POST /api/por/order-header` | `vw_gold_process_order` | ✓ all 6 cols present (PROCESS_ORDER_ID, STATUS, MATERIAL_ID, MATERIAL_DESCRIPTION, PLANT_ID, INSPECTION_LOT_ID) | 1 | **SQL OK** |
| `GET /api/por/order-operations` | `vw_gold_process_order_phase` | ✓ adapter cols present | 11–13 | **SQL OK** |
| `GET /api/por/order-confirmations` | `vw_gold_confirmation` | ✓ adapter cols present, 1,711 total rows in view | 0 (038) / 15 (039) | **SQL OK** |
| `GET /api/por/order-goods-movements` | `vw_gold_adp_movement` | ✓ adapter cols present, 5,933 total rows in view | 0 (038) / 901 (479) | **SQL OK** |

### Outstanding for UI

- HTTP fetch needs user to confirm response shape + headers (high confidence given SQL works + 690 unit tests pass).
- UI tab-walk at `?workspace=process-order-review` not yet performed.
- Check whether `dateFrom/dateTo/limit` controls are applied or planned/diagnostic only.

### Issues / fixes (this tranche)
- h.txt test order `7006965038` plant is `C113`, not `IE10` as the brief stated. Documented above.

### Remaining gaps
- HTTP/UI browser verification pending (user can do later — per user direction).

---

## SPC

| Domain | Screen URL | Status |
|---|---|---|
| SPC | `?workspace=spc-monitoring` | **mock/demo only** (intentional) |

- Code-level confirmed (commit `4a1ebd6` and this tranche): `SPCSandboxBanner` is imported and rendered in all 6 view files:
  - `chart-overview-view.tsx`
  - `active-signals-view.tsx`
  - `characteristic-review-view.tsx`
  - `capability-view.tsx`
  - `alarm-history-view.tsx`
  - `chart-configuration-readonly-view.tsx`
- `spc-monitoring-registration.ts` lists exactly these 6 view IDs.
- Mock/in-memory data source. No native/live claim. No CAPA. No write-back.

### Remaining gaps
- UI tab-walk verification pending user (low risk — banner is on every tab in code).
- SPC native is explicitly out of scope per non-negotiables.

---

## Final classification

| Status | Routes |
|---|---|
| **Native verified (API + UI BV)** | Trace `get_trace_graph` (with this tranche's layout fixes), EnvMon `get_site_summary`, EnvMon `get_swab_results` |
| **API BV passed (SQL/HTTP), UI BV pending** | WH360 `get_overview` (HTTP confirmed by user) |
| **Executable pending BV** | POH `get_process_order_header`, `get_order_operations`, `get_order_confirmations`, `get_order_goods_movements` (SQL verified by Claude, HTTP/UI pending user) |
| **query/schema blocked** | WH360 `get_inbound` (no warehouse col in view), `get_outbound` (cols are `lgnum/planned_gi_date/...` not `WAREHOUSE_NUMBER/PLANNED_GOODS_ISSUE_DATE/...`) |
| **source/config blocked** | WH360 `get_staging` (view doesn't exist), `get_exceptions` (wrong view name AND wrong schema) |
| **mock/demo only** | SPC monitoring (all 6 views, banner confirmed on every tab) |

---

## Confirmations (this tranche)

- No service-principal fallback added.
- No PAT fallback added.
- No mock fallback added for native routes.
- No SQL in React.
- No SQL in FastAPI route handlers (still flows through QuerySpec / QueryExecutor).
- No write-back, recall, CAPA, SPC native built.
- No unsupported live claims published in docs.
- No broad feature expansion.
