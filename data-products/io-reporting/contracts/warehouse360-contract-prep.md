# Warehouse360 Contract Prep (Hardening Plan Task 3 / Wave 1)

> **Status:** Prep / **authoring on HOLD** — see the Decision below. No manifest contracts authored.
> **Verified live against `connected_plant_uat` on 2026-06-06** (profile `uat`,
> warehouse `e76480b94bea6ed5`) via `information_schema` + row-count probes.

## Purpose

Task 3 asks us to expand `app_contract_manifest.yml` with the Wave-1 Warehouse360 contracts. While
gathering live schemas, blockers surfaced that make blind authoring unsafe. This document records
the verified evidence and the decision on which serving layer the contracts must target.

---

## Decision (2026-06-06): contracts target the `gold_io_reporting` governed layer

The Warehouse360 app currently queries **legacy** `connected_plant_uat.wh360.*` views (from the
connectio-rad-v2 import). These are **not** the contract target. Confirmed direction: **migrate to
the io-reporting governed gold layer** and repoint the app onto it. Contracts must declare those
views — **not** the legacy `wh360.*` views (which also carry data-quality issues; see §2).

**This is a HOLD, not a go.** Three findings block authoring right now:

1. **The governed layer is not deployed to UAT.** Live metastore shows only schemas `gold`,
   `gold_test`, `wh360`. The target schema **`gold_io_reporting` does not exist** in UAT
   (0 objects), so the governed views' real schema/grain cannot yet be verified.
2. **The app is not repointed.** `warehouse360_databricks_adapter.py` + `app.yaml` resolve
   `WH360_CATALOG=connected_plant_uat` / schema `wh360` — i.e. legacy. No code references
   `gold_io_reporting`.
3. **Three-way naming gap, none aligned:**
   - legacy `connected_plant_uat.wh360.*` (what the app uses today),
   - governed `connected_plant_uat.gold_io_reporting.gold_*_live` (defined in
     `resources/sql/gold_serving_views_*.sql`, **undeployed**, RLS via `_secured` per ADR 012),
   - contract convention `vw_consumption_*` (required by `validate_contracts.py:132` but **never
     created anywhere** in the repo).
   The contract `source_view` naming must be reconciled with the actual governed view names before
   authoring (e.g. is `gold_*_live` renamed/wrapped to `vw_consumption_*`, or is the validator
   rule updated?).

### Governed target views (grain per `gold/design_spec.md`) — to be live-verified once deployed

| Wave-1 contract | Governed serving view (`gold_io_reporting`) | Documented grain |
|---|---|---|
| `warehouse360.outbound_backlog` | `gold_delivery_pick_status_live` | 1 row per delivery (verify) |
| `warehouse360.staging_workload` | `gold_process_order_staging_live` | per order / order×operation (verify) |
| `warehouse360.inbound_backlog` | `gold_inbound_po_backlog_enhanced_live` | per PO line (verify) |
| `warehouse360.stock_exceptions` | `gold_stock_expiry_risk_live` | 1 row per plant × material × batch × base UOM |
| `warehouse360.shortfalls` | `gold_transfer_requirement_backlog` | 1 row per warehouse × plant × src/dst storage type × queue × priority |
| `warehouse360.overview` | (KPI rollup MV — TBD) | TBD |

These grains are **documented**, not yet live-verified (schema undeployed). They are cleaner than
the legacy `wh360` views — they have real keys — so the §2 "no unique key" problem is expected to
resolve naturally once we profile the governed layer.

### Next steps (in order)

1. Deploy the io-reporting bundle's `gold_io_reporting` layer (incl. `_secured` + `_live` serving
   views) to UAT.
2. Reconcile contract `source_view` naming (`gold_*_live` vs `vw_consumption_*`).
3. Profile the governed views' live schema + grain (same method as §5, against `gold_io_reporting`).
4. Repoint the Warehouse360 app off `wh360.*` onto the governed views.
5. Author the Wave-1 contracts in one pass.

> Everything below documents the **legacy `wh360.*` layer** (being superseded). It is retained as
> reference — the verified column payloads in §5 are *not* the contract source of truth; the
> governed `gold_io_reporting` views are.

---

## 1. Live view inventory — `connected_plant_uat.wh360` (15 views)

The schema holds **15 views**, not the 5 the API currently queries. The unqueried views are
candidate sources for the Wave-1 contracts that have no route yet.

