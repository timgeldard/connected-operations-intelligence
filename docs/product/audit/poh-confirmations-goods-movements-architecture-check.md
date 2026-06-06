# POH Confirmations and Goods Movements — Architecture Check

**Date:** 2026-05-17  
**Status:** Both slices IMPLEMENTED — DDL confirmed 2026-05-17; routes wired; executable but not yet browser-verified.  
**Principle:** DDL first. Implement only what confirmed Databricks views actually support.  
**References:**
- `docs/migration/poh-confirmations-goods-movements-plan.md`
- `docs/audit/native-databricks-column-verification-checklist.md`
- `docs/audit/adapter-source-status-matrix.md`
- `ADR-024` (`docs/adr/ADR-024-native-databricks-data-access-architecture.md`)

---

## Confirmed baseline (as of 2026-05-17)

| Route | Status |
|-------|--------|
| `POST /api/por/order-header` | **browser-verified** — PO 7006965038 |
| `GET /api/por/order-operations` | **browser-verified** — 11 operations for PO 7006965038 |
| `GET /api/cq/lab/plants` | **browser-verified** |
| `GET /api/por/order-confirmations` | **Implemented** — executable; DDL confirmed 2026-05-17; not browser-verified |
| `GET /api/por/order-goods-movements` | **Implemented** — executable; DDL confirmed 2026-05-17; not browser-verified |

---

## Architecture guardrail checks

### No new workspaces

- [x] Confirmed — no new workspaces added. Both `getOrderConfirmations` and `getOrderGoodsMovements` are planned to use the existing `process-order-review` workspace.

### No broad APIs

- [x] Confirmed — no broad or unauthenticated API surface added. Both routes, when implemented, will require end-user OAuth and follow the existing `GET /api/por/...` pattern.

### No SQL in React components

- [x] Confirmed — no SQL in any React component. All SQL lives exclusively in QuerySpec factories in `apps/api/adapters/poh/poh_databricks_adapter.py`.

### No SQL in FastAPI route handlers

- [x] Confirmed — FastAPI route handlers call `QueryExecutor.execute(spec, identity)`. SQL is never placed in a route handler directly. Pattern established by `order-header` and `order-operations` routes must be preserved.

### QuerySpec used for native SQL

- [x] Confirmed — the `QuerySpec` dataclass is the only sanctioned container for SQL in the native Databricks path. Both new slices, if implemented, must define a `QuerySpec` factory function (e.g., `get_order_confirmations_spec`, `get_order_goods_movements_spec`) in `poh_databricks_adapter.py`.

### QueryExecutor used for execution

- [x] Confirmed — `QueryExecutor` in `apps/api/shared/query_service/` is the only execution path. It extracts user OAuth, merges `max_rows`, calls `DatabricksQueryClient.execute()`, and returns `list[dict]`. No alternative execution paths exist or will be added.

### OAuth required

- [x] Confirmed — `require_user_oauth()` is called by `QueryExecutor` before every Databricks query. Missing OAuth raises `DatabricksAuthRequiredError` → HTTP 401. This is non-negotiable for both new slices.

### No SPN/PAT fallback

- [x] Confirmed — no service-principal credentials or PAT tokens in `app.yaml`, `apps/api/`, or any route handler. `StatementApiDatabricksClient` forwards the user's OAuth token verbatim. No fallback path exists.

### No silent fallback from databricks-api to mock

- [x] Confirmed — when `BACKEND_ADAPTER_MODE=databricks-api`, routes return proper error HTTP codes (401/403/502/503/504) on failure. They do not fall back to mock data or legacy-api. The frontend adapter overrides in `process-order-review-legacy-api-adapter.ts` must also not fall back to `super.getOrderConfirmations()` or `super.getOrderGoodsMovements()` on error (only on missing `processOrderId`).

### Source headers and badges accurate

- [x] Confirmed — both new routes, when implemented, must return:
  - `X-Data-Source: databricks-api`
  - `X-Adapter-Mode: databricks-api`
  - `X-Query-Name: poh.get_order_confirmations` (or `poh.get_order_goods_movements`)
  - `source_badge: "databricks-api"` in the `QuerySpec`

### Existing browser-verified POH slices preserved

