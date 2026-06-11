# Functional Preservation Inventory — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Auditor:** Derived from codebase inspection. Original V1 app source not directly accessible; original capability is inferred from `sourceOwnership` fields (systemName, legacyAppId) in panel registrations and from documented proxy endpoints.

**Scoring key for functional coverage (0–5):**

| Score | Meaning |
|-------|---------|
| 0 | Registered route or workspace stub only; no user-facing content |
| 1 | Shell renders; panels are placeholders or absent |
| 2 | Some panels functional; core visualisation absent or mock shape only |
| 3 | Substantial panel coverage; meaningful operational information; one or more critical panels missing or placeholder |
| 4 | Good coverage; all primary views functional; minor panel gaps or no action-flow backend |
| 5 | Complete for intended JTBD; action flows wired; cross-domain evidence consumed |

> **Counting rule:** A panel counts toward coverage only if it renders meaningful operational information from adapter data. A registered route, a placeholder SVG with no labels, or a component body that renders only static text does not count.

---

## 1. Trace Investigation

| Field | Detail |
|-------|--------|
| **Workspace ID** | `trace-investigation` |
| **Lifecycle** | Live |
| **Intended JTBD** | Determine the scope and impact of a quality event — which batches, customers, and suppliers are affected — and assess recall readiness |
| **Original app/source** | Trace2 (SAP-adjacent batch lineage system); legacy-api endpoint `/api/trace2/batch-header` confirmed |
| **Current V2 views** | 7: overview · trace-tree · mass-balance · customer-exposure · supplier-exposure · timeline-events · recall-readiness |
| **Current V2 panels** | 8 active: batch-header · risk-signals · trace-graph *(placeholder — renders text list, not graph)* · customer-impact · coa-release-status · event-timeline · material-supplier-exposure · related-investigations |
| **Action flows** | 0 meaningful (4 action components registered but no backend mutation; console.log only) |
| **Data source tier** | `legacy-api` for `getBatchHeaderSummary` (browser-verified); all other methods `mock` |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | TraceGraphPanel renders a risk-badge text list, not a node-edge graph — the primary visualisation of this workspace is absent. BatchLineagePanel is a text summary only. No action flows wired to backend. No drill-through into a specific Quality release case from the trace context. |
| **Risk to pilot/demo credibility** | **High** — a stakeholder expecting lineage tree visualisation will see a list. The workspace is otherwise the most data-rich in the prototype. |
| **Recommended remediation** | Replace TraceGraphPanel with an SVG node-edge graph using existing mock data. Wire the four action stubs to log structured intent (escalate/resolve/add-evidence). Add `navigateToWarehouse360` link when batchId is known. |

---

## 2. Quality Batch Release

| Field | Detail |
|-------|--------|
| **Workspace ID** | `quality-batch-release` |
| **Lifecycle** | Live |
| **Intended JTBD** | Manage the end-to-end quality release decision for a production batch — review evidence, resolve blockers, and issue or withhold a release decision |
| **Original app/source** | SAP QM-adjacent quality management system; no direct V1 proxy endpoint wired yet |
| **Current V2 views** | 6: release-queue · batch-decision · quality-evidence · operations-evidence · warehouse-trace-evidence · decision-history |
| **Current V2 panels** | 10 primary + 4 cross-domain consumers: release-queue · release-summary · quality-results · coa-readiness · deviations · decision-history · quality-blockers · release-hold-impact · plus trace-exposure / warehouse-hold-status / spc-signals / process-order-evidence from other domains |
| **Action flows** | 5 registered: release-batch · place-on-hold · request-retest · escalate-deviation · open-trace-investigation — all submit to `console.info` only |
| **Data source tier** | `mock` — no legacy-api proxy wired; quality system not yet in proxy layer |
| **Functional coverage score** | **4 / 5** |
| **Main gaps** | Action flows write to console only (no backend mutation). No legacy-api endpoint for quality data. Release summary's "recommended action" field is a single static value with no logic behind it. SPC signals panel depth unknown (cross-domain consumer). |
| **Risk to pilot/demo credibility** | **Medium** — all panels render meaningful data; the decision workflow is representable in a demo with mock data. Release action submitting to console is visible to a developer but not a business stakeholder. |
| **Recommended remediation** | Wire the `open-trace-investigation` action to `navigateToTraceInvestigation(batchId)` where batchId is known. Add batch-level drill-through from the release-hold-impact panel to Warehouse 360. |

