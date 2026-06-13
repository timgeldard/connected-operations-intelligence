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

## Phase 0 — Identification gate (RESOLVED by recon 2026-06-13; one blocker remains for PRODUCT)

Bronze recon (UAT warehouse `e76480b94bea6ed5`) settled the identification question. The
findings **override the source PDF's identity model** — follow these, not the doc:

**Anchor: `TRIM(SDABW) = 'ZPUS'` on the delivery HEADER. Nothing else.**
- `connected_plant_uat.sap.deliveryobjects_likp.SDABW` is PRESENT (STRING); `ZPUS` = **28,760
  deliveries** (376k non-blank SDABW overall). SDABW is **ABSENT on LIPS** — so the marker is
  header-grain only (add it to the header projection, §1).
- The sales-doc table `connected_plant_uat.sap.salesorderobject_vbkd` also has `SDABW`, with
  **61,712 ZPUS** rows — relevant only if we later anchor on the sales doc (see blocker).
- **Document-type markers are REJECTED (do not use):** the PDF says ZPUS == STO/`NBC3`/`ZNL1`.
  In our data ZPUS deliveries are overwhelmingly `LFART='ZD04'` with `LIPS.VGTYP='C'`
  (sales-order reference), **not** STO. `ZNL1`↔`ZPUS` overlap = **1 row**; VGBEL→EKKO STO
  link resolves to **12 rows**. `NBC3`/`ZNL1` describe a *different/older* flow. Anchor on
  ZPUS only; do NOT gate on `ZNL1`/`NBC3`. (No `identification_method` column needed — there
  is one method.)

**⚠️ BLOCKER FOR PRODUCT DECISION — staleness.** `SDABW='ZPUS'` on LIKP **stops at
2023-12-05** (2020:2,646 / 2021:8,009 / 2022:9,093 / 2023:9,012; **zero in 2024/25/26**). The
bronze LIKP replica is not delivering *current* Push Despatch deliveries. **This makes the
KPI a HISTORICAL analysis, not a live-ops monitor, as built today.** Before building, the
orchestrator/product owner must decide:
  - (a) **Ship as historical** (≤2023 analysis) — valid, but the "today / overdue" tiles will
    be empty; or
  - (b) **Confirm the live source first** — date-profile VBKD `ZPUS` (61,712 rows) to see if
    current push despatch is captured on the sales-doc side instead of LIKP; if so, re-anchor
    on VBKD→delivery. If neither LIKP nor VBKD carries 2024+ ZPUS, this is an **ingestion gap**
    (the SAP extract filters/omits the field) → raise in `docs/ingestion_requests.md` and
    HOLD the build.
  Do not start the gold build until (a) or (b) is chosen. The rest of this spec assumes the
  ZPUS anchor is sound for whatever date range is in scope.

**What's available / not (recon-confirmed):**
- **916 loading-bay staging — AVAILABLE.** `transfer_order` source (LTAP) carries
  `NLTYP/VLTYP='916'` (12.4M / 6.0M rows). The "stock staged in 916" KPI IS buildable from
  silver `transfer_order` — verify `transfer_order` projects the dest/source storage-type
  columns; if not, that's a small additive silver column, not a new source.
- **Pallet / SSCC grain — NOT available.** `ZPUSH_DISPATCH` (live log) is NOT replicated to
  bronze (confirmed absent). Pallet-count KPIs degrade to **delivery/item grain + HU count
  where `handling_unit` exists**. Add a `docs/ingestion_requests.md` line for `ZPUSH_DISPATCH`
  and scope-flag the pallet KPIs as deferred.
- **Vehicle id — AVAILABLE & rich.** `LIKP.TRAID` populated on **28,634 / 28,760** ZPUS
  deliveries; `TRATY` present. Add both to silver (§1) for the drill-down.
- **Plant-pair config — AVAILABLE.** `ZSCM_PUSH_DES` =
  `published_uat.central_services.pushdespatch_phase1sites_zscm_push_des` (632 rows) — a
  small reference map of buy/sell plant pairs; optional context, not required for v1.

Bake the identifier into the **data model**, not the UI: emit a boolean `is_push_despatch`
= `COALESCE(TRIM(special_processing_code) = 'ZPUS', FALSE)` in gold — the COALESCE is required
so backfilled/NULL-marker rows resolve to a real `FALSE` (non-push), never a tri-state NULL that
would break downstream boolean filters. Every downstream view filters on this column.

## Design

### 1. Silver — add the marker + vehicle id (additive; guard for dev)

In `silver/tables/warehouse_flow.py` `stg_outbound_delivery`, add to the **header**
projection (recon confirmed all three exist & are populated on `deliveryobjects_likp`; still
wrap with `bronze_columns_exist` per convention §5 since LIKP may differ in dev):

