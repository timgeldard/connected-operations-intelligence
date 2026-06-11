# EnvMon Site Summary — Native Route Plan

**Date:** 2026-05-17 (m.txt) | **Updated:** 2026-05-17 (n.txt — DDL confirmed, route wired)
**Tranche:** m.txt (QuerySpec) → n.txt (route wiring)
**Status:** COMPLETE — route wired, DDL confirmed, 99 tests passing; browser verification pending
**Primary deliverable:** `GET /api/envmon/site-summary` — wired in `apps/api/routes/envmon.py`
**References:**
- `docs/migration/envmon-v1-functional-recovery.md`
- `docs/audit/envmon-native-column-verification-checklist.md`
- `docs/audit/envmon-sap-qm-source-model.md`
- `docs/audit/envmon-spatial-configuration-model.md`
- `apps/api/adapters/envmon/envmon_databricks_adapter.py`

---

## What is confirmed-v1

All three SAP QM gold views are confirmed from V1 ConnectIO-RAD source code and entities.yaml
(k.txt, 2026-05-17). DDL confirmed for all three in connected_plant_uat (n.txt, 2026-05-17).

| Object | Status | Evidence |
|---|---|---|
| `gold_inspection_lot` | confirmed-v1 | V1 `em_config.py` LOT_TBL_NAME; `entities.yaml`; `plants.py` SQL |
| `gold_inspection_point` | confirmed-v1 | V1 `em_config.py` POINT_TBL_NAME; `entities.yaml`; join keys in `plants.py` |
| `gold_batch_quality_result_v` | confirmed-v1 | V1 `em_config.py` RESULT_TBL_NAME; `entities.yaml`; join keys in `plants.py` |
| Domain key "envmon" in object_resolver | confirmed | `apps/api/shared/query_service/object_resolver.py` lines 26, 33 |
| INSPECTION_TYPE filter `('14','Z14')` | confirmed-v1 | V1 `em_config.py` INSPECTION_TYPES + INSP_TYPES_SQL |
| Join key pattern (lot→point→result) | confirmed-v1 | V1 `plants.py` `fetch_plant_kpis` LEFT JOIN clause |
| Valuation mapping (R/REJ/REJECT→fail, W/WARN→warn, NULL→pending) | confirmed-v1 | V1 `plants.py` CASE WHEN clauses |
| App-managed em_* table DDL | confirmed-v1 | V1 migration scripts 001b–007 (ConnectIO-RAD) |

**Catalog:** `TRACE_CATALOG` / `TRACE_SCHEMA` (default `connected_plant_uat.gold`) — same as Trace2.

---

## What requires DDL verification before the route can be wired

All of the following must be confirmed via `DESCRIBE TABLE` in connected_plant_uat:

| Object | Required columns | Status |
|---|---|---|
| `connected_plant_uat.gold.gold_inspection_lot` | INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE | **confirmed-ddl 2026-05-17** |
| `connected_plant_uat.gold.gold_inspection_point` | INSPECTION_LOT_ID, FUNCTIONAL_LOCATION, OPERATION_ID, SAMPLE_ID | **confirmed-ddl 2026-05-17** |
| `connected_plant_uat.gold.gold_batch_quality_result_v` | INSPECTION_LOT_ID, OPERATION_ID, SAMPLE_ID, INSPECTION_RESULT_VALUATION | **confirmed-ddl 2026-05-17** |
| INSPECTION_TYPE values in data | `SELECT DISTINCT INSPECTION_TYPE` — confirm '14' and 'Z14' present | Not yet run — route wired on DDL confirmation |
| INSPECTION_RESULT_VALUATION values | `SELECT DISTINCT INSPECTION_RESULT_VALUATION` — confirm R/REJ/W/WARN/A values | Not yet run — verify during browser verification |
| em_* table existence | `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` | Not yet run — Group B (spatial) unrelated to site-summary route |

**Full DDL SQL to run:** see `docs/audit/envmon-native-column-verification-checklist.md`.

**Stop condition (m.txt §12):** If any required object does not exist, or any required column is
missing or renamed, do not wire the route. Update docs with exact blocker and stop.

---

## What will be implemented when DDL is confirmed

### Route

```
GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17
```

**File to create:** `apps/api/routes/envmon.py`  
**Pattern to follow:** `apps/api/routes/process_order.py`

### Request parameters

| Parameter | Required | Validation |
|---|---|---|
| `plant_id` | Yes | Non-empty string |
| `period_start` | Yes | ISO date |
| `period_end` | Yes | ISO date |

No default date ranges. All three parameters must be provided explicitly.

### Response

`EnvMonSiteSummary` (from `packages/data-contracts/src/schemas/environmental-monitoring.ts`),
mapped by `map_site_summary_rows` in `envmon_databricks_adapter.py`.

### Response headers

| Header | Value |
|---|---|
| `X-Data-Source` | `databricks-api` |
| `X-Adapter-Mode` | `databricks-api` |
| `X-Query-Name` | `envmon.get_site_summary` |

### Error behaviour

| Condition | HTTP status |
|---|---|
| `BACKEND_ADAPTER_MODE != databricks-api` | 503 |
| Missing OAuth (`x-forwarded-access-token` absent) | 401 |
| Missing Databricks config (host/warehouse_id) | 503 |
| UC permission error | 403 |
| Rate limit | 429 |
| Query/SQL error | 502 |
| Timeout | 504 |

