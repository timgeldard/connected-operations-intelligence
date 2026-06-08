# Trace2 Parity Remediation Backlog

**Date:** 2026-05-16
**Source:** trace2-functional-parity-audit.md, trace2-functional-parity-matrix.md

---

## Group A — Must Fix for Functional Parity

### A1. Trace direction UI controls

- **Title:** Add forward / reverse / bidirectional direction selector to TraceGraph
- **User impact:** Without direction controls, investigators cannot distinguish upstream (supplier) from downstream (customer) exposure — the core Trace2 workflow.
- **Current problem:** TraceGraph always shows `direction: 'both'` with no UI to change it. The original had explicit Bottom-Up (reverse) and Top-Down (forward) pages.
- **Original behaviour:** Separate pages for bottom-up and top-down with depth controls in top bar.
- **Proposed V2 fix:** Add direction toggle buttons (Forward / Reverse / Both) to TraceGraphPanel. Filter displayed nodes/edges client-side from full mock graph. Extend `Trace2AdapterRequest` with `direction` field for future adapter support.
- **Source/data dependency:** None — client-side filter on existing mock graph.
- **Implementation risk:** Low — pure UI state + filter logic. No adapter changes required for mock.
- **Effort estimate:** Small (2–4 hours)
- **Priority:** Blocker for Phase 1 pilot credibility

---

### A2. Mass balance per-period movements table

- **Title:** Add per-day movement events to mass balance panel
- **User impact:** Without the per-day movement table, mass balance is unactionable — you cannot see which events caused the variance.
- **Current problem:** MassBalancePanel shows only 4 totals (input/output/variance/confidence). The original showed a per-day events table with delta and running cumulative balance.
- **Original behaviour:** `fetch_mass_balance` returned per-day rows with movement category, delta, cumulative. Frontend rendered timeline chart.
- **Proposed V2 fix:** Add `movements` array to `MassBalanceSummary` schema (optional, backward-compatible). Add realistic mock movements to `mockMassBalance`. Render a movements table inside MassBalancePanel.
- **Source/data dependency:** None — extend mock data with realistic per-day events.
- **Implementation risk:** Low — additive schema change + UI render.
- **Effort estimate:** Small (2–4 hours)
- **Priority:** Blocker for mass balance parity

---

### A3. Edge detail / relationship explanation in trace graph

- **Title:** Show edge type, quantity, document reference on edge click
- **User impact:** Without edge detail, investigators cannot understand what type of movement connects two batches, which is essential for recall scope assessment.
- **Current problem:** TraceGraph edges have no click handler. All edge data (movementType, quantity, uom, documentReference) is in the schema but not shown.
- **Original behaviour:** Hovering/clicking edge rows in lineage tables showed quantity, movement type, document reference.
- **Proposed V2 fix:** Add `onEdgeClick` handler to ReactFlow. Render a `SelectedEdgeDetail` panel below the graph (similar to SelectedNodeDetail) showing relationshipType, quantity/uom, movementType, documentReference.
- **Source/data dependency:** Mock data already has edge quantity, movementType, documentReference fields.
- **Implementation risk:** Low — React Flow supports onEdgeClick, data already present.
- **Effort estimate:** Small (1–2 hours)
- **Priority:** High — essential for understanding batch lineage

---

### A4. Graph robustness (empty / one-node / disconnected / cycle-safe)

- **Title:** Make TraceGraph robust to edge cases in graph data
- **User impact:** If the graph is empty or has disconnected nodes, the current bfsLayout may produce a broken layout. Cycle-safe handling is critical for recall investigations.
- **Current problem:** bfsLayout assumes at least one edge exists for layout. Empty graph returns early but panel doesn't render a meaningful empty state. Disconnected nodes (not reached by BFS) are positioned at (0,0). No explicit cycle guard in layout.
- **Original behaviour:** Tree building had explicit cycle detection via path string INSTR. Frontend showed "No lineage found" for empty trace.
- **Proposed V2 fix:** Handle `graph.nodes.length === 0` → show "No batch lineage found." message. Position disconnected nodes (those not in BFS result) in a separate row. Add visited-node guard in bfsLayout to prevent runaway BFS on cycle-containing edge lists.
- **Source/data dependency:** None.
- **Implementation risk:** Low.
- **Effort estimate:** Small (1–2 hours)
- **Priority:** High — correctness issue, not cosmetic