---

## 3. Operations Plan Risk

| Field | Detail |
|-------|--------|
| **Workspace ID** | `operations-plan-risk` |
| **Lifecycle** | Live |
| **Intended JTBD** | Give a shift manager or production planner a cross-domain view of risks threatening the current production plan — material shortages, quality blockers, warehouse staging gaps, line constraints, and maintenance issues |
| **Original app/source** | Inferred cross-domain aggregation (no single V1 app maps to this workspace; sources are SAP PP/QM/WM/PM) |
| **Current V2 views** | 7: plan-overview · critical-blockers · material-staging-risk · quality-release-blockers · line-resource-risk · schedule-adherence · handover-actions |
| **Current V2 panels** | 12: plan-risk-summary · late-orders · material-shortage · quality-blockers · warehouse-staging-status · line-status · operations-action-queue · release-hold-impact · maintenance-constraint · yield-variance · schedule-adherence · shift-handover |
| **Action flows** | 0 |
| **Data source tier** | `mock` throughout; cross-domain panels source from their respective domain adapters (also mock) |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | No action flows. Panels not individually audited for depth (schedule-adherence, yield-variance, shift-handover may be lighter). No drill-through from individual risk items to their source workspaces (e.g., from material-shortage row to Warehouse 360 stock view). Cross-domain links are data-read only, not navigational. |
| **Risk to pilot/demo credibility** | **Medium** — the breadth of 12 panels across 7 views is strong; without individual item drill-throughs it reads as a summary dashboard rather than a working operations tool. |
| **Recommended remediation** | Add `navigateToWarehouse360('stock-status')` link from material-shortage panel items. Add `navigateToTraceInvestigation(batchId)` from late-orders panel where batchId is available. Verify depth of schedule-adherence, yield-variance, and shift-handover panels. |

---

## 4. Process Order Review

| Field | Detail |
|-------|--------|
| **Workspace ID** | `process-order-review` |
| **Lifecycle** | Pilot |
| **Intended JTBD** | Let a production supervisor review the status, progress, and quality context of a single process order — confirm confirmations, check delays, and understand linked quality or staging issues |
| **Original app/source** | V1 POH (Process Order History) system; legacy-api endpoint `/api/por/order-header` wired but not browser-verified |
| **Current V2 views** | 6: order-overview · execution-timeline · yield-losses · quality-context · staging-context · related-batches |
| **Current V2 panels** | 6: process-order-header · order-progress · execution-timeline · order-quality-context · order-staging-context · related-batch-context |
| **Action flows** | 0 |
| **Data source tier** | `legacy-api` for `getProcessOrderHeader` (wired, not verified); all other methods `mock` |
| **Functional coverage score** | **2 / 5** |
| **Main gaps** | Only 6 panels vs 7 views — yield-losses view may render an empty or minimal panel set. No cross-domain drill-through to Trace Investigation when a batchId is present on the order. Order-staging-context and related-batch-context panels not verified for functional depth. No action flows to escalate or flag an order. The workspace is useful for read-only review but does not allow any follow-on action. |
| **Risk to pilot/demo credibility** | **Medium-high** — the order header and progress panels are functionally credible; the lack of a trace link for an order with a known batchId is a visible gap in a demo where a quality question would naturally follow process order review. |
| **Recommended remediation** | Add `navigateToTraceInvestigation(batchId)` button in the process-order-header or quality-context panel when `batchId` is present. Verify depth of order-staging-context and related-batch-context panels. Add at minimum one action stub (e.g., "Flag for review"). |

---

## 5. Warehouse 360 Overview

