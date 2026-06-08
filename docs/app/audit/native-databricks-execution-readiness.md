# Native Databricks Execution Readiness

**Date:** 2026-05-17 (updated — m.txt V1/V2 config reconciliation)
**Scope:** k.txt tranche — first executable Databricks read path; l.txt — hardening and verification readiness; m.txt — V1/V2 config reconciliation
**References:** ADR-024, ADR-025

---

## Purpose

Documents the current state of the native Databricks read path after the k.txt tranche. Replaces the "not yet implemented" status from pre-k.txt with accurate post-implementation status.

---

## QuerySpec fields — implemented

| Field | Implemented | Notes |
|---|---|---|
| `name` | Yes | Dot-qualified, e.g. `"poh.get_process_order_header"` |
| `module` | Yes | Domain identifier |
| `endpoint` | Yes | FastAPI route path |
| `sql` | Yes | `:param` syntax; `LIMIT :max_rows` in all query SQL |
| `params` | Yes | Merged with `max_rows` by QueryExecutor before client call |
| `cache_policy` | Yes | `CacheTier` enum; not yet active (no cache backend) |
| `source_badge` | Yes | Forwarded to `X-Data-Source` response header in both routes |
| `catalog_override` | Yes (field) | Not used by current slices directly; `object_resolver.py` accepts it |
| `schema_override` | Yes (field) | Used by `cq.get_lab_plants` — `schema_override="gold"` forces gold schema per V1 |
| `max_rows` | Yes | Merged into `params` as `"max_rows"` int value |
| `timeout_seconds` | Yes | Forwarded to client as `wait_timeout: "{n}s"` |
| `tags` | Yes | List[str] merged into `dict[str,str]` and logged; not sent to Statement API |

---

## QueryExecutor — current behaviour

