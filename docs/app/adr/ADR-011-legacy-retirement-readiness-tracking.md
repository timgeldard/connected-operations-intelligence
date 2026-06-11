# ADR-011: Legacy Retirement Readiness Tracking in Admin UI

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

By Phase 5, ConnectIO has 9 workspaces covering 7 distinct legacy system replacement targets:

| ConnectIO Workspace(s) | Legacy System Being Superseded |
|---|---|
| Trace Investigation | Intelex traceability platform |
| Quality Batch Release + SPC Monitoring | LabWare LIMS |
| Operations Plan Risk + Process Order Review | Rockwell PhaseManager MES |
| Environmental Monitoring | In-house Excel/SharePoint EM tracker |
| Production Staging + Warehouse 360 | Manhattan SCALE WMS |
| Maintenance & Reliability | SAP Plant Maintenance |

The project office needs a single view to track retirement readiness across all legacy systems: what is blocking retirement, which ConnectIO workspace supersedes each system, what the data migration and user training status is, and what the target retirement date is.

Currently this information is spread across project plans, a Confluence space, and individual domain team trackers. There is no single governance view.

---

## Decision

A **Legacy Retirement Readiness** admin page is added at `?workspace=admin-legacy-retirement` in the ConnectIO shell.

The page is implemented as `LegacyRetirementPage.tsx` and wired directly in `MainBody.tsx` (same pattern as `AdminGovernancePage`) — no workspace registry entry is required.

Each legacy system is represented by a `LegacySystem` record with:
- `retirementStatus` — `not-started | in-progress | ready | retired`
- `supersededBy` — array of ConnectIO workspace IDs
- `migrationRisk` — `low | medium | high`
- `targetRetirementDate`
- `readinessChecks` — ordered checklist of pass/fail gates
- `notes` — free-text project status

The page displays:
1. A KPI bar showing count per retirement status
2. A status filter tab strip
3. Per-system cards with a readiness progress bar and checklist

Data in Phase 5 is static (hardcoded in the component). In production this would be backed by a project management API or a Confluence-sourced data feed.

---

## Rationale

### Why a static admin page rather than a registry-driven approach?

The workspace registry describes the ConnectIO product model, not the legacy system landscape. Retirement tracking is a project management concern, not a product model concern. Mixing them would clutter the registry with fields that are irrelevant to how workspaces function at runtime.

### Why in the ConnectIO shell rather than a separate tool?

The ConnectIO RAD prototype is the single source of truth for the platform's product model during the RAD phase. Putting the retirement tracker in the same shell makes it discoverable to governance reviewers without requiring a separate login or tool.

### Why hardcoded data in Phase 5?

The retirement tracker is a governance aid for the RAD review, not a live project management tool. Hardcoded data is accurate at the time of the Phase 5 release and can be updated as a code change through the normal review process, which is actually more auditble than a database write.

### Why track the readiness checklist as a flat ordered list?

A flat ordered checklist (6 gates: workspace live at pilot, data migration scoped, all sites rolled out, training complete, integration decommissioned, hypercare complete) is sufficient to signal whether a system is ready for retirement. A full project task graph would require a project management tool.

---

## Consequences

### Positive

- Single governance view of legacy retirement across all 6 systems in scope
- Status counts provide an at-a-glance readiness summary for project office reviews
- Adding a new system is a single TypeScript object in the `LEGACY_SYSTEMS` array
- Status filter lets reviewers focus on "ready to retire" or "in progress" systems

### Negative

- Data is static — it will drift from the actual project status unless the code is updated
- No assignment or action tracking — this is read-only, not a project management tool
- No notification or alert when a system becomes ready to retire

### Mitigations

- A comment at the top of `LegacyRetirementPage.tsx` explicitly states that the data is a Phase 5 snapshot and lists the last update date
- The project team should treat updates to this file as part of their regular release cadence