| Field | Detail |
|-------|--------|
| **Workspace ID** | `warehouse-360` |
| **Lifecycle** | Pilot |
| **Intended JTBD** | Give a warehouse manager a complete operational view of a warehouse — stock status, open holds, pending goods movements, capacity pressure, and replenishment needs |
| **Original app/source** | V1 WH360 (Warehouse 360) system; legacy-api endpoint `/api/wh360/warehouse-summary` wired but not browser-verified |
| **Current V2 views** | 5: warehouse-overview · stock-status · holds-management · goods-movements · replenishment |
| **Current V2 panels** | 6: warehouse-360-summary · stock-overview · open-holds · goods-movement-activity · replenishment-needs · location-capacity |
| **Action flows** | 0 |
| **Data source tier** | `legacy-api` for `getWarehouse360Summary` (wired, not verified); all other methods `mock` |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | No drill-through from open-holds panel to the relevant Quality Batch Release case (navigation API requires `releaseCaseId` which is not present in `OpenHoldItem`). Location-capacity panel depth not verified. No cross-domain links to Quality workspace from holds. No action flows. |
| **Risk to pilot/demo credibility** | **Medium** — summary, stock-overview, holds, goods-movement, and replenishment panels are all functionally credible. The missing hold-to-quality link is noticeable in a demo but not blocking. |
| **Recommended remediation** | Add `navigateToWarehouse360('holds-management')` or `setWorkspace('quality-batch-release')` navigation link on each hold item in open-holds panel. Verify location-capacity panel depth. Add source badge to all panels that use the warehouse-360 adapter. |

---

## 6. Production Staging

| Field | Detail |
|-------|--------|
| **Workspace ID** | `production-staging` |
| **Lifecycle** | Live |
| **Intended JTBD** | Give a staging coordinator visibility of which orders are staged, what pick tasks are open, what shortfalls exist, and what moves are in progress — enabling proactive staging management before a production run |
| **Original app/source** | WMS (Warehouse Management System) — inferred from sourceOwnership; no direct V1 proxy endpoint |
| **Current V2 views** | 6: staging-overview · order-staging · shortfalls · zone-capacity · picking-waves · move-requests |
| **Current V2 panels** | 8: staging-readiness-summary · staging-order-list · staging-pick-tasks · staging-zone-capacity · staging-shortfalls · staging-move-requests · staging-picking-waves · staging-alerts |
| **Action flows** | 0 |
| **Data source tier** | `mock` throughout (no legacy-api proxy; WMS not in proxy layer) |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | No drill-through from individual staging orders to the Operations Plan Risk workspace for that order. No drill-through from shortfalls to Warehouse 360 stock view to see alternative stock availability. No action flows (no ability to escalate a shortfall, acknowledge an alert, or create a move request). All data mock — no WMS wiring. |
| **Risk to pilot/demo credibility** | **Medium** — the eight panels provide good operational depth; the main demo risk is the absence of any action flow (a staging coordinator would need to do something when they see a shortfall or blocked order). |
| **Recommended remediation** | Add a "View stock availability" link from shortfalls to Warehouse 360. Add `navigateToOperationsPlanRisk` link from the readiness summary when a blocked order is present. Add at least one staging alert acknowledgement action. |

---

## 7. SPC Monitoring

| Field | Detail |
|-------|--------|
| **Workspace ID** | `spc-monitoring` |
| **Lifecycle** | Pilot |
| **Intended JTBD** | Allow a quality engineer to monitor in-process statistical process control charts for out-of-control signals, review characteristic capability, and investigate alarms — enabling early detection of process drift |
| **Original app/source** | SPC system (LIMS or dedicated SPC tool) — inferred from sourceOwnership |
| **Current V2 views** | 6: chart-overview · active-signals · characteristic-review · capability · alarm-history · chart-configuration-readonly |
| **Current V2 panels** | 7: spc-summary · active-spc-signals · control-chart *(placeholder SVG)* · characteristic-capability · spc-alarm-history · spc-related-batches · spc-signals-for-release |
| **Action flows** | 0 |
| **Data source tier** | `mock` throughout |
| **Functional coverage score** | **2 / 5** |
| **Main gaps** | ControlChartPanel is a 320×80px hand-rolled SVG placeholder with no x-axis date labels, no y-axis labels, and no readable data values — the core visualisation of an SPC workspace is non-functional for a real quality engineer. Characteristic-capability panel is functionally strong (Cp/Cpk/Pp/Ppk) but is supporting context without the chart. Active-signals and alarm-history panels not individually verified for depth. No action flows. |
| **Risk to pilot/demo credibility** | **High** — when a stakeholder opens "SPC Monitoring" they expect to see control charts. The current placeholder will undermine the workspace's credibility even if the summary and capability panels are correct. |
| **Recommended remediation** | Upgrade ControlChartPanel SVG to show x-axis date labels, y-axis value scale, properly sized data points with status colours, and UCL/LCL/mean reference lines with value annotations. This does not require an external charting library — a larger SVG viewBox with labelled axes is sufficient. |

