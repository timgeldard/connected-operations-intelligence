# Quality V1 Source Discovery

**Date:** 2026-05-21
**Branch:** `codex/quality-v1-source-discovery`
**Scope:** V1 functional and source discovery for Quality, Batch Release, SAP QM evidence, CoA, usage decision, deviations, EnvMon, SPC links, and V2 migration planning.

## Executive Summary

V1 did not contain a single production-ready "Quality Batch Release" application with governed release approvals, e-signature, audit trail, or SAP QM write-back. It contained several Quality-adjacent surfaces:

- ConnectedQuality Lab Board for failed/warning SAP QM inspection characteristics by plant.
- Process Order History quality analytics and process-order detail inspection/usage-decision sections.
- Trace2 quality record pages for batch quality lots/results, CoA-like result rows, production history, and batch compare.
- EnvMon inspection-analysis and spatial monitoring surfaces.
- SPC monitoring surfaces using the same broad QM/MIC result universe for advisory statistical signals.
- A static `quality-suite` prototype with mock inspection queue, deviations, quality signals, and specification tables.

The strongest live/read-only V1 sources are inspection lot, MIC result/specification, usage-decision text/code, and CoA-like batch result views. Release queue, release actions, quality holds, deviations/nonconformance workflow, e-signature, and production release status remain either mock/prototype, derived, or not proven as governed live sources.

V2 Quality Batch Release should therefore remain simulation/trust-hardened until a bounded native read-only slice is implemented and validated. The first safe build slice is **read-only inspection lot + MIC result evidence**, with usage-decision display added only after source semantics are verified.

## V1 Files And Folders Inspected

| Area | File / Folder | Finding |
|---|---|---|
| ConnectedQuality app | `/private/tmp/ConnectIO-RAD-poh-deep-dive/apps/connectedquality/**` | Real V1 app for quality monitoring, lab board, alarms, SPC/EnvMon/Trace composition. |
| ConnectedQuality frontend | `apps/connectedquality/frontend/src/pages/lab/LabBoard.tsx` | Wallboard for failed/warning lab inspection results by plant and optional lot type. |
| ConnectedQuality backend route | `apps/connectedquality/backend/connectedquality_backend/routers/lab.py` | `GET /lab/fails` and `GET /lab/plants`; requires proxy user token. |
| ConnectedQuality DAL | `apps/connectedquality/backend/connectedquality_backend/dal/lab.py` | Databricks SQL over `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_inspection_usage_decision`, `vw_gold_inspection_specification`, `vw_gold_material`, process-order plan/material. |
| ConnectedQuality alarms | `apps/connectedquality/frontend/src/pages/Alarms.tsx`, `backend/connectedquality_backend/routers/alarms.py` | Cross-module inbox aggregating SPC scorecard and EnvMon KPI signals; no release approval workflow. |
| Static prototype | `apps/platform/standalone/quality-suite/index.html` | Mock/static Quality Suite with inspection queue, deviations, signals, spec rows. No backend or persisted actions. |
| Trace2 quality record | `apps/trace2/backend/trace2_backend/quality_record/**` | Batch-scoped quality/CoA/mass-balance routes backed by shared Trace DAL. |
| Shared Trace DAL | `libs/shared-trace/src/shared_trace/dal.py` | Uses `gold_batch_quality_lot_v`, `gold_batch_quality_result_v`, `gold_batch_quality_summary_v`, `gold_batch_coa_results_v`, `gold_batch_production_history_v`. |
| Shared Trace schema constants | `libs/shared-trace/src/shared_trace/schema.py` | Lists batch quality and CoA gold view names. |
| POH quality analytics | `apps/processorderhistory/backend/processorderhistory_backend/manufacturing_analytics/dal/quality_analytics_dal.py` | Plant/date quality analytics over `vw_gold_quality_result_enriched` and `metric_quality_daily`. |
| POH order detail | `apps/processorderhistory/backend/processorderhistory_backend/order_execution/dal/order_detail_dal.py` | Process-order inspection rows and first usage decision from `vw_gold_inspection_result`, `vw_gold_inspection_specification`, `vw_gold_inspection_lot`, `vw_gold_inspection_usage_decision`. |
| EnvMon | `apps/envmon/**` | Separate environmental monitoring app with inspection-analysis and spatial config; related to Quality but not batch release. |
| SPC | `apps/spc/**` | Separate SPC app using MIC/material/plant quality result concepts for advisory process-control analytics. |
| Missing app evidence | `apps/quality`, `apps/batchrelease`, `apps/batch-release`, `apps/qm`, `apps/cq` | No such top-level V1 app folders found. ConnectedQuality is the CQ-equivalent app. |

