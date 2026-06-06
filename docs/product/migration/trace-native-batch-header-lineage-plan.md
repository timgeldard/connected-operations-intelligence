# Trace Native — Batch Header and Direct Lineage Plan

**Date:** 2026-05-17  
**Status:** Planning only — implementation blocked pending DDL verification.  
**Tranche:** f.txt — Native Trace Batch Header and Direct Lineage Preparation  
**Principle:** DDL first. Do not implement until column names are confirmed against live Databricks views.

---

## Baseline Summary

### What is proven

- V2 is deployed to Databricks Apps UAT with `BACKEND_ADAPTER_MODE=databricks-api`.
- End-user OAuth (`x-forwarded-access-token`) is forwarded and accepted by the Statement API.
- `user_api_scopes: [sql]` is configured in `databricks.yml`.
- Native read path is proven end-to-end for POH and CQ Lab plants.
- POH order header, operations, confirmations (executable), goods movements (executable) all use the QuerySpec/QueryExecutor pattern.
- No SPN/PAT fallback exists or will be added.

### Current Trace tier

| Method | Current tier | Databricks adapter | Route wired | Browser verified |
|---|---|---|---|---|
| `getBatchHeaderSummary` | legacy-api | `get_batch_header_summary_spec` exists | V1 proxy only — not Databricks | Yes (V1 via legacy-api) |
| `getTraceGraph` | mock | `get_trace_graph_spec` exists | Not wired | No |
| `getMassBalanceSummary` | mock | `get_mass_balance_spec` exists | Not wired | No |
| `getCustomerExposureSummary` | mock | Not implemented — deferred | Not wired | No |
| All others (9 methods) | mock | Not implemented | Not wired | No |

### Why QuerySpec factories exist but routes are not wired

The `trace2_databricks_adapter.py` was written as a planning exercise with confirmed column names where available and `TODO` markers where column names were not verified against live DDL. Per project rules, routes are not wired until column names are confirmed.

---

## DDL Verification Status

### gold_batch_stock_v — CONFIRMED

All columns used in `get_batch_header_summary_spec` are confirmed:

| Column | Maps to | Status |
|---|---|---|
| `material_id` | `materialId` | confirmed |
| `batch_id` | `batchId` | confirmed |
| `unrestricted` | stock quantity | confirmed |
| `blocked` | stock quantity | confirmed |
| `quality_inspection` | stock quantity | confirmed |
| `restricted` | stock quantity | confirmed |
| `transit` | stock quantity | confirmed |
| `total_stock` | `quantity` | confirmed |

### gold_batch_lineage — CONFIRMED

All columns used in `get_trace_graph_spec` are confirmed:

| Column | Maps to | Status |
|---|---|---|
| `parent_material_id` | node.materialId (parent) | confirmed |
| `parent_batch_id` | node.batchId (parent) | confirmed |
| `parent_plant_id` | node.plantId (parent) | confirmed |
| `child_material_id` | node.materialId (child) | confirmed |
| `child_batch_id` | node.batchId (child) | confirmed |
| `child_plant_id` | node.plantId (child) | confirmed |
| `link_type` | edge.relationshipType | confirmed |

### gold_batch_summary_v — NOT CONFIRMED (6 TODOs)

| Column | Maps to | Status |
|---|---|---|
| `plant_id` | `plantId` | **TODO — run DESCRIBE TABLE** |
| `manufacture_date` | `manufactureDate` | **TODO — run DESCRIBE TABLE** |
| `expiry_date` | `expiryDate` | **TODO — run DESCRIBE TABLE** |
| `batch_status` | `batchStatus` | **TODO — run DESCRIBE TABLE** |
| `uom` | `uom` | **TODO — run DESCRIBE TABLE** |
| `process_order_id` | `processOrderId` | **TODO — run DESCRIBE TABLE** |

**Impact:** `getBatchHeaderSummary` native route cannot be wired until all 6 TODO columns are confirmed.

### gold_material — PARTIALLY CONFIRMED

| Column | Maps to | Status |
|---|---|---|
| `material_id` | join key | confirmed |
| `material_name` | `materialDescription` | confirmed |
| `language_id` | filter | **TODO — verify column exists and value `'EN'` is correct** |

**Impact:** `gold_material` JOIN in both `getBatchHeaderSummary` and `getTraceGraph` uses `language_id = 'EN'` filter. If this column does not exist or the value is wrong, the query will fail or return duplicates. Both routes blocked until confirmed.

### gold_plant — PARTIALLY CONFIRMED

| Column | Maps to | Status |
|---|---|---|
| `plant_id` | join key | assumed to match `gold_batch_summary_v.plant_id` |
| `plant_name` | `plantName` | confirmed |

**Impact:** Plant join is a LEFT JOIN — core functionality works without plant names. If `gold_plant.plant_id` column name differs from assumption, plant names return null (not a hard blocker for lineage).

### gold_batch_mass_balance_v — SELECT COLUMNS CONFIRMED; WHERE BLOCKED

