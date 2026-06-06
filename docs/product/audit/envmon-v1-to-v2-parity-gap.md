# EnvMon V1-to-V2 Parity Gap Analysis

**Date:** 2026-05-17
**Tranche:** l.txt
**Domain:** Environmental Monitoring (EnvMon)
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`
**Contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`

> **Status update (n.txt, 2026-05-17):** CAPA/corrective actions have been formally scoped out of EnvMon V2 parity.
> `getEnvMonCorrectiveActions` is **intentionally not migrated** — not blocked, not missing a source.
> The CAPA analysis below is preserved as historical context. The scope decision supersedes any
> "blocked" or "missing-source" framing for CAPA items. Future CAPA belongs to a separate
> Quality Actions / Deviation / CAPA bounded context.

> **Status update (o.txt, 2026-05-17):** Estate Map / Plant Hotspot View section added.
> Plant geolocation (`em_plant_geo`) is part of EnvMon Spatial Configuration — maintained with plant floor/spatial data.
> `getEnvMonPlantMap` and `getEnvMonPlantHotspots` are **proposed** contract additions — not yet in envmon-adapter.ts.
> Estate Monitoring BC depends on `em_plant_geo` (UAT existence unknown) + `getEnvMonSiteSummary` (route wired, BV pending).
> See drill-down chain in each spatial section: estate map → plant summary → floor list → floorplan → heatmap → swab point detail.

---

## Overview

EnvMon V1 is a hybrid domain. The V2 contracts largely cover the SAP QM monitoring data side — lot counts, fail valuations, MIC time-series — and this mapping is mostly viable once DDL is confirmed. The spatial configuration side (floorplans, coordinates, zones, heatmap) is partially designed in V2 contracts but cannot be implemented until `em_plant_floor`, `em_location_coordinates`, and `em_location_zones` existence is confirmed in `connected_plant_uat`.

V1 also included a **high-level geographic estate map** — a multi-plant geographic overview with plant pins and hot spot markers. This requires `em_plant_geo` (lat/lon per plant) from Spatial Configuration + plant-level observation aggregates. No V2 contract method (`getEnvMonPlantMap`, `getEnvMonPlantHotspots`) exists yet — these are proposed additions.

CAPA/corrective actions are designed in V2 (`getEnvMonCorrectiveActions`, `EnvMonCorrectiveAction`) but have no V1 equivalent and no identified data source anywhere in the V1 codebase or SAP QM gold layer.

The V2 contract also introduces hygiene zone classification (`hygieneZone: zone-1/2/3/4`) and area type categorisation (`areaType: production/storage/packaging/utility/corridor/other`) that do not exist in V1. V1 zones are generic L4 spatial areas with `zone_name` and geometry only. These fields are overdesigned relative to V1 and would require a new classification table or extension of `em_location_zones` before they could carry real data.

---

## Legend

| Status label | Meaning |
|---|---|
| `confirmed-v1` | Field maps to a confirmed-v1 SAP QM column or app-managed table column |
| `assumed` | Plausible derivation from confirmed-v1 views, but derivation rule not yet agreed |
| `blocked` | Requires a table (`em_*`) whose existence in UAT is unconfirmed |
| `overdesigned` | Field exists in V2 contract but has no V1 or SAP QM equivalent — represents new scope |
| `missing-source` | Contract field has no plausible data source in V1 or SAP QM |

---

## Estate Map / Plant Hotspot View (proposed — not yet in contracts)

**V1 capability:** V1 EnvMon included a high-level geographic map of all plants. Plant pins were shown on a geographic map and coloured by risk/fail status. Clicking a plant pin navigated to the plant summary (site-level KPIs), which then allowed drill-down to the floor list and floorplan heatmap.

**V2 current status:** No equivalent routes or contract methods exist. `getEnvMonPlantMap` and `getEnvMonPlantHotspots` do not appear in `domain-integrations/envmon/src/adapters/envmon-adapter.ts` or `packages/data-contracts/src/schemas/environmental-monitoring.ts`. These are **proposed** future contract additions.

### Source dependencies

