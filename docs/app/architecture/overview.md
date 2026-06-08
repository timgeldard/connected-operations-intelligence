# Architecture Overview — ConnectIO RAD V2

## System context

ConnectIO RAD V2 is a supply-chain visibility application for Kerry Ingredients manufacturing operations. It aggregates evidence from multiple operational source systems into role-aware supervisor workspaces. V2 runs as a single Databricks App combining a React frontend with a FastAPI proxy backend.

```
Browser
  └─ Databricks Apps (TLS + OAuth2 token forwarding)
       └─ FastAPI  apps/api/
            ├─ /api/trace2/...   → V1 Trace2 or native Databricks QuerySpec routes
            ├─ /api/warehouse360/... → native Databricks QuerySpec routes
            ├─ /api/wh360/...    → V1 Warehouse 360 proxy route
            ├─ /api/por/...      → V1 POH or native Databricks QuerySpec routes
            ├─ /api/envmon/...   → native Databricks QuerySpec routes
            └─ /                 → React bundle (StaticFiles)
```

In local development, Vite serves the frontend (port 4200) and FastAPI runs separately (port 8000).

---

## Monorepo structure

The repository is an Nx monorepo (npm workspaces):

```
apps/
  web/            React frontend (Vite, React 19, TypeScript)
  api/            FastAPI proxy backend (Python 3.11+, uvicorn)

domain-integrations/
  traceability/   Trace2 domain — trace investigation, batch traceability
  warehouse/      Warehouse 360 domain — WMS stock, movements, replenishment
  operations/     POH + plan domain — process order review, plan risk
  quality/        QM domain — batch release, quality governance
  spc/            SPC domain — statistical process control monitoring
  maintenance/    Maintenance domain — equipment reliability
  envmon/         Environmental monitoring domain
  analytics/      Cross-domain analytics (<!-- TODO: describe scope when implemented -->)

packages/
  data-contracts/         Zod schemas + TypeScript types (source of truth for data shapes)
  product-model/          EvidencePanelRegistration, WorkspaceRegistration types
  evidence-panel-runtime/ EvidencePanel component and useEvidencePanel hook
  workspace-runtime/      StandardWorkspaceTemplate, workspace navigation
  source-adapters/        AdapterResult<T>, AdapterError, AdapterSource
  design-system/          Design tokens and base UI components
  auth-scope/             ScopeContext, role definitions, permission types
  feature-flags/          Feature flag client
  personalization/        User personalization hooks
  telemetry/              Analytics and telemetry primitives
  python-db/              Python database utilities for the FastAPI backend
  shared-playwright/      Shared Playwright test utilities

tests/            End-to-end Playwright tests
```

---

## Domain-integration pattern

Each domain-integration (`di-*`) owns:

1. **Adapters** — data fetching layer with three tiers (mock → legacy-api → databricks-api)
2. **Panels** — `EvidencePanel` components for individual data views
3. **Views** — view compositions (1–4 panels arranged for a supervisor task)
4. **Workspace** — root component that wires views with `StandardWorkspaceTemplate`
5. **Registration** — workspace registration declaring views, navigation, permissions

### Adapter tiers

```
MockAdapter                     always works, returns fixture data
  └── LegacyApiAdapter          overrides only verified V1 endpoints
        └── DatabricksApiAdapter  native route adapter where implemented
```

`VITE_ADAPTER_MODE` selects the frontend adapter tier at module init in each
adapter factory. `BACKEND_ADAPTER_MODE` separately controls whether mode-gated
FastAPI routes proxy to V1 or execute native Databricks QuerySpecs. In UAT,
native Databricks paths are functional for Traceability lineage, EnvMon
site-summary/swab-results, multiple POH process-order slices, Warehouse 360
overview groundwork, and CQ Lab plants. Unverified legacy methods may fall
back to `super` (mock), but native Databricks routes must return explicit
errors rather than silently falling back to mock or V1 data.

**Trim principle:** proxy routes and adapter overrides are added only when the corresponding V1 endpoint has been browser-verified. Speculative routes are not added.

### Evidence Panel pattern

Every data panel declares:

```typescript
const registration: EvidencePanelRegistration = {
  panelId: string,
  displayName: string,
  ownerDomain: string,
  sourceOwnership: { domainId, systemName, legacyAppId },
  lifecycle: 'live' | 'pilot' | 'deprecated',
  allowedConsumerWorkspaces: string[],
  requiredContext: ContextRequirement[],
  freshnessPolicy: { staleAfterSeconds, errorAfterSeconds, refreshOnFocus, pollIntervalSeconds },
  confidencePolicy: { level, hidden },
  requiredPermissions: Permission[],
}
```

