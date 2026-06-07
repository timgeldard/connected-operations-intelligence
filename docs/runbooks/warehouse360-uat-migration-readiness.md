# Warehouse360 UAT Migration Readiness

This runbook defines the gates that must pass before Warehouse360 governed contracts move from DEV app testing toward UAT migration planning.

## UAT is the first full-validation environment

DEV is a **technical shakedown only** (`dev_shakedown`, `enable_hu_reconciliation=false`)
— see ADR `docs/architecture/adr-ioreporting-dev-shakedown-vs-uat-validation.md`.
**UAT runs in `full_validation` mode** (`enable_hu_reconciliation=true`) and is the
first environment where HU reconciliation and business validation occur.

Before the gates below, run **`validation/ioreporting_uat_full_validation_preflight.sql`**:
it **requires** the full `published_uat.central_services` set, including
`handlingunit_vekp` and `handlingunit_vepo` — UAT must not proceed if either HU
table is missing. A green DEV shakedown alone does **not** satisfy any UAT gate.

## Non-Negotiable Gates

| Gate | Required Evidence |
|---|---|
| UAT full-validation preflight | `ioreporting_uat_full_validation_preflight.sql` passes — all reference tables present **incl. HU** (`handlingunit_vekp`/`vepo`). |
| HU reconciliation | `gold_hu_reconciliation` / `gold_handling_unit_summary` materialise and reconcile in UAT (excluded in DEV shakedown). |
| DEV source object validation | All active Wave 1 governed source objects are `FOUND`. |
| DEV source column validation | All adapter-selected and contract-required columns are `FOUND` or have accepted documented exceptions. |
| Consumption view deployment | Active Wave 1 DEV views compile in `connected_plant_dev.gold_io_reporting`. |
| Schema validation | Active view schemas match the candidate contracts or differences are documented. |
| Candidate key validation | Duplicate key counts are zero or a signed grain decision exists. |
| Required-key nullability | `plant_id` and candidate primary-key null counts are zero for plant-scoped rows or exceptions are signed off. |
| Freshness | Freshness evidence exists for views with freshness columns; missing freshness signals are documented. |
| App smoke test | DEV app routes return governed `X-Contract-Id` headers under `WAREHOUSE360_SOURCE_MODE=governed_contracts`. |
| Security | Row-level plant access behavior is reviewed for the DEV app test users. |
| Business acceptance | Product/data owners accept the Wave 1 grains and known limitations. |

## Required Scope

UAT migration planning may include only active Wave 1 Warehouse360 routes:

- `warehouse360.overview`
- `warehouse360.inbound_backlog`
- `warehouse360.outbound_backlog`
- `warehouse360.staging_workload`
- `warehouse360.im_wm_reconciliation`

The following contracts are not app-route Wave 1 gates unless explicitly added by a later approved scope decision:

- `warehouse360.stock_exceptions`
- `warehouse360.shortfalls`
- `warehouse360.dispensary_queue`

`warehouse360.dispensary_queue` remains not runtime-ready and must not be deployed as a UAT app route without source ownership, source validation, grain validation, and route implementation.

## Configuration Gates

Before UAT app testing:

```text
BACKEND_ADAPTER_MODE=databricks-api
WAREHOUSE360_SOURCE_MODE=governed_contracts
WH360_CATALOG=connected_plant_uat
WH360_SCHEMA=gold_io_reporting
```

Do not reintroduce legacy `wh360` views as governed dependencies. Legacy mode is only a backward-compatibility mode for explicitly configured non-governed paths.

## Readiness Decision

Use one of these decisions:

```text
Not ready for UAT
Ready for limited UAT app smoke test
Ready for UAT migration planning
```

Do not use `Ready for UAT migration planning` until every non-negotiable gate has either passed or has an explicitly accepted owner/date-bound exception.

## Evidence Location

Attach or link:

- DEV validation summary.
- DEV profile evidence log.
- DEV app smoke-test notes.
- Contract decisions and accepted exceptions.
- Any correction PRs required by validation failures.
