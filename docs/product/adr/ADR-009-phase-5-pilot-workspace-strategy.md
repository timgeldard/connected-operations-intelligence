# ADR-009: Phase 5 Pilot Workspace Strategy

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 4 delivered five live workspaces: Trace Investigation, Quality Batch Release, Operations Plan Risk, Environmental Monitoring, and Production Staging. All five carry `lifecycle: 'live'` and are visible by default in the nav rail and home screen.

Phase 5 introduces four new workspaces targeting additional domains and use cases:

1. **SPC Monitoring** — real-time statistical process control for process engineers
2. **Process Order Review** — order-centric execution review for production supervisors
3. **Warehouse 360 Overview** — stock, holds, movements, and replenishment for warehouse managers
4. **Maintenance & Reliability** — work orders, PM schedule, equipment availability for maintenance teams

All four are sufficiently novel (new domain packages, new data contracts, new panel patterns) that full `live` rollout would skip a validation step. At the same time, `concept-lab` would hide them from any real user testing.

---

## Decision

Phase 5 workspaces are deployed with `lifecycle: 'pilot'`.

- `pilot` workspaces are navigable (`isNavigable('pilot') === true`) and visible in the workspace grid
- They appear in the nav rail and home screen
- They are excluded from the "production ready" tier and flagged with a "pilot" badge in the Governance Registry
- The `AdminGovernancePage` Lifecycle & Source tab groups them separately from `live` workspaces

The four Phase 5 workspaces pilot first at Kerry Listowel (IE10) with mock data before connecting to live ERP, CMMS, WMS, and SPC engine APIs.

---

## Rationale

### Why `pilot` and not `live`?

The Phase 5 workspaces introduce new Zod schemas, adapter contracts, and evidence panel patterns that have not yet been tested against real production data. `pilot` signals to the ops team and reviewers that the workspace is functionally complete but not yet signed off for all-site rollout.

### Why not `concept-lab`?

`concept-lab` is for incomplete or exploratory implementations. All four Phase 5 workspaces have full schema, adapter, panel, view, and action implementations — they are complete prototypes. `pilot` is the correct state.

### Why all four at once?

The Phase 5 workspaces are architecturally consistent (same patterns as Phase 4) and can be developed in parallel without cross-domain dependency risk. Batching them avoids four separate platform releases for essentially the same pattern extension.

---

## Consequences

### Positive

- Users at pilot sites can access and validate all four workspaces immediately
- The `pilot` badge creates a clear expectation that these are pre-production
- Governance tooling (`AdminGovernancePage`) automatically groups them correctly
- Phase 6 promotion to `live` is a one-line change per registration file

### Negative

- `pilot` workspaces appear in nav and home, which may confuse non-pilot-site users
- Home screen priority sections for SPC, Warehouse, and Maintenance surface mock data that does not reflect real plant state

### Mitigations

- Mock data constants are annotated with `// mock data — Phase 5 pilot` to make the boundary clear in code review
- The `pilot` badge is visible in the workspace card and governance registry
