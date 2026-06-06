# EnvMon Native Databricks — Candidate Slice Ranking

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery) | **Updated:** 2026-05-17 (p.txt — swab-results route wired)
**Status:** Rank 1 route wired, BV pending; Rank 2 route wired (p.txt), BV pending; estate map candidates after BV; all others deferred
**Reference:** `docs/audit/envmon-sap-qm-source-model.md`, `docs/migration/envmon-v1-functional-recovery.md`

---

## Correction (k.txt)

The i.txt ranking had all candidates BLOCKED on "no source view". The V1 source model has been recovered. Candidates are now ranked using confirmed-v1 evidence. Source confidence is now the primary discriminator between implementable and deferred slices.

---

## Ranking Criteria

| Criterion | Weight | Notes |
|---|---|---|
| Source confidence | Critical | confirmed-v1 > assumed; confirmed-ddl required before route wiring |
| em_* table dependency | Critical | App-managed tables may not exist in connected_plant_uat — blocks any method that needs them |
| Mapping complexity | Medium | Simple columns-to-fields vs aggregation vs business rules |
| V1 support | High | Does V1 implement this feature? If so, SQL and semantics are known |
| Browser-verifiable | Medium | Can a developer verify in UAT browser? |
| Business rules confirmed | High | Alerts, vectors, corrective actions need rule definitions |

---

## Rank 1 — Site Summary (QuerySpec written; recommended first route)

**Adapter method:** `getEnvMonSiteSummary`
**Returns:** `EnvMonSiteSummary` — aggregated KPI counts for a plant/period
**QuerySpec:** `apps/api/adapters/envmon/envmon_databricks_adapter.py` → `get_site_summary_spec`

**Why first:**
- V1 `plants.py` `fetch_plant_kpis` SQL confirmed — join keys, column names, filter values all known
- Uses ONLY `gold_inspection_lot + gold_inspection_point + gold_batch_quality_result_v` — no em_* joins
- Returns 1 aggregated row per plant — minimal data transfer risk
- Inspection type filter `IN ('14','Z14')` confirmed-v1

**Partial coverage:**
- `totalSamples` ← `lots_tested` (lot-level count; not swab-level)
- `positiveSamples` ← `active_fails` (location-level fail count)
- `positiveRate` ← computed
- `criticalZoneExposures`, `trendDirection` ← defaults (em_* source not confirmed; period-over-period not implemented)
- `openCorrectiveActions` ← contract compatibility fixed 0 (CAPA out of scope for EnvMon V2 parity)

**Status:** Route wired (n.txt, 2026-05-17) — DDL confirmed — browser verification pending

| Item | Status |
|---|---|
| Source views | confirmed-ddl (DESCRIBE TABLE, 2026-05-17) |
| V1 SQL recovered | Yes (plants.py `fetch_plant_kpis`) |
| em_* dependency | None |
| DDL run | Yes (2026-05-17) |
| Route wired | Yes — `GET /api/envmon/site-summary` in `apps/api/routes/envmon.py` (n.txt) |
| Browser-verified | No — pending UAT deployment |

---

## Rank 2 — Swab Results (individual results per sample point)

**Adapter method:** `getEnvMonSwabResults`
**Returns:** `EnvMonSwabResult[]` — one row per MIC test per sample point

**Why second:**
- Same three gold views as site summary — no new dependencies
- V1 `lots.py` DAL provides the per-MIC result SQL pattern
- Enriches `positiveSamples` count with individual result rows and organism details

**Partial coverage:**
- `inspectionLotId` ← `INSPECTION_LOT_ID` (confirmed-v1)
- `functionalLocation` ← `FUNCTIONAL_LOCATION` (confirmed-v1) — location identifier
- `micId`, `micName`, `micCode` ← from `gold_batch_quality_result_v` (confirmed-v1)
- `valuation` ← raw `INSPECTION_RESULT_VALUATION` (confirmed-v1)
- `status` ← derived from `valuation`: R/REJ/REJECT→fail; W/WARN→warning; null→pending; other→pass
- `result` ← raw `RESULT` column (distinct from INSPECTION_RESULT_VALUATION)
- `quantitativeResult`, `targetValue`, `upperTolerance`, `lowerTolerance` ← confirmed columns
- `zoneId` ← **not available** without em_location_zones — frontend wiring deferred
- `hygieneZone` ← **not available** without em_location_zones
- `sampledBy`, `analysedBy` ← not available from gold views (V1 did not expose these)

