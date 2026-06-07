# silver_fast SAP field reconciliation

Date: 2026-06-07 · Author: SAP WM/MM + Databricks engineering · Status: **BLOCKED — pending confirmation**

`silver_fast` fails analysis: 4 Warehouse360-critical staging flows reference SAP columns absent from
the replicated DEV/UAT schemas. This document reconciles each missing field against the available
evidence and records a decision. **No transformation code is changed** — see "Evidence limitation".

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

## Per-field reconciliation

### 1. `stg_warehouse_transfer_order` ← `transferorderobjects_ltap` (LTAP, 165 cols replicated)

| Code field | Aliased to (business meaning) | DDIC (DD03L) | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `ANFME` | `requested_quantity` (TO source target qty) | unavailable | **absent**; not a standard LTAP field. LTAP source/dest quantity pairs present: `VSOLA`/`VSOLM`, `NSOLA`/`NSOLM`, `VISTA`/`VISTM`, `NISTA`/`NISTM`, diffs `VDIF*`/`NDIF*` | `VSOLM` (qty in base UoM) / `VSOLA` (qty in alt UoM) | **functional/DDIC confirmation required** | wrong qty field → corrupt backlog/staging quantities |
| `ENMNG` | `confirmed_quantity` | unavailable | absent; not standard LTAP | `VISTM`? (overlaps `actual_quantity_picked`) | **functional confirmation required** | `confirmed_quantity` and `actual_quantity_picked` collapse onto ONE real field (`VISTM`) — a functional owner must define what these 3 columns mean |
| `ISPOS` | `actual_quantity_picked` | unavailable | absent; not standard LTAP | `VISTM` (actual qty in base UoM); pick-confirm flag is `PQUIT`/`PVQUI` (present, already used) | **functional confirmation required** | as above |

Note: status (`PQUIT`/`KQUIT`), locations (`VLTYP`/`VLPLA`/`NLTYP`/`NLPLA`), `MEINS`, `VBELN` are
present and already used. Cannot distinguish "real field, not replicated → request replication" from
"wrong field name → remap" without DD03L.

### 2. `stg_warehouse_transfer_requirement` ← `transferrequirementobjects_ltbp` (LTBP, 52 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `ENQTY` | `open_quantity` | unavailable | **absent**. Quantity fields present: `MENGE`, `MENGA` (+ `MEINS`) | `MENGE - MENGA` (derivation) or a single field | **functional confirmation required** | proposing a *derivation* from assumed field meanings is the least safe — do not invent |

### 3. `stg_goods_movement` ← `inventorymovement_mseg` (MSEG, 214 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `VBELN` | `delivery_number` | unavailable | **absent**. Present: `VBELN_IM`, `VBELP_IM` (delivery in IM), `LFBNR`/`LFBJA`/`LFPOS` (ref doc), `KDAUF` | `VBELN_IM` | **functional confirmation required** (high plausibility — `VBELN_IM` is the S/4 delivery-in-IM field) | wrong doc reference breaks delivery linkage |

### 4. `stg_batch_stock` ← `batchstock_mchb` (MCHB, 44 cols)

| Code field | Aliased to | DDIC | Replicated finding | Candidate | Decision | Risk |
|---|---|---|---|---|---|---|
| `MEINS` | `base_uom` | unavailable | **absent on MCHB** (MCHB carries stock buckets `CLABS`/`CINSM`/`CSPEM`…, not a unit). `materialmaster_mara.MEINS` **present** | join `material` (MARA) on `material_code` for `base_uom` | **PROVEN (structural)** — batch stock has no unit column by SAP design; base UoM is a material attribute. (Task-sanctioned.) **Held, not applied** — see below | low; structural |
| `AERUNID`, `AERECNO` | CDC sequencing (`_run_id`, `_record_seq` in `apply_changes sequence_by`) | n/a (Aecorsoft metadata) | **absent**; `RecordActivity` also absent; only `AEDATTM` present | rework `sequence_by` to `AEDATTM` only | **request CDC-enabled replication** (do NOT apply) | changing `sequence_by` from `(AEDATTM, AERUNID, AERECNO)` to `AEDATTM` alone breaks SCD1 determinism when two changes share a timestamp → wrong "latest" batch-stock row |