---

## 8. Environmental Monitoring

| Field | Detail |
|-------|--------|
| **Workspace ID** | `envmon-monitoring` |
| **Lifecycle** | Live |
| **Intended JTBD** | Allow a quality or hygiene manager to monitor environmental microbiology sampling compliance, identify high-risk zones, review corrective actions, and track trends over time |
| **Original app/source** | LIMS (Laboratory Information Management System) — confirmed via `sourceOwnership.systemName = 'lims'` |
| **Current V2 views** | 7: scope-overview · plant-monitoring · heatmap · alerts · swab-vectors · trends · corrective-actions |
| **Current V2 panels** | 8: envmon-site-summary · envmon-zone-status · envmon-alerts · envmon-heatmap *(CSS grid, not a floor plan)* · envmon-swab-vectors · envmon-swab-results · envmon-trends *(table, not a trend chart)* · envmon-corrective-actions |
| **Action flows** | 0 |
| **Data source tier** | `mock` throughout |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | EnvMonTrendsPanel renders as a 5-column table (date / samples / positives / rate / compliance %) — there is no trend line, sparkline, or bar chart; the panel name promises something it does not deliver visually. EnvMonHeatmapPanel uses a CSS-grid of colour-coded cards — not a floor plan; zone spatial layout is not represented. No cross-domain evidence sharing from envmon to other workspaces (envmon data not consumed by quality or operations). No corrective action drill-through or action flow. |
| **Risk to pilot/demo credibility** | **Medium** — site summary and zone status panels are functional and well-presented. The trends and heatmap panels will draw a stakeholder's attention as the most expected visuals in an environmental monitoring workspace — both fall short of expectation. |
| **Recommended remediation** | Add an SVG bar or sparkline visualisation to EnvMonTrendsPanel (above the existing table, not replacing it). Consider upgrading heatmap to include zone labels and a risk-score axis. Add envmon high-risk zones as a cross-domain signal to RoleAwareHome. |

---

## 9. Maintenance & Reliability

| Field | Detail |
|-------|--------|
| **Workspace ID** | `maintenance-reliability` |
| **Lifecycle** | Pilot |
| **Intended JTBD** | Give a maintenance engineer or reliability manager a view of open work orders, equipment availability, preventive maintenance schedule adherence, and reliability metrics — enabling proactive maintenance management |
| **Original app/source** | SAP PM (Plant Maintenance) — inferred from sourceOwnership |
| **Current V2 views** | 5: maintenance-overview · work-orders · preventive-maintenance · equipment-availability · backlog |
| **Current V2 panels** | 6–7: maintenance-kpi-summary · open-work-orders · preventive-maintenance-schedule · equipment-availability · reliability-metrics · maintenance-backlog · maintenance-constraint *(cross-domain, consumed by Operations Plan Risk)* |
| **Action flows** | 0 |
| **Data source tier** | `mock` throughout |
| **Functional coverage score** | **3 / 5** |
| **Main gaps** | PM schedule and maintenance-backlog panels not individually verified for functional depth. No drill-through from equipment-availability panel to open work orders for that equipment. Reliability metrics show MTBF/MTTR/OEE but no trend history chart. No action flow to raise a work order or escalate an equipment fault. Maintenance data feeds Operations Plan Risk (via maintenance-constraint cross-domain panel) but not vice versa. |
| **Risk to pilot/demo credibility** | **Medium** — KPI summary, work orders, equipment availability, and reliability metrics panels provide good depth for a maintenance-focused demo. The absence of any action flow to escalate or raise a WO is the primary credibility gap. |
| **Recommended remediation** | Add `navigateToMaintenanceReliability('work-orders')` link from equipment-availability panel for equipment with open WOs. Verify PM schedule panel depth. Add a sparkline or bar to reliability metrics for trend visibility. |
