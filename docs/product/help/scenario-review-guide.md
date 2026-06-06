# Scenario Review Guide

**Audience:** Pilot users  
**In-app page:** `?workspace=help-scenarios`

## How to Use This Guide

This guide gives you six training scenarios to learn ConnectIO-RAD V2 through your real work. Each scenario is a step-by-step walkthrough of a business task using one or more pilot workspaces. The scenarios are linked to the formal validation scenarios in the Scenario Validation Centre (`?workspace=admin-pilot-scenario-validation`).

Run the scenarios that match your role. After completing each one, use the Feedback button to record your observations. Your feedback becomes part of the formal pilot validation record.

---

## TRN-001 — Release Your First Batch in V2

**Role:** Quality Lead  
**Workspace:** Quality Batch Release  
**Estimated time:** 15 minutes  
**Difficulty:** Introductory

Steps:
1. Open the Quality Batch Release workspace
2. Select the Release Queue view
3. Choose a batch with status "under-review"
4. Switch to the Batch Decision view
5. Review all 8 evidence panels
6. Check for SPC signals and quality results
7. Use "Open Trace Investigation" drill-through to verify trace
8. Return to Batch Release and initiate the Release Batch action

Related validation scenario: SCN-001.

---

## TRN-002 — Investigate a Trace Event

**Role:** Food Safety Lead  
**Workspace:** Trace Investigation  
**Estimated time:** 20 minutes  
**Difficulty:** Standard

Steps:
1. Open the Trace Investigation workspace
2. Create a new investigation using the "New Investigation" action
3. Review the Trace Graph panel to see supplier exposure
4. Check the Customer Impact panel for distribution exposure
5. Review the Event Timeline panel for chronological events
6. Check Risk Signals panel for associated alerts
7. Add evidence to the investigation
8. Escalate the investigation if required

Related validation scenario: SCN-002.

---

## TRN-003 — Check Your Shift Plan Risk

**Role:** Operations Supervisor  
**Workspace:** Operations Plan Risk  
**Estimated time:** 10 minutes  
**Difficulty:** Introductory

Steps:
1. Open the Operations Plan Risk workspace
2. Review the Plan Risk Summary panel
3. Check for late orders in the Late Orders panel
4. Review material shortages
5. Check quality blockers panel for release constraints
6. Use the Escalate Blocker action if critical
7. Create a Handover Note if passing shift

Related validation scenario: SCN-003.

---

## TRN-004 — Confirm Production Staging Readiness

**Role:** Warehouse Manager  
**Workspace:** Production Staging  
**Estimated time:** 12 minutes  
**Difficulty:** Standard

Steps:
1. Open the Production Staging workspace
2. Review the Staging Summary panel for overall readiness
3. Check missing picks in the Missing Picks panel
4. Review quality restrictions that may block staging
5. Prioritise any open picks using the Prioritise Pick action
6. Check line-side readiness before confirming staging
7. Use Confirm Staging action to complete the session

Related validation scenario: SCN-004.

---

## TRN-005 — Monitor Environmental Risk at Plant Scope

**Role:** Quality Lead  
**Workspace:** Environmental Monitoring  
**Estimated time:** 10 minutes  
**Difficulty:** Introductory

Steps:
1. Open the Environmental Monitoring workspace
2. Review the Plant Risk Summary panel
3. Check the Environmental Alerts panel for active detections
4. Review the Heatmap to identify high-risk zones
5. Check the Organism Trend panel for recurring organisms
6. Acknowledge active alerts using the Acknowledge Alert action
7. Create a corrective action if required

Related validation scenario: SCN-005. Note: threshold configuration is hardcoded in the pilot — you cannot simulate a threshold breach.

---

## TRN-006 — Plant Manager Cross-Domain Site Review

**Role:** Plant Manager  
**Workspace:** Home Screen (all domains)  
**Estimated time:** 20 minutes  
**Difficulty:** Advanced

Steps:
1. Start at the home screen — review all domain priority sections
2. Check Quality Batch Release priority items
3. Check Operations Plan Risk summary
4. Check Environmental Monitoring active alerts
5. Check Production Staging readiness
6. Check SPC active signals
7. Check Warehouse open holds
8. Check Maintenance priority work orders
9. Drill into any workspace needing attention
10. Complete the review without using any legacy application

Related validation scenario: SCN-006. Note: the plant-manager home screen personalisation is still in progress — some sections may not yet display in the intended order.

---

## What Feedback to Provide After Running a Scenario

After completing any scenario, record your observations using the Feedback button. Focus on:

- **Data accuracy** — Does the data match what you know to be true in the source systems?
- **Missing panels** — Is there evidence you expected to see that was absent?
- **Confusing labels** — Is any terminology unclear or incorrect for your domain?
- **Broken actions** — Did any action fail to execute or produce an unexpected result?
- **Navigation friction** — Were there more steps than expected to reach the information you needed?
- **Mock data** — Note which panels appeared to show placeholder or clearly incorrect data

Use the category and severity fields to help the pilot team triage your feedback:
- Use `data-quality` for incorrect or stale data
- Use `missing-evidence` for absent panels or fields
- Use `defect` for broken functionality
- Use `usability` or `terminology` for UX or language issues
- Use `blocker` severity only if the issue prevented you from completing the scenario task