**Status:** Route wired (p.txt, 2026-05-17) — DDL confirmed for all three Group A views — browser verification pending

| Item | Status |
|---|---|
| Source views | confirmed-ddl (DESCRIBE TABLE, 2026-05-17) |
| V1 SQL recovered | Yes (lots.py DAL per-MIC result pattern) |
| em_* dependency | None (zoneId deferred) |
| DDL run | Yes (same views as site-summary) |
| Route wired | Yes — `GET /api/envmon/swab-results` in `apps/api/routes/envmon.py` (p.txt) |
| Browser-verified | No — pending UAT deployment |
| Frontend wired | No — deferred; `zoneId`/`zoneName` unavailable; adapter is mock-only with no fetch infrastructure |

---

## Rank 3 — Trends (time-series by period)

**Adapter method:** `getEnvMonTrends`
**Returns:** `EnvMonTrend[]` — period-bucketed positive rates

**Why third:**
- Same three gold views — no new dependencies
- V1 `trends.py` provides the time-series SQL with date truncation

**Status:** Deferred — implement after site summary DDL confirmed

---

## Rank 3b — Plant Map (estate-level read model — PROPOSED)

**Adapter method:** `getEnvMonPlantMap` — **PROPOSED; does not yet exist in envmon-adapter.ts or data-contracts**
**Route (proposed):** `GET /api/envmon/plant-map`
**Returns:** Plant lat/lon list for estate map rendering

**Why here in sequence:**
- Depends on `em_plant_geo` (confirmed-v1 DDL) and site-summary BV — both achievable after Rank 1 BV
- `em_plant_geo` existence in UAT is the key gate (`SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`)
- Does NOT depend on any of the in-plant spatial tables (em_plant_floor, em_location_coordinates)
- Simple read: one row per plant from `em_plant_geo`

**Status:** **Planned** — depends on em_plant_geo in UAT + contract design + Rank 1 BV. Not yet implemented.

---

## Rank 3c — Plant Hotspots (estate-level composed read model — PROPOSED)

**Adapter method:** `getEnvMonPlantHotspots` — **PROPOSED; does not yet exist in envmon-adapter.ts or data-contracts**
**Route (proposed):** `GET /api/envmon/plant-hotspots`
**Returns:** Plant hot spot status (fail/warn/compliant) per plant, combining em_plant_geo + observation aggregate

**Why here in sequence:**
- Builds on Rank 3b (plant map lat/lon) and Rank 1 (site-summary observation aggregate)
- Composition: em_plant_geo provides coordinates; site-summary provides riskStatus / positiveCount per plant
- No additional data tables required beyond what Rank 1 and Rank 3b already confirm

**Status:** **Planned** — depends on Rank 3b + Rank 1 BV + contract design. Not yet implemented.

---

## Rank 4 — Zones / Locations (reference data)

**Adapter method:** `getEnvMonZones`
**Returns:** `EnvMonZone[]` — zone master with hygiene zone classification

**Why fourth (despite being a simple reference-table pattern):**
- Requires `em_location_zones` or equivalent for `hygieneZone` and `areaType` classification
- `em_location_zones` is an app-managed table — **may not exist in connected_plant_uat**
- Without it, only `FUNCTIONAL_LOCATION` strings are available — no zone mapping

**Status:** **Blocked** — pending confirmation that em_location_zones exists in connected_plant_uat

---

## Rank 5 — Alerts (derived from result data)

**Adapter method:** `getEnvMonAlerts`
**Returns:** `EnvMonAlert[]` — positive/warning findings as alerts

**Why fifth:**
- Can be derived from swab results where `INSPECTION_RESULT_VALUATION IN ('R','REJ','REJECT','W','WARN')`
- Alert derivation logic (severity classification, alertType) undefined — needs domain owner input
- The `severity` enum (`low`/`medium`/`high`/`critical`) has no direct SAP QM equivalent

**Status:** Deferred — implement after swab results confirmed; alert rules need definition

---

