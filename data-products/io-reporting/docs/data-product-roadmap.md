# Warehouse / Operations data product — next-phase roadmap

Consolidated implementation plan for three follow-on initiatives. Decisions are captured in
ADRs 008–010; this document is the phased build plan, file map, dependencies, and sequence.
**Implementation approach (agreed): working draft with decisions stubbed** — ship functional,
bundle-validatable code now, with config/source items seeded as empty/sample tables plus a
documented population step (the `movement_type_classification` / `wm_managed_sloc` pattern).

Conventions reused: silver `@dlt.view(stg_*)` + `apply_changes` SCD1 / batch `@dlt.table`;
gold `@dlt.table(**gold_table_args(...))`; row-filter list in `scripts/generate_row_filter_sql.py`;
unit tests mirroring transforms (`tests/`); per-phase commits + `databricks bundle validate`.

---

## Initiative 1 — Shift calendar & shift-grain Gold  (ADR 008)
Dependency: per-plant shift config (no SAP shift master in bronze). **Stub:** seed `shift_calendar`
empty/sample; bucket unmatched to `UNASSIGNED`.

| Phase | Build | Key files |
|---|---|---|
| 1 — master data | `silver.shift_calendar` (SCD2, config/seed source) + `assign_shift()` helper (cross-midnight) | `silver/tables/shift.py`, `silver/helpers.py`, `silver/dlt_silver_slow.py` |
| 1 — enrich | add `shift_id`/`shift_date` to `goods_movement`, `process_order`/confirmations | `silver/tables/warehouse_fast.py`, `silver/tables/process_order.py` |
| 2 — gold | regrain `gold_shift_output_summary` (plant×shift_date×shift_id×material×UOM); `gold_shift_downtime_summary`; `gold_shift_kpi_snapshot` | `gold/dlt_gold_pipeline.py` / `gold/warehouse_kpis.py`, `gold/snapshots/` |
| 3 — test/rollout | synthetic multi-shift tests incl. cross-midnight; >95% coverage expectation; docs | `tests/`, `gold/design_spec.md`, `docs/ingestion_requests.md` (TC37A request) |

## Initiative 2 — Detailed IM↔WM reconciliation  (ADR 009)
Status: production-candidate v2 now implemented at plant × warehouse × material × batch ×
stock-category × UOM, with value rollup and current-state audit register. Dependencies resolved:
`MARM` is in Silver as `material_uom_conversion`, and T320 is in Silver as
`warehouse_storage_location_mapping`. Residual dependency: a governed bin/storage-type→sloc
configuration layer if the business requires true LGORT attribution for WM quants.

| Phase | Build | Key files |
|---|---|---|
| 1 — foundation | `silver.material_uom_conversion` (MARM) and `silver.warehouse_storage_location_mapping` (T320) wired into slow pipeline | `silver/tables/warehouse_reference.py`, `silver/tables/reference.py`, `silver/dlt_silver_slow.py` |
| 2 — core | `gold_stock_reconciliation_v2` (plant×wh×material×batch×stock_category×UOM; IM=MCHB/MARD, WM=storage_bin; mismatch_reason enum; default dynamic tolerance metadata) | `gold/warehouse_flow_gold.py` |
| 3 — analytics | `gold_stock_reconciliation_summary`, `gold_stock_value_reconciliation`, `gold_reconciliation_audit_log`; security views and contracts updated | `gold/warehouse_flow_gold.py`, `scripts/generate_gold_security_sql.py`, `gold/design_spec.md` |
| 4 — SAP parity extensions | `gold_movement_reconciliation`, `gold_hu_reconciliation`, `gold_physical_inventory_recon`, and `gold_reconciliation_alerts` for movement, HU/batch, PI count and alert consumption | `silver/tables/inbound.py`, `gold/warehouse_flow_gold.py`, `gold/freshness.py` |
| 5 — remaining SAP parity | open movement/pending-TO reason refinement and bin/storage-type→sloc attribution where business-owned WM config is available | future `gold/warehouse_flow_gold.py` + governed config |

## Initiative 3 — Living data dictionary & UC lineage  (ADR 010)  ← recommended first
Most self-contained; no business config. Lineage/tags populate post-deploy (degrades gracefully).

| Phase | Build | Key files |
|---|---|---|
| 1 — dictionary | extend generator to read `information_schema` comments/tags/owner; MD+HTML+JSON; glossary | `scripts/generate_data_dictionary.py` |
| 2 — lineage/governance | `gold_metadata_lineage_summary` on `system.access.*`; domain/sensitivity tags; owners; CI no-comment check | `gold/`, `scripts/`, `.github/workflows/ci.yml` |
| 3 — delivery | post-deploy DAB job regenerates docs; CI auto-commit; publish to UC Volume; runbook | `resources/*.job.yml`, `docs/` |

---

## Recommended sequence & effort
1. **#3 Data dictionary & lineage** (~4 wk) — self-contained, unblocks governance/docs for the
   new tables already shipped; no upstream decision needed.
2. **#1 Shift calendar** (~5–7 wk) — high business value; start once the shift-config source is
   agreed (seed lets Phase 1 proceed in parallel).
3. **#2 Reconciliation depth** (~4–6 wk) — needs MARM ingestion + `wm_managed_sloc`; builds on the
   existing `gold_stock_reconciliation`.

## Cross-cutting dependencies (track in `docs/ingestion_requests.md`)
- Shift: per-plant shift calendar config; optional `TC37A`/`TC37` replication.
- Reconciliation: `MARM` (UoM conversions) into bronze→silver; `wm_managed_sloc` population.
- Lineage: grants on `system.access.*`; tag/owner governance convention.
- Gold-schema-collision and `published_prod` decisions (already open) gate uat/prod for all three.
