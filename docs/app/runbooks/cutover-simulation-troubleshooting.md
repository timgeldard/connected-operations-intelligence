# Cutover Simulation Troubleshooting

**Audience:** Platform engineering, pilot lead  
**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-cutover-simulation`

---

## Simulation Modes

The `CutoverSimulationMode` type defines four ordered states for each legacy system × ConnectIO workspace pair:

| Mode | Description | User Impact |
|---|---|---|
| `off` | No simulation active. Both systems operate independently. | None — users access both systems normally |
| `observe` | ConnectIO shown alongside the legacy system. No redirects. Legacy remains authoritative. | Low — users see ConnectIO without being redirected |
| `simulate-redirect` | Deep links from the legacy system are intercepted and redirected to ConnectIO. Legacy data still live. | Medium — legacy bookmarks and email links land in ConnectIO |
| `simulate-retirement` | Legacy system routes disabled in the simulation context. All traffic goes to ConnectIO. | High — users must use ConnectIO for all covered tasks |

Mode progression is strictly `off → observe → simulate-redirect → simulate-retirement`. There is no automatic promotion; each advancement requires a code change and deployment.

---

## Current Simulation Status (as of 2026-05-15)

| Legacy System | ConnectIO Workspace(s) | Current Mode |
|---|---|---|
| EM Tracker (Excel/SharePoint) | Environmental Monitoring | simulate-retirement |
| Intelex (traceability) | Trace Investigation | simulate-redirect |
| LabWare LIMS | Quality Batch Release, SPC Monitoring | observe |
| Rockwell PhaseManager MES | Operations Plan Risk, Process Order Review | observe |
| Manhattan SCALE WMS | Production Staging, Warehouse 360 Overview | off |
| SAP Plant Maintenance | Maintenance & Reliability | off |

---

## Expected Behaviour Per Mode

**`off`:** ConnectIO workspace exists and is navigable, but is not being used as a substitute. No redirects. Legacy system is accessed via its normal entry points. No simulation-related behaviour visible to users.

**`observe`:** ConnectIO workspace is shown alongside the legacy system. Users can compare outputs. No user workflow changes. The legacy system remains authoritative for all decisions. Findings from observe sessions should be logged in the `CutoverSimulationResult.findings` field.

**`simulate-redirect`:** Users following legacy deep links (bookmarks, email links, system-generated URLs) are intercepted and redirected to the corresponding ConnectIO workspace. The context (e.g. batch ID, order number) should be carried across in the redirect URL. The legacy system's data is still live and accessible via direct navigation.

**`simulate-retirement`:** Legacy system routes are disabled in the simulation context. Users who navigate to the legacy system are redirected to ConnectIO. The legacy system still exists in production but is not reachable via normal navigation paths (bookmarks, nav menus, system links). Legacy direct URLs may still work — this is a known limitation of the simulation model.

---

## Common Blockers

**Redirect not firing (simulate-redirect mode)**

Symptom: User follows a legacy link and lands on the legacy system rather than ConnectIO.

Diagnosis:
1. Confirm the pair is configured in `SIMULATION_PAIRS` in `CutoverSimulationPage.tsx` with mode `simulate-redirect`
2. Confirm the deployment that includes the mode change has been deployed to the target environment
3. Check whether the legacy URL format matches the interception pattern configured for this pair
4. Check the browser console for any redirect exceptions

Resolution: If the interception pattern is incorrect, update `SIMULATION_PAIRS` and redeploy. If the deployment has not reached the target environment, wait for deployment to complete or escalate to DevOps.

**Context not carried across redirect**

Symptom: User follows a legacy link and lands in ConnectIO at the correct workspace but without the expected context (batch ID, order number, etc.) pre-populated.

Diagnosis:
1. Check the `contextScopes` in the `DrillThroughDefinition` for the relevant workspace pair
2. Confirm the legacy URL contains the context parameter in a format the redirect can parse
3. Check the redirect handler in the workspace component for the context extraction logic

Resolution: Update the context extraction logic in the workspace component or the redirect configuration in `SIMULATION_PAIRS`.

**simulate-retirement: users still accessing legacy via direct URL**

Symptom: Users are bypassing the retirement simulation by navigating to the legacy system via a bookmarked direct URL.

This is a known limitation. The `simulate-retirement` mode disables normal navigation entry points but cannot prevent access via direct URL. To fully validate retirement, audit the legacy system's access logs for direct URL access during the simulation period. Any direct URL access during the retirement simulation period should be documented as a finding.

**Simulation result not showing `passed: true`**

Symptom: The `CutoverSimulationResult.passed` field shows `false` in the admin dashboard after a simulation run.

Diagnosis:
1. Review the findings list for the simulation result — look for `severity: 'critical'` or `severity: 'blocker'` findings
2. Confirm whether the passing criteria for this mode have been met (see `docs/migration/cutover-simulation-guide.md`)
3. If the simulation result was set manually and incorrectly, update the result in `CutoverSimulationPage.tsx`'s `SIMULATION_PAIRS` data

---

## Rollback Path

Rollback means reverting a pair from its current mode to the previous mode (e.g. from `simulate-redirect` back to `observe`).

**Process:**
1. Update the `mode` field for the pair in `SIMULATION_PAIRS` in `CutoverSimulationPage.tsx` to the previous mode
2. Deploy the change via the normal ConnectIO CI/CD pipeline
3. Confirm the admin dashboard shows the reverted mode
4. Notify the site lead and super users at the affected site of the mode change
5. Log the rollback event in the Kerry IT project tracker with the reason

**Lead time:** Minimum 5 working days from decision to rollback deployment. For emergency rollback (e.g. a critical incident during simulate-retirement), contact the platform engineering lead directly to expedite.

**Important:** Rollback from `simulate-retirement` restores legacy navigation entry points but does not restore any data that may have been entered into ConnectIO during the simulation period. Verify with the domain team whether any data migration or reconciliation is required after rollback.

---

## When to Escalate

Escalate to the platform engineering lead if:
- A `simulate-retirement` simulation run results in `passed: false` and the findings include `severity: 'critical'` items
- Users report data loss or data inconsistency that cannot be traced to a known mock/source gap
- A rollback cannot be completed within the expected 5-day window due to a deployment pipeline issue
- The cutover simulation dashboard shows an unexpected mode (e.g. a pair shows `simulate-retirement` when it should be `observe`)

Log all escalations in the Kerry IT project tracker with the simulation ID, legacy system ID, and the nature of the issue.