| Source | Purpose | Status |
|---|---|---|
| `em_plant_geo` (Spatial Configuration) | Plant lat/lon for map pins | confirmed-v1 DDL; UAT existence unknown |
| `GET /api/envmon/site-summary` (Observations BC) | Plant-level fail/warn/pass aggregate for hot spot colour | Route wired; BV pending |

### Proposed read models

| Route (proposed) | Method (proposed) | Description |
|---|---|---|
| `GET /api/envmon/plant-map` | `getEnvMonPlantMap` | Plant lat/lon from em_plant_geo; one row per plant |
| `GET /api/envmon/plant-hotspots` | `getEnvMonPlantHotspots` | Plant hot spot status (fail/warn/pass) from observation aggregate |

Both routes are **planned / proposed only**. Do not implement until:
1. `em_plant_geo` confirmed present in connected_plant_uat
2. `GET /api/envmon/site-summary` browser-verified
3. New contract types designed for `getEnvMonPlantMap` / `getEnvMonPlantHotspots`

### Missing contract fields (proposed)

To support the estate map, new contract types would need at minimum:

| Field | Source | Note |
|---|---|---|
| `plantId` | `em_plant_geo.plant_id` | Links to observation aggregate |
| `lat` | `em_plant_geo.lat` | WGS-84 latitude |
| `lon` | `em_plant_geo.lon` | WGS-84 longitude |
| `hotspotStatus` | Derived from observation aggregate (`riskStatus`) | fail/warn/compliant/unknown |
| `activeFails` | Derived from site-summary `positiveCount` | — |
| `zonesMonitored` | Derived from site-summary `zonesMonitored` | — |

### Drill-down chain

The estate map is the entry point of the full navigation hierarchy:

```
estate map (em_plant_geo + hot spot aggregate)
  → plant summary (GET /api/envmon/site-summary — route wired)
    → plant floor list (GET /api/envmon/floors — planned)
      → active floorplan (GET /api/envmon/floorplan — planned)
        → floor heatmap (GET /api/envmon/heatmap — planned)
          → swab point detail (GET /api/envmon/swab-results — planned)
```

### Proposed next slice

1. Confirm `em_plant_geo` in UAT (`SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`)
2. Browser-verify `GET /api/envmon/site-summary`
3. Design `getEnvMonPlantMap` + `getEnvMonPlantHotspots` contract types
4. Implement read-only `GET /api/envmon/plant-map` (em_plant_geo read)
5. Implement `GET /api/envmon/plant-hotspots` combining em_plant_geo + observation aggregate

---

## `getEnvMonContext`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `plantId` | `gold_inspection_lot.PLANT_ID` | `confirmed-v1` | — |
| `regionId` | No SAP QM equivalent; may derive from plant master or static config | `assumed` | Plant master access not confirmed |
| `periodStart` | Request parameter | `confirmed-v1` | — |
| `periodEnd` | Request parameter | `confirmed-v1` | — |
| `kpiSummary` | Assembled from `getEnvMonSiteSummary` result | `confirmed-v1` | Same DDL dependency as site summary |
| `openCorrectiveActions` | No CAPA source identified anywhere in V1 | `missing-source` | MUST NOT default to 0 as if factual |
| `overallRiskStatus` | No direct V1 equivalent — would require zone classification | `overdesigned` | Zone classification undefined |

