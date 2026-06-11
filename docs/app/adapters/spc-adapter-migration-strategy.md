# SPC Adapter Migration Strategy

**Date:** 2026-05-16
**Domain:** `di-spc` / `spc-monitoring`
**Reference:** `docs/adapters/adapter-migration-strategy.md` (general lifecycle)

---

## Lifecycle Overview

```
mock
  → legacy-api (FastAPI proxy → V1 SPC backend)
  → databricks-api (direct Databricks SQL / Unity Catalog)
```

All SPC adapter methods currently return mock data. No FastAPI proxy routes exist for SPC. The lifecycle below defines the advancement path for each method.

---

## Current State (2026-05-16)

| Adapter method | V2 tier | V1 endpoint | Proxy route | Browser verified |
|---|---|---|---|---|
| `getSPCMonitoringContext` | mock | `GET /api/spc/context` | No | No |
| `getSPCSummary` | mock | `GET /api/spc/summary` | No | No |
| `getActiveSPCSignals` | mock | `GET /api/spc/signals` | No | No |
| `getMonitoredCharacteristics` | mock | `GET /api/spc/characteristics` | No | No |
| `getControlChartSeries` | mock | `GET /api/spc/chart` | No | No |
| `getCharacteristicCapability` | mock | `GET /api/spc/capability` | No | No |
| `getSPCAlarmHistory` | mock | `GET /api/spc/alarms` | No | No |
| `getSPCRelatedBatches` | mock | `GET /api/spc/batches` | No | No |

---

## What Can Remain Mock Temporarily

The following methods carry lower risk at mock tier during the pilot, because they either display summary/aggregate data or are not part of the daily operator workflow:

| Method | Reason acceptable at mock |
|---|---|
| `getSPCMonitoringContext` | Workspace context frame; operator knows their plant |
| `getSPCSummary` | KPI tiles are directional; operators will verify details in chart/alarm views |
| `getSPCAlarmHistory` | Historical — useful for reference but not action-critical during pilot |
| `getSPCRelatedBatches` | Batch release impact is visible in the batch release workspace; SPC view is supplementary |

---

## What Must Use V1/Legacy API to Prove Parity

The following methods must be wired to the V1 API to be credible. They are the core of the SPC monitoring workflow:

| Method | Why V1 is required | V1 endpoint |
|---|---|---|
| `getMonitoredCharacteristics` | Must reflect the plant's actual configured MICs; hardcoded/mock list is not parity | `GET /api/spc/characteristics` |
| `getControlChartSeries` | Control chart is the primary SPC output; mock fixed values mislead operators | `GET /api/spc/chart` |
| `getActiveSPCSignals` | Active signals drive operator action; mock pH/Moisture signals are not real plant state | `GET /api/spc/signals` |
| `getSPCSummary` | chartsMonitored and activeSignals counts must reflect real plant state for any practical use | `GET /api/spc/summary` |

---

## What Should Eventually Be Native Databricks API

When V1 SPC backend is retired, the following gold views / semantic entities are likely required:

| Adapter method | Likely Databricks source | Notes |
|---|---|---|
| `getMonitoredCharacteristics` | `gold_batch_quality_result_v` — distinct MIC × plant × work-centre combinations | chartType heuristic from subgroup count |
| `getControlChartSeries` | `spc_quality_metric_subgroup_v` + `spc_locked_limits` | Subgroup data + limit override |
| `getActiveSPCSignals` | `spc_quality_metrics` WHERE status = 'active' | Rule application runs in SPC engine |
| `getSPCSummary` | `spc_quality_metrics` (aggregate) | COUNT, MAX(severity) |
| `getCharacteristicCapability` | `gold_batch_quality_result_v` + `spc_quality_metrics` | Cp/Cpk computed from subgroup data |
| `getSPCAlarmHistory` | `spc_quality_metrics` (history window) | With date range filter |
| `getSPCRelatedBatches` | `gold_batch_quality_result_v` + batch window from signal timestamps | Cross-reference batch production window |

### Gold views required

| View | Confirmed in V1 | Description |
|---|---|---|
| `spc_quality_metrics` | Yes | Primary SPC signal + alarm table |
| `spc_quality_metric_subgroup_v` | Yes | Sample-level subgroup data for chart series |
| `spc_locked_limits` | Yes | Locked/frozen control limit overrides |
| `gold_batch_quality_result_v` | Yes (shared with trace domain) | MIC results per batch — used for MIC discovery and capability |
| `spc_msa_results_v` | Likely | MSA gauge R&R (required for MSA tab backlog item) |

---

## Required Tests Before Advancing to Legacy-API

Each method must satisfy the following before a FastAPI proxy route is added:

1. **V1 endpoint confirmed** — URL, HTTP method, request and response field names verified from V1 source code (not documentation alone).
2. **Proxy route created** — `apps/api/routes/spc.py` route handling `GET /api/spc/<method>`.
3. **Browser-verified** — End-to-end call from V2 SPC workspace to V1 backend confirmed in browser for at least one plant/characteristic combination.
4. **Contract tests written** in `spc-legacy-api-adapter.test.ts`:
   - Success case with representative data
   - 401 Unauthorized
   - 404 Not Found (characteristic or plant not found)
   - 500 Internal Server Error
   - Network failure / timeout
   - Fallback to mock when `plantId` is missing from request

**Do not advance to legacy-api based on field name assumptions from the original source code.** The V1 API may have been modified since the original SPC app was written.

---

## Required Tests Before Advancing to Databricks-API

1. **V1 backend retired or scheduled** — confirmed with source system team.
2. **Data in Unity Catalog** — the equivalent `spc_quality_metrics` / `spc_quality_metric_subgroup_v` data is queryable.
3. **Schema validated** — Databricks response maps to existing `@connectio/data-contracts` Zod schemas without field renames.
4. **Pilot sign-off** — `spc-monitoring` workspace has completed pilot with legacy-api tier and received sign-off.
5. **Contract tests updated** — `spc-databricks-api-adapter.test.ts` covers the same cases as the legacy adapter tests.

---

## Advance Order Recommendation

Priority order for V1 wiring:

1. `getActiveSPCSignals` — highest daily-use visibility; simplest response shape
2. `getMonitoredCharacteristics` — unlocks correct plant-specific characteristic list
3. `getControlChartSeries` — most complex mapping; start with `individuals` chart type
4. `getSPCSummary` — aggregate; straightforward after signals are wired
5. `getSPCAlarmHistory` — historical; lower urgency
6. `getCharacteristicCapability` — requires capability calculation mapping
7. `getSPCRelatedBatches` — batch context; depends on signals being accurate

---

## FastAPI Proxy Routes Not Yet Created

These routes must be created before any legacy-api advancement:

```python
# apps/api/routes/spc.py (file does not yet exist)
GET /api/spc/context
GET /api/spc/summary
GET /api/spc/signals
GET /api/spc/characteristics
GET /api/spc/chart
GET /api/spc/capability
GET /api/spc/alarms
GET /api/spc/batches
```

Do not create these routes until the V1 endpoint shapes are confirmed from source code inspection.
