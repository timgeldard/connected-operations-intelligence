# ADR-007: Domain-Owned Single-Domain Workspaces Alongside Cross-Domain Cockpits

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 3 proved the cross-domain cockpit model with Operations Plan Risk — a workspace that aggregates evidence from four domain integrations (operations, warehouse, quality, maintenance) to give an operations supervisor a single risk view.

Phase 4 introduces two new workspaces:

1. **Environmental Monitoring** — owned by `di-envmon`, consuming only LIMS data
2. **Production Staging** — owned by `di-warehouse`, consuming only WMS data

Neither workspace requires cross-domain evidence aggregation. Each serves a specialist persona (envmon coordinator, warehouse manager) whose daily workflow is entirely within one domain.

This raises the architectural question: should the V2 product model support **domain-owned single-domain workspaces**, or should every workspace be cross-domain by default?

---

## Decision

The product model supports both patterns:

1. **Domain cockpits** (cross-domain) — Operations Plan Risk is the archetype: a workspace that composes evidence from multiple domains to serve a persona whose workflow spans those domains.

2. **Domain workspaces** (single-domain) — Environmental Monitoring and Production Staging are archetypes: workspaces that go deep into one domain to serve a specialist whose workflow is primarily within that domain.

Both use the same `WorkspaceRegistration`, `StandardWorkspaceTemplate`, `EvidencePanel`, and shell wiring. The distinction is in `ownerDomain` and whether the panels it uses span multiple domain packages.

---

## Rationale

### Why support single-domain workspaces?

**Specialist depth beats breadth for some personas.** An envmon coordinator doesn't need a cross-domain view — they need deep LIMS data (zones, swab results, heatmap, corrective actions, vectors). Forcing cross-domain evidence onto a specialist workspace adds noise and complexity without value.

**Domain teams own their full workflow.** The envmon team owns the LIMS integration end-to-end: adapter, panels, views, actions, registration. They should be able to ship a workspace without coordinating with operations, quality, or warehouse teams.

**Cross-domain workspaces are more expensive to build and maintain.** They require shared adapter contracts, coordinated query keys, and multi-team ownership of the panel dependency graph. The cost is worth it when the persona genuinely needs data from multiple systems. It's not worth it when they don't.

### Why not separate these into a different product model concept?

The workspace lifecycle, scope model, panel composition, and shell wiring are the same regardless of how many domain integrations a workspace uses. Introducing a separate concept (e.g. "module" vs "workspace") adds naming complexity without adding capability. `ownerDomain` in the registration already captures the ownership signal.

---

## Consequences

### Positive

- Domain teams can ship workspaces independently without cross-team dependencies
- The product model scales to both deep-specialist and broad-cockpit use cases
- Shell wiring (`WorkspaceViews`, registry, `useWorkspaceShellState`) remains unchanged
- Panel governance (allowed consumer workspaces) still enforces cross-domain panel boundaries

### Negative

- The product model includes two philosophically distinct workspace types under one concept; this could cause confusion when onboarding new domain teams
- Single-domain workspaces can appear narrow next to cross-domain cockpits in the nav rail; the RoleAwareHome persona sections mitigate this by surfacing the right workspace to the right user

### Mitigations

- Product model documentation distinguishes "domain cockpit" from "domain workspace" explicitly
- `ownerDomain` field in `WorkspaceRegistration` makes the ownership relationship unambiguous
- The Phase 4 RoleAwareHome sections surface domain workspaces to their target personas (envmon coordinator, warehouse manager) rather than to all users
