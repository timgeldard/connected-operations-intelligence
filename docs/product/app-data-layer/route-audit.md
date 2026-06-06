# Route Audit Against the App Data Product Standard

This audit classifies every FastAPI route under `/api/*` against the
operating model landed in PR #82 and the domain data product catalogue.

For every route we record:

| Criterion | What it means |
|---|---|
| **Data product** | Which entry from `domain-data-product-catalog.md` does it expose? |
| **Source mapped** | Are the Databricks gold view(s) the route reads documented and DDL-verified? |
| **Contract defined** | Does a Zod schema exist for the response payload? |
| **`response_model` enforced** | Does the FastAPI decorator declare `response_model=…`? |
| **Fields classified** | Do the response schema fields carry `[classification: …]` markers? |
| **Mapper tests** | Are there direct unit tests on the row mapper? |
| **Browser-UAT** | Has the route been exercised end-to-end against UAT with evidence? |
| **Governance caveats explicit** | Are governance-pending behaviours (recall recommendation, signoff semantics, in-control claims, etc.) documented in route docstrings AND the contract? |

Audit cut-off: rebased onto `main` at the point this document landed.

---

## Summary table — all 38 routes under `/api/*`

| # | Method · Path | Router file | Data product | Source mapped | Contract | `response_model` | Fields classified | Mapper tests | Browser-UAT | Governance caveats |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET `/api/auth/session` | `auth.py` | (infra — not a data product) | n/a | `UserIdentitySchema` | ✓ | n/a | n/a | n/a | n/a |
| 2 | GET `/api/diagnostics/auth-headers` | `auth_diagnostics.py` | (infra) | n/a | none | ✗ | n/a | n/a | n/a | n/a |
| 3 | GET `/api/health` | `health.py` | (infra) | n/a | none | ✗ | n/a | n/a | n/a | n/a |
| 4 | GET `/api/workspaces/manifest` | `workspaces.py` | (infra) | n/a | `WorkspaceManifestSchema` | ✓ | n/a | n/a | n/a | n/a |
| 5 | POST `/api/quality/read-only-evidence` | `quality.py` | QualityUsageDecisionEvidence | partial | `QualityEvidenceResponseSchema` | ✓ | partial | ✓ (`test_quality_databricks_adapter.py`) | pending | ✓ (Option A enforced) |
| 6 | GET `/api/cq/lab/fails` | `connected_quality_lab.py` | (CQ lab — not catalogued) | partial | none | ✗ | ✗ | ✗ | pending | ✗ |
| 7 | GET `/api/cq/lab/plants` | `connected_quality_lab.py` | (CQ lab — not catalogued) | partial | none | ✗ | ✗ | ✓ (`TestMapLabPlantsRows`) | pending | ✗ |
| 8 | GET `/api/envmon/site-summary` | `envmon.py` | (EnvMon site summary — partial) | ✓ | `EnvMonSiteSummarySchema` | ✓ | partial | ✓ (`TestMapSiteSummaryRows`) | pending | partial |
| 9 | GET `/api/envmon/swab-results` | `envmon.py` | EnvMonSwabResultEvidence | ✓ | `EnvMonNativeSwabResultSchema` | ✓ | ✓ | ✓ (`TestMapSwabResultRows`) | pending | ✓ (status is heuristic) |
| 10 | POST `/api/por/order-header` | `process_order.py` | ProcessOrderExecutionEvidence | ✓ | `ProcessOrderHeaderSchema` | ✗ (no `response_model`) | partial | ✓ (`TestMapProcessOrderHeaderRows`) | pending | partial |
| 11 | GET `/api/por/order-operations` | `process_order.py` | ProcessOrderExecutionEvidence | ✓ | `ProcessOrderOperationSchema` | ✓ | partial | ✓ (`TestMapOrderOperationsRows`) | pending | partial |
| 12 | GET `/api/por/order-confirmations` | `process_order.py` | ProcessOrderExecutionEvidence | ✓ | `ProcessOrderConfirmationSchema` | ✓ | partial | ✓ (`TestMapOrderConfirmationsRows`) | pending | partial |
| 13 | GET `/api/por/order-goods-movements` | `process_order.py` | ProcessOrderExecutionEvidence | ✓ | `ProcessOrderGoodsMovementSchema` | ✓ | partial | ✓ (`TestMapOrderGoodsMovementsRows`) | pending | partial |
| 14 | GET `/api/spc/materials` | `spc.py` | (SPC navigation — legacy proxy) | ✗ (legacy) | none | ✗ | n/a | ✗ | pending | n/a |
| 15 | GET `/api/spc/plants` | `spc.py` | (SPC navigation — legacy proxy) | ✗ (legacy) | none | ✗ | n/a | ✗ | pending | n/a |
| 16 | GET `/api/spc/characteristics` | `spc.py` | (SPC navigation — legacy proxy) | ✗ (legacy) | none | ✗ | n/a | ✗ | pending | n/a |
| 17 | GET `/api/spc/capability` | `spc.py` | (SPC capability — legacy proxy) | ✗ (legacy) | none | ✗ | n/a | ✗ | pending | n/a |
| 18 | POST `/api/spc/chart-data` | `spc.py` | SPCChartDataSeries | ✓ | `SpcChartDataResponseSchema` | ✓ | ✓ | ✗ | pending | ✓ (locked-limits, signals deferred) |
| 19 | GET `/api/spc/subgroups` | `spc.py` | SPCSubgroupSeries | ✓ | `SPCSubgroupResponseSchema` | ✓ | ✓ | ✓ (`TestMapSpcSubgroupRows`) | pending | ✓ (capability+nelson hardcoded false) |
| 20 | POST `/api/trace2/batch-header` | `trace2.py` | (Batch header — supports BatchQualityPassport) | ✓ | `BatchHeaderSummarySchema` | ✗ (returns `dict`) | partial | ✓ (`TestMapBatchHeaderRows`) | pending | ✗ |
| 21 | POST `/api/trace2/trace-graph` | `trace2.py` | TraceGraph | ✓ | `TraceGraphSchema` | ✓ | ✓ | ✓ (`TestMapTraceGraph`) | pending | partial |
| 22 | POST `/api/trace2/customer-exposure` | `trace2.py` | CustomerExposureEvidence | ✓ | `CustomerExposureSummarySchema` | ✓ | ✓ | ✓ (`TestMapCustomerExposureRows`) | pending | partial (deliveryEvidenceSource marker) |
| 23 | POST `/api/trace2/customer-deliveries` | `trace2.py` | CustomerExposureEvidence | ✓ | `CustomerExposureSummarySchema` | ✓ | ✓ | ✓ (`TestMapCustomerDeliveryRows`) | pending | partial |
| 24 | POST `/api/trace2/supplier-exposure` | `trace2.py` | SupplierExposureEvidence | ✓ | `SupplierExposureSummarySchema` | ✓ | ✓ | ✓ (`TestMapSupplierExposureRows`) | pending | ✓ (risk source absent) |
| 25 | POST `/api/trace2/production-history` | `trace2.py` | (Production history — supports ProcessOrder) | ✓ | `ProductionHistorySummarySchema` | ✓ | partial | ✓ (`TestMapProductionHistoryRows`) | pending | partial |
| 26 | POST `/api/trace2/mass-balance` | `trace2.py` | (Mass-balance summary — supports MassBalanceLedger) | ✓ | `MassBalanceSummarySchema` | ✓ | partial | ✓ (`TestMapMassBalanceRows`) | pending | partial |
| 27 | POST `/api/trace2/recall-readiness` | `trace2.py` | CustomerExposureEvidence | ✓ | `RecallReadinessSchema` | ✓ | ✓ | ✓ | pending | ✓ (recommendationStatus, delivery-evidence) |
| 28 | POST `/api/trace2/supplier-batches` | `trace2.py` | SupplierExposureEvidence | ✓ | `SupplierBatchViewSchema` | ✓ | ✓ | ✓ | pending | ✓ (risk default low; cross-plant) |
| 29 | POST `/api/trace2/batch-quality-passport` | `trace2.py` | BatchQualityPassport | ✓ | `BatchQualityPassportSchema` | ✓ | ✓ | ✗ | pending | ✓ (usage-decision-evidence, heuristic confidence) |
| 30 | POST `/api/trace2/mass-balance-ledger` | `trace2.py` | MassBalanceLedger | ✓ | `MassBalanceLedgerSchema` | ✓ | ✓ | ✓ | pending | ✓ (reconciliationSource, Z01 bucket) |
| 31 | POST `/api/trace2/investigation-timeline` | `trace2.py` | (Investigation timeline — not catalogued) | ✓ | `InvestigationTimelineSchema` | ✓ | ✓ | ✗ | pending | partial |
| 32 | POST `/api/trace2/holds-ledger` | `trace2.py` | (Holds ledger — not catalogued) | ✓ | `HoldsLedgerSchema` | ✓ | ✓ | ✓ | pending | ✓ (no invented UOM, no SAP write-back) |
| 33 | POST `/api/wh360/warehouse-summary` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | none | ✗ | partial | ✗ | pending | ✗ |
| 34 | GET `/api/warehouse360/overview` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | `Warehouse360OverviewSchema` | ✗ | ✓ | ✗ | pending | partial |
| 35 | GET `/api/warehouse360/inbound` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | `Warehouse360InboundItemSchema` | ✓ | ✓ | ✗ | pending | partial |
| 36 | GET `/api/warehouse360/outbound` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | `Warehouse360OutboundItemSchema` | ✓ | ✓ | ✗ | pending | partial |
| 37 | GET `/api/warehouse360/staging` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | `Warehouse360StagingItemSchema` | ✓ | ✓ | ✗ | pending | partial |
| 38 | GET `/api/warehouse360/exceptions` | `warehouse360.py` | WarehouseOperationalSnapshot | partial | `Warehouse360ExceptionItemSchema` | ✓ | ✓ | ✗ | pending | partial |