| View | Route-wired today? | Candidate Wave-1 contract |
|---|---|---|
| `wh360_kpi_snapshot_v` | ✅ `/api/warehouse360/overview` | `warehouse360.overview` (exists) |
| `wh360_inbound_v` | ✅ `/api/warehouse360/inbound` | `warehouse360.inbound_backlog` |
| `wh360_deliveries_v` | ✅ `/api/warehouse360/outbound` | `warehouse360.outbound_backlog` |
| `wh360_process_orders_v` | ✅ `/api/warehouse360/staging` | `warehouse360.staging_workload` |
| `imwm_exceptions_v` | ✅ `/api/warehouse360/exceptions` | `warehouse360.im_wm_reconciliation` |
| `imwm_stock_comparison_v` | ❌ | `warehouse360.stock_exceptions` (candidate) |
| `wh360_dispensary_tasks_v` | ❌ | `warehouse360.dispensary_queue` (candidate) |
| `wh360_transfer_requirements_v` | ❌ | `warehouse360.shortfalls` (candidate) |
| `imwm_analytics_aging_v`, `imwm_movements_v`, `wh360_bin_stock_v`, `wh360_handling_units_v`, `wh360_lineside_stock_v`, `wh360_near_expiry_batches_v`, `wh360_transfer_orders_v` | ❌ | (no Wave-1 mapping yet) |

> Wave-1 names `stock_exceptions`, `dispensary_queue`, `shortfalls` are **not** unsourced — they have
> plausible backing views above, but mapping them is an owner decision (none are route-wired, so the
> intended shape is unconfirmed).

---

## 2. BLOCKER — no obvious primary key is unique in live data

The contract schema requires a non-empty `primary_key`, and `validate_contracts.py` rejects empty
keys. But the natural key candidates are **not unique** in live UAT data:

| View | Live rows | Candidate key | Distinct | Unique? |
|---|---:|---|---:|:---:|
| `wh360_deliveries_v` | 3 | `delivery_id` | 2 | ❌ |
| `wh360_process_orders_v` | 23 | `order_id` | 5 | ❌ |
| `wh360_process_orders_v` | 23 | `sap_order` | 5 | ❌ |
| `wh360_inbound_v` | 18,834 | `po_id` + `po_item` | 18,637 | ❌ (197 dupes) |

**Consequence:** none of the three "obviously keyable" views can be given a verified `primary_key`
without an owner defining the intended **grain**. `wh360_process_orders_v` is clearly finer than one
row per order (cols `reservation_no`, `batch_id` suggest order-component grain); `wh360_inbound_v`
is near-unique on `po_id+po_item` but has 197 duplicate pairs (a third key column or a data-quality
issue). Inventing a key here is exactly the fabrication the plan forbids.

`wh360_kpi_snapshot_v` (single global row) and `imwm_exceptions_v` (no surrogate id) have **no row
key at all** — grain + key are entirely an owner call.

---

## 3. BLOCKER — `warehouse360.overview` contract is fabricated

The one existing contract declares fields `plant_code` + `occupancy_rate` and `primary_key:
[plant_code]`. The real `wh360_kpi_snapshot_v` has **none of those columns** — it is a global
single-row KPI snapshot (`orders_total`, `orders_red`, … `bin_util_pct`) with no plant column and
no key. The existing contract's schema is therefore entirely placeholder. Correcting it cannot pass
validation (no real PK) and is entangled with the §2 grain decision, so it is flagged here rather
than rewritten. (This strengthens the Task 1 inventory finding: the single contract that exists is
fabricated down to its columns.)

Related: the existing contract's `access_policy.row_level_key` is `plant_code`, but the live views
expose **`plant_id`** (and it is **nullable** in all of them). RLS bound to a nullable column either
leaks or drops rows. The `plant_code` ↔ `plant_id` naming + nullability needs reconciliation.

---

## 4. Owner decisions required before authoring

For each Wave-1 contract the data-product owner needs to specify:

1. **Grain + primary key** per view (see §2). E.g. is `staging_workload` one row per process order,
   or per order-component/reservation? What makes `inbound_backlog` unique?
2. **Overview & exceptions key/grain** (§2) — these are keyless today. Options: introduce a
   `snapshot_ts`/surrogate id in the serving view, or model as a non-keyed singleton (which the
   current contract schema does not support).
3. **`plant_code` vs `plant_id`** as the canonical RLS key, and how to handle its nullability (§3).
4. **`source_view` naming** — confirm contracts should declare the aspirational
   `vw_consumption_warehouse360_*` views (matching the existing contract + the
   `validate_contracts.py` prefix rule), with the `wh360_*_v` views as the backing source pending a
   migration that creates the `vw_consumption_*` serving layer.
