# EnvMon V2 Migration — Advisor Recommendation

**Date:** 2026-05-17
**Tranche:** l.txt — post spatial-config recovery
**Perspective:** Senior manufacturing quality / environmental monitoring product advisor

> **Status update (n.txt, 2026-05-17):** CAPA/corrective actions have been formally scoped out of EnvMon V2 parity.
> `getEnvMonCorrectiveActions` is intentionally not migrated — not blocked, not deferred. The CAPA risk items
> and recommendations below are preserved as historical analysis context; the scope decision supersedes them.
> Future CAPA capability belongs to a separate Quality Actions / Deviation / CAPA bounded context.

> **Status update (o.txt, 2026-05-17):** Estate Monitoring / Plant Hotspot Overview workstream added (Workstream A2).
> Plant geolocation (`em_plant_geo`) is part of EnvMon Spatial Configuration — maintained with plant floor/spatial data.
> Recommended sequencing updated to include estate map after site-summary BV.
> `getEnvMonPlantMap` and `getEnvMonPlantHotspots` are proposed contract additions — not yet in envmon-adapter.ts.

> **Status update (p.txt, 2026-05-17):** `getEnvMonSwabResults` route wired — Recommended Next Tranche step 7 (wire swab-results route) is COMPLETE.
> `GET /api/envmon/swab-results` implemented in `apps/api/routes/envmon.py`; same Group A SAP QM views as site-summary;
> 56 new adapter + route tests; frontend wiring deferred (EnvMonSwabResultSchema requires `zoneId`/`zoneName`
> unavailable from SAP QM alone; adapter is mock-only with no fetch infrastructure).
> Next at that time: deploy to UAT and browser-verify both site-summary and swab-results.

> **Status update (2026-05-18):** API browser verification has passed for both `site-summary` and `swab-results`.
> A read-only EnvMon monitoring UI is implemented at `?workspace=envmon-monitoring`; UI browser verification
> is pending next UAT deploy. The UI uses the native SAP QM result shape and keeps CAPA/spatial workflows deferred.

**References:**
- `docs/migration/envmon-v1-deep-dive.md`
- `docs/migration/envmon-v1-functional-recovery.md`
- `docs/migration/envmon-native-candidate-ranking.md`
- `docs/audit/envmon-sap-qm-source-model.md`

---

## Framing

EnvMon V1 was fully operational. It delivered: a portfolio KPI view, per-plant floor plan heatmaps, MIC trend charts, lot/result drill-through, and a full Spatial Studio for zone/coordinate authoring with a revision and publish lifecycle.

V2 starts from a mock-only state. The migration question is not "what do we need to design?" — V1 answered most of that. The migration question is "what infrastructure dependencies must be confirmed before each workstream can start, and what are the honest stop conditions?"

This recommendation organises migration into four workstreams with explicit V1 evidence, current V2 status, required data objects, risk, and sequencing.

---

## Workstream A — SAP QM Monitoring Data

*Site summary, swab results, trends, alerts and fails*

### V1 Evidence

V1 `inspection_analysis/dal/` implements the full analytical stack: portfolio KPIs (`plants.py`), floor-level heatmap data (`heatmap.py`), MIC time-series (`trends.py`), lot listing and MIC detail (`lots.py`). All queries use only three gold views: `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`. No app-managed tables are joined in the KPI, trends, or lot-detail paths.

Source filter: `INSPECTION_TYPE IN ('14','Z14')`. Valuation mapping: `R/REJ/REJECT` → fail, `W/WARN` → warning, NULL → pending, `A` or other → pass.

Join keys are three-column composite for result data: `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`.

### V2 Current Status

- `getEnvMonSiteSummary`: **API BV 2026-05-18** — consumed by the read-only monitoring UI.
- `getEnvMonSwabResults`: **API BV 2026-05-18** — read-only UI consumes native SAP QM shape because zoneId is unavailable.
- `getEnvMonTrends`: QuerySpec not yet written. Deferred.
- `getEnvMonAlerts`: No V1 "alert" concept — alerts would be derived from failing valuations. Alert rules (severity classification, `alertType` enum) are undefined. Deferred.
- `getEnvMonCorrectiveActions`: Out of scope — CAPA is not a V2 EnvMon parity requirement; intentionally not migrated.