Legend: ✓ done · partial · ✗ missing · n/a — infrastructure/non-data-product · pending = not captured

---

## Findings — gaps grouped by criterion

### Critical: Python 3.11 import-time failure (P0)

`apps/api/adapters/quality/quality_databricks_adapter.py:25` — `QualityUsageDecisionQuerySpec` is a dataclass that inherits from `QuerySpec` (which has default-valued fields) and then adds non-default fields (`material_id: str`, `batch_id: str`). This raises `TypeError: non-default argument 'material_id' follows default argument` at import time on Python 3.11.

Effect: `main.py` cannot be imported via the standard route, which blocks `uv run python -c "from main import app"` and **likely blocks any backend test that imports `main`**. The fact that route #5 (`/api/quality/read-only-evidence`) still works in UAT suggests the app is being run on a Python version where dataclass inheritance is more permissive, or the import chain in production differs.

**Action:** Make the inherited fields default-valued (e.g. `material_id: str = ""`, `batch_id: str = ""`) and add explicit validation, OR use `field(kw_only=True)` to detach the inheritance ordering. This is a P0 follow-on.

### `response_model` not enforced (4 routes)

These routes return raw `dict` or `list` and bypass Pydantic validation on the response side:

- `POST /api/trace2/batch-header`
- `POST /api/wh360/warehouse-summary`
- `GET /api/warehouse360/overview`
- `POST /api/por/order-header`

