# ADR-003: Evidence Panel Governance

**Status**: Accepted
**Date**: 2026-05-15

## Context

In the legacy ConnectIO shell, workspaces could freely import and render any component from any app. There
was no declared ownership model and no access contract. When a downstream app changed its component API,
consumers broke silently and the breakage was only discovered at deploy time. The shell had no way to know
which panels were authorised in which contexts, which panel was responsible for a given failure, or whether
a missing panel was an error or an expected absence.

A governance model was needed that made panel ownership explicit, enforced access at the type level, and
gave the shell a consistent set of display states to render regardless of which domain owned the data.

## Decision

Evidence panels are governed by `EvidencePanelRegistration` (defined in `packages/product-model`). Each
registration declares its `ownerDomain` and the `allowedConsumerWorkspaces` that may host it. An empty
`allowedConsumerWorkspaces` array means the panel is unrestricted; a non-empty array limits hosting to the
listed workspace IDs.

The `evidence-panel-runtime` package enforces a seven-state display machine across all panels:
`loading | ready | stale | partial | error | unauthorized | not-applicable`. These states are defined as
a Zod enum in `packages/data-contracts` (`EvidencePanelDisplayStateSchema`) and inferred as a TypeScript
union type. The `useEvidencePanel` hook manages state transitions and the staleness timer;
`EvidencePanelStateRenderer` maps each state to a consistent UI treatment.

Panels must not import from `workspace-runtime`. The dependency is strictly one-way: workspace-runtime
hosts evidence-panel-runtime, not the reverse. This is enforced by the package DAG — `evidence-panel-runtime`
has no dependency on `workspace-runtime` in its `package.json`.

## Consequences

**Positive**: Panel ownership is explicit and auditable. Unauthorised embedding surfaces at typecheck rather
than at runtime.

**Positive**: The seven-state machine ensures consistent loading, error, stale, and partial-data UX across
all panels regardless of domain. Shell-level skeleton screens and error boundaries are uniform.

**Negative**: Panels cannot directly trigger workspace-level navigation. They must use `drillThrough`
callbacks passed as props, which adds a layer of indirection when a panel needs to initiate a cross-domain
workflow.
