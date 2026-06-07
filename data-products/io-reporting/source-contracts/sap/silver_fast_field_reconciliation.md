# silver_fast SAP field reconciliation

Date: 2026-06-07 · Author: SAP WM/MM + Databricks engineering · Status: **APPROVED — implemented**

`silver_fast` previously failed analysis: 4 Warehouse360-critical staging flows referenced SAP columns
absent from the replicated DEV/UAT schemas. This document reconciled each missing field against the
available evidence; an **SAP MM/WM functional owner has now signed off** on the mappings below, so the
approved mappings **are implemented** in `silver/tables/warehouse_fast.py` (see "Approved decisions").

> **Basis of the status change (read this):** the status moved from BLOCKED to APPROVED because a
> **functional sign-off was given** — *not* because DDIC/DD03L became available (it is still
> unavailable). The evidence limitation below is unchanged. Notably, the approved fields **differ from
> the earlier candidates** this doc proposed (`VISTA` not `VISTM`; `MENGE - TAMEN` not `MENGE - MENGA`),
> which is itself evidence that a genuine functional review occurred rather than a rubber-stamp of the
> engineering guess. Existence of every approved/candidate field was re-verified against
> `connected_plant_dev.information_schema.columns` on 2026-06-07 before implementation.

## Evidence basis & limitation (read first)

| Source | Available? | What it proves |
|---|---|---|
| Aecorsoft replication (mapping is **1:1**) | yes | Replicated column names **are** the real SAP field names (no renaming). A field absent from the replicated table is either *not selected for replication* or *not a field on that SAP table*. |
| `connected_plant_dev` / `connected_plant_uat` `information_schema.columns` | yes | Which fields **exist** in the replicated tables (DEV = UAT for all gaps here). |
| `scratch.gold_sap_table_metadata` (DDIC table-level / DD02L-like) | yes | Table class only (e.g. `/AECOR/LTAP` = TRANSP). **No field list.** |
| `scratch.gold_sap_data_element_metadata` (DD04L-like) | yes | data_element → domain / type / length / decimals. **No field→data-element link, no description text.** |
| DDIC **DD03L** (field → data element) | **NO** | — the field→meaning bridge is unavailable. |
| LeanX / public docs | **barred by task** | — |

**Therefore the available evidence proves field _existence_, not field _meaning_.** Mapping a missing
field to a replicated field of the same apparent purpose would rely on SAP training knowledge — which
the task bars as "public docs as source of truth" — so such mappings are **candidates, not proven**,
and are **not applied to code**. The strongest signal supporting caution: the original code references
`ANFME`/`ENMNG`/`ISPOS`, which are **not fields on LTAP at all** — i.e. the original author's model of
LTAP was wrong, so an "obvious" mental-model remap (ours included) must not be trusted on
WH360-critical quantities.

## Approved decisions (functional sign-off — implemented 2026-06-07)

| Flow (table) | Contract field | Approved source | Rule as implemented |
|---|---|---|---|
| `stg_warehouse_transfer_order` (LTAP) | `requested_quantity` | `VSOLM` | source target qty, base UoM (source-leg; **not** destination `NSOLM`) |
| `stg_warehouse_transfer_order` (LTAP) | `confirmed_quantity` | `VISTA` | source actual qty (source-leg; **not** `VISTM`/destination) |
| `stg_warehouse_transfer_order` (LTAP) | `actual_quantity_picked` | `VISTA` (alias) | WM picking & confirmation collapse to one persisted LTAP quantity → aliased to `confirmed_quantity`; kept for contract compatibility, **not** an independent measure |
| `stg_warehouse_transfer_requirement` (LTBP) | `open_quantity` | `greatest(coalesce(MENGE,0) - coalesce(TAMEN,0), 0)` | required minus qty already converted to TOs (`TAMEN`); null-safe; clamped ≥ 0. `TAMEN` confirmed present in replicated LTBP (2026-06-07) → no `MENGA` fallback needed |
| `stg_goods_movement` (MSEG) | `delivery_number` / `delivery_item` | `VBELN_IM` / `VBELP_IM` | IM (S/4) delivery reference; stays NULL when blank (no fake fallback to `MBLNR`/`KDAUF`/`LFBNR`); new `reference_type = 'DELIVERY'` only when `VBELN_IM` populated |
| `batch_stock` (MCHB) | `base_uom` | `materialmaster_mara.MEINS` | MCHB carries no unit; enrich by join `MCHB.MATNR = MARA.MATNR` (on `MANDT+MATNR`; MARA unique per client+material → no fan-out) |
| `batch_stock` (MCHB) | *(model)* | snapshot / current-state | MCHB is stock current state, not an ordered event stream → modelled as a current-state **materialized view** (full recompute) keyed by (material/plant/storage-location/batch). No `apply_changes`/CDC; `AEDATTM` kept as extraction timestamp only (**not** an ordering key); no dependency on `AERUNID`/`AERECNO`/`RecordActivity` |

