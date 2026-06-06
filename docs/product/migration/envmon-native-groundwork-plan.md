# EnvMon Native Databricks Groundwork Plan

**Date:** 2026-05-17 (i.txt groundwork) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery, l.txt hybrid framing)
**Status:** SAP QM SOURCE RECOVERED (confirmed-v1); SPATIAL CONFIG MODEL RECOVERED (confirmed-v1); DDL verification pending
**Outcome:** V1 is a hybrid domain. SAP QM source model confirmed. App-managed spatial configuration model confirmed (5 em_* tables). QuerySpec skeleton written for `getEnvMonSiteSummary`. Route deferred until DDL confirmed.

> **Status update (n.txt, 2026-05-17):** CAPA/corrective actions are **out of scope** for EnvMon V2 parity.
> Finding 6 below is preserved as historical analysis; the scope decision supersedes the "do not implement without workflow design" framing.
> `getEnvMonCorrectiveActions` is intentionally not migrated — not deferred pending design.

---

## Corrections

### k.txt correction (2026-05-17): LIMS → SAP QM

The i.txt groundwork incorrectly concluded that EnvMon has "no source model" and should be treated as a LIMS-only app with zero gold views. This conclusion was wrong.

**Corrected status (k.txt):**

> EnvMon V1 was fully functional and used SAP Quality inspection lot/result data filtered to `INSPECTION_TYPE IN ('14', 'Z14')`. The V1 source model has been recovered from the ConnectIO-RAD repo. Gold views are confirmed-v1 but DDL has not yet been run in connected_plant_uat.

The i.txt error occurred because the search used "LIMS" and "envmon" terminology instead of SAP QM terms (INSPECTION_TYPE, gold_inspection_lot, em_config). The V1 app is under `apps/envmon/` — but its data source is SAP QM inspection lots, not a standalone LIMS system.

### l.txt correction (2026-05-17): SAP QM only → hybrid domain

The k.txt correction over-indexed on the SAP QM side and did not document the spatial configuration sub-system. EnvMon V1 is a **hybrid domain** with two distinct data systems:

1. **SAP QM read model** — inspection lots/results from the Databricks gold layer (data-engineering owned)
2. **App-managed spatial configuration** — 5 Delta tables (`em_plant_floor`, `em_location_coordinates`, `em_layout_revision`, `em_location_zones`, `em_plant_geo`) owned by the V1 EnvMon app itself

The spatial configuration enables: floor plan display, functional-location coordinate placement, L4 zone definitions, layout revision lifecycle (draft/publish/rollback), and the heatmap visualisation. It is **not optional decoration** — the heatmap and zone methods cannot function without it.

**V1 spatial config DDL** has been recovered from V1 migration scripts (`apps/envmon/scripts/migrations/001b–007`) and is confirmed-v1. Whether these tables exist in connected_plant_uat is unknown.

See `docs/audit/envmon-spatial-configuration-model.md` for the full spatial config model.

---

## Current State (post l.txt, 2026-05-17)

| Item | Status |
|---|---|
| Adapter methods | 9 — all mock-only (no route wired) |
| FastAPI routes | None |
| Databricks QuerySpecs | **1** — `envmon.get_site_summary` (QuerySpec-only, no route) |
| Source system — SAP QM | INSPECTION_TYPE IN ('14','Z14') — TRACE_CATALOG/TRACE_SCHEMA |
| Gold views confirmed-v1 | **3** — gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v |
| Gold views confirmed-ddl | **0** — DDL not yet run in connected_plant_uat |
| App-managed tables confirmed-v1 | **5** — em_plant_floor, em_location_coordinates, em_layout_revision, em_location_zones, em_plant_geo |
| App-managed tables in UAT | **unknown** — run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` |
| Object resolver | "envmon" domain key added → TRACE_CATALOG / TRACE_SCHEMA |
| Legacy-api adapter | None — native Databricks will be first live path |

---

## What Was Audited (i.txt)

| Artefact | Finding |
|---|---|
| `domain-integrations/envmon/src/adapters/envmon-adapter.ts` | 9 mock-only methods; no Databricks imports; no QuerySpec |
| `packages/data-contracts/src/schemas/environmental-monitoring.ts` | 10 contract types defined; 3 key enums |
| `domain-integrations/envmon/src/panels/` | 8 panels; all `sourceOwnership: { systemName: 'lims' }` |
| `docs/product-model/envmon-monitoring.md` | lifecycle: live; 7 views; 8 panels |

---

## What Was Recovered (k.txt)

| Artefact | Finding |
|---|---|
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/utils/em_config.py` | **INSPECTION_TYPE IN ('14','Z14')** — definitive filter; all three gold view names |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/plants.py` | Full KPI SQL with join keys; basis for `getEnvMonSiteSummary` QuerySpec |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/heatmap.py` | Floor plan + result join SQL; app-managed table dependency identified |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/trends.py` | MIC time-series SQL |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/lots.py` | Per-location lot listing + per-lot MIC detail |
| `ConnectIO-RAD/ai-context/semantic-model/entities.yaml` | Column-level DDL for gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v, em_* tables |

