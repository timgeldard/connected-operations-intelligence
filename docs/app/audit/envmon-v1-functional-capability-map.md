# EnvMon V1 Functional Capability Map

**Date:** 2026-05-17
**Tranche:** l.txt
**Domain:** Environmental Monitoring (EnvMon)
**Purpose:** Authoritative record of every V1 capability, its data sources, and its current V2 parity status. Use this as the reference when prioritising EnvMon implementation work.

> **Status update (n.txt, 2026-05-17):** CAPA/corrective actions (capability #12) are **out of scope** for EnvMon V2 parity.
> `getEnvMonCorrectiveActions` is intentionally not migrated. Future CAPA belongs to a separate Quality Actions bounded context.

> **Status update (o.txt, 2026-05-17):** Estate map / plant geolocation capabilities added (#16–#20).
> Plant geolocation is part of EnvMon Spatial Configuration (maintained with plant floor/spatial data).
> Estate Monitoring is a composed read model BC depending on `em_plant_geo` + plant-level observation aggregates.
> `getEnvMonPlantMap` and `getEnvMonPlantHotspots` are **proposed** — not yet in envmon-adapter.ts or data-contracts.

---

## Legend

| Column | Meaning |
|---|---|
| Exists in V1 | Whether V1 implements this capability at all |
| UI evidence | V1 frontend components that render this capability |
| Route / API evidence | V1 FastAPI routes that serve this capability |
| Data-source evidence | Confirmed-v1 tables / views that back this capability |
| Source files | Key V1 source files |
| V2 equivalent | V2 adapter method or design decision |
| V2 parity status | Current state of V2 implementation |
| Migration priority | Relative priority for V2 implementation |
| Blockers | What must be resolved before V2 can deliver parity |

---

## 1. Site Summary / Plant Overview

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx` — plant-level KPI cards |
| Route / API evidence | `GET /api/em/plants` — returns portfolio KPIs including lot counts, fail counts, active locations |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/plants.py` |
| V2 equivalent | `getEnvMonSiteSummary` → `EnvMonSiteSummary` |
| V2 parity status | PARTIAL — QuerySpec written, DDL verification pending for all three gold views |
| Migration priority | HIGH — first executable slice; no app-managed table dependency |
| Blockers | DDL confirmation for `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` in `connected_plant_uat` |

---

## 2. Swab or Inspection Result List

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `LocationPanel.tsx` → `LotsTab` renders lot list per location |
| Route / API evidence | `GET /api/em/lots` — inspection lots for a location; `GET /api/em/lots/{lot_id}` — individual lot MIC results |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/lots.py` |
| V2 equivalent | `getEnvMonSwabResults` → `EnvMonSwabResult[]` |
| V2 parity status | PARTIAL — mock only, no route wired; most fields mappable from SAP QM once DDL confirmed |
| Migration priority | HIGH — Rank 2 after site summary DDL confirmed |
| Blockers | DDL confirmation for the three gold views (same dependency as site summary) |

---

## 3. Trend View

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `LocationPanel.tsx` → `TrendTab` renders MIC time-series chart |
| Route / API evidence | `GET /api/em/trends` — MIC time-series; `GET /api/em/mics` — distinct MIC names |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/trends.py` |
| V2 equivalent | `getEnvMonTrends` → `EnvMonTrend[]` |
| V2 parity status | MOCK — contract has fields with no SAP QM source (newAlerts, resolvedAlerts, openAlerts, complianceRate); alert counts MUST NOT default to 0 as if factual |
| Migration priority | MEDIUM — Rank 3; same gold views as site summary |
| Blockers | DDL confirmation for the three gold views; alert derivation rules undefined |

---

## 4. Alerts / Fails / Warnings

| Attribute | Detail |
|---|---|
| Exists in V1 | YES (derived, not first-class) |
| UI evidence | `GlobalView.tsx` KPI cards show fail counts; `FloorPlan.tsx` → `Marker.tsx` uses marker colours to indicate risk/SPC fail |
| Route / API evidence | `GET /api/em/plants` KPI response includes active_fails count; `GET /api/em/heatmap` includes INSPECTION_RESULT_VALUATION per marker |
| Data-source evidence | `gold_batch_quality_result_v.INSPECTION_RESULT_VALUATION` (R/REJ/REJECT = fail; WARN = warning) — confirmed-v1 |
| Source files | `inspection_analysis/plants.py`, `inspection_analysis/heatmap.py` |
| V2 equivalent | `getEnvMonAlerts` → `EnvMonAlert[]` |
| V2 parity status | MOCK — alert derivation rules (threshold, escalation, alert lifecycle) undefined; V1 had no persistent alert records |
| Migration priority | MEDIUM — deferred until alert derivation rules are agreed |
| Blockers | Alert derivation rules (what constitutes an alert vs. a fail); `alertId` synthetic generation strategy; `correctiveActionId` has no source |

---

## 5. Floorplan Maintenance

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx`, `StudioCanvas.tsx` — admin UI for floor CRUD |
| Route / API evidence | `spatial_config/router.py` — CRUD endpoints for `/api/em/floors` (create, update, delete floor records) |
| Data-source evidence | `em_plant_floor` (confirmed-v1; existence in UAT unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/floors.py` |
| V2 equivalent | No direct V2 adapter method — admin configuration panel not designed |
| V2 parity status | NOT DESIGNED |
| Migration priority | HIGH for full V1 parity — configuration panel must exist for operators to manage floorplans |
| Blockers | `em_plant_floor` existence in `connected_plant_uat` unconfirmed; admin panel design not started |

---

## 6. Floorplan / Map Image Upload

| Attribute | Detail |
|---|---|
| Exists in V1 | PARTIAL |
| UI evidence | `StudioCanvas.tsx` — renders `background_image_url` as a background image on the canvas |
| Route / API evidence | No upload handler found in V1 repository — `background_image_url` is stored as a plain string column; image hosting appears external |
| Data-source evidence | `em_plant_floor.background_image_url` (VARCHAR column; confirmed-v1 schema, UAT existence unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/floors.py` |
| V2 equivalent | NOT DESIGNED — no image upload method in V2 adapter |
| V2 parity status | NOT DESIGNED |
| Migration priority | BLOCKED |
| Blockers | Image storage provider unknown; no upload handler identified in V1; cannot replicate without knowing where images are hosted and how URLs are generated |

---

## 7. Multiple Floorplans per Plant

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SiteView.tsx` — floor selector rail; `HierarchyRail.tsx` — lists floors by sort order |
| Route / API evidence | `GET /api/em/floors` — returns floors for a plant; `em_plant_floor` has `plant_id + floor_id` composite PK with `sort_order` column |
| Data-source evidence | `em_plant_floor` (confirmed-v1; `sort_order` column confirmed) |
| Source files | `spatial_config/router.py` |
| V2 equivalent | `getEnvMonZones` → `EnvMonZone[]` references `floorId` field in contract |
| V2 parity status | PARTIAL — `floorId` present in contract but source blocked pending `em_plant_floor` existence confirmation in UAT |
| Migration priority | MEDIUM — dependency of heatmap parity |
| Blockers | `em_plant_floor` existence in `connected_plant_uat` unconfirmed |

---

## 8. Active Floorplan / Revision Selection

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx` — revision history panel; `PublishDialog.tsx` — promote draft to published |
| Route / API evidence | `studio_router.py` — `/api/em/spatial/draft`, `/api/em/spatial/publish`, `/api/em/spatial/rollback`, revision history endpoint |
| Data-source evidence | `em_plant_floor.active_revision_id` FK → `em_layout_revision`; revision states: `draft`, `published`, `superseded`, `rolled_back` (all confirmed-v1) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/revisions.py` |
| V2 equivalent | No active-revision selection method in V2 adapter |
| V2 parity status | NOT DESIGNED |
| Migration priority | MEDIUM — needed for heatmap parity (must know which revision's coordinates to display) |
| Blockers | `em_layout_revision` and `em_plant_floor` existence in UAT unconfirmed; admin panel design not started |

---

## 9. Functional-Location Coordinate Placement

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `StudioCanvas.tsx` → `PointLayer.tsx` — drag-and-drop placement of inspection point markers; `InspectorPanel.tsx` — coordinate editor |
| Route / API evidence | `spatial_config/router.py` — `GET /api/em/locations` (functional locations with mapping status), coordinate update endpoint |
| Data-source evidence | `em_location_coordinates` with `x_pos`, `y_pos` per `func_loc_id` (confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/coordinates.py` |
| V2 equivalent | `getEnvMonHeatmap` requires coordinates; no coordinate placement method in V2 adapter |
| V2 parity status | BLOCKED — heatmap cannot display without `x_pos`/`y_pos` from `em_location_coordinates` |
| Migration priority | HIGH for heatmap parity — coordinate data is the spatial backbone of the heatmap view |
| Blockers | `em_location_coordinates` existence in `connected_plant_uat` unconfirmed |

---

## 10. L4 / Hygiene Zone Maintenance

| Attribute | Detail |
|---|---|
| Exists in V1 | YES (as generic L4 spatial zones — NOT as hygiene/area classification) |
| UI evidence | `ZoneLayer.tsx` — renders zone polygons; `ValidationPanel.tsx` — validates zone coverage; `SpatialStudio.tsx` — zone authoring workflow |
| Route / API evidence | `studio_router.py` zones CRUD — `/api/em/spatial/zones`; zones have `zone_name`, `geometry_type`, associated `functional_location_id` (L4 level) |
| Data-source evidence | `em_location_zones` with L4 `functional_location_id` + `zone_name` + geometry (confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/zones.py` |
| V2 equivalent | `getEnvMonZones` → `EnvMonZone[]` |
| V2 parity status | PARITY GAP — V2 contract adds `hygieneZone` (zone-1/2/3/4) and `areaType` (production/storage/packaging/utility/corridor/other); V1 zones are generic L4 spatial areas with `zone_name` and geometry only; there is NO hygiene classification in V1 |
| Migration priority | HIGH gap — these fields are OVERDESIGNED relative to V1; adding them requires a new zone classification table or an extension of `em_location_zones` |
| Blockers | `em_location_zones` existence in UAT unconfirmed; `hygieneZone` / `areaType` classification logic undefined; no V1 source for these fields |

---

## 11. Heatmap / Spatial Result Display

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `FloorView.tsx` → `FloorPlan.tsx` → `Marker.tsx` + `Tooltip.tsx` — spatial heatmap of inspection points coloured by risk/SPC status |
| Route / API evidence | `GET /api/em/heatmap` — heatmap markers with risk score, SPC status, and coordinates |
| Data-source evidence | `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v` (confirmed-v1) + `em_location_coordinates` + `em_plant_floor` (confirmed-v1 schema; UAT existence unknown) |
| Source files | `inspection_analysis/heatmap.py`, `spatial_config/floors.py` |
| V2 equivalent | `getEnvMonHeatmap` → `EnvMonHeatmapCell[]` |
| V2 parity status | BLOCKED — requires `em_location_coordinates` + `em_plant_floor` + `em_location_zones` |
| Migration priority | HIGH for V1 parity — flagship visual feature of EnvMon |
| Blockers | `em_location_coordinates`, `em_plant_floor`, and `em_location_zones` existence in `connected_plant_uat` all unconfirmed; V2 contract is zone-aggregate level whereas V1 heatmap was point-level (design mismatch — see File 2) |

---

## 12. Corrective Actions / CAPA

| Attribute | Detail |
|---|---|
| Exists in V1 | NOT IN V1 |
| UI evidence | None found |
| Route / API evidence | No CAPA routes in `inspection_analysis/router.py` or `spatial_config/router.py` |
| Data-source evidence | No CAPA tables identified in V1 schema; no gold view for corrective actions |
| Source files | None |
| V2 equivalent | `getEnvMonCorrectiveActions` → `EnvMonCorrectiveAction[]` |
| V2 parity status | ZERO — contract is entirely speculative; no V1 behaviour to replicate |
| Migration priority | NOT IN V1 — requires new design before implementation; do not implement until CAPA workflow is designed and a data source is identified |
| Blockers | No data source; no V1 precedent; CAPA business workflow undefined |

---

## 13. Drill-Through from Map Point to Result / Inspection Lot

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `FloorPlan.tsx` → `Marker.tsx` click → `LocationPanel.tsx` → `LotsTab` + `TrendTab` |
| Route / API evidence | `GET /api/em/locations/{func_loc_id}/summary` — location detail including lot history and trend |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/locations.py` |
| V2 equivalent | No direct equivalent adapter method — V2 has `getEnvMonSwabResults` and `getEnvMonTrends` but no combined location-drill-through method |
| V2 parity status | NOT DESIGNED as a combined method; may be assembled from `getEnvMonSwabResults` + `getEnvMonTrends` filtered by location |
| Migration priority | MEDIUM — dependent on swab results and trends implementation |
| Blockers | Requires swab results and trends DDL to be confirmed; heatmap interaction design needed |

---

## 14. Plant / Date / Type Filters

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx`, `SiteView.tsx`, `FloorView.tsx` — all have plant selector and date range picker; `LocationPanel.tsx` has MIC type filter |
| Route / API evidence | All `GET /api/em/*` routes accept `plant_id` and date range parameters; `/api/em/trends` and `/api/em/lots` also accept MIC name filter |
| Data-source evidence | Filters applied at query layer against `gold_inspection_lot.PLANT_ID` and date columns |
| Source files | All `inspection_analysis/` modules |
| V2 equivalent | All adapter request types include `plantId`, `periodStart`, `periodEnd`; some include `micName` / `testType` |
| V2 parity status | GOOD — filter contract matches V1 behaviour; no gaps identified |
| Migration priority | LOW — already correct in contract; no additional work needed |
| Blockers | None |

---

## 15. Admin / Configuration Workflows

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx`, `StudioCanvas.tsx`, `ZoneLayer.tsx`, `PointLayer.tsx`, `PublishDialog.tsx`, `ValidationPanel.tsx` — full Spatial Studio workflow |
| Route / API evidence | `studio_router.py` — draft, publish, validate, rollback, zones CRUD, revision history; `spatial_config/router.py` — plant-geo, floors CRUD |
| Data-source evidence | `em_plant_floor`, `em_location_coordinates`, `em_location_zones`, `em_layout_revision`, `em_plant_geo` (all confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/router.py` |
| V2 equivalent | No admin panel designed in V2 |
| V2 parity status | NOT DESIGNED |
| Migration priority | BLOCKED until spatial tables confirmed in `connected_plant_uat` |
| Blockers | All five app-managed tables (`em_plant_floor`, `em_location_coordinates`, `em_location_zones`, `em_layout_revision`, `em_plant_geo`) existence in UAT unconfirmed; admin panel design not started; image upload storage unknown |

---

---

## 16. Estate / Multi-Plant Map View

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx` — high-level geographic map showing all plants as pins; plant markers coloured by risk status |
| Route / API evidence | `GET /api/em/plants` returns plant-level KPIs including coordinates for map placement; estate map view was part of V1 GlobalView |
| Data-source evidence | `em_plant_geo` (lat/lon per plant — confirmed-v1 DDL); plant-level KPI from `gold_inspection_lot` + SAP QM gold views |
| Source files | `spatial_config/router.py` (em_plant_geo read); `inspection_analysis/plants.py` (KPI aggregates) |
| V2 equivalent | `getEnvMonPlantMap` → `EnvMonPlantMap` (PROPOSED — not yet in envmon-adapter.ts or data-contracts) |
| V2 parity status | NOT DESIGNED — `getEnvMonPlantMap` does not exist in V2 adapter or contracts; em_plant_geo existence in UAT unknown |
| Next action | Confirm em_plant_geo in UAT; design `getEnvMonPlantMap` contract combining lat/lon + plant-level observation aggregate |

---

## 17. Plant Geolocation Maintenance

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx` or `GlobalView.tsx` admin interface — setting lat/lon for each plant as part of spatial configuration |
| Route / API evidence | `spatial_config/router.py` — plant-geo CRUD endpoint (set/update plant lat/lon) |
| Data-source evidence | `em_plant_geo` (plant_id, lat, lon, updated_at, updated_by — confirmed-v1 DDL from `003_create_em_plant_geo.sql`) |
| Source files | `spatial_config/router.py` |
| V2 equivalent | `setPlantGeoLocation` command (PROPOSED — not yet in V2 adapter) |
| V2 parity status | NOT DESIGNED — plant geolocation write API not designed in V2; em_plant_geo existence in UAT unknown |
| Next action | Confirm em_plant_geo in UAT; implement read-only `GET /api/envmon/plant-map` first; defer write API (setPlantGeoLocation) to spatial configuration maintenance workstream |

---

## 18. Plant Hot Spot Status on Map

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx` — plant map markers coloured/sized by hot spot status (fail = red, warn = amber, clean = green) |
| Route / API evidence | Plant-level observation aggregate from `GET /api/em/plants`; status derived from INSPECTION_RESULT_VALUATION counts |
| Data-source evidence | `em_plant_geo` (coordinates) + `gold_inspection_lot` + SAP QM gold views (observation counts) |
| Source files | `inspection_analysis/plants.py`, `spatial_config/router.py` |
| V2 equivalent | `getEnvMonPlantHotspots` (PROPOSED — not yet in envmon-adapter.ts or data-contracts) |
| V2 parity status | NOT DESIGNED — no `getEnvMonPlantHotspots` contract; hot spot derivation logic would mirror site-summary valuation rules |
| Next action | Design contract for plant hot spot summary; implement after `em_plant_geo` confirmed and `GET /api/envmon/site-summary` browser-verified |

---

## 19. Drill-Down: Estate Map → Plant Summary

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx` plant pin click → `SiteView.tsx` plant summary (KPIs, floor list) |
| Route / API evidence | Navigation from plant map to `GET /api/em/plants/{plant_id}` or equivalent plant-summary endpoint |
| Data-source evidence | `em_plant_geo` (for map entry point); `gold_inspection_lot` + SAP QM gold views (for plant-level KPIs) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/plants.py` |
| V2 equivalent | Plant pin click → `getEnvMonSiteSummary` for selected plant |
| V2 parity status | PARTIAL — `getEnvMonSiteSummary` exists (route wired, DDL confirmed); estate map entry point (`getEnvMonPlantMap`) not yet designed |
| Next action | Estate map entry point requires `getEnvMonPlantMap` contract; plant summary already implemented (`GET /api/envmon/site-summary`) |

---

## 20. Drill-Down: Plant Summary → Floorplan / Floor Heatmap

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SiteView.tsx` floor selector rail → `FloorView.tsx` → `FloorPlan.tsx` heatmap |
| Route / API evidence | `GET /api/em/floors` → `GET /api/em/heatmap?plant_id=…&floor_id=…` |
| Data-source evidence | `em_plant_floor` (floor list) + `em_location_coordinates` + SAP QM gold views (heatmap values) |
| Source files | `spatial_config/router.py` (floors), `inspection_analysis/heatmap.py` |
| V2 equivalent | `GET /api/envmon/floors` (PROPOSED) → `GET /api/envmon/heatmap` (PROPOSED) |
| V2 parity status | NOT DESIGNED — floor list and heatmap routes not yet implemented; depends on em_* in UAT |
| Next action | Confirm em_plant_floor and em_location_coordinates in UAT; implement `GET /api/envmon/floors` read model; implement floorplan heatmap last in sequence |

---

## Summary Table

| # | Capability | Exists in V1 | V2 parity status | Priority |
|---|---|---|---|---|
| 1 | Site summary / plant overview | YES | PARTIAL — QuerySpec written, DDL pending | HIGH |
| 2 | Swab / inspection result list | YES | PARTIAL — mock only | HIGH |
| 3 | Trend view | YES | MOCK (alert fields overdesigned) | MEDIUM |
| 4 | Alerts / fails / warnings | YES (derived) | MOCK — derivation rules undefined | MEDIUM |
| 5 | Floorplan maintenance | YES | NOT DESIGNED | HIGH |
| 6 | Floorplan / map image upload | PARTIAL (URL stored, no handler) | NOT DESIGNED | BLOCKED |
| 7 | Multiple floorplans per plant | YES | PARTIAL — `floorId` in contract, source blocked | MEDIUM |
| 8 | Active floorplan / revision selection | YES | NOT DESIGNED | MEDIUM |
| 9 | Functional-location coordinate placement | YES | BLOCKED — `em_location_coordinates` needed | HIGH |
| 10 | L4 / hygiene zone maintenance | YES (generic zones, no hygiene classification) | PARITY GAP — V2 contract overdesigned | HIGH gap |
| 11 | Heatmap / spatial result display | YES | BLOCKED — `em_*` tables needed | HIGH |
| 12 | Corrective actions / CAPA | NOT IN V1 | OUT OF SCOPE — not a V2 EnvMon parity requirement | NOT IN V1 |
| 13 | Drill-through: map point → result | YES | NOT DESIGNED as combined method | MEDIUM |
| 14 | Plant / date / type filters | YES | GOOD — contract matches V1 | LOW |
| 15 | Admin / configuration workflows | YES (full Spatial Studio) | NOT DESIGNED | BLOCKED |
| 16 | Estate / multi-plant map view | YES | NOT DESIGNED — `getEnvMonPlantMap` proposed, not in contracts | HIGH |
| 17 | Plant geolocation maintenance | YES | NOT DESIGNED — write API not designed; em_plant_geo UAT unknown | MEDIUM |
| 18 | Plant hot spot status on map | YES | NOT DESIGNED — `getEnvMonPlantHotspots` proposed, not in contracts | HIGH |
| 19 | Drill-down: estate map → plant summary | YES | PARTIAL — plant summary exists; estate map entry point not yet designed | MEDIUM |
| 20 | Drill-down: plant summary → floorplan | YES | NOT DESIGNED — floor list + heatmap routes not implemented | MEDIUM |
