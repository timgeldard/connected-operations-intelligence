# Warehouse360 Route-to-Contract Map

This map explains the intended governed runtime path for the Warehouse360 cockpit.

> [!WARNING]
> The application is **not yet cut over** to governed mode. These mappings define the configuration that will take effect once the system is live-validated and `WAREHOUSE360_SOURCE_MODE` is set to `governed_contracts`.

| API route / route family | Adapter Method | QuerySpec Name | Contract ID | Source View | Source Mode | Status |
|---|---|---|---|---|---|---|
| `/api/warehouse360/overview` | `get_warehouse_overview_spec` | `warehouse360.get_overview` | `warehouse360.overview` | `vw_consumption_warehouse360_overview` | `governed_contracts` | not-live-validated |
| `/api/warehouse360/inbound` | `get_warehouse_inbound_spec` | `warehouse360.get_inbound` | `warehouse360.inbound_backlog` | `vw_consumption_warehouse360_inbound_backlog` | `governed_contracts` | not-live-validated |
| `/api/warehouse360/outbound` | `get_warehouse_outbound_spec` | `warehouse360.get_outbound` | `warehouse360.outbound_backlog` | `vw_consumption_warehouse360_outbound_backlog` | `governed_contracts` | not-live-validated |
| `/api/warehouse360/staging` | `get_warehouse_staging_spec` | `warehouse360.get_staging` | `warehouse360.staging_workload` | `vw_consumption_warehouse360_staging_workload` | `governed_contracts` | not-live-validated |
| `/api/warehouse360/exceptions` | `get_warehouse_exceptions_spec` | `warehouse360.get_exceptions` | `warehouse360.im_wm_reconciliation` | `vw_consumption_warehouse360_im_wm_reconciliation` | `governed_contracts` | not-live-validated |

## Provenance (verified against code, not inferred)

Every route, adapter method, and QuerySpec name above is **verified against the source**, not invented:

- **Route paths** — `apps/api/routes/warehouse360.py` declares `/warehouse360/{overview,inbound,outbound,staging,exceptions}` (lines 94–310); `apps/api/main.py:54` mounts `warehouse360_router` with `prefix="/api"`, giving the `/api/warehouse360/*` paths shown.
- **Adapter methods** — `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`: `get_warehouse_overview_spec` / `_inbound_` / `_outbound_` / `_staging_` / `_exceptions_spec`.
- **QuerySpec names** — the `name=` of each factory's returned `QuerySpec` in the same file: `warehouse360.get_overview` (line 179), `…get_inbound` (323), `…get_outbound` (537), `…get_staging` (698), `…get_exceptions` (895).
- **Contract IDs / source views** — `data-products/io-reporting/contracts/app_contract_manifest.yml`.

The three contract-only / placeholder contracts (`stock_exceptions`, `shortfalls`, `dispensary_queue`) are intentionally **not** in this table — they have no route. Re-verify these references if the adapter or router is refactored.
