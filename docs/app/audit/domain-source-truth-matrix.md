# Domain Source Truth Matrix

**Date:** 2026-05-17  
**Scope:** All 10 domain-integration adapter domains — per-domain data source status  
**Detail:** Per-method breakdown → see `docs/audit/adapter-source-status-matrix.md`  
**Reference:** `docs/audit/current-state-after-native-databricks-work.md`, ADR-024  
**Last updated:** 2026-05-18 — Hardened operations workspace: implemented premium, read-only Process Order History investigation cockpit (`OrderHistoryView`) as default view, complete with query specs presets, chronological timelines, mixed UOM and data quality exception alerts, and comprehensive E2E unit tests (all passing).

---

## Legend

| Symbol | Meaning |
|---|---|
| ✓ BV | Browser-verified — real data confirmed in UAT |
| ✓ E | Executable — DDL confirmed, route wired, tests passing; browser verification pending |
| ✓ QS | QuerySpec written — adapter exists; route NOT wired; DDL partially verified |
| ✓ W | Route wired (proxy or native) — NOT browser-verified |
| Mock | Mock adapter only — no FastAPI route, no real data |
| Blocked | Cannot implement — missing view, missing infra, or missing business rules |

---

## Domain Matrix

### 1. Process Order History (POH)

**Adapter:** `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`  
**FastAPI:** `apps/api/routes/process_order.py`  
**Databricks catalog:** `connected_plant_uat.csm_process_order_history`  
**ADR-024 priority:** 1

| Method | Source | Status |
|---|---|---|
| `getProcessOrderHeader` | `vw_gold_process_order` | ✓ BV 2026-05-17 |
| `getOrderOperations` | `vw_gold_process_order_phase` | ✓ BV 2026-05-17 |
| `getOrderConfirmations` | `vw_gold_confirmation` | ✓ E (DDL confirmed 2026-05-17) |
| `getOrderGoodsMovements` | `vw_gold_adp_movement` | ✓ E (DDL confirmed 2026-05-17) |
| `getProcessOrderReviewContext` | — | Mock |
| `getOrderProgressSummary` | — | Mock |
| `getExecutionTimeline` | — | Mock |
| `getOrderQualityContext` | — | Mock |
| `getOrderStagingContext` | — | Mock |
| `getRelatedBatchContext` | — | Mock |

**Total: 10 methods — 2 BV, 2 E, 6 mock**

---

### 2. Operations Plan Risk

**Adapter:** `domain-integrations/operations/src/adapters/operations-plan-risk-adapter.ts`  
**FastAPI:** None  
**Databricks views:** Unconfirmed — planning-data gold views required  
**ADR-024 priority:** Deferred (planning data)

| Method | Source | Status |
|---|---|---|
| `getOperationsPlanRiskContext` | — | Mock |
| `getPlanRiskSummary` | — | Mock |
| `getLateOrders` | — | Mock |
| `getMaterialShortages` | — | Mock |
| `getLineStatus` | — | Mock |
| `getScheduleAdherenceSummary` | — | Mock |
| `getYieldVarianceSummary` | `metric_yield_daily` (candidate) | Mock — view exists but DDL not run |
| `getShiftHandoverItems` | — | Mock |
| `getOperationsActionQueue` | — | Mock |

**Total: 9 methods — all mock**

---

### 3. Trace Investigation (Trace2)

**Adapter:** `domain-integrations/traceability/src/adapters/trace2-adapter.ts`  
**FastAPI:** `apps/api/routes/trace2.py`  
**Databricks adapter:** `apps/api/adapters/trace2/trace2_databricks_adapter.py`  
**Databricks catalog:** `connected_plant_uat.gold`  
**ADR-024 priority:** 2

| Method | Source | Status |
|---|---|---|
| `getBatchHeaderSummary` | `gold_batch_stock_v` + `gold_batch_summary_v`⚠ + `gold_material`⚠ + `gold_plant` | ✓ QS — DDL blockers (6 TODOs); V1 proxy returns 503 |
| `getTraceGraph` | `gold_batch_lineage` (confirmed-ddl, 18 cols) | ✓ BV — API BV (q.txt, 2026-05-18); C14 UI BV 2026-05-18 (`?workspace=trace-graph-verify`); C15 UI BV 2026-05-18 (`?workspace=traceability-workspace&view=trace-tree`); source=gold_batch_lineage, execution=databricks-api, depth=1, truncated=No; no mock fallback |
| `getMassBalanceSummary` | `gold_batch_mass_balance_v`⚠ | ✓ QS — WHERE columns unverified |
| `getInvestigationContext` | — | Mock |
| `getCustomerExposureSummary` | Unknown | Blocked — business rules undefined |
| `getSupplierExposureSummary` | — | Mock |
| `getEventTimeline` | — | Mock |
| `getCoAReleaseStatus` | — | Mock |
| `getRiskSignals` | — | Mock |
| `getRelatedInvestigations` | — | Mock |
| `getTraceExposureForRelease` | — | Mock |