---

### A5. Richer selected node detail

- **Title:** Add process order, edge relationships, and drill-through to selected node detail
- **User impact:** Investigators clicking a node need to see its process order linkage and what edges connect it — not just its ID and risk level.
- **Current problem:** SelectedNodeDetail shows 6 fields. Missing: process order, edge types connecting this node, drill-through options.
- **Original behaviour:** Clicking a tree node showed a side panel with material details, process order, batch status, and options to navigate to that batch's trace pages.
- **Proposed V2 fix:** Show connected edges (relationship types, quantities, targets) in the selected node detail. Show processOrderId if present. Add "Drill through" section (placeholder until Phase 2 backend wired).
- **Source/data dependency:** Edge data already on graph. ProcessOrderId is on TraceNode.
- **Implementation risk:** Low.
- **Effort estimate:** Small (1–2 hours)
- **Priority:** High

---

## Group B — Should Fix for Credible Pilot/Demo

### B1. Recall readiness customer and delivery detail

- **Title:** Add customer detail table and delivery table to RecallReadinessView
- **User impact:** The current RecallReadinessView shows only summary panels. A pilot audience expects to see affected customers and delivery statuses — the original's most important output.
- **Current problem:** RecallReadinessView composes RiskSignalsPanel, CustomerImpactPanel, CoAReleaseStatusPanel, RelatedInvestigationsPanel, EventTimelinePanel — but CustomerImpactPanel shows only counts (affectedCustomers, affectedDeliveries, countries).
- **Original behaviour:** Recall Readiness page showed: Countries donut, Customers bar chart (with share %), Deliveries table (per delivery: customer, city, country, date, qty, status), Exposure table (downstream batches with risk tiers).
- **Proposed V2 fix:** Extend `CustomerExposureSummary` schema with `deliveries` and `customerBreakdown` arrays. Add to mock data. Render inside CustomerImpactPanel or a new CustomerDeliveryPanel.
- **Source/data dependency:** Extend schema + mock data. No V1 access needed.
- **Implementation risk:** Medium — schema extension, new mock arrays.
- **Effort estimate:** Medium (4–8 hours)
- **Priority:** High for pilot

---

### B2. Supplier detail table

- **Title:** Add per-supplier table to supplier exposure
- **User impact:** Investigators need to see which specific suppliers are in the upstream chain, with their quality failure rates — not just counts.
- **Current problem:** MaterialSupplierExposurePanel shows only 3 stats: supplier count, supplier lots, upstream materials.
- **Original behaviour:** Supplier Risk page showed a full table: supplier ID, name, country, material, received qty, batch count, dates, failure rate.
- **Proposed V2 fix:** Extend `SupplierExposureSummary` with `supplierDetails` array. Add mock data. Render table in MaterialSupplierExposurePanel.
- **Source/data dependency:** Extend schema + mock. No V1 needed.
- **Implementation risk:** Medium.
- **Effort estimate:** Medium (3–5 hours)
- **Priority:** High for pilot

---

### B3. Depth controls for trace graph

- **Title:** Add upstream / downstream depth controls to TraceGraph
- **User impact:** Investigators need to control how deep the trace goes — too many levels creates noise, too few misses critical upstream suppliers.
- **Current problem:** No depth controls exist. The mock graph is always 3 levels deep.
- **Original behaviour:** "Trace depth ↓" and "Input depth ↑" controls in the top bar; passed to API as query params.
- **Proposed V2 fix:** Add depth slider or stepper to TraceGraphPanel. Filter nodes by depth level from BFS layout result.
- **Source/data dependency:** BFS layout already computes levels — just need to filter by max level.
- **Implementation risk:** Low.
- **Effort estimate:** Small (2–3 hours)
- **Priority:** Medium for pilot

---

### B4. Cross-workspace drill-through