## V1 Quality Functionality Inventory

| Screen / Component | File Path | Purpose | Inputs / Filters | Outputs | Actions | Source Status |
|---|---|---|---|---|---|---|
| ConnectedQuality Lab Board | `apps/connectedquality/frontend/src/pages/lab/LabBoard.tsx` | 6-card rotating wallboard of failed/warning inspection characteristics. | Plant selector or URL `plant_id` / `plant`; optional `lot_type`. | Material, material number, inspection lot, batch, line, characteristic, result, limits, UOM, severity, timestamp. | Prev/next page; plant and lot-type filtering. Read-only. | Live V1 backend route, backed by Databricks SQL. |
| ConnectedQuality Alarms | `apps/connectedquality/frontend/src/pages/Alarms.tsx` | Cross-module quality signal inbox. | Optional backend query filters for source/status/material. | SPC/EnvMon alarms, status, source, subject/site/owner/age. | UI buttons for export / mark read appear, but backend shown is read-only aggregation. | Derived/advisory from SPC and EnvMon; not release workflow. |
| POH Quality Analytics | `apps/processorderhistory/frontend/src/pages/QualityAnalytics.tsx` | Plant/date quality analytics, RFT trend, contributors, CSV export. | Plant, material, date range, comparison. | Accepted/rejected counts, RFT%, hourly/daily trend, raw inspection rows, group breakdown. | CSV export and navigation to process order. Read-only. | Live Databricks query via V1 POH backend. |
| POH Order Detail Inspections | `apps/processorderhistory/frontend/src/pages/OrderDetail.tsx` | Process-order detail inspection results and usage-decision card. | Process order. | MIC rows, spec text, quantitative/qualitative result, judgement, usage-decision card. | View toggle table/tiles. Read-only. | Live Databricks query for inspection rows/UD; mock fallback exists in frontend mock data. |
| Trace2 Quality Record | `apps/trace2/backend/trace2_backend/quality_record/router.py` | Batch-scoped quality, CoA, production history, batch compare APIs. | Material ID and batch ID. | Lots, MIC results, quality summary, CoA result rows, production history, batch compare. | Read-only API. | Live Databricks via shared Trace DAL. |
| Static Quality Suite | `apps/platform/standalone/quality-suite/index.html` | Standalone HTML concept for inspection queue, deviations, quality signals, spec table. | In-page tab state only. | Mock inspection queue, mock deviations, mock signals, mock spec rows. | UI-only navigation. | Static/mock prototype only. |
| EnvMon | `apps/envmon/frontend/src/views/*.tsx` | Environmental monitoring floor/site/global inspection analysis. | Plant/floor/date style context. | Heatmaps, lots, trend panels, spatial monitoring. | Spatial config has write-like workflows in V1; out of scope for V2 Quality release. | Separate bounded context. |
| SPC | `apps/spc/frontend/src/spc/**` | Statistical process control by material/plant/MIC. | Material, plant, MIC, date range. | Control charts, capability, signals, rule violations. | Advisory analysis; limit editing exists in SPC context, not Quality release. | Separate bounded context. |

## V1 Backend / API / Source Inventory