The `useEvidencePanel` hook manages the display state machine (loading → ready | stale | error | unauthorized). The `source` prop on `<EvidencePanel>` shows an amber badge for `legacy-api` data and green for `databricks-api`.

---

## Data Contracts & Synchronization

Data contracts are defined as Zod schemas in `packages/data-contracts`. These schemas are the source of truth for both the React frontend and the FastAPI backend.

### Synchronization Workflow

To prevent contract drift, Pydantic V2 models are automatically generated from the Zod schemas:

1.  **Define Schema**: Add or update a Zod schema in `packages/data-contracts/src/schemas/`.
2.  **Export**: Export the schema from `packages/data-contracts/src/index.ts`.
3.  **Sync**: Run `nx run data-contracts:sync-pydantic`.

This task performs a two-step conversion:

- `Zod` → `JSON Schema` (via `zod-to-json-schema`)
- `JSON Schema` → `Pydantic V2` (via `datamodel-code-generator`)

Generated models are stored in `apps/api/contracts/generated.py`.

### Drift detection

To verify that the committed generated artifacts match the current Zod schemas:

```sh
npx nx run data-contracts:check-pydantic
```

Exit 0 means in sync. A non-zero exit means the generated files are stale — run `sync-pydantic` and commit the updated artifacts.

See [`docs/app-data-layer/contract-generation.md`](../app-data-layer/contract-generation.md) for full details and troubleshooting.

---

## Data flow

```
ScopeContext (processOrderId, batchId, plantId, warehouseId…)
  └─ Workspace root
       └─ View (e.g. OrderOverviewView)
            └─ Panel (e.g. ProcessOrderHeaderPanel)
                 └─ useProcessOrderHeader(request)  ← React Query hook
                      └─ ProcessOrderReviewDatabricksApiAdapter.getProcessOrderHeader()
                           └─ fetch POST /api/por/order-header
                                └─ FastAPI QuerySpec route → Databricks SQL warehouse
```

React Query manages caching with a default `staleTime` of 5 minutes per domain. Each panel controls its own freshness policy independently.

### Cross-domain workspace context

`StandardWorkspaceTemplate` also provides an active investigation context store
from `@connectio/workspace-runtime`. The store is scoped per workspace and is
feature-flagged by `runtime.enableCrossDomainContext`
(`VITE_FEATURE_ENABLE_CROSS_DOMAIN_CONTEXT`, default `false`).

When enabled, a driving panel such as Trace Query Form can publish the active
`batchId`, `materialId`, `plantId`, or `processOrderId`. Context-aware panels
use their existing `requiredContext` registration to decide whether to query or
show `waiting-for-context`. URL query params are synchronized for deep links,
and context changes emit telemetry. See
`docs/adr/ADR-026-cross-domain-workspace-context.md`.

---

## Role-aware home

The home screen (`RoleAwareHome`) renders workspaces and actions relevant to the logged-in user's role. Roles are defined in `@connectio/auth-scope` and include:

- `plant-manager`
- `operations-supervisor`
- `production-planner`
- `quality-lead`
- `warehouse-manager`
- `shift-lead`
- `logistics-lead`
- `micro-analyst`
- (<!-- TODO: confirm full role list from auth-scope package -->)

---

## Deployment

V2 deploys as a Databricks App. See `docs/deployment/databricks-apps.md` for
the build + deploy sequence. The app reads V1 backend URLs and native
Databricks configuration from the `connectio-v2` secret scope or app
environment — no hardcoded URLs, SQL warehouse IDs, PATs, or service-principal
fallbacks in the repo.

---

## Key ADRs

| ADR     | Decision                                                                          |
| ------- | --------------------------------------------------------------------------------- |
| ADR-001 | Product boundary — V2 is a workspace-first orchestration layer, not a data system |
| ADR-002 | Workspace-first product model                                                     |
| ADR-003 | Evidence panel governance                                                         |
| ADR-005 | Scope and lifecycle model                                                         |
| ADR-007 | Domain-owned workspaces                                                           |
| ADR-009 | Phase 5 pilot workspace strategy                                                  |
| ADR-023 | Rollout wave model and legacy retirement                                          |
| ADR-026 | Cross-domain workspace context runtime                                            |
| ADR-027 | Evidence route cache and freshness policy                                         |
