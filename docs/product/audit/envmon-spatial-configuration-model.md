# EnvMon V1 Spatial Configuration Model

**Date:** 2026-05-17  
**Tranche:** l.txt — V1 deep-dive recovery | **Updated:** 2026-05-17 (o.txt — plant geo elevated to core, PlantSpatialModel hierarchy added)
**Status:** CONFIRMED-V1 — DDL from V1 migration scripts; existence in connected_plant_uat UNKNOWN  
**V1 source:** `ConnectIO-RAD/apps/envmon/scripts/migrations/` (migration scripts 001b–007)  
**Reference:** `docs/migration/envmon-v1-deep-dive.md`, `docs/audit/envmon-native-column-verification-checklist.md`, `docs/architecture/envmon-ddd-model.md`

---

## Overview

EnvMon V1 includes a full app-managed spatial configuration sub-system alongside its SAP QM read model. This sub-system owns **all** spatial data for EnvMon — both the estate-level plant coordinates (latitude/longitude) and the in-plant floorplan coordinates (x/y %). It maintains:

- Plant geographic coordinates for the estate map (lat/lon — **WGS-84**)
- Multiple floor plans per plant (SVG/image background with metadata)
- Functional location (SAP TPLNR) coordinate placement on floor plans (**x/y % of canvas**)
- L4 spatial zone definitions (polygon and rectangle geometry in % coordinates)
- Layout revision lifecycle (draft → published → superseded / rolled_back)

All five app-managed tables are Delta tables in **TRACE_CATALOG / TRACE_SCHEMA** — the same catalog as the SAP QM gold views. There is no separate EM_CATALOG.

**Critical note:** These tables may not exist in `connected_plant_uat`. Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` before designing any V2 spatial feature.

---

## Two spatial scales — key distinction

This spatial configuration model operates at two distinct scales. Both are managed here; neither replaces the other:

| Scale | Table | Coordinate type | Purpose |
|---|---|---|---|
| **Estate / geographic** | `em_plant_geo` | WGS-84 latitude/longitude | Plant pins on geographic map; hot spot status per plant |
| **In-plant / floorplan** | `em_location_coordinates` | x/y percentage (0–100%) of canvas | Functional-location pins on floorplan; heatmap |

Plant geo coordinates are **not** floorplan x/y coordinates. They exist at different scales, use different coordinate systems, and feed different read models (Estate Monitoring BC vs Spatial Analysis BC).

---

## PlantSpatialModel hierarchy

Each plant has one spatial model composed of all five tables:

```
PlantSpatialModel (per plant_id)
  ├── PlantGeoLocation          (em_plant_geo)               — lat/lon for estate map
  ├── PlantFloor[]              (em_plant_floor)             — floors with background image
  ├── FloorplanRevision[]       (em_layout_revision)         — draft/published/superseded lifecycle
  ├── MonitoringLocationPlacement[] (em_location_coordinates) — x/y % per func_loc on floor
  └── Zone[]                    (em_location_zones)          — polygon/rectangle geometry
