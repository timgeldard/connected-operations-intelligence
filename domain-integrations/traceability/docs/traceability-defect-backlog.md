# Traceability Defect Backlog

**Domain:** `domain-integrations/traceability`
**Last updated:** 2026-05-20
**Classification:** P0 = could mislead recall/exposure decisions · P1 = blocks credible UAT · P2 = improves trust/usability · P3 = future enhancement

---

## P0 — Could Mislead Recall or Exposure Decisions

### TRACE-P0-001 — Null customerExposure silently shows Low Risk severity

**Status:** Fixed (PR #24, commits 74f4b5c + 1612703)
**Affected:** `InvestigationSummary.tsx`, overview view
**Evidence:** When the delivery data source fails or is unavailable, `customerExposure === null` fell through to the LOW severity branch, displaying "Low Risk" and implying the batch was contained. An investigator could conclude no recall action was needed when exposure was simply unknown.
**Risk:** False containment signal during an active recall investigation.
**Fix applied:** `customerExposure === null` now branches to `UNKNOWN` severity with explicit "do not assume containment" guidance. Metric cells show "data unavailable" rather than "0".
**Requires UAT:** Yes — confirm UNKNOWN banner renders correctly in deployed app when delivery API is down.

### TRACE-P0-002 — No link-type discrimination on trace graph edges

**Status:** Code fixed by PR #26 (linkType passthrough added to `TraceEdgeSchema`, expanded `relationshipType` enum with `vendor-receipt` and `consumed-by`, VENDOR_RECEIPT/CONSUMPTION discrimination added in graph mapper). Live Databricks `LINK_TYPE` value validation required before UAT sign-off.
**Affected:** `trace-graph-panel.tsx`, `trace2-graph-mapper.ts`, `TraceGraphEdge` schema
**Evidence:** `TraceGraphEdge` had no `linkType` field. The reference SQL engine distinguishes PRODUCTION / BATCH_TRANSFER / STO_TRANSFER / VENDOR_RECEIPT — without this, V2 could not separate internal batch moves from vendor receipts, making supplier exposure analysis unreliable.
**Risk:** An investigator may not identify the vendor receipt path responsible for introducing a non-conforming input batch.
**Fix applied:** `linkType: z.string().optional()` passthrough added to `TraceEdgeSchema`; `relationshipType` enum expanded; graph mapper updated to emit `vendor-receipt` and `consumed-by`. Mock fixture exercises both new types.
**Requires UAT:** Yes — live Databricks `LINK_TYPE` column values must be verified against mock fixture assumptions before UAT sign-off.

### TRACE-P0-003 — Severity tiering is binary, not depth-based

**Status:** Partially addressed (2026-05-20) — lineage-only first slice populates `maxExposureDepth` from gold_batch_lineage; DELIVERY-edge population and LINK_TYPE='DELIVERY' live value require UAT validation before depth-aware severity is trustworthy
**Affected:** `InvestigationSummary.tsx` severity logic, `CustomerExposureSummarySchema`
**Evidence:** V2 assigns CRITICAL based on `shippedQuantity > 0` only. The reference engine (`fetch_recall_readiness()`) uses depth: depth=1 → CRITICAL, depth=2+ with shipments → HIGH, depth=2 no shipments → MEDIUM. A multi-hop indirect exposure at depth 2 with no direct shipments gets LOW in V2 but HIGH in the reference engine.
**Risk:** Under-escalation of multi-hop indirect exposure scenarios.
**Fix applied:** `maxExposureDepth?: number` added to `CustomerExposureSummarySchema`. `InvestigationSummary.tsx` severity logic updated: depth=1+shipped→CRITICAL, depth≥2+shipped→HIGH, depth≥2 no-ship→MEDIUM, depth undefined→CRITICAL (conservative fallback). Lineage-only first slice implemented 2026-05-20: `get_customer_exposure_spec` populates `maxExposureDepth` as minimum hop_depth across DELIVERY-type edges. `highestSeverity` is preliminary 'medium' pending business rule definition.
**Requires UAT:** Yes — confirm LINK_TYPE='DELIVERY' edges exist with CUSTOMER_ID populated for a known shipped batch; confirm maxExposureDepth values are plausible.

---

## P1 — Blocks Credible UAT Use

### TRACE-P1-004 — Individual stock bucket quantities not surfaced in batch header

**Status:** Fixed (2026-05-20, `feature/traceability-functional-parity-plan`)
**Affected:** `BatchHeaderSummarySchema`, `map_batch_header_rows`, `BatchHeaderPanel`
**Evidence:** V1 showed UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT as separate KPIs on the batch header. V2 fetched all 6 columns from `gold_batch_stock_v` (confirmed live 2026-05-19) but surfaced only `total_stock` as the single `quantity` field. An investigator could not determine whether stock was blocked, in QI hold, or unrestricted without drill-through.
**Risk:** Investigator cannot assess the significance of a non-zero stock figure (blocked vs. unrestricted are materially different recall signals).
**Fix applied:** Added `unrestricted`, `blocked`, `qualityInspection`, `restricted`, `transit` as optional number fields to `BatchHeaderSummarySchema`. Python mapper now surfaces all 5 fields (null row value → field absent, not zero). `BatchHeaderPanel` shows a stock bucket row beneath the quantity row; QI Hold and Blocked fields are highlighted amber/sunset when non-zero.
**Requires UAT:** Yes — confirm bucket values are populated from live `gold_batch_stock_v` and match values shown in V1 batch header.

### TRACE-P1-008 — Batch header multi-plant ambiguity when plant_id absent

**Status:** Fixed (2026-05-20, `feature/traceability-functional-parity-plan`)
**Affected:** `Trace2BatchHeaderRequest`, `get_batch_header_summary_spec`, `BatchRequest`, `trace2-legacy-api-adapter.ts`
**Evidence:** `gold_batch_stock_v` returns one row per plant for a given material/batch combination. Without plant filtering, the mapper silently returned data for whichever plant sorts first alphabetically by PLANT_ID. UAT inputs include `plantId`, making the ambiguity avoidable.
**Fix applied:** `plant_id` added to `Trace2BatchHeaderRequest` (default `""`), to the SQL WHERE clause as `AND (:plant_id = '' OR s.PLANT_ID = :plant_id)`, to `BatchRequest` in the FastAPI route, and to the frontend POST body in `trace2-legacy-api-adapter.ts`. When plant is absent behaviour is unchanged (all plants returned, mapper takes first).
**Requires UAT:** Yes — confirm single-plant result when `plant_id = C061` is passed for the reference candidate.

### TRACE-P1-010 — Mass balance MOVEMENT_CATEGORY mapping incomplete; live SAP categories fall through to "adjustment"

**Status:** Open — surfaced to investigators via `unresolvedMovements` and panel disclaimer; verified business mapping pending
**Affected:** `_MOVEMENT_CATEGORY_MAP` in `trace2_databricks_adapter.py`, `MassBalancePanel`
**Evidence:** Live frequency-ordered distinct MOVEMENT_CATEGORY values from `gold_batch_mass_balance_v` include `Other (261)` (65M rows), `STO Transfer` (15M), `STO Receipt` (12M), `Other (Z01)` (10M), `Other (Z61)` (8M), `Other (321)` (7M), `Shipment` (6M), `Write-Off` (379k) and many more. Only `Production` and `Shipment` match the current uppercase keys in `_MOVEMENT_CATEGORY_MAP`. Everything else maps to `"adjustment"` and is treated as output by the mapper. STO Receipt is an inbound movement — the current direction is wrong, but no business-verified category-to-direction map exists in V2 yet. See `mass-balance-source-mapping.md` for the full table.
**Risk:** `inputQuantity` and `outputQuantity` totals are not trustworthy for any batch with STO Receipt, Other (NNN), or Write-Off movements (which is almost every real batch). The variance figure cannot be used to assess a mass-balance result.
**Mitigation in current slice:** Unmapped rows are counted in `unresolvedMovements`, which already triggers the amber "balance may be incomplete" banner in the panel. A new dashed disclaimer below the banner reads "Movement category mapping is incomplete… Do not treat the variance figure as a verified mass-balance result."
**Proposed fix:** Obtain a verified SAP movement-type-to-direction map from the data/operations team; expand `_MOVEMENT_CATEGORY_MAP` to cover the top N categories; classify STO Receipt as input, STO Transfer as output, Write-Off as output, "Other (NNN)" by underlying type.
**Requires UAT:** Yes

### TRACE-P1-011 — Mass balance BALANCE_QTY appears not to be a per-batch running tally

**Status:** Open — passed through to `runningBalance` as observed; source semantics pending verification
**Affected:** `map_mass_balance_rows()` `runningBalance`, MassBalancePanel "Balance" column
**Evidence:** For the UAT candidate `MATERIAL_ID=20035129 / BATCH_ID=8000049668` (which has 30+ movement rows in `gold_batch_mass_balance_v`), every single observed `BALANCE_QTY` value is `0.000` across STO Receipt, STO Transfer, Production, and consumption movements. A per-batch running balance cannot be flat zero across a real production lifecycle — this column appears to be a different concept (possibly a stock snapshot, possibly a placeholder, possibly only populated for specific movement-type subsets).
**Risk:** If the panel labels the column "Running Balance" but the values are not a running tally, investigators may draw incorrect conclusions about batch state at any point in time.
**Mitigation in current slice:** `runningBalance` is passed through as-is from `balance_qty` — no inference, no calculation. The panel disclaimer warns that the variance figure is not a verified mass-balance result.
**Proposed fix:** Confirm with the data platform team what `BALANCE_QTY` represents in `gold_batch_mass_balance_v`. If it is not a per-batch running balance, either (a) compute the running balance in V2 from `delta` accumulation, or (b) remove the "Balance" column from the panel and surface only the per-movement delta until a verified source exists.
**Requires UAT:** Yes

### TRACE-P1-009 — gold_batch_delivery_v WHERE key column names unverified (DEF-TRACE-006)

**Status:** Fixed (2026-05-20) — DESCRIBE TABLE executed live against connected_plant_uat
**Affected:** `get_customer_delivery_spec()`, `POST /api/trace2/customer-deliveries`
**Evidence:** DESCRIBE TABLE confirmed all 17 columns: MATERIAL_ID, BATCH_ID, PLANT_ID, CUSTOMER_ID, CUSTOMER_NAME, STREET, CITY, POSTCODE, COUNTRY_ID, COUNTRY_NAME, DELIVERY, SALES_ORDER_ID, QUANTITY (signed), ABS_QUANTITY, UOM, POSTING_DATE, MOVEMENT_TYPE. WHERE keys MATERIAL_ID + BATCH_ID confirmed. TODO comments removed from SQL. UOM and COUNTRY_NAME added to SELECT and mapper. SQL and adapter tests updated.
**Fix applied:** `get_customer_delivery_spec()` SQL: TODO comments removed; UOM + COUNTRY_NAME added to SELECT. `map_customer_delivery_rows()`: extracts `uom` from first non-null UOM row; returns it as optional field. `customer-delivery-v1-parity-source-mapping.md` §3 updated with full 17-column set.
**Requires UAT:** Yes — CD-1 through CD-6 scenarios in DEF-TRACE-006 (uat-validation-ledger.md) remain as the live execution gate

### TRACE-P1-005 — Mass balance not wired to a live Databricks route

**Status:** Fixed (2026-05-20) — live route wired; 11 columns verified via DESCRIBE TABLE; legacy-api adapter override calls /api/trace2/mass-balance; panel surfaces movements
**Affected:** `mass-balance-view.tsx`, `get_mass_balance_spec`, `apps/api/routes/trace2.py`, `trace2-legacy-api-adapter.ts`
**Evidence:** V1 provided a full per-day movement timeline via `POST /api/mass-balance`. V2 now has live `POST /api/trace2/mass-balance` backed by `gold_batch_mass_balance_v` (11 columns verified live 2026-05-20 — see `mass-balance-source-mapping.md`). Zero rows → 404 with "do not interpret as balanced" message.
**Fix applied:** Added route, frontend adapter override, route + adapter tests (270 Python, 229 TypeScript). TODO column comments removed from SQL. `max_rows` param added to `Trace2MassBalanceRequest` (the SQL had `LIMIT :max_rows` but the dataclass and params dict lacked it — would have raised at execution).
**Remaining gaps:** Two correctness defects opened — TRACE-P1-010 (category mapping incomplete) and TRACE-P1-011 (BALANCE_QTY semantics unverified). Both are surfaced to investigators via `unresolvedMovements` count and a panel disclaimer rather than masked behind a clean aggregate.
**Requires UAT:** Yes — CD-style scenarios for mass balance (200 / 404 / 503 / unresolved-movement panel banner)

### TRACE-P1-006 — Supplier exposure panel has no live Databricks slice

**Status:** Fixed (2026-05-21) — `POST /api/trace2/supplier-exposure` wired against `gold_batch_lineage` (VENDOR_RECEIPT) ⋈ `gold_supplier`; per-supplier `suppliers[]` array added to `SupplierExposureSummary`
**Affected:** `MaterialSupplierExposurePanel`, `get_supplier_exposure_spec`, `Trace2LegacyApiAdapter`
**Evidence:** V1 `/api/supplier-risk` provided a per-supplier table (supplier ID, name, country, received quantity, batch count, quality failure rate) via upstream walk. V2 now has the equivalent for the core fields: supplier ID, name, country, received quantity, receipt count, last-receipt date, UoM. Quality failure rate is intentionally **not** populated — see TRACE-P1-012.
**Fix applied:** Schema extended with `SupplierDetailSchema` and optional `suppliers` array on `SupplierExposureSummarySchema`. Live query filters `LINK_TYPE='VENDOR_RECEIPT' AND SUPPLIER_ID IS NOT NULL AND SUPPLIER_ID <> ''` (live data includes empty-string supplier IDs for unattributed inputs — excluded). Panel renders supplier detail table. Live validated 2026-05-21: UAT candidate (20035129/8000049668) returns 1 supplier (PQ Silicas UK, GB, 201300 KG); multi-supplier test batch (20394026/0005587610) returns 4 suppliers across US/DE/AE. See `supplier-exposure-source-mapping.md`.
**Remaining gaps:** Single-hop only (multi-hop recursive supplier walk deferred). `openSupplierActions=0` and `highestRiskSupplier` absent until QM source verified (TRACE-P1-012).
**Requires UAT:** Yes

### TRACE-P1-007 — Production history panel missing

**Status:** Fixed (2026-05-21) — `POST /api/trace2/production-history` wired against `gold_batch_production_history_v`; new `ProductionHistoryPanel` shows recent 24 batches
**Affected:** Investigation cockpit, `ProductionHistoryPanel`, `get_production_history_spec`, `Trace2LegacyApiAdapter`
**Evidence:** V1 provided a production history page showing recent batches for the same material. V2 now has the equivalent at material-only filter (no plant filter — V1 parity for isolated-vs-systemic assessment), 24 most-recent by default, ordered POSTING_DATE DESC. 8 columns confirmed in `gold_batch_production_history_v`. Quality status mapped: Pass → 'pass', Fail → 'fail', anything else → 'unknown'.
**Fix applied:** New `ProductionHistoryRowSchema` + `ProductionHistorySummarySchema` in data-contracts. Live route in FastAPI. Frontend adapter override. New panel with sortable table + amber Fail counter when failCount>0 + dashed disclaimer that the Pass/Fail label is not a release decision. Live validated 2026-05-21: top material (70948010) returns 24 batches all Pass at plants P132/P648/P638; UAT candidate raw-input material (20035129) correctly returns 0 rows. See `production-history-source-mapping.md`.
**Remaining gaps:** Quality status here is gold view labelling, not SAP QM usage-decision. Full release-decision evidence requires TRACE-P1-012.
**Requires UAT:** Yes

### TRACE-P1-012 — QM usage-decision source not wired (blocks accurate supplier risk + production history release evidence)

**Status:** Closed — schema/grain/join verified 2026-05-21; code/text semantics governance (Option A: Strict Lot-Level Evidence) confirmed 2026-05-22.
**Affected:** `MaterialSupplierExposurePanel` (openSupplierActions, highestRiskSupplier), `ProductionHistoryPanel` (release-decision interpretation), `BatchHeaderPanel` (qualityStatus)
**Evidence:** Source object `gold_inspection_usage_decision` verified live 2026-05-21 via Databricks CLI (warehouse `connected_plant_uat / e76480b94bea6ed5`): 13 columns, 15,473,693 rows, grain = `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)` (0 duplicates confirmed). Historical source — USAGE_DECISION_COUNTER is STRING; blank = first decision, then '1', '2', ... Use `CAST(NULLIF(USAGE_DECISION_COUNTER,'') AS INT)` to get latest per lot, not `MAX()` on the raw string. No MATERIAL_ID/BATCH_ID/PLANT_ID in the UD table — join to batch requires two hops: UD → `gold_inspection_lot` → material/batch/plant. Join to `gold_inspection_lot` confirmed; `USAGE_DECISION_LONG_TEXT` is in `gold_inspection_lot`, not in the UD table. UAT candidate (MATERIAL_ID=20052009, BATCH_ID=0008602411, PLANT_ID=C061) matched to lot 030005059533, code=A, date=2024-08-27. 9 distinct usage-decision codes observed: A (90.3%), AE (7.5%), AC (1.2%), R (0.6%), ACE (0.2%), RE (0.2%), A9, RR, '' empty (269 rows). `gold_batch_production_history_v.quality_status` exposes 'Pass'/'Fail' labels but these are not the SAP QM release decision.
**Risk:** Investigators may infer release decisions or supplier quality risk from indirect signals (gold view labelling, inspection lots) without a verified mapping to the underlying QM evidence chain.
**Mitigation in current slices:** Supplier panel `openSupplierActions=0` and `highestRiskSupplier` absent. Production history panel includes a dashed disclaimer that the Pass/Fail label is not a release decision. Batch header `qualityStatus` is already conservative (`pending`/`unknown` only).
**Governance gate (CLOSED):** Governed code mapping obtained and confirmed (Option A). V2 will display source usage-decision code/text verbatim per lot.
**Fix applied:** Option A governance confirmed. Wiring into live backend in progress.
**Verification docs:** `qm-usage-decision-source-verification.md`, `qm-usage-decision-grain-and-joins.md`, `qm-usage-decision-code-semantics.md`, `qm-usage-decision-cross-domain-consumption-plan.md`
**Requires UAT:** Yes

### TRACE-P1-001 — Truncation state not surfaced in trace graph UI

**Status:** Code-fixed — live validation pending
**Affected:** `trace-graph-panel.tsx`, `TraceGraph.truncated` schema field
**Evidence:** `TraceGraph.truncated` exists in the Zod schema but the mock always sets it to `false` and the panel had no truncation warning banner. An investigator viewing a depth-limited graph has no signal that upstream exposure may extend beyond what is shown.
**Risk:** Investigator concludes lineage is complete when the graph was cut at max depth.
**Fix applied:** Amber truncation banner rendered in `trace-graph-panel.tsx` when `truncated === true`, `max_depth_reached` is in warnings, or `max_edges_reached` is in warnings. Copy updated: "Trace graph truncated — the displayed lineage may be incomplete because the max depth or row limit was reached. Review with a deeper trace or Databricks validation before concluding exposure is complete." Tests cover all three trigger conditions.
**Requires UAT:** Yes — confirm banner renders on a live Databricks graph that reaches depth/edge limit.

### TRACE-P1-002 — No README or entry-point documentation for the domain

**Status:** Fixed (PR #25 — `README.md` added to `domain-integrations/traceability/`)
**Affected:** `domain-integrations/traceability/`
**Evidence:** No `README.md` existed. A developer onboarding to this domain had no documented entry point, no explanation of the adapter pattern, and no pointers to the UAT docs.
**Risk:** Slows contributor onboarding; increases chance of bypassing the adapter contract.
**Fix applied:** README added covering purpose, architecture (adapter → queries → panels), mock vs. live mode, test commands, and docs index.
**Requires UAT:** No

### TRACE-P1-003 — Invalid batch input has no documented graceful error state

**Status:** Code-fixed — live validation pending
**Affected:** `overview-view.tsx` cockpit header; individual panel error states are handled by EvidencePanel runtime
**Evidence:** The adapter returns `{ ok: false, error, displayState }` for failed queries. Without a cockpit-level guard, a not-found or unauthorized batch header response produced a silent null `batchHeader` and the InvestigationSummary showed "Loading material..." indefinitely.
**Risk:** An investigator querying a non-existent or inaccessible batch may see no error guidance.
**Fix applied:** `BatchHeaderErrorBanner` added to `overview-view.tsx`. Distinguishes `batchHeaderResult === undefined` (loading) from `batchHeaderResult.ok === false` (adapter error). Shows user-facing headings: "Batch not found" (not-found), "Not authorized or data not accessible" (unauthorized), "Data source timeout" (timeout), "Batch header unavailable" (other). All six evidence panels continue to render; only the cockpit header shows the banner. Unit tests in `overview-view.test.tsx` cover each error code, the loading (undefined) non-banner case, and the six-panel render-on-error case.
**Owner:** Claude
**Requires UAT:** Yes — confirm banner renders correctly in live deployed app for a non-existent batch and for an unauthorized access scenario.

---

## P2 — Improves Trust or Usability

### TRACE-P2-001 — Plant ID not displayed on trace graph nodes

**Status:** Fixed (2026-05-21) — plantId rendered as a third line on the node card itself; already present on selected-node detail
**Affected:** `trace-graph-panel.tsx` `TraceNodeCard`, selected-node detail
**Evidence:** `TraceNodeSchema` has `plantId?: z.string().optional()`. The Databricks graph mapper populates it from `gold_batch_lineage` PARENT/CHILD_PLANT_ID. Selected-node detail panel was already showing it. The node card itself now shows it as a small monospaced chip beneath `batchId` for at-a-glance scanning during cross-plant investigations.
**Fix applied:** `TraceNodeCard` adds a `{node.plantId && <div aria-label="Plant {value}">…}` chip beneath the batch ID line. Selected-node detail row unchanged. Edge-stroke colour map (`LINK_TYPE_COLORS`) moved to `trace-graph-utils.ts`, fixed to match the schema `relationshipType` enum (previously had wrong keys — legend swatch was decoupled from edge stroke), and wired into `mapToFlowEdges` so vendor-receipt / consumed-by / delivered-to are now visually distinguishable. Selected-edge detail now shows both `Link type (mapped)` (from `relationshipType`) and `Link type (raw)` (from `linkType`) when both are present.
**Requires UAT:** Yes — verify plant chip and per-relationship-type edge colours render on a live Databricks graph

### TRACE-P2-002 — Data freshness metadata absent

**Status:** Phase 1 fixed (2026-05-21) — `QueriedAtLabel` added to all live panels showing query-fetch time + "source refresh time unavailable" notice. Phase 2 (verified `_updated_at` column from gold views) remains open.
**Affected:** `BatchHeaderPanel`, `TraceGraphPanel`, `CustomerImpactPanel`, `MaterialSupplierExposurePanel`, `MassBalancePanel` (inline in `mass-balance-view.tsx`)
**Evidence:** The reference engine attached `data_freshness_seconds` from Databricks gold view materialisation timestamps. V2 has no equivalent column verified yet (see `data-freshness-plan.md` Approach A). Phase 1 was to surface query-fetch time so investigators at least see when the panel data was retrieved, with an explicit statement that source refresh time is not available.
**Fix applied:** New `QueriedAtLabel` shared component (`components/QueriedAtLabel.tsx`) renders "Queried at HH:MM:SS — source refresh time unavailable" from `AdapterResult.fetchedAt`. Renders nothing when `fetchedAt` is null/undefined. Added to all 5 currently-rendered live panels. Unit-tested for: null/undefined returns null, valid ISO renders HH:MM:SS, malformed ISO falls back to raw, the disclaimer string is preserved verbatim. The previous batch-header inline disclaimer ("Data freshness not available…") was replaced with this shared component.
**Remaining work:** Phase 2 — confirm a `_updated_at` / `last_updated_timestamp` column on each gold view and surface a real `dataAsOf` value through a future schema extension. Tracked in `data-freshness-plan.md`.
**Requires UAT:** Yes — confirm the "Queried at" line renders correctly across all panels in the deployed app

### TRACE-P2-003 — "across 0 countries" shown for confirmed zero-shipment batches

**Status:** Fixed (PR #24, commit 74f4b5c) for the `InvestigationSummary` cockpit header
**Affected:** `InvestigationSummary.tsx` — fixed; `customer-impact-panel.tsx` — not affected (uses `{data.countries.length > 0 && ...}` guard)
**Notes:** No further action required.

### TRACE-P2-004 — Evidence confidence grade thresholds not documented for users

**Status:** Fixed (2026-05-21) — `ScoringRules` section added to the `EvidenceConfidenceBadge` tooltip
**Affected:** `EvidenceConfidenceBadge`, `EvidencePackReadiness`
**Evidence:** Grade thresholds (COMPLETE = 100pts and 0 gaps, PARTIAL ≥ 50, etc.) were not explained to the user. An investigator seeing "Partial (78%)" did not know what 78 means or why it is not COMPLETE.
**Fix applied:** New `ScoringRules` sub-component renders inside the existing tooltip (below the description, above the gaps list). Lists each sector with its point weight (Lineage 15 / Customers & deliveries 20 / Mass balance 20 / Quality 15 / CoA 15 / Suppliers 15 = 100) and the grade thresholds (Complete = 100% no gaps · Partial ≥ 50% · Missing < 50% with some data · Not Assessed = 0%). Exported as a named export so unit tests can render it directly without going through the lazy-mounted Radix Tooltip portal. 3 new tests cover sector enumeration, point-value distribution, and threshold copy.
**Owner:** Gemini / Claude
**Requires UAT:** No

---

## P3 — Future Enhancement

### TRACE-P3-001 — Cycle detection metadata not exposed

**Affects:** `TraceGraph.unresolvedNodeCount` — schema exists, never set from a real cycle-detection walk
**Notes:** Deferred until recursive CTE results are wired from live Databricks.

### TRACE-P3-002 — No mass-balance drill-down to individual movement lines

**Affects:** `mass-balance-view.tsx`
**Notes:** Summary variance is shown; line-level movement table (MB51-style) not in scope for Phase 1.

### TRACE-P3-003 — No cross-link from investigation cockpit to related SAP transactions

**Affects:** Quick-links row in `InvestigationSummary.tsx`
**Notes:** Currently links to internal views only. Links to SAP GUI / Fiori transactions are a Phase 2 / deep-link requirement.
