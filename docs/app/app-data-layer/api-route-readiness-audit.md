# API Route Readiness Audit

> **Purpose.** Map actual FastAPI route paths to data products, response_model
> status, test coverage, and UAT candidate status. Prevents the UAT plan from
> using stale route paths and provides a single reference for route inventory.
>
> **No route is production-ready.** No route has browser UAT evidence captured.
> UAT candidate status means the route may be presented to business users under
> controlled conditions with stated caveats — it does not imply production
> readiness, compliance sign-off, or process validation.
>
> See [uat-entry-plan.md](../docs/app-data-layer-uat-entry-plan.md) for UAT
> entry criteria. See [route-readiness-standard.md](route-readiness-standard.md)
> for what each status means.

---

## Audit table

| Domain       | Method | Route path                           | Data product                    | `response_model`                     | Source status               | Mapper test file                                            | Route test file                | UAT status                           | Caveat / blocker                                                                                                            |
| ------------ | ------ | ------------------------------------ | ------------------------------- | ------------------------------------ | --------------------------- | ----------------------------------------------------------- | ------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Trace2       | POST   | `/api/trace2/batch-header`           | BatchHeaderSummary              | `BatchHeaderSummary` ✅              | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | Requires OAuth token; 404 if batch not found                                                                                |
| Trace2       | POST   | `/api/trace2/trace-graph`            | TraceGraph                      | `TraceGraph` ✅                      | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | Depends on batch-header passing; graph truncates at `max_edges`                                                             |
| Trace2       | POST   | `/api/trace2/customer-exposure`      | CustomerExposureSummary         | `CustomerExposureSummary` ✅         | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | 404 if no customer exposure rows found                                                                                      |
| Trace2       | POST   | `/api/trace2/customer-deliveries`    | CustomerExposureSummary         | `CustomerExposureSummary` ✅         | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | Uses `CustomerExposureSummary` contract; no plant filter (recall-scope)                                                     |
| Trace2       | POST   | `/api/trace2/supplier-exposure`      | SupplierExposureSummary         | `SupplierExposureSummary` ✅         | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | `openSupplierActions=0` (no QM source); `supplierRisk` absent                                                               |
| Trace2       | POST   | `/api/trace2/supplier-batches`       | SupplierBatchView               | `SupplierBatchView` ✅               | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | `risk='unknown'` on all consumed lots — no governed supplier-risk source                                                    |
| Trace2       | POST   | `/api/trace2/mass-balance`           | MassBalanceSummary              | `MassBalanceSummary` ✅              | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | Reconciliation status is application-heuristic, not source-backed                                                           |
| Trace2       | POST   | `/api/trace2/mass-balance-ledger`    | MassBalanceLedger               | `MassBalanceLedger` ✅               | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace_app_routes.py`     | candidate-ready-for-uat-with-caveats | Mode-guard and mapper tests present; no full route contract test yet                                                        |
| Trace2       | POST   | `/api/trace2/investigation-timeline` | InvestigationTimeline           | `InvestigationTimeline` ✅           | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace_app_routes.py`     | candidate-ready-for-uat-with-caveats | Mode-guard and mapper tests present; no full route contract test yet                                                        |
| Trace2       | POST   | `/api/trace2/production-history`     | ProductionHistorySummary        | `ProductionHistorySummary` ✅        | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace2_routes.py`        | candidate-ready-for-uat-with-caveats | `quality_status` maps through application heuristic                                                                         |
| Trace2       | POST   | `/api/trace2/recall-readiness`       | RecallReadiness                 | `RecallReadiness` ✅                 | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace_app_routes.py`     | candidate-ready-for-uat-with-caveats | No recall recommendation inferred; summary fields are source-derived only                                                   |
| Trace2       | POST   | `/api/trace2/holds-ledger`           | HoldsLedger                     | `HoldsLedger` ✅                     | databricks-api              | `test_trace_app_mappers.py`                                 | `test_trace_app_routes.py`     | candidate-ready-for-uat-with-caveats | UOM from source only (never defaulted to KG)                                                                                |
| Trace2       | POST   | `/api/trace2/batch-quality-passport` | BatchQualityPassport            | `BatchQualityPassport` ✅            | databricks-api (partial)    | `test_trace_app_mappers.py`                                 | `test_trace_app_routes.py`     | candidate-ready-for-uat-with-caveats | Quality sections partial — CoA / lot-history / signoff sections are mock-only; `confidenceSource='application-heuristic'`   |
| Quality      | POST   | `/api/quality/read-only-evidence`    | QualityEvidenceResponse         | `QualityEvidenceResponse` ✅         | databricks-api              | `tests/adapters/quality/test_quality_databricks_adapter.py` | `test_quality_routes.py`       | candidate-ready-for-uat-with-caveats | Lot-level evidence only; no batch-level release/approval; `pending-source-verification` when mode guard active              |
| POH          | POST   | `/api/por/order-header`              | ProcessOrderHeader              | `ProcessOrderHeader` ✅              | databricks-api / legacy-api | `tests/adapters/poh/test_poh_databricks_adapter.py`         | `test_process_order_routes.py` | candidate-ready-for-uat-with-caveats | Dual-mode (legacy-api + databricks-api)                                                                                     |
| POH          | GET    | `/api/por/order-operations`          | list[ProcessOrderOperation]     | `list[ProcessOrderOperation]` ✅     | databricks-api              | `tests/adapters/poh/test_poh_databricks_adapter.py`         | `test_process_order_routes.py` | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| POH          | GET    | `/api/por/order-confirmations`       | list[ProcessOrderConfirmation]  | `list[ProcessOrderConfirmation]` ✅  | databricks-api              | `tests/adapters/poh/test_poh_databricks_adapter.py`         | `test_process_order_routes.py` | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| POH          | GET    | `/api/por/order-goods-movements`     | list[ProcessOrderGoodsMovement] | `list[ProcessOrderGoodsMovement]` ✅ | databricks-api              | `tests/adapters/poh/test_poh_databricks_adapter.py`         | `test_process_order_routes.py` | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| SPC          | GET    | `/api/spc/subgroups`                 | SPCSubgroupResponse             | `SPCSubgroupResponse` ✅             | databricks-api              | `tests/adapters/spc/test_spc_databricks_adapter.py`         | `test_spc_routes.py`           | candidate-ready-for-uat-with-caveats | Requires all 5 filter params; `P999` sentinel rejected at route                                                             |
| SPC          | POST   | `/api/spc/chart-data`                | —                               | **NONE** ⚠️                          | databricks-api              | `tests/adapters/spc/test_spc_databricks_chart_adapter.py`   | `test_spc_chart_data.py`       | blocked                              | No `response_model`; returns untyped dict — contract drift undetectable at the route                                        |
| SPC          | GET    | `/api/spc/materials`                 | —                               | **NONE** ⚠️                          | databricks-api              | —                                                           | —                              | blocked                              | No `response_model`; no mapper test file; metadata filter endpoint                                                          |
| SPC          | GET    | `/api/spc/plants`                    | —                               | **NONE** ⚠️                          | databricks-api              | —                                                           | —                              | blocked                              | No `response_model`; metadata filter endpoint                                                                               |
| SPC          | GET    | `/api/spc/characteristics`           | —                               | **NONE** ⚠️                          | databricks-api              | —                                                           | —                              | blocked                              | No `response_model`; metadata filter endpoint                                                                               |
| SPC          | GET    | `/api/spc/capability`                | —                               | **NONE** ⚠️                          | databricks-api              | —                                                           | —                              | blocked                              | No `response_model`; returns untyped dict                                                                                   |
| Warehouse360 | GET    | `/api/warehouse360/inbound`          | list[Warehouse360InboundItem]   | `list[Warehouse360InboundItem]` ✅   | databricks-api              | `tests/adapters/warehouse360/test_warehouse360_adapter.py`  | `test_warehouse360_routes.py`  | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| Warehouse360 | GET    | `/api/warehouse360/staging`          | list[Warehouse360StagingItem]   | `list[Warehouse360StagingItem]` ✅   | databricks-api              | `tests/adapters/warehouse360/test_warehouse360_adapter.py`  | `test_warehouse360_routes.py`  | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| Warehouse360 | GET    | `/api/warehouse360/exceptions`       | list[Warehouse360ExceptionItem] | `list[Warehouse360ExceptionItem]` ✅ | databricks-api              | `tests/adapters/warehouse360/test_warehouse360_adapter.py`  | `test_warehouse360_routes.py`  | candidate-ready-for-uat-with-caveats |                                                                                                                             |
| Warehouse360 | GET    | `/api/warehouse360/overview`         | —                               | **NONE** ⚠️                          | databricks-api              | `tests/adapters/warehouse360/test_warehouse360_adapter.py`  | `test_warehouse360_routes.py`  | **blocked**                          | No `response_model`; returns untyped dict; overview aggregation logic not yet governed — remains blocked per UAT entry plan |
| Warehouse360 | POST   | `/api/wh360/warehouse-summary`       | —                               | **NONE** ⚠️                          | legacy-api proxy            | —                                                           | —                              | out-of-scope                         | Legacy proxy endpoint; not a UAT candidate — superseded by warehouse360 native routes                                       |