### Guardrails (all non-negotiable)

- No fallback to mock
- No fallback to legacy-api
- No SPN/PAT fallback
- No SQL in route handler
- No SQL in React

---

## What is deferred (explicit m.txt §1 deferrals)

| Feature | Reason |
|---|---|
| Swab/result list (`getEnvMonSwabResults`) | Separate slice — after DDL confirmed |
| Trends (`getEnvMonTrends`) | Requires period-over-period query; trendDirection is a placeholder |
| Alerts (`getEnvMonAlerts`) | Alert rules undefined |
| Zones (`getEnvMonZones`) | Requires `em_location_zones` — UAT existence unknown |
| Heatmap (`getEnvMonHeatmap`) | Requires em_* spatial tables; `em_location_coordinates` existence unknown |
| Floorplan upload | No upload handler found in V1; out of scope for this tranche |
| Floorplan maintenance | Spatial write API — out of scope |
| Coordinate maintenance | Spatial write API — out of scope |
| L4/hygiene zoning maintenance | No V1 source; requires new schema design |
| Corrective actions/CAPA (`getEnvMonCorrectiveActions`) | Out of scope — CAPA/corrective actions not a V2 EnvMon parity requirement; intentionally not migrated |

---

## Fields with partial coverage

These fields are in the V2 `EnvMonSiteSummary` contract but cannot be derived from the
V1 KPI query alone. They return placeholder values in `map_site_summary_rows`.

| Field | Coverage | Placeholder | Source needed |
|---|---|---|---|
| `totalSamples` | Full | No placeholder | `lots_tested` from aggregate |
| `positiveSamples` | Full | No placeholder | `active_fails` from aggregate |
| `positiveRate` | Full | No placeholder | `active_fails / total_locs` |
| `criticalZoneExposures` | **Not available** | `0` — NOT a factual count | Requires `em_location_zones` join; UAT existence unknown |
| `openCorrectiveActions` | **Contract compat only** | `0` — fixed; CAPA out of scope for EnvMon V2 parity | Not applicable — CAPA is intentionally not migrated |
| `trendDirection` | **Not available** | `"stable"` — NOT a calculated signal | Requires period-over-period rate comparison |

Placeholder labels are in `apps/api/adapters/envmon/envmon_databricks_adapter.py`
(`map_site_summary_rows` and `_default_site_summary`). These are clearly commented as
TEMPORARY CONTRACT PLACEHOLDERS, not business facts.

**Coverage metadata pattern:** No project-wide `coverage` field pattern exists in
`packages/data-contracts`. Comments in the adapter are the documentation mechanism for now.
If the contract is updated to add optional/nullable coverage fields, update the mapper then.

---

## QuerySpec hardening status (m.txt §5)

| Check | Status |
|---|---|
| SQL inside QuerySpec factory only | ✓ confirmed |
| Object names via `resolve_domain_object("envmon", ...)` | ✓ confirmed |
| Params bound (plant_id, period_start, period_end) | ✓ confirmed |
| No string concatenation of request values into SQL | ✓ confirmed |
| `LIMIT :max_rows` bug | **FIXED (m.txt)** — changed to `LIMIT 1` (aggregate returns one row by design) |
| Query name `envmon.get_site_summary` | ✓ confirmed |
| Endpoint `/api/envmon/site-summary` | ✓ confirmed |
| Cache policy `CacheTier.PER_USER_60S` | ✓ confirmed |
| Comments: confirmed-v1, DDL required, route deferred | ✓ confirmed |
| max_rows NOT in params (correct — LIMIT 1 literal used) | ✓ confirmed |

---

## Spatial configuration check (m.txt §3)

Group B em_* tables are documented but not implemented in this tranche.

Before any spatial feature is designed:
```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

If tables exist: update `docs/audit/envmon-spatial-configuration-model.md` and
`docs/audit/envmon-native-column-verification-checklist.md` with confirmed-ddl status.

If tables do not exist: they are confirmed-v1 from V1 migrations but not yet deployed to UAT.
Required later for heatmap, zones, floorplans, and L4 zoning. No spatial routes wired until then.

---

## Route wiring — COMPLETE (n.txt, 2026-05-17)

**Route wired in n.txt.** DDL confirmed for all three Group A views. Route implemented and all tests pass.

**n.txt deliverables (2026-05-17):**

1. ✓ All Group A required columns marked `confirmed-ddl` in `docs/audit/envmon-native-column-verification-checklist.md`
2. ✓ `apps/api/routes/envmon.py` created (following POH route pattern)
3. ✓ Route registered in `apps/api/main.py`
4. ✓ 99 tests passing (80 adapter tests + 19 route tests in `tests/routes/test_envmon_routes.py`)
5. ✓ Advisor quick-fixes: V2-derivation comment block, schema-key-shape route test, CTE backtick comments explained
6. [ ] Deploy to UAT and run browser verification checklist in `docs/deployment/envmon-native-browser-verification.md`
7. [ ] Wire frontend adapter to `/api/envmon/site-summary` (only after browser verification passes)
