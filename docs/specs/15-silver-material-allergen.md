# Spec 15 — Silver `material_allergen` table (silver-only build)

Read `docs/specs/_conventions.md` first. Branch: `feature/silver-material-allergen`.

## Scope (read this twice)

**Build ONLY the silver table.** Do NOT wire it into any gold aggregate, contract manifest,
OKF bundle, serving/security SQL, or the app. No `app_contract_manifest.yml` change, no
`make generate-okf`, no consumption views. The deliverable is: one new silver DLT table +
its PySpark tests + pipeline registration + a silver `design_spec.md` catalogue entry.
Surfacing it downstream is a separate, later spec.

(Because no governed contract / governed surface is touched, the OKF mandate in
conventions §8 does **not** apply to this PR. Confirm you changed none of those files.)

## Objective

Materialise allergen data as a silver reference map. Allergen is a SAP **classification**
attribute (class type 001, characteristic "Allergens", ATINN `0000000849`) — there is **no**
allergen column on the material master (MARA/MARC). It is needed downstream for storage
segregation and as an allergen-changeover/cleaning signal in scheduling, but this spec stops
at the silver table.

## Source (verified)

Classification tables live in the **published** source (`bronze_published()` →
`central_services`), NOT in `connected_plant_uat.sap`. The exact working idiom is
`silver/tables/reference.py` `recipe_process_line` (~L666–727) — **read it for the live
bronze table names and the strip/trim helpers** (`objectcharacteristics_ausp`,
`characteristicvaluedescription_cawnt`, `strip_zeros`, `bronze_published`).

Recon evidence (UAT, 2026-06-12): AUSP `KLART='001'`, `ATINN='0000000849'` → ~540,937
allergen records across ~268,532 materials (25.7% of 1.04M). Allergen names are human
strings: "WHEAT", "BARLEY", "GLUTEN_ANZ", "MUSTARD SEEDS / DERIVAT", …

## Design

New `@dlt.table(name="material_allergen")` in `silver/tables/reference.py`, alongside
`recipe_process_line`. **Grain: one row per `material_code` × allergen value** (a material
has many allergens — do NOT collapse to one like `recipe_process_line` does; keep all rows).

Key differences from the `recipe_process_line` template:

1. **No INOB hop.** For material classification (`KLART='001'`) the classified object is the
   material itself, so `AUSP.OBJEK` is the (zero-padded) MATNR directly →
   `strip_zeros(OBJEK).alias("material_code")`. (INOB is only needed for object classes
   whose key differs from OBJEK, e.g. the 018/PLKO recipe class.) Verify this against the
   data shape in your report; if `OBJEK` is unexpectedly a CUOBJ for 001, fall back to the
   INOB pattern and say so.
2. **Characteristic selection.** Filter `AUSP` to `KLART='001'` and the allergen
   characteristic. Define the constant `ALLERGEN_ATINN = "0000000849"` in
   `silver/helpers.py` (where `PROCESS_LINE_ATINN` lives — `helpers.py:137`) and import it into
   `reference.py`, exactly mirroring the `PROCESS_LINE_ATINN` convention (do NOT hardcode it in
   the table file). Filter `ATINN == ALLERGEN_ATINN`.
   **Robustness:** ATINN is an internal counter and could differ by environment — in your
   report, confirm `0000000849` resolves to the "Allergens" characteristic via the
   characteristic master (CABN `ATNAM` / CABNT description); if a clean name-based lookup is
   cheap, prefer deriving ATINN from the master over hardcoding (leave the constant as the
   override/default).
3. **Keep all values.** Join `CAWNT` (`SPRAS='E'`) on `ATINN`+`ATZHL` for the English value
   text. Project, do **not** `groupBy`-collapse:
   - `material_code` (strip_zeros OBJEK) — natural key part
   - `material_code_raw` (raw OBJEK) — keep, per repo convention for material keys
   - `allergen_value` (`AUSP.ATWRT` — the characteristic value key)
   - `allergen_name` (`CAWNT.ATWTB` — English description; may be NULL if no CAWNT row)
   - `allergen_atinn` (`ATINN`), `allergen_value_counter` (`ATZHL`) — to keep the grain
     unique and traceable
   Dedup defensively on (`material_code`, `allergen_atinn`, `allergen_value_counter`) if AUSP
   can carry dup rows; document whichever you choose.

4. **Ungated, slow tier.** This is estate-wide reference data with no plant dimension (AUSP
   material classification has no WERKS) — **do NOT apply a plant gate** (same as
   `recipe_process_line` / `material_uom_conversion`). It belongs in the **slow/reference**
   silver tier; register it so `dlt_silver_slow.py` picks it up (follow exactly how
   `recipe_process_line` is registered — same module, same import path; confirm it appears in
   the slow entrypoint's table set).

Table comment must state: source (AUSP KLART=001 / ATINN 0000000849 / CAWNT EN), grain
(material × allergen value), that it is a classification-derived map (not material master),
ungated/estate-wide, and the 25.7%-coverage reality (materials without allergen
classification simply have no rows — downstream joins must be LEFT and treat absence as
"no recorded allergen", NOT "allergen-free").

## Gotchas

- **Coverage ≠ allergen-free.** No row for a material means *unclassified*, not *no
  allergens*. Bake this caveat into the table comment so future gold work joins LEFT and
  doesn't misread silence as safety.
- **Verify column names against bronze**, not this spec (conventions §1) — read
  `recipe_process_line` for the real AUSP/CAWNT field aliases; ATWRT/ATWTB/ATZHL/ATINN/OBJEK
  are the SAP fields but confirm them in the existing working code.
- **`table_exists` / `bronze_columns_exist` guard** if the classification source may be
  absent in dev (the recipe table reads published central_services; mirror its guarding —
  if `recipe_process_line` runs unguarded in dev, match it; if it's guarded, match that).
- Don't add a plant gate. Don't add it to the fast or quality tier.

## Acceptance

- A fixture material with two allergen values yields exactly two rows, both with the right
  `material_code` (zero-stripped) and English `allergen_name`; a material with no
  classification yields zero rows. PySpark fixture tests (CI-only; write them, no vacuous
  assertions) covering: multi-allergen material, zero-padding strip, missing-CAWNT →
  NULL name (row still present), grain uniqueness.
- `material_allergen` appears in the slow silver pipeline's registered tables and in
  `silver/design_spec.md`'s table catalogue (silver-internal doc — allowed and expected;
  this is part of building the table, not downstream surfacing). When documenting the schema,
  the dev environment schema is **`silver_io_reporting`** (the active dev schema), NOT the
  retired `silver_dev` — match the catalogue's existing convention.
- Offline suite green: `py_compile`, `ruff`, plus the silver helper tests still pass. (No
  gold/contract/OKF/adapter checks apply — you changed none of those.)

## Deliverables / post-merge

Branch + commits + report with column-verification evidence (file:line for every AUSP/CAWNT
field, cross-referenced to `recipe_process_line`), the ATINN-resolution confirmation, the
INOB-not-needed confirmation, validation output, and SHA. Post-merge the orchestrator runs
the slow/reference pipeline to materialise it and spot-checks row counts (~540k rows /
~268k materials) — note that in your report. Nothing else is wired; this table is dormant
until a follow-on spec consumes it.
