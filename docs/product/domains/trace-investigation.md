# Trace Investigation — Domain Reference

**Domain:** traceability  
**Workspace:** trace-investigation  
**Lifecycle:** active — V1 proxy wired for batch-header; `POST /api/trace2/trace-graph` native Databricks route wired (q.txt); c.txt 2026-05-18: complete Traceability investigation screen at `?workspace=trace-graph-verify`; d.txt 2026-05-18: final route `?workspace=traceability-workspace&view=trace-tree` mounted with TraceQueryForm, no mock fallback (C15 BV pending)

---

## Overview

The Trace Investigation workspace provides end-to-end batch traceability for quality investigations. It replaces the original Trace2 application (9-page React app, 14 POST endpoints) within the V2 workspace shell.

Given a `batchId` and `investigationId`, the workspace surfaces:
- Full upstream/downstream batch lineage as an interactive graph
- Mass balance with per-day movement history
- Customer and supplier exposure summaries
- Quality/CoA release status
- Risk signals, event timeline, and related investigations

---

## Views

URL param: `?view=` (not `?tab=`). `?workspace=traceability-workspace` defaults to `trace-tree` (changed from `overview` in d.txt to avoid OverviewView mock panel fallback on cold load).

| View ID | Description | Status |
|---------|-------------|--------|
| `overview` | Batch header + trace graph + risk signals | Mock panels on cold load — not default |
| `trace-tree` | Native trace graph with embedded query form + BatchHeaderPanel | **Default view — primary real-data surface** (d.txt, C15 BV pending) |
| `mass-balance` | Mass balance totals + movements table + trace graph |
| `recall-readiness` | Customer impact + supplier exposure |
| `quality` | CoA release status |
| `event-timeline` | Chronological event log |
| `related-investigations` | Cross-investigation context |

---

## Data source

| Layer | Detail |
|-------|--------|
| Origin | SAP ECC / WH360 / EnvMon → Databricks gold views → V1 Trace2 backend |
| V1 endpoints (11) | POST-based: `/api/summary`, `/api/top-down`, `/api/bottom-up`, `/api/mass-balance`, `/api/recall-readiness`, `/api/supplier-risk`, `/api/quality`, `/api/coa`, `/api/production-history`, `/api/batch-compare`, `/api/impact` |
| V2 adapter | `trace2-adapter.ts` (mock) · `trace2-legacy-api-adapter.ts` (legacy-api) |
| Batch-header proxy | `GET /api/trace/batch-header` (verified) |
| Other methods | Mock only (Phase 1) |

---

## Adapter modes

`VITE_ADAPTER_MODE` selects the adapter at build time:

| Mode | Behaviour |
|------|-----------|
| `mock` (default) | Returns `trace2-mock-data.ts` fixtures with `source: 'mock'` |
| `legacy-api` | Calls V1 Trace2 proxy; batch-header verified, others return mock fallback |

---

## Panels

### TraceGraphPanel (`panels/trace-graph-panel.tsx`)

Interactive batch lineage graph powered by `@xyflow/react`.

**Investigation header** — anchor context bar above graph: materialId, batchId, plantId, node count, edge count, depth reached, truncated, warnings count, source.

**Direction controls** — toggle between Upstream ↑ / Both / Downstream ↓. Client-side filter via `filterGraphByDirection()` in `trace-graph-utils.ts`. Backend direction passed via `Trace2AdapterRequest.direction`.

**Trace controls** — `direction` / `maxDepth` / `maxEdges` passed from form at page level; adapter uses these instead of hardcoded values. Default: `both`, depth=2, edges=100 (verify page), 3/1000 (adapter fallback).

**Node selection** — click a node to see: material ID, batch ID, plant ID, node depth, isAnchor, direction membership, inbound edge count, outbound edge count, quantity.

**Edge selection** — click an edge to see all `gold_batch_lineage` fields: link type, movement type, posting date, quantity/UOM, source batch, target batch, process order ID, material document number, purchase order ID, delivery ID, sales order ID, supplier ID, customer ID. Uses "Available evidence" layout — only non-null fields rendered.

**Timeline from lineage edges** — sorted by `postingDate`; undated events grouped with count. No invented event types. Label: "Timeline from lineage edges".

**Exposure indicators** — derived from graph edges only: distinct customer/supplier/delivery/PO/process-order counts; edge count by link type; mixed UoM warning. Label: "Lineage exposure indicators". Disclaimer present: does not replace full recall analysis.

**Source/limitation banner** — Source: `gold_batch_lineage`, Execution, Query name, depth, truncated, material ID format caveat.

**Layout** — BFS from root batch; upstream nodes at negative Y levels, downstream at positive. Disconnected nodes placed at `min_level - 2` row.

**Empty state** — "No lineage edges found for this material/batch/plant." when filtered graph has no nodes.

### MassBalancePanel (`views/mass-balance-view.tsx`)

Inline panel (view-local, not in shared panels directory).

