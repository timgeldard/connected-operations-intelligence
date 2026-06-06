# Cutover Simulation Guide

## Overview

The Cutover Simulation dashboard (`?workspace=admin-cutover-simulation`) tracks the progression of each ConnectIO workspace × legacy system pair through a four-stage simulation model. The purpose is to reduce the risk of a hard legacy cutover by providing observable validation checkpoints before any system is permanently retired.

This guide covers the four simulation modes, how to advance a pair to the next mode, current status per legacy system, what "passing" means at each stage, and post-simulation verification steps.

---

## The Four Simulation Modes

The `CutoverSimulationMode` type defines the progression:

```
off → observe → simulate-redirect → simulate-retirement
```

| Mode | Description | User Impact |
|---|---|---|
| `off` | No simulation active. Both ConnectIO and the legacy system operate independently. | None — users access both systems through their normal entry points |
| `observe` | ConnectIO workspace is shown alongside the legacy system. Users can compare outputs directly. No user workflow changes. | Low — users see ConnectIO but are not redirected from their legacy entry points |
| `simulate-redirect` | Deep links from the legacy system are intercepted and redirected to the corresponding ConnectIO workspace. Legacy data is still live. | Medium — users following legacy bookmarks or email links land in ConnectIO |
| `simulate-retirement` | Legacy system routes are disabled in the simulation context. All traffic is routed to ConnectIO. The legacy system exists but is not reachable via normal navigation paths. | High — users must use ConnectIO for all tasks covered by this workspace pair |

---

## How to Advance a Simulation Pair

Mode advancement is a deliberate code change — it is not a UI toggle. This is intentional: each advancement is an auditable deployment event.

**Process:**

1. **Contact the platform team** — raise a request via the project tracker (Kerry IT Service Desk, ConnectIO queue). Include the legacy system ID, the target mode, and the planned advancement date.
2. **Update `SIMULATION_PAIRS` in `CutoverSimulationPage.tsx`** — the platform team updates the `mode` field for the relevant pair in the `SIMULATION_PAIRS` configuration array in `apps/shell/src/pages/admin/CutoverSimulationPage.tsx`.
3. **Deploy** — the change is deployed through the normal ConnectIO CI/CD pipeline. A deployment to the target environment is required before the new mode takes effect.
4. **Verify** — confirm the Cutover Simulation dashboard shows the updated mode. Run the post-simulation verification steps (see below).

**Lead time:** Allow a minimum of 5 working days from request to advancement deployment for scheduling and testing.

---

## Current Simulation Status (as of 2026-05-15)

| Legacy System | ConnectIO Workspace(s) | Current Mode | Simulation Status |
|---|---|---|---|
| EM Tracker (Excel/SharePoint) | Environmental Monitoring | `simulate-retirement` | Complete — simulation passed; ready for decommission decision |
| Intelex (traceability) | Trace Investigation | `simulate-redirect` | Ongoing — redirect simulation in progress at IE10; no blocking findings |
| LabWare LIMS | Quality Batch Release, SPC Monitoring | `observe` | Ongoing — parallel observation at IE10 and IE12; findings logged |
| Rockwell PhaseManager MES | Operations Plan Risk, Process Order Review | `observe` | Ongoing — blocked on MES adapter (OPR-001); simulation data is partial |
| Manhattan SCALE WMS | Production Staging, Warehouse 360 Overview | `off` | Not started — WMS adapter design complete; simulation not yet initiated |
| SAP Plant Maintenance | Maintenance & Reliability | `off` | Not started — SAP PM contract not yet finalised |

---

## What "Passing" Means Per Mode

### `observe` — passing criteria

- ConnectIO workspace renders equivalent data to the legacy system for the same record or event, within acceptable tolerance
- No `severity: 'critical'` or `severity: 'blocker'` findings in the simulation result
- At least one full production cycle (e.g. one batch release, one shift, one maintenance work order) has been observed without data discrepancy

### `simulate-redirect` — passing criteria

- All tested legacy deep links resolve correctly to the ConnectIO workspace without error
- Users who follow a redirect can complete their intended task in ConnectIO without returning to the legacy system
- No usability or data accuracy issues are reported during the redirect period (minimum 2 weeks)
- Rollback to `observe` mode has been tested and confirmed to work

### `simulate-retirement` — passing criteria

- All tasks previously performed in the legacy system can be completed in ConnectIO without workaround
- Legacy system is not accessed by any user during the simulation retirement period (confirmed via legacy system access logs)
- No `severity: 'critical'` findings during the retirement simulation period (minimum 4 weeks)
- Audit and compliance requirements (e.g. batch record integrity, regulatory traceability) are met in ConnectIO

---

## Post-Simulation Verification Steps

After advancing to a new mode, or after a simulation run completes, perform the following verification steps:

1. **Check the dashboard** — open `?workspace=admin-cutover-simulation` and confirm the pair shows the expected mode and a `passed: true` result for the latest simulation run.

2. **Review findings** — open the findings list for the pair. Confirm no new `severity: 'critical'` or `blocker` findings have been added. Assign any new `warning` findings to the domain team owner.

3. **Validate rollback** — if advancing to `simulate-redirect` or `simulate-retirement`, confirm that the previous mode can be restored within 30 minutes by reverting the `SIMULATION_PAIRS` change and deploying. Document the rollback test result.

4. **Notify site leads** — inform the Kerry site domain lead and super users at the affected site that the simulation mode has changed. Provide the expected user impact (see mode table above).

5. **Update the production readiness checklist** — a completed `simulate-retirement` pass is a prerequisite for Gate 5 (Integration Decommissioned) in the production readiness checklist. Update `docs/migration/production-readiness-checklist.md` accordingly.

6. **Log the result in the project tracker** — record the simulation ID, the result (`passed` / `failed`), and any finding IDs in the Kerry IT project tracker as a comment on the relevant milestone.
