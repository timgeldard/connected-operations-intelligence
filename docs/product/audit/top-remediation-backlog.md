# Top Remediation Backlog — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Functional credibility improvements only — no new phases, governance dashboards, or operational workspaces.

**Effort scale:** S = half-day or less · M = 1–2 days · L = 3+ days  
**Priority:** P1 = highest operational value and lowest risk · P3 = valuable but lower urgency

---

## REM-001 — Upgrade SPC Control Chart from placeholder SVG to readable chart

| Field | Detail |
|-------|--------|
| **Workspace / domain** | SPC Monitoring / spc |
| **User value** | A quality engineer reviewing SPC charts can currently see a 320×80px SVG with no x-axis dates, no y-axis values, and no readable data points. Upgrading to a properly labelled SVG — x-axis showing sample dates, y-axis showing the measured value, UCL/LCL/mean reference lines with value annotations — makes the panel operationally credible without any new library dependency. |
| **Current problem** | `control-chart-panel.tsx` uses a hard-coded `ChartPlaceholder` component (320×80px, 26 fixed data points) with no axis labels, no value scale, and no date display. The upgrade path is documented in the source: "replace with recharts/nivo". No charting library is installed; the fix must use SVG. |
| **Recommended fix** | Rewrite `ChartPlaceholder` as an inline SVG with a computed viewBox, labelled x-axis (5–6 date ticks from the mock data), labelled y-axis (value scale derived from UCL + buffer), UCL/LCL/mean reference lines with numeric annotations, and properly sized data-point circles. Retain existing status-colour coding. |
| **Files likely affected** | `domain-integrations/spc/src/panels/control-chart-panel.tsx` |
| **Data dependency** | Existing mock data (`SPCControlChartData` with `dataPoints`, `ucl`, `lcl`, `centerLine`) — no new data needed |
| **Safe without V1/Databricks** | Yes — pure UI change to existing mock-backed panel |
| **Effort** | M |
| **Risk** | Low — no adapter changes; no new dependencies; existing test structure preserved |
| **Priority** | P1 |

---

## REM-002 — Add trend visualisation to EnvMon Trends panel

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Environmental Monitoring / envmon |
| **User value** | A quality or hygiene manager opening the Trends view expects a visual trend chart. The current panel renders a plain 5-column table (date · samples · positives · rate · compliance). Adding an SVG bar or sparkline chart above the table — using the existing data — transforms a data table into an operational trend story. |
| **Current problem** | `envmon-trends-panel.tsx` is named "Environmental Trends" and declared `lifecycle: 'live'` but renders only a tabular grid. No trend line, bar chart, sparkline, or visual encoding of the positive-rate series over time exists. |
| **Recommended fix** | Add an SVG bar chart above the existing table, showing positive-rate (%) per date as coloured bars (green/amber/red by threshold). Bars are computed from the existing `EnvMonTrendEntry[]` mock data. The table stays below as the detail view. The chart must be at least 240px wide × 80px tall. |
| **Files likely affected** | `domain-integrations/envmon/src/panels/envmon-trends-panel.tsx` |
| **Data dependency** | Existing mock data (`EnvMonTrendEntry[]` with `date`, `positiveRate`, `complianceRate`) — no new data needed |
| **Safe without V1/Databricks** | Yes — additive SVG visualization; no adapter changes |
| **Effort** | S |
| **Risk** | Low — additive change; table below is preserved |
| **Priority** | P1 |

---

## REM-003 — Add Trace Investigation section to RoleAwareHome

| Field | Detail |
|-------|--------|
| **Workspace / domain** | RoleAwareHome / shell |
| **User value** | The home screen shows Quality, Ops Risk, EnvMon, Staging, SPC, Warehouse, and Maintenance quick-access tiles — but nothing for Trace Investigation, which is the most distinctive and demonstration-critical workspace. A user arriving on the home page has no home-screen entry point to trace. |
| **Current problem** | `RoleAwareHome.tsx` contains 6–7 hardcoded mock constant arrays. None covers trace investigations. The `navigateToTraceInvestigation` function is available in `useWorkspaceShellState`. Mock data also uses mixed 2024/2026 dates (inconsistent era). |
| **Recommended fix** | (1) Add a `MOCK_RECENT_INVESTIGATIONS` constant (2–3 items, 2026-05 dates) to RoleAwareHome and render a "Recent Investigations" section alongside the other domain sections. Each item links via `navigateToTraceInvestigation(investigationId)`. (2) Normalise all existing mock constant dates to 2026-05. |
| **Files likely affected** | `apps/web/src/pages/RoleAwareHome.tsx` |
| **Data dependency** | No adapter changes needed — mock constants only |
| **Safe without V1/Databricks** | Yes — mock constants and existing navigation API |
| **Effort** | S |
| **Risk** | Low — additive section; no existing sections removed |
| **Priority** | P1 |