## Open questions (decision needed before any code change)

1. **MSEG — what reference is actually intended?** `delivery_number` (`VBELN`) must be disambiguated:
   is the downstream intent the **delivery reference**, the **material-document reference**, or the
   **goods-movement document reference**? `VBELN_IM` is a valid candidate **only if** the intended
   field is the *delivery* reference. If material-doc/goods-movement reference is intended, the field
   is `MBLNR`/`MJAHR`/`ZEILE` (the movement doc, already keyed) or `LFBNR`/`LFBJA`/`LFPOS` (reference
   doc), **not** `VBELN_IM`.

2. **LTAP — keep `confirmed_quantity` and `actual_quantity_picked` as separate contract fields?**
   Both plausibly map to the *same* real field (source actual, likely `VISTM`). The product/functional
   owner must decide whether to (a) keep two contract columns sourced from one field, (b) collapse to
   one, or (c) define a real semantic difference (and which field carries each).

3. **LTAP — destination-leg quantities.** The candidates above are *source-leg* (`VSOL*`/`VIST*`).
   Where **destination-side** quantities are required, the destination-leg fields are
   `NSOLM`/`NSOLA` (destination target, base/alt UoM) and `NISTM`/`NISTA` (destination actual). Add
   these as candidates if the contract needs put-away/destination quantities, not just source/pick.

4. **LTBP — `open_quantity = MENGE - MENGA` requires defined null/negative behaviour.** If this
   derivation is confirmed, the contract must explicitly define: behaviour when `MENGE` or `MENGA` is
   NULL (treat as 0? propagate NULL?), and whether a negative result (`MENGA > MENGE`, over-fulfilment)
   is clamped to 0 or preserved. **Do not implement this derivation until functionally approved.**

5. **MCHB — split the two issues.** `base_uom` ← `MARA.MEINS` is a **structural enrichment** that can
   be implemented **independently** (it is correct regardless of the CDC question). However,
   `AERUNID`/`AERECNO` remains the **deterministic-CDC blocker** for `stg_batch_stock` unless a
   snapshot / current-state design (with a defined ordering key) is approved. The MARA join alone does
   **not** unblock the flow.

6. **DLT failure mode — hard blocked, not degraded.** The blocked flows fail at **graph
   *analysis*/resolution** (`UNRESOLVED_COLUMN`), i.e. *before* any `@dlt.expect` runs — so they
   cannot be handled as expectation failures or quarantined to a `_quarantine` table (quarantine
   requires the flow to resolve and execute first). The current status is therefore **hard blocked**
   (the whole `silver_fast` update fails to start), **not degraded** and **not partially materialised**.

## Decisions summary

- **No transformation code changed** in this PR. No field is proven (semantics unavailable without
  DD03L), and the one structurally-proven fix (MCHB `base_uom` ← MARA) **does not unblock**
  `stg_batch_stock` on its own (its `AERUNID`/`AERECNO` CDC gap remains), so it is **held** to keep
  this a clean evidence-only deliverable and applied together with the CDC resolution.
- **`silver_fast` remains BLOCKED.** Gold not built; Warehouse360 stays 0/7; consumption views not
  deployed; validation pack not run; contracts remain candidate/pending. DEV shakedown only; gaps
  also block UAT (DEV = UAT).

## Recommended actions (data-team / functional owner)

1. Provide **DD03L** (field → data-element) for LTAP/LTBP/MSEG/MCHB, or a functional sign-off, to
   confirm: LTAP `requested/confirmed/picked` quantities (candidates `VSOLM`/`VISTM`); LTBP
   `open_quantity` (candidate `MENGE - MENGA`); MSEG `delivery_number` (candidate `VBELN_IM`).
2. **Enable CDC metadata** (`AERUNID`/`AERECNO`/`RecordActivity`) on the MCHB replication, or confirm
   `AEDATTM` is unique per change so it can serve as the sole sequencing key.
3. Once confirmed, apply the proven mappings (with this doc referenced), add the MARA join for MCHB
   `base_uom`, re-run `silver_fast`, and continue the shakedown.
