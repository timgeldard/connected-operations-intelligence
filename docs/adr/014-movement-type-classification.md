# ADR 014 — Movement type classification consolidation

## Status
Accepted

## Context
Gold production and warehouse KPIs depend on SAP movement type semantics (`MSEG.BWART` and
`RESB.BWART`). Before this decision, MSEG-based Gold tables joined to
`silver.movement_type_classification`, while RESB-based Gold tables hardcoded BWART `261` for
PP-PI component consumption and dispensary backlog.

That split created drift risk: future plant-specific consumption or bulk-drop codes would require
edits in multiple Gold tables, and tests could pass while the conformed movement overlay had
changed.

## Decision
`silver/movement_types.py` remains the authoritative source for IOReporting movement semantics.
The `silver.movement_type_classification` table now persists:

* `movement_category` — reporting category such as `PRODUCTION`, `PROCUREMENT`, `TRANSFER`, or
  `CONSUMPTION`.
* `is_po_receipt` / `is_po_receipt_reversal` — 103/104 purchase-order GR semantics.
* `is_production_consumption` / `is_production_consumption_reversal` — 261/262 PP-PI component
  semantics.
* `is_custom_bulk_drop` — confirmed Z01 bulk-drop semantics.

Gold tables must consume these flags instead of hardcoding BWART where a conformed flag exists.
`gold_dispensary_backlog` and `gold_process_order_component_status` now filter RESB rows using
`is_production_consumption`.

## Consequences
* 101 production receipts remain distinct from 103 PO receipts:
  * 101 contributes to production output via `is_production_receipt`.
  * 103 contributes to inbound throughput and inbound PO backlog via `is_po_receipt`.
* Z01 is treated as a custom goods issue/bulk drop and is available to throughput KPIs through the
  conformed overlay.
* T156-only or newly introduced movement codes still appear in the classification table as
  `OTHER` with false KPI flags until functionally classified.
* Movement-type changes require updates to `silver/movement_types.py`, unit tests, and the
  relevant data contracts before they are used in Gold logic.

## Follow-ups
* Functionally classify high-volume custom movement codes still listed as unconfirmed in
  `silver/movement_types.py`.
* Consider enriching `silver.reservation_requirement` with classification flags if more Gold
  RESB consumers emerge.