**V1 equivalent:** `GET /api/em/plants` returns the plant-level context including KPI aggregates. V1 had no `openCorrectiveActions` field — this is entirely new scope added in the V2 contract design.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`.

**Spatial config dependency:** None for the base context. `overallRiskStatus` would depend on zone classification data.

**V2 contract fit:** PARTIAL. The plant and period fields are fine. Two fields — `openCorrectiveActions` and `overallRiskStatus` — have no V1 source and must not be silently zeroed or set to a stable placeholder. If returned at all, these fields must be explicitly marked as unavailable until a data source is designed.

**Route readiness:** No route wired. Implement after `getEnvMonSiteSummary` is DDL-confirmed.

**DDL required:** Same as `getEnvMonSiteSummary`. `overallRiskStatus` additionally requires zone classification work.

**Implementation priority:** After `getEnvMonSiteSummary` DDL; strip or mark unavailable the `openCorrectiveActions` and `overallRiskStatus` fields until sources are designed.

---

## `getEnvMonSiteSummary`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `plantId` | `gold_inspection_lot.PLANT_ID` | `confirmed-v1` | — |
| `plantName` | Plant master or static config | `assumed` | Not in gold inspection views |
| `totalSamples` | `COUNT(lot_count)` from `gold_inspection_lot` JOIN `gold_inspection_point` | `confirmed-v1` | V1 counts location-level lots, not individual swab events |
| `positiveSamples` | Location count where `INSPECTION_RESULT_VALUATION IN ('R','REJ','REJECT')` | `confirmed-v1` | V1 uses location-level fail count |
| `positiveRate` | `positiveSamples / totalSamples` (computed in mapper) | `confirmed-v1` | — |
| `zonesMonitored` | Requires `COUNT(DISTINCT zone_id)` from `em_location_zones` | `blocked` | `em_location_zones` existence in UAT unconfirmed |
| `zonesWithAlerts` | Requires zone-level fail rate from `em_location_zones` join | `blocked` | `em_location_zones` existence in UAT unconfirmed |
| `openCorrectiveActions` | No CAPA source identified | `missing-source` | MUST NOT default to 0 as if factual |
| `overdueActions` | No CAPA source identified | `missing-source` | MUST NOT default to 0 as if factual |
| `complianceRate` | Requires zone compliance logic and `em_location_zones` | `blocked` | `em_location_zones` + compliance rule undefined |
| `riskStatus` | Requires zone classification; no direct V1 equivalent | `overdesigned` | Zone classification undefined |
| `highestSeverity` | Requires zone classification; no direct V1 equivalent | `overdesigned` | Zone classification undefined |
| `confidence` | No V1 equivalent field | `overdesigned` | — |

**V1 equivalent:** `GET /api/em/plants` — returns `total_locs`, `active_fails`, `active_warns`, `total_lots`. V1 KPIs are lot-count and fail-count based, not zone-classification-based.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`. A QuerySpec for the SAP QM portion is already written (`apps/api/adapters/envmon/envmon_databricks_adapter.py` → `get_site_summary_spec`).

**Spatial config dependency:** `zonesMonitored`, `zonesWithAlerts`, `complianceRate` all require `em_location_zones`. These fields cannot be populated without the app-managed spatial tables.

**V2 contract fit:** PARTIAL. The SAP QM aggregate fields (`totalSamples`, `positiveSamples`, `positiveRate`) are a good fit. The remaining fields are either blocked on spatial tables or have no source at all. The current mapper returns 0 or a stable placeholder for unavailable fields — these are TEMPORARY PLACEHOLDERS, not business facts, and must be clearly annotated as such. They must not be presented to users as real data.

**Missing fields:** `openCorrectiveActions`, `overdueActions` — no source in V1 or SAP QM. `openCorrectiveActions` and `overdueActions` MUST NOT default to 0 as if factual.

**Overdesigned fields:** `riskStatus`, `highestSeverity`, `confidence` — no V1 equivalent; would require zone classification design.

**Fields that should be optional:** `zonesMonitored`, `zonesWithAlerts`, `complianceRate`, `riskStatus`, `highestSeverity`, `confidence` — currently required in contract but sources are uncertain or non-existent. These should be optional until sources are confirmed.

**Route readiness:** No route wired. DDL confirmation required first.

