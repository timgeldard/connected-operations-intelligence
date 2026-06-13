# Spec 14 — Push Despatch KPIs (new build)

Read `docs/specs/_conventions.md` first. Branch: `feature/push-despatch-kpis`.

## Objective

Surface a **Push Despatch** operations panel in WM Operations. Push Despatch is a Kerry
custom SAP WM process (WMA-E-23): unplanned, RF-driven plant→DC stock transfers that
auto-create a Stock Transport Order (STO/PO), an outbound delivery, and the warehouse
transfer orders — *supply-driven* (initiated by the shipping site), not demand-driven.
Because these are internal repositioning moves, they must be **segregated** from
customer-facing outbound KPIs and monitored on their own: throughput, timeliness (PGI),
volume, push-vs-normal share, and exceptions (open/overdue pushes).

Source analysis: `Downloads/push_despatch_process_and_system_analysis_*.pdf` (the business
+ SAP behaviour reference). The KPI set and panel layout below come from §10–11 of that doc.

## Phase 0 — Identification gate (BLOCKING — do not build gold until resolved)

The whole feature hinges on **how a push-despatch document is identified**. The doc's
recommended primary marker is the SD Special Processing indicator `SDABW = 'ZPUS'` on the
sales doc (VBKD) / outbound delivery (LIKP/LIPS). **This marker is NOT currently projected
into `silver.outbound_delivery`** (verify: read the full select in
`silver/tables/warehouse_flow.py` `stg_outbound_delivery`, ~L145–229 — there is no
`SDABW`). A recon of bronze (`connected_plant_uat.sap`) is being run by the orchestrator to
answer the make-or-break question: **does `SDABW='ZPUS'` return any rows estate-wide, and is
the field present on `deliveryobjects_likp`/`_lips`?**

Branch on the recon result (the orchestrator will paste numbers here before you start):

- **Path A — ZPUS present & populated (preferred):** add `SDABW` to the silver
  `outbound_delivery` projection (see §1) and identify push deliveries by
  `TRIM(special_processing_code) = 'ZPUS'`. This is the single-source-of-truth flag.
- **Path B — ZPUS absent or zero rows:** fall back to **document-type** markers — STO
  purchase-order type `BSART='NBC3'` and/or outbound delivery type `LFART='ZNL1'`
  (`delivery_type` already in silver, `warehouse_flow.py:156`) — **plus** the
  plant-pair config table `ZSCM_PUSH_DES` if it is in bronze (recon checks). Document
  types are site-specific and *not robust as a sole identifier* (doc §7), so Path B ships
  with an explicit `identification_method` column and a loud caveat in the table comment.
- **Either path:** the custom live log tables (`ZPUSH_DISPATCH`, `ZSCM_PUSH_DES`,
  `ZQMA_SHIPQI`) are almost certainly **not** replicated to bronze. If recon confirms they
  are absent, the "stock staged in loading-bay 916 / pallets with no active load" KPIs are
  **out of scope for v1** — add a line to `docs/ingestion_requests.md` requesting
  `ZPUSH_DISPATCH` + `ZSCM_PUSH_DES` and note the deferral in your report. Build everything
  achievable from `outbound_delivery` + `purchase_order` and clearly scope-flag the rest.

Bake the identifier into the **data model**, not the UI (doc §11 "single source of truth"):
emit a boolean `is_push_despatch` (and `identification_method`) in the gold layer so every
downstream view filters consistently.

## Design

### 1. Silver — add the marker (Path A only; additive, behind a column-exists guard)

In `silver/tables/warehouse_flow.py` `stg_outbound_delivery`, add to the header projection
(only if recon confirms the column exists on `deliveryobjects_likp`; guard with
`bronze_columns_exist` per convention §5 since it may be absent in dev):

```python
F.col("h.SDABW").alias("special_processing_code"),   # 'ZPUS' marks Push Despatch (doc §7)
```
Optionally also `LIKP.TRAID` (`container_vehicle_id`) and `LIKP.TRATY` (`transport_type`) if
recon shows them populated — useful for the drill-down, but NOT required for v1 KPIs.

