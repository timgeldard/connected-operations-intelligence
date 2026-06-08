# What to Keep, Simplify, Remove, or Move to Docs

**Audit date:** 2026-05-16  
**Basis:** Phase 9 functional depth audit and scope analysis

---

## Decision framework

| Decision | Criteria |
|----------|---------|
| **Keep** | Part of the core product; serves a real user need; will be actively developed |
| **Simplify** | Has value but is over-engineered, redundant, or could be consolidated |
| **Remove** | Overshot prototype scope; adds maintenance burden without product value; blocked by Phase 9 rules |
| **Move to docs** | Contains useful content but is not a product surface; better as a markdown reference document |

---

## Product workspaces

| Workspace | Decision | Rationale |
|-----------|----------|-----------|
| `trace-investigation` | **Keep** | Core product workspace; highest conceptual value; graph panels need upgrading (OP-002, OP-004) |
| `quality-batch-release` | **Keep** | Highest-evidence workspace; cross-domain integration showcase; action flows need wiring (OP-003) |
| `operations-plan-risk` | **Keep** | Key planning workspace; cross-domain evidence consumer |
| `envmon-monitoring` | **Keep** | Strong food safety narrative; heatmap needs upgrade (OP-006); drill-throughs are a showcase feature |
| `production-staging` | **Keep** | Practical operations workspace; depth sufficient for pilot |
| `spc-monitoring` | **Keep** | SPC is a core quality need; control chart needs upgrade (OP-005) |
| `process-order-review` | **Keep** | Pilot workspace; reasonable depth for its lifecycle stage |
| `warehouse-360` | **Keep** | Pilot workspace; reasonable depth |
| `maintenance-reliability` | **Keep** | Pilot workspace; SAP PM contract dependency noted |
| `traceability-workspace` (hidden) | **Remove** | Superseded by `trace-investigation`; remove registration and directory |
| `quality-workspace` (hidden) | **Remove** | Superseded by `quality-batch-release`; remove registration and directory |
| `operations-workspace` (hidden) | **Remove** | Superseded by `operations-plan-risk`; remove registration and directory |
| Analytics domain | **Remove or scope** | Phase 0 stub; no source system defined; either define and build or remove entirely |

---

## Shell and administrative pages

| Page | Decision | Rationale |
|------|----------|-----------|
| `RoleAwareHome` | **Keep + fix** | Core home screen; wire to adapter data (OP-001) instead of 8 hardcoded arrays |
| `AdminGovernancePage` | **Keep** | Real implementation deriving from workspace registry; genuinely useful for developers and admins |
| `HelpConceptsPage` | **Keep** | Real informational content; useful for onboarding |
| `HelpGettingStartedPage` | **Keep** | Real informational content |
| `HelpScenariosPage` | **Keep** | Real informational content |
| `FeedbackDrawer` + `FeedbackContext` | **Keep** | Real UX component; wire submit to telemetry (OP-010) |
| `DesignSystemCompliancePage` | **Move to docs** | Content is a hardcoded snapshot; not a product page. Move data to `docs/audit/07-design-system-compliance-report.md` (already done). Remove from router. |
| `RoleScopeMatrixPage` | **Simplify** | Useful governance view; consolidate into `AdminGovernancePage` as a new tab rather than a separate route |

---

## Pilot tracking pages (14 pages)

These 14 pages capture the IE10 pilot execution state as hardcoded snapshots. They have value as a pilot coordination tool but are not product workspaces.

