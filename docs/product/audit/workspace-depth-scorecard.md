# Workspace Depth Scorecard — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** All 9 active product workspaces

---

## Scoring rubric

Each dimension scored **0–5**:

| Score | Meaning |
|-------|---------|
| 0 | Absent |
| 1 | Minimal / stub |
| 2 | Partial — meaningful gaps visible |
| 3 | Solid foundation — one or two notable gaps |
| 4 | Good — minor gaps only |
| 5 | Complete for prototype stage |

---

## Dimension definitions

| Dimension | What is scored |
|-----------|---------------|
| **Information usefulness** | Do the panels give a user information they could act on? |
| **Interaction quality** | Can the user navigate, filter, select, or drive the workspace meaningfully? |
| **Visual quality** | Are panels well-presented, colour-coded, and density-appropriate? |
| **Real-data readiness** | How close is the workspace to accepting real V1 or Databricks data? |
| **Cross-domain evidence reuse** | Does the workspace pull evidence from other domains, or export evidence to them? |
| **Action-flow realism** | Do action flows represent plausible operations, even if not yet wired? |
| **Drill-through behaviour** | Can a user follow a problem from this workspace into a more specific one? |
| **Loading / error / empty states** | Are all three states handled in panels (via EvidencePanel)? |
| **Source transparency** | Are source badges, confidence levels, and tier labels visible? |
| **Pilot/demo credibility** | Would a domain expert accept this as a prototype in a structured pilot session? |

---

## Scorecard

### Trace Investigation

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 4 | Risk signals, customer impact, supplier exposure, CoA status, event timeline all operationally informative |
| Interaction quality | 2 | View switching works; TraceGraphPanel is a static text list — no graph interactivity |
| Visual quality | 4 | Colour-coded panels; good information density; consistent use of design tokens |
| Real-data readiness | 3 | `getBatchHeaderSummary` browser-verified via legacy-api; all other methods return mock |
| Cross-domain evidence reuse | 5 | `trace-exposure-for-release` consumed by Quality; strongest cross-domain provider |
| Action-flow realism | 2 | 4 action stubs registered (escalate, resolve, add-evidence, new-investigation); all console.log only |
| Drill-through behaviour | 3 | Can navigate from Quality to Trace via `navigateToTraceInvestigation`; no outbound drill-through from Trace |
| Loading / error / empty states | 3 | EvidencePanel handles all three states consistently across panels |
| Source transparency | 3 | Source badge shown on batch-header panel (verified legacy-api); mock panels lack explicit tier labelling |
| Pilot/demo credibility | 3 | Strong data depth undermined by absent graph visualisation |
| **Total** | **32 / 50** | |

---

### Quality Batch Release

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 5 | Release readiness rollup, quality results, CoA status, deviations, decision history — complete decision-support picture |
| Interaction quality | 4 | Release queue selection drives all detail panels; view switching fluid; action panel present with 5 flows |
| Visual quality | 4 | Well-structured panels; colour-coded status; readiness signal grid is visually clear |
| Real-data readiness | 2 | No legacy-api proxy for quality system; all data mock |
| Cross-domain evidence reuse | 5 | Consumes trace, operations, warehouse, and SPC evidence — the richest cross-domain consumer |
| Action-flow realism | 3 | 5 action flows exist with forms and validation; all submit to console.info only |
| Drill-through behaviour | 3 | `open-trace-investigation` action navigates to trace workspace; no hold→warehouse drill-through |
| Loading / error / empty states | 3 | EvidencePanel used consistently across all panels |
| Source transparency | 3 | No source badge on quality-native panels (no legacy-api tier yet); cross-domain panels inherit from source |
| Pilot/demo credibility | 4 | The strongest demo-facing workspace; action submission to console is invisible to a business stakeholder |
| **Total** | **36 / 50** | |

---

### Operations Plan Risk

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 4 | 12 panels covering material shortages, quality blockers, line status, maintenance constraints — broad operational value |
| Interaction quality | 2 | No action flows; no drill-through from individual risk items to source workspaces |
| Visual quality | 3 | Individual panel visual quality likely good; full audit of schedule-adherence, yield-variance, shift-handover not completed |
| Real-data readiness | 2 | All mock; no legacy-api proxy for this cross-domain workspace |
| Cross-domain evidence reuse | 4 | Consumes warehouse staging, quality blockers, and maintenance constraints cross-domain panels |
| Action-flow realism | 1 | 0 action flows registered |
| Drill-through behaviour | 2 | No item-level drill-through to source workspaces (e.g., from material-shortage row to Warehouse 360) |
| Loading / error / empty states | 3 | EvidencePanel pattern used; cross-domain panels inherit from source adapters |
| Source transparency | 3 | Mock tier; no legacy-api wiring so source badges will show 'mock' throughout |
| Pilot/demo credibility | 3 | Strong for an overview role; falls short for a detailed operational walkthrough |
| **Total** | **27 / 50** | |

