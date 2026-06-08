# ADR-026 — Cross-Domain Workspace Context Runtime

## Status

Accepted — feature-flagged, default off.

## Context

ConnectIO RAD V2 workspaces compose evidence panels from multiple bounded
contexts. Panels already declare `requiredContext` in their
`EvidencePanelRegistration`, but the runtime did not enforce or share that
context. A user could change the active batch or process order in one panel
while sibling panels continued querying the previous context.

Manufacturing supervisors need a coherent investigation surface: when the
primary investigation anchor changes, dependent panels should wait, re-query,
or update together instead of drifting.

## Decision

Add a scoped active investigation context runtime to
`@connectio/workspace-runtime`.

The runtime:

- Stores `batchId`, `materialId`, `plantId`, `processOrderId`, optional date
  scope, `lastChangedByPanel`, and timestamp.
- Uses Zod validation for context shape.
- Uses a Zustand vanilla store scoped by `StandardWorkspaceTemplate`, so state
  does not leak between workspaces.
- Is wrapped by `ActiveInvestigationContextProvider`.
- Syncs context to query parameters for shareable links when
  `runtime.enableCrossDomainContext` is enabled.
- Provides `useContextAwareEvidencePanel`, a wrapper around
  `useEvidencePanel` that reads each panel's `requiredContext`, reports
  missing keys, debounces context updates, and returns `queryEnabled`.
- Adds the recoverable display state `waiting-for-context`.
- Emits telemetry for context changes and context-gated panel query readiness.

The feature flag `runtime.enableCrossDomainContext`
(`VITE_FEATURE_ENABLE_CROSS_DOMAIN_CONTEXT`) defaults to `false`.

## Consequences

- Existing workspaces remain backward compatible while the flag is off.
- Panel authors can migrate incrementally: keep existing request props, then
  use `useContextAwareEvidencePanel` to gate query hooks and derive request
  fields from `debouncedContext`.
- URL links can carry investigation context without changing workspace routing.
- Native Databricks and legacy panels can share the same context semantics.
- The runtime depends on `@connectio/feature-flags`, `@connectio/telemetry`,
  `zod`, and `zustand`.

## Guardrails

- Do not create a process-wide singleton store for workspace context.
- Do not remove existing prop-driven request APIs during migration.
- Do not auto-query when required context is missing; show
  `waiting-for-context`.
- Do not put SQL, adapter execution, or domain-specific query logic in the
  workspace runtime.
- Keep `lastChangedByPanel` for audit/debug only; it must not be used for
  authorization or business rules.
