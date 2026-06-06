# Trace2 Adapter Migration Strategy

**Date:** 2026-05-18 (updated u.txt)
**Domain:** `di-traceability`
**Reference:** `docs/adapters/adapter-migration-strategy.md` (general lifecycle)

---

## Lifecycle Overview

```
mock
  → legacy-api (FastAPI proxy → V1 Trace2 backend)
  → databricks-api (direct Databricks SQL / Unity Catalog)
```

`Trace2LegacyApiAdapter` extends `Trace2Adapter` and overrides methods one at a time as endpoints are confirmed and browser-verified. The new `trace2_databricks_adapter.py` module provides QuerySpec factories; `Trace2LegacyApiAdapter` now overrides both `getBatchHeaderSummary` (via V1 proxy) and `getTraceGraph` (via native Databricks route). No separate `Trace2DatabricksApiAdapter` class is needed — FastAPI routes mediate the Databricks tier.

---

## Current State (2026-05-18)

| Method | V2 tier | V1 endpoint | Proxy route | Browser verified | Databricks QuerySpec |
|---|---|---|---|---|---|
| `getBatchHeaderSummary` | legacy-api | `POST /api/trace2/batch-header` | Yes | **Yes** (2024-03-08) | **Yes** — `get_batch_header_summary_spec` |
| `getTraceGraph` | databricks-api (✓ BV) | — | **Yes** — `POST /api/trace2/trace-graph` (q.txt, 2026-05-18) | **Yes** (2026-05-18) | **Yes** — `get_trace_graph_anchor_spec` + `get_trace_graph_hop_spec` (iterative multi-hop, gold_batch_lineage confirmed-ddl) |
| `getMassBalanceSummary` | mock | `GET /api/trace2/mass-balance` | No | No | **Yes** — `get_mass_balance_spec` |
| `getCustomerExposureSummary` | mock | — | No | No | **Deferred** — severity/recall business rules missing |
| `getSupplierExposureSummary` | mock | — | No | No | Not started |
| `getTraceTimeline` | mock | — | No | No | Not started |
| `getCoAReleaseStatus` | mock | — | No | No | Not started |
| `getRelatedInvestigations` | mock | — | No | No | Not started |
| `getTraceRiskSignals` | mock | — | No | No | Not started |
| `getInvestigationContext` | mock | — | No | No | Not started |
| `getTraceEvents` | mock | — | No | No | Not started |

---

## Databricks Slice Detail

### `getBatchHeaderSummary`

| Attribute | Value |
|---|---|
| QuerySpec name | `trace2.get_batch_header_summary` |
| Source views | `gold_batch_stock_v` + `gold_batch_summary_v` + `gold_material` + `gold_plant` |
| Cache policy | `PER_USER_60S` |
| Source badge | `view:gold_batch_summary_v` |
| Row mapper | `map_batch_header_rows` |
| Parallel validation | Possible — V1 response shape known from `Trace2LegacyApiAdapter` |
| Column verification needed | `gold_batch_summary_v` all columns (TODO-marked in SQL) |

Stock status priority (descending): `blocked > quality-inspection > returns > transit > unrestricted`

### `getTraceGraph`

| Attribute | Value |
|---|---|
| QuerySpec name | `trace2.get_trace_graph` |
| Source views | `gold_batch_lineage` |
| Cache policy | `PER_USER_60S` |
| Source badge | `view:gold_batch_lineage` |
| max_edges | 1000 (default) |
| Row mapper | `map_trace_graph(rows, anchor)` → `BackendTraceGraphResponse` |
| TS mapper | `mapBackendTraceGraph(raw)` in `trace2-graph-mapper.ts` |
| TypeScript override | `Trace2LegacyApiAdapter.getTraceGraph` — wired u.txt 2026-05-18; no mock/legacy fallback |
| Parallel validation | Not applicable — no V1 trace-graph endpoint exists |
| Depth | Iterative multi-hop up to `max_depth=6`; Python adapter expands hop-by-hop |

Node dedup key: `nodeKey = materialId:batchId:plantId`.
Edge dedup key: `id = source|target|linkType|docNum|hop`.

### `getMassBalanceSummary`

| Attribute | Value |
|---|---|
| QuerySpec name | `trace2.get_mass_balance` |
| Source view | `gold_batch_mass_balance_v` |
| Cache policy | `PER_USER_60S` |
| Source badge | `view:gold_batch_mass_balance_v` |
| Row mapper | `map_mass_balance_rows` |
| Parallel validation | Not possible — mock only |
| Key mapping | `balance_qty` → `runningBalance` (confirmed running-balance column; no window function needed) |

---

## What Can Remain Mock Temporarily

| Method | Reason acceptable at mock |
|---|---|
| `getInvestigationContext` | Context frame; investigators set the scope themselves |
| `getTraceRiskSignals` | Risk signals require risk-scoring model not in gold views |
| `getRelatedInvestigations` | Requires investigation database, not batch data |
| `getTraceTimeline` | Derived event stream; investigators have source records |
| `getCoAReleaseStatus` | Depends on QM decision table — not in traceability gold views |
| `getSupplierExposureSummary` | Upstream supplier lot mapping not confirmed in gold views |

---

## Route Wiring Prerequisites

The existing route at `POST /api/trace2/batch-header` proxies to V1. Switching to Databricks requires:

1. All `gold_batch_summary_v` column names confirmed against `connected_plant_uat` (`DESCRIBE TABLE`)
2. ADR-024 open question #1 (Statement API vs SQL Connector) resolved
3. ADR-024 open question #7 (cache backend: in-process LRU vs Redis/Lakebase) resolved
4. `NotImplementedDatabricksClient` replaced with real client

For `getTraceGraph` and `getMassBalanceSummary`, new routes must be created (not proxy overrides) once prerequisites above are met.

---

## Column Name Verification Required

| Adapter | View | TODO count | Verification method |
|---------|------|------------|---------------------|
| `trace2_databricks_adapter.py` | `gold_batch_summary_v` | 6 | `DESCRIBE TABLE connected_plant_uat.gold_batch_summary_v` |
| `trace2_databricks_adapter.py` | `gold_batch_mass_balance_v` (WHERE cols) | 2 | `DESCRIBE TABLE connected_plant_uat.gold_batch_mass_balance_v` |
| `trace2_databricks_adapter.py` | `gold_material` language_id filter | 2 | Confirm `language_id = 'EN'` is correct filter value |
| `trace2_databricks_adapter.py` | `gold_plant` join key | 2 | Confirm `plant_id` column name in both views |

Columns confirmed from `trace2-functional-parity-audit.md §3` (no TODO required):
`gold_batch_lineage`, `gold_batch_stock_v`, `gold_material.material_name`, `gold_plant.plant_name`,
`gold_batch_mass_balance_v` SELECT columns (`posting_date`, `movement_type`, `movement_category`, `abs_quantity`, `uom`, `balance_qty`).

---

## `getCustomerExposureSummary` — DEFERRED

**Blockers:**

1. `CustomerExposureSummarySchema.highestSeverity` (`z.enum(['none','low','medium','high','critical'])`) — no source column in `gold_batch_delivery_v`.
2. `recallRecommended: z.boolean()` — a business decision requiring domain rules (threshold: N customers, M countries, etc.).
3. `blockedDeliveries: z.number()` — delivery block flag not confirmed in the view.

**Unblocking:** Severity mapping rules and recall thresholds must be agreed with the domain owner before this slice can be implemented.