| V1 Route / Function | File Path | Parameters | Grain | Source Tables / Views | Key Fields | V2 Equivalent | Gap |
|---|---|---|---|---|---|---|---|
| `GET /lab/fails` | `apps/connectedquality/backend/connectedquality_backend/routers/lab.py` | `plant_id`, optional `lot_type` | Failed/warning inspection characteristic row | `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_process_order_plan`, `vw_gold_process_order_material`, `vw_gold_inspection_usage_decision`, `vw_gold_inspection_specification`, `vw_gold_material` | Process order, inspection lot, batch, material, line, characteristic, result, valuation, lot type | V2 Connected Quality Lab Board legacy adapter | Wired via legacy proxy; not native Databricks; browser verification pending. |
| `GET /lab/plants` | Same | none | Plant dimension | `gold_plant` | `PLANT_ID`, `PLANT_NAME` | V2 Connected Quality Lab Board plant list | Legacy proxy only. |
| `POST /quality/analytics` | `apps/processorderhistory/backend/.../router_quality.py` | `plant_id`, `date_from`, `date_to`, `timezone` | Inspection result analytics row and aggregate series | `vw_gold_quality_result_enriched`, `metric_quality_daily` | Process order, inspection lot, material, plant, characteristic, sample, spec, quantitative/qualitative result, judgement, usage decision code, valuation code, quality score | V2 no direct Quality analytics adapter | Candidate read-only source, but view columns need UAT verification. |
| `_q_inspections` | `apps/processorderhistory/backend/.../order_detail_dal.py` | `order_id` | Process-order MIC result row | `vw_gold_inspection_result`, `vw_gold_inspection_specification` | Characteristic ID, sample, specification, quantitative/qualitative result, UOM, judgement | V2 POH native swab/quality context partly separate; V2 Quality mock quality results | Candidate mapper for process-order detail evidence. |
| `_q_usage_decision` | Same | `order_id` | First usage decision linked to process order inspection lot | `vw_gold_inspection_lot`, `vw_gold_inspection_usage_decision` | Usage decision code, valuation code, quality score, created by/date | V2 Quality mock release summary / decision history | Source exists but semantic mapping to release must be governed. |
| `POST /quality` | `apps/trace2/backend/trace2_backend/quality_record/router.py` | material ID, batch ID | Batch quality lots/results/summary | `gold_batch_quality_lot_v`, `gold_batch_quality_result_v`, `gold_batch_quality_summary_v` | Inspection lot, MIC, result values, tolerances, valuation, sample/method, summary counts | Trace2 quality source plan; V2 Quality mock panels | Good candidate source for batch read-only evidence. |
| `POST /coa` | Same | material ID, batch ID | CoA result row | `gold_batch_coa_results_v` plus batch header | MIC code/name, target, tolerance, actual, result status, within spec, deviation | V2 CoA readiness mock panel | CoA-like results exist; document generation/status/sign-off not proven. |
| `POST /production-history` | Same | material ID, batch ID | Batch production row for material | `gold_batch_production_history_v` | Process order, batch, plant, posting date, qty, UOM, quality_status | Trace/POH adjacent | `quality_status` semantics need validation before release use. |
| `POST /batch-compare` | Same | material ID, batch ID | Batch compare row | `gold_batch_production_history_v`, `gold_batch_quality_summary_v` | Quality status and summary counts | Trace/Quality adjacent | Analytics only; not approval status. |
| ConnectedQuality alarms | `apps/connectedquality/backend/connectedquality_backend/routers/alarms.py` | optional status/source/material | Advisory alarm | SPC scorecard, EnvMon plant KPIs | Source, severity, context | V2 has separate panels and mock blockers | Advisory only; no release decision semantics. |

## SAP QM Concept Mapping

