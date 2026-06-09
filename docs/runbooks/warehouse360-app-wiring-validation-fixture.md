# Warehouse360 / IM-WM app wiring on governed UAT data (validation_fixture)

> [!NOTE]
> This wires the apps to the **governed** serving layer in `connected_plant_uat.gold_io_reporting` with
> **real per-user row-level security sourced from a LOCAL fixture** (`security_model_fixture`) — Gate B.
> It needs **no** access to the corporate `published_uat.security.model` and **no** `users` UC group.
> It is a UAT testing/pilot path, **not** production cutover (which still requires Gate C / strict mode).

## Why
The corporate UC security model (`published_uat.security.model`) and the `users` consumer group are not
available to the validating team. But the apps **pass the end-user identity through** (Databricks Apps
`x-forwarded-access-token` → `current_user()`), so a locally-maintained entitlement table is enough to
enforce **real per-user plant RLS** at the `*_secured` view layer. The `validation_fixture` security mode
(built in #60) points the secured-view predicate at `connected_plant_uat.gold_io_reporting.security_model_fixture`
instead of the corporate model — same `WHERE EXISTS (… current_user() = email …)` logic, local source.

## Prerequisites
- Governed io-reporting stack deployed + run in UAT: `databricks bundle deploy -t uat` → run Silver slow →
  Silver fast → Gold (the `vw_consumption_warehouse360_*` views must exist).
- The companion fix **`fix/im-wm-consumption-secured`** merged — without it the `im_wm_reconciliation`
  consumption view reads the **base** `gold_warehouse_exceptions` and is NOT RLS-filtered (a restricted user
  would see all plants on that one route).

## Procedure

### 1. Apply validation_fixture security + serving + consumption SQL (UAT)
Run as the Gold object owner, in order (per-statement; the `GRANT … TO users` lines fail on the missing
group — that is expected and harmless, RLS does not depend on them):
```
data-products/io-reporting/resources/sql/gold_security_uat_validation_fixture.sql      -- *_secured views, predicate → local fixture
data-products/io-reporting/resources/sql/gold_serving_views_uat.sql                    -- *_live views
data-products/io-reporting/resources/sql/warehouse360_consumption_views_uat.sql        -- the 7 vw_consumption_* views
```
The fixture **table** must exist before the secured views are created (its name is referenced in the
predicate). Seed it first (next step).

### 2. Seed the entitlement fixture
The fixture columns: `email, application_key, access_type, filter_plant ARRAY<STRING>, test_case, enabled`.
- `access_type='full view'` → sees all (onboarded) plants.
- `access_type='filter'` + `filter_plant=array('C061',…)` → sees only those plants.
- `enabled=false` or **no row** → sees nothing.
- `application_key` must be `io_reporting`. `email` must match `current_user()` exactly (lowercase UPN).

Add or update an identity with `docs/runbooks/warehouse360-fixture-add-user.sql` (one paste — replace the
placeholders). Current seeded identities (both `full view`, all onboarded plants C061 + P817):
`tim.geldard@kerry.com`, `david.burke@kerry.ie`.

### 3. Grant the identities on the consumption views
Each end-user queries as themselves (identity passthrough), so each needs `SELECT` on the 7
`vw_consumption_warehouse360_*` views + `USE CATALOG`/`USE SCHEMA`. Underlying `*_live`/`*_secured`/Gold +
the fixture table are covered by **ownership chaining** (all owned by the deployer) — do NOT grant base
objects to consumers. The `warehouse360-fixture-add-user.sql` template includes these grants. No dependency
on the missing `users` group.

### 4. App config (`apps/api/app.yaml`)
Governed wiring (already set on this branch):
```yaml
BACKEND_ADAPTER_MODE: databricks-api          # native Databricks reads
WAREHOUSE360_SOURCE_MODE: governed_contracts  # resolve routes to vw_consumption_warehouse360_*  (else legacy_wh360)
WH360_CATALOG: connected_plant_uat
WH360_SCHEMA: gold_io_reporting               # MUST set — defaults to "wh360" (legacy) in object_resolver.py
DATABRICKS_HOST / SQL_WAREHOUSE_ID            # already set (warehouse e76480b94bea6ed5)
user_api_scopes: [sql]                        # forwarded user token must carry the sql scope
```
The same app serves both the Warehouse360 routes and the IM/WM reconciliation route (`im_wm_reconciliation`)
— all 7 contracts resolve through `WH360_CATALOG`/`WH360_SCHEMA` in `governed_contracts` mode.

### 5. Deploy the app + smoke test
Activation flips the **live** UAT app from legacy `wh360.*` to the governed views:
```
npm run prepare:databricks
databricks bundle deploy -t uat        # deploys the Databricks App with the new app.yaml
```
Smoke test each Wave-1 route (`overview`, `inbound_backlog`, `outbound_backlog`, `staging_workload`,
`im_wm_reconciliation`):
- response carries `X-Contract-Id` + `X-Adapter-Mode: databricks-api`;
- a `full view` user (tim / david) sees C061 + P817;
- a `filter ['C061']` user sees only C061; a no-row user sees nothing.

## Proven (data-layer, 2026-06-09)
Gate-B RLS matrix run against the live UAT views as a real identity (`tim.geldard@kerry.com`), flipping the
fixture row through states — **the predicate enforces per-user plant scope on all 7 views including the fixed
`im_wm_reconciliation`**:

| fixture state | result |
|---|---|
| `full view` | sees C061, P817 |
| `filter ['C061']` | sees **only C061** |
| `enabled=false` / no row | sees **nothing** |

## Boundaries — do not overclaim
- This is **Gate B** (local fixture). It proves the predicate + real per-user entitlement for the fixtured
  identities. It is **not** corporate-model integration (Gate C) and **not** production cutover.
- **Prod stays strict.** `scripts/ci/check_security_mode_policy.py` blocks any validation/fixture artefact in
  prod; prod uses `published_prod.security.model`. The fixture can never reach prod.
- **Legacy `wh360` is retained** as the fallback mode — not removed, not repointed.
- Identity passthrough is the documented Databricks Apps behaviour but is flagged
  **UNVERIFIED in a live Apps environment** (`apps/api/shared/query_service/identity.py:48`) — confirm during
  the smoke test that `current_user()` resolves to the end-user (not the app service principal); if the app
  connected as a single SP, per-user RLS would not apply and app-level filtering would be required.
- Keep UAT **standing** and the pipelines scheduled (fast continuous; slow + gold triggered) for freshness.
