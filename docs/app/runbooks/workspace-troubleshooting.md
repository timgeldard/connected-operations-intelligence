# Workspace Troubleshooting

**Audience:** Pilot support team, platform engineering  
**Phase:** 7  
**Last updated:** 2026-05-15

This runbook covers the most common workspace-level issues encountered during the pilot and how to diagnose and resolve them.

---

## 1. Workspace Does Not Load

**Symptoms:** Navigating to a workspace URL results in a blank page, a "not found" message, or an infinite loading state.

**Diagnosis steps:**
1. Check the URL — workspace routes follow the pattern `?workspace=<workspaceId>`. Verify the `workspaceId` is correct (e.g. `quality-batch-release`, not `quality-batch-release-workspace`).
2. Open the browser console. Look for JavaScript errors or failed imports.
3. Confirm the workspace is registered in `apps/web/src/registry/workspace-registry.ts`.
4. Confirm the workspace has a corresponding branch in `WorkspaceViews.tsx`.
5. Check the workspace `lifecycle` — if `lifecycle: 'deprecated'` or `lifecycle: 'hidden'`, the workspace will not render even if directly navigated.

**Resolution:** If the workspace is registered and the URL is correct, a blank page usually indicates a JavaScript module error. Check the console for the specific component that failed and review recent changes to that domain integration package.

---

## 2. Panel Fails (Shows Error State)

**Symptoms:** A panel renders an error card rather than its data content. The error state shows the panel ID and a brief error description.

**Diagnosis steps:**
1. Note the panel ID from the error card.
2. Open the browser console and search for the panel ID to find the underlying error.
3. Identify the owning domain from the `EvidencePanelRegistration.ownerDomain` field in the panel component file.
4. Check whether the panel's data query hook is failing (network error, schema validation failure, or adapter exception).

**Resolution:** For network/adapter errors, escalate to the owning domain team. For schema validation failures, check whether the Zod schema in `packages/data-contracts` matches the shape returned by the adapter.

---

## 3. Panel Shows Stale State

**Symptoms:** A panel renders its data but shows a staleness indicator (typically a clock icon or amber border).

**Diagnosis steps:**
1. Check the panel's `freshnessPolicy.maxAgeSeconds` in the panel registration.
2. Determine when the data was last fetched. The `useEvidencePanel` hook manages the staleness timer.
3. For mock-data panels (SPC, Maintenance), staleness is expected and permanent — mock data is never refreshed.
4. For adapter-backed panels, check whether the adapter is being called at the expected interval.

**Resolution:** If a non-mock panel is permanently stale, the adapter's polling or invalidation logic may be misconfigured. Review the `useQuery` or `useEvidencePanel` configuration in the panel component.

---

## 4. Drill-Through Broken

**Symptoms:** Clicking a drill-through button navigates to a blank page, a 404, or the wrong workspace/view.

**Diagnosis steps:**
1. Identify the source workspace and the drill-through label from the Governance Registry (`?workspace=admin-governance` → Drill-through Map tab).
2. Confirm the `targetWorkspaceId` and `targetViewId` in the source workspace's `drillThroughDefinitions` are correct.
3. Confirm the target workspace is registered and navigable (lifecycle is not `deprecated` or `hidden`).
4. Confirm the `targetViewId` exists in the target workspace's `defaultViews`.
5. Check whether the context scope (e.g. `batchId`) is being carried across the navigation correctly.

**Resolution:** Update the `drillThroughDefinitions` in the source workspace's registration file. Ensure the `targetViewId` matches an existing `viewId` in the target workspace's `defaultViews`.

---

## 5. Wrong Workspace Visibility

**Symptoms:** A user can see a workspace they should not be able to see, or cannot see a workspace they should be able to see.

**Diagnosis steps:**
1. Check the workspace `lifecycle`. `pilot` workspaces require `connectio.pilot-access` IdP group membership.
2. Check the workspace `supportedRoles`. If the user's role is not in the list, the workspace will not appear in navigation.
3. In the pilot, the auth model is client-only — check the mock role assignment in the shell state.

**Resolution:** For `pilot` lifecycle visibility issues, confirm IdP group membership. For role-based visibility issues, confirm the user's role matches one of the `supportedRoles` in the workspace registration. Note: the pilot uses a mock auth model; real enforcement requires server-side implementation.

---

## 6. Wrong Scope Default

**Symptoms:** A workspace opens but shows data for the wrong site, batch, or scope level.

**Diagnosis steps:**
1. Check the workspace's `scopePolicy.defaultLevel` and `scopePolicy.autoElevate` settings in its registration.
2. If `autoElevate` is `true`, the shell calls `resolveDefaultScope()` to select the broadest authorised scope. Check what scope the user is authorised for.
3. Check whether the scope context is being passed correctly via `WorkspaceContext`.

**Resolution:** If the default scope is incorrect for the user's role, review the `scopePolicy` in the workspace registration. For scope-specific data mismatches, check that each evidence panel's `requiredContext` entries align with the scope being provided.

---

## 7. Action Validation Issue

**Symptoms:** An action form shows a validation error that prevents submission, or an action completes without error but produces no visible result.

**Diagnosis steps:**
1. Open the browser console. Actions in the pilot log to console on execution.
2. Check for a Zod validation error — these appear when the action input does not match the expected schema.
3. If the action executes without a visible result: the pilot uses console-only action handlers. No backend state is persisted. This is expected.

**Resolution:** Zod validation errors on valid-looking input indicate a schema mismatch between the action form and the data contract in `packages/data-contracts`. Review the relevant schema and action handler.

---

## 8. Legacy Route Mapping Issue

**Symptoms:** A user following a legacy system deep link (bookmark or email link) lands on the wrong ConnectIO workspace, or receives a 404.

**Diagnosis steps:**
1. Check the current `CutoverSimulationMode` for the relevant legacy system × workspace pair in `?workspace=admin-cutover-simulation`.
2. If mode is `simulate-redirect`: confirm the legacy URL interception is configured correctly in `CutoverSimulationPage.tsx`'s `SIMULATION_PAIRS` configuration.
3. If mode is `off`: no redirect interception is active. The user is expected to navigate ConnectIO manually.
4. Check the `contextScopes` in the drill-through definition for the legacy link target — the context must carry across the redirect.

**Resolution:** Legacy route mapping is a deliberate code change, not a configuration toggle. If the mapping is incorrect, raise with the platform engineering team to update `SIMULATION_PAIRS`. See `docs/migration/cutover-simulation-guide.md` for the advancement process.