---

### Process Order Review

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 3 | Order header, progress bar, quality context, and execution timeline are useful; yield-losses and staging-context panels not fully verified |
| Interaction quality | 1 | View switching only; no action flows; no drill-through to Trace or Quality from order context |
| Visual quality | 3 | Order header and progress panels well-presented; progress bar with risk colour is effective |
| Real-data readiness | 2 | `getProcessOrderHeader` wired to V1 POH legacy-api but not browser-verified; all other methods mock |
| Cross-domain evidence reuse | 2 | Order quality context panel consumes quality domain data; no trace or warehouse cross-domain |
| Action-flow realism | 0 | 0 action flows; no ability to flag, escalate, or act on an order |
| Drill-through behaviour | 1 | No outbound drill-through when batchId is known; no link to trace investigation or quality workspace |
| Loading / error / empty states | 3 | EvidencePanel used; source badge present on process-order-header |
| Source transparency | 3 | Source badge on header panel; legacy-api tier correctly labelled as unverified in adapter JSDoc |
| Pilot/demo credibility | 2 | Operational read-only review is possible; absence of any follow-on action or drill-through limits demo value |
| **Total** | **20 / 50** | |

---

### Warehouse 360 Overview

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 4 | Summary KPIs, stock by zone (with capacity bars), open holds (hold type + age), goods movement feed, replenishment urgency — good operational picture |
| Interaction quality | 2 | View switching only; no action flows; open holds have no link to Quality workspace |
| Visual quality | 4 | Capacity progress bars, hold age highlighting (>24h red), urgency coding on replenishment — effective visual design |
| Real-data readiness | 2 | `getWarehouse360Summary` wired to V1 WH360 legacy-api but not browser-verified; all other methods mock |
| Cross-domain evidence reuse | 3 | Warehouse-hold-status panel consumed by Quality; `warehouse-evidence-adapter` shared; no inbound cross-domain panels |
| Action-flow realism | 0 | 0 action flows |
| Drill-through behaviour | 2 | No drill-through from holds to quality release case; no drill-through from replenishment to supplier or purchase order |
| Loading / error / empty states | 4 | Open-holds and replenishment panels have explicit empty states ("No open holds", "No replenishment needs") |
| Source transparency | 3 | Source badge on warehouse-360-summary panel; other panels not verified |
| Pilot/demo credibility | 3 | Strong panel set; missing hold→quality link is the main demo gap |
| **Total** | **27 / 50** | |

---

### Production Staging

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 4 | Readiness % and risk status, order-level staging progress, shortfalls with ETA, zone capacity, pick tasks, move requests — full staging picture |
| Interaction quality | 2 | View switching only; no action flows; no drill-through from shortfalls to Warehouse 360 |
| Visual quality | 4 | Progress bars, urgency badge borders, capacity colour coding, status badges — well-executed operational UI |
| Real-data readiness | 1 | No legacy-api proxy for WMS; all data mock |
| Cross-domain evidence reuse | 2 | Warehouse staging status exported to Operations Plan Risk; no inbound cross-domain |
| Action-flow realism | 0 | 0 action flows |
| Drill-through behaviour | 2 | Workspace-level navigation to Operations Plan Risk documented; no order-level drill-through |
| Loading / error / empty states | 3 | EvidencePanel used; pick-tasks and move-requests panels filter to active-only (implicit empty state) |
| Source transparency | 2 | Mock tier throughout; WMS source documented in registrations but no source badge |
| Pilot/demo credibility | 3 | Good operational breadth; action absence is visible gap |
| **Total** | **23 / 50** | |

---