| SAP/QM Concept | V1 Source | V1 Field / View | V2 Equivalent | Confidence | Gap / Risk |
|---|---|---|---|---|---|
| Inspection lot | ConnectedQuality, POH, Trace2 | `INSPECTION_LOT_ID`, `gold_batch_quality_lot_v`, `vw_gold_inspection_lot` | Quality Results panel has `inspectionLotId`; ConnectedQuality Lab contract has `lot` | High | V2 release panels remain mock; native Quality mapper missing. |
| MIC / characteristic | ConnectedQuality, POH, Trace2 | `INSPECTION_CHARACTERISTIC_ID`, `MIC_ID`, `MIC_CODE`, `MIC_NAME` | Quality Results mock MIC failures; ConnectedQuality `char`/`text` | High | Naming differs by view; mapper must preserve source identifiers. |
| Quantitative / qualitative result | ConnectedQuality, POH, Trace2 | `QUANTITATIVE_RESULT`, `QUALITATIVE_RESULT`, `actual_result` | Quality Results mock; Lab Board `res` | High | Numeric precision and null semantics need source-contract tests. |
| Specification / limits | POH and Trace2 | `TOLERANCE`, `TARGET_VALUE`, `UPPER_TOLERANCE`, `LOWER_TOLERANCE`; ConnectedQuality currently sets `lower_limit`/`upper_limit` to null | Quality Results / CoA mock fields | Medium | ConnectedQuality Lab Board currently cannot prove lower/upper spec from DAL because it returns null limits. |
| Result valuation | ConnectedQuality, POH, Trace2 | `INSPECTION_RESULT_VALUATION`, `valuation`, `result_status` | Quality status / failures mock | Medium | V1 commonly treats values starting with `A` as accepted and others as rejected; this is not a governed release mapping. |
| Usage decision | POH and Trace2 lot views | `USAGE_DECISION_CODE`, `USAGE_DECISION_LONG_TEXT`, `VALUATION_CODE`, `USAGE_DECISION_CREATED_*` | Release Summary / Decision History mock | Medium | Source exists, but accepted/rejected/conditional/released semantics are not proven enough for release actions. |
| Batch quality summary | Trace2 | `gold_batch_quality_summary_v` counts | Release summary mock | Medium | Counts are analytical; not a release authorization. |
| CoA result evidence | Trace2 | `gold_batch_coa_results_v` | CoA Readiness mock | Medium | Data-backed result rows exist; CoA document/status/sign-off/versioning not proven. |
| Quality notification / deviation | Static prototype only; no live QMEL source found | Mock `DEVIATIONS` array in static quality-suite | Deviations mock | Low / Missing | No live deviation/notification source found in this discovery. |
| Batch hold / stock status | Trace2 status domain derives from stock quantities and failed results | `batch_status_from_quality_stock`; stock views | Release hold / blockers mock | Low | Derived status is not SAP QM release approval. |
| Audit / e-signature | Not found | n/a | Simulation-only actions | Missing | Must remain blocked. |

## Usage Decision And Release-Status Assessment

V1 had **read-only usage-decision evidence**, but did not prove a production-suitable release workflow.

Findings:

- POH order detail reads `vw_gold_inspection_usage_decision` joined through `vw_gold_inspection_lot` and exposes `USAGE_DECISION_CODE`, `VALUATION_CODE`, `QUALITY_SCORE`, creator, and created date.
- Trace2 quality lot query exposes `USAGE_DECISION_LONG_TEXT` in `gold_batch_quality_lot_v`.
- Quality analytics includes `usage_decision_code`, `valuation_code`, `quality_score`, and filters by decision timestamp/date in `vw_gold_quality_result_enriched`.
- V1 code maps result judgement with broad heuristics such as `LIKE 'A%' => accepted`, else rejected. That mapping is analytics-oriented and should not be promoted to release authorization without SAP QM owner validation.
- No V1 evidence found for usage-decision write-back, release/reject posting, approval workflow, e-signature, dual authorization, or tamper-evident audit trail.
- V1 Trace2 `batch_status_from_quality_stock` derives "Blocked", "QI Hold", or "Released" from stock quantities and failed metrics; this must not be conflated with SAP QM usage decision or formal batch release.

Classification: **read-only analytical only / UAT-suitable with caveats** for display, **insufficient** for release workflow.

## MIC / Result / Specification Assessment

| V1 MIC / Result Concept | Source | V2 Quality Equivalent | Recommendation | Risk |
|---|---|---|---|---|
| MIC identifiers and names | `vw_gold_inspection_result`, `vw_gold_inspection_specification`, `gold_batch_quality_result_v` | Quality Results panel, ConnectedQuality Lab Board | Build read-only mapper first. | Multiple naming conventions (`MIC_ID`, `MIC_CODE`, `INSPECTION_CHARACTERISTIC_ID`). |
| Numeric and qualitative results | Same | Quality Results panel | Preserve source nulls and numeric values. | Do not coerce missing values to pass/fail. |
| Specification text/limits | POH/Trace2 result views; ConnectedQuality returns null lower/upper limits | CoA Readiness / Quality Results | Use only when source fields are present. | Spec limits are not SPC control limits. |
| Pass/fail per MIC | Result valuation and judgement heuristics | Mock MIC status today | Display source valuation first; only derive user labels with documented mapping. | `A`/`R`/`W` mapping needs governance. |
| Trend/history by MIC | POH Quality Analytics and SPC | Future read-only analytics | Keep advisory, separate from release decision. | Trend buckets exclude rows without decision timestamp. |
| Analyst/lab approval | POH detail has usage-decision created by; no lab approval workflow found | Mock decision history | Treat as source metadata, not approval workflow. | No e-signature/audit evidence. |

