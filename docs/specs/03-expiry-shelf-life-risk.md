# Spec 03 — Expiry & shelf-life risk (new build)

Read `docs/specs/_conventions.md` first. Branch: `feature/expiry-shelf-life-risk`.

## Objective

A new "Expiry Risk" view in wm-operations (Insight group): stock value at risk by expiry
horizon, expired-in-stock, and FEFO-violation signals, estate-wide where data allows.
This is a food business — expiry is a first-class operational risk that currently has no
surface beyond the dispensary FEFO flag.

## Critical dependency — check first

Batch expiry dates come from SAP batch master **MCH1** (`VFDAT` expiry, `HSDAT`
manufacture). A silver batch-master table may ALREADY exist by the time you start: the
trace-governed-lookups workstream (`feature/trace-governed-lookups` branch / its merge)
adds one if MCH1 is replicated. **First action:** grep `silver/tables/` for
`MCH1|VFDAT|batch_master|vendor_batch`.
- If present: build on it; verify its column aliases by reading the definition.
- If absent: add `silver.batch_master` yourself (slow/reference pipeline, reference.py
  idiom): MATNR→material_code, CHARG→batch_number, VFDAT→expiry_date, HSDAT→manufacture_date,
  LICHA→vendor_batch_number, with `bronze_columns_exist` guards and `sap_date` parsing
  (dual-format rule). MCH1 is client-level (no plant column) — document that.
  If bronze lacks MCH1: STOP after building everything you can without it behind guards,
  and add the ingestion request line — the view must degrade to em-dashes, not break.

## Design

1. **Gold** `gold_wm_expiry_risk` in `gold/wm_operations_gold.py`:
   - Sources: `silver.batch_stock` (MCHB quantities; verify stock-category column aliases
     in `silver/tables/`) × batch master (expiry) × `silver.material_valuation`
     (standard_price/price_unit — exactly the slow-movers join pattern; grep
     `gold_wm_slow_movers` and copy its valuation idiom).
   - Grain: plant_code × material_code × batch_number (stock rows with on-hand qty > 0).
   - Columns: quantities by stock category, `expiry_date`, `days_to_expiry` computed AT
     QUERY TIME in the view (wall-clock rule!) — gold carries `expiry_date`;
     `est_stock_value` (qty × price, null when no price), `vendor_batch_number`.
   - No time/plant gate beyond batch_stock's existing scope.
2. **FEFO violation signal** (v1, derivable without pick-sequence data): per
   plant × material, flag batches where a LATER-expiring batch has seen recent issue
   movements while an EARLIER-expiring batch with stock sits untouched. Source: recent
   `goods_movement` issues (261/601 family — verify movement codes used elsewhere before
   choosing) joined to the expiry data. Keep it a boolean `fefo_risk_flag` + supporting
   `earlier_expiring_batch` reference on the later batch's row. If this proves
   over-complex, ship v1 WITHOUT it and report — value-at-risk alone justifies the view.
3. **Consumption view** `vw_consumption_wm_operations_expiry_risk` with query-time
   `days_to_expiry` and `expiry_band` (EXPIRED / <30d / 30-90d / 90-180d / >180d / NO_DATE).
4. **Contract + adapter + frontend view** per the house pattern: KPI strip (value expired,
   value <30d, batch count at risk), table sorted by days_to_expiry with band chips and
   value column, plant filter via existing patterns, drill to Stock Explorer where a deep
   link pattern exists (read how other views link).

## Gotchas

- Expiry coverage will be partial (not all materials are batch-managed/expiry-tracked):
  `NO_DATE` band must be honest, never inflated into "at risk".
- Valuation join: `valuation_area` IS the plant code in `material_valuation` — copy the
  slow-movers join exactly.
- New gold table ⇒ security generator + ALL variants regen; dataset-name check.

## Acceptance

- Value-at-risk totals reconcile to qty × price spot checks (orchestrator does live checks).
- Bands computed at query time; no wall-clock in gold (determinism guard green).
- Graceful degradation path proven in tests for: no batch master, no price, no expiry date.
