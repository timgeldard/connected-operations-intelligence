# Databricks Repository Compatibility Audit — 2026-05-25

Read-only audit of the DatabricksRepository-backed routes on `main`, comparing
every QuerySpec factory against live Unity Catalog metadata.

- **Run timestamp:** 2026-05-25 (Europe/London)
- **Auditor:** Tim Geldard (tim.geldard@kerry.com)
- **Workspace:** `https://adb-604667594731808.8.azuredatabricks.net` (Azure)
- **CLI profile:** `uat`
- **SQL warehouse:** `e76480b94bea6ed5` (`connected_plant_uat`, Medium, serverless, HEALTHY)
- **Catalogs inspected:** `connected_plant_uat`
- **Schemas inspected:** `gold`, `wh360`, `csm_process_order_history`
- **Code reference:** `apps/api/adapters/{quality,spc,poh,warehouse360,envmon,cq,trace2}/*_databricks_adapter.py`
- **Adapter mode required:** `BACKEND_ADAPTER_MODE=databricks-api`

No writes were performed. Read calls were `SHOW SCHEMAS`, `SHOW TABLES LIKE`,
and `DESCRIBE TABLE` only. Raw JSON outputs persisted to `C:\Temp\desc_*.json`
during the audit session for re-inspection.

---

## 1. Methodology

**Scope expansion note:** the audit brief listed Quality, SPC chart-data /
subgroups, POH, Warehouse 360, EnvMon, and Connected Quality Lab as focus
routes. Trace2 is not explicitly named in the brief but is the largest
DatabricksRepository-backed surface on `main` and shares the same
infrastructure (`object_resolver.py`, `DatabricksRepository`). It was
included so the compatibility check covers every live `databricks-api`
route on `main` — one of the two FAIL findings is in trace2.

1. Inventoried every QuerySpec factory in the seven domain adapters (33 specs).
2. Mapped each spec to its FastAPI route in `apps/api/routes/`.
3. Resolved each spec's catalog/schema/object reference via
   `apps/api/shared/query_service/object_resolver.py` and verified the resolved
   identifiers against the active workspace's `databricks.yml`
   (`POH_CATALOG = CQ_CATALOG = WH360_CATALOG = connected_plant_uat`,
   `TRACE_CATALOG = connected_plant_uat` by env, `*_SCHEMA` defaults
   `gold` / `csm_process_order_history` / `wh360` per adapter).
4. Issued one bounded SQL statement per unique catalog.schema.object
   (`DESCRIBE TABLE`) using the Statement Execution API
   (`POST /api/2.0/sql/statements`) against the UAT warehouse.
5. Cross-checked every referenced column and bind parameter against the
   resulting `col_name : data_type` list.

No SQL was modified by this audit. The two failures noted below are
recommended for separate, route-scoped follow-up PRs (Section 5).

---

## 2. Routes audited

