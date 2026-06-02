# Source dependency map

Upstream dependencies for each Gold table: the Silver tables it reads, the bronze/published SAP
sources behind those, and which Silver pipeline tier refreshes them. Use this with
`docs/data_contracts.md` (grain/keys/caveats) and `docs/freshness_contracts.md` (SLAs, Sprint 3).

**Silver pipeline tiers:** `fast` = continuous (`silver_fast_pipeline`) · `slow` = triggered reference
(`silver_slow_pipeline`) · `quality` = triggered (`silver_quality_pipeline`) · `published` =
second bronze source `published_<env>.central_services` · `seed` = config/seed table.

| Gold table | Silver dependencies | Bronze / published sources | Tier | Critical? |
|---|---|---|---|:--:|
| `gold_shift_output_summary` | `goods_movement`, `movement_type_classification` | MSEG/MKPF; T156/T156T + conformed overlay | fast + slow/published | yes |
| `gold_process_order_schedule_adherence` | `process_order` | AUFK/AFKO/AFPO | fast | yes |
| `gold_plant_production_quality_summary` | `process_order`, `downtime_event` | AUFK/AFKO; downtime Z-source | fast | medium |
| `gold_process_order_operations` | `process_order_operation`, `pi_sheet_execution`, `downtime_event`, `process_order` | AFVC/AFVV/AFRU; PI sheet Z-source; downtime Z-source; AUFK/AFKO | fast | yes |
| `gold_order_downtime_summary` | `downtime_event`, `process_order` | downtime Z-source; AUFK/AFKO | fast | medium |
| `gold_process_order_component_status` | `reservation_requirement`, `movement_type_classification`, `process_order`, `batch_stock` | RESB; T156/T156T + conformed overlay; AUFK/AFKO; MCHB | fast + slow/published | yes |
| `gold_transfer_order_performance` | `warehouse_transfer_order` | LTAK/LTAP | fast | yes |
| `gold_inbound_outbound_throughput` | `goods_movement`, `movement_type_classification` | MSEG/MKPF; T156/T156T + conformed overlay | fast + slow/published | yes |
| `gold_transfer_requirement_backlog` | `warehouse_transfer_requirement` | LTBK/LTBP | fast | yes |
| `gold_dispensary_backlog` | `reservation_requirement`, `process_order` | RESB; AUFK/AFKO | fast | yes |
| `gold_lineside_stock` | `storage_bin`, `storage_type_role_mapping` | LAGP/LQUA/T320; role map (seed) | slow + seed | medium |
| `gold_delivery_pick_status` | `outbound_delivery` | LIKP/LIPS | fast | medium |
| `gold_stock_reconciliation` | `stock_at_location`, `storage_bin`, `material_valuation`, `storage_type_role_mapping` | MARD, LQUA/LAGP, MBEW; role map (seed) | fast + slow + seed | yes |
| `gold_stock_reconciliation_v2` | `batch_stock`, `stock_at_location`, `material`, `storage_bin`, `warehouse_storage_location_mapping`, `material_uom_conversion`, `material_valuation`, `storage_type_role_mapping` | MCHB, MARD, LQUA/LAGP, T320 (published), MARM, MBEW | fast + slow + seed + published | yes |
| `gold_stock_reconciliation_exceptions_v2` | reads from `gold_stock_reconciliation_v2` + `material` | — | — | yes |
| `gold_stock_reconciliation_summary_v2` | reads from `gold_stock_reconciliation_v2` | — | — | yes |
| `gold_stock_reconciliation_summary` | reads from `gold_stock_reconciliation_summary_v2` | — | — | yes |
| `gold_process_order_staging` | `warehouse_transfer_order`, `process_order`, `process_order_staging_reference_mapping_config` | LTAK/LTAP; AUFK/AFKO; staging trust config (seed) | fast + seed | yes |
| `gold_process_order_staging_validation` | `warehouse_transfer_order`, `process_order` | LTAK/LTAP; AUFK/AFKO | fast | yes |
| `gold_storage_type_role_coverage_status` | `storage_bin`, `storage_type_role_mapping` | LAGP/LQUA; role map (seed) | slow + seed | yes |
| `gold_stock_availability` | `batch_stock` | MCHB | fast | yes |
| `gold_bin_occupancy` | `storage_bin` | LAGP/LQUA/T320 | slow | yes |
| `gold_stock_expiry_risk` | `storage_bin`, `material` | LAGP/LQUA; MARA/MARC | slow | medium |
| `gold_inbound_po_backlog` | `purchase_order` | EKKO/EKPO (**published**) | published | medium |
| `gold_inbound_po_backlog_enhanced` | `purchase_order`, `goods_movement`, `movement_type_classification`, `warehouse_transfer_order` | EKKO/EKPO (**published**); MSEG/MKPF; T156/T156T + overlay; LTAK/LTAP | published + fast + slow/published | medium |
| `gold_handling_unit_summary` | `handling_unit` | VEKP/VEPO (**published**) | published | medium |
| `gold_warehouse_exceptions` | multi: `storage_bin`, `batch_stock`, `warehouse_transfer_order`, `warehouse_transfer_requirement`, reconciliation inputs | LAGP/LQUA, MCHB, LTAK/LTAP, LTBK/LTBP, MARD/MBEW | fast + slow + seed | yes |
| `gold_warehouse_kpi_snapshot` | rollup of the above (orders/TRs/TOs/deliveries/inbound/bins) | as above | mixed | medium |
| `gold_data_freshness_status` | monitored Silver tables in `FRESHNESS_CONTRACTS` | mixed | mixed | yes |
| `gold_data_health_summary` | `gold_data_freshness_status`, coverage/validation/reconciliation Gold status tables | mixed | mixed | yes |

## Notes
- **Published-source dependency:** `gold_inbound_po_backlog` and `gold_handling_unit_summary` require
  the second bronze source (`published_<env>.central_services`); `published_prod` is **unconfirmed**
  (see `docs/ingestion_requests.md`). dev_sample reads live UAT masters (isolation caveat).
- **Reference/config dependencies** (`movement_type_classification`, `storage_type_role_mapping`) must be
  populated and functionally signed off or Gold semantics degrade silently. `movement_type_classification`
  now keeps T156-only codes as `OTHER`, but receipt/issue/transfer/output KPI flags still require the
  conformed overlay to be maintained and validated.
- **Reconciliation tie-out:** the standalone `gold/recon` job verifies SAP→Silver→Gold counts; the
  `gold/snapshots` job appends daily history. Neither is a Gold MV (separate jobs).
- A full per-SAP-table source dictionary is in `data_dictionary.md` (generated from
  `schema_documentation.md`, CI-checked).
