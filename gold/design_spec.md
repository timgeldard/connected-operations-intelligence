# Gold Layer Design Specification

**Schema:** `${var.catalog}.${var.gold_schema}`  
**Data product:** Integrated Operations — Business Aggregations & KPIs  
**Primary personas:** Plant Manager, Supervisor, Operations Analyst  
**Source:** `${var.catalog}.${var.schema}` (parameterized — see Deployment)

---

## Architecture

```
${var.catalog}.${var.schema} (Silver — clean conformed tables)
          │
          │  Batch / Triggered read (spark.read.table)
          ▼
   Delta Live Tables Pipeline (gold_pipeline)
   Mode: Triggered (batch)
   Target catalog: ${var.catalog}
   Target schema: ${var.gold_schema}
          │
          └─ Gold tables (Materialized Views)
               Liquid clustering by plant_code + date dimensions
               Change Data Feed enabled
          │
          ▼
   ${var.catalog}.${var.gold_schema}
```

### Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline mode | **Triggered (batch)** | More cost-effective for business-level aggregations; near-real-time is not required for KPIs |
| Dataset types | **Materialized Views** | Auto-recomputes aggregations to stay correct as Silver tables receive updates |
| Read strategy | **Batch read** (`spark.read.table`) | Prevents streaming state-management overhead for aggregations on streaming tables |
| Clustering | **Liquid clustering** on `plant_code` + dates | Ensures fast retrieval for dashboard queries filtering by plant or time periods |
| Security/performance tradeoff | **Trusted Gold aggregate layer** | Silver remains secure for direct access. Gold row filters are disabled by default to avoid row-filter-driven full MV refreshes; apply plant controls at the downstream consumption boundary. |

---

## Deployment

Managed via Declarative Automation Bundle (DAB).

### Environment Target Matrix