### SPC Monitoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 3 | SPC summary KPIs and characteristic-capability panel are strong; control chart carries no readable data values |
| Interaction quality | 1 | View switching only; no action flows; no drill-through from signals to affected batches |
| Visual quality | 2 | Summary and capability panels look good; control chart is a 320×80px fixed SVG placeholder with no axis labels |
| Real-data readiness | 1 | All mock; no legacy-api proxy for SPC system |
| Cross-domain evidence reuse | 3 | `spc-signals-for-release` panel consumed by Quality Batch Release; reasonable cross-domain export |
| Action-flow realism | 0 | 0 action flows |
| Drill-through behaviour | 1 | No drill-through from SPC signals to affected batch or process order |
| Loading / error / empty states | 3 | EvidencePanel used throughout |
| Source transparency | 2 | Mock tier throughout; no source badge verified |
| Pilot/demo credibility | 2 | A quality engineer opening the chart view will see an unreadable placeholder — this is the highest single-panel credibility risk |
| **Total** | **19 / 50** | |

---

### Environmental Monitoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 4 | Site summary KPIs, zone risk tiles (heatmap), open alerts, swab results table, trends table, corrective actions — comprehensive |
| Interaction quality | 2 | View switching only; heatmap tiles not clickable; no action flows |
| Visual quality | 3 | Site summary and zone status visually strong; trends panel is a plain table (name implies chart); heatmap is a colour-coded grid (no spatial layout) |
| Real-data readiness | 2 | All mock; LIMS source documented |
| Cross-domain evidence reuse | 1 | No envmon panels consumed by other workspaces; envmon alerts appear on RoleAwareHome only as hardcoded constants |
| Action-flow realism | 0 | 0 action flows |
| Drill-through behaviour | 2 | No drill-through from alert to specific zone detail or corrective action |
| Loading / error / empty states | 3 | EvidencePanel used throughout |
| Source transparency | 2 | Mock tier; LIMS source documented in registration but no source badge confirmed |
| Pilot/demo credibility | 3 | Site summary and heatmap panels tell a coherent story; trends table name/appearance mismatch is noticeable |
| **Total** | **22 / 50** | |

---

### Maintenance & Reliability

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information usefulness | 3 | KPI summary, work orders (priority/impact coded), equipment availability (bars + target), reliability metrics (MTBF/MTTR/OEE) — solid read-only operational view |
| Interaction quality | 1 | View switching only; no action flows; no equipment drill-through |
| Visual quality | 3 | KPI tiles and equipment availability bars are effective; reliability metrics table with trend arrows is functional |
| Real-data readiness | 1 | All mock; SAP PM source documented |
| Cross-domain evidence reuse | 3 | `maintenance-constraint` panel consumed by Operations Plan Risk; reasonable cross-domain export |
| Action-flow realism | 0 | 0 action flows registered |
| Drill-through behaviour | 1 | No drill-through from equipment-availability to its open work orders |
| Loading / error / empty states | 3 | EvidencePanel used; open-work-orders has "No open work orders" empty state |
| Source transparency | 2 | Mock tier; SAP PM documented in registration |
| Pilot/demo credibility | 3 | Functional for a read-only maintenance dashboard; absence of any action is the main credibility gap |
| **Total** | **20 / 50** | |

---

## Summary ranking

### Strong enough for demo (score ≥ 32)

| Workspace | Score | Reason |
|-----------|-------|--------|
| Quality Batch Release | 36 / 50 | Richest cross-domain evidence; decision workflow represented; action forms present |
| Trace Investigation | 32 / 50 | Deep data coverage; browser-verified batch header; strong cross-domain export — weakened by absent graph |

### Needs light improvement (score 22–31)

| Workspace | Score | Primary improvement needed |
|-----------|-------|---------------------------|
| Operations Plan Risk | 27 / 50 | Item-level drill-through to source workspaces |
| Warehouse 360 Overview | 27 / 50 | Hold → Quality navigation link; source badges |
| Production Staging | 23 / 50 | At least one action flow; shortfall → stock link |
| Environmental Monitoring | 22 / 50 | Trends panel visual; envmon alerts as cross-domain signal |

### Needs substantial improvement (score < 22)

| Workspace | Score | Primary improvement needed |
|-----------|-------|---------------------------|
| Process Order Review | 20 / 50 | Trace drill-through when batchId present; any action flow |
| Maintenance & Reliability | 20 / 50 | Equipment → work order drill-through; any action flow |
| SPC Monitoring | 19 / 50 | Control chart upgrade from placeholder SVG to readable chart |

### Architecture only / placeholder-heavy

None — all 9 workspaces have functional panels and working mock adapters. No workspace is a bare registration stub.