```

**Ownership:** All five tables are owned and written by the EnvMon application (spatial configuration maintenance). Plant geolocation setup is part of this same workstream — not a separate map feature.

---

## Table 1: `em_plant_floor`

**Purpose:** Per-plant floor plan configuration — one row per floor per plant.  
**V1 migration source:** `001c_create_em_plant_floor.sql` + `006_extend_em_plant_floor_canvas.sql`  
**V2 dependency:** Required for `getEnvMonHeatmap` (floor background), floor list read model

### Schema (fully confirmed-v1)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `plant_id` | STRING | NOT NULL | SAP 4-character plant code, e.g. P225 |
| `floor_id` | STRING | NOT NULL | Short floor identifier, e.g. F1; used in URLs and coordinates |
| `floor_name` | STRING | NOT NULL | Human-readable label, e.g. Ground Floor |
| `svg_url` | STRING | nullable | Legacy URL to floor plan SVG (pre-Studio rows) |
| `svg_width` | DOUBLE | nullable | SVG viewBox width in pixels |
| `svg_height` | DOUBLE | nullable | SVG viewBox height in pixels |
| `sort_order` | INT | NOT NULL | Display order within a plant (ascending) |
| `created_at` | TIMESTAMP | NOT NULL | When this floor record was added |
| `canvas_type` | STRING | nullable | `floor_plan` or `grid`; defaults to floor_plan for existing rows |
| `canvas_width` | DOUBLE | nullable | Canvas width in canvas_units |
| `canvas_height` | DOUBLE | nullable | Canvas height in canvas_units |
| `canvas_units` | STRING | nullable | `pct` or `px` |
| `grid_size` | DOUBLE | nullable | Grid cell size; only used when canvas_type = grid |
| `scale_value` | DOUBLE | nullable | Real-world metres (or feet) per canvas unit |
| `scale_units` | STRING | nullable | `m` or `ft` |
| `background_image_url` | STRING | nullable | Replaces svg_url for new Studio authoring; keeps svg_url for legacy CoordinateMapper |
| `background_image_type` | STRING | nullable | `svg`, `png`, or `jpg` |
| `background_checksum` | STRING | nullable | SHA-256 of the uploaded background file |
| `active_revision_id` | STRING | nullable | FK → em_layout_revision.revision_id; NULL until first Studio publish |

### Key facts

- `plant_id + floor_id` is the logical composite key (no explicit CONSTRAINT in V1 DDL, but treated as unique in application code)
- Multiple floors per plant are supported via `sort_order`
- Both `svg_url` (legacy) and `background_image_url` (Studio) coexist — Studio rows set `background_image_url`; legacy rows have `svg_url`
- `active_revision_id` is NULL for pre-Studio floors — they have coordinates but no revision
- **Image hosting:** `background_image_url` and `svg_url` are plain string columns. No upload handler was found in the V1 repo. Actual file hosting is external. The URL is entered or set via the spatial config CRUD endpoint.

---

## Table 2: `em_location_coordinates`

**Purpose:** Maps SAP functional locations (TPLNR) to floor plan X/Y coordinates.  
**V1 migration source:** `001b_create_em_location_coordinates.sql` + `007_extend_em_location_coordinates_zones.sql`  
**V2 dependency:** Required for `getEnvMonHeatmap` (x/y position of each sample point)

### Schema (fully confirmed-v1)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `plant_id` | STRING | NOT NULL | SAP 4-character plant code |
| `func_loc_id` | STRING | NOT NULL | SAP functional location code (TPLNR), e.g. Q225-0101-SEV3-Z0-72 |
| `floor_id` | STRING | NOT NULL | FK → em_plant_floor.floor_id |
| `x_pos` | DOUBLE | NOT NULL | Relative X position (0.0–100.0 %) on the floor plan image |
| `y_pos` | DOUBLE | NOT NULL | Relative Y position (0.0–100.0 %) on the floor plan image |
| `updated_by` | STRING | NOT NULL | Databricks identity who last saved coordinates |
| `updated_at` | TIMESTAMP | NOT NULL | Timestamp of last coordinate update |
| `parent_zone_id` | STRING | nullable | FK → em_location_zones.zone_id; NULL for unassigned L5 points |
| `placement_source` | STRING | nullable | `manual`, `copied`, `migrated`, or `imported` |
| `revision_id` | STRING | nullable | FK → em_layout_revision.revision_id; NULL for pre-Studio points |
| `validation_status` | STRING | nullable | `ok`, `warning`, or `error` |
| `validation_messages_json` | STRING | nullable | JSON array of validation issue descriptions |

### Key facts

- X/Y positions are **relative percentages** (0–100), not pixel coordinates — floor plan-independent
- `func_loc_id` links this table to `gold_inspection_point.FUNCTIONAL_LOCATION` — the join key for heatmap
- Pre-Studio rows have `revision_id = NULL` and `parent_zone_id = NULL`
- After a Studio publish, all coordinates in the revision get `parent_zone_id` bulk-stamped

---

## Table 3: `em_layout_revision`

**Purpose:** Layout revision lifecycle management — one row per revision per floor per plant.  
**V1 migration source:** `004_create_em_layout_revision.sql`  
**V2 dependency:** Required for active revision selection, heatmap parity, zone versioning

### Schema (fully confirmed-v1)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `revision_id` | STRING | NOT NULL (PK) | UUID for this revision |
| `plant_id` | STRING | NOT NULL | SAP 4-character plant code |
| `floor_id` | STRING | NOT NULL | Short floor identifier |
| `revision_number` | INT | NOT NULL | Monotonically increasing per (plant_id, floor_id) |
| `state` | STRING | NOT NULL | `draft` \| `published` \| `superseded` \| `rolled_back` |
| `base_revision_id` | STRING | nullable | revision_id this draft branched from; NULL for first revision |
| `change_reason` | STRING | nullable | Human-readable reason; required at publish time |
| `publish_summary_json` | STRING | nullable | JSON: counts of zones, points, warnings at publish |
| `validation_summary_json` | STRING | nullable | JSON: last validation result |
| `created_by` | STRING | NOT NULL | Identity that created this revision |
| `created_at` | TIMESTAMP | NOT NULL | Creation time (UTC) |
| `published_by` | STRING | nullable | Identity that published; NULL until published |
| `published_at` | TIMESTAMP | nullable | Publish time (UTC); NULL until published |
| `rolled_back_from_revision_id` | STRING | nullable | Populated when state = rolled_back |

### Revision lifecycle

```
              create_revision()
                     │
                  [draft]
                     │
         update_revision_state()
      validate → publish workflow
                     │
               [published]  ←─── set_active_revision() on em_plant_floor
                     │
         (next draft branched) → [superseded]
                     │
         rollback_revision()
                     │
              [rolled_back]
