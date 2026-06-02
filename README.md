# Connected Plant — Integrated Operations Reporting Pipelines

Bronze SAP replicas → Silver operational state → Gold reporting aggregates, across **production,
warehouse flow, stock/reconciliation, inbound/handling-units, and exceptions**.

Aecorsoft replicates SAP (and a second `central_services` published source) incrementally into
bronze. This bundle conforms it into Silver operational tables (SCD Type 1) and computes Gold
aggregates. **Maturity varies by table — see the status labels below; some outputs are pilot-grade
or directional, not yet hardened.**

## Architecture

```
   [Bronze]  connected_plant.<env>.sap   +   published_<env>.central_services
        │
        ▼  Silver — SCD1 (apply_changes), liquid clustering, plant row filters
   [Silver]  connected_plant.<env>.silver
        process_order · process_order_operation · pi_sheet_execution · goods_movement · batch_stock
        warehouse_transfer_order · warehouse_transfer_requirement · reservation_requirement
        outbound_delivery · storage_bin · stock_at_location · material_valuation
        purchase_order · handling_unit · downtime_event · quality_inspection_lot
        material · storage_location · plant · customer · vendor · storage_type · work_centre
        capacity_utilisation · movement_type_classification · storage_type_role_mapping
        │
        ▼  Gold — triggered batch; Materialized Views (trusted aggregate layer)
   [Gold]  connected_plant.<env>.<gold_schema>
        Production        gold_shift_output_summary · gold_order_otif_metrics · gold_plant_production_quality_summary
        Warehouse flow    gold_transfer_order_performance · gold_inbound_outbound_throughput
                          gold_transfer_requirement_backlog · gold_dispensary_backlog · gold_lineside_stock
                          gold_delivery_pick_status · gold_process_order_staging
        Stock / recon     gold_stock_availability · gold_bin_occupancy · gold_stock_expiry_risk · gold_stock_reconciliation
        Inbound / HU      gold_inbound_po_backlog · gold_handling_unit_summary
        Exceptions        gold_warehouse_exceptions          Scorecard  gold_warehouse_kpi_snapshot
        │
        ▼  Standalone jobs: gold/recon (SAP↔Silver↔Gold reconciliation control) · gold/snapshots (daily history)
```

Silver uses SCD Type 1 (`apply_changes`) with liquid clustering and Unity Catalog row filters for
plant-level access. Gold runs as a **trusted aggregate layer** (row filters off to avoid
MV full-refresh); plant trimming on Gold is served via `*_secured` views and snapshot row filters
(ADR 012).

## Gold table status

Maturity labels: **Production-candidate** · **Pilot-grade** (usable, known gaps) · **Directional only** · **Compatibility only** (legacy name/shape).

| Table | Domain | Status | Key caveat |
|---|---|---|---|
| `gold_order_otif_metrics` | Production | Production-candidate | Process-order adherence, **not** customer OTIF; all-completed window |
| `gold_transfer_order_performance` | Warehouse | Production-candidate | — |
| `gold_inbound_outbound_throughput` | Warehouse | Production-candidate | — |
| `gold_transfer_requirement_backlog` | Warehouse | Production-candidate | — |
| `gold_dispensary_backlog` | Warehouse | Production-candidate | RESB 261 line-picks |
| `gold_bin_occupancy` | Stock | Production-candidate | — |
| `gold_stock_availability` | Stock | Production-candidate | — |
| `gold_plant_production_quality_summary` | Production | Pilot-grade | All-time window; no period grain |
| `gold_stock_expiry_risk` | Stock | Pilot-grade | **Prod MV omits expiry buckets** (test-only; Phase 2) |
| `gold_lineside_stock` | Warehouse | Pilot-grade | Storage-type roles from config (9xx fallback); **prod MV omits `min_days_to_expiry`** |
| `gold_delivery_pick_status` | Warehouse | Pilot-grade | **Prod MV omits `risk_band`/`days_to_goods_issue`** (Phase 2) |
| `gold_process_order_staging` | Warehouse | Pilot-grade | Assumes TO source ref = process order; **prod MV omits `risk_band`/`days_to_start`** |
| `gold_stock_reconciliation` | Recon | Pilot-grade / directional | Plant×material grain; no MARM/UoM; interim/physical split via role map |
| `gold_handling_unit_summary` | Inbound/HU | Pilot-grade | SSCC approximated from VEKP/VEPO |
| `gold_warehouse_exceptions` | Exceptions | Pilot-grade | Severity/SLA rules need business validation |
| `gold_warehouse_kpi_snapshot` | Scorecard | Pilot-grade | Mixed-grain counts |
| `gold_inbound_po_backlog` | Inbound | Directional only | Open-PO backlog, **not** GR status (no EKBE/MSEG 101) |
| `gold_shift_output_summary` | Production | Compatibility only | No shift dimension yet — daily output under a legacy name |

> ⚠️ Several tables have a **production/test schema divergence**: `current_date()`-derived columns
> are emitted only in test mode (to keep MVs incrementally refreshable). Tracked for resolution in
> Sprint 2 — see [`docs/hardening-plan.md`](docs/hardening-plan.md).

## Quick start

**Prerequisites:** Databricks CLI ≥ v0.288.0 and workspace auth configured.

```bash
# Install CLI (macOS)
brew tap databricks/tap && brew install databricks

# Authenticate
databricks auth login --profile DEFAULT

# Validate bundle configurations for targets
databricks bundle validate -t dev_uat_source --profile DEFAULT
databricks bundle validate -t dev_sample --profile DEFAULT
databricks bundle validate -t uat --profile DEFAULT
databricks bundle validate -t prod --profile DEFAULT

# Deploy to specific targets (writes to target catalogs)
databricks bundle deploy -t dev_uat_source --profile DEFAULT
databricks bundle deploy -t dev_sample --profile DEFAULT
databricks bundle deploy -t uat --profile DEFAULT
databricks bundle deploy -t prod --profile DEFAULT
```

Start the pipelines once after deploy:

```bash
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

## Development

```bash
# Install test dependencies
pip install -r tests/requirements-test.txt

# Run tests
PYTHONPATH=. pytest
```

## Docs

- [`docs/README.md`](docs/README.md) — documentation index (specs, ADRs, roadmap, position papers)
- [`docs/hardening-plan.md`](docs/hardening-plan.md) — active hardening sprint scope & deferred items
- [`silver/design_spec.md`](silver/design_spec.md) — Silver architecture, table catalogue, expectations strategy
- [`gold/design_spec.md`](gold/design_spec.md) — Gold architecture, table catalogue, status & limitations
- [`docs/data_contracts.md`](docs/data_contracts.md) — grain/keys/source/freshness contracts per table
- [`docs/adr/`](docs/adr/) — Architecture decision records (001–012)
- [`docs/runbook.md`](docs/runbook.md) — Operational runbook for Silver & Gold pipelines
