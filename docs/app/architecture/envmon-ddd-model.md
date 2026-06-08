# EnvMon Domain-Driven Design Model

**Date:** 2026-05-17 (m.txt) | **Updated:** 2026-05-18 (read-only monitoring UI added; UI BV pending)
**Tranche:** m.txt (DDD framing + QuerySpec) → n.txt (site-summary route wired) → o.txt (4-BC structure) → p.txt (swab-results route wired)
**Status:** Observations BC — 2 native routes wired and API browser-verified (site-summary + swab-results); read-only monitoring UI implemented at `?workspace=envmon-monitoring`, UI BV pending; Spatial Configuration, Estate Monitoring, and Spatial Analysis deferred; CAPA/corrective actions out of scope for EnvMon V2 parity
**References:**
- `docs/migration/envmon-v1-deep-dive.md`
- `docs/audit/envmon-spatial-configuration-model.md`
- `docs/audit/envmon-v1-functional-capability-map.md`
- `docs/audit/envmon-v1-to-v2-parity-gap.md`
- `docs/migration/envmon-advisor-recommendation.md`
- `docs/migration/envmon-site-summary-native-route-plan.md`

---

## Overview

Environmental Monitoring (EnvMon) is a **hybrid domain** spanning four distinct bounded
contexts. V1 ConnectIO-RAD implemented all four in a single backend, which is why the
domain appeared simple. V2 separates them explicitly:

1. **EnvMon Observations** — read-only from SAP QM inspection lot data in the Databricks
   gold layer. System of record: SAP QM / Databricks ETL.
2. **EnvMon Spatial Configuration** — app-managed Delta tables for plant geolocation,
   floorplans, coordinates, zones, and revisions. System of record: EnvMon application
   (write APIs). Owns the spatial data needed for **both** the estate map and the floorplan
   heatmap.
3. **EnvMon Estate Monitoring** — composed read model using plant geolocation + plant-level
   observation aggregates. Enables the high-level geographic map of plants, plant hot spot
   markers, regional status, and drill-down into plant details.
4. **EnvMon Spatial Analysis** — composed read model joining Observations + Spatial
   Configuration at the in-plant scale. Enables floorplan heatmap, zone-level exposure,
   and point drill-through.

### Two spatial scales — key distinction

EnvMon operates at two distinct spatial scales, both managed within Spatial Configuration:

| Scale | Coordinate type | Purpose | Source table |
|---|---|---|---|
| **Estate / geographic** | WGS-84 latitude / longitude | Plant pins on map; hot spot status | `em_plant_geo` |
| **In-plant / floorplan** | x/y percentage (0–100%) of canvas | Functional-location pins on floorplan; heatmap | `em_location_coordinates` |

Plant geo coordinates are **not interchangeable with** floorplan x/y coordinates. They exist
at different scales, use different coordinate systems, and feed different read models.

### Drill-down chain

The end-to-end navigation hierarchy is:

```
estate map (plant lat/lon pins)
  → plant summary (site-level KPIs)
    → plant floor list (em_plant_floor per plant)
      → active floorplan (em_layout_revision state='published')
        → floor heatmap (location coordinates + observation results)
          → swab point detail (per-location lot / MIC results)
```

This chain depends on **both** spatial scales being populated:
- Estate map requires `em_plant_geo` (lat/lon)
- Heatmap requires `em_location_coordinates` (x/y %)

---

## Bounded Context A — EnvMon Observations

### System of record

SAP QM inspection lot and result data, surfaced as read-only Databricks gold views.
V2 has no write path into SAP QM.

### Domain boundary

Inspection types `'14'` and `'Z14'` only (recurring environmental monitoring and hygiene
swabs). Other inspection types are SAP QM scope but not EnvMon scope.

### Aggregate candidates

| Aggregate | Root entity | Notes |
|---|---|---|
| `InspectionLot` | `gold_inspection_lot` (INSPECTION_LOT_ID) | Contains points and results |
| `InspectionPoint` | `gold_inspection_point` (INSPECTION_POINT_ID) | One per sample location per lot |
| `QualityResult` | `gold_batch_quality_result_v` (composite key) | One per MIC characteristic per point |

