# Product Surface Inventory — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** All registered workspaces, views, panels, action flows, and shell surfaces

---

## Product workspaces

### Live workspaces (immediately navigable)

#### `trace-investigation` — Traceability Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: traceability; Lifecycle: live |
| Views | 7 | Overview, Batch Lineage, Trace Graph, Exposure Summary, Mass Balance, Timeline Events, Recall Readiness |
| TraceGraphPanel | Panel | Placeholder — risk badge list, no React Flow |
| BatchLineagePanel | Panel | Placeholder — text summary, no graph |
| Trace Exposure for Release | Panel | Mock-backed |
| Investigation Context | Panel | Mock-backed |
| Batch Header | Panel | Mock-backed |
| Action flows | 0 | None registered |
| Drill-throughs | From Quality Batch Release, from EnvMon | Inbound navigation |
| Adapter | `Trace2Adapter` — 10 methods, all mock | `simulatedDelayMs` option |

#### `quality-batch-release` — Quality Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: quality; Lifecycle: live |
| Views | 6 | Release Queue, Batch Decision, Quality Evidence, Operations Evidence, Warehouse & Trace, Decision History |
| release-queue | Panel | Mock-backed |
| batch-release-summary | Panel | Mock-backed |
| quality-results-summary | Panel | Mock-backed |
| coa-readiness | Panel | Mock-backed |
| deviations | Panel | Mock-backed |
| decision-history | Panel | Mock-backed |
| process-order-evidence | Panel | Mock-backed (cross-domain from Operations) |
| warehouse-hold-status | Panel | Mock-backed (cross-domain from Warehouse) |
| spc-signals-for-release | Panel | Mock-backed (cross-domain from SPC) |
| trace-exposure-for-release | Panel | Mock-backed (cross-domain from Traceability) |
| coa-release-status | Panel | Mock-backed |
| risk-signals | Panel | Mock-backed |
| event-timeline | Panel | Mock-backed |
| related-investigations | Panel | Mock-backed |
| Release Batch | Action flow | Form with validation; console.log submit |
| Place on Hold | Action flow | Form with validation; console.log submit |
| Request Retest | Action flow | Form; console.log submit |
| Escalate Deviation | Action flow | Form; console.log submit |
| Open Trace Investigation | Action flow | Navigates to trace-investigation workspace |
| Adapter | `QualityReleaseAdapter` (7 methods) + `QualityBlockersAdapter` (2 methods) | All mock |

#### `operations-plan-risk` — Operations Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: operations; Lifecycle: live |
| Views | 7 | Plan Overview, Late Orders, Material Shortages, Quality Blockers, Warehouse Blockers, and 2 additional views |
| Panels | 12 | Plan risk context, late orders, material shortages, maintenance constraints, quality blockers, warehouse staging blockers, and 6 additional panels |
| Action flows | 0 | None registered |
| Adapter | `OperationsPlanRiskAdapter` (9 methods) | All mock |

#### `envmon-monitoring` — EnvMon Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: envmon; Lifecycle: live |
| Views | 7 | (per registration: 7 default views) |
| Panels | 8 | Including envmon-heatmap (placeholder CSS grid), zones, alerts, swab results, corrective actions, trends |
| Action flows | 0 | None registered |
| Drill-throughs | To Quality Batch Release, to Trace Investigation | 2 outbound |
| Adapter | `EnvMonAdapter` (9 methods) | All mock |

#### `production-staging` — Warehouse Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: warehouse; Lifecycle: live |
| Views | 6 | Staging overview, order staging, shortfalls, zone capacity, picking waves, move requests |
| Panels | 8 | Staging status, material shortages, line readiness, and additional panels |
| Action flows | 0 | None registered |
| Adapter | `ProductionStagingAdapter` (9 methods) | All mock |

---

### Pilot workspaces (lifecycle: pilot; feature-flag gated)

#### `spc-monitoring` — SPC Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: spc; Lifecycle: pilot |
| Views | 6 | Monitoring overview, active signals, control charts, capability, and additional views |
| Panels | 7 | Including control-chart (placeholder SVG) |
| Action flows | 0 | None |
| Adapter | `SPCMonitoringAdapter` (7 methods) + `SPCSignalsAdapter` (1 method) | All mock |

