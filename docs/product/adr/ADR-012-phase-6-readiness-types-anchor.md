# ADR-012: ReadinessFinding as the Anchor Type for Phase 6 Dashboards

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 6 introduces six admin dashboards to support production readiness governance:

1. **Production Readiness Dashboard** — aggregate go/no-go view across all workspaces
2. **Workspace Parity Assessment** — feature coverage against legacy system counterparts
3. **Cutover Simulation** — simulation mode status and results per legacy system pair
4. **Role/Scope Matrix** — visibility and permission satisfaction per role × scope × workspace
5. **Design-System Compliance Report** — import-level audit against `@connectio/design-system`
6. **Telemetry Dashboard** — usage and error signal summary per workspace

Each dashboard surfaces "issues" or "gaps" that may need resolution before a workspace can advance to pilot or production. Without a shared finding type, each dashboard would define its own shape for these records — leading to duplicated rendering logic, duplicated filter/sort surfaces, and inconsistent severity semantics.

Additionally, the `product-model` package already owns the canonical workspace and lifecycle types. The finding type belongs in the same package to remain the single source of truth for platform-wide readiness concerns.

---

## Decision

A single `ReadinessFinding` interface is defined in `packages/product-model/src/types/readiness.ts` and used as the common finding shape across all Phase 6 assessment dashboards.

All dashboards that surface findings produce `ReadinessFinding[]` (or types that extend it). Dashboard-specific variants extend `ReadinessFinding` rather than defining independent types:

- `DesignSystemComplianceFinding extends ReadinessFinding` — adds `filePath`, `violatingImport`, `eslintRule`, and `lineNumber`

Dashboard-specific aggregation types (`WorkspaceParityAssessment`, `CutoverSimulationResult`) embed `readonly findings: readonly ReadinessFinding[]` as their finding container.

---

## Rationale

### Single render component

A shared finding type enables a single `<FindingRow>` component that renders any finding from any dashboard. Severity badges, recommendation text, owner domain, drill-through links, and blocker flags are all fields on `ReadinessFinding` — the renderer does not need to know which dashboard produced the finding.

### Single filter and sort surface

The admin UI exposes finding-level filters (severity, lifecycle, ownerDomain, blocksPilot, blocksProduction) that work uniformly whether the user is viewing parity findings, compliance violations, or cutover simulation results. A shared type makes this a single `useFindingFilters` hook rather than five separate implementations.

### Single source of truth in product-model

`ReadinessFinding` lives in `packages/product-model`, the same package that owns `WorkspaceRegistration`, `LifecycleState`, and `EvidencePanelDefinition`. Governance tooling that imports from `product-model` gets the finding type without reaching into a dashboard-specific package.

### Extension rather than union

Dashboard-specific fields (e.g. `filePath` for compliance findings) are added via interface extension (`DesignSystemComplianceFinding extends ReadinessFinding`) rather than a discriminated union. This keeps the anchor type clean while allowing specialised dashboards to carry additional context without breaking the shared render path.

---

## Consequences

### Positive

- All Phase 6 dashboards produce structurally compatible findings; the `<FindingRow>` component is written once
- A single `useFindingFilters` hook covers all dashboards
- Severity semantics (`info | warning | blocker | critical`) are consistent across parity, compliance, simulation, and role-scope checks
- `blocksPilot` and `blocksProduction` flags are first-class fields, making the go/no-go computation straightforward

### Negative

- Some fields on `ReadinessFinding` (e.g. `drillThroughTarget`, `lifecycle`) may not be meaningful for every dashboard — implementers must populate them with defaults or `'not-applicable'` where irrelevant
- Extending the anchor type for new Phase 7 dashboards requires a product-model change rather than a localised dashboard change

### Mitigations

- The TSDoc comment on `ReadinessFinding` lists which fields are optional and what the accepted default values are for optional fields
- The `source` field (`'static-audit' | 'eslint' | 'runtime-check' | 'manual'`) allows filtering to understand finding origin even when multiple dashboards are shown together