**Total: 11 methods — 1 E (getTraceGraph), 2 QS (getBatchHeaderSummary + getMassBalanceSummary, blocked on DDL), 1 blocked (getCustomerExposureSummary, business rules undefined), 7 mock**

---

### 4. SPC Monitoring

**Adapter:** `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`, `spc-signals-adapter.ts`  
**FastAPI:** None  
**Databricks MVs:** `spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv` (all exist; DDL not run due to blockade)  
**ADR-024 priority:** 3  
**Blockade:** Catalog alignment of the `spc_quality_metrics` schema is pending in UAT. As a result, SPC operates in a hardened, high-fidelity Sandbox mode with explicit user warning branding and relaxed schemas until the schema alignment blocker is resolved.

| Method | Source | Status |
|---|---|---|
| `getSPCMonitoringContext` | — | Mock |
| `getSPCSummary` | — | Mock |
| `getActiveSPCSignals` | — | Mock |
| `getMonitoredCharacteristics` | — | Mock |
| `getControlChartSeries` | `spc_correlation_source_mv` | Mock — MV exists; DDL not run |
| `getCharacteristicCapability` | — | Mock |
| `getSPCAlarmHistory` | — | Mock |
| `getSPCRelatedBatches` | — | Mock |
| `getSPCSignals` | — | Mock |

**Total: 9 methods — all mock**

---

### 5. Warehouse 360 (WH360)

**Adapter:** `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`  
**FastAPI:** `apps/api/routes/warehouse360.py`  
**Databricks views:** `wh360_cockpit_summary_v`, `wh360_inbound_v`, `wh360_deliveries_v`, `staging_orders_v`, `wh360_imwm_exceptions_v`  
**ADR-024 priority:** 6 (last)  

| Method | Source | Status |
|---|---|---|
| `getWarehouse360Summary` | V1 proxy | ✓ W — not BV; V1 STOPPED → 503 |
| `getWarehouseOverview` | `wh360_cockpit_summary_v` | ✓ E (FastAPI wired, tests passing, awaiting browser verification in UAT) |
| `getWarehouseInbound` | `wh360_inbound_v` | ✓ E (FastAPI wired, tests passing, awaiting browser verification in UAT) |
| `getWarehouseOutbound` | `wh360_deliveries_v` | ✓ E (FastAPI wired, tests passing, awaiting browser verification in UAT) |
| `getWarehouseStaging` | `staging_orders_v` | ✓ E (FastAPI wired, tests passing, awaiting browser verification in UAT) |
| `getWarehouseExceptionItems` | `wh360_imwm_exceptions_v` | ✓ E (FastAPI wired, tests passing, awaiting browser verification in UAT) |
| `getWarehouse360Context` | — | Mock |
| `getStockOverview` | `wh360.imwm_stock_v` | Mock |
| `getOpenHolds` | — | Mock |
| `getGoodsMovements` | — | Mock |
| `getReplenishmentNeeds` | — | Mock |
| `getLocationCapacities` | — | Mock |
| `getNearExpiryStock` | — | Mock |
| `getWarehouseExceptions` | `wh360.imwm_exceptions_v` | Mock |

**Total: 14 methods — 5 E (FastAPI wired, tests passing), 1 W (legacy-api proxy), 8 mock**

---

### 6. Connected Quality Lab (CQ Lab)

**Adapter:** `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts`  
**FastAPI:** `apps/api/routes/connected_quality_lab.py`  
**Databricks catalog:** `connected_plant_uat.gold`  
**ADR-024 priority:** 4

| Method | Source | Status |
|---|---|---|
| `getLabPlants` | `gold.gold_plant` | ✓ BV 2026-05-17 |
| `getLabFailures` | `vw_gold_process_order_plan` ❌ | Blocked — view does not exist; V1 proxy returns 503 |

**Total: 2 methods — 1 BV, 1 blocked**

---

### 7. Environmental Monitoring (EnvMon)