```

**At any time, at most one revision per (plant_id, floor_id) can be in `published` state.**  
`em_plant_floor.active_revision_id` always points to the current published revision.

### Publish workflow (confirmed-v1 from `application/layout_publish.py`)

1. Validate revision — compute validation_summary_json; optionally block on errors
2. Find and supersede the currently published revision (state → superseded)
3. Mark draft as published (state → published; set published_by, published_at)
4. Set `em_plant_floor.active_revision_id` to the new revision_id
5. Bulk-stamp `em_location_coordinates.parent_zone_id` for all points in this revision

---

## Table 4: `em_location_zones`

**Purpose:** L4 spatial zone definitions — polygons or rectangles drawn on the floor plan.  
**V1 migration source:** `005_create_em_location_zones.sql`  
**V2 dependency:** Required for `getEnvMonZones`, zone-level `getEnvMonHeatmap`, zone classification

### Schema (fully confirmed-v1)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `zone_id` | STRING | NOT NULL (PK) | UUID for this zone |
| `plant_id` | STRING | NOT NULL | SAP 4-character plant code |
| `floor_id` | STRING | NOT NULL | Short floor identifier |
| `functional_location_id` | STRING | nullable | SAP L4 functional location code |
| `functional_location_level` | INT | nullable | Hierarchy level; expected 4 for L4 zones |
| `zone_name` | STRING | NOT NULL | Human-readable zone label |
| `geometry_type` | STRING | NOT NULL | `polygon` or `rectangle` |
| `geometry_json` | STRING | NOT NULL | Canonical geometry JSON (vertex list or corner coords in % coordinates) |
| `bbox_json` | STRING | nullable | Bounding box: {x_min_pct, y_min_pct, x_max_pct, y_max_pct} |
| `centroid_x` | DOUBLE | nullable | Zone centroid x in % coordinates (0–100) |
| `centroid_y` | DOUBLE | nullable | Zone centroid y in % coordinates (0–100) |
| `parent_zone_id` | STRING | nullable | FK to zone_id of parent zone (reserved, future nested zones) |
| `revision_id` | STRING | NOT NULL | FK → em_layout_revision.revision_id |
| `status` | STRING | NOT NULL | `draft` \| `published` \| `archived` |
| `created_by` | STRING | NOT NULL | Identity that created this zone |
| `created_at` | TIMESTAMP | NOT NULL | Creation time (UTC) |
| `updated_by` | STRING | NOT NULL | Identity that last updated this zone |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification time (UTC) |

### Key facts

- **V1 zones are generic L4 spatial areas.** There is NO `hygiene_zone` column (zone-1/2/3/4). There is NO `area_type` column (production/storage/packaging/...).
- The V2 contract fields `hygieneZone` and `areaType` in `EnvMonZone` and `EnvMonHeatmapCell` have **no direct V1 source**.
- `functional_location_id` at `functional_location_level = 4` is the L4 TPLNR used to group sample points by zone.
- Zones are versioned: `revision_id` links each zone to a layout revision.
- `em_location_coordinates.parent_zone_id` → `em_location_zones.zone_id` links points to zones.

### V2 contract gap: hygieneZone and areaType

The V2 `EnvMonZone` contract requires `hygieneZone: 'zone-1'|'zone-2'|'zone-3'|'zone-4'` and `areaType: 'production'|'storage'|'packaging'|'utility'|'corridor'|'other'`. These enums have no V1 column equivalent. To implement them in V2, one of:
- Extend `em_location_zones` with new columns `hygiene_zone` and `area_type`
- Create a new zone classification table mapping zone_id → classification
- Add classification to V2 admin UI as a new zone property

This is a new design task, not a V1 migration. **Do not default these fields to arbitrary values.**

---

## Table 5: `em_plant_geo`

**Purpose:** Plant geographic coordinates (WGS-84 lat/lon) for the estate map view — plant pins on a geographic map.  
**V1 migration source:** `003_create_em_plant_geo.sql`  
**V2 dependency:** Required — feeds EnvMon Estate Monitoring BC (estate map, plant hot spot markers, drill-down entry point)

### Schema (fully confirmed-v1)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `plant_id` | STRING | NOT NULL | SAP 4-character plant code; FK to gold_inspection_lot.PLANT_ID |
| `lat` | DOUBLE | NOT NULL | WGS-84 latitude |
| `lon` | DOUBLE | NOT NULL | WGS-84 longitude |
| `updated_at` | TIMESTAMP | nullable | Last modification time (UTC) |
| `updated_by` | STRING | nullable | Identity that last updated |

### Key facts

- `plant_id` links to `gold_inspection_lot.PLANT_ID` — the join key for combining geo with observation aggregates in Estate Monitoring BC
- Maintained as part of plant spatial configuration — not a standalone map feature
- Consumed read-only by Estate Monitoring BC to place plant pins on the geographic estate map
- Existence in connected_plant_uat: **unknown** — confirmed by `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`
- Plant geolocation maintenance (writing lat/lon) belongs to the spatial configuration write workstream — same as floor setup and coordinate placement

---

## Relationships Between Tables

```
em_plant_floor (plant_id, floor_id)
    │ active_revision_id ────────────────────────────────┐
    │                                                     │
    ▼                                                     ▼
