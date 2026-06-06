# Top 10 Operational Remediation Backlog — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Operational product credibility — items that most limit the prototype's ability to demonstrate real product value to stakeholders

---

## Prioritisation criteria

Items ranked by: operational impact × effort ratio. High-impact, low-effort items rank first. Effort is relative to this codebase only — the adapter async surface is already correct, so wiring is primarily a backend task.

| Field | Values |
|-------|--------|
| Impact | High / Medium / Low — effect on demonstration credibility |
| Effort | Low / Medium / High — implementation complexity |
| Ref | Corresponding technical debt ID |

---

## Backlog

### OP-001 — Wire RoleAwareHome to real workspace adapter data

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Low |
| Ref | TD-012 |
| Severity | High |

**Problem:** The home screen displays 8 hardcoded arrays (plan risk items, priority releases, EM alerts, SPC signals, warehouse holds, maintenance work orders). When a stakeholder navigates there, they see the same fixed data every session — no connection to the rest of the workspace adapters.

**Remediation:** Replace the 8 hardcoded constants with calls to the existing React Query hooks from each domain adapter. The adapters already expose the data; the home screen just needs to call them. This does not require backend wiring — it will use the same mock data as the workspaces, but at least the home screen and workspace will show consistent figures.

**Definition of done:** Home screen data matches what is shown in each workspace. No hardcoded arrays remain.

---

### OP-002 — Replace TraceGraphPanel placeholder with React Flow graph

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-005 |
| Severity | High |

**Problem:** The trace-investigation workspace is the most conceptually compelling workspace. Its graph panel renders a text list of risk badges. A stakeholder expecting to see an upstream/downstream lineage graph sees a list. This is the highest-visibility placeholder in the product.

**Remediation:** Install React Flow (or equivalent). Replace `trace-graph-panel.tsx` rendering logic with a node-edge graph. Mock data already includes `nodes`, `edges`, `depth`, `upstreamCount`, `downstreamCount` — the data model is ready. Graph renders from mock data first; backend wiring is separate.

**Definition of done:** Graph panel renders an interactive node-edge diagram from `mockTraceGraph` data. Nodes are colour-coded by risk level using CSS tokens.

---

### OP-003 — Wire quality-batch-release action flows to a backend or API stub

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-004 |
| Severity | High |

**Problem:** The 5 action flows (Release Batch, Place on Hold, Request Retest, Escalate Deviation, Open Trace Investigation) all emit `console.info` on submit. A stakeholder performing a batch release sees a mock success toast. No record is created anywhere. This is the most important operational action in the product.

**Remediation:** Wire action forms to the FastAPI backend (even a stub POST endpoint that returns 200). Alternatively, create a local in-browser event log that shows submitted decisions for the session, giving visible proof that the action persisted. Remove the word "(mock)" from success messages.

**Definition of done:** Release Batch and Place on Hold POST to an endpoint and receive a typed response. Success state reflects the response, not a hardcoded string.

---

### OP-004 — Replace BatchLineagePanel placeholder with an interactive graph

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-006 |
| Severity | High |

**Problem:** The batch lineage panel in trace-investigation renders plain text (batch ID, material ID, parent/child counts). It is the second most important visualisation after the trace graph.

**Remediation:** Can share the React Flow implementation from OP-002. Lineage data (`parentBatchCount`, `childBatchCount`, `depth`) is available in mock data. A simplified tree layout (not the full bidirectional risk graph) is sufficient.

**Definition of done:** Panel renders a collapsible parent/child tree from mock lineage data.

---

### OP-005 — Replace ControlChartPanel SVG with recharts or nivo

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-007 |
| Severity | High |

**Problem:** The SPC control chart panel renders a hand-rolled SVG. It has no tooltips, no zoom, no rule violation annotations, no interactive point selection. SPC is a domain where chart interactivity is a baseline expectation.

**Remediation:** Replace the hand-rolled SVG with recharts `ComposedChart` (or nivo). Control chart data model (`mockControlChartSeries` with 9 points, UCL/CL/LCL values) is already in mock data. Add out-of-control point highlighting and a Western Electric rule annotation.

**Definition of done:** Control chart renders in recharts with tooltips, coloured out-of-control points, and reference lines for UCL/CL/LCL.

---

### OP-006 — Replace EnvMonHeatmapPanel with a spatial zone layout

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Medium |
| Ref | TD-008 |
| Severity | Medium |