**Caveat to document (same class as `delivery_direction`, warehouse_flow.py:200–204):** a
newly-added column is NULL on pre-existing SCD1 rows until churn / full-refresh backfills it.
Gold MUST tolerate NULL `special_processing_code` (treat as non-push) and the orchestrator
must full-refresh `outbound_delivery` post-merge before the KPI is trustworthy — flag this.

### 2. Gold — `gold/warehouse_flow_gold.py` (sibling to `gold_delivery_pick_status`
   warehouse_flow.py:150 and `gold_wm_inbound_deliveries`:254 — reuse their source idiom,
   including the `outbound_delivery_header_delete` anti-join used by `gold_delivery_pick_status`)

   a. **`gold_wm_push_despatch_delivery`** — delivery-grain (one row per push outbound
      delivery; aggregate the item grain up to `delivery_number`). Scope:
      `delivery_direction = 'OUTBOUND'` (VBTYP='J') AND `is_push_despatch`. Columns:
      - Grain/axis: `plant_code` (source plant — canonical axis), `delivery_number`.
      - Destination: resolve via `source_document_number` (VGBEL, the STO link —
        `warehouse_flow.py:197`) joined to `silver.purchase_order` for the **receiving
        plant**. ⚠️ plant_code ambiguity (conventions §2): `purchase_order` carries its own
        plant — **drop the PO-side `plant_code`/rename before the join** and keep the
        delivery's source plant as the axis; expose the PO's receiving plant as a distinct
        `destination_plant_code`. Verify the PO silver column names in
        `silver/tables/inbound.py` `stg_purchase_order` (~L29–50) before relying on them; if
        the STO receiving-plant column is not cleanly available, ship destination as NULL in
        v1 and note it (do NOT invent a join key).
      - Volume: `pallet_count` (count of distinct HU/SSCC if `handling_unit` is registered —
        it is *conditionally* registered, `inbound.py:184`; guard with `table_exists`, else
        fall back to item-line count), `total_net_weight` / `total_gross_weight` (SUM of
        `net_weight`/`gross_weight`, carry `weight_unit`; do not sum across mixed units —
        group/segregate by unit or report base only).
      - Timing: `planned_goods_issue_date` (WADAT), `actual_goods_issue_date` (WADAT_IST),
        `is_pgi_complete` = actual IS NOT NULL, `pgi_on_time` = (actual IS NOT NULL AND
        actual ≤ planned) — **deterministic** (both are historical dates, no wall-clock).
        Do NOT compute "overdue as of today" here (needs current_date → §1d below).
      - `identification_method` (string: 'ZPUS' | 'NBC3' | 'ZNL1' | 'ZSCM_PUSH_DES').

   b. **`gold_wm_push_despatch_daily`** — KPI aggregate at
      `plant_code × destination_plant_code × goods_issue_day × weight_unit`. Derive
      `goods_issue_day = date_trunc('day', actual_goods_issue_date)` (deterministic).
      Measures (all COUNT/SUM ⇒ `type: long`, convention §6; ratios `double`):
      `push_delivery_count`, `pallets_pushed`, `total_net_weight`, `pgi_complete_count`,
      `on_time_pgi_count`, and `on_time_pgi_pct` = on_time / complete (zero-denominator
      guarded → NULL). This feeds the "shipments today / pallets pushed / on-time %" tiles
      and the daily trend.

### 1d. Query-time (consumption view, NOT gold — convention §4)

The **exception** KPIs are "as of now" and therefore live in the consumption/`_live` layer
where `current_date()` is allowed:
- **Open / overdue pushes**: push deliveries with `is_pgi_complete = false` AND
  `planned_goods_issue_date < current_date()` → "pending PGI (overdue)" count + list.
- **Push-vs-normal share**: a separate lightweight aggregate or a column on the daily view
  comparing push vs total outbound count per plant/day (context metric, doc §10).

Add these as expressions in the hand-maintained consumption views; keep the gold MV
deterministic.

### 3. Serving / security / contracts / OKF (house pattern, conventions §7–10)

- Regenerate ALL security SQL variants (`scripts/generate_gold_security_sql.py`: dev/uat/prod
  strict + harden + dev/uat validation_fixture + validation_open) after adding the two gold
  tables to `GOLD_TABLES`.
