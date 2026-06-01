# ADR 007 — Second bronze source (published / central_services)

## Status
Accepted

## Context
The warehouse-operations data product needs cross-application master and document data that
is **not replicated into the SAP source** (`${source_catalog}.${source_schema}`, e.g.
`connected_plant_uat.sap`). Verified against UAT, these live in a separate governed catalog
`published_uat.central_services`:

- **plant master** `plantcode_t001w`, **customer master** `customermaster_kna1`,
  **vendor master** `vendormaster_lfa1`
- **purchase orders** `procurementorderobject_ekko` / `_ekpo`
- **handling units (SSCC)** `handlingunit_vekp` / `_vepo`

## Decision
Introduce a **second, parameterised bronze source** alongside the SAP source.

- New bundle variables `published_catalog` / `published_schema` (`databricks.yml`), set per
  target: `published_uat.central_services` for dev/uat, `published_prod.central_services`
  for prod.
- A lazy helper `bronze_published()` (`silver/helpers.py`) resolves the source at call time
  and raises only if used without configuration — so the fast and quality pipelines, which
  do not read it, are unaffected.
- Silver tables that read it (`plant`, `customer`, `vendor`, `purchase_order`,
  `handling_unit`) are wired into the **slow/triggered** pipeline (which configures the
  published source), keeping the central_services dependency out of the continuous pipeline.

## Consequences
- The product gains plant/customer/vendor dimensions and inbound/handling-unit entities
  without coupling to the platform's `connected_plant_uat.gold.gold_*` tables.
- Per-target `published_*` names must be confirmed with the platform team (esp. prod and the
  `dev_sample` target, which points at `published_uat` since the sample catalog has no
  central_services).
- The fine-grained WMA-E-50 SSCC/pallet/campaign-split execution tables
  (`ZWM_SSCC_CREATE`, `ZTR_SPLIT`, `ZSCMWM_RFCTR`, `COCH`) remain **un-replicated**; handling
  units (VEKP/VEPO) approximate SSCC only. Full fidelity requires those tables to be onboarded.
