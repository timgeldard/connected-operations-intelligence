# Warehouse360 Contract Status

| Contract ID | View | Runtime status | Validation status | Route-covered? | Notes |
|---|---|---|---|---|---|
| warehouse360.overview | `vw_consumption_warehouse360_overview` | expected | not-live-validated | yes | Requires plant_id + snapshot_ts grain |
| warehouse360.inbound_backlog | `vw_consumption_warehouse360_inbound_backlog` | expected | not-live-validated | yes | Uses plant_id alias from plant_code |
| warehouse360.outbound_backlog | `vw_consumption_warehouse360_outbound_backlog` | expected | not-live-validated | yes | Creates in DEV 2026-06-08 (2/7): 2,162,748 rows, 0 null plant_id, 0 dup PK, 451 plants. `carrier` removed from first wave (no replicated source — ADR-0004 D4). RLS/entitlement still unproven, so not yet fully live-validated. |
| warehouse360.staging_workload | `vw_consumption_warehouse360_staging_workload` | expected | not-live-validated | yes | Pending DEV validation |
| warehouse360.stock_exceptions | `vw_consumption_warehouse360_stock_exceptions` | expected | not-live-validated | candidate | Generated validation SQL includes this |
| warehouse360.shortfalls | `vw_consumption_warehouse360_shortfalls` | expected | not-live-validated | candidate | Generated validation SQL includes this |
| warehouse360.im_wm_reconciliation | `vw_consumption_warehouse360_im_wm_reconciliation` | expected | not-live-validated | yes | Security/plant scope must be checked |

## Status definitions

* **`expected`**: contract/view is expected to exist as part of the governed path.
* **`not-live-validated`**: validation SQL may exist, but the view has not been proven in Databricks.
* **`route-covered`**: app/API route is expected to use this contract.
* **`candidate`**: useful for validation/reporting, but not necessarily part of first governed runtime cutover.

> [!IMPORTANT]
> Do not mark any contract as `validated`, `pilot`, or `production-ready` unless there is confirmed Databricks evidence.