## CoA Assessment

V1 has **CoA-like batch result evidence**, not a proven controlled CoA document workflow.

Evidence:

- Trace2 `POST /coa` calls shared DAL `fetch_coa()`.
- DAL reads `gold_batch_coa_results_v` with `mic_code`, `mic_name`, `target_value`, `tolerance_range`, `actual_result`, `result_status`, `within_spec`, and `deviation_from_target`.
- No V1 file evidence found for PDF generation/download, certificate numbers, document versioning, approval status, customer-specific CoA workflow, or signed CoA release.

Classification: **live data-backed / derived-report-only** for result evidence; **not proven** for document-backed CoA workflow.

## Deviation / Nonconformance / Notification Assessment

V1 live deviation support was **not proven**.

- Static `quality-suite/index.html` includes mock `DEVIATIONS` with severity, status, root cause, and assignee.
- POH mock data contains QA hold / deviation-style text.
- No live QMEL or quality-notification DAL/query route was found in the inspected Quality/POH/Trace2 paths.
- ConnectedQuality alarms can surface SPC/EnvMon advisory signals but not governed nonconformance workflow.

Classification: **mock/simulated or unknown**. Missing deviation rows in current V2 must not be interpreted as no deviations.

## Environmental Monitoring And SPC Link Assessment

| Link | V1 Evidence | Interpretation For V2 |
|---|---|---|
| EnvMon | `apps/envmon/**` has inspection-analysis, lots, trends, heatmaps, spatial configuration. ConnectedQuality alarms fetch EnvMon KPIs. | Advisory plant/environmental signal; not batch release approval. |
| SPC | `apps/spc/**`; ConnectedQuality alarms fetch SPC scorecard for material. | Advisory process-control signal; not SAP QM usage decision. |
| POH | POH quality analytics and order detail show process-order inspection results and UD. | Strong source for order-level read-only evidence. |
| Trace2 | Trace2 quality record exposes batch lots/results/CoA-like rows. | Strong source for batch-level read-only evidence. |

## V1 To V2 Contract / Panel Mapping

| V2 Quality Concept / Field | V1 Source | V1 Column / Expression | Transform Needed | Confidence | Gap / Risk |
|---|---|---|---|---|---|
| Release queue | Static quality-suite `IQ_ROWS`; V2 mock release queue | Mock fields only | Rebuild from verified SAP QM/stock/UD sources later | Missing | No live release queue source found. |
| Batch release context | Trace2 batch header + quality lots/results; V2 mock context | material, batch, plant, status-like fields | V2 mapper wrapper | Medium | Release status cannot be derived blindly. |
| Quality results | Trace2 `gold_batch_quality_result_v`; POH `vw_gold_inspection_result`; CQ lab fail rows | MIC/result/tolerance/valuation fields | V2 mapper wrapper | High | First candidate implementation slice. |
| Inspection lot evidence | Trace2 `gold_batch_quality_lot_v`; POH `vw_gold_inspection_lot` | lot ID, type/text, dates, origin, UD text | V2 mapper wrapper | High | Need plant/material/batch candidates. |
| Usage decision | POH `vw_gold_inspection_usage_decision`; Trace2 lot `USAGE_DECISION_LONG_TEXT` | code/text/valuation/created by/date | V2 mapper wrapper after validation | Medium | Do not map missing UD to accepted/released. |
| CoA readiness | Trace2 `gold_batch_coa_results_v` | result rows only | Rebuild CoA readiness semantics; display evidence first | Medium | Document status/sign-off missing. |
| Deviations | Static prototype only | mock deviation fields | Rebuild after source discovery | Missing | No live QMEL/NC source found. |
| Decision history | POH usage-decision timestamps only | UD creator/date | Rebuild controlled workflow later | Low | Not an audit trail. |
| Release actions | None live | n/a | Blocked | Missing | Requires SAP write-back, governance, e-signature. |
| Connected Quality Lab Board | V1 CQ `/lab/fails` | FailSpec fields | Already wrapped in V2 legacy adapter | High for V1 preservation | Not native Databricks; browser verification pending. |