```python
F.col("h.SDABW").alias("special_processing_code"),   # 'ZPUS' marks Push Despatch (anchor)
F.col("h.TRAID").alias("container_vehicle_id"),      # vehicle/container — 28,634/28,760 ZPUS populated
F.col("h.TRATY").alias("transport_type"),            # means of transport
```
(SDABW is header-grain — confirmed ABSENT on LIPS — so it belongs on the `h.` alias, not the
item `i.`.)

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
      - Grain/axis: `plant_code` (source/shipping plant — canonical axis), `delivery_number`.
      - Destination: ZPUS deliveries here are **sales-order-referenced** (`VGTYP='C'`), NOT
        STO — so do **NOT** join `silver.purchase_order` (recon: VGBEL→STO resolves to 12
        rows). The receiving party is the **ship-to**: use `ship_to_customer` (KUNNR, already
        in silver `warehouse_flow.py:159`) as `destination_customer`. There is no clean
        "destination plant" without a customer→plant mapping we don't have — ship
        `destination_plant_code` as NULL in v1 and note it (do NOT invent a join). Keep
        `container_vehicle_id` (§1) on the row for the drill.
      - Volume: keep TWO stable columns so the schema/contract doesn't change shape between
        envs (HU present vs absent): `pallet_count` (`long`, **nullable** — distinct HU count when
        `handling_unit` is registered, `table_exists` guard, `inbound.py:184`; NULL when HU grain
        unavailable — `ZPUSH_DISPATCH` is absent so there's no SSCC grain) and `line_count`
        (`long`, **always** populated = delivery item-line count). Never overload one column with
        two meanings — the KPI strip shows pallets when non-null, else falls back to lines with a
        label. `total_net_weight` / `total_gross_weight` are `double` (weight sums — do NOT cast to
        `long`, that truncates); carry `weight_unit` and never sum across mixed units (segregate).
      - Timing: `planned_goods_issue_date` (WADAT), `actual_goods_issue_date` (WADAT_IST),
        `is_pgi_complete` = actual IS NOT NULL, `pgi_on_time` = (actual IS NOT NULL AND
        actual ≤ planned) — **deterministic** (both are historical dates, no wall-clock).
        Do NOT compute "overdue as of today" here (needs current_date → §1d below).
      - (If joining `transfer_order` for the 916-staging signal: conventions §2 still applies —
        `transfer_order` carries its own `plant_code`; drop the non-axis side before joining.)

   b. **`gold_wm_push_despatch_daily`** — KPI aggregate at
      `plant_code × destination_customer × goods_issue_day × weight_unit`. (Group by
      `destination_customer`, NOT `destination_plant_code` — the latter is NULL for these
      sales-order-referenced ZPUS deliveries, so grouping on it would be a no-op and yield no
      destination breakdown; `destination_customer` is the real receiving-party axis.) Derive
      `goods_issue_day = date_trunc('day', actual_goods_issue_date)` (deterministic).
      Measures: count/sum integer-grain measures are `long` (convention §6) —
      `push_delivery_count`, `pallets_pushed` (sum of `pallet_count`; NULL-aware), `line_count`,
      `pgi_complete_count`, `on_time_pgi_count`; weight sums (`total_net_weight`) are `double`;
      ratios (`on_time_pgi_pct` = on_time/complete, zero-denominator-guarded → NULL) are `double`.
      Feeds the "shipments today / pallets pushed / on-time %" tiles and the daily trend.

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
  3. **In-transit / staged context**: push-vs-normal share + loading-bay-916 staged count
     (buildable from `transfer_order` NLTYP/VLTYP='916' — recon-confirmed available). Pallet
     SSCC grain is NOT available, so don't fake a per-pallet tile.
  4. **Exceptions**: overdue-PGI list (delivery, plant→`destination_customer`, line/HU count,
     planned GI date, days overdue) with a delivery deep link where one exists.
  Register in `wm-operations-registration.ts` + workspace wiring. Pick a free `sortOrder`
  (sweep existing registrations for the next gap — coordinate with the other in-flight
  wm-gold features at merge).
  Frontend conventions: `kw-card`, error-branch-before-empty-state, react-query hooks,
  `useMemo` with complete deps.

## Gotchas

- **Staleness is the open question, not identification** (recon resolved identification).
  ZPUS on LIKP stops 2023-12-05 — confirm the date scope with the product owner (Phase 0
  blocker) before building, and state the in-scope date range loudly in the table comment.
  Anchor on `TRIM(SDABW)='ZPUS'` only; `ZNL1`/`NBC3` are a different flow (do not gate on them).
- **plant_code axis**: the source (shipping) plant is canonical. Destination is the ship-to
  customer (not a PO join). If you join `transfer_order` for the 916 signal, it carries its
  own `plant_code` — drop the non-axis side before joining (conventions §2); this is the
  AMBIGUOUS_REFERENCE class that only surfaces at DLT analysis.
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