| Route                                     | Repository class                 | Adapter mode   |
| ----------------------------------------- | -------------------------------- | -------------- |
| `POST /api/quality/read-only-evidence`    | `QualityUsageDecisionRepository` | databricks-api |
| `POST /api/spc/chart-data`                | `SpcChartDataRepository`         | databricks-api |
| `GET  /api/spc/subgroups`                 | `SpcSubgroupsRepository`         | databricks-api |
| `POST /api/por/order-header`              | `PohRepository`                  | databricks-api |
| `POST /api/por/order-operations`          | `PohRepository`                  | databricks-api |
| `POST /api/por/order-confirmations`       | `PohRepository`                  | databricks-api |
| `POST /api/por/order-goods-movements`     | `PohRepository`                  | databricks-api |
| `GET  /api/warehouse360/overview`         | `Warehouse360Repository`         | databricks-api |
| `GET  /api/warehouse360/inbound`          | `Warehouse360Repository`         | databricks-api |
| `GET  /api/warehouse360/outbound`         | `Warehouse360Repository`         | databricks-api |
| `GET  /api/warehouse360/staging`          | `Warehouse360Repository`         | databricks-api |
| `GET  /api/warehouse360/exceptions`       | `Warehouse360Repository`         | databricks-api |
| `GET  /api/envmon/site-summary`           | `EnvMonRepository`               | databricks-api |
| `GET  /api/envmon/swab-results`           | `EnvMonRepository`               | databricks-api |
| `GET  /api/cq/lab/plants`                 | `CqLabRepository`                | databricks-api |
| `POST /api/trace2/batch-header`           | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/trace-graph`            | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/mass-balance`           | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/customer-exposure`      | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/customer-deliveries`    | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/supplier-exposure`      | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/production-history`     | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/recall-readiness`       | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/supplier-batches`       | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/batch-quality-passport` | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/mass-balance-ledger`    | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/investigation-timeline` | `Trace2DatabricksRepository`     | databricks-api |
| `POST /api/trace2/holds-ledger`           | `Trace2DatabricksRepository`     | databricks-api |

---

## 3. Objects inspected

All 26 referenced UC objects were located. Live column lists captured via
`DESCRIBE TABLE` (raw outputs at `C:\Temp\desc_<object>.json`).

### `connected_plant_uat.gold`

`gold_inspection_usage_decision`, `gold_inspection_lot`, `gold_inspection_point`,
`gold_batch_quality_result_v`, `gold_plant`, `gold_batch_summary_v`,
`gold_batch_stock_v`, `gold_material`, `gold_batch_lineage`,
`gold_batch_mass_balance_v`, `gold_batch_delivery_v`, `gold_supplier`,
`gold_batch_production_history_v`, `gold_batch_quality_lot_v`,
`gold_batch_quality_summary_v`, `spc_quality_metric_subgroup_mv`,
`spc_locked_limits`.

### `connected_plant_uat.wh360`

`wh360_kpi_snapshot_v`, `wh360_inbound_v`, `wh360_deliveries_v`,
`wh360_process_orders_v`, `imwm_exceptions_v`.

### `connected_plant_uat.csm_process_order_history`

`vw_gold_process_order`, `vw_gold_process_order_phase`,
`vw_gold_confirmation`, `vw_gold_adp_movement`.

---

## 4. Pass / fail per QuerySpec

Status legend: **PASS** = every referenced column resolved against live DDL,
every bind parameter referenced in SQL is supplied by `params` and vice versa.
**FAIL** = SQL references at least one column that does not exist in the live
view, or a bind parameter mismatch was detected. Pre-existing known gaps that
were already documented in the adapter docstring or `traceability-defect-backlog.md`
are recorded as **PASS (advisory note)** when the SQL still executes.

| #   | QuerySpec                                                   | Route                                     | Status          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------- | ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `quality.get_usage_decision`                                | `POST /api/quality/read-only-evidence`    | PASS            | All columns from `gold_inspection_usage_decision` and `gold_inspection_lot` resolved. Conditional `:plant_id` bind is symmetric (added to SQL and params together).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | `spc.get_subgroups`                                         | `GET /api/spc/subgroups`                  | PASS            | All columns present in `spc_quality_metric_subgroup_mv`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3   | `spc.get_chart_data`                                        | `POST /api/spc/chart-data`                | PASS            | 27 columns referenced, all present in `spc_quality_metric_subgroup_mv`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | `spc.get_locked_limits`                                     | `POST /api/spc/chart-data`                | PASS            | All 15 columns and 5 filter columns present in `spc_locked_limits`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | `poh.get_process_order_header`                              | `POST /api/por/order-header`              | PASS            | All 6 columns present in `vw_gold_process_order`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | `poh.get_order_operations`                                  | `POST /api/por/order-operations`          | PASS            | All 10 columns present in `vw_gold_process_order_phase`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7   | `poh.get_order_confirmations`                               | `POST /api/por/order-confirmations`       | PASS            | All 11 columns present in `vw_gold_confirmation`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | `poh.get_order_goods_movements`                             | `POST /api/por/order-goods-movements`     | PASS            | All 10 columns present in `vw_gold_adp_movement`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | `warehouse360.get_overview`                                 | `GET /api/warehouse360/overview`          | PASS            | All 11 KPI columns present in `wh360_kpi_snapshot_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 10  | `warehouse360.get_inbound`                                  | `GET /api/warehouse360/inbound`           | PASS (advisory) | All 19 columns present. `delivery_date`/`po_date` are stored as `string` not `date` — string comparisons against `:date_from`/`:date_to` work for ISO `YYYY-MM-DD` lexically but are fragile.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 11  | `warehouse360.get_outbound`                                 | `GET /api/warehouse360/outbound`          | **FAIL**        | SQL targets 16 SAP-style uppercase columns (`DELIVERY_ID`, `DELIVERY_ITEM_ID`, `SALES_ORDER_ID`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `BATCH_ID`, `STORAGE_LOCATION`, `WAREHOUSE_NUMBER`, `PLANNED_GOODS_ISSUE_DATE`, `ACTUAL_GOODS_ISSUE_DATE`, `QUANTITY`, `UNIT_OF_MEASURE`, `STATUS`, `EXCEPTION_REASON`, plus `CUSTOMER_ID`, `PLANT_ID`). Live `wh360_deliveries_v` exposes lowercase, semantically-different fields and is delivery-header grain only — no `MATERIAL_ID` / `BATCH_ID` / `DELIVERY_ITEM_ID` / `STORAGE_LOCATION` / `EXCEPTION_REASON` columns exist. **Section 5 finding #1.** |
| 12  | `warehouse360.get_staging`                                  | `GET /api/warehouse360/staging`           | PASS (advisory) | All 18 columns present in `wh360_process_orders_v`. `sched_start`/`planned_start`/`planned_finish` are stored as `string` — same lexical-ISO caveat as inbound.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 13  | `warehouse360.get_exceptions`                               | `GET /api/warehouse360/exceptions`        | PASS            | All 13 columns present in `imwm_exceptions_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 14  | `envmon.get_site_summary`                                   | `GET /api/envmon/site-summary`            | PASS            | All join keys and selected columns present in `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 15  | `envmon.get_swab_results`                                   | `GET /api/envmon/swab-results`            | PASS            | Same three views; all columns from "confirmed-v1" set (`INSPECTION_END_DATE`, `PROCESS_ORDER_ID`, `MATERIAL_ID`, `BATCH_ID` on lot; `SAMPLE_SUMMARY`, `SAMPLE_HOUR` on point; `MIC_ID`, `MIC_CODE`, `RESULT`, `QUALITATIVE_RESULT`, `TARGET_VALUE`, `UNIT_OF_MEASURE`, `INSPECTOR`, `INSPECTION_METHOD` on result) confirmed live. The adapter docstring's "confirmed-v1 (not yet confirmed-ddl)" warning can now be promoted to confirmed-ddl.                                                                                                                                                       |
| 16  | `cq.get_lab_plants`                                         | `GET /api/cq/lab/plants`                  | PASS            | `PLANT_ID`, `PLANT_NAME` present in `gold_plant`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 17  | `trace2.get_batch_header_summary`                           | `POST /api/trace2/batch-header`           | PASS            | 5-way join (`gold_batch_stock_v` + `gold_batch_summary_v` + `gold_material` + `gold_plant`) — every column resolved (Spark SQL is case-insensitive, so `s.unrestricted` resolves to `UNRESTRICTED`).                                                                                                                                                                                                                                                                                                                                                                                                  |
| 18  | `trace2.get_trace_graph`                                    | `POST /api/trace2/trace-graph`            | PASS            | All 18 columns of `gold_batch_lineage` are referenced and present. `POSTING_DATE` is stored as `string` here (vs. `date` in other views) — currently handled as opaque value in the mapper.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 19  | `trace2.get_mass_balance`                                   | `POST /api/trace2/mass-balance`           | PASS (advisory) | All 6 selected columns + 2 filter columns present in `gold_batch_mass_balance_v`. Known correctness gaps `TRACE-P1-010` (`MOVEMENT_CATEGORY` mapping incomplete — live values like "STO Receipt" fall through to `adjustment`) and `TRACE-P1-011` (`BALANCE_QTY` semantics unverified) still apply — these are documented in the adapter docstring and `traceability-defect-backlog.md`; no SQL change required.                                                                                                                                                                                      |
| 20  | `trace2.get_customer_exposure`                              | `POST /api/trace2/customer-exposure`      | PASS (advisory) | All recursive-CTE columns present in `gold_batch_lineage`. Adapter docstring already flags Medium confidence for `LINK_TYPE = 'DELIVERY'` — UAT validation of the live `LINK_TYPE` distribution is a separate follow-up (out of scope for this audit).                                                                                                                                                                                                                                                                                                                                                |
| 21  | `trace2.get_customer_deliveries`                            | `POST /api/trace2/customer-deliveries`    | PASS            | All 9 columns present in `gold_batch_delivery_v` (NB: column is `DELIVERY` not `DELIVERY_ID`; adapter aliases it correctly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 22  | `trace2.get_supplier_exposure`                              | `POST /api/trace2/supplier-exposure`      | PASS            | All lineage columns + `gold_supplier.{SUPPLIER_NAME,COUNTRY_ID,COUNTRY_NAME}` present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 23  | `trace2.get_production_history`                             | `POST /api/trace2/production-history`     | PASS            | All 8 columns present in `gold_batch_production_history_v`. Note: `quality_status` is lowercase per DDL; adapter SQL also uses lowercase — consistent.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 24  | `trace2.get_recall_readiness`                               | `POST /api/trace2/recall-readiness`       | PASS            | All 9 columns present in `gold_batch_delivery_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 25  | `trace2.get_supplier_consumed_lots` & `..._sibling_batches` | `POST /api/trace2/supplier-batches`       | PASS            | All lineage columns present. Sibling-batches branch inlines `vendor_batches` as literals; empty-list branch generates a no-row query without params — symmetric.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 26  | `trace2.get_batch_quality_passport_partial`                 | `POST /api/trace2/batch-quality-passport` | **FAIL**        | (a) Selects `b.PROCESS_ORDER_ID` from `gold_batch_summary_v` — column does **not** exist (live cols: MATERIAL_ID, BATCH_ID, MANUFACTURE_DATE, SHELF_LIFE_EXPIRATION_DATE, MATERIAL_NAME, MATERIAL_TYPE, MATERIAL_DESC_SHORT, days_to_expiry, shelf_life_status). (b) Selects 6 columns from `gold_batch_production_history_v` — `START_DATE`, `CONFIRMED_DATE`, `PLANNED_QTY`, `ACTUAL_QTY`, `PRODUCTION_LINE`, `OPERATOR` — none of which exist (live cols: PROCESS_ORDER_ID, BATCH_ID, PLANT_ID, MATERIAL_ID, POSTING_DATE, BATCH_QTY, UOM, quality_status). **Section 5 finding #2.**              |
| 27  | `trace2.get_passport_coa`                                   | `POST /api/trace2/batch-quality-passport` | PASS            | All 9 selected columns + 3 filter columns present in `gold_batch_quality_result_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 28  | `trace2.get_passport_lots`                                  | `POST /api/trace2/batch-quality-passport` | PASS            | All 5 columns present in `gold_batch_quality_lot_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 29  | `trace2.get_passport_summary`                               | `POST /api/trace2/batch-quality-passport` | PASS            | All 5 columns present in `gold_batch_quality_summary_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 30  | `trace2.get_passport_balance`                               | `POST /api/trace2/batch-quality-passport` | PASS            | All referenced columns present in `gold_batch_mass_balance_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 31  | `trace2.get_mass_balance_ledger`                            | `POST /api/trace2/mass-balance-ledger`    | PASS            | All 8 columns present in `gold_batch_mass_balance_v`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 32  | `trace2.get_investigation_timeline`                         | `POST /api/trace2/investigation-timeline` | PASS            | UNION across `gold_batch_mass_balance_v` + `gold_batch_quality_lot_v` + `gold_batch_delivery_v`; every referenced column verified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 33  | `trace2.get_holds_ledger`                                   | `POST /api/trace2/holds-ledger`           | PASS            | Stock + quality-lot LEFT JOIN columns verified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Tally:** 31 PASS (4 with advisory notes), 2 FAIL.

**Bind-parameter check:** every `:placeholder` in every PASS spec resolves
to a key in `params={...}` and vice-versa for caller-supplied filters. The
shared `QueryExecutor.execute` injects `max_rows` into every call's params
(`params = {**spec.params, "max_rows": spec.max_rows}`); the following
specs _do not_ reference `:max_rows` in their SQL (LIMIT is a literal or
omitted), so `:max_rows` is bound but unreferenced — Databricks Statement
API tolerates extra named params, so this is not a runtime failure but is
worth noting for cleanup: `warehouse360.get_overview` (LIMIT 1),
`warehouse360.get_inbound`, `warehouse360.get_outbound`,
`warehouse360.get_staging`, `warehouse360.get_exceptions`
(LIMIT `{request.limit}` literal), `spc.get_subgroups`,
`spc.get_chart_data` (LIMIT `{safe_limit}` literal),
`spc.get_locked_limits` (LIMIT 1), `trace2.get_passport_summary` (LIMIT 1),
`trace2.get_passport_coa` (LIMIT 100), `trace2.get_passport_lots`
(LIMIT 20), `trace2.get_passport_balance` (no LIMIT),
`trace2.get_batch_quality_passport_partial` (LIMIT 1).
No spec was found to reference a placeholder that wasn't bound, which is
the failure mode that _would_ cause `INVALID_PARAMETER_VALUE` at runtime.

---

## 5. Failures — exact evidence

### Finding #1 — `warehouse360.get_outbound` references columns absent from `wh360_deliveries_v`

**File:** `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`
(lines 371–421, `get_warehouse_outbound_spec`)
**Route handler:** `apps/api/routes/warehouse360.py` (lines 201–252,
`warehouse_outbound`)
**Live object:** `connected_plant_uat.wh360.wh360_deliveries_v`

**Adapter SQL projects** (with `AS` aliases shown):

```
DELIVERY_ID, DELIVERY_ITEM_ID, CUSTOMER_ID, SALES_ORDER_ID,
MATERIAL_ID, MATERIAL_DESCRIPTION, BATCH_ID, PLANT_ID,
STORAGE_LOCATION, WAREHOUSE_NUMBER,
PLANNED_GOODS_ISSUE_DATE, ACTUAL_GOODS_ISSUE_DATE,
QUANTITY, UNIT_OF_MEASURE, STATUS, EXCEPTION_REASON
```

WHERE filter: `WAREHOUSE_NUMBER = :warehouse_id`,
`PLANT_ID = :plant_id`,
`PLANNED_GOODS_ISSUE_DATE >= :date_from`,
`PLANNED_GOODS_ISSUE_DATE <= :date_to`.

**Live DDL (`DESCRIBE TABLE connected_plant_uat.wh360.wh360_deliveries_v`):**

```
delivery_id        : string
delivery_type      : string
plant_id           : string
customer_id        : string
customer_name      : string
carrier            : string
lgnum              : string
planned_gi_date    : string
actual_gi_date     : string
loading_date       : string
delivery_date      : string
gross_weight       : decimal(15,3)
weight_uom         : string
packages           : string
wm_status          : string
mins_to_cutoff     : decimal(27,6)
pick_pct           : decimal(38,11)
line_count         : bigint
risk               : string
shipped            : boolean
```

**Diff:**

| Adapter wants              | Live equivalent                | Status                                               |
| -------------------------- | ------------------------------ | ---------------------------------------------------- |
| `DELIVERY_ID`              | `delivery_id`                  | OK (case-insensitive)                                |
| `DELIVERY_ITEM_ID`         | —                              | **MISSING** (header-grain view; no line-item column) |
| `CUSTOMER_ID`              | `customer_id`                  | OK                                                   |
| `SALES_ORDER_ID`           | —                              | **MISSING**                                          |
| `MATERIAL_ID`              | —                              | **MISSING**                                          |
| `MATERIAL_DESCRIPTION`     | —                              | **MISSING**                                          |
| `BATCH_ID`                 | —                              | **MISSING**                                          |
| `PLANT_ID`                 | `plant_id`                     | OK                                                   |
| `STORAGE_LOCATION`         | —                              | **MISSING**                                          |
| `WAREHOUSE_NUMBER`         | `lgnum`                        | **RENAME**                                           |
| `PLANNED_GOODS_ISSUE_DATE` | `planned_gi_date` (string)     | **RENAME** + type                                    |
| `ACTUAL_GOODS_ISSUE_DATE`  | `actual_gi_date` (string)      | **RENAME** + type                                    |
| `QUANTITY`                 | `gross_weight` (decimal(15,3)) | **RENAME** + semantics                               |
| `UNIT_OF_MEASURE`          | `weight_uom`                   | **RENAME**                                           |
| `STATUS`                   | `wm_status`                    | **RENAME**                                           |
| `EXCEPTION_REASON`         | —                              | **MISSING**                                          |

**Runtime impact:** The query will return a Databricks `UNRESOLVED_COLUMN`
error on the first missing column — most likely `DELIVERY_ITEM_ID` since it
appears in the second SELECT line. The route returns HTTP 502 ("Databricks
query execution failed") on any user-supplied `warehouse_id` /
`date_from` / `date_to` combination. The route has been live in
databricks-api mode since the warehouse-360 consolidation; the parallel
inbound, staging, and exceptions routes were modernised to use the
correct lowercase view columns, but outbound was not.

**Recommended fix (separate PR — see §6):** rewrite
`get_warehouse_outbound_spec` to project the live `wh360_deliveries_v`
columns; update `map_warehouse_outbound_rows` to map them to the
`Warehouse360OutboundItem` contract; mark line-grain fields
(`deliveryItemId`, `materialId`, `batchId`, `salesOrderId`,
`exceptionReason`, `storageLocation`) as `None` with source-truthful
contract treatment (the same pattern the inbound / staging / exceptions
slices already adopt). Filter `lgnum = :warehouse_id` and
`planned_gi_date` range (string-lexical ISO compare; same caveat as
inbound).

---

### Finding #2 — `trace2.get_batch_quality_passport_partial` references columns absent from `gold_batch_summary_v` and `gold_batch_production_history_v`

**File:** `apps/api/adapters/trace2/trace2_databricks_adapter.py`
(lines 1725–1800, `get_batch_quality_passport_partial_spec`)
**Route handler:** `apps/api/routes/trace2.py` lines 744–812
(`POST /api/trace2/batch-quality-passport`) — called as the **first**
of five parallel fetches assembling `BatchQualityPassport`.

**Adapter SQL projects (5-way join):**

```
... b.PROCESS_ORDER_ID           AS process_order_id,
    ph.START_DATE                AS production_started_at,
    ph.CONFIRMED_DATE            AS production_confirmed_at,
    ph.PLANNED_QTY               AS production_planned_qty,
    ph.ACTUAL_QTY                AS production_actual_qty,
    ph.PRODUCTION_LINE           AS production_line,
    ph.OPERATOR                  AS production_operator
FROM ... LEFT JOIN gold_batch_production_history_v ph
    ON s.MATERIAL_ID = ph.MATERIAL_ID AND s.BATCH_ID = ph.BATCH_ID
```

**Live DDL — `connected_plant_uat.gold.gold_batch_summary_v`:**

```
MATERIAL_ID, BATCH_ID, MANUFACTURE_DATE, SHELF_LIFE_EXPIRATION_DATE,
MATERIAL_NAME, MATERIAL_TYPE, MATERIAL_DESC_SHORT,
days_to_expiry, shelf_life_status
```

**Live DDL — `connected_plant_uat.gold.gold_batch_production_history_v`:**

```
PROCESS_ORDER_ID, BATCH_ID, PLANT_ID, MATERIAL_ID,
POSTING_DATE, BATCH_QTY, UOM, quality_status
```

**Diff:**

| Adapter wants                                 | Live source | Status                                                             |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `b.PROCESS_ORDER_ID` (`gold_batch_summary_v`) | —           | **MISSING** — present on `gold_batch_production_history_v` instead |
| `ph.START_DATE`                               | —           | **MISSING**                                                        |
| `ph.CONFIRMED_DATE`                           | —           | **MISSING** (closest: `POSTING_DATE`)                              |
| `ph.PLANNED_QTY`                              | —           | **MISSING**                                                        |
| `ph.ACTUAL_QTY`                               | —           | **MISSING** (closest: `BATCH_QTY`)                                 |
| `ph.PRODUCTION_LINE`                          | —           | **MISSING**                                                        |
| `ph.OPERATOR`                                 | —           | **MISSING**                                                        |

**Runtime impact:** `apps/api/routes/trace2.py` lines 788–808 run the five
passport fetches sequentially (`await run_query(...)` per fetch, not
`asyncio.gather`); the partial-spec call is the first one. It fails with
`UNRESOLVED_COLUMN`, the error is translated by `run_repository_fetch` into
HTTP 502 ("Databricks query execution failed"), and the route never reaches
the remaining four queries. The route is unreachable in databricks-api
mode today.

**Recommended fix (separate PR — see §6):** drop the seven non-existent
columns from the SQL, source `processOrderId` from
`gold_batch_production_history_v.PROCESS_ORDER_ID` (already joined), map
`production_started_at` from `POSTING_DATE` (or null until a richer
source lands), keep `production_planned_qty` as `null` and surface
`production_actual_qty` from `BATCH_QTY`. The
`PRODUCTION_LINE` / `OPERATOR` fields should remain `null` and be marked
unverified in the contract until an upstream source is confirmed (no
extant `gold` view exposes them — `gold_process_line` exists but has
nothing to do with per-batch operator). This keeps the partial passport
source-truthful per the project's UX-truthfulness principle.

---

## 6. Recommended follow-up PRs

Each PR is scoped to a single route/domain to keep blast radius small and
review focused.

### PR-A — fix `GET /api/warehouse360/outbound`

- Update `get_warehouse_outbound_spec` SQL to use live `wh360_deliveries_v`
  column names (lowercase) and drop the four missing-column projections.
- Update `map_warehouse_outbound_rows` to emit `None` for
  `deliveryItemId`, `materialId`, `batchId`, `salesOrderId`,
  `materialDescription`, `storageLocation`, `exceptionReason`.
- Filter `lgnum = :warehouse_id` (or remove the warehouse filter and
  document, matching the inbound/staging/exceptions pattern that the
  view does not expose `lgnum` per existing source-verification doc — TBD).
- Add a source-verification doc:
  `docs/data-layer/warehouse360-outbound-source-verification.md`.
- Reuse the existing test scaffolding under
  `apps/api/tests/adapters/warehouse360/`.

### PR-B — fix `POST /api/trace2/batch-quality-passport` (partial spec)

- In `get_batch_quality_passport_partial_spec`, drop
  `b.PROCESS_ORDER_ID` and the six `ph.*` columns.
- Surface `processOrderId` from
  `gold_batch_production_history_v.PROCESS_ORDER_ID` instead.
- Map `production_actual_qty` ← `BATCH_QTY`,
  `production_started_at` ← `POSTING_DATE`; leave
  `production_planned_qty`, `production_confirmed_at`,
  `production_line`, `production_operator` as `null` and document the
  gap in the contract / adapter docstring.
- Update the `_unverifiedSections` list in
  `map_batch_quality_passport_partial` to add `"production"` until those
  fields have a confirmed source.

### PR-C — promote EnvMon adapter docstring evidence (optional)

The `envmon_databricks_adapter.py` docstring lists multiple columns as
"confirmed-v1 (not yet confirmed-ddl)" — `INSPECTION_END_DATE`,
`PROCESS_ORDER_ID`, `MATERIAL_ID`, `BATCH_ID` on `gold_inspection_lot`;
`SAMPLE_SUMMARY`, `SAMPLE_HOUR` on `gold_inspection_point`; `MIC_ID`,
`MIC_CODE`, `RESULT`, `QUALITATIVE_RESULT`, `TARGET_VALUE`,
`UNIT_OF_MEASURE`, `INSPECTOR`, `INSPECTION_METHOD` on
`gold_batch_quality_result_v`. Live DESCRIBE in this audit confirms all
present. A trivial docstring update promoting these to "confirmed-ddl
(2026-05-25, this audit)" is recommended but not blocking.

### PR-D — defer (advisory only)

The string-typed date columns in `wh360_inbound_v`, `wh360_process_orders_v`,
and `wh360_deliveries_v` (`delivery_date`, `po_date`, `sched_start`,
`planned_start`, `planned_finish`, `planned_gi_date`, `actual_gi_date`)
are fragile under non-ISO inputs. Today the route handlers normalise
`:date_from`/`:date_to` upstream, so this works. A future hardening PR
could `CAST(... AS DATE)` for clarity, but no fix is required to pass
the audit.

The `trace2` adapter's pre-existing `TRACE-P1-010` and `TRACE-P1-011`
defects (mass-balance `MOVEMENT_CATEGORY` and `BALANCE_QTY` semantics)
remain in the backlog and are not in scope for this audit.

---

## 7. Production-readiness statement

This audit does NOT certify production readiness. It only verifies that
DatabricksRepository-backed routes either (a) resolve every referenced
column against live UAT DDL, or (b) carry a documented known gap.

The two **FAIL** rows mean that today, in `BACKEND_ADAPTER_MODE=databricks-api`,
the following two routes are broken end-to-end against the UAT workspace:

- `GET  /api/warehouse360/outbound` — returns HTTP 502 on every call.
- `POST /api/trace2/batch-quality-passport` — returns HTTP 502 on every call.

All other 23 routes resolve their schema correctly. Functional / UX
correctness, governance approvals, latency budgets, and identity policy
compliance are out of scope for this audit and should be tracked separately.

---

## 8. Appendix — evidence files

Raw `DESCRIBE TABLE` JSON outputs from the run are at `C:\Temp\desc_*.json`
on the auditor's workstation (not committed). To regenerate:

```powershell
$env:DATABRICKS_AUTH_STORAGE = 'plaintext'
$body = @{warehouse_id='e76480b94bea6ed5';statement='DESCRIBE TABLE <object>';wait_timeout='30s'} | ConvertTo-Json -Compress
$body | Out-File -Encoding ascii C:\Temp\stmt.json
databricks api post /api/2.0/sql/statements --profile uat --json '@C:\Temp\stmt.json'
```

The compact column summary used in this audit is at
`C:\Temp\audit_columns_summary.md` (~12 KB, 26 objects).
