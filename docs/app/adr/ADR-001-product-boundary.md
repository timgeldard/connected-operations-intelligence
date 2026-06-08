# ADR-001: Product Boundary — Workspace-First Navigation

**Status**: Accepted
**Date**: 2026-05-15

## Context

The legacy ConnectIO shell presents users with named apps: Trace, SPC, EnvMon, POH, Warehouse360. Users
must know which app contains the information they need before they can navigate to it. This creates
cognitive overhead — a quality technician investigating a failed batch must know to open Trace for lineage,
SPC for control chart history, and EnvMon separately for swab data — and prevents cross-domain workflows
from being expressed as a single navigable journey.

The product boundary was therefore an internal system decomposition, not a user-facing information
architecture. App names reflected the development team's module boundaries, not the jobs users came to do.

## Decision

V2 replaces the app-centric product boundary with a workspace-first model. The unit of navigation is a
`WorkspaceRegistration` (job-to-be-done), not an app. Apps become domain-integration packages
(`domain-integrations/*`) that contribute `WorkspaceRegistration` objects to the shell's registry. The
shell assembles whichever evidence panels the active workspace declares, regardless of which
domain-integration package owns each panel.

The `WorkspaceRegistration` type is defined in `packages/product-model` and carries lifecycle state, scope
policy, view registrations, evidence panel references, drill-through definitions, personalization policy,
and required permissions.

## Consequences

**Positive**: Users navigate by intent. The shell can assemble cross-domain evidence into a single
workspace without requiring the user to context-switch between apps.

**Positive**: Legacy apps (trace2, spc, envmon) can migrate incrementally. Each can export a minimal
`WorkspaceRegistration` stub that satisfies the contract without requiring a full rewrite. The `lifecycle:
'concept-lab'` state allows in-progress workspaces to exist in the registry without appearing in
production navigation.

**Negative**: Domain-integration packages must conform to the `WorkspaceRegistration` contract, which is
richer than a raw app registration. Stub implementations require multiple fields even for Phase 0
scaffolding. A shared `stubPersonalizationPolicy` constant (deferred to Phase 1) will reduce this
boilerplate.