em_location_coordinates (plant_id, func_loc_id, floor_id)   em_layout_revision (revision_id)
    │ parent_zone_id ──────────────────────────────┐         │ revision_id
    │ revision_id ─────────────────────────────────┼─────────┘
    │                                              │
    │                                              ▼
    │                                     em_location_zones (zone_id, revision_id)
    │                                              │ functional_location_id
    │                                              │
    ▼ FUNCTIONAL_LOCATION                         ▼
gold_inspection_point                     SAP L4 functional location hierarchy
    │ INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID
    ▼
gold_batch_quality_result_v (valuations, MIC results)
```

---

## Upload / Storage Model

**Stop condition documented.**

- `em_plant_floor.svg_url` and `em_plant_floor.background_image_url` are plain STRING columns.
- No upload handler, blob storage client, or Azure ADLS/Blob SDK call was found in the V1 EnvMon repository.
- The image file itself is hosted externally. The V1 app simply reads and stores the URL string.
- **How images get there is unknown from the V1 repo alone.** Possible options: manually uploaded to a static hosting path, uploaded via a separate admin tool, or placed in a Databricks volume. None confirmed.
- V2 upload/image storage design requires: confirming the V1 image hosting solution (request: sample floor URL from V1 UAT), or designing a new V2 image hosting approach (Databricks volume, Azure Blob, or external CDN).

**Do not design or implement V2 floorplan upload until the image hosting solution is clarified.**

---

## Schema Discovery SQL

```sql
-- Step 1: Check em_* table existence in connected_plant_uat
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';

-- If tables exist, run DDL for each:
DESCRIBE TABLE connected_plant_uat.gold.em_plant_floor;
DESCRIBE TABLE connected_plant_uat.gold.em_location_coordinates;
DESCRIBE TABLE connected_plant_uat.gold.em_layout_revision;
DESCRIBE TABLE connected_plant_uat.gold.em_location_zones;
DESCRIBE TABLE connected_plant_uat.gold.em_plant_geo;

-- Check floor data by plant
SELECT plant_id, COUNT(*) AS floor_count
FROM connected_plant_uat.gold.em_plant_floor
GROUP BY plant_id ORDER BY floor_count DESC;

-- Check coordinate coverage
SELECT plant_id, floor_id, COUNT(*) AS coord_count
FROM connected_plant_uat.gold.em_location_coordinates
GROUP BY plant_id, floor_id ORDER BY plant_id, floor_id;

-- Check revision states
SELECT plant_id, floor_id, state, COUNT(*) AS n
FROM connected_plant_uat.gold.em_layout_revision
GROUP BY plant_id, floor_id, state ORDER BY plant_id, floor_id, state;

-- Check zone geometry types
SELECT geometry_type, status, COUNT(*) AS n
FROM connected_plant_uat.gold.em_location_zones
GROUP BY geometry_type, status ORDER BY n DESC;
```

---

## Summary: Required for V2 Parity

| Table | Required for | V2 method | Risk if absent |
|---|---|---|---|
| `em_plant_floor` | Floor list, floor metadata, background image | `getEnvMonZones`, `getEnvMonHeatmap` | Heatmap impossible; floor tabs empty |
| `em_location_coordinates` | x/y positions of sample points | `getEnvMonHeatmap` | Heatmap impossible |
| `em_location_zones` | Zone boundaries, zone-level aggregation | `getEnvMonZones`, `getEnvMonHeatmap` | Zone view blocked; heatmap degraded to point-level |
| `em_layout_revision` | Active revision selection | Floor/zone read queries | Cannot filter to published layout |
| `em_plant_geo` | Plant map pin (estate map), hot spot status per plant | `getEnvMonPlantMap`, `getEnvMonPlantHotspots` (proposed) | Estate Monitoring BC blocked; heatmap and SAP QM workstream unaffected |

**If em_* tables do not exist in connected_plant_uat:** heatmap, zones, estate map, and spatial configuration are blocked entirely. The SAP QM monitoring workstream (site summary, swab results, trends) can proceed independently.