Shows: input qty, output qty, variance %, confidence score, unresolved movement count, and a per-day movements table (date, category, delta, running balance, reference).

Movement categories: `production` (blue) · `shipment` (amber) · `consumption` (purple) · `adjustment` (grey).

---

## Data contracts

Defined in `packages/data-contracts/src/schemas/trace-investigation.ts`.

Key types:

| Type | Purpose |
|------|---------|
| `TraceGraph` | Root type: nodes, edges, direction, depth, rootBatch, counts |
| `TraceNode` | Graph node: type, material, batch, plant, qty, status, riskLevel |
| `TraceEdge` | Graph edge: source, target, relationshipType, qty, uom, movementType, documentRef, postingDate, processOrderId, materialDocumentNumber, purchaseOrderId, supplierId, customerId, deliveryId, salesOrderId |
| `MassBalanceSummary` | Totals + optional `movements: MassBalanceMovement[]` |
| `MassBalanceMovement` | Per-day: date, category, delta, runningBalance, uom, reference |
| `CustomerExposureSummary` | Affected customers, deliveries, countries, shipped qty |
| `SupplierExposureSummary` | Supplier count, lots, highest-risk supplier |
| `CoAReleaseStatus` | Release status, usage decision, open lots, pending results |
| `TraceRiskSignal` | Signal: severity, confidence, source, recommended action |
| `RelatedInvestigation` | Cross-investigation link: relatedBy, status, severity |

---

## Original Trace2 parity status

See `docs/migration/trace2-functional-parity-matrix.md` for the full 40-capability matrix.

**Implemented in this pass (Phase d):**

| Item | Fix |
|------|-----|
| A1 — Direction controls | Direction toggle (Upstream ↑ / Both / Downstream ↓) added to TraceGraphPanel |
| A2 — Mass balance movements | `MassBalanceMovement` schema added; movements table rendered in MassBalanceView |
| A3 — Edge detail | `onEdgeClick` + `SelectedEdgeDetail` panel added to TraceGraphPanel |
| A4 — Graph robustness | Disconnected node handling + empty graph state added to `bfsLayout` and panel |
| A5 — Richer node detail | Connected relationships list shown in `SelectedNodeDetail` |

**Implemented in c.txt (2026-05-18):**

| Item | Status |
|------|--------|
| Investigation header | Done — materialId, batchId, plantId, counts, source, truncated |
| Full edge detail | Done — all gold_batch_lineage fields in `SelectedEdgeDetail` |
| Full node detail | Done — depth, isAnchor, directions, inbound/outbound counts |
| Timeline from edges | Done — sorted by postingDate, undated grouped |
| Exposure indicators | Done — distinct customer/supplier/delivery/PO/process-order counts |
| Source/limitation banner | Done — gold_batch_lineage, query name, depth, truncated, material ID caveat |
| Direction/depth/edges controls | Done — in form at page level, passed to adapter |
| TraceEdge schema extended | Done — 8 new optional gold_batch_lineage fields |
| TraceNode schema extended | Done — depth, directions, isAnchor |
| Trace2AdapterRequest extended | Done — direction, maxDepth, maxEdges optional |
| Adapter params wired | Done — getTraceGraph uses request.direction/maxDepth/maxEdges |
| Tests | Done — 134 di-traceability tests, 136 web tests |

**Still missing (Phase 2+):**

- `?workspace=traceability-workspace&tab=trace` shell integration (pending UAT test)
- Customer delivery detail table
- Supplier detail table
- Quality inspection lot and MIC result tables
- Production history panel
- Batch comparison panel
- Cross-batch exposure panel
- Recall readiness exposure table
- Export / recall dossier

---

## Utilities (`panels/trace-graph-utils.ts`)

| Export | Purpose |
|--------|---------|
| `bfsLayout(graph)` | Returns `Map<id, {x,y}>` positions; disconnected nodes at min_level − 2 |
| `filterGraphByDirection(graph, direction)` | Client-side direction filter returning a new `TraceGraph` |
| `mapToFlowNodes(graph, selectedId)` | Maps `TraceNode[]` to React Flow `Node<TraceNodeData>[]` |
| `mapToFlowEdges(graph)` | Maps `TraceEdge[]` to React Flow `Edge[]` |
| `RISK_BORDER / RISK_BG / RISK_TEXT` | Risk-level colour palettes |
| `NODE_TYPE_LABEL` | Human-readable labels for node type enum values |

---

## Test coverage

| File | Tests |
|------|-------|
| `trace-graph-utils.test.ts` | 23 tests: bfsLayout (incl. disconnected), filterGraphByDirection, mapToFlowNodes, mapToFlowEdges |
| `trace-graph-panel.test.tsx` | 25 tests: rendering, node selection, edge selection, direction toggle |
| `trace2-adapter.test.ts` | 11 tests: mock adapter methods |
| `trace2-legacy-api-adapter.test.ts` | 13 tests: legacy API adapter |