### Required Data Objects

- `gold_inspection_lot` (confirmed-v1): `INSPECTION_LOT_ID`, `PLANT_ID`, `INSPECTION_TYPE`, `CREATED_DATE`, `INSPECTION_END_DATE`
- `gold_inspection_point` (confirmed-v1): `INSPECTION_LOT_ID`, `INSPECTION_POINT_ID`, `FUNCTIONAL_LOCATION`, `OPERATION_ID`, `SAMPLE_ID`
- `gold_batch_quality_result_v` (confirmed-v1): `INSPECTION_LOT_ID`, `OPERATION_ID`, `SAMPLE_ID`, `MIC_NAME`, `INSPECTION_RESULT_VALUATION`, `QUANTITATIVE_RESULT`, `UPPER_TOLERANCE`, `LOWER_TOLERANCE`

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Gold views may have different column names in connected_plant_uat | High | DESCRIBE TABLE before wiring any route |
| `IN ('14','Z14')` may return zero rows in UAT | Medium | `SELECT DISTINCT INSPECTION_TYPE` before claiming coverage |
| `openCorrectiveActions` / `overdueActions` default to 0 | High | These fields are misleading at zero — mark as placeholder or make optional in contract until CAPA source is identified |
| `trendDirection` defaulting to `'stable'` | High | A hardcoded default is not analytics — implement it from `getEnvMonTrends` or make the field optional |
| Alert derivation rules undefined | Medium | Do not implement `getEnvMonAlerts` until domain owner defines the severity → `alertType` mapping |
| CAPA workflow does not exist in V1 | Critical | `getEnvMonCorrectiveActions` requires a full new workflow design — do not stub with zeros |

### Recommended Next Tranche

Steps 1–7 are COMPLETE (n.txt + p.txt, 2026-05-17):

1. ~~Run `DESCRIBE TABLE` for all three gold views~~ — DONE (n.txt)
2. ~~Confirm `INSPECTION_TYPE IN ('14','Z14')`~~ — DONE (confirmed-v1)
3. ~~Confirm `INSPECTION_RESULT_VALUATION` values~~ — done (confirmed-v1 valuation mapping)
4. ~~Update column verification checklist to `confirmed-ddl`~~ — DONE (n.txt)
5. ~~Wire `GET /api/envmon/site-summary`~~ — DONE (n.txt)
6. ~~Browser-verify `GET /api/envmon/site-summary` in UAT~~ — DONE 2026-05-18
7. ~~Wire `GET /api/envmon/swab-results`~~ — DONE (p.txt)
8. ~~Browser-verify `GET /api/envmon/swab-results` in UAT~~ — DONE 2026-05-18
9. Browser-verify read-only monitoring UI at `?workspace=envmon-monitoring` — **PENDING**
10. Write QuerySpec for `getEnvMonTrends` and wire route (after UI BV)

### Stop Conditions

- Do not wire any route before DDL confirmed.
- Do not implement `getEnvMonAlerts` until alert derivation rules are defined by the domain owner.
- Do not implement `getEnvMonCorrectiveActions` at all in the short term — this requires CAPA workflow design that is not a V1 migration problem.

---

## Workstream A2 — Estate Monitoring / Plant Hotspot Overview

*Geographic estate map, plant geolocation, plant hot spot markers, drill-down entry point*

### Purpose

Estate Monitoring provides the high-level geographic overview of all plants — a multi-plant map showing where each plant is located and which plants have active environmental concerns. Operators can see at a glance which plants are clean, which have warnings, and which have active fails, then drill down into a specific plant's floor-level detail.

This workstream connects the SAP QM Observations data (plant-level fail/warn aggregates) with the Spatial Configuration data (plant lat/lon) to produce a composed geographic read model.

### Business Value

- Single-screen portfolio view for environmental monitoring coordinators and quality managers
- Rapid identification of plants requiring attention without navigating into each plant individually
- Geographic context — plants are positioned on a real map, not just a list
- Entry point of the full drill-down chain: estate map → plant summary → floor list → floorplan heatmap → swab point detail

