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

## Recommended repo fixes (for the Gold + contract owner — not applied here)

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
using `data-products/io-reporting/contracts/warehouse360_consumption_column_contract.yml` (captured Gold columns + approved aliases
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
machine-readable classes are in
`data-products/io-reporting/contracts/warehouse360_consumption_column_contract.yml`. Follow-up Gold
implementation has started for the order-/delivery-grain fields that are available upstream; grain
redesign items remain scoped separately.

| View | Blocker(s) | Class | Resolution (ADR-0004) |
|---|---|---|---|
| inbound_backlog | po_id … qa_status | grain-redesign | D1: build `gold_inbound_po_line_backlog` from `silver.purchase_order` |
| shortfalls | material_id, open_tr_* | grain-redesign | D2: build `gold_transfer_requirement_material_backlog` from `silver.warehouse_transfer_requirement` (has material_code) |
| staging_workload | reservation_no, batch_id | grain-redesign | D3: reduce contract to order grain (or build component grain) |
| staging_workload | uom | implemented | D3: `process_order.order_quantity_uom` |
| staging_workload | material_name | implemented | D3: join `silver.material` on plant×material |
| staging_workload | sap_order | semantic-decision | D3: likely `order_number` (confirm) |
| outbound_backlog | actual_goods_issue_date, delivery_date, gross_weight | implemented | D4: dates plus LIKP header `delivery_gross_weight` are present in `silver.outbound_delivery` |
| outbound_backlog | customer_name | implemented | D4: join `silver.customer` on ship-to |
| outbound_backlog | customer_id | implemented | D4: `customer_id` remains ship-to; sold-to is retained separately in Gold |
| outbound_backlog | carrier | no-source | D4: not replicated → contract optional/remove |
| stock_exceptions | storage_location_id | grain-redesign | D5: IM axis on a WM model → drop or re-grain |
| im_wm_reconciliation | storage_location_id, bin_id | grain-redesign | D6: finer than plant×material → drop or bin-level model |
| overview | null plant_id / dup PK | data-quality | D7: filter null `plant_code` + RCA |

**overview RCA (DEV, read-only):** base `gold_warehouse_kpi_snapshot` = 545 rows, **single** snapshot
date, **2 rows with NULL `plant_code`**, which alone produce the 1 duplicate `(plant_id, snapshot_ts)`
(NULL plants collapse on the composite key). Fix = filter `plant_code IS NOT NULL` + investigate the
null-plant source (likely a SHARED/unmapped bucket). `snapshot_ts` granularity is not the cause.

Net: most blockers are resolvable from replicated Silver, but via **Gold-model additions / new
detail-grain models + grain decisions** — design first (this ADR), implement in follow-up Gold PRs.

---

## Update 2026-06-08 — DEV revalidation after PR #43 Gold enrichment

> **This is DEV technical validation only. It does not prove UAT readiness, production readiness, app
> cutover readiness, or RLS/entitlement correctness.** The app remains on the legacy
> `connected_plant_uat.wh360` runtime; `WAREHOUSE360_SOURCE_MODE` was **not** changed; no GRANTs applied
> (the `GRANT … TO \`users\`` statements in each script were skipped — entitlement is a separate, gated
> step); no legacy `wh360` removal; no contract promotion; no UAT/PROD action.

**Question:** *After the PR #43 outbound/staging Gold enrichment, which Warehouse360 governed consumption
views now create in DEV, and which blockers remain?*
**Answer: still 1 of 7 create — but the blocker frontier moved exactly as ADR-0004 predicted.** PR #43's
available-upstream columns now resolve; the remaining failures are the genuinely no-source / finer-grain
columns, isolating the next decisions.

### Environment

| Field | Value |
|---|---|
| Date/time | 2026-06-08 (~10:35 UTC) |
| Workspace | DEV (`adb-3548637138127338.18.azuredatabricks.net`), profile `TG` |
| Catalog / schema | `connected_plant_dev` / `gold_io_reporting` |
| SQL warehouse | `8fae28f1808dbf75` (`connected_plant_dev`) |
| Gold pipeline | `[dev tim_geldard] [dev] Connected Plant — Gold` (`a84268e5-9cdd-48a2-8512-e1c3c73e5ba8`) |
| **Gold update (PR #43 code)** | **`b99f58d4-3369-48c4-bab6-a71f1381de98` — COMPLETED** (created 2026-06-08; replaces the pre-#43 `707a9eb5…` of 2026-06-07) |
| Repo state | `main` after #43 merged (`gold_delivery_pick_status` + `gold_process_order_staging` enriched); all 6 static checks green |

PR #43 Gold code was deployed to DEV (`databricks bundle deploy -t dev --profile TG`) and a fresh pipeline
update (`b99f58d4…`) was run to **COMPLETED** before the SQL sequence, so the consumption CREATEs read the
enriched MVs.

### SQL sequence run (CREATE/DESCRIBE/SELECT only; GRANTs skipped — not edited, just not sent)

| Step | Script | Result |
|---|---|---|
| 1 | `gold_security_dev.sql` | ✅ 32 `_secured` views recreated (pass-throughs; pick up new MV columns) |
| 2 | `gold_serving_views_dev.sql` | ✅ 5 `_live` views recreated (`b.*` → expose new MV columns) |
| 3 | `warehouse360_consumption_views_dev.sql` | ⚠️ 1 of 7 created (overview); 6 failed-create |
| 4 | `validation/generated/…_validation_dev.sql` | only `overview` exists to describe/query (metrics below) |

### Per-view classification

| View | Created? | Rows | Null plant_id | Dup PK | First unresolved column | Status |
|---|---|---:|---:|---:|---|---|
| `…_overview` | ✅ | 545 | 2 | 1 | — | **created-with-data-quality-issue** |
| `…_inbound_backlog` | ❌ | — | — | — | `po_id` | **failed-create** (grain) |
| `…_outbound_backlog` | ❌ | — | — | — | `carrier` | **failed-create** (no-source) |
| `…_staging_workload` | ❌ | — | — | — | `reservation_no` | **failed-create** (component grain + `sap_order` semantic) |
| `…_stock_exceptions` | ❌ | — | — | — | `storage_location_id` | **failed-create** (IM axis / grain) |
| `…_shortfalls` | ❌ | — | — | — | `material_id` | **failed-create** (grain) |
| `…_im_wm_reconciliation` | ❌ | — | — | — | `storage_location_id` | **failed-create** (finer grain) |

`overview` metrics (unchanged from PR #39 — PR #43 did not touch `gold_warehouse_kpi_snapshot`): 545 rows,
**2 NULL `plant_id`**, **1 duplicate `(plant_id, snapshot_ts)`**, 543 distinct plants (unscoped, pre-RLS,
expected), freshness `MAX(snapshot_ts) = 2026-06-08` (today, from the fresh Gold run). The D7 data-quality
issue persists.

### Blockers PR #43 resolved (frontier moved) — proven by DESCRIBE of the `_live` sources

| View | Now resolves (was a blocker pre-#43) | Verified via |
|---|---|---|
| outbound_backlog | `customer_id`, `customer_name`, `actual_goods_issue_date`, `delivery_date`, `gross_weight` (+ `gross_weight_unit`, ship-to/sold-to names) | `DESCRIBE gold_delivery_pick_status_live` — all present; **only `carrier` absent** |
| staging_workload | `uom`, `material_name` | `DESCRIBE gold_process_order_staging_live` — both present; `reservation_no`/`batch_id`/`sap_order` absent |

The CREATE error for `outbound_backlog` now names `carrier` (its `customer_id` etc. resolve), and for
`staging_workload` now names `reservation_no` (its `uom`/`material_name` resolve) — confirming the only
remaining outbound blocker is the no-source `carrier`, and staging's are the component-grain
`reservation_no`/`batch_id` plus the `sap_order` semantic.

### Blockers that remain (unchanged by PR #43)

- **inbound_backlog** — `po_id` (and the full PO-line set): `gold_inbound_po_backlog_enhanced` is still
  aggregated per plant×vendor×purchasing_org. **ADR-0004 D1**: build `gold_inbound_po_line_backlog`.
- **shortfalls** — `material_id`: `gold_transfer_requirement_backlog` is aggregated per
  warehouse×storage_type×queue×priority. **ADR-0004 D2**: build a material-grain TR backlog model.
- **outbound_backlog** — `carrier`: no replicated source (shipment/VBPA). **ADR-0004 D4**: mark optional / remove.
- **staging_workload** — `reservation_no`/`batch_id` (component grain) + `sap_order` (semantic).
  **ADR-0004 D3**: reduce to order grain (drop/optional) or build a component-grain model; resolve `sap_order` intent.
- **stock_exceptions** — `storage_location_id`: IM (LGORT) axis on a WM model. **ADR-0004 D5**: drop or re-grain.
- **im_wm_reconciliation** — `storage_location_id`/`bin_id`: finer than the plant×material reconciliation
  grain. **ADR-0004 D6**: drop or build a bin-level model.

### Contract YAML check

`data-products/io-reporting/contracts/warehouse360_consumption_column_contract.yml` was **verified against
this live evidence and left unchanged**: its `gold_source_columns` snapshot for
`gold_delivery_pick_status_live` / `gold_process_order_staging_live` matches the live `DESCRIBE` output
(the PR #43 columns are present), and its `approved_exceptions` (`carrier`; `reservation_no`/`batch_id`/
`sap_order`; `storage_location_id`/`bin_id`; the inbound/shortfall grain sets) match exactly the columns
the live CREATEs still cannot resolve. No blocker was added or removed by this run, so no YAML edit was
needed.

### Next recommended PR

**`docs(contracts): mark no-source / over-grain fields optional or remove from first-wave Warehouse360
contracts`** — the recommended branch of **ADR-0004 D4/D5/D6**: drop `carrier` (outbound),
`storage_location_id` (stock_exceptions), and `storage_location_id`/`bin_id` (im_wm_reconciliation) from
the consumption SQL + contract. Combined with the now-deployed PR #43 Gold, this is expected to take DEV
from **1/7 → ~4/7** (overview + outbound_backlog + stock_exceptions + im_wm_reconciliation create), with
no new Gold modelling. (Dropping `storage_location_id`/`bin_id` forecloses the finer-grain-model
alternative ADR-0004 left open under D5/D6 — present it as the recommended branch, not the only option.)
The larger remaining wave is **D1/D2** (new detail-grain Gold models for inbound_backlog + shortfalls) and
**D3** (staging `sap_order` semantic + component-grain decision); **D7** (overview null-plant filter)
remains a separate focused fix.

---

## Update 2026-06-08 (later) — first-wave `carrier` reduction (ADR-0004 D4) → 2/7

> **This is DEV technical validation only. It does not prove UAT readiness, production readiness, app
> cutover readiness, or RLS/entitlement correctness.** No Gold rerun was needed (this is a consumption-SQL
> reduction, not a Gold change); no source-mode change; no GRANTs; no UAT/PROD; no legacy `wh360` removal;
> no contract promotion.

**Scope note — why only `carrier`, not the full D4/D5/D6 set.** The prior "next PR" recommendation above
was to drop `carrier` + `storage_location_id` + `bin_id` together. On contact with the repo, only `carrier`
is removable as a first-wave reduction without an app-contract migration: `carrier` is **absent from the
generated app API contract** (`apps/api/contracts/generated.py`), so removing it breaks no response model.
By contrast `storage_location_id` is a **required** field on the `WarehouseReconciliationException` API
model (generated from `packages/data-contracts`), so dropping `storage_location_id`/`bin_id` is a breaking
app-contract change requiring a schema-source edit + regeneration + version bump + the app-migration
registry — out of scope here, deferred to a dedicated app-contract migration PR (D5/D6).

**Change made:** removed `carrier` from the governed first-wave outbound contract, consistently across:
`warehouse360_consumption_views_{dev,uat,prod}.sql`; `app_contract_manifest.yml` /
`warehouse360_view_expectations.yml` / `warehouse360_consumption_column_contract.yml` (the `carrier`
approved-exception removed → outbound now has an empty exception list); the **governed** SELECT branch of
`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` (the legacy `wh360_deliveries_v` branch
keeps `carrier` — legacy untouched); and the `ACTIVE_ROUTE_COLUMNS` set in
`scripts/ci/check_warehouse360_adapter_contract_columns.py`. **No `NULL AS carrier` placeholder.** `carrier`
remains a future-enrichment candidate (needs a replicated shipment/VBPA source).

**DEV re-validation (2026-06-08, profile TG, warehouse `8fae28f1808dbf75`, no Gold rerun):** re-ran
`warehouse360_consumption_views_dev.sql`. Result **2 of 7 create**:

| View | Created? | Rows | Null plant_id | Dup PK | First unresolved column | Status |
|---|---|---:|---:|---:|---|---|
| `…_overview` | ✅ | 545 | 2 | 1 | — | created-with-data-quality-issue |
| `…_outbound_backlog` | ✅ | 2,162,748 | 0 | 0 | — | **created** (clean PK; carrier removed) |
| `…_inbound_backlog` | ❌ | — | — | — | `po_id` | failed-create (D1 grain) |
| `…_staging_workload` | ❌ | — | — | — | `reservation_no` | failed-create (D3) |
| `…_stock_exceptions` | ❌ | — | — | — | `storage_location_id` | failed-create (D5) |
| `…_shortfalls` | ❌ | — | — | — | `material_id` | failed-create (D2 grain) |
| `…_im_wm_reconciliation` | ❌ | — | — | — | `storage_location_id` | failed-create (D6) |

`outbound_backlog` now creates and queries: **2,162,748 rows, 0 NULL `plant_id`, 0 duplicate
`(plant_id, delivery_id)`, 451 distinct plants** (unscoped, pre-RLS — expected in DEV). `DESCRIBE` confirms
`carrier` is no longer a column. PK uniqueness and plant-nullability look clean at this grain, but
type-compatibility and **RLS/entitlement remain unproven** — this is create+shape evidence, not full
live-validation.

**Remaining blockers (unchanged):** inbound_backlog (D1), shortfalls (D2), staging_workload (D3),
stock_exceptions (D5), im_wm_reconciliation (D6), overview data-quality (D7).

**Next recommended PR:** the `storage_location_id`/`bin_id` removal (D5/D6) as a **scoped app-contract
migration** (schema source + regen + version bump + registry), or a self-contained data-product step —
**D7** overview null-plant data-quality fix (gold-side, no app coupling), or **D1/D2** detail-grain Gold
models. Not UAT, not app cutover.

---

## Update 2026-06-08 (later) — D5/D6: stock_exceptions field-drop + im_wm aggregate re-grain → 4/7

> **DEV technical validation only.** Does not prove UAT/production/app-cutover readiness or RLS/entitlement.
> No Gold rerun (consumption-SQL changes only); no source-mode change; no GRANTs; no UAT/PROD; no legacy
> `wh360` removal; no contract promotion.

**Scope correction vs the earlier "breaking app-contract migration" note above.** Investigation showed the
live `/warehouse360/exceptions` route returns `Warehouse360ExceptionItem` (whose `storageLocation` is
**optional** and which has **no `binId`**); the required-`storageLocationId` model
`WarehouseReconciliationException` is **dead code bound to no route**. So D5/D6 needed **no Zod/`generated.py`
edit and no API version bump** — same shape as the D4 carrier change (manifest + expectations +
consumption SQL + adapter governed branch + adapter-column guard + regenerated `src/generated` +
regenerated validation SQL). The earlier "required API field → breaking migration" framing was based on the
unused model and is retracted.

**D5 — `stock_exceptions`:** removed `storage_location_id` (IM/LGORT axis absent from the WM-bin×material×
batch expiry-risk source). Grain → plant×material×batch×exception_type. Field-drop only.

**D6 — `im_wm_reconciliation`: re-grained to a first-wave AGGREGATE exception summary** (per owner
directive — *not* a uniqueness hack via field-dropping/`reference_id`). `gold_warehouse_exceptions` has no
stable per-exception variance key (storage_location_id/bin_id absent; `reference_id` ~99% null; 474 dups at
plant×material×exception_type, 139 with batch), so the view now `GROUP BY plant×material×batch×exception_type`
with measures: `exception_count`, `qty` (SUM), `severity` (MAX), `max_age_days` (MAX), `oldest_/latest_detected_date`
(MIN/MAX), `detail_text` (representative). `storage_location_id`/`bin_id` removed. The GROUP BY makes the PK
unique by construction. Detail-grain reconciliation is deferred to a future contract, only if a stable
variance key is built upstream.

**DEV re-validation (2026-06-08, profile TG, warehouse `8fae28f1808dbf75`, no Gold rerun): 4 of 7 create.**

| View | Created? | Rows | Null plant_id | Dup PK | Status |
|---|---|---:|---:|---:|---|
| `…_overview` | ✅ | 545 | 2 | 1 | created-with-data-quality-issue |
| `…_outbound_backlog` | ✅ | 2,162,748 | 0 | 0 | created (D4) |
| `…_stock_exceptions` | ✅ | 0 | — | — | **created-empty** (source has no expiry-risk rows in DEV) |
| `…_im_wm_reconciliation` | ✅ | 198,860 | 0 | **0** | **created** (aggregate; PK unique by construction) |
| `…_inbound_backlog` | ❌ | — | — | — | failed-create — `po_id` (D1 grain) |
| `…_staging_workload` | ❌ | — | — | — | failed-create — `reservation_no` (D3) |
| `…_shortfalls` | ❌ | — | — | — | failed-create — `material_id` (D2 grain) |

`im_wm` aggregate: 198,860 rows, **0 duplicate `(plant_id, material_id, batch_id, exception_type)`**, 0 null
plant/material/exception_type, `exception_count` up to 27, `qty` summed, `severity`=max. Two source
exception types collapse cleanly (`IM_WM_TRUE_VARIANCE`, `NEGATIVE_WM_QUANT`). `stock_exceptions` creates but
is empty (DEV has no expiry-risk source rows) — shape-valid, not data-validated. RLS/entitlement still unproven.

**Remaining blockers:** inbound_backlog (D1), shortfalls (D2), staging_workload (D3 — `reservation_no`/
`batch_id` component grain + `sap_order` semantic), overview data-quality (D7).

**Next recommended PR:** **D7** overview null-plant fix (gold-side, no app coupling) or **D1/D2** detail-grain
Gold models (`gold_inbound_po_line_backlog`, `gold_transfer_requirement_material_backlog`). Not UAT, not app cutover.

---

## Update 2026-06-08 (later) — PR A: overview null-plant / duplicate PK fixed (ADR-0004 D7)

> DEV technical validation only. No Gold rerun (consumption-SQL filter only); no source-mode change; no
> GRANTs; no UAT/PROD; no app cutover.

Root cause (DEV, read-only): `gold_warehouse_kpi_snapshot_secured` = 545 rows, single snapshot date, 543
distinct plants, and **exactly 2 rows with NULL `plant_code`** — the *only* offending group is
`(NULL, 2026-06-08)` with 2 rows; every real plant has exactly 1 row. Those 2 null-plant rows alone
produce the 1 duplicate `(plant_id, snapshot_ts)` PK.

Fix: added `WHERE plant_code IS NOT NULL` to the `overview` consumption view (dev/uat/prod). A plant-less
KPI-snapshot row cannot be plant-scoped/RLS'd and breaks the plant-grain PK, so excluding it is documented
contract behaviour (overview is per *mapped* plant). No NULL placeholders; no Gold change.

DEV re-validation: `overview` now **543 rows, 0 NULL `plant_id`, 0 duplicate PK** — contract-valid shape.
Still **4/7 create** (overview now valid-shape). Remaining: staging_workload (D3), inbound_backlog (D1),
shortfalls (D2).

---

## Update 2026-06-08 (later) — PR B: staging_workload reduced to order grain (ADR-0004 D3) → 5/7

> DEV technical validation only. No Gold rerun (consumption-SQL + contract reduction); no source-mode
> change; no GRANTs; no UAT/PROD; no app cutover.

`staging_workload` failed to create on the component-grain / semantic fields `reservation_no`, `batch_id`,
`sap_order` — `gold_process_order_staging` is **order-grain**. Per D3, the first-wave contract is reduced
to **order grain** (`plant_id + order_id`): the three fields are removed (component detail deferred to a
future `staging_components` contract; `sap_order` was a semantic duplicate of `order_id`). Removed across
consumption SQL (dev/uat/prod) + manifest (v0.1.0→0.2.0) + view_expectations + consumption_column_contract
(exceptions cleared → live-validatable) + the **governed** adapter SELECT + adapter-column guard. Not a
breaking API change (the `Warehouse360StagingItem` response model fields are optional; it has no `sap_order`).

DEV re-validation: `staging_workload` now **creates** — **created-empty** (gold_process_order_staging is 0
rows in this DEV shakedown; 0 null plant/order, 0 dup PK at the order grain). **4/7 → 5/7 create**
(overview, outbound, stock_exceptions[empty], im_wm[aggregate], staging[empty]). Remaining: inbound_backlog
(D1 — new PO-line Gold model), shortfalls (D2 — new material-grain Gold model).

---

## Update 2026-06-08 (later) — PR C: gold_inbound_po_line_backlog built (ADR-0004 D1) → 6/7

> DEV technical validation only. New Gold model materialised via a DEV Gold-pipeline run; no source-mode
> change; no GRANTs; no UAT/PROD; no app cutover.

Built a new PO-line-grain Gold model **`gold_inbound_po_line_backlog`** (one row per plant × PO × item,
items not delivery-complete and not deleted) from `silver.purchase_order` (EKKO/EKPO, 6.6M rows) + a
`silver.material` name join, with a `_secured` view (generator) and a `_live` view adding per-line
`oldest_po_age_days`/`inbound_backlog_risk_band`. `inbound_backlog` consumption view repointed to it with
**CORE fields only**; `gr_qty`/`open_qty` (need a GR aggregation), `delivery_date` (EKET), `qa_status`,
and `vendor_name` are **deferred future enrichment** (removed from the contract, not null-filled) — per
the "core now" decision. Contract bumped v0.1.0→0.2.0. (First DEV pipeline attempt failed on a `cluster_by`
referencing the pre-alias `vendor_code`; fixed to `vendor_id` and re-ran to COMPLETED.)

DEV re-validation: `inbound_backlog` now **creates** — **1,112,080 rows, 0 NULL plant/po/item, 0 duplicate
`(plant_id, po_id, po_item)` PK**. **5/7 → 6/7 create.** Remaining: shortfalls (D2 — new material-grain
Gold model, PR D).
