# EnvMon Native Databricks — Browser Verification Checklist

**Date:** 2026-05-17  
**Updated:** 2026-05-18 (UI browser-verified; numeric schema widening deployed)
**Status:** site-summary and swab-results APIs browser-verified 2026-05-18; read-only monitoring screen (`?workspace=envmon-monitoring`) browser-verified 2026-05-18
**Reference:** `docs/migration/envmon-site-summary-native-route-plan.md`

---

## Current Status

**Routes `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results` are WIRED (n.txt + p.txt, 2026-05-17).**
The primary EnvMon workspace now opens a read-only monitoring screen at `?workspace=envmon-monitoring`.

DDL confirmed for all three Group A views via `DESCRIBE TABLE` in `connected_plant_uat` on
2026-05-17. Both routes implemented in `apps/api/routes/envmon.py`, registered in `main.py`.
608 backend tests passing. Browser verification pending — requires deployment to UAT.

Previously blocking items (all resolved):

- [x] DDL confirmed for all three Group A views (2026-05-17)
- [x] `apps/api/routes/envmon.py` implemented (n.txt, 2026-05-17)
- [x] Route registered in FastAPI app (`main.py`)
- [x] `GET /api/envmon/site-summary`: 99 tests passing (n.txt)
- [x] `GET /api/envmon/swab-results`: 56 new tests (adapter + route) passing (p.txt)
- [x] App deployed to UAT with `BACKEND_ADAPTER_MODE=databricks-api` — deployed 2026-05-18 (f.txt)

---

## Route: `GET /api/envmon/site-summary`

**Status: BROWSER-VERIFIED 2026-05-18 — HTTP 200, all 12 schema keys present**

```
GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17
```

### Required query parameters

| Parameter | Required | Example | Notes |
|---|---|---|---|
| `plant_id` | Yes | `C061` | SAP plant code — no default |
| `period_start` | Yes | `2026-01-01` | ISO date — no default unbounded range |
| `period_end` | Yes | `2026-05-17` | ISO date — no default |

### Expected: success

| Property | Expected value |
|---|---|
| HTTP status | 200 |
| `X-Data-Source` header | `databricks-api` |
| `X-Adapter-Mode` header | `databricks-api` |
| `X-Query-Name` header | `envmon.get_site_summary` |
| Body shape | `EnvMonSiteSummary` (see below) |

### Expected body shape

```json
{
  "plantId": "C061",
  "plantName": "",
  "zonesMonitored": 50,
  "zonesWithAlerts": 3,
  "positiveCount": 3,
  "positiveRate": 6.0,
  "openCorrectiveActions": 0,
  "overdueActions": 0,
  "complianceRate": 88.0,
  "riskStatus": "non-compliant",
  "highestSeverity": "high",
  "confidence": 1.0
}
```

**Note on partial coverage fields:** `plantName` returns `""` (no gold_plant JOIN in current SQL — PLACEHOLDER).
`openCorrectiveActions`/`overdueActions` return `0` — contract compatibility only; CAPA is out of scope for
EnvMon V2 parity and these values are fixed at 0. The remaining fields (`riskStatus`, `highestSeverity`,
`complianceRate`, `confidence`) are V2-contract derivations computed from inspection-lot aggregate counts —
not V1 business semantics.

### Expected: error cases

| Condition | Expected HTTP status | How to trigger |
|---|---|---|
| Session expired or no cookie | 401 | Clear session cookies and retry |
| Wrong `BACKEND_ADAPTER_MODE` | 503 | Deploy with `BACKEND_ADAPTER_MODE=legacy-api` or unset |
| Missing Databricks config | 503 | Remove `DATABRICKS_HOST` from app.yaml |
| UC permission denied | 403 | Remove UC permissions for the user's identity on gold views |
| Rate limit | 429 | Trigger many rapid requests |
| SQL/query error | 502 | Introduce bad SQL or wrong view name |
| Timeout | 504 | Use a warehouse that is suspended and slow to start |

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 Unauthorized | Missing or expired Databricks Apps session | Log in at the Databricks Apps URL and retry |
| 503 Service Unavailable | `BACKEND_ADAPTER_MODE != databricks-api` | Check `app.yaml` → `BACKEND_ADAPTER_MODE` value; redeploy |
| 503 missing config | `DATABRICKS_HOST` or `DATABRICKS_WAREHOUSE_ID` unset | Check app.yaml secrets; confirm warehouse ID |
| 403 Forbidden | User lacks UC SELECT on `connected_plant_uat.gold.*` | Check UC permissions via Databricks admin |
| 429 Too Many Requests | Statement-level rate limit hit | Wait and retry; check cluster/warehouse limits |
| 502 Bad Gateway | Databricks query failed | Check `databricks apps logs connectio-v2` for SQL error; verify view names |
| 504 Gateway Timeout | SQL timeout | Check warehouse availability; increase timeout in QuerySpec if needed |
| 200 with zeros | No data for plant_id / period | Run `SELECT DISTINCT PLANT_ID FROM connected_plant_uat.gold.gold_inspection_lot WHERE INSPECTION_TYPE IN ('14','Z14')` to find valid plant IDs |
| `X-Data-Source` absent | Route not implementing header set | Verify `set_databricks_response_headers` is called in route |
| `openCorrectiveActions` or `overdueActions` non-zero | Unexpected — contract compatibility fixed zeros must not vary | Investigate mapper; CAPA is out of scope, these values are always 0 |