Preserved on LTAP per sign-off: status fields `PQUIT`/`PVQUI` (item) and `KQUIT` (header, LTAK). Source-leg
locations and the existing `is_processing_complete` (`ELIKZ`) on LTBP are unchanged — `ELIKZ` exposes
completion (it is **not** used as a new row filter; completed TRs naturally yield `open_quantity` 0).

## Per-field reconciliation

### 1. `stg_warehouse_transfer_order` ← `transferorderobjects_ltap` (LTAP, 165 cols replicated)

| Code field | Aliased to (business meaning) | DDIC (DD03L) | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `ANFME` | `requested_quantity` (TO source target qty) | unavailable | **absent**; not a standard LTAP field. LTAP source/dest quantity pairs present: `VSOLA`/`VSOLM`, `NSOLA`/`NSOLM`, `VISTA`/`VISTM`, `NISTA`/`NISTM`, diffs `VDIF*`/`NDIF*` | `VSOLM` (qty in base UoM) | **APPROVED → `VSOLM`** (implemented) | resolved |
| `ENMNG` | `confirmed_quantity` | unavailable | absent; not standard LTAP | `VISTA` (source actual) | **APPROVED → `VISTA`** (implemented; note: functional chose `VISTA`, **not** the earlier `VISTM` guess) | resolved |
| `ISPOS` | `actual_quantity_picked` | unavailable | absent; not standard LTAP | `VISTA` (alias of `confirmed_quantity`); pick-confirm flag is `PQUIT`/`PVQUI` (present, used) | **APPROVED → alias of `confirmed_quantity` (`VISTA`)** (implemented) | picking & confirmation collapse to one persisted LTAP quantity; kept for contract compatibility |

Note: status (`PQUIT`/`KQUIT`), locations (`VLTYP`/`VLPLA`/`NLTYP`/`NLPLA`), `MEINS`, `VBELN` are
present and already used. Cannot distinguish "real field, not replicated → request replication" from
"wrong field name → remap" without DD03L.

### 2. `stg_warehouse_transfer_requirement` ← `transferrequirementobjects_ltbp` (LTBP, 52 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `ENQTY` | `open_quantity` | unavailable | **absent**. Quantity fields present: `MENGE`, `MENGA`, **`TAMEN`** (re-verified present 2026-06-07), `MEINS` | `greatest(coalesce(MENGE,0) - coalesce(TAMEN,0), 0)` | **APPROVED → `MENGE - TAMEN`, null-safe, clamped ≥ 0** (implemented; functional chose `TAMEN` = qty already converted to TOs, **not** the earlier `MENGA` guess) | null/negative behaviour defined: NULLs→0, negatives→0 |

### 3. `stg_goods_movement` ← `inventorymovement_mseg` (MSEG, 214 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `VBELN` | `delivery_number` | unavailable | **absent**. Present: `VBELN_IM`, `VBELP_IM` (delivery in IM), `LFBNR`/`LFBJA`/`LFPOS` (ref doc), `KDAUF` | `VBELN_IM` / `VBELP_IM` | **APPROVED → `VBELN_IM`/`VBELP_IM`** (implemented; intent confirmed = *delivery* reference) | NULL when blank (no fallback); `reference_type='DELIVERY'` when populated |