**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`  
**FastAPI:** `apps/api/routes/envmon.py` — **wired (n.txt + p.txt, 2026-05-17)** — site-summary + swab-results  
**Databricks adapter:** `apps/api/adapters/envmon/envmon_databricks_adapter.py`  
**Source A (SAP QM):** Inspection lots — `INSPECTION_TYPE IN ('14','Z14')` — TRACE_CATALOG/TRACE_SCHEMA  
**Source B (app-managed):** 5 em_* Delta tables in TRACE_CATALOG/TRACE_SCHEMA — existence in UAT unknown  
**Gold views confirmed-ddl (2026-05-17):** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`  
**App-managed tables confirmed-v1:** `em_plant_floor`, `em_location_coordinates`, `em_layout_revision`, `em_location_zones`, `em_plant_geo` (full DDL from V1 migration scripts)  
**App-managed tables in UAT:** Unknown — run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getEnvMonContext` | — | Mock |
| `getEnvMonSiteSummary` | `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v` | **✓ BV** — API browser-verified 2026-05-18; read-only UI consumption added, UI BV pending next deploy |
| `getEnvMonZones` | `em_location_zones` (confirmed-v1 DDL) | Mock — Blocked (em_* existence in UAT unknown) |
| `getEnvMonAlerts` | lot + point + result_v (derivable) | Mock — Deferred (alert rules undefined) |
| `getEnvMonSwabResults` | `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v` | **✓ BV** — API browser-verified 2026-05-18; read-only UI consumes native SAP QM shape because `zoneId` is unavailable from SAP QM |
| `getEnvMonTrends` | lot + point + result_v | Mock — Rank 3; after site summary BV |
| `getEnvMonHeatmap` | lot + point + result_v + `em_location_coordinates` + `em_plant_floor` | Mock — Blocked (em_* existence unknown) |
| `getEnvMonCorrectiveActions` | None — **NOT IN V1** | Mock — Out of scope (CAPA not a V2 EnvMon parity requirement; belongs to separate Quality Actions / Deviation / CAPA bounded context) |
| `getEnvMonSwabVectors` | — | Mock — Deferred indefinitely |
| `getEnvMonPlantMap` **(PROPOSED)** | `em_plant_geo` | Not in adapter/contracts — Planned: depends on em_plant_geo in UAT + contract design + site-summary BV |
| `getEnvMonPlantHotspots` **(PROPOSED)** | `em_plant_geo` + site-summary observation aggregate | Not in adapter/contracts — Planned: depends on getEnvMonPlantMap + site-summary BV |

**Total: 9 legacy adapter methods — 2 API browser-verified native routes, 7 mock. 2 additional proposed methods not yet in contracts.**
**Status:** V1 functional — hybrid domain. `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results` wired, tested, and API browser-verified. Primary read-only monitoring UI added at `?workspace=envmon-monitoring`; UI browser verification pending next deploy. Estate Monitoring BC added (o.txt). Spatial config (em_*) deferred — UAT existence unknown.

**p.txt docs (2026-05-17):** `apps/api/routes/envmon.py` (swab-results) · `apps/api/adapters/envmon/envmon_databricks_adapter.py` · 56 new tests · all matrices updated  
**o.txt docs (2026-05-17):** `docs/architecture/envmon-ddd-model.md` (4-BC) · `docs/audit/envmon-spatial-configuration-model.md` · `docs/audit/envmon-v1-functional-capability-map.md` · `docs/audit/envmon-v1-to-v2-parity-gap.md` · `docs/migration/envmon-advisor-recommendation.md` · candidate routes in matrices  
**n.txt docs (2026-05-17):** `apps/api/routes/envmon.py` · route tests · all matrices  
**m.txt docs (2026-05-17):** `docs/migration/envmon-site-summary-native-route-plan.md` · `docs/architecture/envmon-ddd-model.md` · `docs/deployment/envmon-native-browser-verification.md` (updated)  
**Deep-dive docs (l.txt):** `docs/migration/envmon-v1-deep-dive.md` · `docs/audit/envmon-spatial-configuration-model.md` · `docs/audit/envmon-v1-functional-capability-map.md` · `docs/audit/envmon-v1-to-v2-parity-gap.md` · `docs/migration/envmon-advisor-recommendation.md`  
**Source recovery docs (k.txt):** `docs/migration/envmon-v1-functional-recovery.md` · `docs/audit/envmon-sap-qm-source-model.md` · `docs/audit/envmon-inspection-lot-type-filter.md`  
**Groundwork docs (i.txt):** `docs/migration/envmon-native-groundwork-plan.md` · `docs/audit/envmon-contract-inventory.md` · `docs/audit/envmon-databricks-source-candidates.md` · `docs/audit/envmon-native-column-verification-checklist.md` · `docs/migration/envmon-native-candidate-ranking.md`

---

### 8. Maintenance and Reliability

**Adapter:** `domain-integrations/maintenance/src/adapters/maintenance-reliability-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getMaintenanceReliabilityContext` | — | Mock |
| `getMaintenanceKpiSummary` | — | Mock |
| `getWorkOrders` | — | Mock |
| `getPreventiveMaintenanceTasks` | — | Mock |
| `getEquipmentAvailability` | — | Mock |
| `getReliabilityMetrics` | — | Mock |
| `getMaintenanceBacklog` | — | Mock |

**Total: 7 methods — all mock**  
**Status:** No gold views confirmed. Requires domain owner to identify EAM/maintenance data source.

---

### 9. Production Staging

**Adapter:** `domain-integrations/warehouse/src/adapters/production-staging-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getProductionStagingContext` | — | Mock |
| `getStagingReadinessSummary` | — | Mock |
| `getStagingOrderSummaries` | — | Mock |
| `getStagingPickTasks` | — | Mock |
| `getStagingZoneCapacity` | — | Mock |
| `getStagingShortfalls` | — | Mock |
| `getStagingMoveRequests` | — | Mock |
| `getStagingPickingWaves` | — | Mock |
| `getStagingAlerts` | — | Mock |

**Total: 9 methods — all mock**  
**Status:** No warehouse staging views confirmed. Requires data engineering to confirm WMS gold views.

---

### 10. Quality Batch Release

**Adapter:** `domain-integrations/quality/src/adapters/quality-release-adapter.ts`  
**FastAPI:** None  
**Databricks views:** None confirmed  
**ADR-024 priority:** Not assigned

| Method | Source | Status |
|---|---|---|
| `getReleaseContext` | — | Mock |
| `getReleaseQueue` | — | Mock |
| `getReleaseSummary` | — | Mock |
| `getQualityResults` | — | Mock |
| `getCoAReadiness` | — | Mock |
| `getDeviations` | — | Mock |
| `getDecisionHistory` | — | Mock |

**Total: 7 methods — all mock**  
**Status:** No release management views confirmed. Business rules (severity thresholds, release criteria) are undefined.

---

## Summary

| Domain | Total | BV | E | QS | W | Mock | Blocked |
|---|---|---|---|---|---|---|---|
| POH | 10 | 2 | 2 | 0 | 0 | 6 | 0 |
| Ops Plan Risk | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| Trace | 11 | 0 | **1** | 2 | 0 | 7 | 1 |
| SPC | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| WH360 | 14 | 0 | **5** | 0 | 1 | 8 | 0 |
| CQ Lab | 2 | 1 | 0 | 0 | 0 | 0 | 1 |
| EnvMon | 9 | 0 | **2** | 0 | 0 | 7 | 0 |
| Maintenance | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| Prod Staging | 9 | 0 | 0 | 0 | 0 | 9 | 0 |
| Quality Release | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| **Total** | **87** | **3** | **10** | **2** | **1** | **69** | **2** |

**3 of 87 methods (3.4%) are browser-verified with live Databricks data (BV).**  
**10 of 87 methods (11.5%) are executable — databricks-api route wired, DDL confirmed, awaiting browser verification (E): `getOrderConfirmations`, `getOrderGoodsMovements`, `getEnvMonSiteSummary`, `getEnvMonSwabResults`, `getTraceGraph`, `getWarehouseOverview`, `getWarehouseInbound`, `getWarehouseOutbound`, `getWarehouseStaging`, `getWarehouseExceptionItems`.**  
**1 of 87 methods (1.1%) has a legacy-api proxy wired but is not browser-verified (W).**  
**69 of 87 methods (79.3%) are mock-only — no wired route of any kind.**  
*(2 methods have a databricks-api QuerySpec written but no route wired — getBatchHeaderSummary + getMassBalanceSummary (Trace); 2 are blocked by missing view or undefined business rules.)*

**EnvMon correction (k.txt + l.txt, 2026-05-17):** EnvMon is a **hybrid domain** — SAP QM inspection lots (k.txt) plus app-managed spatial configuration — 5 em_* Delta tables in TRACE_CATALOG/TRACE_SCHEMA (l.txt). Three gold views confirmed-v1. QuerySpec written for `getEnvMonSiteSummary`. All five em_* tables confirmed-v1 from V1 migrations. DDL for all pending in UAT. See `docs/audit/envmon-spatial-configuration-model.md`.
