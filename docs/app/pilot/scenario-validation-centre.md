# Scenario Validation Centre

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-scenario-validation`

## Purpose

The Scenario Validation Centre structures pilot validation around business scenarios, not individual workspaces or features. Each scenario maps a real user journey — with a named persona, starting context, expected evidence panels, expected actions, and acceptance criteria — to a measurable pass/fail outcome. This replaces ad-hoc "try it and see" walkthroughs with repeatable, governed test cases.

---

## The 6 Validation Scenarios

| ID | Title | Persona | Primary Workspace | Scope | Status | Blocks Pilot Exit | Blocks Production |
|---|---|---|---|---|---|---|---|
| SCN-001 | Quality Lead releases a batch with cross-domain evidence | quality-lead | quality-batch-release | batch | in-progress | Yes | Yes |
| SCN-002 | Food Safety Lead investigates a trace event | food-safety-lead | trace-investigation | batch | passed-with-observations | Yes | Yes |
| SCN-003 | Operations Supervisor assesses today's plan risk | operations-supervisor | operations-plan-risk | plant | in-progress | Yes | No |
| SCN-004 | Warehouse Manager prepares production staging | warehouse-manager | production-staging | warehouse | passed | Yes | Yes |
| SCN-005 | Quality user monitors environmental risk at plant scope | quality-lead | envmon-monitoring | plant | not-started | No | No |
| SCN-006 | Plant Manager reviews cross-domain site risk | plant-manager | trace-investigation | plant | not-started | Yes | Yes |

**Summary:** 1 passed, 1 passed-with-observations, 2 in-progress, 2 not-started. 4 of 6 scenarios block pilot exit.

---

## Validation Status Detail

**SCN-001** (in-progress): Last validated 2026-05-10. Findings: CoA generation not wired to source — mock data only; SPCSignalsPanel requires batch context to filter correctly. Owner: Mary Connolly.

**SCN-002** (passed-with-observations): Last validated 2026-05-12. Finding: EventTimelinePanel shows mock timestamps only — source timestamps not yet wired. Owner: Siobhan Walsh.

**SCN-003** (in-progress): Last validated 2026-05-09. Findings: Action audit log not wired — escalations not persisted; PhaseManager integration pending. Owner: Declan Horgan.

**SCN-004** (passed): Last validated 2026-05-14. No findings. Owner: Aoife Murphy.

**SCN-005** (not-started): Blocker — threshold config hardcoded, making it impossible to simulate a threshold breach during validation. Owner: Cliona McCarthy.

**SCN-006** (not-started): Blocker — RoleAwareHome not yet personalised for plant-manager role. Owner: Niall Brennan.

---

## How to Run a Scenario

1. Open the Scenario Validation Centre at `?workspace=admin-pilot-scenario-validation`
2. Select the scenario card matching your persona and primary workspace
3. Read the starting context and business goal
4. Navigate to the primary workspace listed in the scenario
5. Work through the acceptance criteria in order
6. Record any findings against the scenario (the admin view provides a findings list per scenario)
7. Set the scenario status: `passed`, `passed-with-observations`, `failed`, or `blocked`
8. Notify the scenario owner (listed in the card) of the outcome

---

## What Passes / Fails Validation

A scenario **passes** when every acceptance criterion is met without workaround and no blocking findings are recorded.

A scenario **passes-with-observations** when all acceptance criteria are met but minor findings exist (e.g. mock data used where live data is expected, or a non-blocking UX issue identified). Observations must be logged as findings.

A scenario **fails** when one or more acceptance criteria cannot be met and the gap is not mock-data-related.

A scenario is **blocked** when an external dependency prevents it from being run at all (e.g. SCN-005 is blocked by the hardcoded threshold configuration).

---

## Blockers

| Scenario | Blocker |
|---|---|
| SCN-001 | CoA adapter mock-only; SPCSignalsPanel context filter |
| SCN-003 | Action audit log; PhaseManager integration |
| SCN-005 | Hardcoded threshold configuration prevents breach simulation |
| SCN-006 | RoleAwareHome plant-manager personalisation not complete |

Blockers that also flag `blocksPilotExit: true` must be resolved or formally deferred before the pilot exit gate (GATE-005) can be passed.