### Read models (V2 contracts)

| Read model | Source query | Status |
|---|---|---|
| `EnvMonSiteSummary` | Aggregate KPI: total/fail/warn locations per plant per period | **✓ BV** — API browser-verified 2026-05-18; consumed by read-only monitoring UI |
| `EnvMonSwabResults` | Detail list: per-MIC result per sample point with valuation + derived status | **✓ BV** — API browser-verified 2026-05-18; read-only UI consumes native SAP QM shape because zoneId is unavailable |
| `EnvMonTrends` | Time-series: positive rate per period | Deferred — requires period-over-period query |
| `EnvMonAlerts` | Derived: lots breaching thresholds | Deferred — alert rules undefined |

### Key business rules (confirmed-v1)

- **Domain filter:** `INSPECTION_TYPE IN ('14', 'Z14')`
- **Valuation mapping:**
  - `R` / `REJ` / `REJECT` → fail (positive result — organism detected)
  - `W` / `WARN` / `WARNING` → warning (borderline)
  - `NULL` / empty → pending (no usage decision yet)
  - `A` or other non-null → pass (negative)
- **Join keys:**
  - `gold_inspection_lot` → `gold_inspection_point`: `INSPECTION_LOT_ID`
  - `gold_inspection_point` → `gold_batch_quality_result_v`: `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`
- **Positive rate semantics:** location-level fraction (fraction of locations with ≥1 fail),
  not sample-level. Matches V1 KPI semantics.

### What m.txt + n.txt + p.txt implement

- QuerySpec hardened for `getEnvMonSiteSummary` (LIMIT 1 fix) [m.txt]
- DDL confirmed for all three Group A views (2026-05-17) [n.txt]
- Route `GET /api/envmon/site-summary` **wired** in `apps/api/routes/envmon.py` [n.txt]
- 99 tests passing for site-summary (80 adapter + 19 route) [n.txt]
- Route `GET /api/envmon/swab-results` **wired** in `apps/api/routes/envmon.py` [p.txt]
- 56 new tests for swab-results (adapter QuerySpec + mapper + route tests) [p.txt]
- Read-only monitoring UI added at `?workspace=envmon-monitoring` with site summary, swab table, result detail, derived indicators, and limitations banner [2026-05-18]

### Deferred in Observations BC

- Legacy `EnvMonSwabResult` contract cleanup — zoneId/zoneName are not sourced from SAP QM
- `getEnvMonTrends` — Rank 3
- `getEnvMonAlerts` — Alert rules undefined

---

## Bounded Context B — EnvMon Spatial Configuration

### System of record

The EnvMon application itself — five app-managed Delta tables in TRACE_CATALOG / TRACE_SCHEMA.
This BC owns **all** spatial data for EnvMon: both the estate-scale plant coordinates (latitude
/ longitude) and the in-plant floorplan coordinates (x/y %).

### Why plant geolocation belongs here

Plant geolocation (`em_plant_geo`) is part of the same spatial configuration workstream as
floors, floorplans, coordinates, and zones. It is maintained alongside other plant spatial
data — not as a separate map feature. Plant geolocation setup is a **spatial configuration
maintenance** task.

### PlantSpatialModel hierarchy

```
PlantSpatialModel (per plant_id)
  ├── PlantGeoLocation          (em_plant_geo)            — lat/lon for estate map
  ├── PlantFloor[]              (em_plant_floor)          — floors with background image
  ├── FloorplanRevision[]       (em_layout_revision)      — draft/published/superseded lifecycle
  ├── MonitoringLocationPlacement[] (em_location_coordinates) — x/y % per func_loc on floor
  └── Zone[]                    (em_location_zones)       — polygon/rectangle geometry
```

### App-managed objects

| Table | Confirmed | Purpose |
|---|---|---|
| `em_plant_geo` | confirmed-v1 DDL | Plant lat/lon for estate map; visibility flag |
| `em_plant_floor` | confirmed-v1 DDL | Floor records with background_image_url + active_revision_id |
| `em_layout_revision` | confirmed-v1 DDL | Revision lifecycle: draft → published → superseded / rolled_back |
| `em_location_coordinates` | confirmed-v1 DDL | x/y % placement of functional locations on floor canvas |
| `em_location_zones` | confirmed-v1 DDL | L4 zones: polygon/rectangle geometry_json in % coords |

