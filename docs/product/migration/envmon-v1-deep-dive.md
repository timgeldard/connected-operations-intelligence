# EnvMon V1 Deep Dive

**Date:** 2026-05-17
**Tranche:** l.txt — spatial configuration + domain architecture
**Status:** CONFIRMED-V1 (SAP QM + app-managed tables) — DDL not yet run in connected_plant_uat
**References:**
- `docs/migration/envmon-v1-functional-recovery.md`
- `docs/migration/envmon-native-candidate-ranking.md`
- `docs/audit/envmon-sap-qm-source-model.md`
- `docs/audit/envmon-native-column-verification-checklist.md`

---

## Summary

EnvMon V1 is a **hybrid domain** with two distinct and independently functional sub-systems. It is not a LIMS-only app and not a SAP-QM-only app:

1. **SAP QM Read Model** — reads inspection lot and MIC result data from the Databricks gold layer (TRACE_CATALOG/TRACE_SCHEMA), filtering to environmental inspection types `'14'` and `'Z14'`. This is the analytical backbone: KPIs, heatmap coloring, MIC trends, lot detail.

2. **App-Managed Spatial Configuration Model** — reads and writes app-owned Delta tables (also in TRACE_CATALOG/TRACE_SCHEMA) to manage floorplans, functional location coordinates, hygiene zone boundaries, and a full revision/publish lifecycle. This sub-system owns the authoring workflow (Spatial Studio) and drives the floor plan rendering backend.

Neither sub-system is optional. The heatmap view requires both: gold views supply the valuation data; app-managed tables supply the coordinate and floor plan context. V2 migration must treat these as two separate dependency chains with independent DDL confirmation steps.

---

## A. SAP QM Read Model

### Source System

All analytical data reads from the Databricks gold layer via `TRACE_CATALOG` / `TRACE_SCHEMA` (the same catalog used by Trace2 and Connected Quality). No LIMS integration; the V1 source was incorrectly labelled "lims" in the panel registration badges.

### Inspection Type Filter (critical)

Every EnvMon V1 query begins with:

```sql
WHERE lot.INSPECTION_TYPE IN ('14', 'Z14')
```

Type `14` = recurring inspection (standard environmental monitoring, hygiene swabs, zone surveillance).
Type `Z14` = customer extension of type 14.

This filter is the single discriminator between EnvMon lots and all other SAP QM lot types (process order lots, goods receipt inspections, etc.).

### Gold Views

#### `gold_inspection_lot`

Inspection lot header — one row per inspection lot.

| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | Primary key |
| `PLANT_ID` | Plant filter |
| `INSPECTION_TYPE` | EnvMon filter: `IN ('14','Z14')` |
| `CREATED_DATE` | Date filter (period window — V1 uses 90-day rolling default) |
| `INSPECTION_END_DATE` | Lot completion date |
| `MATERIAL_ID` | Material on the lot (optional enrichment) |
| `BATCH_ID` | Batch on the lot (optional enrichment) |

Status: confirmed-v1 (from `em_config.py` + `entities.yaml` + DAL SQL). DDL not yet run in connected_plant_uat.

#### `gold_inspection_point`

Inspection points — one row per sample point per lot.

| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | FK to `gold_inspection_lot` |
| `INSPECTION_POINT_ID` | Point identifier within lot |
| `FUNCTIONAL_LOCATION` | SAP TPLNR — physical floor location (e.g. `Q225-0101-SEV3-Z0-72`) |
| `OPERATION_ID` | Join key to `gold_batch_quality_result_v` |
| `SAMPLE_ID` | Join key to `gold_batch_quality_result_v` |
| `SAMPLE_HOUR` | Hour the sample was taken |

Status: confirmed-v1. DDL not yet run in connected_plant_uat.

#### `gold_batch_quality_result_v`

MIC test results — one row per characteristic per sample.

| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | Composite FK join key |
| `OPERATION_ID` | Composite FK join key |
| `SAMPLE_ID` | Composite FK join key |
| `MIC_NAME` | Characteristic / test type (e.g. Listeria, APC, ATP) |
| `INSPECTION_RESULT_VALUATION` | Result status (see valuation mapping below) |
| `QUANTITATIVE_RESULT` | Numeric result value (CFU count, RLU, etc.) |
| `UPPER_TOLERANCE` | Upper specification limit |
| `LOWER_TOLERANCE` | Lower specification limit |

Status: confirmed-v1. DDL not yet run in connected_plant_uat.

#### `gold_plant`

Plant metadata — shared with Connected Quality and Trace2.

