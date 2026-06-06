# Technical Debt Register — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Phase 0–8 implementation

---

## Severity scale

| Severity | Meaning |
|----------|---------|
| Critical | Blocks production use; not a prototype concern but must be resolved before real users |
| High | Degrades operational credibility or prevents a key capability from being demonstrated |
| Medium | Limits depth or quality; would be noticed by a sophisticated evaluator |
| Low | Clean-up; does not affect function or credibility |

---

## Debt register

| ID | Title | Severity | Category | Location | Detail |
|----|-------|----------|----------|----------|--------|
| TD-001 | All 79 adapter methods return mock fixtures; request params always ignored | Critical | Integration | All `domain-integrations/*/src/*-adapter.ts` | Every method uses `_request` (underscore convention = ignored). No filtering, sorting, or computation applied to request parameters. Zero backend calls. Documented upgrade path: replace method bodies with `fetchJson()` calls in Phase 2. |
| TD-002 | `data-contracts/client.ts` `fetchJson()` never called | Critical | Integration | `packages/data-contracts/src/client.ts` | API client is fully implemented (handles 204, generates request IDs, maps errors) but has zero callers anywhere in the codebase. All data delivery bypasses it. |
| TD-003 | Auth is anonymous; no IdP integration | Critical | Security | `packages/auth-scope/src/ScopeProvider.tsx` | `ANONYMOUS_USER` constant; `isLoading: false` hardcoded; group membership checks use string literals (`'connectio.pilot-access'`). Comment: "In production this checks IdP group membership via the JWT groups claim." |
| TD-004 | All action flows write to console only; no backend mutations | High | Integration | `domain-integrations/quality/src/actions/*.tsx` | 5 action flows (Release Batch, Place on Hold, Request Retest, Escalate Deviation, Open Trace Investigation) emit `console.info` on submit. `release-actions-panel.tsx` line 328: "No real backend mutation is performed in Phase 1." |
| TD-005 | TraceGraphPanel is a placeholder list, not a graph | High | Visualisation | `domain-integrations/traceability/src/panels/trace-graph-panel.tsx` | Renders risk badges and counts. No React Flow or equivalent. Comment line 125: "Graph visualisation (React Flow) will be added in Phase 2." |
| TD-006 | BatchLineagePanel is a placeholder text summary | High | Visualisation | `domain-integrations/traceability/src/panels/BatchLineagePanel.tsx` | Renders batch ID, material, parent/child counts as text. Comment lines 49–52: "A full interactive graph is out of scope for Phase 1." |
| TD-007 | ControlChartPanel is a hand-rolled placeholder SVG | High | Visualisation | `domain-integrations/spc/src/panels/control-chart-panel.tsx` | Math-based SVG coordinate calculation but no chart library, no tooltips, no zoom, no rule annotations. Comment line 69: "upgrade path: replace with recharts/nivo." |
| TD-008 | EnvMonHeatmapPanel is a CSS grid of coloured cards, not a spatial heatmap | High | Visualisation | `domain-integrations/envmon/src/panels/envmon-heatmap-panel.tsx` | No floor-plan geometry, no zone click-through. Expected: spatial facility map with zone risk overlays. |
| TD-009 | Telemetry handler is noop; no real telemetry collected | High | Observability | `packages/telemetry/src/index.ts` | `handler = () => {}` by default; shell app never registers a real handler. `TelemetryDashboardPage` uses 25 hardcoded mock events, not collected data. |
| TD-010 | Feature flags are in-memory only; no remote config | Medium | Configuration | `packages/feature-flags/src/index.ts` | Module-level mutable singleton. No remote fetch, no dynamic update, no persistence. Suitable for dev/test only. |
| TD-011 | Personalisation is localStorage only; no server persistence | Medium | User experience | `packages/personalization/src/` | 5 localStorage hooks; data lost on browser clear; no cross-device sync; no conflict resolution. Silent parse failure: `catch { return null }`. |
| TD-012 | RoleAwareHome uses 8 hardcoded mock arrays for all content | Medium | Core UX | `apps/web/src/pages/RoleAwareHome.tsx` | Home screen displays MOCK_PLAN_RISK_ITEMS, MOCK_PRIORITY_RELEASE_ITEMS, MOCK_ENVMON_ALERTS, MOCK_STAGING_SUMMARY, MOCK_SPC_SIGNALS, MOCK_WAREHOUSE_HOLDS, MOCK_CRITICAL_WORK_ORDERS. None fetched from workspace adapters. |
| TD-013 | 11 pages overshoot prototype scope; hardcoded launch governance content | Medium | Scope | `apps/web/src/pages/` — 11 pages | CutoverSimulationPage, CutoverRecommendationPage, LegacyRetirementPage, ReleaseGatePage, RolloutWavePlanPage, GoNoGoAssessmentPage, StakeholderSignoffPage, SupportReadinessPage, TrainingReadinessPage, ProductionReadinessPage, WorkspaceParityPage. All use hardcoded constants with point-in-time data. |
| TD-014 | Analytics domain is a Phase 0 stub with zero implementation | Medium | Product surface | `domain-integrations/analytics/src/` | 2 files (registration.ts, index.ts); lifecycle = `concept-lab`; no adapters, no panels, no views. Source system undefined. |
| TD-015 | `useManifestHydration` silently swallows all fetch errors | Medium | Reliability | `apps/web/src/registry/useManifestHydration.ts` | API endpoint does not exist in development; hook is wired but silently no-op. Error swallowing makes it invisible in dev. |
| TD-016 | History.replaceState for navigation (no browser back button support) | Medium | Navigation UX | `apps/web/src/shell/useWorkspaceShellState.ts` | `replaceState` used instead of `pushState`; user cannot navigate back to previous workspace with browser back button. |
| TD-017 | 3 placeholder panels use hardcoded hex color literals instead of CSS tokens | Low | Design system | `control-chart-panel.tsx`, `trace-graph-panel.tsx`, `envmon-heatmap-panel.tsx` | See `07-design-system-compliance-report.md` NC-001 through NC-003. |
| TD-018 | No ESLint rule enforcing design system import boundary | Low | Tooling | `eslint.config.mjs` | Import prohibition from shadcn/radix-ui is enforced by comment only in two packages; no automated lint rule to catch violations. |
| TD-019 | No API retry logic in `data-contracts/client.ts` | Low | Reliability | `packages/data-contracts/src/client.ts` | `fetchJson()` throws immediately on non-OK response; no retry, no backoff, no timeout. |
| TD-020 | Scope autoElevate order is hardcoded in product-model | Low | Configuration | `packages/product-model/src/helpers/scope.ts` | `['global', 'region', 'plant', 'line', 'work-centre']` is a hardcoded array, not configurable per deployment. |
| TD-021 | `auth-scope/ScopeProvider` isLoading always false | Low | Auth UX | `packages/auth-scope/src/ScopeProvider.tsx` | No async auth loading state; assumes groups are pre-populated synchronously. Loading spinner never shown. |
| TD-022 | FastAPI backend (`apps/api`) not audited | Low | Coverage gap | `apps/api/` | Backend directory exists but contents were not read in this audit. Status unknown. |
| TD-023 | `python-db` package not audited | Low | Coverage gap | `packages/python-db/` | Package exists; may be a database client for the FastAPI backend. Status unknown. |

---

## Debt summary by category

| Category | Count | Max severity |
|----------|-------|--------------|
| Integration (mock adapters, no API calls) | 2 | Critical |
| Security (auth) | 1 | Critical |
| Action flows (console-only) | 1 | High |
| Visualisation (placeholder panels) | 4 | High |
| Observability (telemetry) | 1 | High |
| Core UX (home screen, navigation) | 2 | Medium |
| Configuration (feature flags, personalisation) | 2 | Medium |
| Scope overshoot (launch governance pages) | 1 | Medium |
| Product surface (analytics stub) | 1 | Medium |
| Reliability (error swallowing, no retry) | 2 | Medium |
| Design system compliance | 2 | Low |
| Coverage gaps (unaudited backend) | 2 | Low |
| **Total** | **23** | |