### em_plant_geo — confirmed-v1 DDL

Columns (from `003_create_em_plant_geo.sql`):

| Column | Type | Notes |
|---|---|---|
| `plant_id` | STRING NOT NULL | FK to plant; also FK to gold_inspection_lot.PLANT_ID |
| `lat` | DOUBLE NOT NULL | WGS-84 latitude |
| `lon` | DOUBLE NOT NULL | WGS-84 longitude |
| `updated_at` | TIMESTAMP | nullable; last update timestamp |
| `updated_by` | STRING | nullable; last update user |

**Responsibilities:**
- Owned and written by the EnvMon application (spatial configuration maintenance)
- Consumed by Estate Monitoring BC (read-only) to place plant pins on estate map
- `plant_id` links to `gold_inspection_lot.PLANT_ID` for observation aggregates
- Existence in connected_plant_uat: **unknown** — run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`

### Aggregate candidates

| Aggregate | Root entity | Notes |
|---|---|---|
| `PlantGeoLocation` | `em_plant_geo` (plant_id) | Estate-scale; lat/lon only |
| `PlantFloor` | `em_plant_floor` (floor_id) | A floor with canvas dimensions and background image |
| `FloorplanRevision` | `em_layout_revision` (revision_id) | draft → published → superseded / rolled_back |
| `MonitoringLocationPlacement` | `em_location_coordinates` (func_loc_id + floor_id) | x/y % on canvas |
| `Zone` | `em_location_zones` (zone_id) | Polygon/rectangle with geometry_json |

### Read models (candidate — not yet implemented)

| Read model | Route (proposed) | Source | Status |
|---|---|---|---|
| Plant geolocation | `GET /api/envmon/plant-map` | `em_plant_geo` | Planned — depends on em_plant_geo in UAT |
| Floor list per plant | `GET /api/envmon/floors` | `em_plant_floor` | Planned — depends on em_plant_floor in UAT |
| Published revision | `GET /api/envmon/floorplan` | `em_layout_revision` WHERE state='published' | Planned |
| Location coordinates | `GET /api/envmon/location-coordinates` | `em_location_coordinates` | Planned |
| Zone definitions | `GET /api/envmon/zones` | `em_location_zones` | Planned |

**None of these routes are wired.** Do not implement until em_* tables confirmed in UAT.

### Future commands

These commands do not exist in V2 yet. Do not implement in this tranche.

| Command | Description |
|---|---|
| `setPlantGeoLocation` | Set lat/lon for a plant in `em_plant_geo`; toggle estate map visibility |
| `uploadFloorplan` | Upload background image and create `em_plant_floor` row |
| `createFloorplanRevision` | Create draft revision for a floor |
| `publishFloorplanRevision` | Validate → supersede old → publish → set active_revision_id → bulk-stamp coords |
| `rollbackFloorplanRevision` | Restore previous published revision |
| `placeMonitoringLocation` | Set x/y % for a functional location on a floor |
| `assignLocationToZone` | Set parent_zone_id on a coordinate row |

### Key facts about this BC (confirmed-v1)

- `em_plant_geo` stores WGS-84 lat/lon. These are **not** x/y % coordinates.
- `em_plant_floor.background_image_url` is a plain string — no upload handler found in V1.
  V1 stored externally-hosted URLs. Upload workflow is out of V1 scope.
- `em_layout_revision.state` lifecycle: `draft` → `published` → `superseded` / `rolled_back`
- `em_location_zones` has NO `hygiene_zone` or `area_type` columns in V1 DDL. These V2
  contract fields require new schema design.

### Existence in UAT

**Unknown.** Run before designing any feature:
```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

If tables exist: update `docs/audit/envmon-spatial-configuration-model.md`.
If not: these tables are confirmed-v1 from V1 migrations but not yet deployed to UAT.

---

## Bounded Context C — EnvMon Estate Monitoring

### What this BC does