**DDL required:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` — all three must be verified in `connected_plant_uat`.

**Implementation priority:** HIGH — first executable slice. Implement the SAP QM portion after DDL confirmation. Leave spatial-dependent and CAPA fields as `undefined` / omitted (not zeroed) until sources are confirmed.

---

## `getEnvMonZones`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `zoneId` | `em_location_zones.zone_id` (if exists) | `blocked` | `em_location_zones` existence in UAT unconfirmed |
| `zoneName` | `em_location_zones.zone_name` | `blocked` | `em_location_zones` existence in UAT unconfirmed |
| `plantId` | `gold_inspection_lot.PLANT_ID` | `confirmed-v1` | — |
| `areaType` | NOT IN V1 — V1 zones have no area type classification | `overdesigned` | Requires new classification table or `em_location_zones` extension |
| `hygieneZone` | NOT IN V1 — V1 zones are generic L4 spatial areas only | `overdesigned` | Requires new classification table or `em_location_zones` extension |
| `status` | Derived from zone-level fail rate — derivation rule needed | `assumed` | Business rule undefined |
| `lastSampleDate` | `MAX(lot.CREATED_DATE)` per zone — requires `em_location_zones` join | `blocked` | `em_location_zones` existence in UAT unconfirmed |
| `nextScheduledSample` | No scheduling concept in SAP QM event-driven data | `missing-source` | SAP QM is event-driven, not schedule-driven |
| `consecutivePositives` | Computed from `gold_batch_quality_result_v` with zone join | `blocked` | Requires `em_location_zones` join |
| `openAlerts` | No persistent alert records in V1 | `missing-source` | Alert concept is derived, not stored |

**V1 equivalent:** `em_location_zones` confirmed-v1 schema — stores L4 functional locations associated with spatial zones, with `zone_name` and geometry. V1 Spatial Studio allowed operators to draw zone polygons and associate inspection points with zones via the `ZoneLayer.tsx` workflow. There is no hygiene classification or area type in V1; these concepts do not exist in the V1 database schema.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point` for zone-level aggregates once zone join is possible.

**Spatial config dependency:** `em_location_zones` required for all zone-identity fields. This is the blocking dependency.

**V2 contract fit:** OVERDESIGNED for two critical fields. `hygieneZone` (zone-1/2/3/4) and `areaType` (production/storage/packaging/utility/corridor/other) are V2 additions with no V1 equivalent. V1 zones are generic L4 spatial areas identified by `zone_name` and geometry alone. Implementing these fields would require either a new zone classification table or a schema extension to `em_location_zones` — neither of which exists in V1 or has been designed for V2.

**Missing fields with no V1 source:** `nextScheduledSample` — SAP QM is event-driven, not schedule-driven; `openAlerts` — V1 had no persistent alert store.

**Route readiness:** BLOCKED — `em_location_zones` existence unconfirmed.

**DDL required:** `em_location_zones` (app-managed table, existence in `connected_plant_uat` unknown). Run `SHOW TABLES IN <catalog>.connected_plant_uat` to verify before writing any implementation.

**Implementation priority:** BLOCKED pending spatial table verification. The `hygieneZone` / `areaType` overdesign must be resolved as a design decision (add classification table, or remove fields from contract) before implementation begins.

---

## `getEnvMonAlerts`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `alertId` | Generated (e.g. `lot_id + point_id` composite) — no native alert ID | `assumed` | Synthetic key strategy undefined |
| `alertType` | Derived from `MIC_NAME` (Listeria → microbiological, ATP → hygiene) | `assumed` | Derivation mapping undefined |
| `severity` | Derived from `INSPECTION_RESULT_VALUATION` (REJECT → high, WARN → medium) | `assumed` | Escalation rules undefined |
| `zoneId` | Via `em_location_zones` join | `blocked` | `em_location_zones` existence unconfirmed |
| `locationId` | `gold_inspection_point.FUNCTIONAL_LOCATION` | `confirmed-v1` | — |
| `description` | Composed from `MIC_NAME` + valuation text | `assumed` | Composition rule undefined |
| `raisedAt` | `gold_inspection_lot.CREATED_DATE` or `INSPECTION_END_DATE` | `confirmed-v1` | Date semantics need confirmation |
| `resolvedAt` | Not tracked in gold views — usage decision not stored | `missing-source` | No alert lifecycle in SAP QM |
| `status` | No persistent alert status in V1 — `open` default only | `assumed` | Alert status lifecycle undefined |
| `correctiveActionId` | No CAPA source | `missing-source` | CAPA not in V1 |
| `owner` | Not in gold views | `missing-source` | — |

**V1 equivalent:** V1 had no first-class alert records. Fail/warning information was part of the KPI aggregates (`GET /api/em/plants`) and the heatmap marker colours (`GET /api/em/heatmap`). V1 displayed fail valuations visually but did not persist discrete alert objects with lifecycle states.

