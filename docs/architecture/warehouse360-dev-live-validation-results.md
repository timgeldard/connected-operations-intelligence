# Warehouse360 — DEV Live Validation Results

**Question answered:** *Can the Warehouse360 governed consumption views be created and queried in DEV?*
**Answer: NO (1 of 7).** Only `vw_consumption_warehouse360_overview` creates (with data-quality
caveats); the other 6 fail to create because the consumption-view SQL is systematically out of sync
with the actual Gold layer (column naming + missing columns + grain).

> **This is DEV technical validation only.** It does **not** prove UAT readiness, production readiness,
> or app cutover readiness, and does **not** prove entitlement/RLS (no representative identities were
> tested — DEV `_secured` views are pass-throughs by design). The app remains on the legacy
> `connected_plant_uat.wh360` runtime; `WAREHOUSE360_SOURCE_MODE` was **not** changed.

## Environment

| Field | Value |
|---|---|
| Date/time | 2026-06-08 |
| Workspace | DEV (`adb-3548637138127338.18.azuredatabricks.net`), profile `TG` |
| Catalog / schema | `connected_plant_dev` / `gold_io_reporting` |
| SQL warehouse | `8fae28f1808dbf75` |
| Gold pipeline | `[dev tim_geldard] [dev] Connected Plant — Gold` (`a84268e5-9cdd-48a2-8512-e1c3c73e5ba8`) |
| Latest Gold update | `707a9eb5-d72c-422f-b596-b3d6dd723472` — **COMPLETED** (created 2026-06-07T19:14:51Z) |
| Repo state | `main` after #34/#35/#36/#37 merged; all 5 static checks green; consumption SQL aliases `plant_code AS plant_id` |

## Phase 3 — SQL sequence (CREATE OR REPLACE VIEW; GRANTs deferred — see note)

| Step | Script | Result |
|---|---|---|
| 1 | `gold_security_dev.sql` | ✅ COMPLETED — 32 `_secured` views (pure pass-throughs) |
| 2 | `gold_serving_views_dev.sql` | ✅ COMPLETED — 5 `_live` views |
| 3 | `warehouse360_consumption_views_dev.sql` | ⚠️ 1 of 7 created (overview); 6 failed-create |

> **GRANTs not applied:** the scripts' `GRANT SELECT … TO \`users\`` statements were skipped — they are
> the entitlement step (separate, gated) and are not needed to create or query the views as owner, which
> is what this validation tests. Creating the views is the question; granting is downstream.

## Phase 5 — Per-view classification

| View | Created? | Rows | Null plant_id | Dup PK | Status | First missing column |
|---|---|---:|---:|---:|---|---|
| `…_overview` | ✅ | 545 | 2 | 1 | **created-with-data-quality-issue** | — |
| `…_inbound_backlog` | ❌ | — | — | — | **failed-create** | `po_id` |
| `…_outbound_backlog` | ❌ | — | — | — | **failed-create** | `delivery_id` |
| `…_staging_workload` | ❌ | — | — | — | **failed-create** | `order_id` |
| `…_stock_exceptions` | ❌ | — | — | — | **failed-create** | `material_id` |
| `…_shortfalls` | ❌ | — | — | — | **failed-create** | `material_id` |
| `…_im_wm_reconciliation` | ❌ | — | — | — | **failed-create** | `material_id` |

`overview` data-quality issues: **543 distinct plants** (unscoped — the legacy `wh360_kpi_snapshot_v`
was a single global row; the governed view is per-plant but unfiltered, expected pre-RLS), **2 rows with
NULL `plant_id`**, and **1 duplicate** `(plant_id, snapshot_ts)` PK. These need resolving before the
overview contract can be called valid even technically.

(The generated read-only validation SQL `validation/generated/warehouse360_contract_validation_dev.sql`
can only execute against `overview` today; the other 6 views do not exist to describe/query.)

## Phase 6 — Blockers (narrow root cause per view; do NOT hotfix Databricks)

Root cause is shared: **the Warehouse360 consumption-view SQL targets a contract schema the current Gold
layer does not produce.** Three distinct failure classes:

| View | Source Gold MV | Failure class | Detail |
|---|---|---|---|
| inbound_backlog | `gold_inbound_po_backlog_enhanced` | **GRAIN** | MV is aggregated per plant×vendor×purchasing_org (`open_po_count`, `open_item_count`, `total_ordered_qty`, `vendor_code`). Contract wants PO-line detail (`po_id`, `po_item`, `vendor_id`, `material_id`, …) — not present at any grain. |
| shortfalls | `gold_transfer_requirement_backlog` | **GRAIN** | MV aggregated per plant×warehouse×storage_type×queue×priority (`backlog_item_count`, `open_qty`). Contract wants per-material (`material_id`, `open_tr_qty`) — no `material_id`. |
| outbound_backlog | `gold_delivery_pick_status` | **NAMING + MISSING** | `delivery_number`≠`delivery_id`; currently carries `sold_to_customer` only. Missing contract-facing ship-to `customer_id`, `customer_name`, `carrier`, `actual_goods_issue_date`, delivery-grain `gross_weight`. |
| staging_workload | `gold_process_order_staging` | **NAMING + MISSING** | `order_number`≠`order_id`, `material_code`≠`material_id`, `order_quantity`≠`order_qty`. Missing `material_name`, `reservation_no`, `batch_id`, `sap_order`. |
| stock_exceptions | `gold_stock_expiry_risk` (live) | **NAMING + MISSING** | `material_code`≠`material_id`, `batch_number`≠`batch_id`. Missing `storage_location_id`. |
| im_wm_reconciliation | `gold_warehouse_exceptions` | **NAMING + MISSING** | `material_code`≠`material_id`, `batch_number`≠`batch_id`, `quantity`≠`qty`, `detail`≠`detail_text`. Missing `storage_location_id`, `bin_id`. |

