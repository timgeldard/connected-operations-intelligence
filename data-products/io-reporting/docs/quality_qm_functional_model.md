# Quality (QM) Silver — Functional Model

**Status:** Design resolved · 2026-06-07 · **Lot + UD tables run-eligible since 2026-06-11**
(deliberate, approved flip — plant gate verified + configurable `qm_lookback_years` time gate,
default 5y; see silver/tables/quality.py. Data findings vs this doc: QAVE.VWERKS is the central
plant 'R001', NOT the lot's plant → UD is gated via the parent lot, not VWERKS (§9 amendment);
VBEWERTUNG domain confirmed A/R from UAT data. The result-grain family (§8) remains ON HOLD.)
**Scope:** Resolves the open functional items that source-guard `quality_inspection_lot`
(inspection start/end date semantics, deletion flag, usage-decision modelling, snapshot-vs-CDC).

## 1. Provenance

The legacy IDP notebooks (`IDP.Databricks/src/notebooks/gold`) and their silver transform configs
(`src/config/silver/silver_qals.{yaml,csv}`, `silver_qave.{yaml,csv}`) are the **functional-intent
reference** — the authoritative SAP-field → business-column mapping. We adopt their *resolved
semantics*, not their implementation: the bespoke `DataFrameTransformer`/`DeltaRead`/`DeltaWrite` +
control-table-watermark framework is exactly what this pipeline replaces. The CSVs are a ~260-column
kitchen-sink dump (every raw `STATxx` passthrough); we model the curated business subset, not the
column count.

Cross-checked against DDIC (`published_dev.central_services.datadictionaryfields_dd03l`) and the
live replicated `connected_plant_dev.sap.inspection_qals` / `inspection_qave` schemas.

## 2. Grain split — the core structural fix

