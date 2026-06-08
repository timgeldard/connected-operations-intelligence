# ADR-0004 — Warehouse360 governed consumption views: grain decisions and missing-column strategy

**Status:** Proposed (pending Gold/data-product owner ratification) · **Date:** 2026-06-08
**Supersedes/extends:** the blocker set from PR #39 (DEV live validation) and PR #40 (naming reconciliation).

> This is a **design-decision record**. It changes **no runtime** — no Gold pipeline code, no consumption
> SQL, no source mode, no contract promotion, no NULL placeholders, and no fake columns. It records the
> recommended target Gold/contract changes so implementation can proceed in scoped follow-up PRs. It does
> **not** make Warehouse360 governed mode ready, prove UAT readiness, or switch the app source mode.

## Context

After PR #40, 1 of 7 governed consumption views creates in DEV (`overview`, with data-quality issues).
The remaining 6 fail because the consumption-view contract references columns the Gold layer does not
provide. PR #40's naming reconciliation resolved the pure renames; what remains splits into **missing
columns** (some available upstream, some needing a dimension join, some with no source) and **grain
mismatches** (the contract wants finer rows than the aggregated Gold MV produces). Evidence below is from
the live DEV `silver_io_reporting` / `gold_io_reporting` schemas (read-only, 2026-06-08).

## Blocker classes (see warehouse360-dev-live-validation-results.md for the full per-field table)

| Class | Meaning |
|---|---|
| `missing-but-available-upstream` | Column exists in the Silver source at the **same grain**; add it to the Gold MV select. |
| `missing-requires-dimension-join` | Column needs a join to a Silver dimension (`material`, `customer`). |
| `missing-no-source` | No replicated source; contract field should be optional or removed. |
| `contract-semantic-decision` | A mapping is plausible but needs an explicit accepted semantic. |
| `grain-redesign-required` | Contract grain is finer than the Gold MV; needs a new detail Gold model or a contract grain change. |
| `data-quality-issue` | View creates but the Gold source has integrity problems. |

## Decisions (recommended)

### D1 — `inbound_backlog`: build a PO-line-detail Gold model (grain-redesign)
The contract is PO-line grain (`po_id`, `po_item`, `material_id`, `ordered_qty`, …); both
`gold_inbound_po_backlog` and `_enhanced` are aggregated per plant×vendor×purchasing_org. **Build a new
detail-grain Gold model `gold_inbound_po_line_backlog`** from `silver.purchase_order` (EKKO/EKPO line
items, already replicated) and point the consumption view at it. Keep the aggregated MV for `overview`
KPIs. (Option A in the prompt; reject B "force aggregate onto a line contract".)

### D2 — `shortfalls`: build a material-grain transfer-requirement Gold model (grain-redesign)
Contract is per-material (`material_id`, `open_tr_qty`, `open_tr_items`, `oldest_tr_creation_date`);
`gold_transfer_requirement_backlog` is aggregated per warehouse×storage_type×queue×priority.
`silver.warehouse_transfer_requirement` carries `material_code`/`batch_number`/`reservation_number`, so a
**material-grain `gold_transfer_requirement_material_backlog` is buildable.** Build it; keep the existing
aggregate for queue/workload views. (Option A.)

### D3 — `staging_workload`: decide the grain, then add the dimensionable fields
The contract grain is **component-level** (`order_id + reservation_no + batch_id`) but
`gold_process_order_staging` is **order-grain**. This is a grain decision, not just missing columns:
- **Recommended:** reduce the contract to **order grain** for now (drop `reservation_no`/`batch_id` from
  the contract, or mark optional) — the staging *workload* KPI is naturally per order — and add the
  order-grain fields that ARE available: `uom ← process_order.order_quantity_uom`,
  `material_name ← join silver.material on plant_code + material_code` (material is plant-grain),
  `sap_order ← order_number` (confirm intent).
- Alternative: build a component-grain staging model from `silver.warehouse_transfer_requirement`
  (has reservation/batch/material) if the app genuinely needs component rows.