## Reuse / Wrap / Rebuild Recommendation

| Quality Model Area | Reuse V1 Directly | V2 Mapper Wrapper | V2 Gold/Semantic View | Rebuild/Refactor | Recommendation | Rationale |
|---|---:|---:|---:|---:|---|---|
| Inspection lots | No | Yes | Later | No | Wrap first | Source exists and maps cleanly enough for read-only display. |
| MIC results | No | Yes | Later | No | Wrap first | Strongest V1 evidence; preserve IDs and nulls. |
| Specifications | No | Yes | Later | No | Wrap carefully | Different views expose text/target/tolerance inconsistently. |
| Usage decision | No | Yes | Yes | No | Verify then wrap | Evidence exists, but release semantics need governance. |
| Release status | No | No | Yes | Yes | Rebuild later | V1 does not prove formal release status. |
| CoA evidence | No | Yes | Yes | Maybe | Display result evidence first | CoA document/sign-off workflow not proven. |
| Deviations / notifications | No | No | Yes | Yes | Source discovery required | Live source not found. |
| Batch holds / stock status | No | Yes | Yes | Maybe | Advisory only | Stock-derived status is not SAP QM release. |
| Environmental monitoring links | No | Yes | No | No | Advisory link | Keep separate from release decision. |
| SPC links | No | Yes | No | No | Advisory link | Process-control signal, not release authorization. |
| Audit/e-signature | No | No | No | Yes | Blocked | No V1 evidence; regulated design required. |

## UAT Candidate Requirements

No verified live Quality UAT candidate has been identified from V1 discovery. Future candidates must include:

- `plantId`
- `materialId`
- `batchId`
- `inspectionLotId`
- `processOrderId`, if relevant
- usage-decision code/text if known
- MIC/result count if known
- CoA result count/status if known
- deviation/notification count if source exists
- source views and query evidence
- validation status and captured-by/captured-at metadata

## Open Questions

1. Which Unity Catalog views are authoritative for batch release: `gold_batch_quality_*`, `vw_gold_inspection_*`, or a newer governed QM semantic model?
2. What are the governed mappings for `INSPECTION_RESULT_VALUATION`, `USAGE_DECISION_CODE`, and `VALUATION_CODE`?
3. Is `gold_batch_coa_results_v` a CoA document source, a result aggregation, or both?
4. Which source owns deviations/nonconformance/quality notifications, if any?
5. Which field, if any, represents formal batch release status versus stock status versus lab approval?
6. Which live plant/material/batch/inspection lot should serve as the first Quality UAT candidate?

## Backlog Items

| Priority | Item | Notes |
|---|---|---|
| P0 | Verify authoritative inspection lot/MIC source and columns | Required before native read-only Quality implementation. |
| P0 | Verify usage-decision source and mapping | Do not infer accepted/released. |
| P0 | Identify golden Quality candidate | No fake candidate. |
| P1 | Build read-only inspection lot + MIC evidence panel | First safe implementation slice. |
| P1 | Add source-backed usage decision display | Only after mapping validation. |
| P1 | Add no-record/unavailable semantics and Copy UAT Evidence | Prevent false "all clear" interpretations. |
| P2 | Add CoA result evidence | Keep separate from CoA document/sign-off readiness. |
| P2 | Discover deviations / QM notifications source | Do not treat missing source as no deviations. |
| P3 | Add advisory SPC/EnvMon/Trace/POH links | Keep advisory labels explicit. |
| Future | Release/reject actions, write-back, e-signature, GxP audit trail | Blocked pending governance and SAP write-back design. |
