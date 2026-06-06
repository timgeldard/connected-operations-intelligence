# Adapter Source Status Matrix

**Generated:** 2026-05-16  
**Last updated:** 2026-05-18 — g.txt/h.txt/i.txt sweep, commit `491c6a6`. Trace `trace-graph` API + UI BV PASSED (full-width fix in `518d9bb`). EnvMon API + UI BV PASSED. WH360 `overview` API BV PASSED; `inbound`/`outbound` query/schema blocked (real DDL captured); `staging`/`exceptions` source/config blocked (real DDL captured). POH all 4 routes SQL-verified by direct DESCRIBE/SELECT; HTTP/UI BV pending. SPC SPCSandboxBanner present in all 6 views (code-confirmed). Full evidence: [`docs/deployment/uat-evidence-ledger.md`](../deployment/uat-evidence-ledger.md). Remediation: [`docs/migration/uat-remediation-backlog.md`](../migration/uat-remediation-backlog.md).  
**Scope:** All domain-integration adapter methods across all 10 domains  
**Reference:** ADR-024 (`docs/adr/ADR-024-native-databricks-data-access-architecture.md`)

---

## UAT Deployment State (as of 2026-05-17)

| Item | Status |
|---|---|
| V2 app deployed to UAT | **RUNNING** — `https://connectio-v2-604667594731808.8.azure.databricksapps.com` |
| React UI load | Confirmed |
| `BACKEND_ADAPTER_MODE` | **`databricks-api`** — native Databricks reads active for CQ lab plants and POH order header |
| V1 apps | **STOPPED** — all legacy-api domain routes return 503 until V1 apps are restarted |
| Native Databricks reads | **Active and browser-verified** — `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, `POH_CATALOG`, `CQ_CATALOG` set as literals in `app.yaml` |
| OAuth identity (`sql` scope) | **Confirmed** — `effective_user_api_scopes` includes `sql`; set via `user_api_scopes` in `databricks.yml` |
| CQ lab plants | **Browser-verified 2026-05-17** — `GET /api/cq/lab/plants` returns real plant list; `X-Data-Source: databricks-api` |
| POH order header | **Browser-verified 2026-05-17** — `POST /api/por/order-header` with process order 7006965038 returns real data |

> **Two-layer adapter model:** `VITE_ADAPTER_MODE=legacy-api` (baked into the frontend bundle) means the frontend calls FastAPI via HTTP — not mock. It is independent of `BACKEND_ADAPTER_MODE`. The frontend has no `databricks-api` mode; Databricks is always accessed through the FastAPI layer.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Implemented / available |
| ✓ BV | Implemented + browser-verified against live UAT endpoint |
| ✓ E | Executable — databricks-api route wired, DDL confirmed, tests passing; awaiting browser verification in UAT |
| ✓ W | Wired (proxy route + adapter code exist) — NOT browser-verified |
| — | Not yet implemented |
| ⛔ | Blocked (prerequisite missing) |

**Source badge behaviour:**
- `mock`: no badge rendered
- `legacy-api`: amber badge in every panel consuming this data
- `databricks-api`: green badge (future)

---

## Traceability — `Trace2Adapter` / `Trace2LegacyApiAdapter`

Adapter class: `domain-integrations/traceability/src/adapters/trace2-adapter.ts`  
ADR-024 migration priority: **2** (after POH)  
Gold views: `gold_batch_material`, `gold_process_order`, `gold_adp_movement` (all available)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getBatchHeaderSummary` | ✓ | ✓ BV | ✓ 2024-03-08 | — | amber when live | **First candidate for databricks-api** — lowest risk; verified leg-api exists for parallel validation |
| `getInvestigationContext` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getTraceGraph` | ✓ | — | — | **✓ BV 2026-05-18** | green | **C16 PASSED 2026-05-18** — WITH RECURSIVE implementation confirmed. `material_id=20052009, batch_id=0008602411, direction=both, max_depth=2` → HTTP 200, `x-data-source: view:gold_batch_lineage`, `x-query-name: trace2.get_trace_graph`, 7 nodes, 7 edges, `depthReached=1`, `truncated=false`, `warnings=[]`, nodeKey=2-tuple. No 504. No mock fallback. **d.txt** — TraceQueryForm embedded; final route `?workspace=traceability-workspace`; 163 di-traceability tests. |
| `getMassBalanceSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getCustomerExposureSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getSupplierExposureSummary` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getEventTimeline` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getCoAReleaseStatus` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getRiskSignals` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getRelatedInvestigations` | ✓ | — | — | — | none | Add to Trace databricks-api slice |
| `getTraceExposureForRelease` | ✓ | — | — | — | none | Add to Trace databricks-api slice |

**Summary:** 11 methods — 1 browser-verified legacy-api, **1 browser-verified databricks-api** (getTraceGraph — WITH RECURSIVE, **BV PASSED C16 2026-05-18**), 9 mock only.

---

## SPC — `SPCMonitoringAdapter` / `SPCSignalsAdapter`

Adapter class: `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`, `spc-signals-adapter.ts`  
ADR-024 migration priority: **3**  
Gold views: `spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv` (all MVs exist; DDL not verified in UAT due to blockade)  
**Blockade:** Catalog alignment of the `spc_quality_metrics` schema is pending in UAT. Consequently, all backend SPC views/materialized views are inaccessible or unaligned, blocking native Databricks adapter wiring. SPC is configured to operate in a high-fidelity simulated Sandbox mode with prominent UI branding and relaxed schema contracts until the platform team resolves the schema catalog alignment.

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getSPCMonitoringContext` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCSummary` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getActiveSPCSignals` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getMonitoredCharacteristics` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getControlChartSeries` | ✓ | — | — | — | none | Backed by `spc_correlation_source_mv` |
| `getCharacteristicCapability` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCAlarmHistory` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCRelatedBatches` | ✓ | — | — | — | none | Include in SPC databricks-api slice |
| `getSPCSignals` | ✓ | — | — | — | none | Include in SPC databricks-api slice |

