# Functional Parity Gap Analysis — V1 vs V2

**Date:** 2026-05-17  
**Definition of parity:** V2 returns the same data fields (or agreed-upon subset) from the same underlying Databricks source as V1, browser-verified against live UAT endpoints.  
**What does NOT count as parity:** Mock data, unverified V1 proxy routes, or routes returning 503.  
**Reference:** `docs/audit/adapter-source-status-matrix.md`, `docs/audit/current-state-after-native-databricks-work.md`

---

## Summary by Workspace

| Workspace | V1 parity status | Verified routes | Key gaps |
|---|---|---|---|
| Process Order Review | **Partial parity** | 2 of 10 methods databricks-api BV | View field gaps; confirmations/movements executable but not BV |
| Trace Investigation | **No databricks-api parity** | 0 of 11 methods databricks-api BV (1 legacy-api BV, V1 STOPPED) | DDL blockers; getTraceGraph, getMassBalance, exposure methods mock-only |
| CQ Lab | **Partial parity** | 1 of 2 methods databricks-api BV | Lab fails blocked on missing view |
| WH360 | **No parity** | 0 of 9 methods BV | V1 proxy wired but not verified; V1 STOPPED; WH360 catalog_override missing |
| SPC | **No parity** | 0 of 9 methods | All mock; no adapter; no routes |
| EnvMon | **No parity** | 0 of 9 methods | All mock; no adapter; no routes; no gold views confirmed |
| Maintenance | **No parity** | 0 of 7 methods | All mock; no adapter; no routes; no gold views confirmed |
| Operations Plan Risk | **No parity** | 0 of 9 methods | All mock; planning-data views required |
| Production Staging | **No parity** | 0 of 9 methods | All mock; no warehouse gold views confirmed |
| Quality Batch Release | **No parity** | 0 of 7 methods | All mock; no release system views confirmed |

---

## Process Order Review — Partial Parity

### Methods with databricks-api parity (browser-verified)

| Method | V1 parity? | V2 fields available | V2 fields missing vs V1 |
|---|---|---|---|
| `getProcessOrderHeader` | Partial | processOrderId, materialId, materialDescription, plantId, orderStatus, inspectionLotId | orderType, plannedQuantity, confirmedQuantity, uom, plannedStart, plannedFinish, batchId, productionLine — not in `vw_gold_process_order` |
| `getOrderOperations` | Partial | operationId, operationNumber, operationText (PHASE_DESCRIPTION), status, confirmationStatus, confirmed, plannedQuantity | workCentre, plannedStart, plannedFinish, plannedDurationMinutes, actualStart, actualFinish, actualDurationMinutes, resource — not in `vw_gold_process_order_phase` |

### Methods with databricks-api executable (DDL confirmed, not yet browser-verified)

| Method | V1 parity? | V2 fields available | V2 fields missing vs V1 |
|---|---|---|---|
| `getOrderConfirmations` | Partial | confirmationId, operationId, confirmedYield, uom, confirmedAt, duration fields | operationText, isFinalConfirmation — not in `vw_gold_confirmation` |
| `getOrderGoodsMovements` | Partial | movementId, movementType, direction, materialId, quantity, uom, postedAt, batchId, postedBy, referenceDocument, storageLocation | materialDescription — not in `vw_gold_adp_movement` |

### Methods with no parity (mock-only)

`getProcessOrderReviewContext`, `getOrderProgressSummary`, `getExecutionTimeline`, `getOrderQualityContext`, `getOrderStagingContext`, `getRelatedBatchContext` — all mock-only. V1 equivalents not confirmed.

**Operations Plan Risk** (9 methods, all mock): no V1 legacy adapter exists in V2 — V1 counterparts unknown.

---

## Trace Investigation — No Databricks-Api Parity

### Methods with legacy-api parity (V1 proxy, V1 STOPPED)

