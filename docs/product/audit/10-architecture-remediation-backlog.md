# Top 10 Architecture Remediation Backlog — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Scope:** Architecture and integration gaps that must be closed before production use

---

## Prioritisation criteria

Items ranked by: production-readiness impact. Items that block all real users (auth, backend) rank first. Items that are implementation gaps rank after.

---

## Backlog

### AR-001 — Implement IdP authentication integration

| Field | Value |
|-------|-------|
| Impact | **Critical** |
| Effort | High |
| Ref | TD-003 |

**Problem:** `AuthScopeProvider` always uses `ANONYMOUS_USER`. Group membership (`'connectio.pilot-access'`, `'connectio.concept-lab-access'`) is checked against an empty array. All users see all workspaces regardless of role. No JWT parsing. No real identity.

**Remediation:** Wire `AuthScopeProvider` to the Databricks Apps OAuth proxy. On mount, fetch the authenticated user identity from the Databricks Apps user context header or a `/api/me` endpoint. Populate `UserIdentity.groups` from the JWT groups claim. Set `isLoading: true` until the fetch resolves.

**Definition of done:** Users see only workspaces and lifecycle states they are authorised for. Admin pages require group membership. Anonymous access is rejected.

---

### AR-002 — Implement one end-to-end adapter-to-backend wiring as proof of pattern

| Field | Value |
|-------|-------|
| Impact | **Critical** |
| Effort | Medium |
| Ref | TD-001, TD-002 |

**Problem:** Zero adapters call `fetchJson()`. The API client in `data-contracts/src/client.ts` is unused. The Traceability adapter is the most documented: endpoint path `/api/trace2/*` is named in adapter comments. Wiring one domain end-to-end proves the full stack and unblocks all other domains.

**Remediation:** (1) Audit `apps/api` to confirm whether `/api/trace2/*` endpoints exist. (2) If yes, replace `Trace2Adapter` method bodies with `fetchJson()` calls using `data-contracts/client.ts`. (3) Validate Zod schemas on response. (4) Remove `trace2-mock-data.ts` from production build (or keep as fallback).

**Definition of done:** `trace-investigation` workspace displays real data from the FastAPI backend. No mock data file is used in the production path.

---

### AR-003 — Register a real telemetry handler in the shell

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Low |
| Ref | TD-009 |

**Problem:** `telemetry.trackEvent()` is called throughout the codebase but the handler is a noop. No operational data is collected. It is impossible to know how users navigate, which panels are most used, or whether action flows are exercised.

**Remediation:** In `apps/web/src/main.tsx`, call `registerTelemetryHandler()` with a handler that posts events to a backend endpoint (or, at minimum, writes to a session-scoped array for in-browser display). The sink structure is ready — only the registration is missing.

**Definition of done:** All `trackEvent()` calls produce observable output. Navigation events, panel loads, and action completions appear in the telemetry dashboard.

---

### AR-004 — Implement a remote feature flag source

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-010 |

**Problem:** Feature flags are set via `setFeatureFlags()` at startup with a static object. There is no way to gate pilot access or concept-lab access dynamically. Toggling a workspace's lifecycle requires a code change and redeploy.

**Remediation:** On app startup, fetch flags from a backend endpoint (or Databricks-hosted config). Call `setFeatureFlags()` with the response. The existing `isFlagEnabled()` API is unchanged. Fallback to a default set on fetch failure.

**Definition of done:** `pilot-access` and `concept-lab-access` flags can be toggled without a redeploy. A plant manager can be given pilot-access via a config change, not a code change.

---

### AR-005 — Add server-side personalisation persistence

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Medium |
| Ref | TD-011 |

**Problem:** All 5 personalisation hooks write to localStorage. Pinned workspaces, panel order, and saved filters are lost when the user clears their browser or switches device. In a multi-site pilot, users will access ConnectIO from shared terminals where localStorage is not reliable.

**Remediation:** Introduce a `/api/personalisation` backend endpoint. On write, persist to both localStorage (for speed) and backend (for durability). On mount, prefer backend state; fall back to localStorage if the fetch fails.

**Definition of done:** Pinned workspaces survive a browser clear and are consistent across devices for the same user identity.

---

### AR-006 — Audit and document `apps/api` (FastAPI backend)