**Summary:** 9 methods — all mock only. No legacy-api adapter. Cannot validate against V1 via parallel testing. MV infrastructure already exists — databricks-api migration is primarily a QuerySpec wrapping exercise.
**SPC sandbox labelling (f.txt 2026-05-18):** `SPCSandboxBanner` added to `active-signals`, `capability`, `alarm-history`, and `chart-configuration-readonly` views (was only on `chart-overview` and `characteristic-review`). UAT tab-walk pending (C22).

---

## Warehouse360 — `Warehouse360Adapter` / `Warehouse360LegacyApiAdapter`

Adapter class: `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`  
ADR-024 migration priority: **6** (last — highest complexity, separate schema)  
Gold views: `wh360_cockpit_summary_v`, `wh360_inbound_v`, `wh360_deliveries_v`, `staging_orders_v`, `wh360_imwm_exceptions_v`

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getWarehouse360Summary` | ✓ | ✓ W | — | — | amber when live | **Browser-verify first** before databricks-api |
| `getWarehouseOverview` | ✓ | — | — | **✓ E** | green when databricks | Backed by `wh360_cockpit_summary_v`; fully wired and tested, awaiting UAT browser-verification |
| `getWarehouseInbound` | ✓ | — | — | **✓ E** | green when databricks | Backed by `wh360_inbound_v` with dynamic filters and limits; fully wired and tested, awaiting UAT |
| `getWarehouseOutbound` | ✓ | — | — | **✓ E** | green when databricks | Backed by `wh360_deliveries_v` with dynamic filters and limits; fully wired and tested, awaiting UAT |
| `getWarehouseStaging` | ✓ | — | — | **✓ E** | green when databricks | Backed by `staging_orders_v` with dynamic filters and limits; fully wired and tested, awaiting UAT |
| `getWarehouseExceptionItems` | ✓ | — | — | **✓ E** | green when databricks | Backed by `wh360_imwm_exceptions_v` with dynamic filters and limits; fully wired and tested, awaiting UAT |
| `getWarehouse360Context` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getStockOverview` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getOpenHolds` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getGoodsMovements` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getReplenishmentNeeds` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getLocationCapacities` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getNearExpiryStock` | ✓ | — | — | — | none | Include in Warehouse databricks-api slice |
| `getWarehouseExceptions` | ✓ | — | — | — | none | Backed by `wh360.imwm_exceptions_v` (7-UNION view) |

**Summary:** 9 legacy adapter methods — 1 wired legacy-api (not browser-verified), 8 mock only.

**New native routes (f.txt tranche):** 5 `GET /api/warehouse360/*` routes wired in `apps/api/routes/warehouse360.py` with full QuerySpec adapters in `warehouse360_databricks_adapter.py`. `WH360_CATALOG=connected_plant_uat`, `WH360_SCHEMA=wh360` (default correct). Known warehouse IDs for UAT: **104**, **105**.

**Source view fixes (2026-05-18):** `wh360_cockpit_summary_v` does not exist → replaced with `wh360_kpi_snapshot_v` (global single-row KPI snapshot, DESCRIBE confirmed; no WHERE clause — no warehouse_id column).

**LIMIT fix (2026-05-18):** `LIMIT :max_rows` rejected by Databricks SQL on all 4 list routes (HTTP 502 in first test). Fixed: dynamic `LIMIT {request.limit}` embedded via f-string (integer-safe, validated 1–500 in route layer).

**First test (pre-LIMIT fix, 2026-05-18):** overview HTTP 200 ✓ (after source view fix); inbound/outbound/staging/exceptions HTTP 502 ✗ (LIMIT :max_rows). Second deploy with LIMIT fix completed — list routes pending re-test.

UAT schema: `connected_plant_uat.wh360.*` — confirmed 2026-05-18.

| Native route | Source view | Status |
|---|---|---|
| `GET /api/warehouse360/overview` | `wh360_kpi_snapshot_v` | **HTTP 200** ✓ — C17 first test passed |
| `GET /api/warehouse360/inbound` | `wh360_inbound_v` | **PENDING RE-TEST** — view exists, LIMIT fix deployed (C18) |
| `GET /api/warehouse360/outbound` | `wh360_deliveries_v` | **DDL-BLOCKED** — view exists but no `WAREHOUSE_NUMBER` column; need `DESCRIBE TABLE` (C19) |
| `GET /api/warehouse360/staging` | `staging_orders_v` | **SOURCE-BLOCKED** — view does not exist in `connected_plant_uat.wh360`; need `SHOW VIEWS` (C20) |
| `GET /api/warehouse360/exceptions` | `wh360_imwm_exceptions_v` | **SOURCE-BLOCKED** — view does not exist in `connected_plant_uat.wh360`; need `SHOW VIEWS` (C21) |

---

## Process Order History — `ProcessOrderReviewAdapter` / `ProcessOrderReviewLegacyApiAdapter`

Adapter class: `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`  
ADR-024 migration priority: **1** (first — high value, views available)  
Gold views: `vw_gold_order_summary`, `metric_yield_per_order`, `metric_yield_daily`, `vw_gold_day_view_blocks` (all available)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getProcessOrderHeader` | ✓ | ✓ W | — | **✓ BV 2026-05-17** | green when databricks | Browser-verified: process order 7006965038 returned real data; some fields empty by design (not in view) |
| `getProcessOrderReviewContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderProgressSummary` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getExecutionTimeline` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderQualityContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderStagingContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getRelatedBatchContext` | ✓ | — | — | — | none | Include in POH databricks-api slice |
| `getOrderOperations` | ✓ | — | — | **✓ BV 2026-05-17** | green when databricks | `GET /api/por/order-operations` — browser-verified 2026-05-17; 11 operations returned for PO 7006965038 |
| `getOrderConfirmations` | ✓ | — | — | **✓ BV 2026-05-18** | green when databricks | **Browser-verified 2026-05-18** — PO=7006967130, 2 confirmations, `confirmationId=100001669`, `confirmedYield=646.88 KG`; `operationText` + `isFinalConfirmation` absent from view by design |
| `getOrderGoodsMovements` | ✓ | — | — | **✓ BV 2026-05-18** | green when databricks | **Browser-verified 2026-05-18** — PO=7006965479, 901 movements; `direction=input` confirmed for MOVEMENT_TYPE=261; `materialDescription` absent from view by design |

**POH (Plan Risk) — `OperationsPlanRiskAdapter`** (no legacy adapter):

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getOperationsPlanRiskContext` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getPlanRiskSummary` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getLateOrders` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getMaterialShortages` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getLineStatus` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getScheduleAdherenceSummary` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getYieldVarianceSummary` | ✓ | — | — | — | none | Could use `metric_yield_daily` |
| `getShiftHandoverItems` | ✓ | — | — | — | none | Requires planning-data gold views |
| `getOperationsActionQueue` | ✓ | — | — | — | none | Requires planning-data gold views |

**Summary (POR):** 10 + 9 = 19 methods — `getProcessOrderHeader`, `getOrderOperations`, `getOrderConfirmations`, and `getOrderGoodsMovements` are databricks-api browser-verified (2026-05-17/18); remaining POR and plan-risk methods are mock-only.

---

## Quality / Lab — `ConnectedQualityLabAdapter` / `ConnectedQualityLabLegacyApiAdapter`

Adapter class: `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts`  
ADR-024 migration priority: **4**  
Gold views: `vw_gold_quality_result_enriched`, `metric_quality_daily` (available); `vw_gold_process_order_plan` (**missing — blocker**)

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getLabFailures` | ✓ | ✓ W | — | — | amber when live | **Browser-verify** `GET /api/cq/lab/fails`. Databricks-api blocked on `vw_gold_process_order_plan` |
| `getLabPlants` | ✓ | ✓ W | — | **✓ BV 2026-05-17** | green when databricks | Browser-verified: `GET /api/cq/lab/plants` returns real plant list; `PLANT_ID`/`PLANT_NAME` column names confirmed |

**Summary:** 2 methods — both wired legacy-api (not browser-verified); `getLabPlants` also mode-gated for databricks-api.  
**Blocker:** `vw_gold_process_order_plan` does not exist. `getLabFailures` cannot migrate to databricks-api until this view is created. `getLabPlants` unblocked — column names must be confirmed.

---

## Environmental Monitoring (EnvMon)

Adapter class: `domain-integrations/envmon/src/adapters/envmon-adapter.ts`  
ADR-024 migration priority: **Not assigned** — frontend wiring pending BV  
Source: **SAP QM inspection lots** (`INSPECTION_TYPE IN ('14','Z14')`) — `TRACE_CATALOG / TRACE_SCHEMA`  
Gold views confirmed-ddl (2026-05-17): `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`  
QuerySpec adapter: `apps/api/adapters/envmon/envmon_databricks_adapter.py`  
FastAPI route: `apps/api/routes/envmon.py` — **wired (n.txt, 2026-05-17)**

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getEnvMonContext` | ✓ | — | — | — | none | After BV confirmed |
| `getEnvMonSiteSummary` | ✓ | — | — | **✓ BV** | green | API browser-verified 2026-05-18; UI (`?workspace=envmon-monitoring`) browser-verified 2026-05-18 (f.txt) |
| `getEnvMonSwabResults` | ✓ | — | — | **✓ BV** | green | API browser-verified 2026-05-18; UI browser-verified 2026-05-18 (f.txt); numeric schema widened (Databricks returns DECIMAL as strings) |
| `getEnvMonTrends` | ✓ | — | — | — | none | Planned — Rank 3, after site summary BV |
| `getEnvMonZones` | ✓ | — | — | — | none | Planned — depends on em_location_zones in UAT |
| `getEnvMonAlerts` | ✓ | — | — | — | none | Deferred — alert derivation rules undefined |
| `getEnvMonHeatmap` | ✓ | — | — | — | none | Planned — depends on em_location_coordinates + em_plant_floor in UAT |
| `getEnvMonCorrectiveActions` | ✓ | — | — | — | none | Out of scope — CAPA/corrective actions not a V2 EnvMon parity requirement; intentionally not migrated |
| `getEnvMonSwabVectors` | ✓ | — | — | — | none | Deferred indefinitely — business rules undefined |
| `getEnvMonPlantMap` (**PROPOSED**) | — | — | — | — | none | Planned — contract not yet designed; depends on em_plant_geo in UAT + site-summary BV |
| `getEnvMonPlantHotspots` (**PROPOSED**) | — | — | — | — | none | Planned — contract not yet designed; depends on getEnvMonPlantMap + site-summary aggregate |
| `GET /api/envmon/floors` (proposed route) | — | — | — | — | none | Planned — depends on em_plant_floor in UAT |
| `GET /api/envmon/floorplan` (proposed route) | — | — | — | — | none | Planned — depends on em_layout_revision in UAT |
| `GET /api/envmon/location-coordinates` (proposed route) | — | — | — | — | none | Planned — depends on em_location_coordinates in UAT |
| `GET /api/envmon/heatmap` (proposed route) | — | — | — | — | none | Planned — depends on em_* tables + all SAP QM views |

**Summary:** 9 legacy adapter methods — **2 browser-verified databricks-api routes** (`getEnvMonSiteSummary` + `getEnvMonSwabResults` 2026-05-18), 7 mock-only legacy methods. 6 additional candidate routes planned (not yet in adapter or contracts). No legacy-api adapter.
**Status:** V1 functional — hybrid domain. `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results` wired, tested, and browser-verified (API + UI). `?workspace=envmon-monitoring` fully browser-verified 2026-05-18 with real Databricks data.

**f.txt docs (2026-05-18):** `WorkspaceViews.tsx` routing fix (default view `scope-overview` → `native-monitoring`) · `EnvMonNativeSwabResultSchema` numeric field widening · rejection test updated to use invalid enum  
**p.txt docs (2026-05-17):** `apps/api/routes/envmon.py` (swab-results route added) · `apps/api/adapters/envmon/envmon_databricks_adapter.py` (SwabResultsRequest + QuerySpec + mapper added) · 56 new tests · all matrix and deployment docs updated  
**o.txt docs (2026-05-17):** DDD model updated to 4-BC structure; Estate Monitoring BC added; plant geo elevated; candidate routes added to matrices  
**n.txt docs (2026-05-17):** `apps/api/routes/envmon.py` · `tests/routes/test_envmon_routes.py` · all matrix and deployment docs updated  
**m.txt docs (2026-05-17):** `docs/migration/envmon-site-summary-native-route-plan.md` · `docs/architecture/envmon-ddd-model.md`  
**Deep-dive docs (l.txt, 2026-05-17):** `docs/migration/envmon-v1-deep-dive.md` · `docs/audit/envmon-spatial-configuration-model.md` · `docs/audit/envmon-v1-to-v2-parity-gap.md`  
**Source recovery docs (k.txt, 2026-05-17):** `docs/migration/envmon-v1-functional-recovery.md` · `docs/audit/envmon-sap-qm-source-model.md` · `docs/audit/envmon-inspection-lot-type-filter.md`  
**Groundwork docs (i.txt, 2026-05-17):** `docs/migration/envmon-native-groundwork-plan.md` · `docs/audit/envmon-native-column-verification-checklist.md` · `docs/migration/envmon-native-candidate-ranking.md`

---

## Maintenance and Reliability

Adapter class: `domain-integrations/maintenance/src/adapters/maintenance-reliability-adapter.ts`  
ADR-024 migration priority: **Not assigned** — no gold views confirmed  
Gold views: None identified

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getMaintenanceReliabilityContext` | ✓ | — | — | — | none | Identify EAM source view |
| `getMaintenanceKpiSummary` | ✓ | — | — | — | none | Identify EAM source view |
| `getWorkOrders` | ✓ | — | — | — | none | Identify EAM source view |
| `getPreventiveMaintenanceTasks` | ✓ | — | — | — | none | Identify EAM source view |
| `getEquipmentAvailability` | ✓ | — | — | — | none | Identify EAM source view |
| `getReliabilityMetrics` | ✓ | — | — | — | none | Identify EAM source view |
| `getMaintenanceBacklog` | ✓ | — | — | — | none | Identify EAM source view |

**Summary:** 7 methods — all mock only. No legacy-api adapter. No Databricks adapter. No source views confirmed. Requires EAM/maintenance gold views.

---

## Production Staging

Adapter class: `domain-integrations/warehouse/src/adapters/production-staging-adapter.ts`  
ADR-024 migration priority: **Not assigned** — no gold views confirmed  
Gold views: None identified

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getProductionStagingContext` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingReadinessSummary` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingOrderSummaries` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingPickTasks` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingZoneCapacity` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingShortfalls` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingMoveRequests` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingPickingWaves` | ✓ | — | — | — | none | Identify WMS source views |
| `getStagingAlerts` | ✓ | — | — | — | none | Identify WMS source views |

**Summary:** 9 methods — all mock only. No legacy-api adapter. No Databricks adapter. No WMS gold views confirmed.

---

## Quality Batch Release

Adapter class: `domain-integrations/quality/src/adapters/quality-release-adapter.ts`  
ADR-024 migration priority: **Not assigned** — no gold views confirmed; business rules undefined  
Gold views: None identified

| Method | Mock | Legacy-api | Browser-verified | Databricks-api | Source badge | Next action |
|--------|------|-----------|-----------------|----------------|-------------|-------------|
| `getReleaseContext` | ✓ | — | — | — | none | Identify release management source |
| `getReleaseQueue` | ✓ | — | — | — | none | Identify release management source |
| `getReleaseSummary` | ✓ | — | — | — | none | Identify release management source |
| `getQualityResults` | ✓ | — | — | — | none | Identify quality results source |
| `getCoAReadiness` | ✓ | — | — | — | none | Identify CoA source |
| `getDeviations` | ✓ | — | — | — | none | Identify deviation management source |
| `getDecisionHistory` | ✓ | — | — | — | none | Identify release audit source |

**Summary:** 7 methods — all mock only. No legacy-api adapter. No Databricks adapter. Business rules (release criteria, severity thresholds) are undefined. Domain owner must engage before any migration planning.

---

## Cross-Domain Totals

| Domain | Total methods | Browser-verified (databricks-api) | Executable (not verified) | Wired (not verified) | Mock only | Databricks-api (mode-gated) |
|--------|--------------|----------------------------------|--------------------------|---------------------|-----------|----------------|
| Traceability | 11 | 1 (legacy-api) + **1 databricks-api BV** (getTraceGraph — WITH RECURSIVE, C16 PASSED 2026-05-18) | 0 | 0 | 9 | **1 BV** |
| SPC | 9 | 0 | 0 | 0 | 9 | 0 |
| Warehouse360 | 14 | 0 | 5 | 1 | 8 | 5 E |
| POH (POR) | 10 | **4** (`getProcessOrderHeader` + `getOrderOperations` 2026-05-17; `getOrderConfirmations` + `getOrderGoodsMovements` 2026-05-18) | 0 | 0 | 6 | **4 BV** |
| POH (plan risk) | 9 | 0 | 0 | 0 | 9 | 0 |
| Quality/Lab | 2 | **1** (`getLabPlants` 2026-05-17) | 0 | 1 | 0 | **1 BV** |
| EnvMon | 9 | **2** (`getEnvMonSiteSummary` + `getEnvMonSwabResults` 2026-05-18) | 0 | 0 | 7 | **2 BV** |
| Maintenance | 7 | 0 | 0 | 0 | 7 | 0 |
| Production Staging | 9 | 0 | 0 | 0 | 9 | 0 |
| Quality Batch Release | 7 | 0 | 0 | 0 | 7 | 0 |
| **Total** | **82** | **9** (databricks-api BV) | **0** | **2** | **70** | **9 BV** |

> Previously tracked 50 methods across 6 domains. Updated 2026-05-17 to include EnvMon (9), Maintenance (7), Production Staging (9), and Quality Batch Release (7) — all mock-only with no confirmed Databricks source views.

---

## FastAPI Route Inventory

| Route | Method | Domain | Adapter override | Status |
|-------|--------|--------|-----------------|--------|
| `/api/trace2/batch-header` | POST | Traceability | `getBatchHeaderSummary` | ✓ Browser-verified (V1 was live); UAT: returns 503 while V1 STOPPED |
| `/api/trace2/trace-graph` | POST | Traceability | `getTraceGraph` | Databricks-api only — WITH RECURSIVE implementation — **browser-verified 2026-05-18 (C16)**; 7 nodes, 7 edges, `view:gold_batch_lineage`, no timeout; no mock fallback |
| `/api/wh360/warehouse-summary` | POST | Warehouse360 | `getWarehouse360Summary` | Wired — not verified; UAT: 503 while V1 STOPPED |
| `/api/warehouse360/overview` | GET | Warehouse360 | `getWarehouseOverview` | ✓ Executable (`✓ E`) — fully wired, dynamic SQL query parameter validation, and complete test cases passing; awaiting UAT BV |
| `/api/warehouse360/inbound` | GET | Warehouse360 | `getWarehouseInbound` | ✓ Executable (`✓ E`) — fully wired with dynamic date/plant filters and clamped limit validations; awaiting UAT BV |
| `/api/warehouse360/outbound` | GET | Warehouse360 | `getWarehouseOutbound` | ✓ Executable (`✓ E`) — fully wired with dynamic date/plant filters and clamped limit validations; awaiting UAT BV |
| `/api/warehouse360/staging` | GET | Warehouse360 | `getWarehouseStaging` | ✓ Executable (`✓ E`) — fully wired with dynamic date/plant filters and clamped limit validations; awaiting UAT BV |
| `/api/warehouse360/exceptions` | GET | Warehouse360 | `getWarehouseExceptionItems` | ✓ Executable (`✓ E`) — fully wired with dynamic date/plant filters and clamped limit validations; awaiting UAT BV |
| `/api/por/order-header` | POST | POH | `getProcessOrderHeader` | Wired (legacy-api) + databricks-api **browser-verified 2026-05-17** (process order 7006965038) |
| `/api/por/order-operations` | GET | POH | `getOrderOperations` | Databricks-api only — **browser-verified 2026-05-17** — 11 operations for PO 7006965038 |
| `/api/por/order-confirmations` | GET | POH | `getOrderConfirmations` | Databricks-api only — **browser-verified 2026-05-18** — PO=7006967130, 2 confirmations, HTTP 200 |
| `/api/por/order-goods-movements` | GET | POH | `getOrderGoodsMovements` | Databricks-api only — **browser-verified 2026-05-18** — PO=7006965479, 901 movements, HTTP 200 |
| `/api/cq/lab/fails` | GET | Quality/Lab | `getLabFailures` | Wired (legacy-api only); databricks-api blocked on `vw_gold_process_order_plan` |
| `/api/cq/lab/plants` | GET | Quality/Lab | `getLabPlants` | Wired (legacy-api) + databricks-api **browser-verified 2026-05-17** |
| `/api/envmon/site-summary` | GET | EnvMon | `getEnvMonSiteSummary` | Databricks-api only — **browser-verified 2026-05-18** — HTTP 200, plant_id=C061, all 12 schema keys present |
| `/api/envmon/swab-results` | GET | EnvMon | `getEnvMonSwabResults` | Databricks-api only — **browser-verified 2026-05-18** — HTTP 200, plant_id=C061; frontend wiring deferred (zoneId unavailable) |
| `/api/envmon/plant-map` | GET | EnvMon | `getEnvMonPlantMap` (PROPOSED) | **Planned** — depends on em_plant_geo in UAT + contract design; NOT wired |
| `/api/envmon/plant-hotspots` | GET | EnvMon | `getEnvMonPlantHotspots` (PROPOSED) | **Planned** — depends on em_plant_geo + site-summary BV; NOT wired |
| `/api/envmon/floors` | GET | EnvMon | *(not yet designed)* | **Planned** — depends on em_plant_floor in UAT; NOT wired |
| `/api/envmon/floorplan` | GET | EnvMon | *(not yet designed)* | **Planned** — depends on em_layout_revision in UAT; NOT wired |
| `/api/envmon/location-coordinates` | GET | EnvMon | *(not yet designed)* | **Planned** — depends on em_location_coordinates in UAT; NOT wired |
| `/api/envmon/zones` | GET | EnvMon | `getEnvMonZones` | **Planned** — depends on em_location_zones in UAT; NOT wired |
| `/api/envmon/heatmap` | GET | EnvMon | `getEnvMonHeatmap` | **Planned** — depends on observations + spatial config; NOT wired |

| `/api/warehouse360/overview` | GET | Warehouse360 | *(native only)* | Databricks-api only — source `wh360_kpi_snapshot_v` — **HTTP 200** ✓ C17 passed |
| `/api/warehouse360/inbound` | GET | Warehouse360 | *(native only)* | Databricks-api only — source `wh360_inbound_v` — **PENDING RE-TEST (C18)** — LIMIT 1000 fix deployed |
| `/api/warehouse360/outbound` | GET | Warehouse360 | *(native only)* | Databricks-api only — source `wh360_deliveries_v` — **DDL-BLOCKED (C19)** — view exists, no `WAREHOUSE_NUMBER` column; need `DESCRIBE TABLE` |
| `/api/warehouse360/staging` | GET | Warehouse360 | *(native only)* | Databricks-api only — **SOURCE-BLOCKED (C20)** — `staging_orders_v` does not exist; need `SHOW VIEWS IN connected_plant_uat.wh360` |
| `/api/warehouse360/exceptions` | GET | Warehouse360 | *(native only)* | Databricks-api only — **SOURCE-BLOCKED (C21)** — `wh360_imwm_exceptions_v` does not exist; need `SHOW VIEWS IN connected_plant_uat.wh360` |

No other domain-integration routes exist. Do not add routes without browser-verification against a live V1 backend. Planned routes are documented targets only — NOT wired.