Note this is the **same class of defect** the `plant_code → plant_id` rename (#34) fixed — but only
`plant` was reconciled; `material`/`batch`/`delivery`/`order`/`quantity`/`detail` were not, and several
contract columns have **no Gold source at all** (genuinely missing, not renamable), and two views need a
**finer Gold grain** than exists.

## Recommended repo fixes (for the Gold + contract owner)

1. **Naming reconciliation** (mechanical, like #34): in `warehouse360_consumption_views_dev.sql` (+uat/prod),
   alias `material_code AS material_id`, `batch_number AS batch_id`, `delivery_number AS delivery_id`,
   `order_number AS order_id`, `order_quantity AS order_qty`, `quantity AS qty`, `detail AS detail_text`.
   Do not map `sold_to_customer AS customer_id` unless the app contract changes: current contract says
   `customer_id` is ship-to. Add a CI guard that every consumption-view
   column resolves against its Gold source (extend `check_warehouse360_migration_static.py`).
2. **Missing columns** (design): decide per column whether the Gold MV must add it (e.g.
   `customer_name`, `carrier`, `gross_weight`, `storage_location_id`, `bin_id`, `reservation_no`,
   `batch_id`, `sap_order`, `material_name`) or whether the contract field is dropped/optional. Most
   require Gold-pipeline changes (`warehouse_*_gold.py`), not just view edits.
3. **Grain mismatch** (design, highest effort): `inbound_backlog` and `shortfalls` contracts assume
   detail rows the aggregated `gold_inbound_po_backlog_enhanced` / `gold_transfer_requirement_backlog`
   MVs do not carry. Either point the consumption views at a detail-grain Gold table (build one) or
   revise the contract grain to match the aggregates. There IS a `gold_inbound_po_backlog` (non-enhanced)
   — confirm whether it carries line detail before assuming a new table is needed.
4. **`overview` data quality**: resolve the 2 NULL `plant_id` rows and the 1 duplicate
   `(plant_id, snapshot_ts)` in `gold_warehouse_kpi_snapshot` before the overview contract is valid.

All of the above are **repo PRs + a Gold rerun**, not manual Databricks edits.

## What was NOT done
- No app source-mode change (`WAREHOUSE360_SOURCE_MODE` untouched; app stays legacy).
- No legacy `wh360` removal; no contract promotion; no UAT/PROD action.
- No GRANTs applied; no RLS/entitlement tested.
- No manual Databricks object edits beyond running the repo's own (unedited) CREATE-view SQL.

## Next recommended PR
`fix(warehouse360): resolve DEV consumption-view-vs-gold contract mismatch` — start with the mechanical
naming reconciliation (#1) + the static guard, then triage the missing-column/grain items (#2, #3) with
the Gold owner. DEV remains a technical shakedown; UAT validation only after DEV creates + queries all 7.

---

## Update 2026-06-08 — naming reconciliation applied + CI guard (recommendation #1)

Implemented the **safe mechanical naming reconciliation** in
`warehouse360_consumption_views_{dev,uat,prod}.sql` — only where the Gold source column clearly maps to
the contract-facing field, scoped per view (no NULL placeholders, grain views untouched):

| Gold column | Contract field | Views aliased |
|---|---|---|
| `delivery_number` | `delivery_id` | outbound |
| `order_number` | `order_id` | staging |
| `order_quantity` | `order_qty` | staging |
| `material_code` | `material_id` | staging, stock_exceptions, im_wm |
| `batch_number` | `batch_id` | stock_exceptions, im_wm |
| `quantity` | `qty` | im_wm |
| `detail` | `detail_text` | im_wm |

**`sold_to_customer → customer_id` was NOT applied** — the manifest defines `customer_id` as ship-to
customer number. Left as a documented blocker until Gold carries `ship_to_customer` and the consumption
view maps ship-to to `customer_id` (with sold-to retained separately in Gold).

**Re-validation (DEV, 2026-06-08):** still **1/7 create** — but every previously-blocking *name* column
now resolves; the failures moved to the genuinely missing / grain columns, confirming the naming layer
is correct and isolating the remaining blockers:

| View | First unresolved column now | Class |
|---|---|---|
| overview | — (creates) | — |
| inbound_backlog | `po_id` | **grain** (unedited) |
| outbound_backlog | `customer_id` | missing |
| staging_workload | `uom` | missing |
| stock_exceptions | `storage_location_id` | missing |
| shortfalls | `material_id` | **grain** (unedited) |
| im_wm_reconciliation | `storage_location_id` | missing |

**New CI guard:** `scripts/ci/check_warehouse360_consumption_columns.py` (+ tests) statically verifies
every source column each consumption view SELECTs resolves against the Gold serving view it reads FROM,
using `contracts/warehouse360_consumption_column_contract.yml` (captured Gold columns + approved aliases
+ documented exceptions). A view is **not live-validated** until its exception list is empty; the guard
prints the outstanding blockers on every run.

**Grain views — detail-source check (recommendation #3):** confirmed there is **no detail-grain Gold
source** for either: `gold_inbound_po_backlog` (non-enhanced) is also aggregated (`open_po_count`, no
`po_id`), and `gold_transfer_requirement_backlog` has no per-material grain. Both
`inbound_backlog` and `shortfalls` require a **Gold model and/or contract grain redesign** — out of
scope for this naming PR.

**Still NOT done:** missing columns not manufactured (no NULLs); grain not solved; no GRANTs; no
source-mode change; no UAT/PROD; no app cutover. DEV technical only.

---

## Update 2026-06-08 — missing-column & grain analysis (design decisions in ADR-0004)

Classified every remaining blocker against the live Silver/Gold schemas (read-only). Decisions and the
per-field rationale are in `docs/decisions/ADR-0004-warehouse360-backlog-grain-and-missing-columns.md`;
machine-readable classes are in `contracts/warehouse360_consumption_column_contract.yml`. This update also
implements the same-grain D3/D4 Gold fields (staging UoM/material name; outbound ship-to/sold-to,
delivery dates, and header gross weight). New detail-grain Gold models still follow as scoped Gold PRs.

| View | Blocker(s) | Class | Resolution (ADR-0004) |
|---|---|---|---|
| inbound_backlog | po_id … qa_status | grain-redesign | D1: build `gold_inbound_po_line_backlog` from `silver.purchase_order` |
| shortfalls | material_id, open_tr_* | grain-redesign | D2: build `gold_transfer_requirement_material_backlog` from `silver.warehouse_transfer_requirement` (has material_code) |
| staging_workload | reservation_no, batch_id | grain-redesign | D3: reduce contract to order grain (or build component grain) |
| staging_workload | uom | available-upstream | D3: `process_order.order_quantity_uom` |
| staging_workload | material_name | dimension-join | D3: join `silver.material` on plant×material |
| staging_workload | sap_order | semantic-decision | D3: likely `order_number` (confirm) |
| outbound_backlog | actual_goods_issue_date, delivery_date, gross_weight | available-upstream | D4: dates plus LIKP header `delivery_gross_weight` are present in `silver.outbound_delivery` |
| outbound_backlog | customer_name | dimension-join | D4: current contract name follows ship-to; join `silver.customer` on `ship_to_customer` |
| outbound_backlog | customer_id | available-upstream | D4: map `ship_to_customer` to contract `customer_id`; carry `sold_to_customer` separately in Gold |
| outbound_backlog | carrier | no-source | D4: not replicated → contract optional/remove |
| stock_exceptions | storage_location_id | grain-redesign | D5: IM axis on a WM model → drop or re-grain |
| im_wm_reconciliation | storage_location_id, bin_id | grain-redesign | D6: finer than plant×material → drop or bin-level model |
| overview | null plant_id / dup PK | data-quality | D7: filter null `plant_code` + RCA |

**overview RCA (DEV, read-only):** base `gold_warehouse_kpi_snapshot` = 545 rows, **single** snapshot
date, **2 rows with NULL `plant_code`**, which alone produce the 1 duplicate `(plant_id, snapshot_ts)`
(NULL plants collapse on the composite key). Fix = filter `plant_code IS NOT NULL` + investigate the
null-plant source (likely a SHARED/unmapped bucket). `snapshot_ts` granularity is not the cause.

Net: most blockers are resolvable from replicated Silver. Same-grain D3/D4 fields are implemented here;
the remaining blockers require **new detail-grain models + contract optional/remove decisions** in
follow-up Gold/contract PRs.
