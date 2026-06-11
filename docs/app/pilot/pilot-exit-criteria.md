# Pilot Exit Criteria

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-exit-criteria`

## Overview

12 exit criteria must be met before ConnectIO-RAD V2 exits the controlled pilot phase. Each criterion is a typed `PilotExitCriteria` constant in `PilotExitCriteriaPage.tsx`. The `pilotExitBlocking()` helper in `packages/product-model/src/helpers/pilot.ts` returns the subset of criteria with status `failed` or `blocked`.

**Summary:** 3 passed, 3 passed-with-conditions, 4 in-progress, 1 not-started, 1 not-started.

---

## Criteria Status

| ID | Title | Status | Target | Actual |
|---|---|---|---|---|
| PEC-001 | ≥80% of required pilot scenarios passed | in-progress | ≥80% (5 of 6) | 33% (2 of 6) |
| PEC-002 | Zero critical production blockers | in-progress | 0 | 2 open |
| PEC-003 | Zero unresolved design-system compliance blockers | passed | 0 | 0 |
| PEC-004 | No unauthorised workspace visibility in role/scope matrix | passed-with-conditions | 0 | 0 (client-only enforcement noted) |
| PEC-005 | All pilot workspaces have owner and lifecycle declared | passed | 100% | 100% (9/9) |
| PEC-006 | All pilot evidence panels have owner, freshness, and confidence declared | passed-with-conditions | 100% | ~85% |
| PEC-007 | All pilot actions have validation and telemetry | in-progress | 100% | ~70% |
| PEC-008 | Accessibility blockers triaged | in-progress | 0 untriaged | 1 untriaged (FB-SEED-003) |
| PEC-009 | Performance blockers triaged | passed-with-conditions | 0 untriaged | 0 untriaged |
| PEC-010 | Stakeholder sign-off complete or conditionally approved | not-started | 5 of 8 approved | 0 approved |
| PEC-011 | Pilot support model documented | passed | 3 runbooks | 3 created |
| PEC-012 | Rollback / cutover simulation documented | passed | 2 documents | 2 created |

---

## Detail by Criterion

**PEC-001** — Scenario validation is at 33% (SCN-002 passed-with-observations, SCN-004 passed). Blockers: SCN-001 and SCN-003 in-progress; SCN-005 and SCN-006 not yet started. Action: schedule remaining validation sessions.

**PEC-002** — Two open critical production blockers: OPR live MES adapter missing (OPR-001); M&R SAP PM contract not signed (MR-001). These are pre-conditions for production, not pilot blockers, but must be tracked.

**PEC-003** — Met. All design-system compliance findings are `info` or `warning` severity. No blocker or critical violations.

**PEC-004** — Met with conditions. No unauthorised workspace visibility found, but the permission model is client-only in pilot. Server-side enforcement is required before production. Acceptable for pilot exit.

**PEC-005** — Met. All 9 pilot workspaces have `ownerDomain` and `lifecycle` declared in their `WorkspaceRegistration`.

**PEC-006** — Partially met. Approximately 85% of panels have complete ownership declarations. SPC and WM source panels have placeholder freshness/confidence values. Action: update pilot-stage panel registrations.

**PEC-007** — In progress at ~70%. Escalation and handover actions in Operations Plan Risk are not yet wired to telemetry. Hold release approval workflow not implemented in Warehouse 360.

**PEC-008** — One untriaged blocker: FB-SEED-003 (keyboard navigation gap in Operations Plan Risk). Must be triaged and assigned a remediation plan before pilot exit.

**PEC-009** — Met with conditions. FB-SEED-002 (trace graph slow on large batches) is accepted for pilot and tracked for Phase 8. No untriaged performance blockers.

**PEC-010** — Not started. Requires scenario validation (PEC-001) to reach target first. Zero domain sign-offs approved. Required: 5 of 8 (Quality, Operations, Warehouse, Plant Leadership, Platform Engineering).

**PEC-011** — Met. Three runbooks created: `pilot-support-runbook.md`, `workspace-troubleshooting.md`, `cutover-simulation-troubleshooting.md`.

**PEC-012** — Met. Two documents created: `cutover-simulation-guide.md` and `cutover-simulation-troubleshooting.md`.

---

## Which Criteria Are Blocking

Criteria that are `in-progress` with unresolved blocking items, or `not-started`, are the active blockers for pilot exit:

| ID | Blocking Reason |
|---|---|
| PEC-001 | Scenario validation at 33%; target is 80% |
| PEC-007 | Action telemetry incomplete for OPR and Warehouse 360 |
| PEC-008 | FB-SEED-003 not triaged |
| PEC-010 | No stakeholder sign-offs approved |

PEC-002 (production blockers) is tracked but is not a blocking criterion for pilot exit — it is a precondition for production rollout only.