| Method | Route | Status |
|---|---|---|
| `getBatchHeaderSummary` | `POST /api/trace2/batch-header` | V1 proxy — returns 503 while V1 STOPPED. Was browser-verified historically but not in this deployment. Cannot claim parity. |

### Methods with databricks-api QuerySpec (no route wired)

| Method | Databricks parity when unblocked | Blocker |
|---|---|---|
| `getBatchHeaderSummary` | Partial — all stock fields + material name; missing plant details if `gold_batch_summary_v` columns wrong | 6 column TODOs |
| `getTraceGraph` | Partial (depth=1 only; recursive graph not planned) | `gold_material.language_id` unverified |
| `getMassBalanceSummary` | Full if WHERE columns correct | WHERE columns unverified |

### Methods with no parity (mock-only)

`getInvestigationContext`, `getCustomerExposureSummary`, `getSupplierExposureSummary`, `getEventTimeline`, `getCoAReleaseStatus`, `getRiskSignals`, `getRelatedInvestigations`, `getTraceExposureForRelease` — 8 methods, all mock.

---

## CQ Lab — Partial Parity

| Method | V2 status | Parity |
|---|---|---|
| `getLabPlants` | Databricks-api browser-verified 2026-05-17 | **Full parity** — PLANT_ID/PLANT_NAME from `gold_plant` match V1 response |
| `getLabFailures` | V1 proxy (503 while V1 STOPPED); databricks-api blocked | **No parity** — `vw_gold_process_order_plan` missing |

---

## WH360 — No Parity

| Method | V2 status | Gap |
|---|---|---|
| `getWarehouse360Summary` | V1 proxy route wired — NOT browser-verified (V1 STOPPED) | No parity — route has never been browser-verified in this deployment |
| All others (8 methods) | Mock-only | No parity |

**Infrastructure gap:** WH360 requires `catalog_override` in `QueryExecutor` for the `wh360` schema. Without it, even a well-written WH360 QuerySpec cannot be wired correctly.

---

## SPC — No Parity (All Mock)

9 methods, all mock. MVs exist but no QuerySpec adapters have been written. No V1 legacy-api adapter in V2 — no V1 baseline for parallel validation.

---

## Domains with No Source Views Confirmed

These domains have no confirmed Databricks source views. No parity path exists until the data engineering team confirms views.

| Domain | Methods | Gold views known |
|---|---|---|
| EnvMon | 9 (all mock) | None confirmed |
| Maintenance | 7 (all mock) | None confirmed |
| Operations Plan Risk | 9 (all mock) | Some `metric_yield_*` possible; planning-data views unconfirmed |
| Production Staging | 9 (all mock) | None confirmed |
| Quality Batch Release | 7 (all mock) | None confirmed |

These domains cannot have databricks-api routes until source views are identified and DDL-verified. Do not write QuerySpecs for these domains based on assumed column names.

---

## Parity Gap Causes and Remediation Paths

| Gap type | Affected | Remediation |
|---|---|---|
| View field gaps (data missing from gold view) | POH order header, operations, confirmations, goods movements | Future view enrichment; fields are optional in schema; re-require when views updated |
| DDL unverified (column names unknown) | Trace getBatchHeaderSummary, getTraceGraph, getMassBalance | Run DESCRIBE TABLE; see `trace-native-column-verification-checklist.md` |
| View missing (`vw_gold_process_order_plan`) | CQ lab fails | Data team must create view |
| No source views identified | EnvMon, Maintenance, Staging, QBR, Ops Plan Risk | Domain owners must identify gold views |
| V1 apps STOPPED | Trace batch header, WH360, CQ fails (legacy-api) | V1 restart; then browser-verify |
| Infrastructure gap (catalog_override) | WH360 | Implement QueryExecutor catalog_override |
| Recursive traversal prohibition | Trace graph depth > 1 | Architecture decision required; not in scope |
| Business rules undefined | getCustomerExposureSummary, Quality Batch Release decisions | Domain owner input required |