| Column | Used in | Status |
|---|---|---|
| `posting_date` | SELECT | confirmed |
| `movement_type` | SELECT | confirmed |
| `movement_category` | SELECT | confirmed |
| `abs_quantity` | SELECT | confirmed |
| `uom` | SELECT | confirmed |
| `balance_qty` | SELECT (running balance) | confirmed |
| `material_id` | WHERE filter | **TODO — run DESCRIBE TABLE** |
| `batch_id` | WHERE filter | **TODO — run DESCRIBE TABLE** |

**Impact:** If WHERE filter column names are wrong, the query returns all rows in the view (no filter). This would return all mass balance movements, not just for the requested batch. **Blocking — must confirm before wiring.**

---

## Candidate Decision Matrix

### A. getBatchHeaderSummary

| Field | Value |
|---|---|
| User value | High — primary Trace entry point; shows batch status, stock, dates |
| Existing V2 method | `Trace2LegacyApiAdapter.getBatchHeaderSummary` — wired to V1 |
| Existing contract | `BatchHeaderSummarySchema` (packages/data-contracts) |
| Target source view | `gold_batch_summary_v` (+ `gold_batch_stock_v` + `gold_material` + `gold_plant`) |
| Required confirmed fields | plant_id, manufacture_date, expiry_date, batch_status, uom, process_order_id |
| Confirmed fields | All stock fields, material_name |
| Missing/unverified | 6 `gold_batch_summary_v` columns; `gold_material.language_id` filter |
| Mapping risk | Medium — column names may differ (snake_case vs camelCase or abbreviations) |
| **Decision** | **DEFERRED** — blocked on DDL verification for `gold_batch_summary_v` |

### B. getTraceGraph (depth=1 direct lineage)

| Field | Value |
|---|---|
| User value | High — core Trace UI; shows direct inputs/outputs |
| Existing V2 method | `Trace2Adapter.getTraceGraph` — mock only |
| Existing contract | `TraceGraphSchema` (packages/data-contracts) |
| Target source view | `gold_batch_lineage` + enrichment from `gold_material` + `gold_plant` |
| Core lineage columns | All confirmed (parent/child material, batch, plant IDs; link_type) |
| Enrichment columns | `gold_material.language_id` filter unverified |
| Mapping risk | Low for lineage structure; medium for enrichment (duplicate rows if language join wrong) |
| **Decision** | **DEFERRED** — blocked on `gold_material.language_id` confirmation; language_id filter could cause query failure or result explosion |

### C. getMassBalanceSummary

| Field | Value |
|---|---|
| User value | Medium — mass balance audit; secondary to batch header and lineage |
| Existing V2 method | `Trace2Adapter.getMassBalanceSummary` — mock only |
| Existing contract | `MassBalanceSummarySchema` (packages/data-contracts) |
| Target source view | `gold_batch_mass_balance_v` |
| Required confirmed fields | WHERE clause filter column names |
| Confirmed fields | All SELECT columns |
| Missing/unverified | WHERE filter columns (`material_id`, `batch_id` — assumed names, not confirmed) |
| Mapping risk | High — unfiltered query returns all movements, not per-batch |
| **Decision** | **DEFERRED** — blocked on WHERE column verification |

### D. getCustomerExposureSummary

| Field | Value |
|---|---|
| User value | High for recall/quality decisions |
| Existing V2 method | mock only |
| Missing | severity/recall classification business rules; source view column semantics |
| **Decision** | **DEFERRED** — requires domain-owner input on severity thresholds and recall criteria |

---

## Implementation Order (post-DDL)

1. Verify `gold_batch_summary_v`, `gold_material.language_id`, `gold_batch_mass_balance_v` WHERE columns — see `docs/audit/trace-native-column-verification-checklist.md`
2. Update `get_batch_header_summary_spec` with confirmed column names
3. Wire `POST /api/trace2/batch-header` to Databricks (dual-mode: V1 proxy fallback, databricks-api native)
4. Browser-verify `POST /api/trace2/batch-header` with anchor: `material_id=000000000020052009, batch_id=0008602411`
5. After batch header verified: update `get_trace_graph_spec` with confirmed join conditions
6. Wire `POST /api/trace2/trace-graph` (depth=1 only)
7. Browser-verify `POST /api/trace2/trace-graph`
8. After lineage verified: update `get_mass_balance_spec` WHERE columns
9. Wire `POST /api/trace2/mass-balance`

---

## Architecture Compliance

- QuerySpec/QueryExecutor pattern is already used — adapter follows exact POH pattern.
- No SQL in React. No SQL in routes.
- No SPN/PAT fallback.
- No recursive traversal (depth=1 only for lineage).
- `resolve_domain_object()` is used in all three specs — UC object qualification is safe.
- `TRACE_CATALOG` env var controls catalog; `TRACE_SCHEMA` defaults to "gold".
- No new workspaces. No app shell redesign.

---

## Stop Conditions Met

Implementation is stopped and documented because:
- `gold_batch_summary_v` column names are unverified (6 TODOs)
- `gold_material.language_id` filter value is unverified (could cause query failure or row explosion)
- `gold_batch_mass_balance_v` WHERE column names are unverified (unfiltered query risk)
- No recursive traversal will be implemented

See `docs/audit/trace-native-column-verification-checklist.md` for DDL queries to run manually.