| Column | Role |
|---|---|
| `PLANT_ID` | Primary key |
| `PLANT_NAME` | confirmed-ddl |
| `COUNTRY_ID` | confirmed-v1 |
| `CITY` | confirmed-v1 |

### Join Keys (confirmed-v1)

From V1 `plants.py` `fetch_plant_kpis`:

```sql
FROM gold_inspection_lot lot
JOIN gold_inspection_point ip
    ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
LEFT JOIN gold_batch_quality_result_v r
    ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
   AND ip.OPERATION_ID      = r.OPERATION_ID
   AND ip.SAMPLE_ID         = r.SAMPLE_ID
```

The composite join key on `gold_batch_quality_result_v` (`INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`) is load-bearing. Do not assume a single-column FK.

### Date Filter

V1 uses `CREATED_DATE` on `gold_inspection_lot` as the period window filter. Default window in V1 is 90 days rolling. The parameter is passed from the frontend as `start_date` / `end_date`.

### Valuation Mapping (confirmed-v1)

From V1 `plants.py` `fetch_plant_kpis` SQL:

| SAP `INSPECTION_RESULT_VALUATION` | V1 category | V2 equivalent |
|---|---|---|
| `R`, `REJ`, `REJECT` | Fail | `positive` / `active_fail` |
| `W`, `WARN` | Warning | `borderline` / `warning` |
| `NULL` | Pending (no usage decision yet) | `pending` |
| `A` or any other value | Accept / Pass | `negative` / `pass` |

### Catalog / Schema

All four gold views are in `TRACE_CATALOG` / `TRACE_SCHEMA`. No separate EnvMon catalog. The V1 `em_config.py` resolves these at runtime from environment variables:

```python
TRACE_CATALOG = os.environ["TRACE_CATALOG"]
TRACE_SCHEMA  = os.environ.get("TRACE_SCHEMA", "gold")
```

---

## B. App-Managed Spatial Configuration Model

### Overview

The second sub-system consists of five Delta tables created and owned by the EnvMon application itself. These are not data engineering gold views — they are written by the app via CRUD endpoints and the Spatial Studio authoring workflow.

All five tables are in `TRACE_CATALOG` / `TRACE_SCHEMA` (the same catalog as the SAP QM views — not a separate schema). All use Delta with `autoOptimize` enabled. All table references resolve via the same `em_config.py` constants.

### Table: `em_location_coordinates`

Functional location (sample point) x/y placement on a floor plan canvas.

| Column | Type | Notes |
|---|---|---|
| `plant_id` | STRING | Plant filter |
| `func_loc_id` | STRING | SAP TPLNR — FK to `gold_inspection_point.FUNCTIONAL_LOCATION` |
| `floor_id` | STRING | FK to `em_plant_floor.floor_id` |
| `x_pos` | DOUBLE | Position as percentage of canvas width (0–100%) |
| `y_pos` | DOUBLE | Position as percentage of canvas height (0–100%) |
| `updated_by` | STRING | Identity stamp |
| `updated_at` | TIMESTAMP | Last update |
| `parent_zone_id` | STRING | FK to `em_location_zones.zone_id` (added migration 007) |
| `placement_source` | STRING | How coordinate was set (added migration 007) |
| `revision_id` | STRING | FK to `em_layout_revision.revision_id` (added migration 007) |
| `validation_status` | STRING | Per-point validation outcome (added migration 007) |
| `validation_messages_json` | STRING | JSON array of validation messages (added migration 007) |

Purpose: drives heatmap x/y rendering. Without this table, spatial heatmap is not renderable.

### Table: `em_plant_floor`

Floor plan metadata and SVG/canvas configuration for a plant.

| Column | Type | Notes |
|---|---|---|
| `plant_id` | STRING | Plant filter |
| `floor_id` | STRING | Primary key |
| `floor_name` | STRING | Display name |
| `svg_url` | STRING | Background image URL (external, read-only reference) |
| `svg_width` | INTEGER | Original SVG width (px) |
| `svg_height` | INTEGER | Original SVG height (px) |
| `sort_order` | INTEGER | Tab ordering in SiteView |
| `created_at` | TIMESTAMP | Row creation |
| `canvas_type` | STRING | `floor_plan` or `grid` (added migration 006) |
| `canvas_width` | DOUBLE | Canvas dimension (added migration 006) |
| `canvas_height` | DOUBLE | Canvas dimension (added migration 006) |
| `canvas_units` | STRING | `pct` or `px` (added migration 006) |
| `grid_size` | DOUBLE | Grid cell size (added migration 006) |
| `scale_value` | DOUBLE | Real-world scale value (added migration 006) |
| `scale_units` | STRING | Scale unit label (added migration 006) |
| `background_image_url` | STRING | Current background image URL (added migration 006) |
| `background_image_type` | STRING | MIME type (added migration 006) |
| `background_checksum` | STRING | Integrity checksum (added migration 006) |
| `active_revision_id` | STRING | FK to `em_layout_revision.revision_id` (added migration 006) |