### 4. `stg_batch_stock` ← `batchstock_mchb` (MCHB, 44 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `MEINS` | `base_uom` | unavailable | **absent on MCHB** (MCHB carries stock buckets `CLABS`/`CINSM`/`CSPEM`…, not a unit). `materialmaster_mara.MEINS` **present** | join `MARA` on `MANDT+MATNR` for `base_uom` | **APPROVED → MARA.MEINS join** (implemented) | low; structural; MARA unique per client+material → no fan-out |
| `AERUNID`, `AERECNO` | CDC sequencing (`_run_id`, `_record_seq` in `apply_changes sequence_by`) | n/a (Aecorsoft metadata) | **absent**; `RecordActivity` also absent; only `AEDATTM` present | model as snapshot/current-state (no CDC) | **APPROVED → snapshot / current-state MV** (implemented). MCHB is stock current state, not an ordered event stream, so SCD1 sequencing is not required: full-recompute materialized view keyed by the natural key (proven 1:1 unique: 11,499,051 rows = 11,499,051 distinct keys, 2026-06-07). `AEDATTM` kept as extraction timestamp only, **not** an ordering key | none; no tied-timestamp risk — there is no event ordering |

## Resolved questions (functional sign-off, 2026-06-07)

These were the open questions before sign-off; each now has a recorded decision.

1. **MSEG — reference intent.** RESOLVED: the intent is the **delivery** reference →
   `VBELN_IM`/`VBELP_IM`, with `reference_type='DELIVERY'` when populated and NULL when blank (no
   fallback to `MBLNR`/`KDAUF`/`LFBNR`).

2. **LTAP — `confirmed_quantity` vs `actual_quantity_picked`.** RESOLVED: in this WM use case picking
   and confirmation collapse to one persisted LTAP quantity → both map to `VISTA`;
   `actual_quantity_picked` is an **alias** of `confirmed_quantity` (kept for contract compatibility,
   not an independent measure). (Functional chose `VISTA`, not the earlier `VISTM` guess.)

3. **LTAP — destination-leg quantities.** RESOLVED: source-leg only (`VSOLM`/`VISTA`). Destination
   `NSOLM`/`NISTM` are **not** used. Revisit only if put-away/destination quantities are later required.

4. **LTBP — `open_quantity` derivation + null/negative behaviour.** RESOLVED:
   `greatest(coalesce(MENGE,0) - coalesce(TAMEN,0), 0)` — qty already converted to TOs is `TAMEN`
   (confirmed present 2026-06-07), NULLs treated as 0, negative results clamped to 0.

5. **MCHB — base_uom + CDC.** RESOLVED: `base_uom` ← `MARA.MEINS` join; and MCHB modelled as a
   **snapshot / current-state materialized view** (no CDC) since it is stock current state, not an
   ordered event stream → no `AERUNID`/`AERECNO` sequencing required. The natural key is 1:1 unique.

6. **DLT failure mode (historical note).** Before this fix the blocked flows failed at graph
   *analysis* (`UNRESOLVED_COLUMN`) — before any `@dlt.expect` ran — so the whole `silver_fast` update
   failed to start (hard blocked, not degraded/quarantinable). The approved mappings resolve the
   unresolved columns; remaining behaviour is governed by the `@dlt.expect` rules on each flow.

## CHARG is an exact SAP identifier (batch number) — preserve exactly

**Decision (pre-merge review):** `CHARG` (batch number) is an **exact** SAP character identifier. It
must be preserved **exactly as replicated** for keys, joins, and Warehouse360 contracts — **no**
leading-zero stripping, **no** trimming, **no** display canonicalisation. Both `batch_number` and
`batch_number_raw` are a direct `F.col("…CHARG").alias(…)` (identical). This contrasts with `MATNR`,
which remains display-normalised (`material_code` stripped, `material_code_raw` exact) — the two are
deliberately kept separate.

Applied repo-wide across the silver transforms (warehouse_fast, warehouse_flow, warehouse_reference,
inbound, quality). Enforced by `scripts/ci/check_silver_fast_field_mappings.py` (bans `strip_zeros`/
`trim`/normalisation on `CHARG`; requires `batch_number`/`_raw` to be a direct CHARG column).

**§E1 batch_stock key — RESOLVED.** The earlier finding (2,016 colliding key groups / 4,039 rows) was
caused by `strip_zeros` on `CHARG` (leading-zero/blank collapse) plus the key omitting `MANDT`. Fix:
preserve `CHARG` exactly **and** expose `client` (`MCHB.MANDT`), then key on the exact SAP key
(`client, material_code_raw, plant_code, storage_location_code, batch_number_raw`). Measured directly
on bronze MCHB (2026-06-07): **0 colliding groups** on the raw key **and 0** on the display key once
CHARG is exact (11,499,051 rows). The collisions were caused specifically by stripping CHARG; they are
resolved. (Silver re-measure pending the next full re-materialisation — `silver_fast_mapping_validation.sql`
§E1/§E1b.)