- [x] Confirmed — `POST /api/por/order-header` and `GET /api/por/order-operations` are unchanged. Both remain browser-verified at their 2026-05-17 state. Neither new slice modifies these routes, their QuerySpecs, or their mappers.

### CQ Lab failures remains blocked

- [x] Confirmed — `GET /api/cq/lab/fails` is not touched in this tranche. It remains blocked on `vw_gold_process_order_plan` (view does not exist in `connected_plant_uat`).

### Trace recursion not implemented

- [x] Confirmed — no Trace domain adapter methods are modified. Recursive graph traversal remains deferred per project rules.

### No SPC/Warehouse migration in this tranche

- [x] Confirmed — SPC and Warehouse360 domains are not touched. Their adapter-source-status-matrix rows remain unchanged.

---

## Implementation requirements (when DDL is confirmed)

Both slices must follow this pattern exactly:

### Python (backend)

```python
# apps/api/adapters/poh/poh_databricks_adapter.py

def get_order_confirmations_spec(process_order_id: str) -> QuerySpec:
    return QuerySpec(
        name="poh.get_order_confirmations",
        module="poh",
        endpoint="/api/por/order-confirmations",
        sql="""
            SELECT
                <confirmed_columns_only>
            FROM {{ object:poh.vw_gold_confirmation }}
            WHERE PROCESS_ORDER_ID = :process_order_id
            ORDER BY <stable_sort_column>
            LIMIT :max_rows
        """,
        params={"process_order_id": process_order_id},
        source_badge="databricks-api",
        cache_policy=CacheTier.PER_USER_SHORT,
        max_rows=500,
        timeout_seconds=30,
    )

def map_order_confirmations_rows(rows: list[dict]) -> list[dict]:
    # Map only confirmed columns. No invented values for required fields.
    ...
```

```python
# apps/api/routes/process_order.py

@router.get("/por/order-confirmations")
async def order_confirmations(
    process_order_id: str = Query(...),
    identity: UserIdentity = Depends(extract_user_identity),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    if settings.backend_adapter_mode != "databricks-api":
        raise HTTPException(status_code=503, detail="databricks-api mode not active")
    spec = get_order_confirmations_spec(process_order_id)
    rows = await executor.execute(spec, identity, settings)
    return JSONResponse(
        content=map_order_confirmations_rows(rows),
        headers={
            "X-Data-Source": "databricks-api",
            "X-Adapter-Mode": "databricks-api",
            "X-Query-Name": spec.name,
        },
    )
```

### TypeScript (frontend)

```typescript
// domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts

override async getOrderConfirmations(
  request: ProcessOrderReviewAdapterRequest,
): Promise<AdapterResult<ProcessOrderConfirmation[]>> {
  if (!request.processOrderId) {
    return super.getOrderConfirmations(request)  // mock fallback only on missing ID
  }
  // ... fetch /api/por/order-confirmations?process_order_id=...
  // source: 'databricks-api' on ALL return paths (never 'legacy-api')
  // Array.isArray() guard on response
  // No fallback to super on error — return error result
}
```

---

## What remains to complete

| Item | Status | Required action |
|------|--------|----------------|
| Browser verification — `getOrderConfirmations` | Not yet tested | Deploy to UAT; hit `GET /api/por/order-confirmations?process_order_id=7006965038`; verify 200 + data |
| Browser verification — `getOrderGoodsMovements` | Not yet tested | Deploy to UAT; hit `GET /api/por/order-goods-movements?process_order_id=7006965038`; verify 200 + data |
| `operationText` / `isFinalConfirmation` re-require | Pending upstream view change | When `vw_gold_confirmation` exposes these fields, revert schema optionals |
| `materialDescription` re-require | Pending material master join | When `vw_gold_adp_movement` exposes material description, revert schema optional |
| `getExecutionTimeline` native path | Deferred | Depends on date columns in operations view; post-verification task |

---

## Stop conditions (verbatim from project rules)

Stop and document rather than implement if:
- A view does not exist
- A view exists but has no rows for the sample process order (7006965038)
- A view cannot be linked to a process order
- Required columns are missing and cannot be safely derived
- The mapper would require invented values for required fields
- Route implementation would require speculative API design
- Implementation would require fallback to mock or service principal
- SQL would need to be placed in a route or React component

In any stop case: update the plan, update the verification checklist, update the adapter matrix. Do not fake implementation.
