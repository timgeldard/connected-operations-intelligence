# Trace2 Functional Parity Matrix

**Date:** 2026-05-16
**V1 source:** `C:/Users/tgeldard/Documents/GitHub/trace2` (original) + `ConnectIO-RAD/apps/trace2` (V1 DDD)
**V2 source:** `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2`

Status codes: `preserved` · `partially-preserved` · `improved` · `mock-only` · `legacy-api wired` · `legacy-api verified` · `placeholder` · `missing` · `degraded`

---

| # | Capability | Original file/path | Original API/query | Original behaviour | V2 file/path | V2 behaviour | Data tier | Parity | Severity | Remediation | Fix without V1? | Files affected |
|---|-----------|-------------------|-------------------|-------------------|--------------|--------------|-----------|--------|----------|-------------|----------------|----------------|
| 1 | Trace entry form / context | `App.tsx` (batch picker) | — | Material ID + Batch ID picker at top of every page; Load button; remembered recent searches | `trace-investigation-workspace.tsx` | Fixed mock investigationId `INV-2024-003847`; no batch picker | mock | **degraded** | blocker | Add batch context display (Phase 1: read-only); batch-first entry in Phase 2 | Yes (display only) | workspace.tsx |
| 2 | Batch header / material context | `pages/01-recall.tsx` | `POST /api/summary` → gold_batch_summary_v | Batch: material, batchId, plant, manufacture/expiry, status, stock, qty | `panels/batch-header-panel.tsx` | BatchHeaderSummary: materialId, batchId, plant, status, qty, dates. Legacy-api method `getBatchHeaderSummary` verified | legacy-api verified | **preserved** | — | — | — | — |
| 3 | Forward trace (top-down) | `pages/03-top-down.tsx` | `POST /api/top-down` → gold_batch_lineage (downstream walk) | Downstream lineage tree: level, material, batch, plant, qty, customer, link type; separate page | `panels/trace-graph-panel.tsx` | Mock graph shows downstream nodes but no direction control; no separate forward-only view | mock | **partially-preserved** | blocker | Add direction toggle to TraceGraphPanel | Yes | trace-graph-panel.tsx |
| 4 | Reverse trace (bottom-up) | `pages/02-bottom-up.tsx` | `POST /api/bottom-up` → gold_batch_lineage (upstream walk, depth 4) | Upstream lineage tree: level, material, batch, plant, qty, supplier, link type | `panels/trace-graph-panel.tsx` | Mock graph shows upstream nodes but no direction control | mock | **partially-preserved** | blocker | Add direction toggle to TraceGraphPanel | Yes | trace-graph-panel.tsx |
| 5 | Bidirectional trace | `App.tsx` | Sequential calls to `/api/top-down` + `/api/bottom-up` | Separate pages; no single bidirectional query | `panels/trace-graph-panel.tsx` | Mock graph has `direction: 'both'`; all 7 nodes shown simultaneously | mock | **mock-only** | high | Add direction control; 'both' is already the default | Yes | trace-graph-panel.tsx |
| 6 | Trace graph / tree | `components/LineageGraph.tsx` | `POST /api/trace` → recursive CTE | SVG lineage, dynamic depth, pan/zoom; node colours by status | `panels/trace-graph-panel.tsx` | React Flow graph with BFS layout, custom node cards, node colours by risk level, pan/zoom | mock-only | **partially-preserved** | high | Wire to V1 proxy → adapter | No (needs V1) | trace-graph-panel.tsx, trace2-legacy-api-adapter.ts |
| 7 | Node selection | `components/LineageGraph.tsx` | — | Click node to inspect | `panels/trace-graph-panel.tsx` | Click to select; shows SelectedNodeDetail with 6 fields | mock | **partially-preserved** | medium | Add process order, edge list, drill-through to selected node | Yes | trace-graph-panel.tsx |
| 8 | Node detail | `pages/03-top-down.tsx` (side panel) | `POST /api/batch-details` | Material, batch, plant, status, qty, process order, CoA, customers, cross-batch exposure | `panels/trace-graph-panel.tsx` (SelectedNodeDetail) | Type, risk, material, batch, plant, qty, status — 7 fields | mock | **degraded** | high | Add process order, edge relationships, drill-through hints | Yes | trace-graph-panel.tsx |
| 9 | Edge detail / relationship | `components/LineageGraph.tsx` | — | Hover/click edge shows: link type, qty, document reference | `panels/trace-graph-panel.tsx` | No edge click handler; edge labels show relationshipType only | mock | **missing** | high | Add `onEdgeClick` + SelectedEdgeDetail panel | Yes | trace-graph-panel.tsx |
| 10 | Cycle handling | `dal/trace_dal.py` (`fetch_trace_tree`) | Path string INSTR check in recursive CTE | SQL prevents revisiting nodes via path concatenation; logs warning on cycle | `panels/trace-graph-utils.ts` (`bfsLayout`) | BFS visited map prevents infinite loop on cyclic edges; no warning shown | mock | **partially-preserved** | medium | Add cycle guard to bfsLayout; surface cycle warning in UI | Yes | trace-graph-utils.ts |
| 11 | Depth handling / control | `App.tsx` (depth sliders) | `max_levels` param on API calls | Separate upstream depth and downstream depth sliders in UI top bar | No depth controls | No depth controls in V2; mock graph always 3 levels | missing | **missing** | high | Add depth filter slider to TraceGraphPanel | Yes (client-side filter) | trace-graph-panel.tsx, trace-graph-utils.ts |
| 12 | Duplicate edge handling | `dal/trace_dal.py` (`unique_edges` CTE) | `SELECT DISTINCT` on lineage edges | Deduplicates edges before recursion | `panels/trace-graph-utils.ts` | `mapToFlowEdges` maps all edges from schema — no dedup | mock | **partially-preserved** | low | Add edge dedup in `mapToFlowEdges` | Yes | trace-graph-utils.ts |
| 13 | Mass balance (totals) | `pages/04-mass-balance.tsx` | `POST /api/mass-balance` | Per-day delta + running cumulative; also shows totals | `views/mass-balance-view.tsx` (MassBalancePanel) | Input/output/variance/confidence totals only. No per-day events. | mock | **degraded** | blocker | Add movements array to schema + mock; render movements table | Yes | mass-balance-view.tsx, trace-investigation.ts, trace2-mock-data.ts |
| 14 | Mass balance per-day events | `pages/04-mass-balance.tsx` | `POST /api/mass-balance` → gold_batch_mass_balance_v | Per-day: MOVEMENT_CATEGORY, delta, cumulative; timeline chart | `views/mass-balance-view.tsx` | Not implemented | missing | **missing** | blocker | See #13 |
| 15 | Customer exposure summary | `pages/01-recall.tsx` | `POST /api/recall-readiness` → gold_batch_delivery_v | Count customers, deliveries, countries, shipped qty, highest severity | `panels/customer-impact-panel.tsx` | affectedCustomers, affectedDeliveries, countries, shipped qty, recall banner | mock | **preserved** | — | Improve with detail table | Yes | — |
| 16 | Customer delivery detail table | `pages/01-recall.tsx` | `POST /api/recall-readiness` | Per-delivery: customer, city, country, date, qty, status (PLANNED/IN_TRANSIT/DELIVERED) | `panels/customer-impact-panel.tsx` | Not shown — summary counts only | missing | **missing** | high | Extend CustomerExposureSummary with deliveries array + mock + render | Yes | customer-impact-panel.tsx, trace-investigation.ts |
| 17 | Customer share/country chart | `pages/01-recall.tsx` | `POST /api/recall-readiness` | Countries donut + Customers bar chart (share %) | Not implemented | — | missing | **missing** | medium | Add to CustomerImpactPanel | Yes | customer-impact-panel.tsx |
| 18 | Supplier exposure summary | `pages/08-supplier-risk.tsx` | `POST /api/supplier-risk` | Supplier count, lots, upstream materials | `panels/material-supplier-exposure-panel.tsx` | supplierCount, supplierLots, upstreamMaterials, highestRiskSupplier, openSupplierActions | mock | **preserved** | — | — | — | — |
| 19 | Supplier detail table | `pages/08-supplier-risk.tsx` | `POST /api/supplier-risk` → gold_batch_lineage + gold_supplier | Per-supplier: ID, name, country, material, received qty, batch count, dates, failure rate | `panels/material-supplier-exposure-panel.tsx` | Not shown — summary only | missing | **missing** | high | Extend SupplierExposureSummary with supplierDetails array | Yes | material-supplier-exposure-panel.tsx |
| 20 | Inventory/stock position | `pages/01-recall.tsx` (header) | `POST /api/summary` → gold_batch_stock_v | UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT, TOTAL_STOCK per batch | `panels/batch-header-panel.tsx` | stockStatus enum (unrestricted/quality-inspection/blocked/returns/transit) — aggregate only | mock | **degraded** | medium | Show per-status stock quantities in header or add stock panel | No (needs gold_batch_stock_v) | batch-header-panel.tsx |
| 21 | Production/process-order context | `pages/01-recall.tsx` (batch header) | `POST /api/summary` | process_order, manufacture date, expiry, consuming POs, shelf-life status | `panels/batch-header-panel.tsx` | processOrderId, manufactureDate, expiryDate present | mock | **preserved** | — | — | — | — |
| 22 | Quality/release status | `pages/05-quality.tsx` | `POST /api/quality` → gold_batch_quality_lot_v, gold_batch_quality_result_v | Inspection lots + MIC results + summary | `panels/coa-release-status-panel.tsx` | coaAvailable, releaseStatus, usageDecision, open lots, failed chars, pending results | mock | **degraded** | high | Add lots + MIC results arrays to schema | Yes | coa-release-status-panel.tsx, trace-investigation.ts |
| 23 | Quality inspection lot table | `pages/05-quality.tsx` | `POST /api/quality` | Lot ID, type, dates, inspector, origin, usage decision | Not implemented | — | missing | **missing** | high | Add to CoAReleaseStatus or new panel | Yes | — |
| 24 | Quality MIC results table | `pages/05-quality.tsx` | `POST /api/quality` | Per-lot MIC: code, name, target, tolerance, actual, deviation, valuation | Not implemented | — | missing | **missing** | high | Add to CoAReleaseStatus or new panel | Yes | — |
| 25 | Warehouse/hold status | — | Not in original Trace2 directly (in WH360) | — | Not in trace workspace | — | — | **not applicable** | — | — | — | — |
| 26 | Event timeline | `pages/01-recall.tsx` (events section) | `POST /api/recall-readiness` | Production/consumption/sales/adjustment events chronologically | `panels/event-timeline-panel.tsx` | 5 mock events (investigation-opened, batch-blocked, evidence-added, investigation-updated, quality-decision); vertical timeline | mock | **preserved** | — | Add production/staging events to mock | Yes | — |
| 27 | Related investigations | Not in original Trace2 | — | — | `panels/related-investigations-panel.tsx` | 2 related investigations with relatedBy, status, severity | mock | **improved** | — | — | — | — |
| 28 | Recall readiness exposure table | `pages/01-recall.tsx` | `POST /api/recall-readiness` | Downstream batches with risk tier (CRITICAL/HIGH/MEDIUM/LOW), stock, shipped qty | `views/recall-readiness-view.tsx` | Summary panels only; no exposure table | missing | **missing** | blocker | Add exposure array to CustomerExposureSummary or new type | Yes | recall-readiness-view.tsx |
| 29 | Risk signals | — | Not in original (V2 concept) | — | `panels/risk-signals-panel.tsx` | 3 mock signals with severity, confidence, source, recommendedAction | mock | **improved** | — | — | — | — |
| 30 | Drill-through to Batch Release | All pages (batch click) | — | Click batch → navigate to that batch's quality/CoA page | Not wired | Phase 2 — console telemetry only | placeholder | **missing** | high | Wire using shell navigation to quality-batch-release | Partially | trace-graph-panel.tsx |
| 31 | Drill-through to Process Order Review | Bottom-up/supplier pages | — | Click process order → navigate to PO details | Not wired | Phase 2 only | placeholder | **missing** | medium | Wire using shell navigation | Partially | — |
| 32 | Drill-through to Warehouse360 | Not in original Trace2 | — | — | Not wired | Phase 2 | placeholder | **missing** | low | Wire using shell navigation | Partially | — |
| 33 | Production history panel | `pages/06-production-history.tsx` | `POST /api/production-history` | Recent 24 batches for material: PO, plant, date, qty, quality status | Not implemented | — | missing | **missing** | medium | Add `getProductionHistory()` method + panel | Yes | — |
| 34 | Batch comparison panel | `pages/07-batch-compare.tsx` | `POST /api/batch-compare` | Cross-batch quality rollup: lot count, accepted/rejected/failed | Not implemented | — | missing | **missing** | medium | Add `getBatchComparison()` method + panel | Yes | — |
| 35 | CoA MIC results table | `pages/09-coa.tsx` | `POST /api/coa` → gold_batch_coa_results_v | MIC code, target, tolerance, actual, within_spec, deviation | CoAReleaseStatusPanel (summary) | Release status summary only — no MIC table | degraded | **missing** | medium | Add micResults to CoAReleaseStatus schema | Yes | — |
| 36 | Cross-batch exposure | `pages/01-recall.tsx` | `POST /api/impact` | Batches sharing ≥1 production input with risk tier | Not implemented | — | missing | **missing** | medium | New panel: CrossBatchExposurePanel | Yes (mock) | — |
| 37 | Depth control slider | `App.tsx` (top bar) | `max_levels`, depth params | Upstream depth and downstream depth sliders | Not implemented | — | missing | **missing** | high | Add depth slider to TraceGraphPanel | Yes | trace-graph-panel.tsx |
| 38 | Error / loading / empty states | `components/LoadFrame.tsx` | — | Shared loading spinner, error banner, empty state | `EvidencePanel` (all panels) | displayState: loading/ready/stale/error; EvidencePanel handles all states | preserved | **preserved** | — | — | — | — |
| 39 | Source badges | — | — | Not in original Trace2 (V2 concept) | EvidencePanel runtime | Amber "Legacy API" badge, no badge for mock | improved | **improved** | — | — | — | — |
| 40 | Export / recall dossier | `pages/01-recall.tsx` | — | Mock "Export dossier" button; no actual export | Not implemented | — | missing | **missing** | low | Add placeholder export button in Phase 1 | Yes | — |

---

## Parity Summary

| Status | Count |
|--------|-------|
| preserved | 7 |
| improved | 4 |
| partially-preserved | 5 |
| mock-only | 1 |
| degraded | 5 |
| missing | 14 |
| not applicable | 1 |
| placeholder | 3 |
| **Total** | **40** |

**Preserved + Improved:** 11 / 40 (28%)
**At risk (degraded + missing):** 19 / 40 (48%)