### Source Objects

| Object | Type | Purpose |
|---|---|---|
| `em_plant_geo` (TRACE_CATALOG / TRACE_SCHEMA) | App-managed spatial config | Plant lat/lon; confirmed-v1 DDL; UAT existence unknown |
| `GET /api/envmon/site-summary` | SAP QM observation aggregate | Plant-level fail/warn/pass counts for hot spot colouring |

`em_plant_geo` is **maintained as part of Spatial Configuration** — setting plant lat/lon is a spatial configuration maintenance task, not a standalone map admin task. See Workstream B for the write path (`setPlantGeoLocation`).

### Relationship to Plant Geolocation Maintenance

Plant geolocation setup (`em_plant_geo` write API) belongs to **Workstream B — Spatial Configuration**, not to this workstream. This workstream covers only the read model: combining geo coordinates with observation aggregates to serve the estate map view.

Read sequence:
1. Operator sets plant lat/lon in spatial configuration admin (Workstream B)
2. Estate Monitoring read model queries em_plant_geo + site-summary aggregate (this workstream)
3. Map renders plant pins coloured by hot spot status

### Dependency on site-summary route

`getEnvMonPlantHotspots` (proposed) would combine plant geo coordinates with plant-level fail/warn counts from the same observation aggregate used by `getEnvMonSiteSummary`. The site-summary route must be browser-verified before estate hotspot can be designed — the aggregate shape needs to be confirmed against live data before the composition can be designed.

### Dependency on em_plant_geo

`getEnvMonPlantMap` (proposed) requires `em_plant_geo` to exist and be populated in connected_plant_uat. If the table does not exist, estate map is blocked. If the table exists but has no rows, map pins cannot be displayed.

### V2 Current Status

No estate monitoring routes or contracts exist:
- `getEnvMonPlantMap` — NOT in envmon-adapter.ts or data-contracts — **PROPOSED**
- `getEnvMonPlantHotspots` — NOT in envmon-adapter.ts or data-contracts — **PROPOSED**

### Recommended Implementation Sequence

1. Browser-verify `GET /api/envmon/site-summary` (Workstream A — already wired)
2. Confirm `em_plant_geo` exists in connected_plant_uat (`SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`)
3. Row-count `em_plant_geo` — confirm plants have lat/lon populated
4. Design `getEnvMonPlantMap` contract type (lat/lon + plant metadata)
5. Implement read-only `GET /api/envmon/plant-map` (em_plant_geo read only)
6. Design `getEnvMonPlantHotspots` contract type (hot spot status per plant)
7. Implement `GET /api/envmon/plant-hotspots` (em_plant_geo JOIN site-summary aggregate)

### Stop Conditions

- Do not implement any estate monitoring routes before `em_plant_geo` confirmed in UAT.
- Do not design `getEnvMonPlantHotspots` before `GET /api/envmon/site-summary` is browser-verified.
- Do not invent plant coordinates — if `em_plant_geo` is empty, the map must show no pins (not hardcoded defaults).
- Plant geolocation write API (`setPlantGeoLocation`) belongs to Workstream B, not here.

---

## Workstream B — Spatial Configuration

*Plant geolocation maintenance, floorplans, background image, revision lifecycle, coordinate placement, L4 zones*

### V1 Evidence

V1 `spatial_config/` sub-module implements a complete CRUD and Studio workflow. Five app-managed Delta tables are fully DDL-confirmed from V1 migration scripts 001b–007: `em_location_coordinates`, `em_plant_floor`, `em_plant_geo`, `em_layout_revision`, `em_location_zones`. The revision lifecycle (`draft → published → superseded / rolled_back`) and the 5-step publish workflow are fully implemented and confirmed-v1.

The entire sub-module was functionally complete in V1.

### V2 Current Status

No spatial configuration adapter, routes, or contracts have been implemented in V2. The `em_*` tables have not been confirmed to exist in `connected_plant_uat` — this is the single blocking uncertainty for this entire workstream.

