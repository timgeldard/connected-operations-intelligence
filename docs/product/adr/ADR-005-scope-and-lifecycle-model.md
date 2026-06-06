# ADR-005: Scope and Lifecycle Model

**Status**: Accepted
**Date**: 2026-05-15

## Context

Different workspaces operate at different levels of the operational hierarchy. Traceability requires a
batch. SPC requires a line or work-centre. Warehouse operations require a storage location or warehouse.
The legacy shell had a single plant selector; scope was inconsistently threaded into each app and there was
no mechanism for a workspace to declare the context dimensions it required or to adapt to the user's
broadest authorised scope automatically.

Lifecycle management was absent. Experimental workspaces had no way to exist in the codebase without being
exposed to all users, which created pressure to keep speculative work in feature branches rather than
shipping it behind a gate.

## Decision

`ScopeLevel` is a union of twelve operational dimensions defined in `packages/product-model`:
`plant | line | work-centre | region | global | material | batch | process-order | warehouse |
storage-location | supplier | customer`.

Each `WorkspaceRegistration` carries a `ScopePolicy` that declares `supportedLevels`, an optional
`requiredLevel`, a `defaultLevel`, and an `autoElevate` flag. When `autoElevate` is true, the
`resolveDefaultScope` helper (in `packages/product-model`) selects the broadest supported scope from the
user's authorised scopes. Evidence panels declare their context requirements as `EvidenceContextRequirement`
objects that reference specific scope dimensions.

`LifecycleState` has five values: `live | pilot | concept-lab | deprecated | hidden`. Two pure helpers in
`product-model` — `isVisible` and `isNavigable` — govern shell behaviour. `isVisible` returns true for
`live` and `pilot` only. `isNavigable` additionally includes `concept-lab`, allowing gated workspaces to
be routed without appearing in the main navigation sidebar.

## Consequences

**Positive**: The shell can filter the workspace list to entries that are navigable at the current scope,
eliminating menu entries the user cannot meaningfully act on.

**Positive**: Lifecycle gates allow concept-lab workspaces to be deployed, routed, and tested without
appearing in production navigation for all users.

**Negative**: Scope context is multi-dimensional. Panels that require multiple dimensions (e.g. plant and
batch together) must declare each dimension as a separate `EvidenceContextRequirement`, and the shell must
satisfy all required requirements before rendering the panel.
