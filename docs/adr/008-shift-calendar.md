# ADR 008 — Shift calendar & shift-grain Gold

## Status
Proposed

## Context
`gold_shift_output_summary` is named for shifts but has **no shift dimension** — it is
plant × posting_date × material. The business needs shift-level output, efficiency/OEE and
downtime, and PP-PI confirmations analysed by shift.

**Source reality (verified in `connected_plant_uat.sap`):** there is **no SAP shift-definition
master** replicated — no `TC37A`/`TC37` (shift definitions / sequences). The only shift-ish
source is `kapa`/`kako` (capacity shift parameters), already partly ingested as
`silver.capacity_utilisation`. But capacity shifts are **work-centre-grain** and represent
*available capacity*, not the plant's *operational shift calendar* (start/end clock times,
night flag, cross-midnight handling) that movements/confirmations must be bucketed into.

## Decision
1. **`silver.shift_calendar` is a repo-owned, config-seeded reference table** (not derived from
   KAPA). Columns: `plant_code, shift_id, shift_name, start_time, end_time, is_night_shift,
   work_center_group?, valid_from, valid_to`. **SCD2** via `valid_from`/`valid_to` so historical
   pattern changes are preserved.
   - Population: per-plant config via **external Excel → Bronze** (a `zshift_calendar`-style
     bronze table) or a code-seeded table (like `movement_type_classification`). Ship a
     **stub/seed** (empty or sample rows) + documented population step so the pipeline is
     functional now (working-draft approach).
   - If `TC37A`/`TC37` can be replicated later, swap the source behind the same Silver contract
     (see `docs/ingestion_requests.md`).
2. **`assign_shift(plant_code, posting_datetime)` helper** (broadcast join, not row UDF) maps a
   movement/confirmation to a `shift_id` by matching its time-of-day against the calendar's
   `[start_time, end_time)` window valid on that date. **Cross-midnight** shifts (where
   `start_time > end_time`, e.g. 22:00–06:00): the window test must use an **`OR`** condition
   (`time >= start_time OR time < end_time`), **not** `AND` (a movement at 02:00 satisfies neither
   `>= 22:00` nor the closed `AND`). `shift_date` = the calendar day the shift *starts*; so a
   22:00–06:00 movement at 02:00 belongs to the prior day's night shift.
   - **Timezone contract:** `start_time`/`end_time` are **plant-local**, so `posting_datetime` must
     be compared in the plant's local zone (MKPF `CPUDT/CPUTM` are local already; if any source is
     UTC, convert via a `plant → timezone` attribute first). DST boundaries must resolve
     deterministically (explicit fold / strict policy) so night shifts on the changeover night are
     bucketed consistently. The plant-timezone source is an open dependency (see roadmap).
   `[start_time, end_time)` window valid on that date. **Cross-midnight** shifts: `shift_date` =
   the calendar day the shift *starts*; a 22:00–06:00 movement at 02:00 belongs to the prior
   day's night shift.
3. **Silver enrichment:** add `shift_id` + `shift_date` to `goods_movement` (MKPF `CPUDT/CPUTM`)
   and `process_order`/confirmations, via the helper.
4. **Gold:** `gold_shift_output_summary` regrained to plant × shift_date × shift_id × material ×
   UOM (produced/scrap qty, confirmed hours, target, efficiency, OEE components);
   `gold_shift_downtime_summary`; `gold_shift_kpi_snapshot` (append, via the snapshot job).
   Liquid clustering `(plant_code, shift_date, shift_id)`.

## Consequences
- Movements in a plant with no calendar (or outside any window) bucket to `shift_id =
  'UNASSIGNED'`; a `@dlt.expect` warns if assigned coverage < 95%.
- A real operational shift master remains an open dependency; the config-seed keeps the product
  working until it lands.
- OEE needs target/ideal rates — sourced from work-centre capacity (KAPA) or a rate config;
  treated as a later sub-phase.
