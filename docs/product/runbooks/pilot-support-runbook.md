# Pilot Support Runbook

**Audience:** Pilot support team, platform engineering  
**Phase:** 7  
**Last updated:** 2026-05-15

---

## Support Roles

| Role | Responsibility |
|---|---|
| Pilot Lead | Owns pilot programme governance; escalates blockers to programme management |
| Platform Engineering | Investigates technical failures; owns runbook; patches code issues |
| Domain Team Lead | First point of contact for domain-specific data quality and integration issues |
| Kerry IE10 Site Super User | First responder for user-facing issues at pilot site |

Issues reported by users should be triaged by the IE10 super user and escalated to platform engineering if they cannot be resolved via the troubleshooting steps below.

---

## How to Triage User Feedback

1. Open `?workspace=admin-pilot-feedback` in the pilot shell
2. Filter to status `new` to see unreviewed items
3. For each item, verify: is the workspace and panel attribution correct? Is the category accurate?
4. Check whether the issue is a known gap (see `docs/pilot/pilot-workspace-pack.md`)
5. If it is a known gap, update status to `triaged` and note the known gap reference
6. If it is a new finding, assign an owner (domain team or `platform-engineering`) and update status to `triaged`
7. If severity is `blocker` or `critical`, immediately notify the platform engineering lead and add to the active sprint

Seed items (FB-SEED-001 through FB-SEED-003) are read-only. Do not attempt to update their status via the UI.

---

## How to Identify Workspace or Panel Failures

**Workspace does not load:** Check the browser console for errors. Look for failed network requests or JavaScript exceptions. If the workspace renders a blank page, check that the `workspaceId` in the URL matches a registered entry in `workspace-registry.ts`. See `docs/runbooks/workspace-troubleshooting.md`.

**Panel shows error state:** The 7-state display machine (`loading | ready | stale | partial | error | unauthorized | not-applicable`) maps failure to the `error` state. Open the browser console and look for the panel ID in error output. The error state renders a consistent error card — the panel ID is shown in the card header. Identify the owning domain from the `EvidencePanelRegistration.ownerDomain` field and escalate to that domain team.

**Panel shows stale state:** The panel data is older than its freshness policy threshold. In the pilot, mock panels always appear stale because mock data is never refreshed. This is expected. If a panel that should be adapter-backed appears stale, check whether the source adapter is returning data. See the workspace troubleshooting runbook.

**Action fails:** Actions log to the browser console in the pilot (no backend persistence). If an action throws an error rather than logging cleanly, this is a defect. Check the console for the action ID and error message and raise as a feedback item.

---

## How to Check Telemetry

In the pilot, telemetry is a front-end mock. The `TelemetryHandler` logs events to the browser console but does not persist to a backend. To review telemetry for a session:

1. Open the browser developer tools (F12)
2. Go to the Console tab
3. Filter for `[telemetry]` prefix
4. Events include workspace navigation, panel load events, action executions, and error events

The Telemetry Dashboard (`?workspace=admin-telemetry`) renders a summary of mock telemetry data. This is static mock data — it does not reflect real user session events.

---

## How to Interpret Readiness Dashboards

**Production Readiness Dashboard** (`?workspace=admin-production-readiness`): Shows aggregate readiness across all workspaces. Use `severity: 'blocker'` and `severity: 'critical'` filter to identify issues requiring immediate attention.

**Pilot Exit Criteria** (`?workspace=admin-pilot-exit-criteria`): Shows the 12 pilot exit criteria with current status. Use this to track whether the pilot is on track for exit.

**Release Gate Dashboard** (`?workspace=admin-pilot-release-gates`): Shows the 10 release gates. Gates at `not-started` or `in-progress` with active blockers require attention.

---

## How to Handle Access Issues

**User cannot see a pilot workspace:** Check that the user's account is in the `connectio.pilot-access` IdP group. In the pilot, this group membership is the gate for `lifecycle: 'pilot'` workspace visibility. If the user is in the group but still cannot see the workspace, clear browser cache and reload.

**User cannot see a live workspace:** Check that the user has the required role (`supportedRoles` in the workspace registration). The pilot uses a client-only auth model — if the user's mock role does not include the workspace's required role, the workspace will not appear in navigation.

**User lands on a "not found" page:** Check the URL. Workspace routes use the `?workspace=<workspaceId>` query parameter pattern. If the `workspaceId` does not match a registered workspace or a known admin route, the shell renders the `NotFound` page.

---

## How to Handle Stale Panel Data

In the pilot, stale panel data is expected for all mock-data panels (SPC, Maintenance, and some Warehouse panels). This is not a defect.

For adapter-backed panels that show unexpected staleness:
1. Identify the panel and its `freshnessPolicy` from the workspace registration
2. Check whether the upstream adapter is returning data at the expected interval
3. If the adapter is failing, escalate to the domain team that owns the adapter

---

## How to Handle Mock/Source Mismatch

A mock/source mismatch occurs when a panel is described as `adapter-backed` but is displaying data that does not match the source system. Steps:

1. Identify the panel ID and the data value that appears incorrect
2. Check `DataIntegrationReadinessPage.tsx` for the adapter status — confirm it is `adapter-backed` not `mocked`
3. Review the adapter implementation for the relevant domain integration package
4. Check whether the adapter is returning mock data as a fallback when the source call fails
5. Raise as a `data-quality` feedback item with `severity: 'warning'` if it affects validation; `severity: 'blocker'` if it prevents a validation scenario from passing

---

## How to Escalate Blockers

Blockers that prevent a release gate from passing or that have `severity: 'critical'` must be escalated within one business day.

**Escalation path:**
1. Super user reports issue via the Feedback button
2. Platform engineering triages and classifies severity
3. If `severity: 'critical'`: notify Pilot Lead immediately; Pilot Lead notifies Programme Lead
4. If `severity: 'blocker'`: add to active sprint; notify domain team lead; update release gate and pilot exit criteria accordingly
5. If the blocker prevents a scenario from passing: update the scenario status to `blocked` in `ScenarioValidationPage.tsx` and notify the scenario owner

Document all escalated blockers in the Kerry IT project tracker (ConnectIO programme milestone) with the feedback item ID, scenario ID (if applicable), and resolution target date.
