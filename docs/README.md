# Connected Operations Intelligence Documentation

## Start here

1. [Current Warehouse360 governed-path status](architecture/warehouse360-governed-path-status.md)
2. [Architecture decisions](decisions/)
3. [Contract status](contracts/warehouse360-contract-status.md)
4. [Route-to-contract map](contracts/warehouse360-route-to-contract-map.md)
5. [DEV validation runbook](runbooks/warehouse360-dev-consumption-view-validation.md)
6. [Generated validation SQL](../data-products/io-reporting/validation/)

## Important warning

> [!WARNING]
> Warehouse360 is in transition from legacy `wh360` runtime views to governed contract-backed `vw_consumption_warehouse360_*` views.
>
> The governed path is **not yet live-validated**.
>
> **Do not switch `WAREHOUSE360_SOURCE_MODE=governed_contracts` until DEV and UAT validation have passed.**

## Documentation map

| Need | Read this |
|---|---|
| Current Warehouse360 migration status | [docs/architecture/warehouse360-governed-path-status.md](architecture/warehouse360-governed-path-status.md) |
| Which contracts exist and their status | [docs/contracts/warehouse360-contract-status.md](contracts/warehouse360-contract-status.md) |
| Which API routes map to which contracts | [docs/contracts/warehouse360-route-to-contract-map.md](contracts/warehouse360-route-to-contract-map.md) |
| Why apps must use consumption views | [docs/decisions/ADR-0001-apps-use-consumption-views-only.md](decisions/ADR-0001-apps-use-consumption-views-only.md) |
| Why secured/live/consumption views are separated | [docs/decisions/ADR-0002-secured-live-consumption-view-boundaries.md](decisions/ADR-0002-secured-live-consumption-view-boundaries.md) |
| Why DEV validation comes before UAT | [docs/decisions/ADR-0003-dev-before-uat-validation.md](decisions/ADR-0003-dev-before-uat-validation.md) |
| How to run DEV validation | [docs/runbooks/warehouse360-dev-consumption-view-validation.md](runbooks/warehouse360-dev-consumption-view-validation.md) |
