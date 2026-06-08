# ADR: IOReporting DEV shakedown mode vs UAT full validation

## Status

Accepted.

## Context

The IOReporting DEV bootstrap (ADR `adr-ioreporting-dev-deployment-baseline`,
PR #19) deployed bundle definitions but could not run the pipelines: the Silver
reference pipeline needs `central_services`, and the DEV-reachable source
`published_dev.central_services` is **missing the handling-unit (HU) tables
`handlingunit_vekp` / `handlingunit_vepo`** (9 of 11 required tables present).

Two facts shape the decision:

- **`central_services` is owned by another team** and cannot be changed by this
  repo/team. We cannot add the HU tables to `published_dev` ourselves.
- **DEV transactional data is old/limited** — useful for a *technical* shakedown
  (do the pipelines deploy, compile, wire up, and produce structurally-correct
  Gold/consumption objects?) but **not** for business validation.

We want to unblock the DEV technical shakedown now, without changing
`central_services` and without fabricating HU data, while preserving full HU /
business validation for UAT.

## Decision

Introduce an explicit **deployment/validation distinction**, carried by two
bundle variables passed to the pipelines as Spark conf:

| Variable | DEV | UAT / PROD |
|---|---|---|
| `deployment_mode` | `dev_shakedown` | `full_validation` |
| `enable_hu_reconciliation` | `false` | `true` |

- **DEV = technical shakedown.** Source `connected_plant_dev.sap`; reference
  `published_dev.central_services`; targets `connected_plant_dev.silver_io_reporting`
  + `gold_io_reporting`. HU-dependent models are **not materialised**, so the
  missing HU reference tables do not block the non-HU Silver/Gold shakedown.
- **UAT = full validation.** Reference `published_uat.central_services` (full set
  incl. HU); `enable_hu_reconciliation=true`; HU tables are **required** (the UAT
  preflight fails if they are absent). UAT is the **first** environment in which
  HU reconciliation and business validation occur.

### HU-dependent models gated by `enable_hu_reconciliation`

Gated via `hu_reconciliation_enabled()` (`silver/helpers.py`, `gold/_shared.py`),
which reads the conf and **defaults to `true`** so a missing conf never silently
drops HU in a real environment:

- Silver: `handling_unit` (`silver/tables/inbound.py`; reads
  `published.handlingunit_vekp` / `_vepo`).
- Gold: `gold_hu_reconciliation`, `gold_handling_unit_summary`, and the HU branch
  of `gold_reconciliation_alerts` (`gold/warehouse_flow_gold.py`,
  `gold/warehouse_inbound_gold.py`).
- Security SQL: the `gold_hu_reconciliation_secured` / `gold_handling_unit_summary_secured`
  views and their base-table REVOKEs are omitted from `gold_security_dev.sql` /
  `gold_security_harden_dev.sql` (generator gated by env).

In DEV shakedown these objects are simply **absent from the pipeline graph** —
not faked, not empty placeholders. `gold_data_freshness_status` reports
`handling_unit` as `NO_DATA` (it is "medium" criticality, so it does not trip the
critical freshness gate). **None of the 7 Warehouse360 governed source objects
depend on HU**, so the non-HU shakedown and Warehouse360 source/consumption
validation are unaffected.

### DEV schema convention

DEV now uses `connected_plant_dev.silver_io_reporting` + `gold_io_reporting`
(supersedes the interim `silver_dev` from the baseline ADR), so all environments
share the `*_io_reporting` convention.

## Consequences / what this does NOT claim

- DEV shakedown can validate **deployment mechanics and non-HU contract
  structure** only. It is **not** business validation — DEV data is not
  business-representative.
- **HU-dependent outputs remain not business-validated** until UAT, and their
  dependent contracts stay blocked/partial.
- **No fake business data** is created; no HU placeholders.
- A green DEV shakedown does **not** imply UAT readiness or app cutover.
- Warehouse360 contracts are **not** promoted to active/business-valid.

## Alternatives considered

- *Copy/seed HU tables into DEV from UAT.* Rejected: `central_services` is
  externally owned; `published_uat` is not reachable from the DEV workspace; and
  fabricating/duplicating reference data is out of scope and risks drift.
- *Materialise empty HU placeholder tables in DEV.* Rejected as the default —
  empty placeholders read as "validated but zero rows". Only acceptable if
  pipeline compilation strictly required it; it does not (conditional definition
  removes the model from the graph cleanly).