| Target | Output Catalog (`${var.catalog}`) | Silver Schema (`${var.schema}`) | Gold Schema (`${var.gold_schema}`) | Source Catalog (`${var.source_catalog}`) | Source Schema (`${var.source_schema}`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **dev_uat_source** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_uat` (Compromise) | `sap` |
| **dev_sample** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_dev` | `sap_sample` |
| **uat** | `connected_plant_uat` | `silver` | `gold` | `connected_plant_uat` | `sap` |
| **prod** | `connected_plant_prod` | `silver` | `gold` | `connected_plant_prod` | `sap` |

---

## Table Catalogue

### `gold_shift_output_summary`
- **Granularity:** 1 row per plant × posting date × material × UOM.
- **Description:** Aggregated daily produced quantity (receipt type 101 minus reversals 102) and scrap quantity (movements 551/552). The historical table name is retained for compatibility; no shift dimension is present until a shift calendar is introduced.
- **Freshness:** Depends on `silver_fast_pipeline` being healthy; the Gold refresh job does not trigger the continuous fast pipeline.

### `gold_order_otif_metrics`
- **Granularity:** 1 row per process order.
- **Description:** Internal process-order schedule-adherence metrics, comparing actual vs scheduled completion dates and ordered vs yield quantities. This is not customer-delivery OTIF.
- **Window:** All completed/closed process orders currently remain in scope; add a period grain before using this as a period-comparable KPI.
- **Freshness:** Depends on `silver_fast_pipeline` being healthy; the Gold refresh job does not trigger the continuous fast pipeline.

### `gold_plant_production_quality_summary`
- **Granularity:** 1 row per plant.
- **Description:** All-time production volumes, scrap, total downtime, and quality rate (yield / (yield + scrap)).
- **Window:** This blends all available history. Add a fiscal/posting-period grain before using it for trend or period comparison.

### `gold_transfer_order_performance`
- **Granularity:** 1 row per warehouse × plant × confirmed user × confirmed date × source storage type.
- **Description:** Transfer-order execution metrics for warehouse operations, including confirmed/requested/picked quantities, pick accuracy, fully confirmed rate, confirmation cycle time, and processing time.
- **Freshness:** Depends on `silver_slow_pipeline` warehouse transfer-order refresh and the triggered Gold refresh job.

### `gold_inbound_outbound_throughput`
- **Granularity:** 1 row per plant × storage location × posting date.
- **Description:** Goods-movement throughput by day, using the conformed movement-type classification to net reversals for inbound, outbound, transfer, and adjustment quantities.
- **Freshness:** Depends on `silver_fast_pipeline` goods movement and `silver_slow_pipeline` movement classification refresh.

### `gold_bin_occupancy`
- **Granularity:** 1 row per warehouse × plant × storage type × bin type.
- **Description:** Current physical-bin occupancy and block counts from SCD1 `storage_bin`, with quant-level stock quantities summed after deduplicating bin-level attributes by `bin_code`.
- **Freshness:** Depends on `silver_fast_pipeline` storage-bin refresh and the triggered Gold refresh job.

### `gold_stock_availability`
- **Granularity:** 1 row per plant × storage location × material × batch × base UOM.
- **Description:** Current batch-stock availability, separating unrestricted available stock from quality, blocked, restricted-use, transfer, and blocked-return quantities.
- **Freshness:** Depends on `silver_fast_pipeline` batch-stock refresh and the triggered Gold refresh job.

### `gold_transfer_requirement_backlog`
- **Granularity:** 1 row per warehouse × plant × source/destination storage type × queue × transfer priority.
- **Description:** Current open transfer-requirement backlog. Completed requirements and zero-open-quantity items are excluded.
- **Freshness:** Depends on `silver_fast_pipeline` transfer-requirement refresh and the triggered Gold refresh job.
- **Snapshot note:** This PR intentionally adds current-state materialized views only. Daily append snapshots should be added with an explicit retention and scheduling decision.

### `gold_stock_expiry_risk`
- **Granularity:** 1 row per plant × material × batch × base UOM.
- **Description:** Current batch expiry exposure from storage-bin quants joined to material shelf-life policy, with expired, <7 day, 7-30 day, 30-90 day, and OK quantity buckets.
- **Freshness:** Depends on `silver_fast_pipeline` storage-bin refresh, `silver_slow_pipeline` material refresh, and the triggered Gold refresh job.

### Access-tier foundation
- **Current state:** Operative and supervisor access remains plant-scoped through Silver `plant_access_filter`.
- **Cluster-lead tier:** Documented in ADR-005. Execution is blocked until a governed plant-to-cluster source is selected.

### Deliberate exclusions
- Loftware compliance and label-template attributes are not included in Silver `material` or Gold because they are not used by the current reporting layer.

---

## Warehouse operations — metric dictionary

One-line definition per warehouse Gold table (grain · key measures · scope/filter).

> **⚠️ Pilot-grade / directional** tables are marked **[PILOT]** below: they are usable as
> indicators but carry known grain/assumption/source gaps (see *Known limitations*) and must NOT
> be treated as hardened, reconciled figures until those are addressed. ADRs 009 (reconciliation
> depth) and the line-side / staging follow-ups track the production rebuilds.

| Table | Grain | Key measures | Scope / notes |
|---|---|---|---|
| `gold_transfer_order_performance` | wh × plant × operator × confirmed_date × source ST | pick_accuracy, fully_confirmed_rate, cycle/processing time | confirmed TO items |
| `gold_transfer_requirement_backlog` | wh × plant × queue × src/dst ST × priority | open backlog count, open qty, oldest age | open TRs (not complete, open_qty>0) |
| `gold_bin_occupancy` | wh × plant × storage_type × bin_type | occupancy_rate, occupied/empty/blocked counts | current bin state |
| `gold_stock_availability` | plant × sloc × material × batch × UOM | unrestricted/QI/blocked/restricted/in-transfer | batch stock (MCHB) |
| `gold_stock_expiry_risk` | plant × material × batch × UOM | expiry buckets (expired/<7/7-30/30-90/OK) | bin stock joined to shelf-life |
| `gold_dispensary_backlog` | plant × supply area × wh | open task/order count, open/required qty, urgency dates | RESB BWART 261, not deleted, open_qty>0 |
| `gold_lineside_stock` | plant × wh × storage_type × material × batch × UOM | total/available qty, min days-to-expiry | occupied bins in line-side STs (`_LINESIDE_PREDICATE`) |
| `gold_delivery_pick_status` | delivery | pick_fraction, line_count, is_shipped, `risk_band` | LIPS qty-based pick % (not TO-level); RAG: shipped→green, null GI→grey |
| `gold_stock_reconciliation` **[PILOT]** | plant × material | im/wm totals, delta, inventory_value, mismatch_class, abc_class | IM(MARD) vs WM(bins); coarse grain — directional only; tolerance = max(0.1, 1% IM); abc 'U' = unpriced |
| `gold_process_order_staging` **[PILOT]** | process order | staging_fraction, to_items done/total, `risk_band` | BETYP='F' TOs; BENUM↔AUFNR validated 100% across UAT warehouses (2026-06-02) |
| `gold_process_order_staging_validation` | plant × warehouse | total_to_headers, f_type_to_headers, benum_match_pct, validation_status | persistent VALIDATED/NOT_VALIDATED/NOT_APPLICABLE per plant/warehouse |
| `gold_inbound_po_backlog` **[PILOT]** | plant × vendor × purchasing org | open item/PO count, ordered qty, open value | open PO items (PO backlog, **not** GR history) |
| `gold_handling_unit_summary` | plant × wh × HU status × ref-doc category | HU/SSCC/delivery/material counts, gross weight (per-HU) | EXIDV = SSCC |
| `gold_warehouse_exceptions` | exception instance | severity (1-4), sla_hours, quantity, age | UNION of 7 integrity/aging checks |
| `gold_warehouse_kpi_snapshot` | plant | open orders/TRs/TOs/deliveries/inbound, bin counts, util % | per-plant scorecard (mixed-grain counts) |

## Known limitations / follow-ups (warehouse product)

- **Stock reconciliation grain is coarse.** `gold_stock_reconciliation` compares IM (MARD) vs WM at **plant × material** only. It does not yet map WM-managed storage locations, reconcile by batch (MARD is non-batch), or normalise UoM. A `max(0.1, 1% of IM)` tolerance suppresses rounding noise, but a v2 should reconcile at plant × storage-location × warehouse × material × batch × stock-category with a WM-managed-sloc mapping and UoM normalisation.
- **Storage-type role coverage is partial.** `gold_lineside_stock` and `gold_stock_reconciliation` read roles from `silver.storage_type_role_mapping` (governed config, backed by `storage_type_role_mapping_config`). Unmapped storage types fall back to a 9xx-prefix heuristic (INTERIM) or PHYSICAL. UAT bronze profiling (2026-06-02): 140 warehouses / 3,464 ST combos; only C061/warehouse 208 is partially seeded (6 of 28 non-9xx types mapped). `gold_stock_reconciliation.is_operationally_trusted = false` for any plant with unmapped STs. `gold_storage_type_role_coverage_status` surfaces VALIDATED / PARTIAL / MISSING per warehouse on every Gold run. Do not add roles based on profiling alone — role assignment requires WM config owner sign-off per warehouse.
- **`gold_process_order_staging`** is scoped to BETYP='F' TOs (LTAK reference type for process-order staging). UAT validation (2026-06-02) found 100% BENUM↔AUFNR match across all warehouses. `gold_process_order_staging_validation` provides persistent per-plant/warehouse status on every Gold run.
- **`gold_inbound_po_backlog` is a PO backlog** (renamed from `gold_inbound_gr_status`), not goods-receipt history (no EKBE/MSEG GR, schedule lines, or remaining qty). **`gold_delivery_pick_status`** is delivery-quantity based, not TO-level picking status. Names reflect this.
- **Gold / snapshot security (ADR 012).** Gold MVs stay trusted (row filters off to avoid MV full-refresh, per ADR-005); plant access on the MVs is served through **`<table>_secured` views** that apply `plant_access_filter(plant_code)` (`scripts/generate_gold_security_sql.py` → `resources/sql/gold_security_<env>.sql`) — the `users` group is granted the views, not the base tables. **Snapshot tables are physical Delta tables and carry a real plant row filter applied in-job** by `gold/snapshots/warehouse_snapshot.py`, which drops the filter during its own maintenance DELETEs and re-applies it (so the run-as principal needs MODIFY + EXECUTE on the function, not `silver_admin`).
- **CDF on batch dimensions.** `plant`, `customer`, `vendor`, `storage_type`, `stock_at_location`, `material_valuation`, `handling_unit` enable Change Data Feed for consistency with the existing reference dims and potential downstream consumers, despite having no streaming consumer in this layer today.
- **SSCC fidelity.** Handling units (VEKP/VEPO) approximate SSCC; the WMA-E-50 execution tables (`ZWM_SSCC_CREATE`, `ZTR_SPLIT`, `ZSCMWM_RFCTR`, `COCH`) are not replicated (see ADR 007).
