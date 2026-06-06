# Warehouse360 DEV App Smoke Test

Use this runbook only after the Databricks DEV validation evidence pack has been executed and blocking source/view issues have been resolved. This is an app smoke test, not proof that DEV data validation has passed.

## Preconditions

- DEV validation evidence has been captured for `connected_plant_dev.gold_io_reporting`.
- Active Wave 1 views compile:
  - `vw_consumption_warehouse360_overview`
  - `vw_consumption_warehouse360_inbound_backlog`
  - `vw_consumption_warehouse360_outbound_backlog`
  - `vw_consumption_warehouse360_staging_workload`
  - `vw_consumption_warehouse360_im_wm_reconciliation`
- Candidate contracts remain draft/candidate unless the evidence PR explicitly records promotion decisions.
- `vw_consumption_warehouse360_dispensary_queue` remains out of Wave 1.

## Required App Configuration

Set:

```text
BACKEND_ADAPTER_MODE=databricks-api
WAREHOUSE360_SOURCE_MODE=governed_contracts
WH360_CATALOG=connected_plant_dev
WH360_SCHEMA=gold_io_reporting
DATABRICKS_HOST=<DEV workspace host>
SQL_WAREHOUSE_ID=<DEV SQL warehouse id>
```

Do not use `legacy_wh360` for governed DEV app smoke testing.

## Smoke Test Routes

Call each route with a valid user OAuth token and a known DEV test plant:

```text
GET /api/warehouse360/overview?warehouse_id=<warehouse>&plant_id=<plant>
GET /api/warehouse360/inbound?warehouse_id=<warehouse>&plant_id=<plant>&limit=25
GET /api/warehouse360/outbound?warehouse_id=<warehouse>&plant_id=<plant>&limit=25
GET /api/warehouse360/staging?warehouse_id=<warehouse>&plant_id=<plant>&limit=25
GET /api/warehouse360/exceptions?warehouse_id=<warehouse>&plant_id=<plant>&limit=25
```

For each response, capture:

- HTTP status.
- `X-Data-Source`.
- `X-Adapter-Mode`.
- `X-Query-Name`.
- `X-Contract-Id`.
- Row count.
- Any 401, 403, 502, or 503 detail.

Expected headers:

| Route | Expected `X-Contract-Id` |
|---|---|
| `/api/warehouse360/overview` | `warehouse360.overview` |
| `/api/warehouse360/inbound` | `warehouse360.inbound_backlog` |
| `/api/warehouse360/outbound` | `warehouse360.outbound_backlog` |
| `/api/warehouse360/staging` | `warehouse360.staging_workload` |
| `/api/warehouse360/exceptions` | `warehouse360.im_wm_reconciliation` |

## Failure Handling

| Failure | Action |
|---|---|
| Missing `WAREHOUSE360_SOURCE_MODE` | Stop. Set it explicitly to `governed_contracts` or `legacy_wh360`; do not rely on defaults. |
| 401 | Confirm user OAuth forwarding. Do not fall back to service principal auth. |
| 403 | Confirm Unity Catalog grants and plant entitlements for the signed-in user. |
| 502 | Capture the Databricks query name and server log details; check the validation evidence for missing columns/views. |
| 503 | Confirm backend mode, Databricks host, SQL warehouse, catalog, schema, and source mode configuration. |
| Empty rows | Check whether DEV evidence reported empty source/view row counts for the selected plant. |

## Sign-Off Notes

Record smoke test results in the evidence PR or a follow-up app validation note. Do not promote Warehouse360 contracts or move to UAT planning from smoke-test success alone.
