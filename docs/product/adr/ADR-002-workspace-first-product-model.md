# ADR-002: Workspace-First Product Model

**Status**: Accepted
**Date**: 2026-05-15

## Context

The product model must represent what users do, not what systems exist. A "Quality Release" workflow spans
trace data, environmental monitoring results, SPC control charts, and lab outcomes. The legacy
`ConnectIOModule` type mapped 1:1 to an app and had no mechanism for expressing cross-domain composition.
Designing the V2 product model around that same decomposition would reproduce the same navigation problems
in a new codebase.

A new type was needed that could represent a job-to-be-done as a first-class product entity, carry the
metadata the shell requires to filter and route navigation, and serve as the contract between the shell and
the domain-integration packages that populate it.

## Decision

The `WorkspaceRegistration` type in `packages/product-model` is the canonical product unit. It carries:
lifecycle state (`LifecycleState`), scope policy (`ScopePolicy`), view registrations
(`ViewRegistration[]`), evidence panel references (`EvidencePanelReference[]`), drill-through definitions
(`DrillThroughDefinition[]`), personalization policy (`WorkspacePersonalizationPolicy`), and required
permissions (`PermissionDefinition[]`).

`EvidencePanelRegistration` is the sub-unit — a piece of evidence that can be composed into any workspace
that declares it and has permission via `allowedConsumerWorkspaces`. Panels are owned by a single
`ownerDomain` but may be hosted by multiple workspaces.

Both types are pure TypeScript — no runtime dependencies, no framework imports — so they can be used in
both the shell and server-side manifest APIs without bundling overhead.

## Consequences

**Positive**: Any workspace can embed any panel that grants permission via `allowedConsumerWorkspaces`.
Cross-domain composition is explicit and auditable at the type level rather than implicit at runtime.

**Positive**: `product-model` has no dependencies other than TypeScript itself, making it safe to import
from any layer of the stack without introducing circular dependencies.

**Negative**: `WorkspaceRegistration` is verbose; stub implementations require ten or more fields. A shared
`stubPersonalizationPolicy` and `stubFreshnessPolicy` constant in `product-model` would reduce boilerplate.
This is deferred to Phase 1 once the full field set is stable.