### Required Data Objects

All five em_* tables (see `docs/migration/envmon-v1-deep-dive.md` Section B for full column lists):
- `em_location_coordinates` — coordinate placement per functional location
- `em_plant_floor` — floor plan metadata and canvas config
- `em_plant_geo` — plant geographic coordinates
- `em_layout_revision` — revision lifecycle table
- `em_location_zones` — zone geometry boundaries

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| em_* tables may not exist in connected_plant_uat | Critical | Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` before any implementation — if not present, workstream B is fully blocked |
| em_* tables exist but were never populated | High | Row count check after existence confirmed — empty tables still block heatmap parity |
| `hygieneZone` / `areaType` in V2 contracts have no V1 source | High | V1 zones are generic L4 spatial areas only — they have no hygiene classification field. These V2 contract fields require new zone classification design and cannot be backfilled from V1 data. Mark as `null` or design optional until classification scheme is defined. |
| Background image upload is an unresolved design gap | High | No V1 upload handler found — image hosting solution is unknown. Do not implement a V2 upload workflow until hosting target is clarified with V1 deployment team |
| Revision lifecycle has complex state transitions | Medium | The 5-step publish workflow must be transactional — a partial failure (e.g. coordinates bulk-stamp fails) must not leave the revision in a published state with incorrect parent_zone_id stamps |

### Recommended Next Tranche

1. Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` — this is the gate for the entire workstream
2. If tables exist: row count and sample query for `em_plant_floor`, `em_location_coordinates`
3. If tables populated: implement read-only floor plan list adapter (`getEnvMonFloors`)
4. Implement read-only coordinate list adapter (`getEnvMonCoordinates`)
5. Implement read-only zone list adapter (`getEnvMonZones`) — noting that `hygieneZone` / `areaType` will be null/absent until classification design is complete
6. Only then implement write/CRUD paths (requires additional auth and admin role design)

### Stop Conditions

- Do not implement any B workstream adapter if `SHOW TABLES` confirms em_* tables do not exist.
- Do not implement a background image upload handler until hosting solution is identified.
- Do not populate `hygieneZone` or `areaType` from V1 zone data — these fields are a new design problem.

---

## Workstream C — Spatial Visualisation

*Heatmap rendering, zone exposure, point drill-through, status overlays*

### V1 Evidence

V1 `heatmap.py` implements the full multi-join query for heatmap rendering. `FloorPlan.tsx`, `Marker.tsx`, and `Tooltip.tsx` implement the client-side rendering. The heatmap join requires all three gold views (valuation data) plus `em_location_coordinates` (x/y positions) and `em_plant_floor` (canvas dimensions). The colour model is simple: worst-case valuation per `FUNCTIONAL_LOCATION` in the period window.

No riskScore algorithm found in V1. Visual classification only.

### V2 Current Status

`getEnvMonHeatmap` is mock-only. Blocked on both DDL confirmation of gold views (Workstream A) and em_* table confirmation (Workstream B).

### Required Data Objects

All data objects from Workstream A plus:
- `em_location_coordinates` (for x_pos, y_pos per func_loc_id)
- `em_plant_floor` (for canvas_width, canvas_height, background_image_url)

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Blocked by both Workstream A and B | Critical | Heatmap is the last slice to implement, not the first — despite being the flagship visual |
| V2 contract field `riskScore` has no V1 source | High | V1 has no numeric risk score — only valuation classification. If V2 contract exposes `riskScore`, it must be implemented with new business rules or removed |
| Canvas coordinate mismatch | Medium | x_pos/y_pos are stored as percentage of original SVG dimensions — rendering must account for `canvas_units` (pct vs px) from migration 006 columns |
| Empty or zero-row em_location_coordinates | High | If no coordinates have been set in UAT, all markers will be absent — confirm at least some plants have coordinate data before claiming parity |

### Recommended Next Tranche

Implement only after Workstreams A and B are both at route-wired and browser-verified status:

1. Implement `getEnvMonHeatmap` QuerySpec using confirmed column names from both DDL checks
2. Wire `GET /api/envmon/heatmap`
3. Browser-verify with a plant that has populated `em_location_coordinates`
4. Wire `GET /api/envmon/floors` for floor tab rendering (consumes `em_plant_floor`)

