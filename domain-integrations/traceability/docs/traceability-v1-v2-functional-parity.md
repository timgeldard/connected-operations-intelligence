# Traceability V1 → V2 Functional Parity Matrix

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Source:** `docs/migration/trace2-functional-parity-audit.md` (V1 inspection) + V2 codebase review
**Branch:** `feature/traceability-functional-parity-plan`

---

## Status key

| Status | Meaning |
|--------|---------|
| `parity-achieved` | V2 matches V1 behaviour from a verified data source |
| `partial-parity` | V2 has the feature but is missing fields, depth, or a live source |
| `mock-only` | V2 has schema + UI but no live Databricks wiring |
| `v2-improved` | V2 behaviour is materially better than V1 (not a gap) |
| `v2-missing` | V1 has this; V2 has neither schema nor UI |
| `source-blocked` | Cannot implement without verified Databricks column names |
| `deferred` | Deliberately out of scope for current tranche |
| `unknown` | Not enough V1 evidence to assess |

## Priority key

| Priority | Meaning |
|----------|---------|
| `P0` | Required for credible trace/recall UAT |
| `P1` | Required for near-functional parity |
| `P2` | Useful enhancement |
| `P3` | Later polish / nice-to-have |

---

## Parity Matrix

| # | Capability | V1 behaviour | V1 files / source | V2 current state | Gap | Status | Priority | Build recommendation |
|---|-----------|-------------|------------------|-----------------|-----|--------|----------|---------------------|
| 1 | **Batch search / entry** | Material ID + Batch ID picker on every page; URL-based navigation | `trace2/pages/`, batch picker component at page top | `TraceQueryForm` with Material/Batch/Plant/Direction/Depth/Edges fields; investigation-first model but batch-first form wired | `investigationId` is always an empty string from the form; batch/material not propagated into all downstream hooks consistently | `partial-parity` | P1 | Harden `investigationId` generation from material+batch+plant; ensure all hooks receive populated request |
| 2 | **Batch header — core identity** | Material ID, batch ID, plant name, manufacture date, expiry date, process order | `gold_batch_summary_v`, `gold_batch_stock_v`, `gold_plant` | `BatchHeaderPanel` shows all these fields; Databricks-api mode live and browser-verified | Process order ID sourced from `gold_batch_stock_v` but `PROCESS_ORDER_ID` not present in `gold_batch_summary_v`; must come from lineage | `parity-achieved` | — | No action needed |
| 3 | **Batch header — stock bucket breakdown** | Separate KPIs for UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT quantities per batch | `gold_batch_stock_v` (all 6 columns) | All 6 stock bucket fields implemented in schema, Python mapper, and panel (PR#50); QI Hold and Blocked highlighted amber/sunset when non-zero; live column values confirmed 2026-05-19 | None — live UAT browser validation still pending | `parity-achieved` | — | Validate bucket values in live UAT against V1 batch header |
| 4 | **Batch header — stock / quality / release status** | Node colour derived from: Blocked = BLOCKED>0 or rejected>0; QI Hold = QI>0 or failed MIC>0; Released = accepted>0 or UNRESTRICTED>0 | `gold_batch_stock_v`, `gold_batch_quality_summary_v` | `stockStatus`, `qualityStatus`, `releaseStatus` enums returned; quality uses conservative derivation (pending / unknown only); accepted/rejected not returned without verified QM source | `qualityStatus: accepted/rejected/conditional` require `gold_qm_usage_decision_v` or equivalent — deliberately blocked | `partial-parity` | P0 | Wire quality usage decision when `gold_qm_usage_decision_v` columns are verified — see `quality-decision-source-plan.md` |
| 5 | **Top-down / downstream lineage** | `POST /api/top-down` — downstream recursive CTE walk; leaf nodes include customer/delivery entries | `gold_batch_lineage`, `gold_material`, `gold_plant`, `gold_batch_delivery_v` | `getTraceGraph` with `direction=downstream` — Databricks-api backend implemented and returning live data | No visual distinction between customer/delivery leaf nodes and internal batch nodes; `gold_batch_delivery_v` not joined in graph query | `partial-parity` | P1 | Add node-type inference: DELIVERY link type → `customer-delivery` node type; customer/delivery node rendering |
| 6 | **Bottom-up / upstream lineage** | `POST /api/bottom-up` — upstream recursive CTE walk; VENDOR_RECEIPT edges identify supplier origins | `gold_batch_lineage`, `gold_material`, `gold_plant`, `gold_supplier` | `getTraceGraph` with `direction=upstream` — backend live | No visual distinction for supplier/vendor-receipt nodes; `gold_supplier` not joined for supplier names | `partial-parity` | P1 | Add supplier name look-up via gold_supplier JOIN when VENDOR_RECEIPT edge; map to `supplier-lot` node type |
| 7 | **Combined upstream + downstream trace** | Separate upstream and downstream calls combined in UI | Independent `/api/top-down` + `/api/bottom-up` | `direction=both` splits into parallel `asyncio.gather()` upstream + downstream queries; results merged into single graph | Direction filter on nodes/edges not exposed in UI | `partial-parity` | P2 | Add direction badge/filter to graph panel; colour-code nodes by direction |
| 8 | **Graph layout and interaction** | Tree (indented nested list); colour-coded nodes (green/red/amber/gray); click navigates to batch's pages | React tree renderer in `trace2/components/TraceTree` | Force-directed SVG graph with node colours by relationship type; no click-to-navigate; no edge click handler | No drill-through on graph nodes; no edge detail panel; no separate upstream/downstream depth sliders | `partial-parity` | P2 | Add click handler to navigate to batch; add edge detail tooltip; add separate upstream/downstream depth controls |
| 9 | **Edge relationship semantics** | `LINK_TYPE` values: `PRODUCTION`, `BATCH_TRANSFER`, `STO_TRANSFER`, `VENDOR_RECEIPT` (V1 gold_batch_lineage also has `CONSUMPTION`, `DELIVERY`, `SPLIT`, `MERGE`) | `gold_batch_lineage.LINK_TYPE` | `linkType` passthrough added (PR #26); `relationshipType` enum expanded with `vendor-receipt`, `consumed-by` | Live LINK_TYPE value mapping not yet validated; V1 app layer normalises to: RECEIPT, INTERNAL, CONSUMPTION, SALES_ORDER — V2 passes raw values | `partial-parity` | P0 | Validate live LINK_TYPE values against gold_batch_lineage (see TRACE-P0-002); add legend to graph panel |
| 10 | **Process order / production history** | `/api/production-history` — recent 24 batches for material; per-batch: process order, quantity, quality status, yield% | `gold_batch_production_history_v` | `processOrderId` in BatchHeaderSummary; no production history panel | Production history panel (`gold_batch_production_history_v`) entirely missing | `partial-parity` | P1 | Build `ProductionHistoryPanel` using `gold_batch_production_history_v` when columns are verified |
| 11 | **Goods movement / event timeline** | `/api/mass-balance` returns per-POSTING_DATE movement detail (MOVEMENT_TYPE, MOVEMENT_CATEGORY, ABS_QUANTITY) | `gold_batch_mass_balance_v` | `getEventTimeline` returns mock events; mass balance adapter + mapper implemented (WHERE filter column names unverified) | No live movement timeline; mass balance route not yet wired | `mock-only` | P1 | Verify WHERE filter column names in `gold_batch_mass_balance_v`; wire FastAPI mass balance route; add per-day timeline to MassBalancePanel |
| 12 | **Stock position breakdown** | UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT, TOTAL_STOCK per batch header | `gold_batch_stock_v` | All stock bucket fields now surfaced — see row 3 | None | `parity-achieved` | — | See row 3 |
| 13 | **Mass balance summary** | Per-day delta + running cumulative balance; chart with daily bars | `gold_batch_mass_balance_v` | `MassBalancePanel` shows input/output/variance totals only; adapter+mapper implemented but not wired | No daily breakdown, no cumulative chart, no live FastAPI route | `partial-parity` | P1 | Wire mass balance FastAPI route after WHERE column verification; add daily chart |
| 14 | **Customer exposure — summary** | Countries, customers, delivery count, shipped quantity, risk tier per batch | `gold_batch_delivery_v` | `CustomerExposureSummary` schema complete with `maxExposureDepth`; depth-aware severity logic in `InvestigationSummary`; `CustomerImpactPanel` shows counts; lineage-only first Databricks slice implemented 2026-05-20 (counts + depth from gold_batch_lineage DELIVERY edges) | Countries, blockedDeliveries, customer names not yet available (require gold_batch_delivery_v verification); LINK_TYPE='DELIVERY' edge population needs UAT validation; highestSeverity is preliminary 'medium' | `partial-parity` | P0 | UAT-validate DELIVERY edge population; then add gold_batch_delivery_v join for countries/blocked status; see customer-exposure-source-mapping.md |
| 15 | **Customer exposure — delivery table** | Per-delivery table: delivery ID, customer name, country, city, quantity, estimated status | `gold_batch_delivery_v` | `CustomerImpactPanel` shows aggregated counts only; no per-delivery table | Per-delivery table not implemented | `partial-parity` | P1 | Add delivery rows table to `CustomerImpactPanel` once live slice is wired |
| 16 | **Supplier exposure** | Per-supplier table: supplier ID, name, country, received qty, batch count, failure rate; upstream walk to depth 4 | `gold_supplier`, `gold_batch_quality_summary_v`, `gold_batch_lineage` | `MaterialSupplierExposurePanel` + schema + mock data | No live slice; `gold_supplier` view not yet in catalog resolver | `mock-only` | P1 | Add `gold_supplier` to catalog resolver; build QuerySpec for upstream VENDOR_RECEIPT aggregation |
| 17 | **Quality — usage decision** | Inspection lots table (lot ID, type, created date, usage decision); usage decision is source of accepted/rejected | `gold_batch_quality_lot_v`, `gold_qm_usage_decision_v` (implied) | `qualityStatus` returns `pending` or `unknown` only; `accepted`/`rejected` blocked pending verified QM source | Verified QM usage-decision source not yet identified | `source-blocked` | P0 | Identify and verify `gold_qm_usage_decision_v` columns; see `quality-decision-source-plan.md` |
| 18 | **Quality — MIC results** | MIC results table: MIC code, name, target, tolerance, actual result, valuation (A/R) | `gold_batch_quality_result_v` | `CoAReleaseStatusPanel` shows release status only; no MIC table | MIC results panel entirely missing | `v2-missing` | P2 | Build `QualityMICPanel` using `gold_batch_quality_result_v` when columns are verified |
| 19 | **Certificate of Analysis** | CoA page: batch header + MIC results table from `gold_batch_coa_results_v` | `gold_batch_coa_results_v` | `CoAReleaseStatusPanel` shows release status and CoA fields (mock) | No MIC-level results; `gold_batch_coa_results_v` not in catalog resolver | `partial-parity` | P2 | Add `gold_batch_coa_results_v` to catalog resolver; extend `CoAReleaseStatusPanel` with MIC table |
| 20 | **Risk signals / recall readiness** | Recall Readiness page: full blast radius — countries, customers, deliveries, exposure table, event timeline | All gold views | `RiskSignalsPanel` + `TraceExposureForReleasePanel` exist (mock); `InvestigationSummary` shows severity (code-ready) | No live risk signal population; severity tiering not yet driven by live depth | `mock-only` | P0 | Requires customer exposure live slice (row 14) as prerequisite; then wire `getRiskSignals` |
| 21 | **Related batches / investigations** | Related batches identified via production history context | `gold_batch_production_history_v` | `RelatedInvestigationsPanel` exists (mock) | No live wiring | `mock-only` | P2 | Wire after production history panel is implemented |
| 22 | **Export / evidence copy** | "Export dossier" on Recall Readiness (mock in V1) | N/A | `TraceQueryForm` "Copy payload" button (request JSON); `getTraceExposureForRelease` schema exists (mock) | No structured evidence export; copy payload is request, not evidence | `partial-parity` | P3 | Add evidence summary copy payload once live data is available |
| 23 | **Error handling / partial data / unknown states** | Basic error handling; no structured unknown-state UX | N/A | `AdapterResult<T>` pattern; `BatchHeaderErrorBanner`; truncation banner; UNKNOWN severity path; `EvidenceConfidenceBadge`; source truthfulness warnings throughout | V2 significantly more structured than V1 | `v2-improved` | — | Preserve and extend as each new slice is wired |
| 24 | **Graph truncation warning** | No truncation signal | N/A | Amber truncation banner when `truncated=true`, `max_depth_reached`, or `max_edges_reached` (code fixed PR, live validation pending) | Live validation pending — need a batch that actually hits depth/edge limit | `partial-parity` | P1 | UAT confirmation required (see TRACE-P1-001) |
| 25 | **Data freshness / staleness** | `freshness` field on every API response (query execution timestamp from source) | All V1 endpoints | Phase 1 disclaimer in `BatchHeaderPanel`: "Data freshness not available"; `data-freshness-plan.md` documents Approach A (`_updated_at` column) | No live freshness metadata; approach documented but not implemented | `partial-parity` | P2 | Implement `_updated_at`-based freshness when column is verified; see `data-freshness-plan.md` |
| 26 | **Batch comparison** | Recent 24 batches for material; quality rollup across batches; yield% | `gold_batch_production_history_v`, `gold_batch_quality_summary_v` | No equivalent | Batch comparison panel entirely missing | `v2-missing` | P3 | Deferred — requires production history panel first |
| 27 | **Supplier risk detail** | Failure rate, failed MIC count per supplier in ancestor chain | `gold_batch_quality_summary_v` | Supplier exposure panel shows summary (mock); no failure rate | Quality aggregate per supplier not wired | `mock-only` | P1 | Add quality summary join when wiring supplier exposure slice |

---

## V2 Improvements Over V1

These V2 capabilities are ahead of V1 and should be preserved:

| V2 capability | Why it's better |
|--------------|----------------|
| Structured `AdapterResult<T>` error handling | V1 silently returned null on failure; V2 distinguishes not-found / unauthorized / timeout |
| UNKNOWN severity for null customer exposure | V1 could imply containment when delivery API was down |
| Depth-aware severity tiering (`maxExposureDepth`) | V1 used binary shipped/not-shipped only |
| `BatchHeaderErrorBanner` with per-error-code guidance | V1 had no batch-not-found UX |
| Truncation warning banner on trace graph | V1 had no truncation signal |
| Evidence confidence scoring (`EvidenceConfidenceBadge`) | V1 had no confidence grading |
| Source badge (`X-Data-Source` header) and adapter mode transparency | V1 had no mode signalling |
| Workspace-first model with `EvidencePanel` lifecycle | V1 had no workspace/investigation abstraction |
| Zod + Pydantic contract validation | V1 had no structured schema validation |

---

## P0 Gaps — Required for Credible Trace/Recall UAT

| # | Gap | Why it matters for recall/trace | Blocked by |
|---|-----|-------------------------------|-----------|
| P0-1 | Customer exposure Databricks slice | Cannot determine downstream blast radius without live delivery data; UNKNOWN severity is shown but uninformative | `gold_batch_delivery_v` column name verification |
| P0-2 | Quality usage decision source | `qualityStatus: accepted/rejected` must not be claimed without QM evidence — currently `pending`/`unknown` only | `gold_qm_usage_decision_v` (or equivalent) column verification |
| P0-3 | Edge LINK_TYPE live validation | Cannot distinguish vendor receipt from internal batch moves in supplier exposure analysis without verified live LINK_TYPE values | Live Databricks query against `gold_batch_lineage` |
| P0-4 | Risk signals / recall readiness live population | Severity tiering code-ready but uninformative until live customer exposure populates `maxExposureDepth` | Requires P0-1 first |

---

## P1 Gaps — Required for Near-Functional Parity

| # | Gap | Why it matters | Estimated effort |
|---|-----|---------------|-----------------|
| P1-1 | Stock bucket breakdown | V1 showed separate KPIs for each stock type; critical for understanding if batch is in QI hold vs blocked vs unrestricted | Low — columns verified, SQL already fetches them |
| P1-2 | Mass balance live route | Adapter+mapper done; WHERE filter column names unverified; no FastAPI route | Medium — column verification + route wiring |
| P1-3 | Supplier exposure live slice | Per-supplier failure rate table missing; `gold_supplier` not in catalog resolver | Medium — new catalog resolver entry + QuerySpec |
| P1-4 | Production history panel | Recent 24 batches for material; used for production trend context | Medium — `gold_batch_production_history_v` not yet in catalog resolver |
| P1-5 | Per-delivery table | Aggregated delivery counts shown; per-delivery breakdown not implemented | Low — extension of customer exposure panel once live slice is wired |
| P1-6 | Graph node type inference | Customer/delivery leaf nodes indistinguishable from internal batch nodes | Medium — requires DELIVERY link type detection + new node renderer |
| P1-7 | Supplier name on graph nodes | VENDOR_RECEIPT edges have no supplier name; `gold_supplier` not joined | Medium — requires `gold_supplier` catalog entry + JOIN |
| P1-8 | Graph truncation UAT validation | Code complete; live validation against a depth-limited real batch required | Low — UAT execution only |

---

## Near-100% Parity Roadmap

```
NOW (safe, verified columns):
  → Tranche 1 (this PR): Stock bucket breakdown [P1-1]

NEXT (after WHERE column verification):
  → Tranche 2: Mass balance live route [P1-2]
  → Tranche 3: Customer exposure Databricks slice [P0-1]

AFTER CUSTOMER EXPOSURE:
  → Tranche 4: Risk signals live population [P0-4]
  → Tranche 5: Supplier exposure live slice [P1-3] + graph node types [P1-6]

LATER:
  → Quality usage decision [P0-2] (source verification required)
  → Production history panel [P1-4]
  → CoA MIC results [P2]
  → Batch comparison [P3]
```
