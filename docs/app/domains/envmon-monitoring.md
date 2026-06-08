# Environmental Monitoring — Adapter and Contract Reference

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery, l.txt hybrid framing)  
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`  
**Data contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`  
**Product model:** `docs/product-model/envmon-monitoring.md` (workspace views, panels, metadata)  
**Migration plan:** `docs/migration/envmon-native-groundwork-plan.md`

**EnvMon V1 is a hybrid domain.** It is not LIMS-only and not SAP-QM-only. Two distinct data systems power it:

1. **SAP QM read model** — inspection lots, points, and results from the Databricks gold layer (`TRACE_CATALOG/TRACE_SCHEMA`), filtered to `INSPECTION_TYPE IN ('14','Z14')`
2. **App-managed spatial configuration** — five Delta tables owned by the V1 EnvMon app itself: `em_plant_floor`, `em_location_coordinates`, `em_layout_revision`, `em_location_zones`, `em_plant_geo`

The spatial sub-system enables floor plan display, functional-location coordinate placement, L4 zone definitions, and the heatmap. It is not optional decoration — `getEnvMonHeatmap` and `getEnvMonZones` cannot be implemented without it.

This document covers the adapter interface, data contract structure, source system status, and migration blockers. For workspace views, panel layout, and product-level detail see the product model above.

---

## Source System (corrected, l.txt 2026-05-17)

**Source A — SAP QM inspection lots (read):** EnvMon V1 reads from `TRACE_CATALOG / TRACE_SCHEMA` (default `connected_plant_uat.gold`), filtered to `INSPECTION_TYPE IN ('14', 'Z14')`.

**Source B — App-managed spatial configuration (read/write):** Five Delta tables in the same catalog — `em_plant_floor`, `em_location_coordinates`, `em_layout_revision`, `em_location_zones`, `em_plant_geo` — owned and written by the V1 EnvMon app. Existence in `connected_plant_uat` is unconfirmed.

The `systemName: 'lims'` badge in V1 panels reflects the functional domain context, not the data integration technology.

| Item | Value |
|---|---|
| SAP QM catalog env var | `TRACE_CATALOG` |
| SAP QM schema env var | `TRACE_SCHEMA` (default: `gold`) |
| Inspection type filter | `INSPECTION_TYPE IN ('14', 'Z14')` |
| Gold views confirmed-v1 | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` |
| Gold views confirmed-ddl | **Zero** — DDL not yet run in connected_plant_uat |
| App-managed tables confirmed-v1 | `em_plant_floor`, `em_location_coordinates`, `em_layout_revision`, `em_location_zones`, `em_plant_geo` |
| App-managed tables in UAT | **Unknown** — run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` |
| QuerySpecs written | **1** — `envmon.get_site_summary` (QuerySpec-only, no route wired) |
| FastAPI routes | **None** — deferred until DDL confirmed |
| Legacy-api adapter | None — native Databricks will be first live data path |

---

## Adapter Interface

**Class:** `EnvMonAdapter`
**Request interface:** `{ readonly regionId?: string; readonly plantId?: string; readonly periodStart?: string; readonly periodEnd?: string }`

All request fields are optional. The mock adapter ignores them. Future native slices will use `plantId` and `periodStart`/`periodEnd` for WHERE clause filtering; `regionId` maps to a site grouping concept.

---

## Adapter Methods

| Method | Return type | Status |
|---|---|---|
| `getEnvMonContext` | `EnvMonContext` | Mock |
| `getEnvMonSiteSummary` | `EnvMonSiteSummary` | Mock — **QuerySpec written** (DDL pending; route not wired) |
| `getEnvMonZones` | `EnvMonZone[]` | Mock — blocked on em_location_zones |
| `getEnvMonAlerts` | `EnvMonAlert[]` | Mock — alert derivation logic undefined |
| `getEnvMonSwabResults` | `EnvMonSwabResult[]` | Mock — after DDL verification |
| `getEnvMonTrends` | `EnvMonTrend[]` | Mock — after DDL verification |
| `getEnvMonHeatmap` | `EnvMonHeatmapCell[]` | Mock — blocked on em_* app-managed tables |
| `getEnvMonCorrectiveActions` | `EnvMonCorrectiveAction[]` | Mock — out of scope; CAPA not a V2 EnvMon parity requirement |
| `getEnvMonSwabVectors` | `EnvMonSwabVector[]` | Mock — business rules undefined; deferred indefinitely |

---

## Key Contract Enums

Defined in `packages/data-contracts/src/schemas/environmental-monitoring.ts`. Must be confirmed against actual source view data with `SELECT DISTINCT` before column mapping.

| Field | Allowed values (V2 contract) | SAP QM equivalent (confirmed-v1) |
|---|---|---|
| `result` | `negative`, `positive`, `borderline`, `pending` | VALUATION: A→negative, R/REJ/REJECT→positive, W/WARN→borderline, NULL→pending |
| `hygieneZone` | `zone-1`, `zone-2`, `zone-3`, `zone-4` | Derived from em_location_zones (app-managed — existence unknown in UAT) |
| `areaType` | `production`, `storage`, `packaging`, `utility`, `corridor`, `other` | Derived from em_location_zones (same) |

---

## Panel Source Badge

All 8 EnvMon panels register:

```typescript
sourceOwnership: {
  domainId: 'envmon',
  systemName: 'lims',
  legacyAppId: 'lims',
}
```

This is **static metadata** — not a runtime field from the API response. The EvidencePanel component renders `systemName` as the visible source badge. When a native Databricks route is wired, update `systemName` to reflect the actual source (`'sap-qm'` or `'databricks'`) in each affected panel's registration. Do this at the same time as wiring the route — not before.

---

## Migration Blockers

1. **Group A DDL not run** — run `DESCRIBE TABLE` for all three gold views in connected_plant_uat before wiring any route
2. **Inspection type filter not DDL-confirmed** — run `SELECT DISTINCT INSPECTION_TYPE` to confirm '14' and 'Z14' are present
3. **Group B em_* existence unknown** — zone, heatmap, and coordinates methods require app-managed tables that may not exist in connected_plant_uat; run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` first
4. **hygieneZone / areaType have no V1 source** — V1 em_location_zones has no hygiene classification columns; these V2 contract fields require new zone classification design, not migration
5. **CAPA is out of scope for EnvMon V2 parity** — `getEnvMonCorrectiveActions` is intentionally not migrated; future CAPA belongs to a separate Quality Actions / Deviation / CAPA bounded context
6. **Background image upload unknown** — no V1 upload handler found; image hosting solution must be clarified before designing V2 upload
7. **No route path established** — EnvMon will use `/api/envmon/` (file does not yet exist)

For the full groundwork plan and recovery detail see `docs/migration/envmon-native-groundwork-plan.md` and `docs/migration/envmon-v1-deep-dive.md`.  
For SAP QM source view documentation see `docs/audit/envmon-sap-qm-source-model.md`.  
For spatial configuration model see `docs/audit/envmon-spatial-configuration-model.md`.  
For DDL verification (Group A + B) see `docs/audit/envmon-native-column-verification-checklist.md`.  
For V1→V2 parity gap see `docs/audit/envmon-v1-to-v2-parity-gap.md`.  
For migration sequencing see `docs/migration/envmon-advisor-recommendation.md`.