Purpose: provides floor list for SiteView tabs and canvas dimensions for coordinate projection.

### Table: `em_plant_geo`

Plant geographic coordinates.

| Column | Type | Notes |
|---|---|---|
| `plant_id` | STRING | Primary key |
| `lat` | DOUBLE | WGS-84 latitude |
| `lon` | DOUBLE | WGS-84 longitude |
| `updated_at` | TIMESTAMP | Last update |
| `updated_by` | STRING | Identity stamp |

Purpose: drives plant location on any geographic map view.

### Table: `em_layout_revision`

Revision history for a floor's spatial layout (zones + coordinates).

| Column | Type | Notes |
|---|---|---|
| `revision_id` | STRING (UUID PK) | Primary key |
| `plant_id` | STRING | Plant filter |
| `floor_id` | STRING | Floor filter |
| `revision_number` | INTEGER | Monotonically increasing |
| `state` | STRING | `draft`, `published`, `superseded`, `rolled_back` |
| `base_revision_id` | STRING | Revision this draft was based on (nullable) |
| `change_reason` | STRING | Required on publish |
| `publish_summary_json` | STRING | JSON summary of publish outcome |
| `validation_summary_json` | STRING | JSON validation results |
| `created_by` | STRING | Identity stamp |
| `created_at` | TIMESTAMP | Draft creation time |
| `published_by` | STRING | Identity stamp (nullable until published) |
| `published_at` | TIMESTAMP | Publish time (nullable until published) |
| `rolled_back_from_revision_id` | STRING | Source revision for rollback (nullable) |

Purpose: full audit trail of layout changes; governs which coordinate set is active.

### Table: `em_location_zones`

Hygiene zone boundaries (polygon or rectangle geometry) per functional location level.

| Column | Type | Notes |
|---|---|---|
| `zone_id` | STRING (UUID PK) | Primary key |
| `plant_id` | STRING | Plant filter |
| `floor_id` | STRING | Floor filter |
| `functional_location_id` | STRING | SAP TPLNR for zone anchor |
| `functional_location_level` | INTEGER | Expected 4 for L4 zones |
| `zone_name` | STRING | Display name |
| `geometry_type` | STRING | `polygon` or `rectangle` |
| `geometry_json` | STRING | JSON array of `{x, y}` vertices |
| `bbox_json` | STRING | Bounding box JSON |
| `centroid_x` | DOUBLE | Computed centroid x (%) |
| `centroid_y` | DOUBLE | Computed centroid y (%) |
| `parent_zone_id` | STRING | FK to parent zone (nullable) |
| `revision_id` | STRING | FK to `em_layout_revision.revision_id` |
| `status` | STRING | `draft`, `published`, `archived` |
| `created_by` | STRING | Identity stamp |
| `created_at` | TIMESTAMP | Row creation |
| `updated_by` | STRING | Identity stamp |
| `updated_at` | TIMESTAMP | Last update |

Purpose: defines zone boundaries drawn in Spatial Studio. Required for zone-level aggregation and the `hygieneZone` / `areaType` fields in V2 contracts.

### Layout Revision Lifecycle

```
DRAFT → PUBLISHED → SUPERSEDED
           ↓
        ROLLED_BACK (from PUBLISHED, restoring a previous PUBLISHED)
```

- Only one revision per floor can be `published` at a time.
- The `published` revision's `revision_id` is stamped into `em_plant_floor.active_revision_id`.
- A new draft is always based on the current published revision (`base_revision_id`).
- Superseding and rollback both produce a full audit record.

### Publish Workflow (5 steps, confirmed-v1 from `application/layout_publish.py`)

1. **Validate revision** — compute `validation_summary_json` (checks coordinate counts, geometry validity, orphan detection)
2. **Supersede current published revision** — set existing published revision state to `superseded`
3. **Mark draft as published** — set state to `published`, stamp `published_by` and `published_at`
4. **Set active revision** — update `em_plant_floor.active_revision_id` to new revision_id
5. **Bulk-stamp coordinates** — write `parent_zone_id` onto all `em_location_coordinates` rows in this revision

The entire workflow is transactional at the application layer. If step 2–5 fail, the draft remains in `draft` state. `change_reason` is required on publish (enforced by V1 `PublishDialog.tsx`).

