# Backend Contract Enforcement Plan

**Date:** 2026-05-21
**Branch:** `feature/backend-contract-enforcement`
**Scope:** Add `response_model=` to FastAPI routes that are currently unvalidated, where doing so is safe. Does not change data semantics, Databricks SQL, mapper logic, or adapter fallback behaviour.

---

## Context

All Python response models in `apps/api/contracts/generated.py` are Pydantic v2
with `ConfigDict(extra='forbid', populate_by_name=True)`. Adding
`response_model=` to a route decorator causes FastAPI to validate the return
value against the model; any extra key in the returned dict raises
`ResponseValidationError` (HTTP 500). This is the primary risk for dual-mode
routes where a V1 proxy response may contain extra or differently-shaped fields.

A route that returns HTTP 503 in all non-databricks-api modes is safe to
enforce if its mapper output exactly matches the model's field list.

---

## Enforcement Decision Table

| Route | `response_model` before? | Candidate model | Mapper shape matches? | Decision | Notes |
|---|---|---|---|---|---|
| `POST /trace2/batch-header` | No | `BatchHeaderSummary` | Databricks mapper: yes | **skip-proxy-passthrough** | Dual-mode: legacy-api branch proxies V1 whose response shape is not browser-verified. `extra='forbid'` would raise on any extra V1 key. |
| `POST /por/order-header` | No | `ProcessOrderHeader` | No — mapper adds `inspectionLotId` not in model | **skip-proxy-passthrough + skip-contract-mismatch** | Two independent blockers: (1) dual-mode V1 proxy; (2) `map_process_order_header_rows` unconditionally adds `inspectionLotId` which is absent from `ProcessOrderHeader`. Either alone would block enforcement. |
| `GET /envmon/site-summary` | No | `EnvMonSiteSummary` | Yes — exactly 12 fields | **enforce-now (Slice 1)** | databricks-api only (returns 503 otherwise); mapper produces exactly the 12 camelCase fields the model declares. |
| `GET /envmon/swab-results` | No → **Yes** | `EnvMonNativeSwabResult` | Yes — exact match after contract alignment | **enforce-now (Slice 3, feature/envmon-swab-contract-alignment)** | `EnvMonNativeSwabResultSchema` promoted to `@connectio/data-contracts` (2026-05-22); `response_model=list[EnvMonNativeSwabResult]` added. Old `EnvMonSwabResult` (zone-based) retained for mock data only. |
| `GET /warehouse360/overview` | No | `Warehouse360Overview` | No — completely different shape | **skip-contract-mismatch** | Mapper returns V1-style keys (`ordersTotal`, `trsOpen`, `tosOpen`, `binUtilPct`, etc.). `Warehouse360Overview` contract uses `inboundDueCount`, `outboundDueCount`, etc. Requires mapper rewrite before enforcement. |
| `GET /warehouse360/inbound` | No | `list[Warehouse360InboundItem]` | Yes — 18 fields | **enforce-now (Slice 2)** | databricks-api only; mapper produces exactly the 18 camelCase fields the model declares. |
| `GET /warehouse360/outbound` | No | `list[Warehouse360OutboundItem]` | Yes — 16 fields | **enforce-now (Slice 2)** | databricks-api only; mapper produces exactly the 16 camelCase fields the model declares. |
| `GET /warehouse360/staging` | No | `list[Warehouse360StagingItem]` | Yes — 16 fields | **enforce-now (Slice 2)** | databricks-api only; mapper produces exactly the 16 camelCase fields the model declares. |
| `GET /warehouse360/exceptions` | No | `list[Warehouse360ExceptionItem]` | Yes — 17 fields; severity is always a valid Literal | **enforce-now (Slice 2)** | databricks-api only; `_map_exception_severity` always returns one of `'critical'/'high'/'medium'/'low'`; all 17 fields match. |
| `GET /cq/lab/fails` | No | `ConnectedQualityLabFailuresResponse` | N/A | **skip-proxy-passthrough** | Always V1 proxy passthrough; no databricks-api path; V1 response shape not browser-verified. |
| `GET /cq/lab/plants` | No | `ConnectedQualityLabPlantsResponse` | Databricks path: yes | **skip-proxy-passthrough** | Dual-mode: `response_model=` applies to the entire route decorator and therefore to both the legacy-api proxy branch and the databricks-api native branch. The V1 proxy shape is not browser-verified. Even though the databricks-api mapper (`map_lab_plants_rows`) is compatible, enforcement cannot be scoped to one branch only. |

---

## Skip Reason Taxonomy

| Code | Meaning |
|---|---|
| `skip-proxy-passthrough` | Route has a legacy-api/proxy branch; `response_model` would apply to both paths; V1 shape not verified. |
| `skip-contract-mismatch` | Mapper output does not match contract shape. Requires mapper alignment before enforcement. |
| `enforce-now` | databricks-api-only route; mapper verified to produce exact contract shape. |

---

## Routes Already Enforced (pre-existing)

These routes already had `response_model` on `main` before this branch and are
not touched:

| Route | `response_model` |
|---|---|
| `GET /trace2/graph` | `TraceGraph` |
| `GET /trace2/customer-exposure` | `CustomerExposureSummary` |
| `GET /envmon/sites` | `list[EnvMonSite]` |
| `GET /por/order-operations` | `list[ProcessOrderOperation]` |
| `GET /por/order-confirmations` | `list[ProcessOrderConfirmation]` |
| `GET /por/order-goods-movements` | `list[ProcessOrderGoodsMovement]` |

---

## Implementation Order

- **Slice 1** — `GET /envmon/site-summary` (`EnvMonSiteSummary`). Single route, already browser-verified, mapper exact match. Update `test_envmon_routes.py`.
- **Slice 2** — `GET /warehouse360/{inbound,outbound,staging,exceptions}` (four routes). Update `test_warehouse360_routes.py`.
- **Slice 3** — Update `contract-route-coverage-matrix.md`, `data-layer-implementation-backlog.md`, and this document to reflect completion.

---

## Open Items (not in scope for this branch)

| Item | Blocker |
|---|---|
| `POST /por/order-header` enforcement | Remove `inspectionLotId` from mapper OR add field to `ProcessOrderHeader` contract, then verify V1 proxy mode |
| `GET /warehouse360/overview` enforcement | Rewrite `map_warehouse_overview_rows` to emit `inboundDueCount`, `outboundDueCount`, etc. matching `Warehouse360Overview`. Analysis complete (2026-05-22): frontend already expects contract shape; silently returns 0 for all counts. 10 of 11 non-optional fields require Databricks verification of `wh360_kpi_snapshot_v`. See `warehouse360-overview-contract-alignment.md`. |
| `GET /cq/lab/plants` enforcement | Browser-verify `/api/cq/lab/plants` in legacy-api mode; confirm V1 response shape is compatible |
| `POST /trace2/batch-header` enforcement | Browser-verify `/api/trace2/batch-header` in legacy-api mode; confirm V1 response shape is compatible |

## Completed Items (enforced on follow-on branch)

| Item | Branch | Completion date |
|---|---|---|
| `GET /envmon/swab-results` enforcement | `feature/envmon-swab-contract-alignment` | 2026-05-22 |