## Decisions summary

- **Approved mappings implemented** in `silver/tables/warehouse_fast.py` (LTAP `VSOLM`/`VISTA`,
  LTBP `MENGE - TAMEN`, MSEG `VBELN_IM`/`VBELP_IM`, MCHB `MARA.MEINS` + snapshot/current-state MV).
  Authorised by functional sign-off, not by new DDIC evidence; field existence re-verified 2026-06-07.
- A regression guard (`scripts/ci/check_silver_fast_field_mappings.py`) bans re-introduction of the
  invalid fields (`ANFME`/`ENMNG`/`ISPOS`/`ENQTY`, `MSEG.VBELN` as delivery, `MCHB.MEINS`,
  `MCHB.AERUNID`/`AERECNO`) and the MCHB `apply_changes` pattern in the transform.
- The unit-test mirrors in `tests/test_warehouse_ops.py` (LTAP/LTBP) were updated to the approved
  fields so they no longer encode the old mappings (a false-green trap). pytest requires Java and was
  **not run locally** (env limitation) — CI verifies; `py_compile` + `ruff` pass.
- **Validation:** see `validation/silver_fast_mapping_validation.sql` (null rates, MCHB key
  uniqueness, TAMEN-derivation sanity, MCHB↔MARA join coverage + a MARA fan-out guard).

### Run result (DEV, 2026-06-07, update 5abc0952)

- **The 4 WH360-critical flows now RESOLVE at analysis.** Pre-fix updates failed analysis on
  *"`stg_warehouse_transfer_order` and 6 other flows"* (the 4 critical + 3 process_order flows). This
  update fails on only *"`stg_process_order_operation` and 2 other flows"* — i.e. `warehouse_transfer_order`,
  `warehouse_transfer_requirement`, `goods_movement`, `batch_stock` no longer appear in the failure or
  upstream-failure lists. The approved mappings are correct *at the column-resolution level*, and the
  source-side fan-out guard confirms the MCHB↔MARA join is safe (MARA 1:1).
- **RESOLVE ≠ VALIDATE, and silver_fast still does NOT complete.** DLT graph analysis is all-or-nothing,
  so the whole update aborts on the remaining 3 flows → **nothing materialised**. The output checks
  (`silver_fast_mapping_validation.sql` §B–E) could not run, so the mappings are **not yet
  data-validated**; Gold is **not built**; Warehouse360 source objects remain **0/7**; no contract is
  promoted.
- **Next distinct blocker (OUT OF SCOPE of this PR):** the 3 non-WH360 PP/PI flows in
  `silver/tables/process_order.py` — `stg_process_order_operation` (`processorderobject_afvc`),
  `stg_pi_sheet_execution`, `stg_downtime_event` (`downtime_zpexpm_dwnt`) — reference the CDC sequencing
  metadata `AERUNID`/`AERECNO`/`RecordActivity`, which is **absent** from their replicated source tables
  (`UNRESOLVED_COLUMN`). This is the same metadata gap as MCHB, on a different domain. These flows were
  already recorded as `non_critical_flows_also_failing` and were explicitly scoped out. **Recommended
  next step (separate change):** apply the same snapshot/current-state pattern (or source-guard) to
  these 3 flows so silver_fast can complete, then run §B–E + Gold + the WH360 pack.
- DEV remains a **technical shakedown only**; UAT is the first full business/HU validation.

## Follow-up actions

1. **DONE** — functional sign-off received; approved mappings implemented and the existence of every
   approved field re-verified against the live replicated schema (2026-06-07).
2. **UAT validation** — DEV is a technical shakedown only (data old/limited). The approved mappings
   must be re-validated against UAT business data (and HU reconciliation) before any contract is
   promoted; record results in the WH360 DEV/UAT profiles.
3. **Optional future enrichment** — if put-away/destination quantities are ever required on LTAP, or a
   non-delivery MSEG reference type, reopen the relevant resolved question above with a new functional
   decision. (CDC metadata on MCHB is **no longer needed** — the snapshot/current-state model removes
   the dependency on `AERUNID`/`AERECNO`.)