## Rank 6 — Corrective Actions (Out of scope)

**Adapter method:** `getEnvMonCorrectiveActions`
**Returns:** `EnvMonCorrectiveAction[]` — CAPA records

**Status:** **Out of scope** — CAPA/corrective actions are not a V2 EnvMon parity requirement.
`getEnvMonCorrectiveActions` is intentionally not migrated. Any future CAPA capability belongs
to a separate Quality Actions / Deviation / CAPA bounded context, not EnvMon. Do not implement.

---

## Rank 7 — Heatmap

**Adapter method:** `getEnvMonHeatmap`
**Returns:** `EnvMonHeatmapCell[]` — grid cells with risk scores

**Why seventh:**
- Requires `em_location_coordinates` (x/y positions) + `em_plant_floor` (SVG dimensions)
- Both are app-managed tables — **may not exist in connected_plant_uat**
- V1 confirmed these tables exist, but they may not be in the UAT Databricks catalog

**Status:** **Blocked** — pending `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`

---

## Rank 8 — Swab Vectors (deferred indefinitely)

**Adapter method:** `getEnvMonSwabVectors`
**Returns:** `EnvMonSwabVector[]` — contamination trajectory / spread signals

**Why last:**
- Requires proximity/adjacency rules between sampling points — not a simple table query
- Temporal correlation rules are undefined
- Depends on zones (Rank 4) and swab results (Rank 2) being implemented first

**Status:** **Deferred indefinitely** — business rules undefined; depends on earlier ranks

---

## Recommended Implementation Sequence

1. ~~Run DDL for all three primary views~~ — DONE (n.txt, confirmed-ddl 2026-05-17)
2. ~~Wire `GET /api/envmon/site-summary`~~ — DONE (n.txt, route wired)
3. ~~Implement Rank 2 QuerySpec (`envmon.get_swab_results`); wire `GET /api/envmon/swab-results`~~ — DONE (p.txt, route wired)
4. ~~Browser-verify `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results` in UAT~~ — DONE 2026-05-18
5. Browser-verify read-only monitoring UI at `?workspace=envmon-monitoring` — PENDING next deploy
6. `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` — gate for Rank 3b, 4, 7
7. Design `getEnvMonPlantMap` contract; implement `GET /api/envmon/plant-map` (Rank 3b)
8. Design `getEnvMonPlantHotspots` contract; implement `GET /api/envmon/plant-hotspots` (Rank 3c)
9. Implement Rank 3 (trends) — shares same views as site summary
10. Implement Rank 4+ (zones, coordinates, floors, heatmap) only after em_* confirmed and populated

---

## Current Status Summary

| Rank | Slice | Method | Source confidence | em_* dependency | Status |
|---|---|---|---|---|---|
| 1 | Site Summary | `getEnvMonSiteSummary` | confirmed-ddl | None | **API BV 2026-05-18; UI BV pending** |
| 2 | Swab Results | `getEnvMonSwabResults` | confirmed-ddl | None | **API BV 2026-05-18; native read-only UI added** |
| 3 | Trends | `getEnvMonTrends` | confirmed-v1 | None | Planned — after Rank 1 BV |
| 3b | Plant Map | `getEnvMonPlantMap` (PROPOSED) | confirmed-v1 | em_plant_geo | Planned — em_plant_geo in UAT unknown; contract not designed |
| 3c | Plant Hotspots | `getEnvMonPlantHotspots` (PROPOSED) | confirmed-v1 | em_plant_geo (read) | Planned — depends on Rank 3b + Rank 1 BV |
| 4 | Zones | `getEnvMonZones` | assumed | em_location_zones | Planned — em_* unknown |
| 5 | Alerts | `getEnvMonAlerts` | partial (derivable) | None | Deferred — alert rules undefined |
| 6 | Corrective Actions | `getEnvMonCorrectiveActions` | none | N/A | Out of scope — CAPA not a V2 EnvMon parity requirement |
| 7 | Heatmap | `getEnvMonHeatmap` | confirmed-v1 for views; app tables unknown | em_location_coordinates, em_plant_floor | Planned — em_* unknown |
| 8 | Swab Vectors | `getEnvMonSwabVectors` | none | partial | Deferred indefinitely — business rules undefined |