5. **Wave-1 mapping** of `stock_exceptions` / `dispensary_queue` / `shortfalls` to the candidate
   views in §1 (or confirm they are out of scope for now).

Once (1)–(5) are answered, the contracts can be authored in one pass — the column/type payloads
below are already verified and ready to drop in.

---

## 5. Verified column payloads (ready for contract `fields`)

Type mapping applied: `STRING→string`, `INT→integer`, `LONG→long`, `DECIMAL→decimal`,
`DATE→date`, `BOOLEAN→boolean`. `required` = (`is_nullable = NO`).
**Note:** many date-like columns are typed `STRING` in the views (e.g. `planned_gi_date`,
`delivery_date`, `po_date`), not `DATE`/`TIMESTAMP` — flagged for the owner as a possible
serving-layer data-quality fix.

### 5.1 `wh360_kpi_snapshot_v` → `warehouse360.overview` (keyless — §2/§3)

| column | type | required |
|---|---|:---:|
| orders_total | long | no |
| orders_red | long | no |
| orders_amber | long | no |
| trs_open | long | no |
| tos_open | long | no |
| deliveries_today | long | no |
| deliveries_at_risk | long | no |
| inbound_open | long | no |
| bins_blocked | long | no |
| bins_total | long | no |
| bin_util_pct | decimal | no |

### 5.2 `wh360_inbound_v` → `warehouse360.inbound_backlog` (grain TBD — §2)

| column | type | required |
|---|---|:---:|
| po_id | string | yes |
| po_item | string | yes |
| doc_type | string | no |
| doc_cat | string | no |
| vendor_id | string | no |
| vendor_name | string | no |
| plant_id | string | no |
| storage_loc | string | no |
| material_id | string | no |
| material_name | string | no |
| ordered_qty | decimal | no |
| gr_qty | decimal | yes |
| uom | string | no |
| delivery_date | string | no |
| po_date | string | no |
| delivery_complete | string | no |
| open_qty | decimal | no |
| qa_lot_id | string | no |
| qa_status | string | yes |

### 5.3 `wh360_deliveries_v` → `warehouse360.outbound_backlog` (grain TBD — §2)

| column | type | required |
|---|---|:---:|
| delivery_id | string | yes |
| delivery_type | string | no |
| plant_id | string | no |
| customer_id | string | no |
| customer_name | string | no |
| carrier | string | no |
| lgnum | string | no |
| planned_gi_date | string | no |
| actual_gi_date | string | no |
| loading_date | string | no |
| delivery_date | string | no |
| gross_weight | decimal | no |
| weight_uom | string | no |
| packages | string | no |
| wm_status | string | no |
| mins_to_cutoff | decimal | no |
| pick_pct | decimal | yes |
| line_count | long | yes |
| risk | string | yes |
| shipped | boolean | yes |

### 5.4 `wh360_process_orders_v` → `warehouse360.staging_workload` (grain TBD — §2)

| column | type | required |
|---|---|:---:|
| order_id | string | yes |
| material_id | string | no |
| plant_id | string | no |
| order_qty | decimal | no |
| uom | string | no |
| material_name | string | no |
| planned_start | string | no |
| planned_finish | string | no |
| sched_start | string | no |
| sched_finish | string | no |
| staging_pct | decimal | yes |
| to_items_total | long | yes |
| to_items_done | long | yes |
| mins_to_start | decimal | no |
| risk | string | yes |
| reservation_no | string | no |
| batch_id | string | no |
| sap_order | string | yes |

### 5.5 `imwm_exceptions_v` → `warehouse360.im_wm_reconciliation` (keyless — §2)

| column | type | required |
|---|---|:---:|
| exception_type | string | yes |
| severity | integer | yes |
| sla_hours | integer | yes |
| material_id | string | no |
| material_name | string | no |
| plant_id | string | no |
| storage_loc | string | no |
| storage_loc_name | string | no |
| qty | decimal | no |
| batch_id | string | no |
| bin_id | string | no |
| detail_text | string | no |
| detected_date | date | yes |

---

## 6. Suggested freshness targets (Plan §4.2, pending owner confirmation)

| Contract | expected | warning | critical |
|---|---:|---:|---:|
| warehouse360.overview | 15 | 30 | 60 |
| warehouse360.inbound_backlog | 30 | 60 | 120 |
| warehouse360.outbound_backlog | 15 | 30 | 60 |
| warehouse360.staging_workload | 15 | 30 | 60 |
| warehouse360.im_wm_reconciliation | 30 | 60 | 120 |