### Background Image Storage

- `background_image_url` in `em_plant_floor` is a plain STRING column.
- No upload handler was found in the V1 repo. The URL is entered or set via CRUD endpoint.
- Image must be hosted externally (cloud storage, CDN, or static host). The EnvMon app stores only the reference URL.
- **Stop condition:** the actual image hosting solution used in production V1 is unknown. Do not design a V2 upload workflow until this is clarified with the V1 deployment team.

---

## C. UI Interaction Model

### Three Main Views

| View | Component | Function |
|---|---|---|
| **GlobalView** | `views/GlobalView.tsx` | Portfolio overview — plant cards with KPI badges (active_fails, warnings, pending, pass_locs) |
| **SiteView** | `views/SiteView.tsx` | Per-plant site summary + floor tabs (one tab per `em_plant_floor` row) |
| **FloorView** | `views/FloorView.tsx` | Per-floor heatmap + result overlays — SVG background + Marker overlay |

### Spatial Studio (Authoring Workflow)

The Spatial Studio is an admin-only authoring surface for configuring zone boundaries and coordinate placements.

| Component | Role |
|---|---|
| `SpatialStudio.tsx` | Full studio layout shell |
| `StudioCanvas.tsx` | Drawing canvas — handles pointer events for zone/point placement |
| `ZoneLayer.tsx` | Renders zone polygon/rectangle geometry from `em_location_zones` |
| `PointLayer.tsx` | Renders functional location sample points on canvas |
| `PublishDialog.tsx` | Publish confirmation — requires `change_reason` |
| `ValidationPanel.tsx` | Displays `validation_summary_json` before publish |
| `HierarchyRail.tsx` | Left rail zone/point tree for selection |
| `InspectorPanel.tsx` | Properties inspector for selected zone or point |

### LocationPanel Drill-Through

`LocationPanel.tsx` is the side panel displayed when a user selects a functional location on the floor plan. It contains two tabs:

- **LotsTab** (`LotsTab.tsx`) — inspection lot listing for the selected functional location
- **TrendTab** (`TrendTab.tsx`) — MIC trend chart per MIC name for the selected location

### Marker and Tooltip

| Component | Role |
|---|---|
| `FloorPlan.tsx` | SVG floor plan background container + overlay mount point |
| `Marker.tsx` | Per-functional-location coloured marker at `(x_pos, y_pos)` from `em_location_coordinates` |
| `Tooltip.tsx` | Hover tooltip showing latest valuation and MIC name for a marker |

---

## D. Upload / Storage Model

- No upload handler was found in the V1 repo.
- `background_image_url` is a plain STRING column in `em_plant_floor`.
- The column is set via the spatial config CRUD endpoint (`POST /coordinates`, `PUT /floors/{floor_id}`).
- Image files must be hosted externally; the app stores only the URL reference.
- **Stop condition:** actual image hosting solution used in V1 production is unknown. Do not design or implement a V2 upload handler until the hosting target is clarified. This is a V2 design problem, not a migration problem.

---

## E. Derived Analytics / Heatmap Model

The heatmap is a multi-join that requires both sub-systems:

```
gold_inspection_lot (filter: INSPECTION_TYPE IN ('14','Z14'), PLANT_ID, CREATED_DATE window)
    JOIN gold_inspection_point ON INSPECTION_LOT_ID
    LEFT JOIN gold_batch_quality_result_v ON INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID
    JOIN em_location_coordinates ON FUNCTIONAL_LOCATION = func_loc_id AND plant_id
    JOIN em_plant_floor ON floor_id AND plant_id
```

Key rendering details:
- **x_pos / y_pos** from `em_location_coordinates` — relative percentage (0–100%), applied to canvas dimensions from `em_plant_floor`
- **SVG background** from `em_plant_floor.background_image_url` (external URL)
- **Marker colour** = valuation class per `FUNCTIONAL_LOCATION` — fail (red), warning (amber), pass (green), pending (grey)
- **Aggregation** — per `FUNCTIONAL_LOCATION`, worst-case valuation in the period window drives the colour

No riskScore calculation algorithm was found in V1. The heatmap is a visual classification (fail/warn/pass/pending) — not a computed numeric risk score. Any V2 contract field named `riskScore` will require new business rule definition if it is to be populated.

---

## V1 API Routes

### Inspection Analysis — `GET /api/em`

