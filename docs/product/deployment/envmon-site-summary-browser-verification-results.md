# EnvMon Site Summary — Browser Verification Results Template

**Date:** 2026-05-17  
**Route:** `GET /api/envmon/site-summary`  
**Status:** NOT YET BROWSER-VERIFIED — do not mark as verified without live UAT testing  
**Reference:** `docs/deployment/envmon-native-browser-verification.md`

---

> **Warning:** This document is a template and reference for the tester. None of the checks below
> have been confirmed against a live UAT environment. Do not claim browser verification unless you
> have actually run the request in Databricks Apps and confirmed each item.

---

## Test URL

```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17
```

Replace `C061` with a plant that has SAP QM inspection lots with `INSPECTION_TYPE IN ('14','Z14')` in the period.

If no data is known, first run:
```sql
SELECT DISTINCT PLANT_ID
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14', 'Z14')
ORDER BY PLANT_ID;
```

---

## Expected response headers (all three required)

| Header | Expected value |
|---|---|
| `X-Data-Source` | `databricks-api` |
| `X-Adapter-Mode` | `databricks-api` |
| `X-Query-Name` | `envmon.get_site_summary` |

---

## Expected body shape

`EnvMonSiteSummarySchema` from `packages/data-contracts/src/schemas/environmental-monitoring.ts`.

All 12 keys must be present. Example with real data (values will differ):

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

### Field notes

| Field | Expected | Notes |
|---|---|---|
| `plantId` | Matches query param `plant_id` | Required |
| `plantName` | `""` | PLACEHOLDER — no `gold_plant` JOIN in current SQL; expected empty string |
| `zonesMonitored` | Non-negative integer | Count of distinct `FUNCTIONAL_LOCATION` values in the period |
| `zonesWithAlerts` | 0 ≤ zonesWithAlerts ≤ zonesMonitored | Locations with at least one fail/warn |
| `positiveCount` | Non-negative integer | Count of distinct locations with at least one fail |
| `positiveRate` | 0.0 – 100.0 | Percentage (NOT 0–1 fraction); `positiveCount / zonesMonitored * 100` |
| `openCorrectiveActions` | **Always `0`** | CONTRACT COMPATIBILITY ONLY — CAPA is out of scope for EnvMon V2 parity; not a factual count |
| `overdueActions` | **Always `0`** | CONTRACT COMPATIBILITY ONLY — same reason as above |
| `complianceRate` | 0.0 – 100.0 | Percentage non-fail locations; `(zonesMonitored - positiveCount) / zonesMonitored * 100` |
| `riskStatus` | One of: `compliant`, `elevated`, `non-compliant`, `unknown` | Derived from fail rate thresholds |
| `highestSeverity` | One of: `low`, `medium`, `high`, `critical`, `unknown` | Derived from fail count |
| `confidence` | 0.0 – 1.0 | Coverage signal; 0.0 if no data, 1.0 if data present |

**`openCorrectiveActions` and `overdueActions` are fixed zeros, not business data.** They exist for backwards
contract compatibility with V1-era consumers. They must always be 0 — a non-zero value would indicate a
mapper bug, not real data. CAPA is intentionally not migrated. See `docs/architecture/envmon-ddd-model.md`
§ "What is NOT in EnvMon".

---

## No-data case (plant_id with no EnvMon lots)

When no inspection lots exist for `plant_id` in the period, the route returns a default shape with zeros
and `"unknown"` status values — **not 404**. This is by design: the frontend must show a zero-state, not an error.

Expected body (no-data plant):

```json
{
  "plantId": "XXXX",
  "plantName": "",
  "zonesMonitored": 0,
  "zonesWithAlerts": 0,
  "positiveCount": 0,
  "positiveRate": 0.0,
  "openCorrectiveActions": 0,
  "overdueActions": 0,
  "complianceRate": 100.0,
  "riskStatus": "unknown",
  "highestSeverity": "unknown",
  "confidence": 0.0
}
```

---

## Expected error cases

| Condition | HTTP status | How to trigger |
|---|---|---|
| Missing `plant_id` param | 422 | Omit `?plant_id=C061` from the URL |
| Missing `period_start` param | 422 | Omit `&period_start=2026-01-01` |
| Missing `period_end` param | 422 | Omit `&period_end=2026-05-17` |
| Session expired / no cookie | 401 | Clear session cookies and retry — Databricks Apps gateway rejects |
| Wrong `BACKEND_ADAPTER_MODE` | 503 | Deploy with `BACKEND_ADAPTER_MODE=legacy-api` or unset |
| Missing Databricks config | 503 | Remove `DATABRICKS_HOST` from `app.yaml` |
| UC permission denied | 403 | Remove UC SELECT on `connected_plant_uat.gold.*` for the user's identity |
| Rate limit | 429 | Trigger many rapid requests |
| SQL/query error | 502 | Introduce bad SQL or wrong view name |
| Timeout | 504 | Use a suspended warehouse; slow to start |

---

## Pass criteria (all must pass to record as browser-verified)

- [ ] HTTP 200 returned for a valid plant_id with data in the period
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Adapter-Mode: databricks-api` header present
- [ ] `X-Query-Name: envmon.get_site_summary` header present
- [ ] Body has all 12 `EnvMonSiteSummarySchema` keys
- [ ] `plantName` is `""` (empty string, not null, not a real name)
- [ ] `openCorrectiveActions` is `0`
- [ ] `overdueActions` is `0`
- [ ] `positiveRate` is a 0–100 number (not 0–1 fraction)
- [ ] `riskStatus` is one of `compliant`, `elevated`, `non-compliant`, `unknown`
- [ ] No OAuth token or credentials visible in response body or error messages
- [ ] Without valid cookie: 401 (not 200 with mock data)

---

## Result record (fill in when tested)

| Date | Tester | Plant | HTTP | X-Data-Source | X-Query-Name | Data returned | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| (pending) | — | — | — | — | — | — | — | Route wired (n.txt, 2026-05-17); DDL confirmed; BV pending |

**Do not mark any row above as verified without live UAT testing in Databricks Apps.**  
**Do not claim browser verification unless actually tested.**