Estate Monitoring provides the high-level geographic overview of all plants. It combines
plant geolocation (lat/lon from Spatial Configuration) with plant-level observation aggregates
(from Observations BC) to produce a map view showing where plants are and which plants have
active environmental concerns.

### System of record

Composed read model — no tables of its own. Depends on:
- `em_plant_geo` (from Spatial Configuration BC) — plant lat/lon
- `EnvMonSiteSummary`-equivalent observation aggregates (from Observations BC) — per-plant KPIs

### User capabilities

- High-level map of all plants at geographic scale
- Plant hot spot markers: pass/warn/fail/non-compliant status per plant
- Regional or site-level status summary
- Drill-down from plant pin → plant summary → floor list → floorplan heatmap

### Aggregate candidates

| Aggregate | Source | Notes |
|---|---|---|
| `PlantMapEntry` | `em_plant_geo` JOIN plant-level observation aggregate | Composed; no dedicated table |
| `PlantHotspotStatus` | Derived from plant-level fail/warn/pass counts | Follows same valuation rules as Observations BC |

### Read models (candidate — not yet implemented)

| Read model | Route (proposed) | Source | Status |
|---|---|---|---|
| Estate map data | `GET /api/envmon/plant-map` | `em_plant_geo` + plant aggregate | Planned — PROPOSED contract (not in envmon-adapter.ts) |
| Plant hot spots | `GET /api/envmon/plant-hotspots` | plant aggregate (observation counts) | Planned — PROPOSED contract |

> **Note:** `getEnvMonPlantMap` and `getEnvMonPlantHotspots` do **not** currently exist in
> `domain-integrations/envmon/src/adapters/envmon-adapter.ts` or
> `packages/data-contracts/src/schemas/environmental-monitoring.ts`.
> They are **proposed** contract additions, not yet designed.

### When this BC can be implemented

1. `em_plant_geo` confirmed present in connected_plant_uat
2. `GET /api/envmon/site-summary` browser-verified (plant-level aggregate confirmed working)
3. New contract methods and types designed for `getEnvMonPlantMap` / `getEnvMonPlantHotspots`

---

## Bounded Context D — EnvMon Spatial Analysis

### System of record

Composed read model — joins Observations BC (A) + Spatial Configuration BC (B) at the
in-plant scale (x/y % coordinates on floorplan canvas).

### When this BC can be implemented

Only after:
1. Group A DDL confirmed (BC A route wired and browser-verified)
2. em_* tables confirmed present in connected_plant_uat (BC B tables exist)

### Read models (candidate — not yet implemented)

| Read model | Route (proposed) | Source | Status |
|---|---|---|---|
| Floorplan heatmap | `GET /api/envmon/heatmap` | lot + point + result_v + em_location_coordinates + em_plant_floor | Planned — depends on em_* in UAT |
| Zone exposure | `GET /api/envmon/zones` | em_location_zones + observation join | Planned |
| Critical zone exposures | — | em_location_zones JOIN point/result | Planned — em_* existence unknown |

---

## What m.txt + n.txt + o.txt + p.txt deliver

| Deliverable | Status |
|---|---|
| DDD framing document — 3-BC structure | Created (m.txt) |
| QuerySpec hardened (LIMIT 1 fix) | Done (m.txt) |
| QuerySpec + mapper tests | Added (m.txt) |
| Route plan document | Created (m.txt) |
| DDL confirmed for all three Group A views | Done (n.txt, 2026-05-17) |
| Route `GET /api/envmon/site-summary` | **WIRED** — `apps/api/routes/envmon.py` (n.txt) |
| Route tests for site-summary (19 tests) | Added (n.txt) |
| 99 tests passing (site-summary) | Done (n.txt) |
| CAPA scoped out explicitly | Done (n.txt) |
| DDD model updated to 4-BC structure | Done (o.txt) |
| Estate Monitoring BC (BC C) added | Done (o.txt) |
| Plant geolocation elevated to BC B core | Done (o.txt) |
| Two-scale spatial distinction documented | Done (o.txt) |
| Drill-down chain documented | Done (o.txt) |
| Browser verification checklist updated | Updated (n.txt, p.txt) |
| Route `GET /api/envmon/swab-results` | **WIRED** — `apps/api/routes/envmon.py` (p.txt) |
| Adapter QuerySpec + mapper for swab-results | Done (p.txt) |
| Route + adapter tests for swab-results (56 new) | Added (p.txt) |
| 608 total tests passing | Done (p.txt) |
| Frontend wiring (site-summary) | **NOT DONE** — deferred until BV passes |
| Frontend wiring (swab-results) | **NOT DONE** — deferred; zoneId unavailable + adapter mock-only |
| Spatial Configuration (BC B) routes | Deferred — em_* not confirmed in UAT |
| Estate Monitoring (BC C) routes | Deferred — em_plant_geo not confirmed in UAT |
| Spatial Analysis (BC D) routes | Deferred — em_* not confirmed in UAT |