### D4 — `outbound_backlog`: decide customer semantics, add available columns, drop carrier
`silver.outbound_delivery` (same delivery grain) HAS `actual_goods_issue_date`, `delivery_date`,
and header `delivery_gross_weight` (LIKP `BTGEW`) → **add to `gold_delivery_pick_status`**
(`missing-but-available-upstream`). Item `gross_weight` (LIPS `BRGEW`) is item-grain; do not surface it
at delivery grain without an explicit aggregation rule. SD customer roles are explicit: the Warehouse360
app contract's `customer_id` remains **ship-to customer number** (`ship_to_customer`, LIKP `KUNNR`), while
Gold also carries `sold_to_customer` (LIKP `KUNAG`) separately. `customer_name` joins `silver.customer` on
ship-to; `sold_to_customer_name` joins the same dimension on sold-to. `carrier` → **no replicated source**
(LIKP has no carrier; it lives on shipment/VBPA, not replicated) → **mark the contract field optional or
remove it.**

### D5 — `stock_exceptions`: `storage_location_id` is the wrong axis — drop or re-grain
`gold_stock_expiry_risk` is built on WM `storage_bin` × material × batch; `storage_location_id` is an IM
(LGORT) concept. Adding it changes grain/semantics. **Recommended:** drop `storage_location_id` from the
stock-exceptions contract (expiry risk is naturally material×batch×WM). Alternative: build a
storage-location-grain expiry model from `silver.batch_stock` (MCHB has `storage_location`) if required.

### D6 — `im_wm_reconciliation`: reconciliation is plant×material — drop the finer keys
`gold_warehouse_exceptions` aggregates IM↔WM to plant×material; `storage_location_id`/`bin_id` are finer
than the reconciliation grain. **Recommended:** drop `storage_location_id`/`bin_id` from the im_wm
contract (the reconciliation compares IM vs WM totals per plant×material). Alternative: a separate
bin-level discrepancy model if bin-level reconciliation is a real requirement.

### D7 — `overview`: fix the data quality (null plant + dup)
Base `gold_warehouse_kpi_snapshot` (single snapshot date, 545 rows) has **2 rows with NULL `plant_code`**,
which produce the 1 duplicate `(plant_id, snapshot_ts)`. The snapshot is assembled with full outer joins
on `plant_code`; in Spark, NULL join keys do not match each other, so NULL-plant rows from different input
frames can survive as separate rows and then collapse to the same `(NULL, snapshot_ts)` contract key.
**Recommended:** filter `plant_code IS NOT NULL` from each snapshot input frame before the full outer join
(or, less preferably, in the final `gold_warehouse_kpi_snapshot` / consumption view) **and** investigate
why null-plant rows exist (likely a SHARED/unmapped bucket in the snapshot aggregation). Do not silently
hide them in the consumption view without agreeing it as contract behaviour.