**SAP QM data dependency:** `gold_batch_quality_result_v.INSPECTION_RESULT_VALUATION` provides the raw pass/fail/warn data that would be used to derive alerts. Alert derivation rules (what threshold triggers an alert, escalation criteria, alert lifecycle) are undefined.

**Spatial config dependency:** `zoneId` requires `em_location_zones`.

**V2 contract fit:** The core data (fail valuations) is available in SAP QM, but the alert concept — persistent records with unique IDs, lifecycle states, owners, and corrective action links — is entirely new scope. `correctiveActionId` has no source. Alert derivation rules must be agreed before any implementation.

**Route readiness:** DEFERRED — derivation rules undefined.

**DDL required:** All three gold views for the SAP QM data. `em_location_zones` for `zoneId`.

**Implementation priority:** DEFERRED until alert derivation rules are agreed and documented. Do not implement with undefined business logic.

---

## `getEnvMonSwabResults`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `sampleId` | `gold_inspection_point.SAMPLE_ID` | `confirmed-v1` | — |
| `locationId` | `gold_inspection_point.FUNCTIONAL_LOCATION` | `confirmed-v1` | — |
| `locationName` | `FUNCTIONAL_LOCATION` (raw TPLNR — no display name confirmed) | `confirmed-v1` (TPLNR only) | Display name not in gold views |
| `zoneId` | Via `em_location_zones` | `blocked` | `em_location_zones` existence unconfirmed |
| `zoneName` | Via `em_location_zones` | `blocked` | `em_location_zones` existence unconfirmed |
| `plantId` | `gold_inspection_lot.PLANT_ID` | `confirmed-v1` | — |
| `testType` | `gold_batch_quality_result_v.MIC_NAME` | `confirmed-v1` | — |
| `result` | Derived from `INSPECTION_RESULT_VALUATION` | `confirmed-v1` | — |
| `cfu` | `gold_batch_quality_result_v.QUANTITATIVE_RESULT` | `confirmed-v1` | — |
| `cfuLimit` | `gold_batch_quality_result_v.UPPER_TOLERANCE` | `confirmed-v1` | — |
| `sampleDate` | `gold_inspection_lot.CREATED_DATE` | `confirmed-v1` | — |
| `lotId` | `gold_inspection_lot.INSPECTION_LOT_NUMBER` | `confirmed-v1` | — |
| `analyst` | Not in confirmed gold views | `missing-source` | Not available from SAP QM gold layer |
| `analysedAt` | Not in confirmed gold views | `missing-source` | Not available from SAP QM gold layer |

**V1 equivalent:** `GET /api/em/lots` (lot list per location) and `GET /api/em/lots/{lot_id}` (individual lot MIC results). V1 returned individual inspection point results per lot, sourced from `gold_inspection_lot JOIN gold_inspection_point JOIN gold_batch_quality_result_v`.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`. The core result fields (`sampleId`, `testType`, `result`, `cfu`, `cfuLimit`, `sampleDate`, `lotId`) are all confirmed-v1.

**Spatial config dependency:** `zoneId` and `zoneName` require `em_location_zones`. These two fields will be unavailable until that table is confirmed.

**V2 contract fit:** GOOD for the SAP QM core. Two fields (`analyst`, `analysedAt`) are missing from the gold layer — these should be made optional in the contract or removed if no enriched source can be identified.

**Fields that should be optional:** `analyst`, `analysedAt`, `zoneId`, `zoneName` — sources uncertain or blocked.

**Route readiness:** No route wired. Rank 2 after site summary DDL confirmed.

**DDL required:** All three gold views.

**Implementation priority:** HIGH — Rank 2 after site summary. Implement the SAP QM core fields first; add zone fields when `em_location_zones` is confirmed.

---

## `getEnvMonTrends`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `date` | `DATE_TRUNC('week' or 'month', CREATED_DATE)` | `confirmed-v1` | — |
| `samplesCollected` | `COUNT(lots)` per period bucket | `confirmed-v1` | — |
| `positiveCount` | `COUNT` of fail valuations per period bucket | `confirmed-v1` | — |
| `positiveRate` | Computed in mapper (`positiveCount / samplesCollected`) | `confirmed-v1` | — |
| `newAlerts` | No alert lifecycle in SAP QM | `missing-source` | MUST NOT default to 0 as if factual |
| `resolvedAlerts` | No alert lifecycle in SAP QM | `missing-source` | MUST NOT default to 0 as if factual |
| `openAlerts` | No alert lifecycle in SAP QM | `missing-source` | MUST NOT default to 0 as if factual |
| `complianceRate` | Requires zone compliance logic and `em_location_zones` | `blocked` | `em_location_zones` + compliance rule undefined |

**V1 equivalent:** `GET /api/em/trends` — MIC time-series returning lot counts and fail counts aggregated by time bucket, filterable by MIC name and plant. V1 returned `(date, mic_name, total, fails)` tuples. There was no alert lifecycle tracking in V1.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`. The time-series core is entirely derivable from these views.

