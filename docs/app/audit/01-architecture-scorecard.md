# Architecture Scorecard — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Phase 0–8 implementation  
**Auditor:** Phase 9 audit

---

## Scoring key

| Rating | Meaning |
|--------|---------|
| Green | Implemented, production-credible |
| Amber | Partially implemented; gap documented and intentional |
| Red | Not implemented; gap blocks production use |

---

## Dimension scores

| # | Dimension | Rating | Evidence | Notes |
|---|-----------|--------|----------|-------|
| 1 | Layered package architecture | Green | 10 separate packages under `packages/`; clear separation of design-system, data-contracts, product-model, runtimes, adapters | No circular deps detected |
| 2 | Domain isolation | Green | 8 `domain-integrations/*` packages each own adapters, panels, views, mock data | Consistent pattern across all domains |
| 3 | Design system boundary | Green | `workspace-runtime` and `evidence-panel-runtime` both carry explicit import prohibitions against shadcn/radix-ui; all UI routes through `@connectio/design-system` | Prohibitions are documented in package index.ts comments |
| 4 | Data contract layer | Amber | Zod schemas exist for all 9 domains in `data-contracts/src/`; `fetchJson()` API client is implemented | `fetchJson()` is never called anywhere — all adapters return mock fixtures; contracts are design-time only |
| 5 | Adapter registry | Green | `source-adapters` singleton registry is implemented; `register()`, `get()`, `has()` methods functional | Simple but complete; ready for real adapter swap-in |
| 6 | Adapter pattern (mock→real) | Green | All 79+ adapter methods are `async`, use `_request` naming convention, return typed `ok(mock, timestamp)` | Consistent async surface means real API wiring requires only method body replacement |
| 7 | Authentication integration | Red | `AuthScopeProvider` hardcodes `ANONYMOUS_USER`; `isLoading` always `false`; no JWT parsing; group checks use string literals (`'connectio.pilot-access'`) | Comment notes: "In production this checks IdP group membership via the JWT groups claim" — not implemented |
| 8 | Telemetry pipeline | Amber | `trackEvent()` sink exists in `telemetry/src/index.ts`; handler noop by default | Shell app never registers a real handler; all pilot-phase telemetry data in `TelemetryDashboardPage` is hardcoded, not collected |
| 9 | Feature flag system | Amber | In-memory flag registry; `isFlagEnabled()`, `isLifecycleEnabled()` implemented | No remote config fetch, no dynamic updates; suitable for dev/test, not production |
| 10 | Backend API integration | Red | Zero HTTP calls anywhere in the codebase; `data-contracts/client.ts` `fetchJson()` unused; FastAPI backend referenced in adapter comments but not connected | Adapters explicitly document Phase 2 wiring point |
| 11 | Personalisation persistence | Amber | 5 localStorage hooks in `personalization/` for pins, recents, panel order, filters, role defaults | No server-side persistence; data lost on browser clear; no cross-device sync |
| 12 | Test coverage | Amber | `product-model` and `data-contracts` have test files; `workspace-runtime` has partial tests (grid, tabs, scope bar) | Domain adapter tests, page tests, shell tests are absent or sparse |
| 13 | Cross-domain evidence wiring | Green | 5 cross-domain evidence flows implemented (Maintenance→Operations, Quality→Operations, SPC→Quality, Operations→Quality, Warehouse→Quality, Trace→Quality) | Wiring is via mock data; cross-domain query structure is correct |
| 14 | Drill-through navigation | Green | `DrillThroughDefinition` in product-model; drill-through buttons and `useWorkspaceShellState` URL navigation implemented | URL-state-driven; no browser back-entry creation is a known UX limitation |

---

## Overall architecture rating

| Category | Score |
|----------|-------|
| Structure & separation | 5/5 Green |
| Data & contracts | 2/5 Green, 2/5 Amber, 1/5 Red |
| Integration & runtime | 0/4 Green, 2/4 Amber, 2/4 Red |
| **Total** | **7 Green, 4 Amber, 3 Red** |

**Verdict:** The architectural skeleton is production-credible. Package layering, domain isolation, design system boundary, and adapter patterns are all well-executed. The three Red dimensions (auth, backend API, telemetry handler) are known gaps, not accidents — each has a documented upgrade path. No structural rewrites are needed to move from prototype to production.

---

## Architecture drift findings

| Finding | Severity | Detail |
|---------|----------|--------|
| Analytics domain is a Phase 0 stub with no adapters or panels | Low | `domain-integrations/analytics/src` has 2 files (registration.ts + index.ts); lifecycle = `concept-lab`; zero implementation |
| `useManifestHydration` silently swallows all fetch errors | Low | API endpoint does not exist; hook is wired but intentionally no-op |
| History.replaceState used for navigation (no browser back) | Low | `useWorkspaceShellState` uses `replaceState`, not `pushState`; intended for prototype, needs review for production |
| Scope autoElevate order is hardcoded | Low | `packages/product-model/src/helpers/scope.ts`: `['global', 'region', 'plant', 'line', 'work-centre']` — not configurable |
| No retry logic in API client | Medium | `data-contracts/client.ts` throws immediately on non-OK; no backoff or retry for transient failures |