---

## Manual Result Record

| Date | Tester | Route | HTTP | `X-Data-Source` | `X-Query-Name` | Data returned | Notes |
|---|---|---|---|---|---|---|---|
| 2026-05-18 | tim.geldard@kerry.com | `GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18` | 200 | databricks-api (via gap-auth) | — | `positiveCount:0, highestSeverity:"low", riskStatus:"unknown"` | All 12 schema keys present; UC GRANT on connected_plant_uat.gold active |
| 2026-05-18 | tim.geldard@kerry.com | `GET /api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18&limit=100` | 200 | — | — | — | HTTP 200 confirmed; UC GRANT on connected_plant_uat.gold active |

**Do not mark any item above as verified without live UAT testing in Databricks Apps.**  
**Do not claim browser verification unless actually tested in Databricks Apps.**

---

## Route: `GET /api/envmon/swab-results`

**Status: BROWSER-VERIFIED 2026-05-18 — HTTP 200**

```
GET /api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17&limit=100
```

### Required query parameters

| Parameter | Required | Example | Notes |
|---|---|---|---|
| `plant_id` | Yes | `C061` | SAP plant code — no default |
| `period_start` | Yes | `2026-01-01` | ISO date — filters `lot.CREATED_DATE >= period_start` |
| `period_end` | Yes | `2026-05-17` | ISO date — filters `lot.CREATED_DATE <= period_end` |
| `limit` | No | `100` | Clamped to [1, 500] at route; default 100 |

### Expected: success

| Property | Expected value |
|---|---|
| HTTP status | 200 |
| Body type | JSON array (may be empty `[]` if no data) |
| `X-Data-Source` header | `databricks-api` |
| `X-Adapter-Mode` header | `databricks-api` |
| `X-Query-Name` header | `envmon.get_swab_results` |

### Expected body item shape

Each element in the array represents one MIC test result per sample point per inspection lot.
Key fields:

| Field | Source | Notes |
|---|---|---|
| `inspectionLotId` | `gold_inspection_lot.INSPECTION_LOT_ID` | SAP inspection lot ID |
| `functionalLocation` | `gold_inspection_point.FUNCTIONAL_LOCATION` | Sampling location code |
| `micId` | `gold_batch_quality_result_v.MIC_ID` | MIC characteristic ID |
| `micName` | `gold_batch_quality_result_v.MIC_NAME` | MIC name (organism/test type) |
| `valuation` | `gold_batch_quality_result_v.INSPECTION_RESULT_VALUATION` | Raw SAP valuation (R/REJ/W/WARN/A/null) |
| `status` | Derived from `valuation` | `fail` / `warning` / `pass` / `pending` |
| `result` | `gold_batch_quality_result_v.RESULT` | Raw SAP RESULT column — distinct from valuation |
| `createdDate` | `gold_inspection_lot.CREATED_DATE` | Lot creation date |
| `plantId` | `gold_inspection_lot.PLANT_ID` | Should match query `plant_id` |

### Status derivation mapping (confirmed-v1)

| `valuation` value | Derived `status` |
|---|---|
| `null` (no usage decision) | `pending` |
| `R`, `REJ`, `REJECT` | `fail` |
| `W`, `WARN` | `warning` |
| `A` or any other non-null | `pass` |
| `""` (empty string) | `pending` |

### No spatial enrichment

`zoneId`, `zoneName`, `hygieneZone`, `areaType` are **not present** in this response. They require
`em_location_zones` (existence in UAT unknown). The read-only monitoring screen intentionally uses
the native SAP QM result shape instead of the legacy mock `EnvMonSwabResult` shape because zoneId
and zoneName cannot be sourced from SAP QM alone.

---

## UI: `?workspace=envmon-monitoring`

**Status: BROWSER-VERIFIED 2026-05-18**

Primary screen sections:

- Site Summary from `/api/envmon/site-summary`
- Swab Results Table from `/api/envmon/swab-results`
- Result Detail for selected row
- Derived Indicators from returned swab rows only
- Source and Limitations banner

Explicitly out of scope in the screen: CAPA/corrective actions, floorplan upload/edit,
coordinate maintenance, L4/hygiene zone maintenance, spatial write APIs, heatmap editor,
alert acknowledgement, and reswab scheduling workflows.

UI verification checklist (PASSED 2026-05-18, tim.geldard@kerry.com):

- [x] Open `https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=envmon-monitoring`
- [x] Enter `plant_id=C061`, `period_start=2026-01-01`, `period_end=2026-05-18`, `limit=100`
- [x] Click Run / Refresh
- [x] Site summary renders or shows an honest empty/error state
- [x] Swab results table renders or shows an honest empty/error state
- [x] Source banner is visible
- [x] CAPA is shown only as out of scope
- [x] Spatial/floorplan/zone/heatmap is shown only as deferred
- [x] No mock heatmap, mock CAPA, or mock alert workflow appears on the primary path