#### `process-order-review` — Operations Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: operations; Lifecycle: pilot |
| Views | 6 | Order overview, execution timeline, progress, and additional views |
| Panels | 6 | Order header, progress summary, execution timeline, goods movements, deviations, quality checkpoints |
| Action flows | 0 | None |
| Adapter | `ProcessOrderReviewAdapter` (7 methods) | All mock |

#### `warehouse-360` — Warehouse Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: warehouse; Lifecycle: pilot |
| Views | 5 | 360 overview, stock zones, locations, capacities, and additional view |
| Panels | 6 | Context, KPI summary, stock zones, location capacity, active holds, goods movements |
| Action flows | 0 | None |
| Adapter | `Warehouse360Adapter` (7 methods) | All mock |

#### `maintenance-reliability` — Maintenance Domain

| Item | Type | Details |
|------|------|---------|
| Workspace | Workspace | Domain: maintenance; Lifecycle: pilot |
| Views | 5 | Overview, work orders, PM tasks, equipment availability, reliability metrics |
| Panels | 6 | Context, KPI summary, work orders, PM tasks, equipment availability, reliability metrics |
| Action flows | 0 | None |
| Adapter | `MaintenanceReliabilityAdapter` (7 methods) | All mock |

---

### Deferred workspaces (hidden/concept-lab)

| Workspace ID | Lifecycle | Status |
|---|---|---|
| `traceability-workspace` | Hidden | Superseded by `trace-investigation` |
| `quality-workspace` | Hidden | Superseded by `quality-batch-release` |
| `operations-workspace` | Hidden | Superseded by `operations-plan-risk` |
| Analytics domain | Concept-lab | Phase 0 registration stub only; no panels, no adapters |

---

## Shell surfaces

| Surface | Component | Status | Notes |
|---------|-----------|--------|-------|
| RoleAwareHome | `apps/web/src/pages/RoleAwareHome.tsx` | Mock-backed | 8 hardcoded data arrays; real navigation |
| GlobalHeader | `apps/web/src/shell/GlobalHeader.tsx` | Real | Scope bar, workspace switching, user identity display |
| DomainSidebar | `apps/web/src/shell/DomainSidebar.tsx` | Real | Domain navigation; derives from registry |
| CommandPalette | `apps/web/src/shell/CommandPalette.tsx` | Real | Workspace search; derives from registry |
| MainBody | `apps/web/src/shell/MainBody.tsx` | Real | Workspace render host |
| ScopeBar | `apps/web/src/shell/ScopeBar.tsx` | Real | Scope context display |
| FeedbackDrawer | `apps/web/src/feedback/FeedbackDrawer.tsx` | Real form (console submit) | Feedback capture UX complete |

---

## Admin surfaces

| Surface | Component | Status |
|---------|-----------|--------|
| AdminGovernancePage | `apps/web/src/pages/AdminGovernancePage.tsx` | Real (derives from registry) |
| DesignSystemCompliancePage | `apps/web/src/pages/DesignSystemCompliancePage.tsx` | Documentation-only |
| RoleScopeMatrixPage | `apps/web/src/pages/RoleScopeMatrixPage.tsx` | Documentation-only |

---

## Help surfaces

| Surface | Component | Status |
|---------|-----------|--------|
| HelpConceptsPage | `apps/web/src/pages/HelpConceptsPage.tsx` | Real (informational) |
| HelpGettingStartedPage | `apps/web/src/pages/HelpGettingStartedPage.tsx` | Real (informational) |
| HelpScenariosPage | `apps/web/src/pages/HelpScenariosPage.tsx` | Real (informational) |

---

## Pilot tracking surfaces (not product workspaces)

15 pages exist under `apps/web/src/pages/` for pilot governance. These are documentation-only surfaces with hardcoded snapshot data. See `02-functional-depth-scorecard.md` for the full list.

---

## Surface count summary

| Category | Count |
|----------|-------|
| Live product workspaces | 5 |
| Pilot product workspaces | 4 |
| Deferred workspaces | 4 (3 hidden + analytics) |
| Total registered panels (across live+pilot) | 75 (from registration files: 8+14+12+8+8+7+6+6+6) |
| Total action flows | 5 (all in quality-batch-release; console-only submit) |
| Shell surfaces | 7 |
| Admin pages | 3 |
| Help pages | 3 |
| Pilot tracking pages | 14 |
| Launch governance pages | 11 |
| **Total pages in router** | ~38 |
