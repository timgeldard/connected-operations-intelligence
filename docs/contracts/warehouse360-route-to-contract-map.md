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