**Spatial config dependency:** `complianceRate` requires zone-level data from `em_location_zones`.

**V2 contract fit:** PARTIAL — good for the SAP QM core (date, counts, rate). The alert lifecycle fields (`newAlerts`, `resolvedAlerts`, `openAlerts`) have no SAP QM source and no V1 equivalent. These fields MUST NOT default to 0 as if factual — returning 0 would incorrectly imply that alert history is known and clean. `complianceRate` requires zone compliance logic that is undefined.

**Fields that should NOT default to zero:** `newAlerts`, `resolvedAlerts`, `openAlerts` — absent these values are meaningfully different from zero.

**Route readiness:** No route wired. Rank 3 after swab results.

**DDL required:** All three gold views.

**Implementation priority:** MEDIUM — Rank 3. Return alert counts as `undefined` / omitted (not 0) until an alert data source is designed.

---

## `getEnvMonHeatmap`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `zoneId` | Via `em_location_zones` | `blocked` | `em_location_zones` existence unconfirmed |
| `zoneName` | Via `em_location_zones` | `blocked` | `em_location_zones` existence unconfirmed |
| `areaType` | NOT IN V1 — overdesigned | `overdesigned` | New classification concept |
| `hygieneZone` | NOT IN V1 — overdesigned | `overdesigned` | New classification concept |
| `riskScore` | Derived metric — no direct V1 equivalent | `assumed` | Derivation formula undefined |
| `positiveCount` | `COUNT` fail valuations per zone (via `em_location_zones` join) | `blocked` | `em_location_zones` + `em_location_coordinates` required |
| `sampleCount` | `COUNT` lots per zone | `blocked` | `em_location_zones` + `em_location_coordinates` required |
| `lastTestDate` | `MAX(CREATED_DATE)` per zone | `blocked` | Same dependency |
| `status` | Derived from zone fail rate | `blocked` | Same dependency |

**V1 equivalent:** `GET /api/em/heatmap` — fully implemented in V1. The heatmap was the terminal step in the drill-down chain: estate map → plant summary → plant floor list → active floorplan → floor heatmap → swab point detail. V1 used `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v` for results, and `em_location_coordinates` for x/y position, `em_plant_floor` for floor context. V1 heatmap was **point-level**: each marker represented an individual functional location (`func_loc_id`) with its x/y coordinate. Markers were coloured by INSPECTION_RESULT_VALUATION status.

**Design mismatch — V1 point-level vs V2 zone-level:** The V2 contract aggregates results to `zoneId` (zone-aggregate level). V1 displayed results at the individual inspection point level. This is a fundamental design difference, not merely a field-mapping gap. V2 would display fewer, larger cells on the heatmap surface compared to V1's granular point markers. This mismatch must be a conscious design decision, not an accidental contract choice.

**SAP QM data dependency:** `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` — for the result aggregates.

**Spatial config dependency:** `em_location_coordinates` (for x/y position), `em_plant_floor` (for floor context and active revision), `em_location_zones` (for zone-level aggregation). All three are app-managed tables with unconfirmed UAT existence. The heatmap cannot function without all three.