| Page | Decision | Rationale |
|------|----------|-----------|
| `PilotExecutionDashboardPage` | **Keep (pilot only)** | Useful pilot management view; keep until pilot complete |
| `PilotIssueRegisterPage` | **Keep (pilot only)** | Active issue tracking; keep until pilot complete |
| `PilotExitCriteriaPage` | **Keep (pilot only)** | Criteria tracking; keep until pilot complete |
| `ScenarioValidationPage` | **Keep (pilot only)** | Scenario tracking; keep until pilot complete |
| `ScenarioExecutionTrackingPage` | **Keep (pilot only)** | Execution tracking; keep until pilot complete |
| `FeedbackBurnDownPage` | **Keep (pilot only)** | Feedback tracking; keep until pilot complete |
| `FeedbackTriagePage` | **Keep (pilot only)** | Feedback management; keep until pilot complete |
| `PilotSuccessMetricsPage` | **Keep (pilot only)** | Metrics tracking; keep until pilot complete |
| `PilotWorkspacePackPage` | **Keep (pilot only)** | Workspace documentation; keep until pilot complete |
| `SecurityAccessReviewPage` | **Keep (pilot only)** | Access review; keep until pilot complete |
| `DataIntegrationReadinessPage` | **Keep (pilot only)** | Integration tracking; keep until pilot complete |
| `DataQualityGapsPage` | **Keep (pilot only)** | Quality gap tracking; keep until pilot complete |
| `AccessExceptionsPage` | **Keep (pilot only)** | Access exception log; keep until pilot complete |
| `WorkspaceAdoptionPage` | **Keep (pilot only)** | Adoption tracking; keep until pilot complete |

**Note:** After the pilot concludes, all 14 pages should be either removed from the router or archived as static docs. They are not a permanent product surface.

---

## Launch governance pages (11 pages — scope overshoot)

These pages implement features the Phase 9 brief explicitly prohibits. They were built in Phases 7–8. They contain useful planning content but belong outside the product.

| Page | Decision | Rationale |
|------|----------|-----------|
| `CutoverSimulationPage` | **Move to docs** | Simulation config and results are useful planning artefacts; move to `docs/migration/` |
| `CutoverRecommendationPage` | **Move to docs** | Recommendation object is a snapshot; move to `docs/migration/` |
| `LegacyRetirementPage` | **Move to docs** | Legacy system retirement plan; move to `docs/migration/` |
| `ReleaseGatePage` | **Move to docs** | Gate definitions are useful quality criteria; move to `docs/governance/` |
| `RolloutWavePlanPage` | **Remove** | Wave rollout is explicitly prohibited by Phase 9 rules; ROLLOUT_WAVES data is speculative; remove |
| `GoNoGoAssessmentPage` | **Move to docs** | 12-dimension assessment is a useful planning tool; move to `docs/governance/` |
| `StakeholderSignoffPage` | **Move to docs** | Stakeholder list and conditions are reference data; move to `docs/stakeholders/` |
| `SupportReadinessPage` | **Remove** | Launch readiness content; outside prototype scope |
| `TrainingReadinessPage` | **Remove** | Launch readiness content; outside prototype scope |
| `ProductionReadinessPage` | **Move to docs** | Findings useful as audit reference; move to `docs/governance/` or supersede with this audit |
| `WorkspaceParityPage` | **Move to docs** | Parity assessments are reference data; move to `docs/governance/` |

---

## Packages

| Package | Decision | Rationale |
|---------|----------|-----------|
| `design-system` | **Keep** | Production-ready; no changes needed except colour token additions (NC-002) |
| `data-contracts` | **Keep** | Ready to use; API client needs retry logic (AR-008) |
| `product-model` | **Keep** | Comprehensive; no changes needed |
| `workspace-runtime` | **Keep** | Functional; no changes needed |
| `evidence-panel-runtime` | **Keep** | Well-designed; no changes needed |
| `source-adapters` | **Keep** | Simple registry; no changes needed |
| `auth-scope` | **Keep + wire** | Context is correct; needs real IdP integration (AR-001) |
| `feature-flags` | **Keep + wire** | API is correct; needs remote config source (AR-004) |
| `personalization` | **Keep + wire** | localStorage hooks correct; needs server persistence (AR-005) |
| `telemetry` | **Keep + wire** | Sink is correct; needs handler registration (AR-003) |
| `python-db` | **Audit first** | Status unknown; audit before deciding |

---

## Summary counts

| Decision | Count |
|----------|-------|
| Keep | 9 workspaces + 6 shell/admin pages + 14 pilot pages + 10 packages |
| Keep + fix/wire | 3 (RoleAwareHome, auth-scope, personalization) |
| Simplify/consolidate | 1 (RoleScopeMatrixPage → AdminGovernancePage tab) |
| Remove | 3 deferred workspace stubs + 3 launch governance pages + analytics domain stub |
| Move to docs | 8 launch governance pages + 1 admin page |
| Audit first | 1 package (python-db) |