### Expected: error cases

| Condition | Expected HTTP status | How to trigger |
|---|---|---|
| Missing required param | 422 | Omit `plant_id`, `period_start`, or `period_end` |
| Session expired or no cookie | 401 | Clear session cookies and retry |
| Wrong `BACKEND_ADAPTER_MODE` | 503 | Deploy with `BACKEND_ADAPTER_MODE=legacy-api` or unset |
| Missing Databricks config | 503 | Remove `DATABRICKS_HOST` from app.yaml |
| UC permission denied | 403 | Remove UC SELECT on `connected_plant_uat.gold.*` for the user's identity |
| Rate limit | 429 | Trigger many rapid requests |
| SQL/query error | 502 | Introduce bad SQL or wrong view name |
| Timeout | 504 | Use a suspended warehouse |

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 | Expired/missing Databricks Apps session | Log in at the Databricks Apps URL and retry |
| 503 | `BACKEND_ADAPTER_MODE != databricks-api` | Check `app.yaml` → `BACKEND_ADAPTER_MODE`; redeploy |
| 503 config | Missing `DATABRICKS_HOST` or `DATABRICKS_WAREHOUSE_ID` | Check app.yaml secrets |
| 200 but `[]` empty array | No EnvMon lots for plant/period | Run `SELECT DISTINCT PLANT_ID FROM gold_inspection_lot WHERE INSPECTION_TYPE IN ('14','Z14')` |
| `status` always `pass` | No fail/warn valuations in UAT data | Run `SELECT DISTINCT INSPECTION_RESULT_VALUATION FROM gold_batch_quality_result_v LIMIT 50` |
| `X-Data-Source` absent | `set_databricks_response_headers` not called | Verify route handler implementation |

---

## History

---

## Candidate Future Routes (o.txt — not yet wired)

The following routes are documented targets. None are wired. Do not attempt to browser-verify them.

| Proposed route | Method | Source dependency | Gate before wiring |
|---|---|---|---|
| `GET /api/envmon/plant-map` | `getEnvMonPlantMap` (PROPOSED) | `em_plant_geo` | em_plant_geo confirmed in UAT + contract designed + site-summary BV |
| `GET /api/envmon/plant-hotspots` | `getEnvMonPlantHotspots` (PROPOSED) | `em_plant_geo` + observation aggregate | plant-map implemented + site-summary BV |
| `GET /api/envmon/floors` | *(not yet designed)* | `em_plant_floor` | em_plant_floor confirmed in UAT |
| `GET /api/envmon/floorplan` | *(not yet designed)* | `em_layout_revision` | em_layout_revision confirmed in UAT |
| `GET /api/envmon/location-coordinates` | *(not yet designed)* | `em_location_coordinates` | em_location_coordinates confirmed in UAT |
| `GET /api/envmon/zones` | `getEnvMonZones` | `em_location_zones` | em_location_zones confirmed in UAT |
| `GET /api/envmon/heatmap` | `getEnvMonHeatmap` | SAP QM gold views + `em_location_coordinates` + `em_plant_floor` | All em_* confirmed + site-summary BV |

plant geo and floorplan routes both depend on `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` returning rows.

---

## History

| Date | Tranche | Change |
|---|---|---|
| 2026-05-17 | j.txt | Created with placeholder routes `/api/envmon/locations` and `/api/envmon/swab-results` (pre-source-recovery) |
| 2026-05-17 | m.txt | Replaced with correct route `/api/envmon/site-summary`; marked BLOCKED by DDL; added required params, expected body shape, partial coverage note, full troubleshooting guide |
| 2026-05-17 | n.txt | DDL confirmed; route wired; status EXECUTABLE; body shape updated to V2 contract (EnvMonSiteSummarySchema); placeholder/derivation distinction clarified |
| 2026-05-17 | o.txt | Candidate future routes section added (plant-map, plant-hotspots, floors, floorplan, location-coordinates, zones, heatmap); all marked planned/not wired |
| 2026-05-17 | p.txt | Swab-results route section added (`GET /api/envmon/swab-results`); route wired in `apps/api/routes/envmon.py`; DDL confirmed (same Group A SAP QM views); 56 new tests; BV pending; frontend wiring deferred (zoneId/zoneName unavailable from SAP QM alone) |
| 2026-05-18 | f.txt | UI BV complete. `WorkspaceViews.tsx` routing fixed (was defaulting to mock `scope-overview`). `EnvMonNativeSwabResultSchema` numeric fields widened to `z.union([z.number(), z.string()])` — Databricks returns DECIMAL/FLOAT as strings. Test updated to use invalid enum instead of string numeric. All three sections (UI `?workspace=envmon-monitoring`, `GET /api/envmon/site-summary`, `GET /api/envmon/swab-results`) now fully browser-verified. |