**V2 contract fit:** BLOCKED and OVERDESIGNED. The V2 contract introduces `hygieneZone` and `areaType` which do not exist in V1. `riskScore` is a derived metric with no V1 equivalent and no defined formula. Until the design mismatch (point vs zone level) is resolved and the app-managed tables are confirmed, no implementation work should begin.

**Route readiness:** BLOCKED.

**DDL required:** All three SAP QM gold views. All three app-managed spatial tables. Confirm existence with `SHOW TABLES` before any implementation.

**Implementation priority:** BLOCKED — pending spatial table verification and design mismatch resolution.

---

## `getEnvMonCorrectiveActions`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `actionId` | No CAPA source | `missing-source` | Not in V1 |
| `alertId` | No persistent alert records in V1 | `missing-source` | Not in V1 |
| `zoneId` | No CAPA source | `missing-source` | Not in V1 |
| `zoneName` | No CAPA source | `missing-source` | Not in V1 |
| `plantId` | No CAPA source | `missing-source` | Not in V1 |
| `title` | No CAPA source | `missing-source` | Not in V1 |
| `description` | No CAPA source | `missing-source` | Not in V1 |
| `actionType` | No CAPA source | `missing-source` | Not in V1 |
| `severity` | No CAPA source | `missing-source` | Not in V1 |
| `status` | No CAPA source | `missing-source` | Not in V1 |
| `assignee` | No CAPA source | `missing-source` | Not in V1 |
| `dueDate` | No CAPA source | `missing-source` | Not in V1 |
| `closedAt` | No CAPA source | `missing-source` | Not in V1 |
| `verifiedBy` | No CAPA source | `missing-source` | Not in V1 |
| `recurrence` | No CAPA source | `missing-source` | Not in V1 |

**V1 equivalent:** NOT IN V1. There are no corrective action tables, no CAPA routes, and no CAPA-related code anywhere in the V1 EnvMon codebase (`inspection_analysis/router.py`, `spatial_config/router.py`, `spatial_config/studio_router.py`). The V1 EnvMon domain recorded inspection results and displayed spatial heatmaps — it had no corrective action or case management capability.

**SAP QM data dependency:** None identified. SAP QM usage decisions (lot-level pass/fail) do not contain CAPA workflow data.

**Spatial config dependency:** None applicable — this capability does not exist.

**V2 contract fit:** The `EnvMonCorrectiveAction` contract is entirely speculative. Every field is missing-source. This is new scope that would require a dedicated CAPA system or application-managed table to be designed, built, and populated before any implementation is possible.

**Route readiness:** BLOCKED — no source.

**DDL required:** None identified — a new CAPA data model would need to be designed from scratch.

**Implementation priority:** NOT IN V1 — do not implement until the CAPA workflow is designed and a data source is identified. The existing mock data in the adapter MUST be clearly labelled as speculative with no V1 parity claim.

---

## `getEnvMonSwabVectors`

| Contract field | V1 / SAP QM source | Status | Gap / Blocker |
|---|---|---|---|
| `vectorId` | Generated — no native vector concept | `missing-source` | Not in V1 or SAP QM |
| `vectorName` | Not in V1 or SAP QM | `missing-source` | Not in V1 |
| `plantId` | `gold_inspection_lot.PLANT_ID` | `confirmed-v1` | — |
| `zoneIds` | Via `em_location_zones` | `blocked` | `em_location_zones` existence unconfirmed |
| `frequency` | No scheduling concept in SAP QM | `missing-source` | SAP QM is event-driven |
| `nextDueDate` | No scheduling concept in SAP QM | `missing-source` | SAP QM is event-driven |
| `lastCompletedDate` | `MAX(CREATED_DATE)` — approximate only | `assumed` | Not a true completion date |
| `status` | No scheduling status in SAP QM | `missing-source` | SAP QM is event-driven |
| `pointCount` | `COUNT(FUNCTIONAL_LOCATION)` per zone | `blocked` | Requires `em_location_zones` |
| `assignedTeam` | Not in gold views | `missing-source` | Not available from SAP QM |

