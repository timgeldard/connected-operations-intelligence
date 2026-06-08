# Production Readiness Checklist

## Overview

This document tracks the six-gate production readiness checklist for each ConnectIO workspace, the current per-workspace status as of Phase 6, the known production blockers surfaced by the Production Readiness Dashboard, and the go/no-go decision criteria.

The Production Readiness Dashboard (`?workspace=admin-production-readiness`) is the live governance view. This document is the narrative companion — it explains the criteria and records the current state.

---

## The Six-Gate Production Readiness Checklist

Each workspace must pass all six gates before it is eligible for full production rollout.

| Gate | Name | Definition |
|---|---|---|
| 1 | Live at pilot | Workspace carries `lifecycle: 'pilot'` or `lifecycle: 'live'`, is navigable, and has been validated at a pilot site |
| 2 | Data integration connected | Live adapter is deployed and reading from the source system; mock data flag is removed |
| 3 | All sites rolled out | Workspace is accessible and validated at all Kerry sites in scope for this domain |
| 4 | Training complete | Site key users and super users have completed training; training completion records exist in the LMS |
| 5 | Integration decommissioned | The legacy system module that this workspace supersedes has been disabled for the relevant sites |
| 6 | Hypercare complete | Post-go-live hypercare period (minimum 4 weeks) has concluded with no unresolved critical incidents |

---

## Per-Workspace Status — Phase 6 (as of 2026-05-15)

| Workspace | G1: Pilot | G2: Data Integration | G3: All Sites | G4: Training | G5: Decommission | G6: Hypercare | Overall |
|---|---|---|---|---|---|---|---|
| Trace Investigation | DONE | DONE | DONE | DONE | DONE | DONE | **Live** |
| Quality Batch Release | DONE | DONE | DONE | DONE | IN PROGRESS | NOT STARTED | **In Progress** |
| Operations Plan Risk | DONE | DONE | IN PROGRESS | IN PROGRESS | NOT STARTED | NOT STARTED | **In Progress** |
| Environmental Monitoring | DONE | IN PROGRESS | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | **Blocked** |
| Production Staging | DONE | DONE | DONE | DONE | IN PROGRESS | NOT STARTED | **In Progress** |
| SPC Monitoring | DONE | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | **Pilot** |
| Process Order Review | DONE | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | **Pilot** |
| Warehouse 360 Overview | IN PROGRESS | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | **Pilot** |
| Maintenance & Reliability | IN PROGRESS | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | **Pilot** |

**Key:**
- **Live** — all six gates complete; workspace is fully production
- **In Progress** — one or more gates in progress; on track for production
- **Blocked** — a production blocker is preventing gate advancement (see below)
- **Pilot** — gates 1–2 not yet complete; workspace remains in pilot or pre-pilot state

---

## Production Blockers (Phase 6)

The following blockers are surfaced as `severity: 'blocker'` or `severity: 'critical'` findings in the Production Readiness Dashboard. All must be resolved before a go/no-go decision can be made for the affected workspace.

| Blocker ID | Workspace | Description | Owner | Status |
|---|---|---|---|---|
| OPR-001 | Operations Plan Risk | MES adapter for Rockwell PhaseManager is not yet deployed to IE10 production environment. Process order history data feed is unavailable. | di-operations team + IT infrastructure | In progress — estimated Phase 6 Q1 |
| PS-001 | Production Staging | Audit log for staging confirmation events is not persisted — events log to console only. Regulatory compliance requires a durable audit trail before decommissioning Manhattan WMS staging module. | di-operations team | Not started |
| EM-001 | Environmental Monitoring | EM threshold configuration UI is absent — environmental engineers cannot update alert thresholds without a direct database edit. Blocks site rollout beyond IE10. | di-quality team | Not started |
| MR-001 | Maintenance & Reliability | SAP PM contract for work order API access has not been finalised. Live adapter development cannot start until the contract is signed. | Programme management + SAP PM team | Pending contract — estimated 2026-Q2 |
| POR-001 | Process Order Review | Process order scope wiring is not complete — the workspace is scope-agnostic and does not filter by `processOrderId`. Required for multi-order plant environments. | di-operations team | In progress |

---

## Go/No-Go Decision Criteria

A workspace is eligible for a production go/no-go decision when all of the following are true:

1. **Zero critical findings** — the Production Readiness Dashboard shows zero `severity: 'critical'` findings for this workspace
2. **Zero production blockers** — all `blocksProduction: true` findings are resolved (status `ready` or `not-applicable`)
3. **All hypercare sites complete** — every site in the workspace's site rollout plan has completed hypercare (gate 6)
4. **Pilot sign-off on record** — the pilot-site team walkthrough sign-off exists in the project tracker

A workspace that meets criteria 1–3 but has outstanding `severity: 'warning'` findings may proceed to go/no-go. Warning findings are documented in the release notes and scheduled for resolution in the next sprint.

The go/no-go decision is made by the ConnectIO Programme Lead and the relevant Kerry domain lead jointly. The decision is recorded in the project tracker and triggers the `lifecycle` change from `'pilot'` to `'live'` in the workspace registration.
