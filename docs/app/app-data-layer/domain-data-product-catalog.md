# Domain Data Product Catalog

This catalog inventories every data product in the ConnectIO-RAD app-facing
data layer. Each entry is keyed by the data-product name and captures the
business object, pattern, sources, contract, route, mapper, field
classification status, maturity level, known caveats, and the next action
needed to advance it.

> **Authoritative reference.** Future PRs MUST reconcile their changes
> against this catalog (`PR template → Data Product Impacted`). If a PR
> creates or substantially alters a data product, this catalog must be
> updated in the same PR (or a paired `data-product-spec` PR).

Maturity levels reference [`data-product-maturity-model.md`](./data-product-maturity-model.md).
Field classification markers reference [`field-classification-standard.md`](./field-classification-standard.md).
Patterns reference [`data-product-patterns.md`](./data-product-patterns.md).
Browser UAT readiness references
[`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md)
and the per-app checklists under
[`browser-uat-checklists/`](./browser-uat-checklists/).

> **UAT entry.** UAT entry is governed by
> [`uat-entry-plan.md`](./uat-entry-plan.md). A data product appearing
> in this catalogue is not automatically UAT-ready or production-ready.

> **Browser UAT status.** Every data product below remains
> `browser-uat-pending` until evidence is captured under
> `docs/app-data-layer/evidence/YYYY-MM-DD/<app-or-data-product>/`.
> No data product in this catalog is asserted to be browser-UAT
> captured or production-ready by virtue of appearing here. Production
> readiness requires the full set of gates in
> [`route-readiness-standard.md`](./route-readiness-standard.md), of
> which browser UAT evidence is only one.

## Index

| #   | Data product                                                      | Pattern       | Maturity | Status                                                              |
| --- | ----------------------------------------------------------------- | ------------- | -------- | ------------------------------------------------------------------- |
| 1   | [SPCSubgroupSeries](#1-spcsubgroupseries)                         | evidence-pack | L4       | browser-UAT-pending                                                 |
| 2   | [SPCChartDataSeries](#2-spcchartdataseries)                       | evidence-pack | L4       | mapper-tested, governance-pending (locked-limits approval, signals) |
| 3   | [BatchQualityPassport](#3-batchqualitypassport)                   | evidence-pack | L3       | mapper-test-pending, browser-UAT-pending                            |
| 4   | [MassBalanceLedger](#4-massbalanceledger)                         | evidence-pack | L3/L4    | reconciliation governance-pending                                   |
| 5   | [TraceGraph](#5-tracegraph)                                       | evidence-pack | L3       | mapper-test-pending                                                 |
| 6   | [CustomerExposureEvidence](#6-customerexposureevidence)           | evidence-pack | L3       | governance-pending (recall recommendation)                          |
| 7   | [SupplierExposureEvidence](#7-supplierexposureevidence)           | evidence-pack | L3       | source-coverage-pending (no QM source)                              |
| 8   | [ProcessOrderExecutionEvidence](#8-processorderexecutionevidence) | evidence-pack | L3/L4    | partially-classified (legacy-bridge fields)                         |
| 9   | [QualityUsageDecisionEvidence](#9-qualityusagedecisionevidence)   | evidence-pack | L3       | governance-pending (lot vs batch level)                             |
| 10  | [WarehouseOperationalSnapshot](#10-warehouseoperationalsnapshot)  | read-model    | L1/L2    | source-coverage-pending                                             |
| 11  | [EnvMonSwabResultEvidence](#11-envmonswabresultevidence)          | evidence-pack | L3       | mapper-test-pending                                                 |

---

## 1. SPCSubgroupSeries

| Aspect                    | Value                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Business object           | SPC subgroup measurement series for a material / MIC / plant / operation context                                 |
| Pattern                   | `evidence-pack`                                                                                                  |
| Contract                  | `packages/data-contracts/src/schemas/spc-monitoring.ts` — `SPCSubgroupResponseSchema`                            |
| Route                     | `GET /api/spc/subgroups` in `apps/api/routes/spc.py`                                                             |
| Mapper                    | `map_spc_subgroup_rows` in `apps/api/adapters/spc/spc_databricks_adapter.py`                                     |
| Source objects            | `gold.spc_quality_metric_subgroup_mv`                                                                            |
| Field classifications     | Yes — `[classification: source-field]`, `[classification: source-derived]`, `[classification: unavailable]`      |
| `response_model` enforced | Yes                                                                                                              |
| Mapper tests              | ✓ `apps/api/tests/adapters/spc/test_spc_databricks_adapter.py::TestMapSpcSubgroupRows`                           |
| Maturity                  | L4 — direct mapper tests + route-level tests present; browser-UAT pending                                        |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `mapper-tested`, `browser-uat-pending` |

**Known caveats**

- Slice 1 native Databricks only. `capabilityAvailable` is hard-coded to `false`; `nelsonStoredFlagsAvailable` is hard-coded to `false`; `lockedLimits` is always `null` until slice 2 lands.
- The 730-day date-window guard is enforced server-side to prevent broad scans.
- P999 plant sentinel is rejected with 422 before any Databricks call.

**Next action** — Capture browser-UAT evidence per `route-readiness-standard.md`.

---

## 2. SPCChartDataSeries

| Aspect                    | Value                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Quantitative control-chart series (subgroup means + points + locked limits) for a material / MIC                                                               |
| Pattern                   | `evidence-pack`                                                                                                                                                |
| Contract                  | `packages/data-contracts/src/schemas/spc-monitoring.ts` — `ControlChartSeriesSchema` / `ControlChartPointSchema`                                               |
| Route                     | `POST /api/spc/chart-data` in `apps/api/routes/spc.py`                                                                                                         |
| Mapper                    | `map_spc_chart_response` in `apps/api/adapters/spc/spc_databricks_chart_adapter.py`                                                                            |
| Source objects            | `gold.spc_quality_metric_subgroup_mv`, `gold.spc_locked_limits`                                                                                                |
| Field classifications     | Yes — `ControlChartPoint.status` is `application-heuristic` and now accepts `'not-evaluated'` as the source-truthful default                                   |
| `response_model` enforced | Yes                                                                                                                                                            |
| Mapper tests              | ✓ `apps/api/tests/adapters/spc/test_spc_databricks_chart_adapter.py::TestLockedLimitsBranch` (+ `TestNoLockedLimitsBranch`, `TestGuardrailsRegardlessOfInput`) |
| Maturity                  | L4 — mapper-tested; governance-pending on locked-limits approval source                                                                                        |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `mapper-tested`, `governance-pending` (locked-limits approval source, signal source) |

**Known caveats**

- Native databricks-api adapter (in `domain-integrations/spc/src/adapters/spc-monitoring-databricks-api-adapter.ts`) intentionally emits `status: 'not-evaluated'` for every point — no governed signal engine exists yet. UI must NOT collapse `not-evaluated` into `in-control`.
- When a row is found in `spc_locked_limits`, the mapper exposes the numeric `centerLine` / `upperControlLimit` / `lowerControlLimit` and surfaces `lockedBy` for traceability — but **does not** treat `locked_by` as governed approval. `approvalState` stays `pending-validation`, `limitProvenance` stays `unknown`, and the response carries a caveat warning. Promotion to `imported-from-approved-source` / `approved` requires a separate governance decision.
- Route is also fronted by a legacy V1 proxy in `apps/api/routes/spc.py` for backwards compatibility.
- The chart-data route currently skips the locked-limits query when the request omits `chartType` (the SQL binds `:resolved_chart_type`). Frontend callers should send the resolved chart type to surface locked limits.

**Next action** — Governance decision on what `spc_locked_limits` rows mean: do they imply governed approval (and therefore promotion to `imported-from-approved-source` + `approved`), or do they stay `unknown` / `pending-validation`?

---

## 3. BatchQualityPassport

| Aspect                    | Value                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Consolidated quality identity card for a batch (identity + CoA + stock + production + lot history + mass-balance variance + usage-decision evidence)                                            |
| Pattern                   | `evidence-pack` (composite — fans out across 5+ source queries)                                                                                                                                 |
| Contract                  | `packages/data-contracts/src/schemas/batch-quality-passport.ts` — `BatchQualityPassportSchema`                                                                                                  |
| Route                     | `POST /api/trace2/batch-quality-passport` in `apps/api/routes/trace2.py`                                                                                                                        |
| Mapper                    | `build_batch_quality_passport` in `apps/api/adapters/trace2/trace2_databricks_adapter.py` (composes 5 specs)                                                                                    |
| Source objects            | `gold.gold_batch_summary_v`, `gold.gold_batch_stock_v`, `gold.gold_material`, `gold.gold_batch_production_history_v`, `gold.gold_batch_quality_result_v`, `gold.gold_inspection_usage_decision` |
| Field classifications     | Yes — every nested schema carries `[classification: ...]` markers including `application-heuristic` for confidence + status and `source-field` for identity / stock                             |
| `response_model` enforced | Yes                                                                                                                                                                                             |
| Mapper tests              | ✓ `apps/api/tests/adapters/trace2/test_trace_app_mappers.py::TestBuildBatchQualityPassport` (open in `test/trace-app-mapper-hardening`)                                                         |
| Maturity                  | L3 → L4 once the mapper-hardening PR merges                                                                                                                                                     |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `browser-uat-pending` (mapper-tested once PR lands)                                                                   |

**Known caveats**

- `usageDecisionEvidence` replaces what was originally called `signoff`. Rows MUST NOT be presented as governed approval / e-signature / release authority.
- `heuristicQualityConfidence` + `confidenceSource: 'application-heuristic'` — confidence is derived from failed-MIC and warning counts; not a governed SAP/QM field.
- Mass-balance variance is sourced but the `reconciliationSource` is `application-heuristic` (see MassBalanceLedger).
- `daysToExpiry` is computed server-side from `identity.expiryDate` vs current UTC time (`build_batch_quality_passport` at trace2_databricks_adapter.py:2573–2584). The UI displays the value verbatim.

**Next action** — Capture browser-UAT evidence; close the lot-history coverage gap in the mapper tests (currently no test asserts ordering across multiple lots).

---

## 4. MassBalanceLedger

| Aspect                    | Value                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | SAP MSEG-style movement ledger for a batch with KPI rollups and running on-hand                                                                                                                      |
| Pattern                   | `evidence-pack`                                                                                                                                                                                      |
| Contract                  | `packages/data-contracts/src/schemas/mass-balance-ledger.ts` — `MassBalanceLedgerSchema`                                                                                                             |
| Route                     | `POST /api/trace2/mass-balance-ledger` in `apps/api/routes/trace2.py`                                                                                                                                |
| Mapper                    | `map_mass_balance_ledger_rows` in `apps/api/adapters/trace2/trace2_databricks_adapter.py`                                                                                                            |
| Source objects            | `gold.gold_batch_mass_balance_v`                                                                                                                                                                     |
| Field classifications     | Yes — `[classification: source-field]` / `[classification: source-derived]` / `[classification: application-heuristic]`                                                                              |
| `response_model` enforced | Yes                                                                                                                                                                                                  |
| Mapper tests              | `apps/api/tests/routes/test_trace_app_routes.py::TestMovementTypeBucketing` + `::TestMassBalanceLedgerMapping` (movement bucketing, signed quantities, reversal preservation, reconciliation source) |
| Maturity                  | L3/L4                                                                                                                                                                                                |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `mapper-tested`, `governance-pending` (reconciliation)                                                                     |

**Known caveats**

- `reconciliationSource` is always `'application-heuristic'`. The mass-balance variance formula and `BALANCE_QTY` semantics from `gold_batch_mass_balance_v` are not yet governed — UI MUST NOT claim "reconciled" without surfacing the caveat.
- `MOVEMENT_CATEGORY` direction semantics are unresolved (separate audit ongoing).
- Movement-type codes outside `{101/102/131, 261/262, 601/602, 701/702/711/712}` fall into the `Z01` bucket and do not contribute to KPI rollups.

**Next action** — Lift the `BALANCE_QTY`-semantics and `MOVEMENT_CATEGORY`-direction questions into a separate `source-verification` PR; document the verified answer here.

---

## 5. TraceGraph

| Aspect                    | Value                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Upstream + downstream lineage graph for a batch (nodes + edges + traversal metadata)                                                                                             |
| Pattern                   | `evidence-pack` (recursive CTE)                                                                                                                                                  |
| Contract                  | `packages/data-contracts/src/schemas/trace-investigation.ts` — `TraceGraphSchema`                                                                                                |
| Route                     | `POST /api/trace2/trace-graph` in `apps/api/routes/trace2.py`                                                                                                                    |
| Mapper                    | `map_trace_graph` in `apps/api/adapters/trace2/trace2_databricks_adapter.py`                                                                                                     |
| Source objects            | `gold.gold_batch_lineage`, `gold.gold_material`                                                                                                                                  |
| Field classifications     | Yes — nodes/edges carry `[classification: source-field]`, `[classification: source-derived]`, `[classification: application-derived]`, `[classification: application-heuristic]` |
| `response_model` enforced | Yes                                                                                                                                                                              |
| Mapper tests              | ✓ `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py::TestMapTraceGraph`                                                                                          |
| Maturity                  | L4 — direct mapper tests + route-level tests present; browser-UAT pending                                                                                                        |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `mapper-tested`, `browser-uat-pending`                                                                 |

**Known caveats**

- Server-side `WITH RECURSIVE` traversal in `apps/api/adapters/trace2/trace2_databricks_adapter.py`.
- No `plant_id` filter on the anchor — by design (cross-plant lineage must be visible for recall coverage).
- Cycle detection via `path` column in the recursive CTE.

**Next action** — Capture browser-UAT evidence; expand mapper tests to cover deeper cycle and cross-plant cases (existing tests cover the happy path).

---

## 6. CustomerExposureEvidence

| Aspect                    | Value                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Downstream customer / delivery exposure summary for a batch                                                                                                                             |
| Pattern                   | `evidence-pack`                                                                                                                                                                         |
| Contract                  | `packages/data-contracts/src/schemas/trace-investigation.ts` — `CustomerExposureSummarySchema`; AND `packages/data-contracts/src/schemas/recall-readiness.ts` — `RecallReadinessSchema` |
| Route                     | `POST /api/trace2/customer-exposure`, `POST /api/trace2/customer-deliveries`, `POST /api/trace2/recall-readiness`                                                                       |
| Mapper                    | `map_customer_exposure_rows`, `map_customer_delivery_rows`, `map_recall_readiness_rows` in `apps/api/adapters/trace2/trace2_databricks_adapter.py`                                      |
| Source objects            | `gold.gold_batch_lineage` (DELIVERY edges), `gold.gold_batch_delivery_v`                                                                                                                |
| Field classifications     | Yes — `maxExposureDepth`, `recallRecommended`/`recommendationStatus`, `deliveryEvidenceSource`, `uom` all carry markers                                                                 |
| `response_model` enforced | Yes                                                                                                                                                                                     |
| Mapper tests              | `apps/api/tests/routes/test_trace_app_routes.py::TestRecallReadinessMapping` (recommendation not hardcoded, delivery status truthful, country aggregation)                              |
| Maturity                  | L3                                                                                                                                                                                      |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `governance-pending` (recall recommendation)                                                                  |

**Known caveats**

- `RecallReadinessSchema.recommendationStatus` defaults to `'not-evaluated'`. UI MUST NOT collapse this into "no recall needed".
- Delivery `status` is `'delivery-evidence'` (source-truthful) — `gold_batch_delivery_v` has no operational-status column.
- Lineage-only first slice does not populate `countries`; `blockedDeliveries` is always 0 until a status column exists.
- Zero rows → HTTP 404 with "do not interpret as zero exposure" message.

**Next action** — Verify `gold_batch_delivery_v` countries column availability and govern the recall-recommendation rule engine.

---

## 7. SupplierExposureEvidence

| Aspect                    | Value                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Upstream vendor / supplier exposure summary + cross-plant sibling batches                                                                                                                    |
| Pattern                   | `evidence-pack`                                                                                                                                                                              |
| Contract                  | `packages/data-contracts/src/schemas/trace-investigation.ts` — `SupplierExposureSummarySchema`; AND `packages/data-contracts/src/schemas/supplier-batch-view.ts` — `SupplierBatchViewSchema` |
| Route                     | `POST /api/trace2/supplier-exposure`, `POST /api/trace2/supplier-batches`                                                                                                                    |
| Mapper                    | `map_supplier_exposure_rows`, `map_supplier_batch_view` in `apps/api/adapters/trace2/trace2_databricks_adapter.py`                                                                           |
| Source objects            | `gold.gold_batch_lineage` (VENDOR_RECEIPT edges), `gold.gold_supplier`                                                                                                                       |
| Field classifications     | Yes — `SupplierLotRisk` now includes `'unknown'`; per-lot risk classification source markers in place                                                                                        |
| `response_model` enforced | Yes                                                                                                                                                                                          |
| Mapper tests              | `apps/api/tests/routes/test_trace_app_routes.py::TestSupplierBatchViewMapping` (abs(consumed), risk-default, empty handling, cross-plant siblings)                                           |
| Maturity                  | L3                                                                                                                                                                                           |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `source-coverage-pending` (no governed QM risk source)                                                             |

**Known caveats**

- Single-hop VENDOR_RECEIPT only — multi-hop upstream walk is out of scope.
- Per-lot `risk` field defaults to `'low'` from the mapper; no governed supplier-risk source exists. UI must label as low-confidence.
- `openSupplierActions` and `highestRiskSupplier` fields are intentionally absent (require a QM action source — tracked as `TRACE-P1-012`).

**Next action** — Source-verification for a governed supplier-risk score; until then, do not surface `risk` as a release indicator.

---

## 8. ProcessOrderExecutionEvidence

| Aspect                    | Value                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Process-order execution history (header + operations + confirmations + goods movements)                                                                                                           |
| Pattern                   | `evidence-pack` (multi-endpoint composite)                                                                                                                                                        |
| Contract                  | `packages/data-contracts/src/schemas/process-order-review.ts` — `ProcessOrderHeaderSchema` + `ProcessOrderOperationSchema` + `ProcessOrderConfirmationSchema` + `ProcessOrderGoodsMovementSchema` |
| Route                     | Multiple under `/api/process-order/*` in `apps/api/routes/process_order.py`                                                                                                                       |
| Mapper                    | `map_process_order_header_rows`, `map_order_operations_rows`, `map_order_confirmations_rows`, `map_order_goods_movements_rows` in `apps/api/adapters/poh/poh_databricks_adapter.py`               |
| Source objects            | `gold.vw_gold_process_order`, `gold.vw_gold_process_order_phase`, `gold.vw_gold_confirmation`, `gold.vw_gold_adp_movement`                                                                        |
| Field classifications     | Partial — markers include `application-heuristic` and `governance-pending`                                                                                                                        |
| `response_model` enforced | Per-route (each segment has its own model)                                                                                                                                                        |
| Mapper tests              | Not found                                                                                                                                                                                         |
| Maturity                  | L3/L4                                                                                                                                                                                             |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `legacy-bridge-pending` (workCentreId), `mapper-test-pending`                                                           |

**Known caveats**

- `workCentreId` is retained for legacy-bridge compatibility; `operationId` is the verified source field for native consumers.
- `operationText` and `isFinalConfirmation` are optional — not present in the confirmed views.

**Next action** — Mapper unit tests + a single-document field-source matrix covering all four segments.

---

## 9. QualityUsageDecisionEvidence

> **Spec:** [`data-products/quality-usage-decision-evidence.md`](./data-products/quality-usage-decision-evidence.md) — Option A governance (Strict Lot-Level Evidence), 9-code governed label dictionary, contract reconciliation (`QualityInspectionLotEvidence` canonical vs `PassportUsageDecisionEvidence` derived), mapping-status taxonomy, forbidden claims, production-readiness gate.

| Aspect                    | Value                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | SAP usage-decision evidence at inspection-lot level (lot ID + decision text + valuator + timestamp)                                                                                                                    |
| Pattern                   | `evidence-pack`                                                                                                                                                                                                        |
| Contract                  | `packages/data-contracts/src/schemas/batch-quality-passport.ts` — `PassportUsageDecisionEvidenceSchema`; AND `packages/data-contracts/src/schemas/quality-readonly-evidence.ts` — `QualityInspectionLotEvidenceSchema` |
| Route                     | `POST /api/quality/read-only-evidence` in `apps/api/routes/quality.py` (also referenced from `POST /api/trace2/batch-quality-passport` composite)                                                                      |
| Mapper                    | `map_quality_usage_decision_rows` in `apps/api/adapters/quality/quality_databricks_adapter.py`                                                                                                                         |
| Source objects            | `gold.gold_inspection_usage_decision`, `gold.gold_inspection_lot`                                                                                                                                                      |
| Field classifications     | Yes — `usageDecisionCode`, `usageDecisionText`, `usageDecisionMappingStatus` all carry `[classification: ...]` markers                                                                                                 |
| `response_model` enforced | Yes (`QualityEvidenceResponse`)                                                                                                                                                                                        |
| Mapper tests              | Not found                                                                                                                                                                                                              |
| Maturity                  | L3 — Route implemented; mapper unit tests absent                                                                                                                                                                       |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `governance-pending`                                                                                                                         |

**Known caveats**

- **Option A (Strict Lot-Level Evidence)** is enforced. The mapper MUST NOT synthesise a batch-level release decision; multiple lots per batch each carry their own usage decision.
- PROHIBITED labels: `'Released'`, `'Approved'`, `'Cleared'`, `'Signed-off'` at batch level — these are governance-pending.

**Next action** — Direct mapper unit tests covering: lot-to-batch ambiguity, mapping-status taxonomy, refusal to emit batch-level approval.

---

## 10. WarehouseOperationalSnapshot

> **Spec:** [`data-products/warehouse-operational-snapshot.md`](./data-products/warehouse-operational-snapshot.md) — gating document. 3 of 4 sibling routes are broken against live Databricks (overview returns V1 KPI shape silently mapped to 0; inbound/staging/exceptions 500 on UAT). Spec lists the 5-item prerequisite gate that MUST close before any L3+ implementation work proceeds.

| Aspect                                    | Value                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Business object                           | Cross-batch warehouse operational state for a plant / region (overview + inbound + outbound + staging + exceptions)                                                                                                                                                                                                                                                                  |
| Pattern                                   | `read-model` (rolling snapshot)                                                                                                                                                                                                                                                                                                                                                      |
| Contract                                  | `packages/data-contracts/src/schemas/warehouse-360-overview.ts` — `Warehouse360OverviewSchema` + 12 nested schemas                                                                                                                                                                                                                                                                   |
| Route                                     | `GET /api/warehouse360/overview`, `/inbound`, `/outbound`, `/staging`, `/exceptions` in `apps/api/routes/warehouse360.py`                                                                                                                                                                                                                                                            |
| Mapper                                    | `map_warehouse_overview_rows` in `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`                                                                                                                                                                                                                                                                                 |
| Source objects (actual adapter SQL)       | `wh360_kpi_snapshot_v` (overview — returns 11 V1 KPI cols, NOT the contract fields); `wh360_inbound_v` (inbound — adapter SQL references non-existent columns); `wh360_deliveries_v` (outbound — likely works); `staging_orders_v` (staging — **view does not exist** in UAT); `wh360_imwm_exceptions_v` (exceptions — **view does not exist**; correct name is `imwm_exceptions_v`) |
| Source objects (target after gate closes) | `wh360_inbound_v`, `wh360_deliveries_v`, `wh360_process_orders_v`, `wh360_near_expiry_batches_v`, `imwm_exceptions_v`, `imwm_stock_comparison_v`                                                                                                                                                                                                                                     |
| Field classifications                     | Yes — but partial coverage                                                                                                                                                                                                                                                                                                                                                           |
| `response_model` enforced                 | **Deliberately disabled** on `/overview` (mapper output diverges from contract); ✓ on the 4 sibling routes (3 of which return HTTP 500 against live UAT)                                                                                                                                                                                                                             |
| Mapper tests                              | Not found                                                                                                                                                                                                                                                                                                                                                                            |
| Maturity                                  | L1/L2 — contract diverged from mapper; 3 of 4 sibling routes broken in production                                                                                                                                                                                                                                                                                                    |
| Readiness                                 | `code-fixed`, `contract-defined`, `route-implemented`, `source-coverage-pending`, `mapper-test-pending`, `production-blocked`                                                                                                                                                                                                                                                        |

**Known caveats**

- See [`data-products/warehouse-operational-snapshot.md`](./data-products/warehouse-operational-snapshot.md) for the full gating spec.
- `GET /api/warehouse360/inbound`, `/staging`, `/exceptions` return **HTTP 500 against live Databricks** — wrong column names, missing views.
- `GET /api/warehouse360/overview` returns the V1 KPI shape; frontend silently maps every contract count → 0.

**Next action** — Close the 5-item prerequisite gate from the spec before any L3+ work proceeds.

---

## 11. EnvMonSwabResultEvidence

| Aspect                    | Value                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Business object           | Environmental-monitoring (swab) inspection result for a sample point                                                                     |
| Pattern                   | `evidence-pack`                                                                                                                          |
| Contract                  | `packages/data-contracts/src/schemas/environmental-monitoring.ts` — `EnvMonNativeSwabResultSchema` + `EnvMonSwabResultSchema` (enriched) |
| Route                     | `GET /api/envmon/swab-results` in `apps/api/routes/envmon.py` (sibling routes: `/site-summary`, `/alerts`, `/zones`)                     |
| Mapper                    | `map_swab_result_rows` in `apps/api/adapters/envmon/envmon_databricks_adapter.py`                                                        |
| Source objects            | `gold.gold_inspection_lot`, `gold.gold_inspection_point`, `gold.gold_batch_quality_result_v`                                             |
| Field classifications     | Yes — `[classification: source-field]` for raw columns; `[classification: application-heuristic]` for derived `status`                   |
| `response_model` enforced | Yes                                                                                                                                      |
| Mapper tests              | Not found                                                                                                                                |
| Maturity                  | L3                                                                                                                                       |
| Readiness                 | `code-fixed`, `source-verified`, `contract-defined`, `route-implemented`, `mapper-test-pending`                                          |

**Known caveats**

- Filters `INSPECTION_TYPE IN ('14', 'Z14')` to scope to swab inspections.
- `inspectionLotId`, `functionalLocation`, `plantId` are all nullable.
- `status` is derived from valuation code: `'R' | 'REJ' | 'REJECT' → fail`, `'W' | 'WARN' → warning`, `NULL → pending`, other → pass. Treat as `application-heuristic`.

**Next action** — Mapper unit tests on the valuation-code → status mapping, including a fixture for unknown valuation codes.

---

## Cross-cutting follow-on actions

| Priority | Action                                                                                                                                                       | Affects             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| P0       | Add direct mapper unit tests for the remaining products without them (6 of 11 now have direct mapper coverage: 1, 2, 4, 5, 6, 7; 3 has tests in unmerged PR) | 8, 9, 10, 11        |
| P0       | Browser-UAT runbook + evidence capture for SPC and Trace App routes                                                                                          | 1, 2, 3, 4, 5, 6, 7 |
| P1       | Source-verification PRs for `gold_warehouse_inventory`, supplier-risk source, governed recall-rule engine                                                    | 7, 10, 6            |
| P1       | Governance decisions on `recommendationStatus`, `reconciliationSource`, lot-vs-batch usage-decision aggregation                                              | 4, 6, 9             |
| P2       | Resolve `MOVEMENT_CATEGORY` direction and `BALANCE_QTY` semantics                                                                                            | 4                   |