- Append consumption views (`wm_operations.push_despatch_delivery`,
  `wm_operations.push_despatch_daily`) to
  `resources/sql/wm_operations_consumption_views_{dev,uat,prod}.sql` (all three identical
  except catalog), with the §1d query-time exception/overdue/ share expressions.
- Add both contracts to `data-products/io-reporting/contracts/app_contract_manifest.yml`
  with full field descriptions (they publish to Unity Catalog).
- `make generate-okf` + `check_okf_bundle_fresh.py`.

### 4. App + frontend (house pattern, conventions house-pattern §)

- `SIMPLE_DATASETS` entries in
  `apps/api/adapters/wm_operations/wm_operations_databricks_adapter.py` for both datasets
  (+ route tests: rows / 401 / 503).
- TS types + `useWm*` hooks in `domain-integrations/wm-operations/src/adapters/`.
- New **Push Despatch** view (Outbound/Insight group) — four-panel layout per doc §10:
  1. **KPI strip**: Push Shipments Today · Pallets Pushed · On-Time Push % · Open Push
     Issues (overdue count, red if > 0).
  2. **Throughput trend**: push delivery count + volume per day (CSS bars, last N days).
  3. **In-transit / staged context**: push-vs-normal share; (loading-bay 916 staged count
     ONLY if the log tables landed — otherwise omit the tile, don't fake it).
  4. **Exceptions**: overdue-PGI list (delivery, plant→destination, pallets, planned GI
     date, days overdue) with an Order Journey / delivery deep link where one exists.
  Register in `wm-operations-registration.ts` + workspace wiring. Pick a free `sortOrder`
  (sweep existing registrations for the next gap — coordinate with the other in-flight
  wm-gold features at merge).
  Frontend conventions: `kw-card`, error-branch-before-empty-state, react-query hooks,
  `useMemo` with complete deps.

## Gotchas

- **Identification is the whole ballgame** — resolve Phase 0 before writing gold. A
  ZPUS-based flag with zero estate-wide rows is a silent empty dashboard; if recon says
  zero, take Path B and say so loudly in the table comment + your report.
- **plant_code axis**: the source (shipping) plant is canonical; destination comes from the
  PO join and must be a *separate* column — drop the PO-side plant before joining
  (conventions §2). This is the exact AMBIGUOUS_REFERENCE class that only surfaces at DLT
  analysis — get it right offline.
- **Newly-added silver column is NULL until backfill** — gold treats NULL marker as
  non-push; orchestrator full-refreshes `outbound_delivery` post-merge (flag it).
- **No wall-clock in gold** — on-time (vs planned date) is deterministic and lives in gold;
  overdue (vs *today*) is query-time and lives in the consumption view (§1d).
- **Weight units**: never SUM across mixed `weight_unit`; carry it in the grain.
- **Two new gold tables** ⇒ generator + ALL variants + `check_dlt_dataset_names_unique`.
- **Segregation**: this panel must NOT alter existing customer-outbound KPIs; it is additive
  and read-only. `gold_delivery_pick_status` etc. stay untouched (regression-safe).

## Acceptance

- A fixture push delivery (marker set, OUTBOUND) appears in `push_despatch_delivery` with
  correct pallet/weight rollup; a normal customer delivery (no marker) never appears.
- `pgi_on_time` true when actual ≤ planned, false when actual > planned, and
  `is_pgi_complete` false when actual GI is NULL — PySpark fixture tests for each (CI-only;
  write them, no vacuous assertions).
- `on_time_pgi_pct` is NULL (not a divide error) when `pgi_complete_count = 0`.
- Daily aggregate counts reproduce by hand for a small fixture; weight not summed across
  units.
- Determinism guard passes (no `current_date` in gold); overdue logic present only in the
  consumption view.
- Honest table comments: identification method + its confidence, NULL-until-backfill caveat,
  any deferred KPI (916 staging / live log) with the ingestion-request reference.

## Post-merge (orchestrator)

Full-refresh `outbound_delivery` (backfill the new marker) → gold run to materialise both
MVs → apply security SQL (secured views + REVOKE) → apply consumption views → live-verify
`is_push_despatch` actually selects rows (the make-or-break check) and that the overdue
expression returns sane counts.