| Behaviour | Status |
|---|---|
| Requires `UserIdentity` with `raw_oauth_token` | Yes — `require_user_oauth()` called first |
| Refuses execution without token | Yes — raises `DatabricksAuthRequiredError` |
| Merges `max_rows` into params | Yes |
| Builds tags dict with query metadata + user_id | Yes |
| Calls `DatabricksQueryClient.execute()` | Yes (async) |
| Returns rows as `list[dict]` | Yes |
| Does not read service-principal env vars | Confirmed in tests |
| Does not mutate spec.params | Confirmed in tests |
| Cache layer | Not active — no cache backend yet (ADR-024 open question #7) |

---

## Databricks client — current status

| Client | Status |
|---|---|
| `DatabricksQueryClient` (ABC) | Implemented |
| `StatementApiDatabricksClient` | Implemented — httpx, async, Statement API |
| `NotImplementedDatabricksClient` | Retained as fallback for unwired adapters |

`StatementApiDatabricksClient` uses:
- `POST https://{DATABRICKS_HOST}/api/2.0/sql/statements`
- `Authorization: Bearer {oauth_token}` — user token forwarded verbatim
- `wait_timeout: "{n}s"`, `on_wait_timeout: "CANCEL"` — synchronous or cancel
- `disposition: "INLINE"`, `format: "JSON_ARRAY"`
- Typed parameter list for all bound parameters

Query tags are not natively supported by the Statement API. Tags are logged via Python `logging`.

---

## OAuth identity extraction — current status

| Header | Role | Status | Verified in Databricks Apps? |
|---|---|---|---|
| `x-forwarded-access-token` | OAuth bearer token | Confirmed | Yes — 2026-05-17 (`token_present: true`, `token_length_bucket: "long"`) |
| `x-forwarded-user` | User identifier | Confirmed | Yes — 2026-05-17 (`user_header_present: true`) |
| `x-forwarded-email` | User email | Confirmed | Yes — 2026-05-17 (`email_header_present: true`) |

`extract_user_identity()` FastAPI dependency is implemented in `shared/query_service/identity.py`. Header names are confirmed correct — no further verification needed.

Missing OAuth token does not raise in `extract_user_identity()` — the caller (route) is responsible for calling `identity.require_user_oauth()` via the executor, which raises `DatabricksAuthRequiredError` → HTTP 401.

---

## Cache status

**Not active.** ADR-024 open question #7 (in-process LRU vs Redis/Lakebase) is not resolved. `CacheTier` values are assigned to all QuerySpecs but not enforced at runtime.

---

## Query tagging status

**Partial.** Tags are built by `QueryExecutor` and logged. They are not forwarded to Databricks natively because the Statement API has no tag field. Future work: investigate `custom_tags` or `query_text` annotation approaches.

---

## Route integration status

| Route | Mode gate | Databricks path | Legacy path preserved | Response headers (databricks-api mode) |
|---|---|---|---|---|
| `POST /api/por/order-header` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `_order_header_databricks()` | Yes | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/por/order-operations` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `order_operations()` | No (databricks-api only — no V1 endpoint) | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/por/order-confirmations` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `order_confirmations()` | No (databricks-api only) | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/por/order-goods-movements` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `order_goods_movements()` | No (databricks-api only) | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/cq/lab/plants` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `_lab_plants_databricks()` | Yes | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/cq/lab/fails` | No gate needed | N/A — blocked | Yes | N/A |
| `POST /api/trace2/batch-header` | No gate — not wired yet | No | Yes | N/A |
| `GET /api/diagnostics/auth-headers` | Env var gate — `ENABLE_AUTH_DIAGNOSTICS=true` | N/A (diagnostic only) | N/A | N/A |

---

## Known blockers

### Must-verify before production use

1. ~~**Databricks Apps OAuth header names**~~ — **RESOLVED 2026-05-17.** All three `x-forwarded-*` headers confirmed present in UAT. `sql` scope confirmed in user token. `identity.py` header names are correct.

2. **POH column names**: SQL column names in `get_process_order_header_spec` were confirmed from live DDL (2026-05-17). Fields not in `vw_gold_process_order` (`plannedQuantity`, `confirmedQuantity`, `uom`, dates) return zero/empty by design — the view does not expose them. No column-name blockers remain for the currently wired POH query.

3. **CQ Lab column names**: `PLANT_ID`/`PLANT_NAME` confirmed working — `GET /api/cq/lab/plants` returned real plant data (browser-verified 2026-05-17). No column-name blockers remain.

4. **POH order status mapping**: `orderStatus: "closed"` returned correctly for process order 7006965038. Status mapping confirmed working for at least the closed case — verify other status values when those orders become available for testing.

5. **Cache backend** (ADR-024 open question #7): No active cache. All Databricks queries go to the warehouse on every request.

### Deferred by design

6. **Trace batch header route wiring**: 6 unverified column TODOs in `gold_batch_summary_v`. Route wiring deferred until `DESCRIBE TABLE` confirms all column names.

7. **Recursive Trace graph**: Deferred per k.txt rules.

8. **CQ Lab failures**: `vw_gold_process_order_plan` view missing — route implementation blocked.

9. **POH order operations**: Route implemented and **browser-verified 2026-05-17** — 11 operations returned for PO 7006965038. Known gaps: `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes` not in `vw_gold_process_order_phase` — return empty/zero by design.

10. **POH confirmations** (`getOrderConfirmations`): `vw_gold_confirmation` DDL confirmed 2026-05-17. Route implemented and executable (`GET /api/por/order-confirmations`). Browser verification pending.

11. **POH goods movements** (`getOrderGoodsMovements`): `vw_gold_adp_movement` DDL confirmed 2026-05-17. Route implemented and executable (`GET /api/por/order-goods-movements`). Browser verification pending.

---

## How to test locally with mocked Databricks client

```bash
# From repo root
cd apps/api

# Run all tests (uses NotImplementedDatabricksClient by default — no real Databricks needed)
python -m pytest -q

# Run specific shared tests
python -m pytest tests/shared/ -q

# Run route tests (route tests patch StatementApiDatabricksClient.execute)
python -m pytest tests/routes/ -q
```

All 453 tests pass without a Databricks connection.

---

## How to test in Databricks Apps with a real user OAuth token

**Current state (2026-05-17):** The app is live at `https://connectio-v2-604667594731808.8.azure.databricksapps.com` with `BACKEND_ADAPTER_MODE=databricks-api`. CQ lab plants and POH order header are browser-verified. The steps below are for future deploys or new environments.

1. Deploy: `npm run prepare:databricks && databricks bundle deploy --target uat`

2. `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, `POH_CATALOG`, and `CQ_CATALOG` are set as literals in `app.yaml` — no secret setup required for these. V1 backend URLs (`V1_*`) still come from the `connectio-v2` secret scope.

3. `user_api_scopes: [sql]` is set in `databricks.yml` and survives redeployment. No manual REST PATCH needed.

4. Open the app in a browser as an authenticated Databricks user.

5. Navigate to the Process Order Review workspace — the POH header panel loads data from Databricks. Navigate to Connected Quality Lab — the plant list loads from Databricks.

6. Check `databricks apps logs connectio-v2` for `Executing Databricks statement` log entries confirming user_id and query_name. Confirm no `service_principal`, `client_secret`, or `DATABRICKS_TOKEN` entries.

7. Verify in browser DevTools → Network → the order-header request:
   - `X-Data-Source: databricks-api`
   - `X-Adapter-Mode: databricks-api`
   - `X-Query-Name: poh.get_process_order_header`

8. If the panel shows a 401: the user's `effective_user_api_scopes` may not include `sql`. Run `databricks apps get connectio-v2` and confirm `sql` is in the list. If missing, run `databricks bundle deploy --target uat` (bundle deploy sets `user_api_scopes` from `databricks.yml`).

9. Column name verification: if data returns but fields show empty values, the SQL column aliases may be wrong. Run `DESCRIBE TABLE` queries from `docs/audit/native-databricks-column-verification-checklist.md`.