---

## Key Findings (corrected)

**Finding 1 — Source system is SAP QM, not LIMS.**
EnvMon data originates from SAP QM inspection lots (recurring environmental inspection types 14/Z14). The data is in `TRACE_CATALOG.TRACE_SCHEMA` — the same catalog as Trace2. The LIMS badge in V1 panels (`systemName: 'lims'`) reflects the functional domain, not the data source technology.

**Finding 2 — Three gold views confirmed from V1 source.**
`gold_inspection_lot`, `gold_inspection_point`, and `gold_batch_quality_result_v` are confirmed-v1 from `em_config.py`, `entities.yaml`, and DAL SQL. DDL not yet run in connected_plant_uat.

**Finding 3 — First safe slice identified: `getEnvMonSiteSummary`.**
V1 `fetch_plant_kpis` (plants.py) uses only the three gold views — no app-managed em_* tables. This is the lowest-risk first slice. QuerySpec written in `apps/api/adapters/envmon/envmon_databricks_adapter.py`.

**Finding 4 — Heatmap and zone-level methods blocked by app-managed tables.**
The em_* tables are app-managed Delta tables owned by the V1 EnvMon app. Full DDL confirmed-v1 from V1 migration scripts. They may not exist in `connected_plant_uat`. Do not implement heatmap or zone methods until existence confirmed via `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`.

**Finding 5 — hygieneZone and areaType are NOT in V1.**
The V2 `EnvMonZone` and `EnvMonHeatmapCell` contracts have `hygieneZone: 'zone-1'|'zone-2'|'zone-3'|'zone-4'` and `areaType`. These fields have no V1 column equivalent. V1 zones are generic L4 spatial areas with `zone_name` and geometry only. Do not invent default values for these fields.

**Finding 6 — CAPA is NOT in V1 EnvMon.**
`getEnvMonCorrectiveActions` is entirely speculative. No CAPA tables, routes, or code exist in V1. Do not implement this method without a full new workflow design and identified data source.

**Finding 7 — Panel source badge concern remains.**
All 8 panels register `systemName: 'lims'`. When a native Databricks slice is wired, update `systemName` in each affected panel registration at the same time. Do not update the badge before wiring the route.

---

## Groundwork Documents

| Document | Purpose | Status |
|---|---|---|
| `docs/migration/envmon-v1-deep-dive.md` | Full V1 architecture (A/B/C/D/E) — hybrid domain | **New — l.txt** |
| `docs/audit/envmon-spatial-configuration-model.md` | App-managed spatial config — all 5 em_* tables with full DDL | **New — l.txt** |
| `docs/audit/envmon-v1-functional-capability-map.md` | 15 V1 user capabilities with V2 parity status | **New — l.txt** |
| `docs/audit/envmon-v1-to-v2-parity-gap.md` | Per-method V1→V2 parity gap analysis | **New — l.txt** |
| `docs/migration/envmon-advisor-recommendation.md` | Phased migration recommendation (workstreams A/B/C/D) | **New — l.txt** |
| `docs/migration/envmon-v1-functional-recovery.md` | V1 SAP QM source recovery report | New — k.txt |
| `docs/audit/envmon-sap-qm-source-model.md` | SAP QM view/column documentation | New — k.txt |
| `docs/audit/envmon-inspection-lot-type-filter.md` | INSPECTION_TYPE IN ('14','Z14') filter | New — k.txt |
| `docs/domains/envmon-monitoring.md` | Adapter/contract/source reference | Updated — k.txt |
| `docs/audit/envmon-contract-inventory.md` | Per-method fields + SAP QM mapping | Updated — k.txt |
| `docs/audit/envmon-databricks-source-candidates.md` | Source candidates (confirmed-v1) | Updated — k.txt |
| `docs/audit/envmon-native-column-verification-checklist.md` | DDL checks — Group A SAP QM + Group B em_* | Updated — l.txt |
| `docs/migration/envmon-native-candidate-ranking.md` | Ranked candidates with V1 evidence | Updated — k.txt |
| `docs/audit/envmon-native-architecture-check.md` | Architecture guardrail check | Updated — k.txt |

---

## What Is Needed to Un-defer the Route

In order:

1. **Run `DESCRIBE TABLE`** for all three gold views in connected_plant_uat SQL Editor
2. **Run `SELECT DISTINCT INSPECTION_TYPE`** — confirm '14' and 'Z14' are present
3. **Run `SELECT DISTINCT INSPECTION_RESULT_VALUATION`** — confirm valuation values
4. **Update `docs/audit/envmon-native-column-verification-checklist.md`** — mark columns `confirmed-ddl`
5. **Wire `GET /api/envmon/site-summary` route** in `apps/api/routes/envmon.py` (file does not yet exist)
6. **Browser-verify** in UAT before claiming BV status

Do not wire the route before step 4. The QuerySpec SQL is confirmed-v1 only.
