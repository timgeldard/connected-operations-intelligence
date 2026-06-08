# Release Gates

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-release-gates`

## Overview

Ten release gates must reach `passed` or `passed-with-conditions` before ConnectIO-RAD V2 is eligible for controlled production rollout. Gates are typed `ReleaseGate` constants in `ReleaseGatePage.tsx`. Aggregate status is computed by `aggregateGateStatus()` in `packages/product-model/src/helpers/pilot.ts`.

---

## Gate Status Summary

| Gate | Name | Status | Owner | Due |
|---|---|---|---|---|
| GATE-001 | Product Model Gate | passed | platform-engineering | 2026-05-15 |
| GATE-002 | UX Consistency Gate | passed-with-conditions | platform-engineering | 2026-05-15 |
| GATE-003 | Data Contract Gate | in-progress | data-architecture | 2026-06-15 |
| GATE-004 | Role and Scope Gate | passed-with-conditions | platform-engineering | 2026-05-30 |
| GATE-005 | Scenario Validation Gate | in-progress | pilot-lead | 2026-06-01 |
| GATE-006 | Accessibility Gate | in-progress | platform-engineering | 2026-06-15 |
| GATE-007 | Performance Gate | passed-with-conditions | platform-engineering | 2026-05-15 |
| GATE-008 | Security / Access Gate | not-started | security-access | 2026-07-01 |
| GATE-009 | Cutover Simulation Gate | passed-with-conditions | platform-engineering | 2026-05-30 |
| GATE-010 | Stakeholder Sign-Off Gate | not-started | pilot-lead | 2026-08-01 |

**Passed or conditional:** 5 (GATE-001, 002, 004, 007, 009)  
**In progress:** 3 (GATE-003, 005, 006)  
**Not started:** 2 (GATE-008, GATE-010)

---

## Gate Definitions and Current Blockers

**GATE-001 — Product Model Gate (passed)**  
All pilot workspaces registered with complete lifecycle, scope, role, and route declarations. Evidence: `workspace-registry.ts`, `docs/governance/workspace-and-panel-registry.md`.

**GATE-002 — UX Consistency Gate (passed-with-conditions)**  
Blocker (non-blocking for pilot): Admin pages contain inline styles. Condition: Resolve before production.

**GATE-003 — Data Contract Gate (in-progress)**  
Required sign-offs: SO-007. Blockers: SPC source connector not available; WM source partial — Warehouse 360 integration pending; CoA adapter mock-only. Due 2026-06-15.

**GATE-004 — Role and Scope Gate (passed-with-conditions)**  
Required sign-offs: SO-008. Blockers: No real permission enforcement in pilot (client-only mock); Security sign-off not yet requested. Acceptable for pilot; must be resolved for production.

**GATE-005 — Scenario Validation Gate (in-progress)**  
Required scenarios: SCN-001, SCN-002, SCN-003, SCN-004. Blockers: SCN-001 and SCN-003 in-progress; SCN-005 and SCN-006 not started. Due 2026-06-01.

**GATE-006 — Accessibility Gate (in-progress)**  
Blockers: Keyboard navigation gap in Operations Plan Risk filters (FB-SEED-003); Governance tables need accessible column headers. Due 2026-06-15.

**GATE-007 — Performance Gate (passed-with-conditions)**  
Condition: Trace graph slow on large batches (FB-SEED-002) — accepted for pilot; must resolve before production.

**GATE-008 — Security / Access Gate (not-started)**  
Required sign-offs: SO-008. Blockers: Security sign-off not yet requested; client-only permission model not suitable for production. Due 2026-07-01.

**GATE-009 — Cutover Simulation Gate (passed-with-conditions)**  
Blockers: M&R simulation pair not yet in observe mode; PhaseManager SAP PM integration timeline not confirmed. Conditions accepted for pilot.

**GATE-010 — Stakeholder Sign-Off Gate (not-started)**  
Required sign-offs: SO-001, SO-002, SO-003, SO-005, SO-006. Blockers: No domain sign-offs approved yet. Due 2026-08-01.

---

## How Gates Are Evaluated

A gate passes when:
- All `requiredFindingsClosed` items are resolved
- All `requiredSignoffs` have status `approved` or `approved-with-conditions`
- All `requiredScenarios` have status `passed` or `passed-with-observations`
- No blockers remain (or remaining blockers are formally deferred for post-pilot resolution)

The `aggregateGateStatus()` helper returns the worst status across all gates. A single `failed` gate returns `failed` for the aggregate; a single `blocked` returns `blocked`. If all gates are `passed` or `passed-with-conditions`, the aggregate is `passed`.

---

## What Must Happen Before Production

Before any `live` production rollout beyond the pilot site:

1. GATE-003 must pass (data contracts complete, SO-007 approved)
2. GATE-005 must pass (all required scenarios at passed or passed-with-observations)
3. GATE-006 must pass (all accessibility blockers resolved)
4. GATE-008 must pass (server-side security enforcement in place, SO-008 approved)
5. GATE-010 must pass (required domain sign-offs approved)

GATE-001, GATE-002, GATE-004, GATE-007, and GATE-009 are already at `passed` or `passed-with-conditions` and are not blocking pilot exit.
