# Pilot Workspace Pack

**Phase:** 7  
**Last updated:** 2026-05-15

## Purpose

The Pilot Workspace Pack is the governance-facing view of all nine workspaces included in the ConnectIO-RAD V2 controlled pilot. It documents each workspace's pilot status, readiness state, known gaps, and the recommendation for inclusion in pilot validation. The live view is accessible at `?workspace=admin-pilot-workspace-pack`.

---

## The 9 Pilot Workspaces

| Workspace | Lifecycle | Pilot Status | Readiness | Owner Domain |
|---|---|---|---|---|
| Trace Investigation | live | included | ready | traceability |
| Quality Batch Release | live | included | ready | quality |
| Operations Plan Risk | live | included | ready-with-warnings | operations |
| Environmental Monitoring | live | included | ready-with-warnings | quality |
| Production Staging | live | included | ready | warehouse |
| SPC Monitoring | pilot | in-validation | ready-with-warnings | quality |
| Process Order Review | pilot | in-validation | ready-with-warnings | operations |
| Warehouse 360 Overview | pilot | in-validation | ready-with-warnings | warehouse |
| Maintenance & Reliability | pilot | proposed | ready-with-warnings | maintenance |

---

## Lifecycle Classification

Two lifecycle states appear across the nine workspaces:

- **`live`** — Workspace has been through a full delivery cycle, is source-connected, and is deployed for operational use. Live workspaces are visible to all authorised users by default.
- **`pilot`** — Workspace is functionally complete and navigable but pre-production. Pilot workspaces are visible only to users with the `connectio.pilot-access` IdP group. They carry a "pilot" badge in the Governance Registry and home screen.

`isNavigable()` returns `true` for both `live` and `pilot`. `isVisible()` in the auth-scope layer restricts `pilot` to the pilot access group.

---

## How to Interpret Pilot Status

| Pilot Status | Meaning |
|---|---|
| `included` | Workspace is confirmed in scope for the pilot. Passed gateway review. |
| `in-validation` | Workspace is actively being validated against pilot scenarios. |
| `proposed` | Workspace has been proposed for the pilot but not yet confirmed. Maintenance & Reliability is awaiting SAP PM contract resolution. |
| `accepted` | Workspace has passed all required validation scenarios and stakeholder review. |
| `accepted-with-actions` | Accepted but with outstanding remediation actions before production. |
| `rejected` | Workspace excluded from this pilot cycle. |
| `blocked` | Workspace cannot proceed until a blocking dependency is resolved. |

---

## Known Gaps Table

| Workspace | Known Gap | Impact |
|---|---|---|
| Quality Batch Release | CoA generation not wired to source adapter | Mock CoA data only — cannot validate CoA readiness for real releases |
| Operations Plan Risk | Action audit log not wired to telemetry | Escalations and handover notes not persisted |
| Operations Plan Risk | PhaseManager SAP integration pending | Plan risk data is adapter-backed, not source-connected |
| Environmental Monitoring | Threshold config hardcoded | Environmental engineers cannot adjust alert thresholds without a code change |
| Environmental Monitoring | EnvMon source read-only in pilot | Cannot write corrective actions back to source |
| SPC Monitoring | SPC source connector not yet available | Control charts run on mock data only |
| SPC Monitoring | No alarm rule editor | Read-only; control limits cannot be adjusted |
| Process Order Review | POH source integration pending | Process order history is mock |
| Process Order Review | Action flows in draft state | Review and flag actions are functional but not persisted |
| Warehouse 360 Overview | Warehouse 360 WM source integration pending | Inventory data is partially adapter-backed |
| Warehouse 360 Overview | Hold release action needs approval workflow | Hold release is console-only |
| Maintenance & Reliability | SAP PM source contract pending | All maintenance data is mock |

---

## Pilot Status Summary (as of 2026-05-15)

- **5 of 9** workspaces are `ready` or `ready-with-warnings` and `included` in pilot
- **3 of 9** are `in-validation` (active scenario testing in progress)
- **1 of 9** (`maintenance-reliability`) is `proposed` — awaiting SAP PM contract

---

## Next Actions

1. Complete scenario validation for SCN-001 (Batch Release) and SCN-003 (Operations Plan Risk)
2. Schedule SCN-005 (Environmental Monitoring) and SCN-006 (Plant Manager) validation sessions
3. Resolve SAP PM contract to advance Maintenance & Reliability from `proposed` to `in-validation`
4. Initiate stakeholder sign-off requests once scenario validation reaches 80% pass rate
5. Triage FB-SEED-003 (keyboard navigation blocker in Operations Plan Risk)