- **Title:** Wire drill-through from trace to Batch Release, Process Order Review, Warehouse360
- **User impact:** Investigators following a batch/material from the trace graph need to navigate to the relevant workspace without losing context.
- **Current problem:** `drillThrough` in registration targets `trace-investigation/trace-tree` but cross-workspace links (to quality-batch-release, process-order-review) are Phase 2 / not wired.
- **Original behaviour:** Clicking a batch in any lineage table navigated to that batch's pages. All pages shared the same batch picker.
- **Proposed V2 fix:** Add drill-through buttons in SelectedNodeDetail and RecallReadinessView that navigate to quality-batch-release, process-order-review, warehouse-360-overview using shell navigation state.
- **Source/data dependency:** Requires shell navigation API. Check if workspace navigation hook is available.
- **Implementation risk:** Medium — depends on shell navigation primitives.
- **Effort estimate:** Medium (3–6 hours)
- **Priority:** Medium for pilot

---

### B5. Batch entry context (material + batch picker)

- **Title:** Surface material ID + batch ID as the trace context entry point
- **User impact:** The original Trace2 was batch-first: paste a material ID and batch ID and trace. V2 is investigation-first: you need an investigationId, which is abstract.
- **Current problem:** `Trace2AdapterRequest.investigationId` is required but the UI has no batch picker. The workspace uses a fixed mock investigationId.
- **Original behaviour:** Material ID + Batch ID inputs at top of every page, "Load" button, last 10 batch searches remembered.
- **Proposed V2 fix:** Add a lightweight batch context widget to TraceInvestigationWorkspace header (read/display only from scope). In Phase 1, this can display the mock batchId/materialId from the investigation context. Full batch-first entry requires Phase 2 investigation creation API.
- **Source/data dependency:** Mock investigation context already has materialId, batchId. Adapter already returns them.
- **Implementation risk:** Low for read-only display, medium for editable picker.
- **Effort estimate:** Small (display only), medium (editable picker with investigation creation)
- **Priority:** Medium — cosmetic fix is easy, full parity requires Phase 2

---

## Group C — Backlog / Later

### C1. Production history panel

- **Title:** Add production history panel showing recent batches for material
- **User impact:** Quality and traceability teams use production history to identify production anomalies (batches produced just before/after the implicated one).
- **Current problem:** No production history panel in V2. Original had a full page with 24 recent batches.
- **Original behaviour:** `fetch_production_history` → table: PO, batch, plant, date, qty, quality status, yield%.
- **Proposed V2 fix:** Add `getProductionHistory()` method to Trace2Adapter. Add data contract. Add panel. Add to timeline-events or recall-readiness view.
- **Source/data dependency:** New adapter method, new schema, new mock data.
- **Effort estimate:** Medium (4–6 hours)
- **Priority:** Low for Phase 1

---

### C2. Batch comparison panel

- **Title:** Add batch comparison panel for cross-batch quality rollup
- **User impact:** QA uses batch comparison to identify whether the quality issue is isolated to one batch or part of a pattern.
- **Current problem:** No batch comparison panel in V2. Original had a 24-batch quality comparison.
- **Original behaviour:** `fetch_batch_compare` → table: batch ID, PO, production qty, lot count, accepted/rejected/failed MIC counts.
- **Proposed V2 fix:** Add `getBatchComparison()` method and data contract. Add panel.
- **Source/data dependency:** New adapter method, new schema, new mock data.
- **Effort estimate:** Medium (4–6 hours)
- **Priority:** Low for Phase 1

---

### C3. Quality inspection lots and MIC results

- **Title:** Add quality inspection lot table and MIC results table
- **User impact:** QA and food safety teams need detailed lot and MIC data — not just the release status summary.
- **Current problem:** CoAReleaseStatusPanel shows only counts (open lots, failed characteristics, pending results). No lot table or MIC results table.
- **Original behaviour:** Quality page had two tables: inspection lots and MIC-level results.
- **Proposed V2 fix:** Extend CoAReleaseStatus schema with `lots` and `micResults` arrays (or add new panel). Add mock data. Render tables.
- **Source/data dependency:** Schema extension + mock data.
- **Effort estimate:** Medium (4–6 hours)
- **Priority:** Low for Phase 1 but important before Quality Batch Release integration