| Field | Value |
|-------|-------|
| Impact | **High** |
| Effort | Low |
| Ref | TD-022 |

**Problem:** The `apps/api` directory was not read in this audit. Adapter comments reference FastAPI endpoints (`/api/trace2/*`) as the intended wiring target. It is unknown whether these endpoints exist, are stubs, or are not implemented at all.

**Remediation:** Read `apps/api` completely. Document what endpoints exist, their implementation status (stub vs real), and whether they are wired to a real data source. Incorporate findings into the source integration readiness matrix.

**Definition of done:** API endpoint inventory created. Readiness matrix updated.

---

### AR-007 — Add ESLint rule enforcing design system import boundary

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Low |
| Ref | TD-018 |

**Problem:** The prohibition on direct shadcn/radix-ui imports in `workspace-runtime` and `evidence-panel-runtime` is enforced by code comments only. A developer adding a new panel can accidentally import directly from shadcn without triggering any CI check.

**Remediation:** Add a `no-restricted-imports` ESLint rule to `eslint.config.mjs` that prohibits `@radix-ui/*` and `shadcn/ui` imports outside of `packages/design-system/`. This rule runs in CI and catches violations at PR time.

**Definition of done:** `pnpm nx lint web` fails if any domain-integration file imports directly from shadcn or radix-ui.

---

### AR-008 — Implement retry and timeout in `data-contracts/client.ts`

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Low |
| Ref | TD-019 |

**Problem:** `fetchJson()` throws immediately on any non-OK HTTP response. No retry for transient 503s. No timeout for slow responses. In a manufacturing environment with VPN and on-premise systems, transient failures are common.

**Remediation:** Add configurable retry (default 3 attempts, exponential backoff) and a timeout option (default 10s). Use `AbortController` for timeout. Retry only on 5xx and network errors, not on 4xx.

**Definition of done:** `fetchJson()` retries on transient failures. Requests timeout after a configurable interval. Behaviour is covered by tests.

---

### AR-009 — Add adapter test coverage for all domain adapters

| Field | Value |
|-------|-------|
| Impact | **Medium** |
| Effort | Medium |
| Ref | TD-001 |

**Problem:** No test files exist for any domain adapter. When mock adapters are replaced with real API calls (AR-002), there will be no test harness to validate the replacement. Adapter tests should validate the contract between the component and the adapter, not the API itself.

**Remediation:** For each domain adapter, add a vitest test file that: (1) calls each method with valid and invalid request shapes, (2) asserts the response shape against the Zod schema, (3) verifies that required fields are present. These tests run against mock data now and real data later — the test body does not change.

**Definition of done:** Each adapter file has a corresponding `.test.ts` file. `pnpm nx test <domain>` passes.

---

### AR-010 — Define and implement the Analytics domain

| Field | Value |
|-------|-------|
| Impact | **Low** |
| Effort | High |
| Ref | TD-014 |

**Problem:** The analytics domain is a Phase 0 concept-lab stub with no adapters, no panels, no views, and no defined source system. It appears in the domain list, creating an expectation that is not met.

**Remediation:** Either: (a) define the analytics domain scope (what data, which source system, what user need it serves), build adapters and panels, then promote to lifecycle: pilot; or (b) remove the registration from the workspace registry and delete the `domain-integrations/analytics/` directory to reduce noise.

**Definition of done:** Analytics domain either has a functioning pilot workspace, or is removed entirely.

---

## Summary table

| ID | Title | Impact | Effort | Debt Ref |
|----|-------|--------|--------|----------|
| AR-001 | IdP authentication integration | Critical | High | TD-003 |
| AR-002 | End-to-end adapter wiring (Traceability first) | Critical | Medium | TD-001, TD-002 |
| AR-003 | Register real telemetry handler | High | Low | TD-009 |
| AR-004 | Remote feature flag source | High | Medium | TD-010 |
| AR-005 | Server-side personalisation persistence | High | Medium | TD-011 |
| AR-006 | Audit `apps/api` FastAPI backend | High | Low | TD-022 |
| AR-007 | ESLint rule for design system boundary | Medium | Low | TD-018 |
| AR-008 | Retry and timeout in API client | Medium | Low | TD-019 |
| AR-009 | Adapter test coverage | Medium | Medium | TD-001 |
| AR-010 | Define or remove analytics domain | Low | High | TD-014 |
