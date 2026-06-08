# EnvMon Contract Inventory

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery)
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`
**Contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`
**Status:** All methods mock-only. SAP QM mapping hypotheses added (k.txt). No route wired. DDL pending.

---

## Legend

| Column | Meaning |
|---|---|
| SAP QM source (hypothesis) | Likely source column from confirmed-v1 views — not confirmed-ddl |
| Contract status | `confirmed` = field is in the Zod schema; `missing` = not in schema |
| Confidence | `confirmed-v1` / `assumed` / `missing` / `blocked` |

---

## 1. `getEnvMonContext`

**Return type:** `EnvMonContext`
**Panel:** EnvMon context panel (workspace-level context)
**Filters used:** `plantId`, `regionId`
**Source badge:** `lims` (static — all EnvMon panels)

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `plantId` | `gold_inspection_lot.PLANT_ID` | confirmed-v1 |
| `regionId` | No direct SAP QM equivalent — may be derived from plant master or static config | assumed |
| `periodStart` | Request parameter | confirmed |
| `periodEnd` | Request parameter | confirmed |
| `kpiSummary` | Aggregated from site summary query | confirmed-v1 (via getEnvMonSiteSummary) |

**V2 native recommendation:** Implement after `getEnvMonSiteSummary` is DDL-confirmed. Context can be assembled from site summary + plant master.

---

## 2. `getEnvMonSiteSummary`