---

### C4. Cross-batch exposure

- **Title:** Add cross-batch exposure panel (shared production inputs)
- **User impact:** During a recall, understanding which other batches share the same raw material inputs is critical for scope assessment.
- **Current problem:** No cross-batch exposure in V2. Original calculated shared-input batches with risk tier (High ≥3 shared, Medium ≥2, Low ≥1).
- **Original behaviour:** `fetch_impact` returned cross-batch exposure with risk tier.
- **Proposed V2 fix:** Add `getCrossBatchExposure()` method + data contract + panel.
- **Source/data dependency:** New adapter method, new schema, new mock data.
- **Effort estimate:** Medium (3–5 hours)
- **Priority:** Low — requires multiple mock batches

---

### C5. Export / recall dossier

- **Title:** Add recall dossier export
- **User impact:** Regulatory and food safety teams need a printable/shareable recall report.
- **Current problem:** Not implemented in V2. Original had a mock "Export dossier" button on Recall Readiness.
- **Original behaviour:** Mock button — no actual export in original either.
- **Proposed V2 fix:** Add an export button that compiles the current recall readiness data into a printable view or downloadable JSON. Phase 1: scope/metadata summary only.
- **Effort estimate:** Large (1–2 days for real implementation)
- **Priority:** Low — was also incomplete in the original

---

## Implemented This Tranche

The following Group A items were implemented in this parity pass:

| Item | Status |
|------|--------|
| A1 — Trace direction UI controls | Implemented |
| A2 — Mass balance movements table | Implemented |
| A3 — Edge detail in trace graph | Implemented |
| A4 — Graph robustness | Implemented |
| A5 — Richer selected node detail | Implemented |

**c.txt (2026-05-18) — TraceGraphPanel full product build:**

| Item | Status |
|------|--------|
| Investigation header (materialId, batchId, plantId, counts, source, truncated) | Implemented |
| Full edge detail — all gold_batch_lineage fields in SelectedEdgeDetail | Implemented |
| Full node detail — depth, isAnchor, directions, inbound/outbound counts | Implemented |
| Timeline from lineage edges — sorted by postingDate, undated grouped | Implemented |
| Exposure indicators — distinct customer/supplier/delivery/PO/process-order counts | Implemented |
| Source/limitation banner — gold_batch_lineage, query name, depth, truncated, material ID caveat | Implemented |
| Direction/maxDepth/maxEdges controls — form at page level, passed to adapter | Implemented |
| TraceEdge schema extended — 8 new optional gold_batch_lineage fields | Implemented |
| TraceNode schema extended — depth, directions, isAnchor | Implemented |
| Trace2AdapterRequest extended — direction, maxDepth, maxEdges optional | Implemented |
| Adapter params wired — getTraceGraph uses request.direction/maxDepth/maxEdges | Implemented |
| Edge labels — mapToFlowEdges sets label from relationshipType | Implemented |

**d.txt (2026-05-18) — Final Traceability workspace route:**

| Item | Status |
|------|--------|
| TraceQueryForm — shared form with recent searches, copy payload, reset, material ID suggestion | Implemented |
| TraceTreeView rewrite — embeds TraceQueryForm; panels gated behind submitted request | Implemented |
| Final route — `?workspace=traceability-workspace&view=trace-tree` mounted; defaults to trace-tree | Implemented (C15 BV pending UAT) |
| OverviewView mock fallback prevented — traceability-workspace default view changed to trace-tree | Implemented |
| RiskSignalsPanel excluded — always mock, excluded until databricks-api adapter exists | Implemented |
| BatchHeaderPanel gating — shown only when batchId+materialId present | Implemented |
| Collapsible technical details section — shows last submitted request JSON | Implemented |
| Link type legend — inline legend showing distinct link types in current directed graph | Implemented |
| B5 — Batch entry context | Implemented via TraceQueryForm (editable picker, not investigation-creation) |

**B3 — Depth controls:** Implemented as maxDepth select in TraceQueryForm.

**Note:** B1 (customer detail table), B2 (supplier detail table), B4 (cross-workspace drill-through), C1–C5 remain backlog.
