# SAP source decision — `stg_capacity_utilisation` / `capacity_utilisation`

Date: 2026-06-07 · Author: SAP PP/PI + Databricks engineering · Status: **Source-guarded (deferred)**

## Business meaning of the model

`capacity_utilisation` is intended to expose **work-centre available capacity** (shift/interval
available capacity, operating time, breaks, utilisation rate, normal/maximum capacity) per
capacity × period, joined to the work centre (`CRHD`/`KAKO.ARBPL`) and plant. In SAP PP/PP-PI this
is the *available-capacity* side of capacity planning (the load/requirements side is `KBED`).

## Fields originally expected by the transformation

`stg_capacity_utilisation` (silver/tables/reference.py) reads these from
`connected_plant_dev.sap.shiftparametersavailablecapacity_kapa` (alias `k`):

`DAFBI, DAFEI, PAUSA, BEGDA, ENDDA, KAPAZ, MEINH, OEFFZ, NORMA, RUEZT`

It also joins `capacityheadersegment_kako` (`KAPID, MANDT, ARBPL, WERKS, KAPAR`).

## DDIC findings

DDIC tables (`DD03L`/`DD04L`/`DD01L`) are **not replicated** in any catalog accessible to the DEV
executing principal (`connected_plant_dev`, `published_dev`, `system`, …; `bods_catalog` is access-
denied). Per the investigation constraints (no LeanX/public docs as source of truth), field
existence is therefore evidenced from the **replicated DDIC-equivalent ground truth**
(`information_schema.columns`) of the actual SAP tables in `connected_plant_dev.sap`. This is a
documented evidence limitation, not a field assertion from external docs.

## Replicated-schema findings (information_schema.columns, connected_plant_dev.sap — confirmed live 2026-06-07)

Of the 10 fields the code expects from `shiftparametersavailablecapacity_kapa`, **only `KAPAZ` is
present**. The other 9 (`DAFBI, DAFEI, PAUSA, BEGDA, ENDDA, MEINH, OEFFZ, NORMA, RUEZT`) are
**absent from both DEV and UAT** replicated `shiftparametersavailablecapacity_kapa`.

Actual replicated capacity columns:

| Table | Replicated columns (capacity-relevant) |
|---|---|
| `shiftparametersavailablecapacity_kapa` | `MANDT, KAPID, VERSN, DATUB, TAGNR, SCHNR, ANZHL, BEGZT, EINZT, ENDZT, FABTG, KAPAZ, PAUSE, NGRAD, TPROG, WOTAG, ANG_MIN, ANG_MAX, AEDATTM` |
| `capacityheadersegment_kako` | `MANDT, KAPID, AZMAX, AZNOR, BEGZT, ENDZT, KALID, KAPAR, MEINS, NGRAD, PAUSE, WERKS, KAPIE, KAPEH, ANG_MIN, ANG_MAX, …` (77 cols) |

So the expected field names do **not** match the replicated SAP. The closest real fields are
**candidates only** (NOT applied — a data-team/functional confirmation):

| Expected (absent) | Likely real field | Where |
|---|---|---|
| `PAUSA` (break) | `PAUSE` | KAPA & KAKO |
| `MEINH` (unit) | `MEINS` (capacity unit) | KAKO |
| `NORMA` (normal capacity) | `AZNOR` (normal available capacity) | KAKO |
| `OEFFZ` (operating time) | derive from `BEGZT`/`ENDZT`/`PAUSE` | KAPA/KAKO |
| `KAPAZ` (capacity) | `KAPAZ` ✅ present | KAPA |
| `DAFBI`/`DAFEI`/`BEGDA`/`ENDDA` (validity dates) | no replicated home (validity is via `KALID` calendar / `CRCA` assignment, not replicated) | — |
| `RUEZT` (setup time reduction) | no replicated home | — |

## Functional capacity source path (PP/PP-PI)

- `CRHD` (work-centre header) — **not replicated** (also gates `work_centre`; see source-schema preflight).
- `CRCA` (work-centre ↔ capacity assignment) — **not replicated**.
- `KAKO` (capacity header: available-capacity parameters) — **replicated** (77 cols).
- `KAPA` (shift/interval available capacity) — **replicated** but reduced (no validity-date or
  operating-time fields the code expects; has shift/day intervals instead).
- `KBED`/`KBEZ` (capacity *requirements*/load) — **not replicated** (would be needed if the model is
  about planned load rather than available capacity).
- `AFVC`/`AFVV`/`AFRU` (operation master/values/confirmations) — `AFVC`/`AFVV` are replicated (used by
  process-order staging), `AFRU` not; these are operation-execution, not work-centre capacity.

## Does Warehouse360 depend on it?

**No.** `capacity_utilisation` has **no downstream pipeline consumers** (referenced only in
`silver/design_spec.md`) and is **not** one of the 7 Warehouse360 governed source objects, nor a
feeder of any of them. It is optional/non-critical to the Warehouse360 DEV shakedown.

## Recommendation / action

1. **Keep `stg_capacity_utilisation` source-guarded** (implemented via `bronze_columns_exist(...)` —
   the model is only defined when the required KAPA columns exist). It is correctly **not
   materialised** in DEV today. **No fabricated fields, no remapping applied.**
2. The model's expected field contract is **incorrect against the replicated SAP** and would need a
   functional redesign to source available capacity from **`KAKO`** (header: `BEGZT/ENDZT/PAUSE/
   NGRAD/AZNOR/AZMAX/MEINS/KAPAR`) + **`KAPA`** (shift intervals), with validity from the factory
   calendar (`KALID`) — and, if "utilisation" means load vs available, the load side from `KBED`
   (not replicated). This is **deferred**; it is not a Warehouse360 blocker.
3. Same gap applies to **UAT** (the expected fields are absent in `connected_plant_uat.sap` too), so
   this is a source-contract gap, not a DEV-only issue. Tracked in `sap_unresolved_sources.yml`.
4. Do **not** block the Warehouse360 DEV shakedown on this model.