**Return type:** `EnvMonSiteSummary`
**Panel:** Site summary panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`
**QuerySpec:** `apps/api/adapters/envmon/envmon_databricks_adapter.py` → `get_site_summary_spec`

| Contract field | SAP QM source hypothesis | Confidence | Notes |
|---|---|---|---|
| `totalSamples` | `SUM(lot_count)` from `gold_inspection_lot` JOIN `gold_inspection_point` | confirmed-v1 | V1 uses lot count per location; not individual swab count |
| `positiveSamples` | Location count where `INSPECTION_RESULT_VALUATION IN ('R','REJ','REJECT')` | confirmed-v1 | Location-level fail count from V1 `plants.py` |
| `positiveRate` | `active_fails / total_locs` (computed in mapper) | confirmed-v1 | |
| `criticalZoneExposures` | Fails in `zone-1` — needs em_location_zones join | blocked | em_location_zones may not exist in UAT |
| `openCorrectiveActions` | Fixed 0 — contract compatibility only; CAPA out of scope for EnvMon V2 parity | contract-compat | |
| `trendDirection` | Period-over-period comparison — deferred | blocked | |

**V2 native recommendation:** **First safe slice.** Implement after DDL confirmed.

---

## 3. `getEnvMonZones`

**Return type:** `EnvMonZone[]`
**Panel:** Zones panel
**Filters used:** `plantId`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `zoneId` | `em_location_zones.zone_id` (if exists) or derived from FUNCTIONAL_LOCATION | blocked |
| `zoneName` | `em_location_zones.zone_name` (if exists) | blocked |
| `hygieneZone` | `em_location_zones.hygiene_zone` (if exists) | blocked |
| `areaType` | `em_location_zones.area_type` (if exists) | blocked |
| `plantId` | `gold_inspection_lot.PLANT_ID` | confirmed-v1 |
| `activeSwabPoints` | COUNT DISTINCT FUNCTIONAL_LOCATION from recent lots | confirmed-v1 |
| `lastSampleDate` | MAX(lot.CREATED_DATE) per zone | confirmed-v1 |
| `riskLevel` | Derived from zone-level fail rate — business rule needed | assumed |

**V2 native recommendation:** **Blocked** — requires em_location_zones. Run `SHOW TABLES` to check existence.

---

## 4. `getEnvMonAlerts`

**Return type:** `EnvMonAlert[]`
**Panel:** Alerts panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `alertId` | Generated (e.g. `lot_id + point_id`) — no native alert ID | assumed |
| `alertType` | Derived from MIC_NAME (Listeria → `microbiological`, ATP → `hygiene`) | assumed |
| `severity` | Derived from INSPECTION_RESULT_VALUATION (REJECT → high, WARN → medium) | assumed |
| `zoneId` | Via em_location_zones (if exists) | blocked |
| `locationId` | `gold_inspection_point.FUNCTIONAL_LOCATION` | confirmed-v1 |
| `description` | Composed from MIC_NAME + valuation | assumed |
| `raisedAt` | `gold_inspection_lot.CREATED_DATE` or INSPECTION_END_DATE | confirmed-v1 |
| `status` | Usage decision not tracked in confirmed views — `open` default | assumed |

**V2 native recommendation:** **Deferred** — derivation rules for alertType and severity undefined.

---

## 5. `getEnvMonSwabResults`

**Return type:** `EnvMonSwabResult[]`
**Panel:** Swab results panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `sampleId` | `gold_inspection_point.SAMPLE_ID` | confirmed-v1 |
| `locationId` | `gold_inspection_point.FUNCTIONAL_LOCATION` | confirmed-v1 |
| `locationName` | `FUNCTIONAL_LOCATION` (raw TPLNR — no display name confirmed) | confirmed-v1 (TPLNR) |
| `zoneId` | Via em_location_zones | blocked |
| `hygieneZone` | Via em_location_zones | blocked |
| `sampleDate` | `gold_inspection_lot.CREATED_DATE` | confirmed-v1 |
| `testType` | `gold_batch_quality_result_v.MIC_NAME` | confirmed-v1 |
| `result` | Derived from `INSPECTION_RESULT_VALUATION` | confirmed-v1 |
| `resultValue` | `gold_batch_quality_result_v.QUANTITATIVE_RESULT` | confirmed-v1 |
| `unit` | Not in confirmed-v1 columns — may be in full DDL | assumed |
| `specification` | `gold_batch_quality_result_v.UPPER_TOLERANCE` | confirmed-v1 |
| `sampledBy` | Not in confirmed gold views | missing |
| `analysedBy` | Not in confirmed gold views | missing |
| `plantId` | `gold_inspection_lot.PLANT_ID` | confirmed-v1 |

**V2 native recommendation:** Second slice after site summary. Implement after DDL confirmed.

---

## 6. `getEnvMonTrends`

**Return type:** `EnvMonTrend[]`
**Panel:** Trends panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `periodLabel` | DATE_TRUNC('week' or 'month', CREATED_DATE) | confirmed-v1 |
| `totalSamples` | COUNT lots per period bucket | confirmed-v1 |
| `positiveSamples` | COUNT fail valuations per period bucket | confirmed-v1 |
| `positiveRate` | Computed in mapper | confirmed-v1 |
| `zoneId` | Via em_location_zones (optional filter) | blocked |
| `testType` | `MIC_NAME` (optional filter) | confirmed-v1 |

**V2 native recommendation:** Third slice. Same views as site summary.

---

## 7. `getEnvMonHeatmap`

**Return type:** `EnvMonHeatmapCell[]`
**Panel:** Heatmap panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `cellId` | `em_location_coordinates.func_loc_id` | confirmed-v1 (if table exists) |
| `zoneId` | Via em_location_zones | blocked |
| `riskScore` | Computed from fail rate per location | assumed |
| `sampleCount` | COUNT lots per func_loc_id | confirmed-v1 |
| `positiveCount` | COUNT fail valuations per func_loc_id | confirmed-v1 |
| `x` | `em_location_coordinates.x_pos` | confirmed-v1 (if table exists) |
| `y` | `em_location_coordinates.y_pos` | confirmed-v1 (if table exists) |

**V2 native recommendation:** **Blocked** — requires em_location_coordinates and em_plant_floor; both app-managed and may not exist in connected_plant_uat.

---

## 8. `getEnvMonCorrectiveActions`

**Return type:** `EnvMonCorrectiveAction[]`
**Panel:** Corrective actions panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| All fields | Not applicable — CAPA is out of scope for EnvMon V2 parity | out-of-scope |

**V2 native recommendation:** **Out of scope** — CAPA/corrective actions are not a V2 EnvMon parity requirement. `getEnvMonCorrectiveActions` is intentionally not migrated. Future CAPA capability belongs to a separate Quality Actions / Deviation / CAPA bounded context.

---

## 9. `getEnvMonSwabVectors`

**Return type:** `EnvMonSwabVector[]`
**Panel:** Swab vectors panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | SAP QM source hypothesis | Confidence |
|---|---|---|
| `vectorId` | Generated — no native vector concept | missing |
| `fromLocationId` | `FUNCTIONAL_LOCATION` | confirmed-v1 |
| `toLocationId` | Adjacent location — adjacency rules undefined | missing |
| `strength` | Temporal/spatial correlation score — algorithm undefined | missing |
| `testType` | `MIC_NAME` | confirmed-v1 |
| `eventCount` | COUNT fails at correlated locations | assumed |

**V2 native recommendation:** **Deferred indefinitely** — proximity/adjacency business rules undefined.

---

## Source Mapping Status Summary

| Method | SAP QM mapping hypothesis | Required views | em_* dependency | Status |
|---|---|---|---|---|
| `getEnvMonContext` | Partial (plant + site summary) | lot + plant | None | After site summary DDL |
| `getEnvMonSiteSummary` | **Confirmed-v1** | lot + point + result_v | None | **QuerySpec written — DDL pending** |
| `getEnvMonZones` | Partial (blocked on zone mapping) | lot + point + em_location_zones | em_location_zones | Blocked |
| `getEnvMonAlerts` | Derivable from results | lot + point + result_v | None | Deferred — rules undefined |
| `getEnvMonSwabResults` | Confirmed-v1 (most fields) | lot + point + result_v | None | After DDL — Rank 2 |
| `getEnvMonTrends` | Confirmed-v1 | lot + point + result_v | None | After DDL — Rank 3 |
| `getEnvMonHeatmap` | Confirmed-v1 (contingent on em_*) | lot + point + result_v + em_* | em_location_coordinates, em_plant_floor | Blocked — em_* unknown |
| `getEnvMonCorrectiveActions` | Not applicable | — | — | Out of scope — CAPA not a V2 EnvMon parity requirement |
| `getEnvMonSwabVectors` | Partial (no adjacency rules) | lot + point + result_v | None | Deferred indefinitely |
