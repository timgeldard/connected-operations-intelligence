# ADR-018: Release Gates and Pilot Exit Criteria

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 7 introduces two governance constructs for managing the progression from pilot to production:

1. **Release gates** — high-level categorical checks (product model, UX consistency, data contracts, security, etc.) that must pass before production rollout is authorised.
2. **Pilot exit criteria** — measurable, specific conditions that must be met before the pilot phase can formally close.

Both need to be:
- Visible to the governance review audience (programme leads, domain leads, platform engineering)
- Trackable with explicit status and blockers
- Connected to the scenario validation and sign-off model

Two storage approaches were considered:
1. **Database records** — managed via a backend API, updated by administrators via a UI
2. **Typed constants** — defined as TypeScript arrays in page components, updated via code change

---

## Decision

### Typed Constants

Release gates are defined as `readonly ReleaseGate[]` in `ReleaseGatePage.tsx` (`RELEASE_GATES` constant). Exit criteria are defined as `readonly PilotExitCriteria[]` in `PilotExitCriteriaPage.tsx` (`EXIT_CRITERIA` constant).

Both use types from `packages/product-model/src/types/pilot.ts`:

```typescript
interface ReleaseGate {
  gateId: string          // GATE-NNN
  name: string
  description: string
  status: ReleaseGateStatus   // not-started | in-progress | passed | passed-with-conditions | failed | blocked
  owner: string
  requiredFindingsClosed: string[]
  requiredSignoffs: string[]
  requiredScenarios: string[]
  blockers: string[]
  dueAt: string
  evidenceLinks: string[]
}

interface PilotExitCriteria {
  criteriaId: string      // PEC-NNN
  title: string
  description: string
  status: ReleaseGateStatus
  owner: string
  measurement: string
  target: string
  actual: string
  blockers: string[]
  recommendation: string
}
```

### Aggregation via aggregateGateStatus()

The `aggregateGateStatus(gates: readonly ReleaseGate[]): ReleaseGateStatus` helper in `packages/product-model/src/helpers/pilot.ts` computes the worst-case status across a gate collection:

- Any gate `failed` → aggregate is `failed`
- Any gate `blocked` → aggregate is `blocked`
- Any gate `in-progress` → aggregate is `in-progress`
- All gates `passed` or `passed-with-conditions` → aggregate is `passed`

This function is used by the Release Gate Dashboard to provide an at-a-glance overall status.

### 10 Release Gates

Gates GATE-001 through GATE-010 cover: Product Model, UX Consistency, Data Contract, Role and Scope, Scenario Validation, Accessibility, Performance, Security/Access, Cutover Simulation, and Stakeholder Sign-Off.

### 12 Exit Criteria

Criteria PEC-001 through PEC-012 cover: scenario pass rate, critical blockers, design-system compliance, role/scope visibility, workspace ownership declarations, panel ownership declarations, action telemetry, accessibility triage, performance triage, stakeholder sign-off, support documentation, and cutover simulation documentation.

The `pilotExitBlocking()` helper returns criteria with status `failed` or `blocked`, providing the subset that is actively preventing pilot exit.

---

## Rationale

### Why typed constants rather than database records?

During the pilot validation phase, gate and criteria status changes frequently — often multiple times per week as validation sessions complete and findings are resolved. A code change with a diff and a code review produces a clearer audit trail than a database write for a governance artefact. Every status change is attributed to a developer, reviewed, and deployed — making the governance record verifiable.

The constructs are also complex (linked to scenario IDs, signoff IDs, finding IDs) in ways that would require a relational schema. At this stage, a flat TypeScript constant is easier to maintain and less error-prone than a relational model.

### Why 10 gates rather than fewer?

A smaller gate count would conflate distinct concerns. Security and accessibility are separate stakeholder groups with separate sign-off requirements. Data contracts and UX consistency are owned by different teams. Keeping them separate allows each gate to have a clear owner and a clear due date, and allows partial passes (some gates `passed`, others `in-progress`) to be visible to the governance audience.

### Why 12 exit criteria rather than linking directly to gates?

Exit criteria are more specific than gates. A gate may cover several measurable conditions; the criteria decompose the gate into testable, target-and-actual pairs. For example, GATE-005 (Scenario Validation) maps to PEC-001 (≥80% scenarios passed) — but PEC-001 has a specific percentage target and current actual value that provides progress visibility the gate status alone does not.

### Why `ReleaseGateStatus` for both gates and exit criteria?

`ReleaseGateStatus` (`not-started | in-progress | passed | passed-with-conditions | failed | blocked`) is the right set of values for both constructs. Exit criteria can be `passed-with-conditions` (e.g. PEC-004 — no unauthorised visibility, but client-only enforcement noted). Using the same type allows the same rendering and filtering components to work for both pages.

---

## Consequences

### Positive

- Status changes are auditable via git history — every update is a reviewed code change
- `aggregateGateStatus()` provides a deterministic, testable overall status computation
- Typed IDs (`GATE-NNN`, `PEC-NNN`) allow cross-referencing between gates, criteria, scenarios, and sign-offs
- The same `ReleaseGateStatus` type drives consistent badge rendering across both pages

### Negative

- Status updates require a code change and deployment — cannot be updated by a non-developer without a code change workflow
- The 12 exit criteria do not cover every possible concern — new concerns that emerge during the pilot must be added as new criteria via a code change

### Mitigations

- The platform engineering lead is responsible for daily status updates during the pilot validation window
- New criteria can be added as `PEC-013` onwards by following the existing pattern — adding a typed object to the `EXIT_CRITERIA` array