| Method | Path | Description | DAL source |
|---|---|---|---|
| GET | `/plants` | Portfolio KPIs: `total_locs`, `active_fails`, `warnings`, `pending`, `pass_locs`, `lots_tested` | `dal/plants.py` `fetch_plant_kpis` |
| GET | `/floors` | Floor list for plant (from `em_plant_floor`) | `dal/plants.py` `count_plant_floors` |
| GET | `/heatmap` | Heatmap markers with valuation status per `functional_location` | `dal/heatmap.py` |
| GET | `/locations` | Functional locations with mapping status (has coordinates or not) | `dal/plants.py` |
| GET | `/locations/{func_loc_id}/summary` | Location detail: recent lots, MIC summary | `dal/lots.py` |
| GET | `/mics` | Distinct MIC names for plant (type-selector for trends) | `dal/trends.py` |
| GET | `/trends` | MIC time-series per location + MIC name | `dal/trends.py` |
| GET | `/lots` | Inspection lots for a functional location | `dal/lots.py` |
| GET | `/lots/{lot_id}` | Per-lot MIC result detail | `dal/lots.py` |

### Spatial Config Admin — CRUD

| Method | Path | Description | Router |
|---|---|---|---|
| GET | `/floors` | Floor list | `spatial_config/router.py` |
| POST | `/floors` | Add floor | `spatial_config/router.py` |
| PUT | `/floors/{floor_id}` | Update floor metadata | `spatial_config/router.py` |
| GET | `/coordinates` | List coordinates for func_loc | `spatial_config/router.py` |
| POST | `/coordinates` | Set coordinates for func_loc | `spatial_config/router.py` |
| GET | `/plant-geo` | Plant geographic coords (lat/lon) | `spatial_config/router.py` |
| POST | `/plant-geo` | Set plant geographic coords | `spatial_config/router.py` |

Plus 2 additional admin endpoints (update `plant-geo` and manage floor ordering) inferred from router count of 9.

### Spatial Studio — `/spatial`

| Method | Path | Description | Router |
|---|---|---|---|
| GET | `/spatial/revisions` | Revision history for floor | `spatial_config/studio_router.py` |
| POST | `/spatial/revisions/draft` | Create draft revision | `spatial_config/studio_router.py` |
| GET | `/spatial/zones` | Zones for revision | `spatial_config/studio_router.py` |
| POST | `/spatial/zones` | Add zone | `spatial_config/studio_router.py` |
| PUT | `/spatial/zones/{zone_id}` | Update zone | `spatial_config/studio_router.py` |
| DELETE | `/spatial/zones/{zone_id}` | Delete zone | `spatial_config/studio_router.py` |
| POST | `/spatial/validate` | Validate revision (returns `validation_summary_json`) | `spatial_config/studio_router.py` |
| POST | `/spatial/publish` | Full publish workflow (5 steps) | `spatial_config/studio_router.py` |
| POST | `/spatial/rollback` | Rollback to previous published revision | `spatial_config/studio_router.py` |

---

## V1 App-Managed Table Summary

| Table | Full column list | Purpose | V2 dependency |
|---|---|---|---|
| `em_location_coordinates` | plant_id, func_loc_id, floor_id, x_pos, y_pos, updated_by, updated_at, parent_zone_id, placement_source, revision_id, validation_status, validation_messages_json | x/y placement of functional locations on floor plan canvas | Required for heatmap rendering |
| `em_plant_floor` | plant_id, floor_id, floor_name, svg_url, svg_width, svg_height, sort_order, created_at, canvas_type, canvas_width, canvas_height, canvas_units, grid_size, scale_value, scale_units, background_image_url, background_image_type, background_checksum, active_revision_id | Floor plan metadata and canvas configuration | Required for floor tab list and heatmap canvas dimensions |
| `em_plant_geo` | plant_id, lat, lon, updated_at, updated_by | Plant geographic WGS-84 coordinates | Required for plant location on geographic map |
| `em_layout_revision` | revision_id, plant_id, floor_id, revision_number, state, base_revision_id, change_reason, publish_summary_json, validation_summary_json, created_by, created_at, published_by, published_at, rolled_back_from_revision_id | Revision lifecycle and audit trail for spatial layouts | Required for Spatial Studio and active coordinate set resolution |
| `em_location_zones` | zone_id, plant_id, floor_id, functional_location_id, functional_location_level, zone_name, geometry_type, geometry_json, bbox_json, centroid_x, centroid_y, parent_zone_id, revision_id, status, created_by, created_at, updated_by, updated_at | Zone geometry boundaries drawn in Spatial Studio | Required for zone-level aggregation; source for `hygieneZone`/`areaType` V2 contract fields — but note: V1 zones have no hygiene classification built in (generic spatial areas only) |
