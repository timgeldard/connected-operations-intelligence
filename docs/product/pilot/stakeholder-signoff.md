# Stakeholder Sign-Off

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-signoff`

## Overview

Stakeholder sign-off is domain-scoped. Each `StakeholderSignoff` record represents the formal review and approval of a set of workspaces by a named stakeholder within their domain. Sign-off is the final governance gate before a domain's workspaces are eligible for production rollout.

As of 2026-05-15, zero sign-offs have been approved. Three are requested or in-progress; three are not yet requested.

---

## The 8 Sign-Off Records

| ID | Stakeholder | Role | Domain | Status | Workspaces Covered |
|---|---|---|---|---|---|
| SO-001 | Dr. Siobhan Walsh | Head of Food Safety & Quality | Quality & Food Safety | requested | quality-batch-release, trace-investigation, envmon-monitoring, spc-monitoring |
| SO-002 | Declan Horgan | Manufacturing Operations Director | Manufacturing Operations | requested | operations-plan-risk, process-order-review, production-staging |
| SO-003 | Aoife Murphy | Warehouse & Supply Chain Lead | Warehouse & Supply Chain | in-progress | production-staging, warehouse-360-overview |
| SO-004 | Brian O'Sullivan | Maintenance & Reliability Manager | Maintenance & Reliability | not-requested | maintenance-reliability |
| SO-005 | Niall Brennan | Plant Manager — Kerry Listowel | Plant Leadership | requested | trace-investigation, quality-batch-release, operations-plan-risk, envmon-monitoring, production-staging, maintenance-reliability |
| SO-006 | Cliona McCarthy | Platform Engineering Lead | Platform Engineering | in-progress | all 9 workspaces |
| SO-007 | Fiona Gallagher | Data Architecture Lead | Data Architecture | not-requested | trace-investigation, quality-batch-release, operations-plan-risk |
| SO-008 | Paul Hennessy | Security & Access Lead | Security / Access | not-requested | trace-investigation, quality-batch-release, operations-plan-risk, envmon-monitoring, production-staging |

---

## Current Status

**Requested (awaiting engagement):** SO-001 (Quality), SO-002 (Operations), SO-005 (Plant Leadership)

**In-progress (engaged, conditions documented):** SO-003 (Warehouse), SO-006 (Platform Engineering)

**Not-requested (sign-off not yet initiated):** SO-004 (Maintenance), SO-007 (Data Architecture), SO-008 (Security)

**Approved:** None

---

## Conditions and Blockers

| ID | Conditions | Blockers |
|---|---|---|
| SO-001 | CoA panel must show live data before final sign-off; SPC signal source connector must be confirmed in scope | CoA adapter not source-integrated |
| SO-002 | PhaseManager integration must be confirmed for production; Action audit log must be wired before rollout | PhaseManager SAP PM integration pending; Escalation actions not persisted |
| SO-003 | Hold release action must include approval workflow before production; WM source integration timeline must be confirmed | None currently blocking in-progress status |
| SO-004 | — | SAP PM source contract not yet signed; M&R workspace at foundation/pilot candidate stage only |
| SO-005 | Cross-domain home screen must show plant-manager pilot view; RoleAwareHome polish required | SCN-006 (Plant Manager cross-domain scenario) not yet validated |
| SO-006 | Performance budget review post-pilot; Telemetry aggregation confirmed end-to-end | None currently blocking |
| SO-007 | — | Data contract coverage for SPC and WM sources incomplete |
| SO-008 | — | Role/scope matrix review not yet formally submitted; No real permission enforcement in pilot |

---

## Sign-Off Process

Sign-off follows these steps:

1. **Pilot team initiates** — The pilot lead sends a formal sign-off request to the stakeholder with: the workspace pack documentation, relevant scenario validation results, and the conditions currently outstanding.
2. **Stakeholder reviews** — The stakeholder reviews the pilot workspace pack (`?workspace=admin-pilot-workspace-pack`) and the scenario validation results (`?workspace=admin-pilot-scenario-validation`).
3. **Conditions negotiated** — Any conditions for sign-off are documented in the `conditions` field of the `StakeholderSignoff` record.
4. **Status updated** — Platform team updates the `status` field in `StakeholderSignoffPage.tsx` to reflect the current state.
5. **Approval recorded** — When all conditions are satisfied, `status` moves to `approved` or `approved-with-conditions` and `signedAt` is populated.

---

## How to Initiate a Formal Review

To initiate sign-off for a stakeholder whose status is `not-requested`:

1. Confirm the prerequisite scenario validations for their domain have passed or passed-with-observations
2. Confirm the workspace pack documentation is current
3. Raise a formal request via the Kerry IT project tracker (ConnectIO programme milestone)
4. Update the `status` field from `not-requested` to `requested` in `StakeholderSignoffPage.tsx`
5. Schedule a review session (recommended: a guided walkthrough of the relevant scenario in the live pilot environment)

SO-004 (Maintenance), SO-007 (Data Architecture), and SO-008 (Security) are all currently blocked on prerequisites. Do not initiate formal requests until the blockers listed above are resolved.

GATE-010 (Stakeholder Sign-Off Gate) requires SO-001, SO-002, SO-003, SO-005, and SO-006 to reach `approved` or `approved-with-conditions` before the gate can pass.