### Stop Conditions

- Do not implement heatmap before both Workstream A DDL and Workstream B em_* existence are confirmed.
- Do not claim heatmap parity if `em_location_coordinates` is empty in UAT — the render will show no markers.
- Do not invent a `riskScore` calculation — mark as not implemented or remove from heatmap contract until domain owner defines the algorithm.

---

## Workstream D — Governance / Admin

*Who maintains floorplans and zones, auditability, revision control, validation before activation*

### V1 Evidence

V1 implemented a complete governance model for spatial configuration:
- Full revision lifecycle with `change_reason` required on publish
- Pre-publish validation step producing `validation_summary_json`
- Supersede-on-publish ensuring only one active revision per floor
- Rollback capability restoring a previous published revision
- Identity stamps (`created_by`, `updated_by`, `published_by`) on all writes

The Spatial Studio was a dedicated admin surface, implying a role separation: environmental monitoring coordinators use the analysis views; a separate admin/studio role maintains the spatial configuration.

### V2 Current Status

No admin surface, no spatial write endpoints, no revision workflow implemented in V2. This workstream is entirely greenfield from a V2 code perspective.

### Required Data Objects

- All five em_* tables (writes required)
- Role/permission model for admin vs coordinator distinction
- Auth: write operations must use end-user OAuth identity for `created_by` / `updated_by` stamps

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Admin role definition not yet designed in V2 | High | Do not implement write paths until the V2 permission model for spatial admin is defined |
| Revision workflow is multi-step transactional | High | Partial failures must be safe — define rollback semantics before implementing publish workflow |
| Validation rules in `validation_summary_json` are V1-internal | Medium | Document what V1 validates (orphan coordinates, geometry validity, missing locations) before implementing V2 validation |
| CAPA / corrective actions are out of scope for EnvMon V2 parity | N/A | `getEnvMonCorrectiveActions` is intentionally not migrated. Future CAPA belongs to a separate Quality Actions / Deviation / CAPA bounded context — not EnvMon D |

### Recommended Next Tranche

This workstream should not start until Workstreams B and C are complete and validated:

1. Define V2 permission model for spatial admin role
2. Implement read-only Studio surface (revision history, zone display)
3. Implement draft creation and zone CRUD (write paths)
4. Implement validate + publish workflow
5. Implement rollback

### Stop Conditions

- Do not implement any write path without OAuth identity confirmed for `created_by` stamps — service-principal writes violate the audit trail.
- Do not implement CAPA or corrective action workflows in this workstream — that is a separate product design problem.

---

## Recommended Sequencing

The sequencing below follows dependency order strictly. Steps that share a dependency chain are numbered together; steps that are blocked by earlier items cannot be safely skipped.

| Step | Action | Workstream | Blocks |
|---|---|---|---|
| 1 | Complete/browser-verify `GET /api/envmon/site-summary` (DDL confirmed; route wired; BV pending) | A | Swab results; estate hotspot design |
| 2 | Implement/read-verify `GET /api/envmon/swab-results` | A | Trends route |
| 3 | Confirm `em_plant_geo` and all em_* spatial config tables in UAT (`SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`) | A2 + B gate | All spatial workstreams; estate map |
| 4 | Row-count `em_plant_geo` — confirm plants have lat/lon populated | A2 | Plant map read model |
| 5 | Implement read-only plant geo / estate map data (`GET /api/envmon/plant-map`) | A2 | Plant hotspots |
| 6 | Implement plant hotspot summary combining em_plant_geo + observation aggregate (`GET /api/envmon/plant-hotspots`) | A2 | Estate map feature complete |
| 7 | Row-count `em_plant_floor`, `em_location_coordinates` — confirm spatial data populated | B | Floor list; heatmap |
| 8 | Implement floor/floorplan read models (`GET /api/envmon/floors`, `GET /api/envmon/floorplan`) | B | Heatmap |
| 9 | Implement coordinate/zone read models (`GET /api/envmon/location-coordinates`, `GET /api/envmon/zones`) | B | Heatmap |
| 10 | Implement floorplan heatmap (`GET /api/envmon/heatmap`) | C | Only after steps 1–9 complete |
| 11 | Design upload/image hosting solution with V1 deployment team | D | Background image edit |
| 12 | Design admin role / permission model; implement plant geo write (`setPlantGeoLocation`) | D | Spatial write paths |
| 13 | Implement full spatial write paths + revision/publish workflow | D | Full Studio parity |