---

## What remains deferred

| Feature | Blocked by |
|---|---|
| Browser verification (both routes) | UAT deployment not yet done |
| Frontend wiring (site-summary) | Browser verification not yet done |
| Frontend wiring (swab-results) | BV not done AND zoneId/zoneName unavailable (em_location_zones); adapter is mock-only with no fetch infrastructure |
| getEnvMonSwabResults zoneId/zoneName | em_location_zones existence in UAT unknown |
| getEnvMonTrends | Period-over-period query not designed |
| getEnvMonAlerts | Alert rules undefined |
| getEnvMonPlantMap / getEnvMonPlantHotspots | em_plant_geo in UAT + contract design required |
| getEnvMonZones | em_* existence in UAT unknown |
| getEnvMonHeatmap | em_* existence unknown + spatial coordinate placement |
| criticalZoneExposures (real value) | em_location_zones existence + zone classification schema |
| trendDirection (real value) | Period-over-period query not implemented |
| Plant geolocation maintenance (write) | setPlantGeoLocation command not designed |
| Floorplan upload | No V1 upload handler; new command API required |
| L4/hygiene zoning | hygiene_zone/area_type not in V1 DDL; new schema design required |

---

## What is NOT in EnvMon

### CAPA / Corrective Actions — out of scope for EnvMon V2 parity

CAPA (Corrective and Preventive Actions) and corrective action tracking are **not part of
EnvMon V2 parity**. V1 ConnectIO-RAD had no CAPA tables, no CAPA routes, and no CAPA
code in the EnvMon domain. There is no gold-layer source for corrective actions in
TRACE_CATALOG / TRACE_SCHEMA or any other confirmed Databricks catalog.

`getEnvMonCorrectiveActions` is intentionally not migrated. Its status is **out of scope**,
not blocked, deferred, or missing a source.

Any future CAPA or deviation management capability belongs in a **separate Quality Actions /
Deviation / CAPA bounded context** — not in any of the four EnvMon BCs. That bounded context
does not exist in V2 and requires its own domain analysis, data source identification, and
contract design.

**Do not:**
- Add CAPA routes to `apps/api/routes/envmon.py`
- Add CAPA source discovery for EnvMon
- Block EnvMon site-summary or any Observations BC feature on CAPA
- Model `CorrectiveAction` as an EnvMon aggregate

---

## Future contract cleanup

The following fields in `EnvMonSiteSummarySchema` (packages/data-contracts) exist only for
backwards contract compatibility with V1-era consumers. They carry no business facts in V2:

| Field | Current value | Reason to remove |
|---|---|---|
| `openCorrectiveActions` | Fixed 0 | No source; CAPA is out of scope for EnvMon V2 parity |
| `overdueActions` | Fixed 0 | No source; CAPA is out of scope for EnvMon V2 parity |

Proposal: remove these fields from `EnvMonSiteSummarySchema` in the next breaking-contract
cleanup tranche, or move them to a future Quality Actions bounded context schema. Also remove
`getEnvMonCorrectiveActions` from `envmon-adapter.ts` at that time.

This cleanup requires a coordinated contract change (Zod schema + TypeScript frontend
adapter + any downstream consumers) and is NOT part of this tranche.

---

## Architecture guardrails (non-negotiable)

- No SQL in React
- No SQL in FastAPI route handlers
- No SPN/PAT fallback for user-facing reads
- No silent fallback from databricks-api to mock or legacy-api
- No invented field values
- No placeholder values treated as factual business data
