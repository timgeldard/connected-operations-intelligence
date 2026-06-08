# Pilot Review Guide

**Audience:** Domain stakeholders, site leadership  
**Phase:** 7  
**Last updated:** 2026-05-15

This guide explains how to review the ConnectIO-RAD V2 pilot, which scenarios to validate, what feedback to provide, what to expect (and not expect) from the pilot environment, and how formal sign-off works.

---

## How to Access the Pilot

The ConnectIO-RAD V2 pilot is accessible at the standard ConnectIO URL. You need membership of the `connectio.pilot-access` IdP group. If you do not have access, contact the Kerry IT helpdesk or the Pilot Lead.

Once logged in, the home screen shows your role-relevant workspaces and priority items. Use the navigation rail on the left or press Ctrl+K to search for a specific workspace by name.

---

## Which Scenarios to Validate

Run the scenarios that correspond to your domain and role. Open the Scenario Review Guide (`?workspace=help-scenarios`) for step-by-step instructions for each scenario.

| Your Role | Recommended Scenarios |
|---|---|
| Quality Lead | TRN-001 (Batch Release), TRN-005 (Environmental Monitoring) |
| Food Safety Lead | TRN-002 (Trace Investigation) |
| QA Technician | TRN-001 (Batch Release) |
| Operations Supervisor | TRN-003 (Plan Risk) |
| Warehouse Manager | TRN-004 (Production Staging) |
| Plant Manager | TRN-006 (Cross-Domain Site Review) |

Each scenario is estimated at 10–20 minutes. You do not need to complete all scenarios — focus on the ones most relevant to your daily work.

---

## What Feedback to Provide

After running each scenario, use the Feedback button to record your observations. The most valuable feedback for the pilot team covers:

**Data accuracy** — Does the data match what you know to be true? If you can see a batch in both ConnectIO and the source system, does the quality result, trace graph, or hold status match?

**Missing evidence** — Is there a piece of information you expected to see in a workspace panel that was absent? Name the specific data point (e.g. "I expected to see the deviation reference number on the MIC failure panel").

**Workflow fit** — Does the workspace reflect how your team actually works? Are the actions in the right order? Are there steps you expected to take in ConnectIO that are not available?

**Terminology** — Is any label, panel name, or action name confusing or incorrect for your domain? Correct terminology is important for user adoption.

**Blockers** — Did anything prevent you from completing a scenario step? Mark these as `severity: blocker` in the feedback form.

---

## What Not to Expect Yet

The pilot has known limitations that are documented and accepted:

- **Mock data for some workspaces:** SPC Monitoring and Maintenance & Reliability run entirely on mock data. The data is representative but not live. Do not validate data accuracy for these workspaces — validate the structure, layout, and workflow instead.
- **No write-back to source systems:** Actions in the pilot log to the browser console but do not send data to ERP, LIMS, MES, or WMS. A "Release Batch" action will not actually release a batch in LabWare.
- **No multi-site switching:** The pilot is scoped to Kerry Listowel (IE10). Scope selectors for other sites are not functional.
- **No training records:** Completing a training scenario does not create a record in any LMS.
- **Governance admin pages are visible to all roles:** In the pilot, all users can access admin pages (`?workspace=admin-*`). This is intentional for pilot reviewers but will be restricted to admin roles before production.

---

## How to Interpret Mocked vs Integrated Data

Look at the freshness and confidence indicators on each evidence panel:

- A panel with a freshness indicator showing a recent timestamp is adapter-backed (connected to a source system, even if via an adapter layer).
- A panel with a "mock" label or a permanently stale indicator is running on static mock data.
- A panel with an error state has failed to load data from its source — this may indicate an adapter issue.

For the pilot at IE10, the most source-connected workspaces are Trace Investigation, Quality Batch Release, and Production Staging. SPC Monitoring and Maintenance & Reliability are mock-only.

---

## How Sign-Off Works

Formal sign-off is domain-scoped. Each domain stakeholder has a `StakeholderSignoff` record that covers the workspaces owned by their domain.

The sign-off process:
1. The Pilot Lead initiates a formal sign-off request and sends you a review pack (pilot workspace documentation + scenario validation results for your domain workspaces)
2. You run or observe the relevant validation scenarios
3. You document any conditions — things that must be resolved before you will approve the workspaces for production rollout
4. The Pilot Lead updates your sign-off record with the outcome
5. If conditions are acceptable, status moves to `approved-with-conditions`; if no conditions, `approved`

Current sign-off status by domain:
- Quality & Food Safety (SO-001, Dr. Siobhan Walsh): requested
- Manufacturing Operations (SO-002, Declan Horgan): requested
- Warehouse & Supply Chain (SO-003, Aoife Murphy): in-progress
- Maintenance & Reliability (SO-004, Brian O'Sullivan): not-requested (blocked on SAP PM contract)
- Plant Leadership (SO-005, Niall Brennan): requested
- Platform Engineering (SO-006, Cliona McCarthy): in-progress
- Data Architecture (SO-007, Fiona Gallagher): not-requested
- Security / Access (SO-008, Paul Hennessy): not-requested

Sign-off does not mean the workspaces are ready for immediate production rollout — it means you have reviewed the workspaces, documented your conditions, and agreed that the direction is correct. Production readiness requires additional gates (data integration, server-side security, full site rollout) beyond what the pilot demonstrates.

To initiate or progress your sign-off, contact the Pilot Lead directly or raise a request via the Kerry IT project tracker (ConnectIO programme milestone).
