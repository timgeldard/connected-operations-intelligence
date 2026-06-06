# ADR-010: Phase 5 Home Screen Scale-out to 7 Priority Sections

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

ADR-008 established the **per-domain priority section** pattern for the home screen and introduced sections for Quality Batch Release, Operations Plan Risk, Environmental Monitoring, and Production Staging.

Phase 5 adds four new pilot workspaces (SPC Monitoring, Warehouse 360, Maintenance & Reliability, Process Order Review). The question is: should the home screen add priority sections for all four, and if so, what data should each surface?

Three of the four new workspaces have clear priority data patterns suitable for home screen surfacing:

| Workspace | Priority data pattern | Home section concept |
|---|---|---|
| SPC Monitoring | Active rule-violation signals | Active Signals — SPC Monitoring |
| Warehouse 360 | Open holds (quality, investigation, customer) | Open Holds — Warehouse |
| Maintenance & Reliability | Critical/high work orders | Priority Work Orders — Maintenance |
| Process Order Review | No persistent priority queue (ad-hoc) | Not added |

Process Order Review is not added because it is an on-demand, order-scoped workspace. There is no ambient priority queue analogous to "the top 2 open work orders" — users navigate to it when they have a specific order in hand.

---

## Decision

Three new priority sections are added to `RoleAwareHome`:

1. **Active Signals — SPC Monitoring** — shows 2 active SPC rule violations; clicking navigates to `spc-monitoring?view=chart-overview`
2. **Open Holds — Warehouse** — shows 2 open warehouse holds with hold reason colour coding; clicking navigates to `warehouse-360-overview?view=holds-management`
3. **Priority Work Orders — Maintenance** — shows 2 critical/high work orders with priority colour coding; clicking navigates to `maintenance-reliability?view=work-orders`

Each section follows the ADR-008 pattern: conditional render, 1–2 items, left-border colour coding, footnote explaining item count, click-to-deeplink.

Three new navigate helpers are added to `useWorkspaceShellState`:
- `navigateToSPCMonitoring(viewId?)`
- `navigateToWarehouse360(viewId?)`
- `navigateToMaintenanceReliability(viewId?)`

---

## Rationale

### Why only 3 of 4 new workspaces?

Process Order Review is fundamentally different: it is launched with a specific order context (e.g. from a drill-through from Operations Plan Risk). There is no sensible "top 2 process orders" priority item because process order priority is determined by the production plan, which the Operations Plan Risk workspace already surfaces. Adding a POR section to the home screen would duplicate the Operations section without adding value.

### Why the specific default views for deeplinks?

- SPC Monitoring → `chart-overview`: the summary view doesn't show individual signals; chart-overview is the first place you act
- Warehouse 360 → `holds-management`: holds are the most urgent item for a warehouse manager arriving at the home screen
- Maintenance → `work-orders`: most urgent items are work orders, not the overview KPI tiles

### Why not a unified cross-domain priority feed?

See ADR-008 Rationale. The same reasoning applies at Phase 5: cross-domain priority ranking belongs in the product, not the prototype.

---

## Consequences

### Positive

- Home screen surfaces actionable items from 7 domains without requiring workspace navigation
- The per-domain section pattern scales linearly — each new workspace adds one section, nothing changes in existing sections
- Navigate helpers for Phase 5 workspaces unify the navigation surface (shell state, home screen, action panels all use the same pattern)

### Negative

- Home screen is now 7 priority sections long; users with access to all workspaces will see a very long page
- Mock data sections for Phase 5 workspaces (SPC, Warehouse, Maintenance) are less accurate than the production-data sections for Phase 4 workspaces

### Mitigations

- A section-pinning / collapse feature is a Phase 6 personalisation concern
- Mock data constants are clearly annotated with their adapter equivalents