---

## REM-004 — Add trace drill-through from Process Order Review when batchId is present

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Process Order Review / operations |
| **User value** | A production supervisor reviewing an order that has a linked batchId should be able to jump directly to the trace investigation for that batch. Currently there is no link; the supervisor must manually navigate to trace-investigation and enter the batchId. |
| **Current problem** | `ProcessOrderHeaderPanel` renders the `batchId` field as a static display value. `useWorkspaceShellState` provides `navigateToTraceInvestigation(batchId)`. The connection is not made. |
| **Recommended fix** | In `process-order-header-panel.tsx`, when `data.batchId` is defined, render a small "View in Trace" link/button alongside the Batch field that calls `navigateToTraceInvestigation(data.batchId)`. Use the existing `useWorkspaceShellState` hook. |
| **Files likely affected** | `domain-integrations/operations/src/panels/process-order-header-panel.tsx` |
| **Data dependency** | None — `batchId` is already present in `ProcessOrderHeader` contract and mock data |
| **Safe without V1/Databricks** | Yes — no adapter changes; uses existing navigation hook |
| **Effort** | S |
| **Risk** | Low — additive UI only; no data contract change |
| **Priority** | P2 |

---

## REM-005 — Add "View stock availability" link from Production Staging shortfalls to Warehouse 360

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Production Staging / warehouse |
| **User value** | A staging coordinator who sees a material shortfall should be able to check whether alternative stock exists in a different zone or bin — which is a Warehouse 360 question. Currently there is no link; they must exit staging, navigate to warehouse, and search manually. |
| **Current problem** | `staging-shortfalls-panel.tsx` renders shortfall items with material ID, urgency, and expected ETA, but provides no cross-workspace navigation. `useWorkspaceShellState.navigateToWarehouse360('stock-status')` is available. |
| **Recommended fix** | Add a "Check stock" navigation link on each shortfall item that calls `navigateToWarehouse360('stock-status')`. The link should be subtle (small secondary button or text link) and appear only on non-in-stock items. |
| **Files likely affected** | `domain-integrations/warehouse/src/panels/staging-shortfalls-panel.tsx` |
| **Data dependency** | None — navigation API only |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S |
| **Risk** | Low |
| **Priority** | P2 |

---

## REM-006 — Replace RoleAwareHome hardcoded arrays with adapter React Query hooks

| Field | Detail |
|-------|--------|
| **Workspace / domain** | RoleAwareHome / shell |
| **User value** | A stakeholder navigating to the home screen and then to a workspace will notice the data does not match if the home screen uses different hardcoded fixtures than the workspace adapters. Calling the same mock adapters on the home screen makes data consistent across the prototype. |
| **Current problem** | `RoleAwareHome.tsx` uses 6–7 inline `const` arrays. Each workspace has a working React Query hook (e.g., `useSPCSummary`, `useEnvMonSiteSummary`). These hooks are never called from the home screen. |
| **Recommended fix** | Replace each hardcoded constant with a call to the appropriate workspace adapter hook. Home screen shows the same data as the workspace. Loading/error states handled via EvidencePanel pattern or simple null-guards. |
| **Files likely affected** | `apps/web/src/pages/RoleAwareHome.tsx`; adapter query files remain unchanged |
| **Data dependency** | All domain adapters already have relevant summary/signal query hooks |
| **Safe without V1/Databricks** | Yes — adapters return mock data; home screen would also show mock data |
| **Effort** | M |
| **Risk** | Medium — touches RoleAwareHome significantly; requires correct hook selection for each section |
| **Priority** | P2 |

---

## REM-007 — Replace TraceGraphPanel text list with SVG node-edge graph

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Trace Investigation / traceability |
| **User value** | The trace-investigation workspace is the most conceptually distinctive workspace. Its primary visualisation panel currently renders a risk-badge text list with upstream/downstream counts. An SVG node-edge graph of the batch lineage tree would transform the workspace from "interesting data tables" to "visual lineage tool". |
| **Current problem** | `trace-graph-panel.tsx` renders a list of risk badges and count labels. Mock data already includes `nodes`, `edges`, `depth`, `upstreamCount`, `downstreamCount`. No charting library is installed. |
| **Recommended fix** | Implement an SVG-based layered node-edge graph. Nodes rendered as `<rect>` with `<text>`; edges as `<line>` or `<path>` with direction arrows. Layout: root at top, upstream above, downstream below. Colour nodes by risk level. No pan/zoom required for prototype. |
| **Files likely affected** | `domain-integrations/traceability/src/panels/trace-graph-panel.tsx` |
| **Data dependency** | Existing `TraceGraphData` mock with `nodes[]` and `edges[]` — no new data |
| **Safe without V1/Databricks** | Yes — pure UI; mock data has complete graph structure |
| **Effort** | L |
| **Risk** | Medium — SVG graph layout is non-trivial; needs tests for edge cases (empty graph, single node) |
| **Priority** | P2 |