**Action:** add `response_model=…` to each. Without `response_model` enforcement, contract drift cannot be detected by FastAPI and field classifications cannot be verified at the wire.

### Contract not defined (5 routes)

- `GET /api/diagnostics/auth-headers` — diagnostic, acceptable
- `GET /api/health` — health probe, acceptable
- `GET /api/cq/lab/fails`, `GET /api/cq/lab/plants` — return raw `dict`; should be modelled
- `POST /api/wh360/warehouse-summary` — should converge on `Warehouse360Summary`

**Action:** define schemas for the CQ Lab routes; converge `/wh360/warehouse-summary` on the existing `Warehouse360Summary` contract.

### Mapper tests missing (data-bearing gap)

**Correction (post-review):** the initial audit understated coverage. After
re-inventorying `apps/api/tests/adapters/`, **20 of 34 data-bearing routes
have direct mapper unit tests**. The remaining gap is **10 routes** (after
excluding the 4 SPC legacy proxy routes, which have no native mapper).

| Route | Mapper without direct tests |
|---|---|
| `GET /api/cq/lab/fails` | (no mapper — returns raw dict) |
| `POST /api/spc/chart-data` | `map_spc_chart_response` |
| `POST /api/trace2/batch-quality-passport` | `build_batch_quality_passport` |
| `POST /api/trace2/investigation-timeline` | `map_investigation_timeline_rows` |
| `POST /api/wh360/warehouse-summary` | `map_warehouse_summary_rows` |
| `GET /api/warehouse360/overview` | `map_warehouse_overview_rows` |
| `GET /api/warehouse360/inbound` | `map_inbound_rows` |
| `GET /api/warehouse360/outbound` | `map_outbound_rows` |
| `GET /api/warehouse360/staging` | `map_staging_rows` |
| `GET /api/warehouse360/exceptions` | `map_exceptions_rows` |

`build_batch_quality_passport` and `map_investigation_timeline_rows` are
addressed by the open `test/trace-app-mapper-hardening` PR (40 new cases).

**Action priority for the remaining 8:**

1. `map_spc_chart_response` (SPC chart-data — the failing locked-limits test surfaces a real bug)
2. `map_warehouse_overview_rows` and siblings — blocked on the `WarehouseOperationalSnapshot` prerequisite gate
3. CQ Lab routes — decide whether to model or deprecate

### Browser-UAT pending (38 of 38 routes)

No route has captured end-to-end browser UAT evidence in the standard form. PR #82 added `route-readiness-standard.md` but the runbook output is not yet recorded for any route.

**Action:** define a single UAT capture template, then iterate through the catalogue's L4+ products (SPCSubgroupSeries first, then BatchQualityPassport, then the four Recall/Supplier/Mass-Balance/Holds ledger routes).

