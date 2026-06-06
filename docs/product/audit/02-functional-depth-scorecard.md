# Functional Depth Scorecard — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Phase 0–8 implementation

---

## Depth classification rubric

| Label | Definition |
|-------|-----------|
| **Real** | Fetches or derives live data; user actions mutate server state; no hardcoded fixtures |
| **Mock-backed** | Complete UI, correct data types, adapter registered and called via React Query hooks; all data returned from hardcoded TypeScript fixtures; adapter methods ignore request parameters (`_request` convention) |
| **Placeholder** | Renders a static shape (SVG, CSS grid, text list) representing the intended chart or graph, but no chart library is used; upgrade path documented in code comments |
| **Deferred** | Registered (lifecycle = `concept-lab` or `hidden`) with minimal or no component body; Phase 0 stub |
| **Documentation-only** | Page exists in the router and renders content, but is not a product workspace; it is a governance or audit artefact — content is hardcoded and represents a point-in-time snapshot |

---

## Product workspaces

| Workspace ID | Domain | Lifecycle | Views | Panels | Action Flows | Adapter Methods | Depth Label |
|---|---|---|---|---|---|---|---|
| `trace-investigation` | traceability | Live | 7 | 8 | 0 | 10 (all mock) | Mock-backed |
| `quality-batch-release` | quality | Live | 6 | 14 | 5 | 9 (all mock) | Mock-backed; actions console.log only |
| `operations-plan-risk` | operations | Live | 7 | 12 | 0 | 9 (all mock) | Mock-backed |
| `envmon-monitoring` | envmon | Live | 7 | 8 | 0 | 9 (all mock) | Mock-backed; heatmap is placeholder CSS grid |
| `production-staging` | warehouse | Live | 6 | 8 | 0 | 9 (all mock) | Mock-backed |
| `spc-monitoring` | spc | Pilot | 6 | 7 | 0 | 8 (all mock) | Mock-backed; control chart is placeholder SVG |
| `process-order-review` | operations | Pilot | 6 | 6 | 0 | 7 (all mock) | Mock-backed |
| `warehouse-360` | warehouse | Pilot | 5 | 6 | 0 | 7 (all mock) | Mock-backed |
| `maintenance-reliability` | maintenance | Pilot | 5 | 6 | 0 | 7 (all mock) | Mock-backed |
| `traceability-workspace` | traceability | Hidden | — | — | — | 0 | Deferred (superseded) |
| `quality-workspace` | quality | Hidden | — | — | — | 0 | Deferred (superseded) |
| `operations-workspace` | operations | Hidden | — | — | — | 0 | Deferred (superseded) |
| analytics domain | analytics | Concept-lab | 0 | 0 | 0 | 0 | Deferred (Phase 0 stub only) |

---

## Hotspot panel assessment

| Panel | File | Declared Status | Visual Depth | Interactivity | Depth Label |
|-------|------|----------------|---|---|---|
| TraceGraphPanel | `traceability/src/panels/trace-graph-panel.tsx` | Live | Risk badge list + upstream/downstream counts | None; "React Flow planned in Phase 2" | Placeholder |
| BatchLineagePanel | `traceability/src/panels/BatchLineagePanel.tsx` | Live | Text summary of batch ID, parent/child counts, depth | None; "interactive graph out of scope for Phase 1" | Placeholder |
| ControlChartPanel | `spc/src/panels/control-chart-panel.tsx` | Pilot | Hand-rolled SVG with UCL/CL/LCL lines and coloured circles | None; "upgrade path: replace with recharts/nivo" | Placeholder |
| EnvMonHeatmapPanel | `envmon/src/panels/envmon-heatmap-panel.tsx` | Live | CSS grid of coloured cards sorted by risk score | None | Placeholder |
| ReleaseActionsPanel | `quality/src/actions/release-actions-panel.tsx` | Live | 5 action buttons, forms with validation | Submit emits `console.info` only; "No real backend mutation" | Mock-backed |

---

## Shell and administrative pages