## Consequences
- Implementation proceeds as **scoped follow-up PRs**, each tracing field → Silver source → join key →
  grain → contract (per the prompt's Phase 7), with a Gold rerun + DEV re-validation:
  1. `fix(gold): outbound + staging available-upstream columns + dimension joins` (D3 order-grain part, D4 adds/joins).
  2. `feat(gold): inbound PO-line-detail + material-grain shortfall models` (D1, D2).
  3. `fix(gold): overview null-plant filter` (D7).
  4. `docs(contracts): mark carrier / storage_location_id / bin_id optional-or-removed` (D4/D5/D6).
- **Implementation status (2026-06-08):**
  - Item 1 — **done (PR #43)**: outbound (ship-to/sold-to, dates, gross_weight) + staging (uom, material_name).
    DEV revalidation confirmed the frontier moved (1/7, outbound then blocked only on `carrier`).
  - **D3 `staging_workload` — done (PR B), reduced to ORDER grain**: the recommended option. First-wave
    contract is `plant_id + order_id`; `reservation_no`/`batch_id` (component grain) and `sap_order` (a
    semantic duplicate of `order_id`) are removed and deferred to a future `staging_components` contract.
    Removed across consumption SQL, manifest (v0.2.0), expectations, the consumption-column exceptions, the
    governed adapter SELECT, and the adapter-column guard. Not a breaking API change (Warehouse360StagingItem
    fields are optional; no `sap_order` field). DEV: `staging_workload` now creates — **created-empty**
    (gold_process_order_staging is 0 rows in this shakedown). **5/7 create.**
  - **D4 `carrier` — done (this PR, first-wave reduction)**: removed from the governed consumption SQL,
    contracts, the governed adapter SELECT, and the adapter-column guard. `carrier` is **not** in the
    generated app API contract, so no app-contract migration was needed. DEV revalidation: `outbound_backlog`
    now creates (**2/7** — overview + outbound; 2,162,748 rows, 0 null plant_id, 0 dup PK). Not a NULL
    placeholder; `carrier` stays a future-enrichment candidate (needs replicated shipment/VBPA).
  - **D5 `stock_exceptions` — done (re-grain PR)**: removed `storage_location_id` (IM/LGORT axis absent from
    the WM-bin×material×batch expiry-risk source). Grain → plant×material×batch×exception_type. Creates in DEV
    (empty — source has no rows yet). Contract bumped v0.1.0→0.2.0.
  - **D6 `im_wm_reconciliation` — done (re-grain PR), re-grained to a first-wave AGGREGATE exception summary**
    (owner directive): `GROUP BY plant×material×batch×exception_type` with measures `exception_count`, `qty`
    (SUM), `severity` (MAX), `max_age_days` (MAX), `oldest_/latest_detected_date` (MIN/MAX), representative
    `detail_text`. `storage_location_id`/`bin_id` removed. Chosen over field-dropping / `reference_id` because
    `gold_warehouse_exceptions` has no stable per-exception variance key (reference_id ~99% null; 474/139
    residual dups otherwise); the GROUP BY makes the PK unique by construction (DEV: 198,860 rows, 0 dup PK).
    Contract bumped v0.1.0→0.2.0. **Correction:** an earlier note framed this as a breaking app-contract
    migration because `storage_location_id` is required on `WarehouseReconciliationException` — but that model
    is **dead code bound to no route**; the live `/warehouse360/exceptions` route returns
    `Warehouse360ExceptionItem` (`storageLocation` optional, no `binId`), so **no Zod/`generated.py` edit and no
    API version bump were needed**. Detail-grain reconciliation remains a future contract, only if a stable
    upstream variance key is built. DEV revalidation after D5/D6: **4/7 create**.
  - **D7 `overview` — done (PR A)**: the only data-quality defect was 2 rows with NULL `plant_code` in
    `gold_warehouse_kpi_snapshot_secured` (the sole offending group `(NULL, snapshot_ts)` → the 1 duplicate
    PK; every real plant has exactly 1 row). Fixed by filtering `WHERE plant_code IS NOT NULL` in the
    `overview` consumption view (dev/uat/prod) — documented contract behaviour (overview is per *mapped*
    plant; a plant-less row cannot be RLS-scoped). DEV: 543 rows, 0 null plant_id, 0 dup PK. Done in the
    consumption view rather than upstream (no Gold rerun); revisit upstream if the null-plant source recurs.
  - **D1 `inbound_backlog` — done (PR C)**: built `gold_inbound_po_line_backlog` (PO-line grain from
    `silver.purchase_order` EKKO/EKPO + `silver.material` name join) with `_secured` + `_live` views;
    repointed the consumption view to it. First-wave **core fields** only — `gr_qty`/`open_qty` (need a
    PO-line GR aggregation), `delivery_date` (EKET), `qa_status` (QM), and `vendor_name` (vendor dim) are
    **deferred future enrichment**, removed from the contract (not null-filled). Contract v0.2.0. DEV
    pipeline run materialised the model; `inbound_backlog` creates with 1,112,080 rows, 0 dup PK. **6/7.**
- D2 introduces a new Gold table (D1 done above), so follow-up implementation PRs must obey the active hardening-sprint
  rule: do not add a new Gold table unless (1) its Silver dependency already exists, (2) its grain is
  documented in `data-products/io-reporting/gold/design_spec.md`, (3) unit tests are added, (4)
  `docs/data_contracts.md` is updated, and (5) freshness impact is assessed.
- Until then the affected views stay not-live-validated; the consumption-column guard keeps the blockers
  visible. Legacy `wh360` runtime is unchanged; the app stays on legacy mode.

## What was NOT decided here
App cutover, source-mode change, contract promotion, UAT, and the exact owning Gold module for each new
model (gold owner's call). Exposing sold-to to the app contract as a separate field requires explicit
business/API ratification; current `customer_id` remains ship-to.