**Steps 11–13 are intentionally deferred** and do not block steps 1–10.

**Plant geolocation maintenance** (step 12, writing to `em_plant_geo`) belongs to Workstream D (spatial configuration write paths), not to the estate monitoring read model. Read before write: confirm geo data exists (steps 3–5) before designing the write admin interface.

---

## Key Risk Messages

### `openCorrectiveActions` / `overdueActions` defaulting to 0

Returning a hardcoded `0` for corrective action counts is **actively misleading** to users — it implies no corrective actions exist, when the real answer is "we have not implemented this". These fields must be either:
- Removed from the active contract until a CAPA source is implemented, or
- Clearly marked as `null` or `"not implemented"` in the API response

A zero that reads as "all clear" in a food safety dashboard is a patient safety risk.

### `trendDirection` defaulting to `'stable'`

A hardcoded `'stable'` is not a trend — it is a placeholder that will mislead coordinators. Either implement `trendDirection` from the `getEnvMonTrends` time-series (compute the slope over the period window) or make the field nullable and return `null` until implemented.

### `hygieneZone` / `areaType` have no V1 source

V1 `em_location_zones` has no hygiene zone classification field. Zones in V1 are generic L4 spatial boundary polygons with a `zone_name` string. If the V2 contract requires `hygieneZone` (e.g. Zone 1/2/3/4) or `areaType` (e.g. food contact / non-food contact), this is **new classification data** that must be designed and entered — it cannot be migrated from V1.

### Background image upload is an unresolved design gap

No V1 upload handler was found. The `background_image_url` column is a string reference to an externally hosted image. The hosting solution (cloud storage, CDN, Databricks Volume?) is not documented in the V1 repo. Do not design a V2 upload workflow until this is answered.

### CAPA / corrective actions are out of scope for EnvMon V2 parity

`getEnvMonCorrectiveActions` is intentionally not migrated — not blocked, not deferred pending a source. There is no V1 corrective action table, no V1 CAPA workflow, and no confirmed data source. Any future CAPA capability belongs to a **separate Quality Actions / Deviation / CAPA bounded context** — not in EnvMon Observations, Spatial Configuration, Estate Monitoring, or Spatial Analysis. That bounded context does not exist in V2 and requires its own domain analysis, data source identification, and contract design. Do not let the existing `openCorrectiveActions: 0` placeholder in `EnvMonSiteSummarySchema` create a false sense of coverage.

### em_* tables may not exist in connected_plant_uat

This is the single highest-impact unknown. If `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` returns no rows, Workstreams B, C, and D are entirely blocked. The tables were created by the V1 EnvMon app deployment — they are not data engineering artefacts and may not have been provisioned in the V2 UAT environment. **Do not assume they exist.**

---

## Closing Note

Challenge this sequence if V1 evidence suggests otherwise.

V1 had a **fully working heatmap and Spatial Studio** — these features were in production use. The design risk is low; the architecture is understood; the data model is documented. The uncertainty is entirely in V2 infrastructure: do the em_* tables exist in `connected_plant_uat`? Are they populated with real coordinate data? Have the gold views been provisioned with the expected columns?

The recommended sequence is conservative because it sequences DDL confirmation before route wiring — not because the feature design is in doubt. If the em_* tables are confirmed to exist and are populated, Workstreams B and C can proceed quickly. The spatial studio authoring workflow (Workstream D) is the only workstream that requires significant new V2 design work.

The CAPA and corrective action gap is the honest hard stop. V1 never implemented corrective actions. Do not let a mock-data placeholder (`openCorrectiveActions: 0`) become a silent permanent default in a food safety application.