**V1 equivalent:** V1 had no swab vector concept. V1 EnvMon was entirely event-driven: SAP QM inspection lots were created when swabs were taken, and results were recorded against lots. There was no sampling schedule, sampling vector, or route/path concept in the V1 data model or UI.

**SAP QM data dependency:** SAP QM is event-driven. There is no scheduling table, no sample plan with next-due-dates, and no concept of an assigned team in the gold inspection views. The `frequency`, `nextDueDate`, `status`, and `assignedTeam` fields have no SAP QM source.

**Spatial config dependency:** `zoneIds` requires `em_location_zones`.

**V2 contract fit:** The `EnvMonSwabVector` concept represents a sampling schedule / route management capability that does not exist in V1 or in the SAP QM gold layer. It would require a new application-managed scheduling system. The business rules for what constitutes a "vector" (a spatial path? a recurring sampling route?) are undefined.

**Route readiness:** DEFERRED INDEFINITELY.

**DDL required:** None identified — would require a new scheduling data model.

**Implementation priority:** DEFERRED INDEFINITELY — business rules undefined, no V1 equivalent, no SAP QM source. The existing mock data in the adapter is speculative placeholder only.

---

## Summary: Method-Level Gap Status

| Method | V1 equivalent | SAP QM fit | Spatial config dependency | Contract fit | Implementation priority |
|---|---|---|---|---|---|
| `getEnvMonContext` | `GET /api/em/plants` (partial) | PARTIAL | None (base); overdesigned fields need zone classification | PARTIAL | After `getEnvMonSiteSummary` DDL; strip/omit CAPA and risk-status fields |
| `getEnvMonSiteSummary` | `GET /api/em/plants` KPIs | GOOD (core fields) | `em_location_zones` for zone counts | PARTIAL — several fields blocked or overdesigned | HIGH — Rank 1; SAP QM core first |
| `getEnvMonZones` | `em_location_zones` zones | PARTIAL (aggregate stats) | `em_location_zones` — full dependency | OVERDESIGNED (`hygieneZone`, `areaType`) | BLOCKED — spatial tables + classification design |
| `getEnvMonAlerts` | Derived from `INSPECTION_RESULT_VALUATION` | PARTIAL (raw data available) | `em_location_zones` for `zoneId` | PARTIAL — lifecycle fields missing-source | DEFERRED — alert derivation rules undefined |
| `getEnvMonSwabResults` | `GET /api/em/lots` + `GET /api/em/lots/{lot_id}` | GOOD | `em_location_zones` for zone fields | GOOD (core); zone fields blocked | HIGH — Rank 2; SAP QM core after DDL |
| `getEnvMonTrends` | `GET /api/em/trends` | GOOD (core time-series) | `em_location_zones` for `complianceRate` | PARTIAL — alert counts missing-source | MEDIUM — Rank 3; alert counts must be omitted not zeroed |
| `getEnvMonHeatmap` | `GET /api/em/heatmap` | GOOD (counts/results) | `em_location_coordinates`, `em_plant_floor`, `em_location_zones` — all required | BLOCKED + OVERDESIGNED (point vs zone mismatch; `hygieneZone`/`areaType`) | BLOCKED — all spatial tables unconfirmed; design mismatch unresolved |
| `getEnvMonCorrectiveActions` | NOT IN V1 | NONE | None | OUT OF SCOPE — CAPA is not a V2 EnvMon parity requirement; intentionally not migrated | NOT IN V1 |
| `getEnvMonSwabVectors` | NOT IN V1 | NONE | `em_location_zones` for `zoneIds` | MISSING-SOURCE (scheduling concept) | DEFERRED INDEFINITELY — business rules undefined |
| `getEnvMonPlantMap` (proposed) | `GET /api/em/plants` + `em_plant_geo` | PARTIAL (KPIs); em_plant_geo required | `em_plant_geo` — UAT existence unknown | NOT IN CONTRACTS — proposed addition | Planned — after em_plant_geo confirmed + site-summary BV |
| `getEnvMonPlantHotspots` (proposed) | Derived from plant-level observation aggregate | GOOD (valuation counts) | None (uses observation aggregate) | NOT IN CONTRACTS — proposed addition | Planned — after getEnvMonPlantMap designed |
