# Mass Balance Source Mapping — gold_batch_mass_balance_v

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Status:** First live slice wired — 11 columns verified; 2 correctness gaps documented (TRACE-P1-010 + TRACE-P1-011)

---

## Purpose

Records the live source for `POST /api/trace2/mass-balance` and the known
correctness gaps surfaced by live data inspection on 2026-05-20.

---

## Source

`connected_plant_uat.gold.gold_batch_mass_balance_v` — Databricks gold view over
`gold_inventory_movement` (row count: ~154 million as of 2026-05-20).

Keyed on `MATERIAL_ID + BATCH_ID` (no plant filter — a batch's full movement
history is required for a faithful mass balance).

---

## Column inventory (DESCRIBE TABLE 2026-05-20)

11 columns:

| Column | Type | Used in V2 SQL | Notes |
|---|---|---|---|
| `MATERIAL_ID` | string | WHERE key | Confirmed |
| `BATCH_ID` | string | WHERE key | Confirmed |
| `PLANT_ID` | string | Not selected | Available; not filtered |
| `MOVEMENT_TYPE` | string | `movement_type` | SAP MM movement type (101, 261, 601, 641, etc.) |
| `QUANTITY` | decimal(13,3) | Not selected | Signed quantity; ABS_QUANTITY used instead |
| `UOM` | string | `uom` | Confirmed |
| `PROCESS_ORDER_ID` | string | Not selected | Available — could surface as movement reference |
| `POSTING_DATE` | date | `posting_date` | Confirmed; used for ORDER BY |
| `ABS_QUANTITY` | decimal(13,3) | `abs_quantity` | Confirmed |
| `BALANCE_QTY` | decimal(13,3) | `balance_qty` | Confirmed column. See TRACE-P1-011 — live values are always 0.000 for the UAT candidate. |
| `MOVEMENT_CATEGORY` | string | `movement_category` | Confirmed; values described below |

---

## Observed `MOVEMENT_CATEGORY` values

Top 20 by frequency from live data (`connected_plant_uat.gold.gold_batch_mass_balance_v`):

| MOVEMENT_CATEGORY | Approx count | In `_MOVEMENT_CATEGORY_MAP`? | Currently mapped to |
|---|---|---|---|
| `Other (261)` | 65,391,459 | ❌ | adjustment |
| `STO Transfer` | 15,005,495 | ❌ | adjustment |
| `Production` | 13,657,021 | ✅ | production |
| `STO Receipt` | 11,912,997 | ❌ | adjustment |
| `Other (Z01)` | 10,346,164 | ❌ | adjustment |
| `Other (Z61)` | 8,129,937 | ❌ | adjustment |
| `Other (321)` | 7,040,890 | ❌ | adjustment |
| `Shipment` | 6,452,963 | ✅ | shipment |
| `Other (Z62)` | 4,111,642 | ❌ | adjustment |
| `Other (311)` | 1,547,028 | ❌ | adjustment |
| `Other (262)` | 1,525,848 | ❌ | adjustment |
| `Other (711)` | 893,404 | ❌ | adjustment |
| `Other (341)` | 650,174 | ❌ | adjustment |
| `Other (681)` | 592,012 | ❌ | adjustment |
| `Other (343)` | 464,314 | ❌ | adjustment |
| `Other (344)` | 431,076 | ❌ | adjustment |
| `Write-Off` | 378,927 | ❌ | adjustment |
| `Other (Z12)` | 353,595 | ❌ | adjustment |
| `Other (201)` | 344,384 | ❌ | adjustment |
| `Other (342)` | 342,290 | ❌ | adjustment |

**Implication:** Only `Production` and `Shipment` are currently mapped. All
other live SAP categories fall through to `adjustment`. STO Receipt is an
incoming movement that the current mapper directionally treats as output —
this is documented as a defect (TRACE-P1-010) rather than fixed in this slice.

The mapper now counts unmapped categories under `unresolvedMovements` so the
panel's existing amber warning banner reflects the true completeness of the
balance. A panel disclaimer further warns the user that category mapping is
incomplete.

---

## Live spot check — UAT candidate 20035129 / 8000049668 / C061

10 sample rows from the candidate batch's mass balance history:

| POSTING_DATE | MOVEMENT_TYPE | MOVEMENT_CATEGORY | ABS_QUANTITY | UOM | BALANCE_QTY | PROCESS_ORDER_ID |
|---|---|---|---|---|---|---|
| 2025-06-04 | 101 | STO Receipt | 10065.000 | KG | 0.000 | (empty) |
| 2025-06-11 | 641 | STO Transfer | 630.000 | KG | 0.000 | (empty) |
| 2025-06-11 | 101 | STO Receipt | 630.000 | KG | 0.000 | (empty) |
| 2025-06-16 | 261 | Other (261) | 6.262 | KG | 0.000 | 007006705271 |
| 2025-06-16 | 261 | Other (261) | 4.747 | KG | 0.000 | 007006729709 |
| 2025-06-16 | 261 | Other (261) | 6.262 | KG | 0.000 | 007006705271 |
| 2025-06-16 | 321 | Other (321) | 150.000 | KG | 0.000 | (empty) |
| 2025-06-16 | 261 | Other (261) | 3.045 | KG | 0.000 | 007006724574 |
| 2025-06-16 | 101 | STO Receipt | 150.000 | KG | 0.000 | (empty) |
| 2025-06-16 | 261 | Other (261) | 0.938 | KG | 0.000 | 007006705271 |

Observations:
- All 10 BALANCE_QTY values are `0.000` — see TRACE-P1-011.
- No row matches the existing `_MOVEMENT_CATEGORY_MAP` (which has uppercase keys
  PRODUCTION/SHIPMENT/CONSUMPTION/ADJUSTMENT); however `Production` and
  `Shipment` would match if they appeared because the lookup uppercases input.
  Live values for this batch happen to be only STO Receipt / STO Transfer /
  Other (NNN) — none currently mapped.

---

## Decisions

1. **Query columns are verified, route is live.** Removed TODO comments from
   `get_mass_balance_spec()` SQL.
2. **Category mapping is not fixed in this slice.** Fixing it requires either
   a verified SAP movement-type-to-direction map or an explicit business
   review of which categories count as input vs output vs ignored. That work
   is captured as TRACE-P1-010 with concrete live evidence.
3. **`runningBalance` semantics are not fixed in this slice.** BALANCE_QTY may
   not be a per-batch running tally; the data platform team needs to clarify
   what this column represents. Captured as TRACE-P1-011.
4. **Conservative UX.** The panel shows the data with a dashed disclaimer that
   category mapping is incomplete and the variance figure is not a verified
   mass-balance result. Unresolved-movement count is surfaced amber when > 0.

---

## Source decision summary

> V2 `POST /api/trace2/mass-balance` queries `gold_batch_mass_balance_v` keyed
> on MATERIAL_ID + BATCH_ID with no plant filter. 11 columns confirmed live
> 2026-05-20. Category mapping and BALANCE_QTY semantics have documented
> correctness gaps (TRACE-P1-010, TRACE-P1-011); the panel surfaces both to
> investigators rather than masking them with an aggregate.