---

## REM-008 — Add source badge to all panels using the Warehouse 360 and POH adapters

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Warehouse 360, Process Order Review / warehouse, operations |
| **User value** | Source transparency — users and evaluators should be able to see at a glance whether a panel is showing `mock` or `legacy-api` data. The `source` field is present on `AdapterResult` and `EvidencePanel` accepts a `source` prop, but not all panels pass it through. |
| **Current problem** | Several panels in Warehouse 360 and Process Order Review do not pass `source={result?.source}` to their `<EvidencePanel>` wrapper. The `process-order-header` and `warehouse-360-summary` panels do have it; others in the same workspace may not. |
| **Recommended fix** | Audit each panel in warehouse and operations domains: confirm or add `source={result?.source}` on every `<EvidencePanel>`. No data contract changes needed. |
| **Files likely affected** | `domain-integrations/warehouse/src/panels/*.tsx`, `domain-integrations/operations/src/panels/*.tsx` |
| **Data dependency** | None — `source` is already on `AdapterResult` |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S |
| **Risk** | Low |
| **Priority** | P2 |

---

## REM-009 — Add equipment-to-work-orders drill-through in Maintenance

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Maintenance & Reliability / maintenance |
| **User value** | A maintenance engineer viewing the equipment-availability panel can see that a piece of equipment has open work orders, but cannot click through to see them. Adding a "View work orders" link that navigates to `maintenance-reliability` with the work-orders view filtered by that equipment ID would complete the drill-through loop. |
| **Current problem** | `equipment-availability-panel.tsx` shows per-equipment availability bars and open WO count, but provides no navigation to the work orders for that equipment. |
| **Recommended fix** | Add a "View WOs" text link on each equipment row that calls `setWorkspace('maintenance-reliability')` and passes a filter param. (Full cross-panel filter wiring is complex; a minimum viable version can navigate to the work-orders view with the equipment selected in the URL params.) |
| **Files likely affected** | `domain-integrations/maintenance/src/panels/equipment-availability-panel.tsx`, `apps/web/src/shell/useWorkspaceShellState.ts` (if new param needed) |
| **Data dependency** | None |
| **Safe without V1/Databricks** | Yes |
| **Effort** | M |
| **Risk** | Medium — may require URL param extension in shell state |
| **Priority** | P2 |

---

## REM-010 — Add hold-to-quality navigation from Warehouse 360 open holds

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Warehouse 360 / warehouse |
| **User value** | A warehouse manager reviewing a quality hold should be able to open the relevant quality workspace to see the release decision status. Currently the `navigateToBatchRelease` API requires a `releaseCaseId`, which is not present on `OpenHoldItem`. The minimum viable alternative is to navigate to the quality workspace root. |
| **Current problem** | `open-holds-panel.tsx` renders hold reason, batch, age, and material — but provides no link to the quality workspace. The `releaseCaseId` is absent from the hold item data contract, blocking a direct case-level drill-through. |
| **Recommended fix** | On each hold item, add a "Check release queue" text link that calls `setWorkspace('quality-batch-release')`. This navigates the user to the release queue where they can find the relevant batch. Longer term: extend `OpenHoldItem` contract to include `releaseCaseId` if available from the WH360 API. |
| **Files likely affected** | `domain-integrations/warehouse/src/panels/open-holds-panel.tsx` |
| **Data dependency** | None for workspace navigation; `releaseCaseId` would require contract extension for direct case link |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S |
| **Risk** | Low |
| **Priority** | P2 |

---

## REM-011 — Verify and improve depth of SPC active-signals and alarm-history panels

| Field | Detail |
|-------|--------|
| **Workspace / domain** | SPC Monitoring / spc |
| **User value** | The SPC workspace relies heavily on the control chart view. If the active-signals and alarm-history panels are thin, the workspace has almost nothing to show in a demo once the chart placeholder is noticed. |
| **Current problem** | Active-spc-signals and spc-alarm-history panels have not been individually audited for functional depth. They may render only basic text with no drill-through or filtering. |
| **Recommended fix** | Read and assess both panels. If they are thin (e.g., a flat list with no sortable columns, no filter, no link to the affected batch), improve them to show at minimum: signal type, rule violated, characteristic name, batch link, timestamp, and severity badge. |
| **Files likely affected** | `domain-integrations/spc/src/panels/active-spc-signals-panel.tsx`, `domain-integrations/spc/src/panels/spc-alarm-history-panel.tsx` |
| **Data dependency** | Existing mock data |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S–M |
| **Risk** | Low |
| **Priority** | P2 |