### Governance caveats — incomplete

Caveats are explicit in 8 routes (mostly the post-PR-#82 Trace App + SPC native routes) and partial or missing in the other 30. The pattern: routes that landed pre-PR-#82 generally do not carry source-truthfulness annotations in their docstrings; the contracts have classifications but the route layer doesn't reinforce them.

**Action:** as each route's mapper is hardened (above), update its docstring to reference the contract's governance markers (recall recommendation, status enums, reconciliation source, etc.) inline.

### Fields not classified

Mostly the post-PR-#82 schemas are classified. Older schemas only partially classify:

- `BatchHeaderSummary` — partial markers
- `EnvMonSiteSummary` — partial markers
- `ProductionHistorySummary` — partial markers
- `MassBalanceSummary` (the trace2 summary, not the ledger) — partial markers
- `Warehouse360Overview` — comprehensive at the top level, partial on nested items

**Action:** sweep schema-by-schema to add classification markers; do not block on this — handle alongside mapper-test work for the same data product.

---

## Per-domain notes

### SPC (`apps/api/routes/spc.py`)

- The native `/api/spc/subgroups` and `/api/spc/chart-data` routes are the L3/L4 routes (route #18, #19). They follow the post-PR-#82 standard.
- The four legacy proxy routes (`/spc/materials`, `/plants`, `/characteristics`, `/capability`) forward to V1; they have no contracts, no `response_model`, and no field classifications. **Recommendation:** deprecate alongside the native chart-data slice — do not add new functionality.

### Trace2 (`apps/api/routes/trace2.py`)

- The Trace App slice routes (post-PR-#76) are the gold standard for the new pattern: full `response_model`, source-truthful field values, blank-input validation, classification markers, mapper tests.
- `/api/trace2/batch-header` (route #20) is the outlier — it pre-dates the post-PR-#76 hardening, returns `dict`, has no `response_model`. **Recommendation:** retrofit to `response_model=BatchHeaderSummary` as a small `route-implementation` PR.

### Process Order (`apps/api/routes/process_order.py`)

- 3 of 4 routes have `response_model`; `POST /api/por/order-header` does not. Contracts exist for all 4 but lack full field-classification coverage.
- `workCentreId` is retained for legacy-bridge compatibility — flagged in the catalogue but not yet annotated at the route docstring layer.

### Warehouse360 (`apps/api/routes/warehouse360.py`)

- The overview routes are L1/L2 — source DDL not fully verified. Two of six routes lack `response_model`.
- **Recommendation:** treat as `source-verification` PR before any new functionality.

### EnvMon (`apps/api/routes/envmon.py`)

- Both routes have `response_model` and source-mapped views. Missing: mapper tests on the valuation-code → status mapping.

### Connected Quality Lab (`apps/api/routes/connected_quality_lab.py`)

- Not represented in the catalogue. Two GET routes return raw `dict` with no schema.
- **Recommendation:** model as a data product or document why CQ Lab is intentionally out of scope.

### Quality read-only evidence (`apps/api/routes/quality.py`)

- One route. `response_model` enforced. Mapper tests missing. Option A (lot-level evidence; no batch-level approval synthesis) is enforced at the mapper but should be tested.
- **Critical:** the dataclass bug above blocks importing this adapter cleanly on Python 3.11.

---

## Cross-cutting follow-on roadmap

| Priority | Action | Routes affected | Estimated slice size |
|---|---|---|---|
| **P0** | Fix `QualityUsageDecisionQuerySpec` dataclass ordering | route #5 (and any test that imports `main`) | very small |
| **P0** | Add `response_model` to the 4 routes missing it | routes #10, #20, #33, #34 | small |
| **P0** | Add direct mapper unit tests for the 8 remaining gaps (chart-data, passport, timeline, 5 warehouse, CQ lab) | routes #6, #18, #29, #31, #33–#38 | medium |
| P1 | Sweep field classification on pre-PR-#82 schemas | routes #20, #25, #26, plus #34–#38 | small per schema |
| P1 | Add governance caveats in pre-PR-#76 route docstrings | routes #20–#26 | small |
| P1 | Define UAT capture template + record evidence for L3/L4 routes | all data-bearing routes | per-route small |
| P2 | Model or deprecate CQ Lab + SPC legacy proxy routes | routes #6, #7, #14–#17 | medium |
| P2 | Source-verification PR for warehouse views | routes #33–#38 | medium |

The next implementation slice per the recommendation file is `fix(spc): align frontend adapter with native chart-data/subgroup guardrails` — this audit reinforces it: SPC has the most-mature native routes but the smallest test coverage relative to the SPC frontend surface that consumes them.
