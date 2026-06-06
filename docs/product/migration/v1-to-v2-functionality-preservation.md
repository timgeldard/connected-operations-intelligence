# V1 → V2 Functionality Preservation

## Purpose

This document tracks how the capabilities of the original ConnectIO-RAD V1 applications are preserved, replaced, or improved in V2. It is the reference for ensuring no operationally critical V1 feature is silently dropped during the migration.

The goal of V2 is not feature parity — it is **preservation of operational usefulness** while transitioning to a governed, composable evidence panel architecture.

---

## V1 application mapping

| V1 application | V2 workspace | Status | Notes |
|---|---|---|---|
| Trace2 / Trace Investigation | `trace-investigation` (di-traceability) | Pilot | Batch header live via legacy-api; graph, timeline, risk signals on mock |
| Warehouse 360 | `warehouse-360` (di-warehouse) | Pilot | Warehouse summary live via legacy-api; stock detail panels on mock |
| Process Order History (POH) | `process-order-review` (di-operations) | Pilot | Order header live via legacy-api; progress, quality, staging on mock |
| Operations / Plan Risk | `operations-plan-risk` (di-operations) | Live | Full mock data; no legacy-api wiring yet |
| Quality / Batch Release | `quality-batch-release` (di-quality) | Pilot | Cross-domain evidence composition; mock data |
| SPC Monitoring | `spc-monitoring` (di-spc) | Live | Mock data |
| Environmental Monitoring | `envmon-monitoring` (di-envmon) | Pilot | Mock data |
| Maintenance / Reliability | `maintenance-reliability` (di-maintenance) | Pilot | Mock data |

<!-- TODO: Confirm V1 application names and URLs for the Kerry production environment. -->

---

## Trace2 / Trace Investigation

### Verified V2 capabilities

| Capability | V2 panel | Data source | Notes |
|---|---|---|---|
| Batch header (material, qty, status, dates) | `batch-header-panel` | `legacy-api` | Browser-verified against V1 |
| Trace graph (upstream + downstream nodes/edges) | `trace-graph-panel` | `mock` | Interactive React Flow graph; legacy-api wiring pending V1 graph endpoint |
| Customer exposure (deliveries, countries, recall) | `customer-impact-panel` | `mock` | |
| Supplier exposure (lots, upstream materials) | `material-supplier-exposure-panel` | `mock` | |
| Event timeline | `event-timeline-panel` | `mock` | |
| CoA / release status | `coa-release-status-panel` | `mock` | |
| Risk signals | `risk-signals-panel` | `mock` | |
| Related investigations | `related-investigations-panel` | `mock` | |
| Mass balance summary | (view-level composite) | `mock` | |
| Trace exposure for release (cross-domain) | `trace-exposure-for-release-panel` | `mock` | Consumed by quality-batch-release workspace |

### Known V1 capabilities not yet in V2

<!-- TODO: Review original trace2 app for any features not captured above. Known question: does V1 provide a graph endpoint or only a node list? -->

---

## Warehouse 360

### Verified V2 capabilities

| Capability | V2 panel | Data source | Notes |
|---|---|---|---|
| Warehouse summary (stock lines, movements, capacity) | `warehouse-360-summary-panel` | `legacy-api` | Browser-verified against V1 |
| Stock overview | `stock-overview-panel` | `mock` | |
| Goods movement activity | `goods-movement-activity-panel` | `mock` | |
| Location capacity | `location-capacity-panel` | `mock` | |
| Open holds | `open-holds-panel` | `mock` | |
| Replenishment needs | `replenishment-needs-panel` | `mock` | |

### Known V1 capabilities not yet in V2

<!-- TODO: Confirm whether V1 WH360 exposed lot-level stock detail, transfer order management, or bin/location level views. -->

---

## Process Order History (POH)

### Verified V2 capabilities

| Capability | V2 panel / view | Data source | Notes |
|---|---|---|---|
| Order header (material, qty, status, dates) | `process-order-header-panel` | `legacy-api` | Browser-verified against V1; now also shows production line |
| Execution progress (ops, confirmations, delay) | `order-progress-panel` | `mock` | |
| Yield summary (confirmed vs. planned, variance %) | `yield-losses-view` composite | `mock` | Derived from header data; yield % shown prominently |
| Execution timeline | `execution-timeline-panel` | `mock` | |
| Quality context (inspection lot, deviations, SPC) | `order-quality-context-panel` | `mock` | |
| Component staging context | `order-staging-context-panel` | `mock` | |
| Related batch context (input/output/co-product) | `related-batch-context-panel` | `mock` | |

### Known V1 POH capabilities not yet in V2

<!-- TODO: Confirm whether V1 POH exposed individual operation confirmations at a line-item level (not just counts). -->
<!-- TODO: Confirm whether V1 POH had a goods receipt / yield summary screen distinct from the order progress view. -->

---

## Quality Batch Release

### V2 capabilities

The quality-batch-release workspace composes cross-domain evidence panels (trace exposure from di-traceability, process order evidence from di-operations) into a single release decision workspace.

<!-- TODO: Map V1 quality release workflow steps to V2 workspace views to confirm full coverage. -->

---

## What V2 adds beyond V1

- **Role-aware home**: workspaces surfaced by role, not by application name
- **Evidence governance**: every panel has declared lifecycle, confidence, freshness policy, and permissions
- **Cross-domain composition**: a single workspace can pull evidence from multiple V1 backends
- **Source badge**: panels show whether data is from mock, V1 legacy-api, or databricks-api
- **Drill-through**: panels link to related workspaces (e.g. batch header → trace investigation)
- **Pilot lifecycle management**: workspaces can be `live`, `pilot`, or `deprecated` independently

---

## V1 retirement readiness

See `docs/adr/ADR-011-legacy-retirement-readiness-tracking.md` and `docs/adr/ADR-023-rollout-wave-model-and-legacy-retirement.md` for the retirement sequencing and criteria.

The legacy-api adapter tier is the bridge that allows V1 backends to remain authoritative while V2 provides the UI. Retirement of each V1 application is gated on:
1. All panels for that domain wired to legacy-api (not mock-only)
2. Pilot sign-off from the relevant user group
3. Cutover simulation passing (`docs/adr/ADR-014-phase-6-cutover-simulation-model.md`)