The imported `quality_inspection_lot` conflates **three different grains** into one row. The legacy
model (and SAP's own table design) splits them:

| Silver table | Grain | Source | PK |
|---|---|---|---|
| `quality_inspection_lot` | 1 row / inspection lot | QALS | PRUEFLOS |
| `quality_inspection_usage_decision` | 1 row / usage decision (**1:many per lot**) | QAVE | PRUEFLOS + KZART + ZAEHLER |
| `quality_inspection_characteristic` | 1 row / lot × operation × MIC (spec) | QAMV | PRUEFLOS + VORGLFNR + MERKNR |
| `quality_inspection_result` | 1 row / lot × operation × MIC (result) | QAMR | PRUEFLOS + VORGLFNR + MERKNR |
| `quality_inspection_sample_result` | 1 row / … × sample | QASR | + PROBENR |
| `quality_inspection_individual_result` | 1 row / … × individual reading | QASE | + DETAILERG |

Usage decision is a **child** of the lot, not a lot attribute: a lot can carry multiple UDs
(`ZAEHLER` counter). Folding `VCODE`/`VDATUM` into the lot row (as the imported code does) is wrong —
it silently picks one of N and assumes 1:1.

The lot/UD tables (rows 1–2) serve **io-reporting**; the characteristic/result/sample/individual tables
(rows 3–6) serve **SPC / Connected Quality** (§7). Mapping detail for the result family is §8.

## 3. `quality_inspection_lot` — corrected field contract (QALS, lot grain)

Source: `connected_plant.sap.inspection_qals`. Authoritative mapping (legacy `silver_qals.csv`,
confirmed against DD03L):

| Business column | QALS field | Notes |
|---|---|---|
| `client` | **MANDANT** | QM inspection objects use MANDANT, **not** MANDT (fixed #27). |
| `inspection_lot_number` | PRUEFLOS | PK. |
| `plant_code` | **WERK** | Imported code's `WERKS` is wrong. Plant-gate field. |
| `inspection_type` | ART | |
| `inspection_lot_origin_code` | **HERKUNFT** | Imported `LOTORIGIN` is wrong. |
| `inspection_lot_quantity` | **LOSMENGE** | Imported `MENGE` is wrong. `DECIMAL(13,3)`. |
| `inspection_lot_uom` | **MENGENEINH** | Imported `MEINH` is wrong. |
| `material_code` / `_raw` | MATNR | strip leading zeros; keep raw. |
| `batch_number` / `_raw` | CHARG | **exact SAP identifier — no strip/trim/normalise.** |
| `order_number` / `_raw` | **QALS.AUFNR** | strip leading zeros. See §5 — NOT from qmih. |
| `inspection_start_date` | **PASTRTERM** | Planned inspection start, lot-level. Imported `ENSTDE` is wrong. |
| `inspection_end_date` | **PAENDTERM** | Planned inspection end, lot-level. Imported `EENDDE` is wrong. |
| `lot_created_date` | ENSTEHDAT | **Separate** from inspection start (lot creation ≠ inspection start). |
| `created_by` / `created_date` | ERSTELLER / ERSTELDAT | |
| `updated_by` / `updated_on` | AENDERER / AENDERDAT | |

**Resolved functional items:**
- *Inspection start/end dates* (was "needs sign-off"): **PASTRTERM / PAENDTERM**, at lot grain. The
  legacy model resolves the ambiguity — `ENSTEHDAT` is lot-creation, a distinct column. These dates
  legitimately belong at lot grain (planned inspection window); they are **not** result-level. (Result
  tables carry their own result-recording timestamps at a finer grain.)
- *`is_deletion_flagged`* (KZLOESCH): **no such field on QALS.** Deletion is system-status-derived
  (status object via OBJNR / STATxx). The legacy model carries raw status and computes no deletion
  boolean at silver. **Drop the bespoke `is_deletion_flagged`** from the lot contract; if a deletion
  signal is needed, derive it from system status as an explicit, separately-specified step — do not
  fabricate it from a non-existent field.

## 4. `quality_inspection_usage_decision` — new table (QAVE, UD grain)

Source: `connected_plant.sap.inspection_qave`. PK = PRUEFLOS + KZART + ZAEHLER.

| Business column | QAVE field | Notes |
|---|---|---|
| `client` | MANDANT | |
| `inspection_lot_number` | PRUEFLOS | FK to lot. |
| `inspection_lot_type` | KZART | PK part. |
| `usage_decision_counter` | ZAEHLER | PK part — distinguishes multiple UDs per lot. |
| `usage_decision_code` | VCODE | Plant-specific catalog code (NOT accept/reject — see below). |
| `usage_decision_code_group` | VCODEGRP | |
| `usage_decision_valuation` | **VBEWERTUNG** | **The accept/reject signal.** |
| `usage_decision_date` | **VDATUM** | Imported `VENDAT` is wrong. |
| `usage_decision_by` | VNAME | |
| `quality_score` | QKENNZAHL | `DECIMAL(3,0)`. |
| `follow_up_action` | VFOLGEAKTI | |

**Resolved functional items:**
- *Usage-decision accept/reject*: derive from **VBEWERTUNG** (valuation code), not VCODE. The imported
  `VCODE isin('A','AA') → Accepted` is unsound — VCODE is a free, plant-configurable catalog code.
  **VBEWERTUNG value domain CONFIRMED from UAT data (2026-06-11): 'A' = accepted / 'R' = rejected /
  blank** (C061: 964k A, 4.4k R; P817: 123k A, 4.6k R). The silver transform surfaces VBEWERTUNG raw
  alongside the derived label so the mapping stays auditable.
- *UD-on-QALS vs QAVE*: VCODE/VDATUM are **QAVE** fields. The imported code reads them off QALS (`l.*`),
  which is simply wrong-table. They move to this child table.

## 5. The qmih join — drop the lossy carry-over

The imported lot transform sources `order_number` from `qualitymessage_qmih.AUFNR`. This is the one
piece of imported logic carried forward unchecked, and it's wrong on two counts:
1. **QALS has its own AUFNR** (`silver_qals.csv:91` → PROCESS_ORDER_ID). Order number belongs to the
   lot directly; routing through qmih is lossy (QMIH is a quality-*notification* object, 1:many, and
   not every lot has a notification → left-join nulls + fan-out risk).
2. The legacy `silver_inspection_lot` model is **pure QALS** — no QMNUM, no qmih join.

**Decision:** `order_number` = `QALS.AUFNR` directly. Keeping qmih at all (for
`quality_notification_number`/QMNUM) is a separate, deliberate enrichment — *not* a default carry-over,
and if kept must be modelled as its own 1:many concern, not a lot-grain left-join.

## 6. Ingestion model — AEDATTM current-state (the spine), and why this is NOT run-eligible yet

**This is the real structural fix, not the field renames.**

Both `inspection_qals` and `inspection_qave` are replicated with **only `AEDATTM`** — they lack the
`AERUNID`/`AERECNO` CDC sequencing metadata (same gap class as MCHB/AFVV/zmanpex/zpexpm). The legacy
configs confirm current-state ingestion: `read_mode: incremental`, `effective_column: AEDATTM`,
`write_mode: merge`.

So the corrected SCD1 **must sequence on AEDATTM** (current-state / MCHB pattern). The existing
`apply_changes(sequence_by=struct(_replicated_at, _run_id, _record_seq))` **cannot stand** —
`_run_id`/`_record_seq` are AERUNID/AERECNO, which don't exist on QALS/QAVE. Corrected spine:

```
dlt.apply_changes(
    target="quality_inspection_lot",
    source="stg_quality_inspection_lot",
    keys=["inspection_lot_number"],
    sequence_by=F.col("_replicated_at"),   # AEDATTM only — no AERUNID/AERECNO on QALS
    stored_as_scd_type=1,
)
```
(Equivalently a snapshot MV keyed by lot — full recompute, self-correcting, also valid.)

### ⚠ Run-eligibility hold — do not flip the guard

The flow is currently source-guarded by
`bronze_columns_exist("inspection_qals", ["AERUNID","AERECNO"])`, which is **always false** → the flow
is not defined → `silver_quality` COMPLETES instead of failing analysis.

A faithful AEDATTM model makes that guard condition the *wrong* test, and removing/relaxing it makes
the flow **run-eligible**. Under the standing constraint *"we don't run anything until the plant gate
is in,"* **this work must NOT flip the guard on.** The corrected code carries:
- the AEDATTM-sequenced design, and
- `apply_plant_gate(df, "plant_code", "quality", spark=spark)` on the lot output,

but stays **not run-eligible** until the **quality plant gate** is verified in. Materialising
`quality_inspection_lot` all-plants by accident is exactly what the hold prevents. The guard flips to a
real condition (presence of `AEDATTM` + plant gate present) only as a deliberate, separately-approved
step.

## 7. Downstream + grain scope — result grain feeds SPC/Connected Quality (not io-reporting gold)

### Legacy gold (reference only)
`gold_inspection_activity` (lot × operation routing × counter), `gold_inspection_result`
(lot × operation × MIC), `gold_inspection_individual_result` (… × sample × individual result) read
`silver_inspection_lot` + the result tables — **none read usage decision off the lot**, confirming the
grain split.

### io-reporting gold needs none of the result grain — but SPC / Connected Quality DOES
The **only** quality KPI in **io-reporting** gold is `gold_plant_production_quality_summary` — **1 row
per plant**, quality rate = `yield / (yield + scrap)`, derived from **production volumes/scrap
(process-order confirmations)**, NOT from QM inspection results. No io-reporting gold module reads the
QM result tables.

**However, the result grain is the core of the SPC / Connected Quality product** (a separate serving
surface — `connected_plant_uat.gold`, not `gold_io_reporting`; see `apps/api/adapters/spc`,
`apps/api/adapters/quality`). The SPC chart adapter reads
`connected_plant_uat.gold.spc_quality_metric_subgroup_mv` and `ARRAY_AGG(value)`s **individual
measurements** into subgroups per material × plant × MIC × operation × batch. That MV (UAT, observed
2026-06-07) is **73.4M rows at individual-value grain, 138 plants (ALL — no plant gate), 4+ years
(2022-01-01 → 2026-04-16)**, carrying spec limits (usl/lsl/nominal/tolerance), valuation
(any_acceptance/any_rejection), and normality stats. It is fed by the **full result hierarchy**:
QALS (lot context) + QAMV (MIC spec) + QAMR (MIC result/valuation) + QASE/QASR (individual values).

### The replicated QM result family (live DEV, AEDATTM-only, no WERK)
| Table | Grain | Cols | Plant? | Keys |
|---|---|---|---|---|
| `inspection_qals` | lot | 266 | WERK | PRUEFLOS |
| `inspection_qave` | usage decision (1:many/lot) | 26 | VWERKS | PRUEFLOS+KZART+ZAEHLER |
| `inspection_qamv` | MIC *master/spec* (lot×op×MIC) | 140 | — | PRUEFLOS+MERKNR |
| `inspection_qamr` | MIC *result* (lot×op×MIC) | 86 | — | PRUEFLOS+MERKNR |
| `inspection_qase` | sample result (…×sample) | 56 | — | PRUEFLOS+MERKNR+PROBENR |
| `inspection_qasr` | **individual values (…×sample×value)** | 82 | — | PRUEFLOS+MERKNR+PROBENR |

`inspection_qasr` (individual values) is the deep grain — **the ~350M-row table**. All result tables
lack `WERK`: plant lives only on the parent QALS lot.

### Scope — RESOLVED: Connected Quality is part of io-reporting; result grain is in scope
**Connected Quality is part of io-reporting** (one data product). The UAT
`connected_plant_uat.gold.spc_*` objects are **legacy prototyping on top of the gold layer that became
fragmented** — they are a *functional reference only* (like the IDP notebooks), **not** a target
architecture, and **will be removed once io-reporting reaches UAT**. So:

- The QM **result-grain silver** (QAMV spec, QAMR result, QASE/QASR individual values) belongs in
  **io-reporting silver** — it is in scope.
- A **governed SPC subgroup gold MV** belongs in **`gold_io_reporting`**, replacing the fragmented
  `connected_plant_uat.gold.spc_quality_metric_subgroup_mv`. Its 35-column shape (observed in UAT) is
  the functional target to reproduce cleanly, not the implementation to keep.
- The SPC/CQ API adapters (`apps/api/adapters/spc`, `.../quality`) currently resolve to
  `SPC_CATALOG/SPC_SCHEMA` = `connected_plant_uat.gold`; they re-point to the governed io-reporting
  serving once it lands.

(io-reporting's own `gold_plant_production_quality_summary` still needs none of the result grain — it is
plant-level yield/scrap from production. The result hierarchy exists for the SPC/CQ surface.)

"Massive and slow" is therefore not a grain to remove — it is an **ungated, all-138-plant, full-history
producer**. The SPC subgroup MV materialises every plant over 4+ years at individual-value grain (73.4M
rows). Levers, in order of impact:

1. **Plant gate.** 138 plants → active **quality** plants only — the dominant cut (same mechanism as the
   ~96.7% process-order reduction). The result tables have **no `WERK`**, so gate by a **`PRUEFLOS`
   semi-join to the gated lot set** (the `apply_warehouse_gate` gate-via-parent pattern), applied at the
   source read *before* the explode, so the scan is filtered to active-plant lots up front.
2. **Incremental, not full recompute.** AEDATTM-streaming so each run processes only new/changed
   measurements — a snapshot full-recompute of 73M+ every run is the slow path.
3. **Subgroup pre-aggregation at gold** (already the MV's shape): per-subgroup `batch_n`, `sum_value`,
   `sum_squares`, `batch_range`, `min/max` are pre-computed so the chart query aggregates cheaply; the
   individual `value` array is kept only for the in-window chart slice.
4. **History/retention window.** 4+ years at individual grain is the bulk; if SPC baselining needs only
   a rolling window hot, partition/retain accordingly (functional call — control-limit baselines may
   need long history, so confirm before trimming).
5. **Shallowest sufficient grain per consumer** — MIC-level `inspection_qamr` where individual values
   (`inspection_qasr`) are not needed for that chart type.

(io-reporting's lot + UD tables remain small; this performance section is about the SPC/CQ result-grain
producer.)

## 8. Result-grain silver + governed SPC gold (Connected Quality)

Field mappings below are from the legacy result-table configs (`silver_qamv/qamr/qasr/qase.csv`),
cross-checked against live DD03L / `information_schema`. All four are AEDATTM-only (no AERUNID/AERECNO),
keyed off the inspection lot, and carry **no `WERK`** — plant comes via the parent QALS lot. As with the
lot, model the **curated SPC-relevant subset**, not the 86/82/140/56 raw columns (most are
KATALGART/CODE/VERSION/`*NI` passthrough).

### 8a. `quality_inspection_characteristic` — the MIC spec (QAMV, PK PRUEFLOS+VORGLFNR+MERKNR)
Supplies SPC spec limits and characteristic metadata.

| Business column | QAMV field | Notes |
|---|---|---|
| `inspection_lot_number` / `operation_id` / `mic_id` | PRUEFLOS / VORGLFNR / MERKNR | `operation_id` = VORGLFNR (inspection-operation routing line, **not** an SAP work centre). |
| `nominal_target` | **SOLLWERT** | → SPC `nominal_target`. |
| `usl_spec` | **TOLERANZOB** | upper tolerance → SPC `usl_spec`. |
| `lsl_spec` | **TOLERANZUN** | lower tolerance → SPC `lsl_spec`. |
| `mic_name` | KURZTEXT | → SPC `mic_name`. |
| `inspection_method` | PMETHODE | → SPC `inspection_method`. |
| `uom` | MASSEINHSW | unit of the measured value. |
| `mic_code` / `mic_version` | VERWMERKM / MKVERSION | master-characteristic code; basis for `unified_mic_key`. |
| `characteristic_type` | KZEINSTELL | quantitative vs qualitative. |
| `spc_criterion` | **SPCKRIT** | SPC indicator — natural filter for *which* MICs need the subgroup MV (perf, §9). |
| `decimal_places` | STELLEN | display precision. |

> `QMTB_WERKS`/`QPMK_WERKS` on QAMV are method/MIC plants — **do not** use as `plant_id`; they can
> differ from the lot's plant. `plant_id` and the plant gate come from `QALS.WERK` (§3, §8e).

### 8b. `quality_inspection_result` — MIC-level result (QAMR, PK PRUEFLOS+VORGLFNR+MERKNR)
| Business column | QAMR field | Notes |
|---|---|---|
| keys | PRUEFLOS / VORGLFNR / MERKNR | |
| `quantitative_result` | MITTELWERT | MIC mean value. |
| `qualitative_result` | CODE1 | catalog code for qualitative MICs. |
| `inspection_result_valuation` | **MBEWERTG** | accept/reject at result level → SPC `any_acceptance`/`any_rejection`. |
| `number_of_defects_found` | ANZFEHLER | |
| `inspection_start_date` / `_end_date` | PRUEFDATUV / PRUEFDATUB | **result-recording** dates (distinct from the lot's planned PASTRTERM/PAENDTERM, §3). |
| `inspector` | PRUEFER | |
| min/max/median/variance | MINWERT/MAXWERT/MEDIANWERT/VARIANZ | summary stats (optional). |

### 8c. `quality_inspection_sample_result` (QASR, +PROBENR) & 8d. `quality_inspection_individual_result` (QASE, +DETAILERG)
Same column shape as QAMR plus the deeper key. The distinction (corrects an earlier inversion):

| Silver table | Source | Deepest key | Value column | Meaning |
|---|---|---|---|---|
| `quality_inspection_sample_result` | **QASR** | PROBENR (sample) | MITTELWERT → `quantitative_result` | per-**sample aggregate** (mean). |
| `quality_inspection_individual_result` | **QASE** | DETAILERG (individual) | **MESSWERT** → `quantitative_result` | the **raw individual reading**. |

Both carry `MBEWERTG` (valuation) and `CODE1` (qualitative). Legacy gold composes them down the grain:
`result (QAMR) ⟕ sample (QASR) ⟕ individual (QASE)` with
`RESULT = coalesce(nullif(QUALITATIVE_RESULT,''), QUANTITATIVE_RESULT)`.

### 8e. Governed SPC subgroup gold MV (`gold_io_reporting`, replaces `connected_plant_uat.gold.spc_quality_metric_subgroup_mv`)
**Reconstructed provenance, not verified lineage** — the UAT MV's producer is the fragmented prototype
being discarded; the mapping below is inferred from the MV's 35 columns + the legacy CSV semantics, to
be reproduced cleanly. Grain: material × plant × MIC × operation × batch (subgroup).

| MV column(s) | Source |
|---|---|
| `material_id`, `plant_id`, `batch_id`, `batch_date`, `first/last_posting_date` | QALS lot (MATNR, **WERK**, CHARG, dates). `plant_id ← QALS.WERK`. |
| `mic_id`, `mic_name`, `operation_id`, `inspection_method`, `unified_mic_key` | QAMV (MERKNR, KURZTEXT, VORGLFNR, PMETHODE, VERWMERKM). |
| `usl_spec`, `lsl_spec`, `nominal_target`, `tolerance_half_width`, `raw_tolerance`, `spec_type`, `spec_signature` | QAMV (TOLERANZOB / TOLERANZUN / SOLLWERT, derived). |
| `value` (→ `individual_values` array) | **per-subgroup readings** — most likely **QASE.MESSWERT** (individual) or **QASR.MITTELWERT** (sample mean). ⚠ The MV averages **2.84 values/subgroup** (73.4M/25.9M), low for raw readings — possibly sample means (X-bar/R), not individuals (I-MR). **Confirm by sampling the UAT MV (read-only, within hold) at implementation.** |
| `batch_n`, `sum_value`, `sum_squares`, `batch_range`, `min_value`, `max_value` | subgroup aggregates over `value`. |
| `any_acceptance`, `any_rejection` | from MBEWERTG valuation across the subgroup. |
| `normality_type/method/signature`, `spec_signature`, `subgroup_rep` | **computed at gold** (not source fields). |

Spec-limit sentinel: `lsl_spec=0.0 AND usl_spec=0.0` together = limits never populated → map both to null
(the SPC adapter already does this; preserve it in the governed MV).

## 9. Performance — the QM tables are massive; the corrected model is also the fast model

The imported transform is slow on a large QALS for reasons that the corrected pure-QALS model
*removes*, not merely mitigates. Levers, in order of impact:

1. **Plant gate on `WERK`, applied at the source read** — the dominant reduction, identical mechanism
   to process orders (~96.7% row cut to the active plant set). Apply `apply_plant_gate(df, "plant_code",
   "quality", spark=spark)` (or on `WERK` pre-rename) **before** any projection/join, so the rest of the
   flow only ever sees in-scope lots. (This is also the run-eligibility gate — see §6.)
2. **Eliminate the full-table self-join.** The imported code streams QALS for changed keys, then
   re-reads the **entire 266-column QALS table** (`spark.read.table` → `select("l.*")`) and joins back
   to enrich — re-scanning the whole table every micro-batch. The AEDATTM-sequenced model streams QALS
   **once** with the needed columns and lets `apply_changes` (keys=`inspection_lot_number`,
   `sequence_by=AEDATTM`) do the upsert. The self-join is gone.
3. **Drop the qmih join.** `order_number` = `QALS.AUFNR` directly (§5), so the 1:many join to
   `qualitymessage_qmih` is removed entirely. Pure QALS = no join. (QMNUM enrichment, if ever wanted,
   is a separate deliberate 1:many concern — not in the hot path.)
4. **Projection pushdown.** Select only the curated ~20 business columns at the stream read; do not
   carry all 266 raw columns (incl. every `STATxx` passthrough) through the flow.
5. **Liquid clustering** `cluster_by=["plant_code", "inspection_start_date"]` (already set) for fast
   downstream/range reads.

**Streaming SCD1 vs snapshot MV trade-off:** streaming `apply_changes` sequenced by AEDATTM processes
only new/changed micro-batches → cheapest steady-state on a massive table. A snapshot MV full-recomputes
each run (expensive at this size) but self-corrects after a plant-gate change without a manual full
refresh. With streaming SCD1, **gating an already-materialised all-plant table requires a one-time FULL
REFRESH** (apply_changes upserts changed keys but never retro-purges keys the now-filtered stream
omits) — relevant only once run-eligible. Default to streaming SCD1; the gate makes the first
materialisation small from the start, so the full-refresh caveat only bites if it ever ran ungated.

The same applies to `quality_inspection_usage_decision` (QAVE): plant gate on `VWERKS`, project the
curated columns, stream once, `apply_changes` keyed PRUEFLOS+KZART+ZAEHLER sequenced by AEDATTM.

**Run-eligibility hold extends to the result family.** The result-grain tables (§8) and the governed SPC
gold MV (§8e) are subject to the same hold as the lot (§6): they carry the AEDATTM design and the
`PRUEFLOS` semi-join plant gate, but must **not** become run-eligible until the **quality plant gate** is
verified in — so the result-grain producer can never materialise all-138-plants by accident either.

## 10. Open items (do not block the model; confirm when run-eligible)

- **`value` source for the SPC MV** (§8e): QASE individual reading (`MESSWERT`) vs QASR sample mean
  (`MITTELWERT`) — determines I-MR vs X-bar/R. Confirm by sampling the UAT MV (read-only).
- **SPCKRIT filter** (§8a): whether the SPC subgroup MV should include only MICs flagged
  `spc_criterion` — a correctness *and* volume question.
- **History/retention window** (§9): 4+ years at result grain; confirm SPC baselining needs before
  trimming hot history.
- ~~VBEWERTUNG value domain (A/R)~~ — RESOLVED 2026-06-11: confirmed A/R/blank from UAT data (§4).
- Whether to retain qmih for QMNUM enrichment (§5) — deliberate call, model as 1:many if kept.
