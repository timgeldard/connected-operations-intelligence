# Warehouse360 Contract Status

> **All 7 first-wave governed views CREATE in DEV (2026-06-08, Gold update `73ebef43`)** — technical
> shape only. `not-live-validated` is retained for every contract: RLS/entitlement is unproven (no
> representative identities tested; DEV `*_secured` views are pass-throughs) and two views are
> created-empty in the DEV shakedown. Full evidence:
> [DEV live-validation results](../architecture/warehouse360-dev-live-validation-results.md).
>
> **UAT (2026-06-08): validation attempted, did NOT complete (Outcome A).** A first-time UAT deploy
> surfaced a stage-gate leak (ungated inbound/outbound silver) and a warehouse config bug (C061→104, not
> 208), both fixed in `fix/warehouse360-stage-gate-inbound-outbound-p817`. Gold/consumption views were
> not run, and RLS/entitlement could not be proven (no write access to `published_uat.security.model`;
> deployer owns the Gold objects). No contract advances; no app cutover. Evidence:
> [UAT validation results](../architecture/warehouse360-uat-validation-results.md).
>
> **UAT revalidation (2026-06-09) after stage-gate fixes — Outcome A (partial).** Silver gate now FIXED
> and proven (the 6 operational tables checked this run = C061+P817; `purchase_order` 184,553/2 — leak gone;
> T320 C061→104, P817→208). All 7 consumption views CREATE; inbound/outbound/shortfalls correctly 2-plant.
> `overview` (133) + `im_wm_reconciliation` (327) still leaked via ungated `storage_bin` +
> `stock_at_location` — **now fixed in `fix/silver-gate-storage-bin-stock-at-location` (DEV-validated: both
> → 2 plants).** RLS unproven (validation_open = data-shape only; the `users`-group absence is a Gate B/C
> harden concern, NOT a data-shape blocker). No contract advances; no cutover. Next: re-run UAT under validation_open.

| Contract ID | View | Runtime status | Validation status | Route-covered? | Notes (DEV 2026-06-08) |
|---|---|---|---|---|---|
| warehouse360.overview | `vw_consumption_warehouse360_overview` | expected | not-live-validated | yes | Creates: 543 rows, 0 null plant_id, 0 dup PK. Null-plant rows filtered (ADR-0004 D7 / PR A). RLS unproven. |
| warehouse360.inbound_backlog | `vw_consumption_warehouse360_inbound_backlog` | expected | not-live-validated | yes | Creates: 1,112,080 rows, 0 null plant/po/item, 0 dup PK. New PO-line model `gold_inbound_po_line_backlog` (D1 / PR C, v0.2.0). gr_qty/open_qty/delivery_date/qa_status/vendor_name deferred. RLS unproven. |
| warehouse360.outbound_backlog | `vw_consumption_warehouse360_outbound_backlog` | expected | not-live-validated | yes | Creates: 2,162,748 rows, 0 null plant_id, 0 dup PK. `carrier` removed from first wave (ADR-0004 D4). RLS unproven. |
| warehouse360.staging_workload | `vw_consumption_warehouse360_staging_workload` | expected | not-live-validated | yes | Creates — **empty** (gold_process_order_staging 0 rows in DEV shakedown); shape-valid, not data-validated. Order-grain first wave (ADR-0004 D3 / PR B, v0.2.0); reservation_no/batch_id/sap_order deferred. |
| warehouse360.stock_exceptions | `vw_consumption_warehouse360_stock_exceptions` | expected | not-live-validated | candidate | Creates — **empty** (gold_stock_expiry_risk 0 rows in DEV); shape-valid. `storage_location_id` removed (ADR-0004 D5, v0.2.0). |
| warehouse360.shortfalls | `vw_consumption_warehouse360_shortfalls` | expected | not-live-validated | candidate | Creates: 1,788 rows, 0 null material_id, 0 dup PK (plant×material). New model `gold_transfer_requirement_material_backlog` (ADR-0004 D2 / PR D, v0.2.0); reads RLS-secured view. RLS unproven. |
| warehouse360.im_wm_reconciliation | `vw_consumption_warehouse360_im_wm_reconciliation` | expected | not-live-validated | yes | Creates: 198,860 rows, 0 dup PK. First-wave AGGREGATE exception summary (ADR-0004 D6, v0.2.0); storage_location_id/bin_id removed, detail-grain deferred. RLS unproven. |

## Status definitions

* **`expected`**: contract/view is expected to exist as part of the governed path.
* **`not-live-validated`**: validation SQL may exist, but the view has not been proven in Databricks.
* **`route-covered`**: app/API route is expected to use this contract.
* **`candidate`**: useful for validation/reporting, but not necessarily part of first governed runtime cutover.

> [!IMPORTANT]
> Do not mark any contract as `validated`, `pilot`, or `production-ready` unless there is confirmed Databricks evidence.