**Problem:** The heatmap panel renders a CSS grid of coloured risk-score cards sorted by score. The name "heatmap" implies a spatial floor-plan layout showing zone risk distribution across the facility.

**Remediation:** Build an SVG-based zone layout (fixed coordinates per zone; not a real floor plan but a structured zone map). Apply risk-based colour fill per zone. Clicking a zone navigates to that zone's swab result detail. `mockEnvMonZones` provides 5 zones with risk scores and hygiene zone classifications.

**Definition of done:** Panel renders a labelled zone grid or simplified floor-map SVG. Zone fill colour reflects risk score. Click navigates to zone detail view.

---

### OP-007 — Connect TelemetryDashboardPage to real `trackEvent()` data

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Low |
| Ref | TD-009 |
| Severity | Medium |

**Problem:** The telemetry dashboard displays 25 hardcoded mock events from 2026-05-15. The `telemetry` package's `trackEvent()` function exists and is callable; a handler just needs to be registered. This is among the easiest wins available.

**Remediation:** (1) Register a handler in `main.tsx` that appends events to a session-scoped array. (2) Expose that array via React context. (3) Update `TelemetryDashboardPage` to read from the live context instead of `MOCK_EVENTS`. The result is real session telemetry derived from actual user navigation — even in mock mode.

**Definition of done:** TelemetryDashboardPage shows events from the current session. Counts reflect actual user navigation, not hardcoded values.

---

### OP-008 — Replace WorkspaceParityPage and ProductionReadinessPage hardcoded findings with live derivation

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Medium |
| Ref | TD-013 |
| Severity | Medium |

**Problem:** Both pages contain hardcoded `PARITY_ASSESSMENTS` and `FINDINGS` arrays representing a point-in-time snapshot. As the codebase evolves, these diverge silently. A stakeholder reading the page will see outdated parity claims.

**Remediation:** If these pages are retained (see `12-keep-simplify-remove-move.md`), derive parity and readiness findings from the workspace registry and a maintained YAML/JSON source file. Remove the hardcoded constants. If not retained, move the data to `docs/` as a snapshot document.

**Definition of done:** Either (a) page derives findings from a maintained data source that is updated as workspaces evolve, or (b) page is removed and data moved to docs.

---

### OP-009 — Implement `history.pushState` for workspace navigation (browser back support)

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Low |
| Ref | TD-016 |
| Severity | Medium |

**Problem:** `useWorkspaceShellState` uses `history.replaceState`, not `pushState`. Users cannot use the browser back button to return to a previous workspace. This is a basic UX expectation.

**Remediation:** Change `replaceState` to `pushState` for explicit user navigations (setWorkspace, navigateToBatchRelease, etc.). Keep `replaceState` for internal view tab switches within a workspace.

**Definition of done:** Navigating from home to a workspace, then pressing back, returns to home. View tab switches within a workspace do not add browser history entries.

---

### OP-010 — Register a telemetry handler for Feedback submissions

| Field | Value |
|-------|-------|
| Impact | **Low** |
| Effort | Low |
| Ref | TD-009 |
| Severity | Low |

**Problem:** `FeedbackDrawer.tsx` captures feedback but submits to console only. Even without a backend, feedback items should be trackable for a pilot.

**Remediation:** On feedback submit, call `trackEvent('feedback.submitted', { category, workspaceId, rating, ... })`. If OP-007 is implemented, this will appear in the telemetry dashboard automatically.

**Definition of done:** Feedback submissions appear as events in the telemetry dashboard (once OP-007 is implemented).

---

## Summary table

| ID | Title | Impact | Effort | Debt Ref |
|----|-------|--------|--------|----------|
| OP-001 | Wire RoleAwareHome to adapter data | High | Low | TD-012 |
| OP-002 | Replace TraceGraphPanel with React Flow | High | Medium | TD-005 |
| OP-003 | Wire batch release actions to backend | High | Medium | TD-004 |
| OP-004 | Replace BatchLineagePanel with tree graph | High | Medium | TD-006 |
| OP-005 | Replace ControlChartPanel with recharts/nivo | High | Medium | TD-007 |
| OP-006 | Replace EnvMonHeatmapPanel with spatial layout | Medium | Medium | TD-008 |
| OP-007 | Connect TelemetryDashboard to live events | Medium | Low | TD-009 |
| OP-008 | Replace parity/readiness page hardcoded data | Medium | Medium | TD-013 |
| OP-009 | Switch navigation to pushState | Medium | Low | TD-016 |
| OP-010 | Emit telemetry on feedback submit | Low | Low | TD-009 |