---

## UAT status legend

| Status                                 | Meaning                                                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `candidate-ready-for-uat-with-caveats` | Route has `response_model` enforcement, source-truthful mapper, and at least one test file. May be presented to business users under controlled conditions with stated caveats. No browser UAT evidence captured yet. |
| `blocked`                              | Route is missing `response_model`, has no mapper tests, or has a known contract/source-truth gap that prevents safe UAT use.                                                                                          |
| `out-of-scope`                         | Route is a legacy proxy or internal route not relevant to the current UAT scope.                                                                                                                                      |

---

## Summary

| Domain       | Candidate routes | Blocked routes | Out-of-scope |
| ------------ | ---------------- | -------------- | ------------ |
| Trace2       | 13               | 0              | 0            |
| Quality      | 1                | 0              | 0            |
| POH          | 4                | 0              | 0            |
| SPC          | 1                | 4              | 0            |
| Warehouse360 | 3                | 1              | 1            |
| **Total**    | **22**           | **5**          | **1**        |

---

## Notes

### SPC metadata routes (`/api/spc/materials`, `/api/spc/plants`, `/api/spc/characteristics`, `/api/spc/capability`)

These four routes are filter-population endpoints used to drive the SPC subgroups query form. They return untyped dicts and have no `response_model`. They are blocked from UAT as standalone data products. The `subgroups` route itself (`GET /api/spc/subgroups`) is a UAT candidate.