---

## REM-012 — Add EnvMon alerts as cross-domain signal to other workspaces

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Environmental Monitoring / envmon |
| **User value** | Critical environmental alerts (e.g., a high-risk zone with a positive exceeding the action level) are operationally relevant to quality and production. Currently envmon data appears only on the home screen as a hardcoded array — there is no cross-domain evidence panel from envmon consumed by quality or operations. |
| **Current problem** | No `envmon-evidence-adapter` or cross-domain panel is exported from the envmon domain. Other workspaces cannot consume environmental risk signals. |
| **Recommended fix** | Create an `envmon-alert-panel` (or repurpose `envmon-zone-status` panel) with `allowedConsumerWorkspaces: ['quality-batch-release', 'operations-plan-risk']`. Add it to the operations-evidence view of quality and the critical-blockers view of operations plan risk. |
| **Files likely affected** | `domain-integrations/envmon/src/panels/` (new or repurposed panel), quality and operations workspace view configs |
| **Data dependency** | Existing envmon mock adapter |
| **Safe without V1/Databricks** | Yes |
| **Effort** | M |
| **Risk** | Medium — requires new cross-domain panel registration and workspace view config changes |
| **Priority** | P3 |

---

## REM-013 — Improve EnvMon heatmap from colour-coded tiles to zone-labelled risk grid

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Environmental Monitoring / envmon |
| **User value** | The current heatmap renders a sorted list of colour-coded cards. While functional as a risk ranking, it does not convey any spatial layout. Adding zone labels (zone type, area code), sample count, and a more grid-like layout would improve information density and stakeholder credibility. |
| **Current problem** | `envmon-heatmap-panel.tsx` is a CSS grid of cards sorted by risk score. Zone names are shown but spatial grouping (by hygiene zone type or production area) is absent. |
| **Recommended fix** | Group cards by `hygieneZone` type. Within each group, sort by risk score descending. Add a section header for each hygiene zone. Display positive/sample count more prominently. No floor plan geometry required. |
| **Files likely affected** | `domain-integrations/envmon/src/panels/envmon-heatmap-panel.tsx` |
| **Data dependency** | Existing mock data |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S |
| **Risk** | Low |
| **Priority** | P3 |

---

## REM-014 — Verify Operations Plan Risk schedule-adherence, yield-variance, and shift-handover panel depths

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Operations Plan Risk / operations |
| **User value** | Three of the twelve Operations Plan Risk panels (schedule-adherence, yield-variance, shift-handover) have not been individually audited. If they are thin, the workspace's high panel count overstates its functional coverage. |
| **Current problem** | Not individually read during this audit. They may contain substantive data or may be shallow text summaries. |
| **Recommended fix** | Read each panel. If any renders only a static text block or a single number, improve to at minimum: (a) a table of orders vs schedule, (b) yield by order with variance %, or (c) shift summary with open items list. |
| **Files likely affected** | `domain-integrations/operations/src/panels/schedule-adherence-panel.tsx`, `yield-variance-panel.tsx`, `shift-handover-panel.tsx` |
| **Data dependency** | Existing mock data |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S per panel |
| **Risk** | Low |
| **Priority** | P3 |

---

## REM-015 — Add empty/error state consistency audit and fixes across all pilot workspaces

| Field | Detail |
|-------|--------|
| **Workspace / domain** | Process Order Review, SPC Monitoring, Maintenance & Reliability / all pilot workspaces |
| **User value** | A pilot user who loads a workspace with no data (e.g., no processOrderId selected, or a plant with no SPC alarms) should see a meaningful empty state, not a blank panel or a spinner that never resolves. Consistent empty states increase prototype credibility in a structured pilot session. |
| **Current problem** | Some panels in pilot workspaces (process-order-review, spc-monitoring, maintenance-reliability) likely show a loading spinner or a blank EvidencePanel body when the request parameters produce no data from the mock adapter, rather than an explicit "No data for the current selection" message. |
| **Recommended fix** | For each panel in the three pilot workspaces, verify that the no-data path (when `result?.ok && !data`) renders a styled empty state message (not blank). Update any that do not. The pattern should follow existing examples: "No open work orders." / "No replenishment needs." |
| **Files likely affected** | `domain-integrations/spc/src/panels/*.tsx`, `domain-integrations/operations/src/panels/*.tsx` (POR only), `domain-integrations/maintenance/src/panels/*.tsx` |
| **Data dependency** | None |
| **Safe without V1/Databricks** | Yes |
| **Effort** | S–M total |
| **Risk** | Low |
| **Priority** | P3 |
