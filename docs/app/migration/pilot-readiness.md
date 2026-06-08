# Pilot Readiness Guide

## What "Pilot Ready" Means

A workspace is pilot ready when it meets all of the following:

- **Navigable with `lifecycle: 'pilot'`** — the workspace registration sets `lifecycle: 'pilot'` and is wired into `MainBody.tsx` and the workspace registry
- **Mock data in place** — the workspace renders with realistic, site-representative mock data; a live adapter is not required for pilot readiness
- **Pilot badge visible** — the workspace card in the Governance Registry shows the "pilot" lifecycle badge
- **Functional action panels** — action panels (raise request, submit, escalate, etc.) execute their handler functions without errors; console-only logging is acceptable for pilot, but handlers must not throw or render error states
- **Home section present** — the workspace contributes a section to the role-appropriate home screen (My Work, Plant Overview, or Quality Overview)
- **Drill-throughs declared** — any cross-workspace drill-through targets are declared in the workspace registration and resolve without 404

Pilot readiness does not require:
- A live ERP, LIMS, CMMS, or WMS adapter
- Persistence of action outcomes beyond the browser session
- Multi-site scope switching

---

## Phase 5 Pilot Workspaces

The four Phase 5 workspaces carry `lifecycle: 'pilot'` as of the Phase 5 release:

| Workspace | ID | Domain Package | Primary Legacy System |
|---|---|---|---|
| SPC Monitoring | `spc-monitoring` | `di-quality` | LabWare LIMS (SPC module) |
| Process Order Review | `process-order-review` | `di-operations` | Rockwell PhaseManager MES |
| Warehouse 360 Overview | `warehouse-360-overview` | `di-warehouse` | Manhattan SCALE WMS |
| Maintenance & Reliability | `maintenance-reliability` | `di-maintenance` | SAP Plant Maintenance |

All four pilot first at Kerry Listowel (IE10) with mock data representing March 2024 plant state.

---

## Known Limitations at Pilot

| Workspace | Limitation | Impact |
|---|---|---|
| All four | All data is mock — action panel outcomes log to console only | No persistence; outcomes do not flow to source systems |
| Process Order Review | Scope-agnostic in Phase 5 — always shows mock order PO-IE10-2024-03127 | Cannot switch between real orders |
| SPC Monitoring | Control charts are static — no interactive zoom or point inspection | Limited root-cause investigation capability |
| SPC Monitoring | No alarm rule editor | Read-only; cannot adjust control limits |
| Warehouse 360 Overview | Replenishment requests are console-only | Cannot raise live WMS transfer orders |
| Maintenance & Reliability | Work order backlog is hardcoded — no filtering by equipment ID or priority | All open WOs shown regardless of user scope |
| Maintenance & Reliability | SAP PM adapter contract not yet finalised | Live integration cannot start until Phase 6 |

---

## Pilot Readiness Checklist (8 Gates)

The following gates must all pass before a workspace is signed off as pilot ready.

| Gate | Description | Verification Method |
|---|---|---|
| 1. Type-checks | `pnpm nx typecheck <domain-package>` passes with zero errors | CI check |
| 2. Tests pass | `pnpm nx test <domain-package>` passes with zero failures | CI check |
| 3. Registration wired | Workspace appears in `WorkspaceRegistry` and in `MainBody.tsx` routing | Code review |
| 4. Home section present | Workspace contributes a card or section to the appropriate home screen role view | Manual walkthrough |
| 5. Drill-throughs declared | All `drillThroughTargets` in the workspace registration resolve to navigable workspaces | Manual walkthrough |
| 6. CommandPalette accessible | Workspace appears in CommandPalette search results and navigates correctly | Manual walkthrough |
| 7. Governance pilot badge | Admin Governance page shows the workspace under the `pilot` lifecycle group with correct badge | Manual walkthrough |
| 8. Pilot-site team walkthrough | Kerry IE10 domain team has completed a guided walkthrough of the workspace and signed off | Sign-off record in project tracker |

---

## Pilot Status as of 2026-05-15

| Workspace | Gates 1–7 | Gate 8 (Team Sign-off) | Overall Status |
|---|---|---|---|
| SPC Monitoring | DONE | DONE | **Pilot Ready** |
| Process Order Review | DONE | DONE | **Pilot Ready** |
| Warehouse 360 Overview | DONE | NOT DONE | **Pending Sign-off** |
| Maintenance & Reliability | DONE | NOT DONE | **Pending Sign-off** |

**Notes:**
- Warehouse 360 Overview gate 8 is blocked on the Kerry IE10 logistics team availability; walkthrough is scheduled for the week of 2026-05-18
- Maintenance & Reliability gate 8 is blocked on the SAP PM contract finalisation — the domain team does not want to sign off on a workspace before the live integration path is confirmed; estimated resolution Phase 6 Q1