### Warehouse360 overview (`/api/warehouse360/overview`)

The overview aggregation logic is not yet governed and returns an untyped dict. It remains blocked per the UAT entry plan. The four item-level routes (`inbound`, `staging`, `exceptions`, and `outbound`) have `response_model` enforcement and are UAT candidates.

### Batch-quality-passport partial data

`POST /api/trace2/batch-quality-passport` is a UAT candidate but sections for CoA, lot history, and signoff are currently mock-only. The `confidenceSource` field is explicitly set to `'application-heuristic'`. UI must surface this caveat to users.

### customer-deliveries response_model

`POST /api/trace2/customer-deliveries` uses `response_model=CustomerExposureSummary`. This is intentional — delivery data is exposed as customer exposure evidence (the data shape is compatible). The route name describes the data source; the contract shape describes the evidence type.

### Routes added in unmerged PRs

The following routes have test coverage added in PRs pending merge — tests on `main` may be less complete than shown until PRs are merged:

- `supplier-batches` route tests (PR 8 — `test/trace2-supplier-exposure-risk-guardrails`)
- `supplier-exposure` mapper tests (PR 8)
- `customer-deliveries` mapper tests (PR 7 — `test/trace2-customer-delivery-evidence-hardening`)

---

## Related documents

- [uat-entry-plan.md](uat-entry-plan.md) — which data products may enter UAT and under what conditions
- [route-readiness-standard.md](route-readiness-standard.md) — readiness level definitions
- [contract-generation.md](contract-generation.md) — how to detect generated contract drift
- [browser-uat-checklists/](browser-uat-checklists/) — domain-specific UAT checklists
- [domain-data-product-catalog.md](domain-data-product-catalog.md) — per-data-product maturity and readiness