| Page | Category | API Calls | Mock Data | Depth Label |
|------|----------|-----------|-----------|-------------|
| `RoleAwareHome` | Shell / home | `usePinnedWorkspaces` (real) | 8 hardcoded arrays (plan risk, priority releases, EM alerts, staging summary, SPC signals, warehouse holds, work orders) | Mock-backed |
| `AdminGovernancePage` | Admin | None | None — derives from live `workspaceRegistry` | Real (read-only) |
| `DesignSystemCompliancePage` | Admin | None | Hardcoded compliance findings | Documentation-only |
| `RoleScopeMatrixPage` | Admin | None | Hardcoded matrix data | Documentation-only |
| `HelpConceptsPage` | Help | None | Static informational content | Real (informational) |
| `HelpGettingStartedPage` | Help | None | Static informational content | Real (informational) |
| `HelpScenariosPage` | Help | None | Static informational content | Real (informational) |

---

## Pilot tracking pages

| Page | Category | Mock Data | Depth Label |
|------|----------|-----------|-------------|
| `PilotExecutionDashboardPage` | Pilot | Hardcoded snapshot | Documentation-only |
| `PilotIssueRegisterPage` | Pilot | Hardcoded issues | Documentation-only |
| `PilotExitCriteriaPage` | Pilot | Hardcoded criteria | Documentation-only |
| `PilotSuccessMetricsPage` | Pilot | Hardcoded metrics | Documentation-only |
| `PilotWorkspacePackPage` | Pilot | Hardcoded workspace pack | Documentation-only |
| `ScenarioValidationPage` | Pilot | Hardcoded scenarios | Documentation-only |
| `ScenarioExecutionTrackingPage` | Pilot | Hardcoded tracking data | Documentation-only |
| `FeedbackBurnDownPage` | Pilot | Hardcoded burndown data | Documentation-only |
| `FeedbackTriagePage` | Pilot | Hardcoded feedback items | Documentation-only |
| `WorkspaceAdoptionPage` | Pilot | Hardcoded adoption data | Documentation-only |
| `SecurityAccessReviewPage` | Pilot | Hardcoded review items | Documentation-only |
| `DataIntegrationReadinessPage` | Pilot | Hardcoded readiness data | Documentation-only |
| `DataQualityGapsPage` | Pilot | Hardcoded gaps | Documentation-only |
| `AccessExceptionsPage` | Pilot | Hardcoded exceptions | Documentation-only |

---

## Launch governance pages (scope overshoot)

These pages implement features the Phase 9 brief explicitly prohibits: production launch, hypercare, rollback, wave rollout, release governance dashboards, and enterprise operating model. They were built in Phases 7–8 and overshot the prototype scope.

| Page | Category | Depth Label | Recommendation |
|------|----------|-------------|----------------|
| `CutoverSimulationPage` | Launch governance | Documentation-only | Move to docs or remove |
| `CutoverRecommendationPage` | Launch governance | Documentation-only | Move to docs or remove |
| `LegacyRetirementPage` | Launch governance | Documentation-only | Move to docs or remove |
| `ReleaseGatePage` | Release governance | Documentation-only | Move to docs or remove |
| `RolloutWavePlanPage` | Wave rollout | Documentation-only | Remove |
| `GoNoGoAssessmentPage` | Launch governance | Documentation-only | Move to docs or remove |
| `StakeholderSignoffPage` | Launch governance | Documentation-only | Move to docs |
| `SupportReadinessPage` | Launch governance | Documentation-only | Remove |
| `TrainingReadinessPage` | Launch governance | Documentation-only | Remove |
| `ProductionReadinessPage` | Launch governance | Documentation-only | Move to docs |
| `WorkspaceParityPage` | Launch governance | Documentation-only | Move to docs |

---

## Summary counts

| Label | Count |
|-------|-------|
| Real | 2 (AdminGovernancePage, Help pages) |
| Mock-backed | 10 workspaces + RoleAwareHome + ReleaseActionsPanel |
| Placeholder | 4 panels (TraceGraph, BatchLineage, ControlChart, EnvMonHeatmap) |
| Deferred | 4 (3 hidden workspaces + Analytics domain) |
| Documentation-only | 14 pilot tracking pages + 11 launch governance pages |

**Key finding:** Every product workspace is mock-backed. No workspace delivers real data. No action flow writes to a backend. Four named hotspot panels are placeholders with no chart library. Eleven pages overshoot the prototype scope and should be removed or moved to docs.
