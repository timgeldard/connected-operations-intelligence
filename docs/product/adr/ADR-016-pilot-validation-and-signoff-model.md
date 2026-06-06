# ADR-016: Pilot Validation and Sign-Off Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 7 requires a structured way to validate the ConnectIO-RAD V2 pilot and obtain formal domain stakeholder approval before recommending production rollout. Two approaches were considered:

1. **App-by-app validation** — validate each of the 9 pilot workspaces independently against a feature checklist derived from the legacy system it supersedes.
2. **Scenario-based validation** — validate against 6 named user journeys that span one or more workspaces and represent the real business value being delivered.

The legacy app-centric model (each workspace validated against its legacy system counterpart) would reproduce the same fragmentation V2 is designed to eliminate. A quality technician releasing a batch does not care that the QualityResultsPanel comes from LabWare and the TraceExposurePanel comes from Intelex — they care that the release decision is well-supported by cross-domain evidence. The validation model should reflect this.

Additionally, stakeholder sign-off needed to be domain-scoped rather than workspace-scoped, because domain leads are accountable for the data and workflows within their domain, not for individual workspace implementations.

---

## Decision

### Scenario-Based Validation

Validation uses 6 `ValidationScenario` records typed in `packages/product-model/src/types/pilot.ts`. Each scenario defines:
- A named persona role and primary workspace
- A starting context (what the user knows when they begin)
- Expected evidence panels, actions, and drill-throughs
- Acceptance criteria (pass/fail observable outcomes)
- `blocksPilotExit` and `blocksProduction` flags

Scenarios are managed in `ScenarioValidationPage.tsx` as the `VALIDATION_SCENARIOS` constant. The `scenarioPilotBlockers()` helper in `packages/product-model/src/helpers/pilot.ts` returns scenarios that are pilot-exit-blocking and not yet passed.

Scenario IDs follow the `SCN-NNN` convention. Six scenarios (SCN-001 through SCN-006) are defined for Phase 7. Four block pilot exit: SCN-001, SCN-002, SCN-004, SCN-006.

### Domain-Scoped Sign-Off

Sign-off is managed via 8 `StakeholderSignoff` records (SO-001 through SO-008) typed in `packages/product-model/src/types/pilot.ts`. Each record captures:
- `stakeholderName`, `stakeholderRole`, `domain`
- `workspaceIds` — the workspaces in scope for this sign-off
- `status` — one of `not-requested | requested | in-progress | approved | approved-with-conditions | rejected | blocked`
- `conditions` and `blockers` arrays
- `signedAt` and `expiresAt` timestamps

Sign-offs are managed in `StakeholderSignoffPage.tsx` as the `SIGNOFFS` constant. The `isSignoffApproved()` helper returns `true` for `approved` and `approved-with-conditions`.

GATE-010 (Stakeholder Sign-Off Gate) requires SO-001, SO-002, SO-003, SO-005, and SO-006 to reach an approved state before the gate can pass.

---

## Rationale

### Why scenario-based rather than app-by-app?

App-by-app validation would require 9 separate feature checklists derived from 6 different legacy systems. This creates dependencies between the validation effort and the legacy system documentation, which is often incomplete. More importantly, it validates the wrong thing — whether ConnectIO can replicate a legacy app, rather than whether ConnectIO delivers the business outcome the user needs.

Scenario-based validation directly tests the business value claim: "a Quality Lead can release a batch with full cross-domain evidence without switching systems." This is the hypothesis being validated, and the scenario structure makes it testable.

### Why domain-scoped sign-off?

Workspace-scoped sign-off would require each workspace to have its own stakeholder, which is impractical — domain leads are accountable for the full data landscape of their domain, not for individual workspace views. Domain-scoped sign-off also matches the governance structure: Quality & Food Safety is a domain, Warehouse & Supply Chain is a domain. Sign-off at the domain level reflects the accountability model.

### Why typed constants rather than a database?

The pilot phase requires rapid iteration on validation status and sign-off records. Typed constants in TSX files allow status to be updated via a code change with a clear diff, a code review, and a deployment trail. This is more auditable than a database write during a validation phase where the data is changing frequently.

---

## Consequences

### Positive

- Scenario validation directly tests business value, not feature completeness
- Six well-defined scenarios with clear acceptance criteria reduce ambiguity in validation sessions
- Domain-scoped sign-off matches the accountability structure of the programme
- Typed `ValidationScenario` and `StakeholderSignoff` types make the admin UI consistent with the product model
- `blocksPilotExit` and `blocksProduction` flags allow the exit criteria to reference specific scenarios

### Negative

- Six scenarios do not cover all 9 workspaces at equal depth — some workspaces (Process Order Review, SPC Monitoring) are not the primary workspace for any scenario
- Sign-off is recorded as a code change, not as a signed document — for regulatory audit purposes, a separate paper or DocuSign record may be required
- Scenario owners are named individuals; if a scenario owner is unavailable, validation sessions cannot proceed

### Mitigations

- The `blocksPilotExit` flag ensures the 4 most critical scenarios are highlighted as mandatory
- Sign-off records include a `notes` field for documenting the review process and any offline sign-off records
- Scenario ownership should be reassigned promptly if the named owner becomes unavailable
