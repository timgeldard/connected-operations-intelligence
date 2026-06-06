# Architecture Check — Trace Investigation Databricks Vertical Slices

**Date:** 2026-05-16
**Scope:** `apps/api/adapters/trace2/`, `apps/api/tests/adapters/trace2/`
**Reference:** ADR-024, `docs/migration/databricks-vertical-slices-trace-plan.md`

---

## What Was Built

| Artefact | Path | Purpose |
|----------|------|---------|
| Trace2 adapter module | `apps/api/adapters/trace2/trace2_databricks_adapter.py` | QuerySpec factories + row mapping for 3 slices |
| Slice 1 | `get_batch_header_summary_spec` + `map_batch_header_rows` | Batch header: stock status, dates, material/plant names |
| Slice 2 | `get_trace_graph_spec` + `map_trace_graph_rows` | Lineage graph: nodes/edges at depth=1 |
| Slice 3 | `get_mass_balance_spec` + `map_mass_balance_rows` | Mass balance: totals + per-movement running balance |
| Tests | `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py` | 82 tests; 158 total passing |
| Plan doc | `docs/migration/databricks-vertical-slices-trace-plan.md` | Per-slice decisions, column sources, risk assessment |
| Migration strategy | `docs/adapters/trace2-adapter-migration-strategy.md` | Adapter lifecycle, verification prerequisites, deferral reasons |

---

## ADR-024 Alignment Check

| ADR-024 requirement | Status |
|--------------------|--------|
| User OAuth token required for all Databricks reads | ✓ — `QueryExecutor.execute()` calls `identity.require_user_oauth()` before any client call; inherited from shared infrastructure (tested in `test_query_service.py`) |
| No service-principal fallback | ✓ — `DatabricksAuthRequiredError` is the only error path; no fallback logic in adapter layer |
| QuerySpec protocol | ✓ — all three QuerySpec factories conform: name, module, endpoint, sql, params, cache_policy, source_badge, max_rows, tags |
| Three-tier cache | ✓ — all trace2 slices use `PER_USER_60S`; batch data changes during a shift |
| MV-first query strategy | ✓ — all slices target gold views (`gold_batch_stock_v`, `gold_batch_lineage`, `gold_batch_mass_balance_v`); no raw table reads |
| Source badge contract | ✓ — source badges are view-specific (`"view:gold_batch_summary_v"`, `"view:gold_batch_lineage"`, `"view:gold_batch_mass_balance_v"`) rather than generic `"databricks-api"` |
| Module migration order respected | ✓ — Trace2 is ADR-024 priority #2; `getBatchHeaderSummary` has a browser-verified legacy-api path for parallel validation |
| `catalog_override` for wh360 separation | ✓ — not used for trace2; wh360 deferred as last module per ADR-024 |

---

## Security Invariants (CLAUDE.md Rules)

| Rule | Verification |
|------|-------------|
| Production Databricks reads use authenticated user's OAuth | `QueryExecutor` calls `require_user_oauth()` before client; inherited and tested in `test_query_service.py` |
| No service-principal fallback paths | `DatabricksAuthRequiredError` propagates to caller; no except/fallback in adapter layer |
| If OAuth unavailable, mark as blocked | `QueryExecutor` propagates error; route handler (future) must return HTTP 401 |
| No SQL in TypeScript | No TypeScript changes in this tranche |
| No SQL directly in FastAPI route handlers | SQL is encapsulated in QuerySpec; route handlers will call `QueryExecutor.execute()` |

---

## Key Design Decisions

### source_badge format

Trace2 slices use `"view:<view_name>"` rather than the generic `"databricks-api"` used in POH/CQ slices. This is intentional — the plan doc specifies view-qualified badges so downstream UI can display which gold view is the authoritative source. Both formats are valid `source_badge` strings; the distinction is informational.

### Row mapping functions

Unlike the POH/CQ i.txt tranche (which deferred row mapping), j.txt explicitly requires `map_*_rows` functions alongside QuerySpec factories. This enables unit testing of the mapping logic before routes are wired, and validates the contract shape against the Zod schema fields.

### Depth=1 trace graph

Full recursive traversal is deferred. The depth=1 flat SELECT (`parent_batch_id = :batch_id OR child_batch_id = :batch_id`) is cycle-safe by construction — no traversal means cycles cannot produce infinite loops. The deduplication key `(material_id, batch_id)` handles the case where a batch appears as both parent and child.

### `balance_qty` → `runningBalance`

`gold_batch_mass_balance_v.balance_qty` is confirmed from V1 source inspection as the per-row running balance. This maps directly to the required `MassBalanceMovement.runningBalance: z.number()` field — no window function is needed.

### Node default type = "intermediate"

`gold_batch_lineage` has no material-type column. All nodes default to `"intermediate"` until a material-type join is confirmed. Full node classification deferred until `gold_material` material-type column is identified.

---

## What Is Deferred and Why

### Route wiring (FastAPI → QueryExecutor)

Existing routes proxy to V1. Databricks route wiring requires:
1. ADR-024 open question #1 (Statement API vs SQL Connector) resolved — gates `NotImplementedDatabricksClient` replacement
2. ADR-024 open question #7 (cache backend) resolved — gates cache layer
3. All `gold_batch_summary_v` column names confirmed via `DESCRIBE TABLE`

### TypeScript `Trace2DatabricksApiAdapter`

No TypeScript changes. Without route wiring, a TypeScript adapter has no Databricks endpoint to call — adding one would produce 404/502 errors if accidentally invoked in `legacy-api` mode.

### Recursive trace graph (depth > 1)

Deferred until: (a) depth=1 is validated against live data, and (b) the performance profile of recursive CTE queries against `gold_batch_lineage` is understood. The `max_rows=500` guard on the depth=1 spec remains in place.

### `getCustomerExposureSummary`

Deferred. `CustomerExposureSummarySchema` requires `highestSeverity`, `recallRecommended`, and `blockedDeliveries` — none derivable from `gold_batch_delivery_v` without domain-owner business rules. See `docs/migration/databricks-vertical-slices-trace-plan.md §4`.

---

## Column Name Verification — Required Before Route Wiring

| Adapter | View | TODO count | Verification method |
|---------|------|------------|---------------------|
| `trace2_databricks_adapter.py` | `gold_batch_summary_v` | 6 | `DESCRIBE TABLE connected_plant_uat.gold_batch_summary_v` |
| `trace2_databricks_adapter.py` | `gold_batch_mass_balance_v` (WHERE cols) | 2 | `DESCRIBE TABLE connected_plant_uat.gold_batch_mass_balance_v` |
| `trace2_databricks_adapter.py` | `gold_material` language_id | 2 | Confirm filter value `'EN'` correct |
| `trace2_databricks_adapter.py` | `gold_plant` join key | 2 | Confirm `plant_id` column name |

Columns NOT requiring verification (confirmed from `trace2-functional-parity-audit.md §3`):
- `gold_batch_lineage`: all 7 confirmed columns used without TODO
- `gold_batch_stock_v`: all 8 confirmed columns used without TODO
- `gold_batch_mass_balance_v` SELECT: `posting_date`, `movement_type`, `movement_category`, `abs_quantity`, `uom`, `balance_qty` — all confirmed

---

## Test Coverage

158 tests total, 158 passing.

New tests added (82):
- `tests/adapters/trace2/test_trace2_databricks_adapter.py`:
  - `TestGetBatchHeaderSummarySpec` — 12 tests: QuerySpec fields, SQL content, mutable default guard
  - `TestMapBatchHeaderRows` — 17 tests: full row, leading zeros, optional field handling, stock status priority (5 cases), quality status (2 cases), batch status mapping (4 cases including numeric)
  - `TestGetTraceGraphSpec` — 11 tests: QuerySpec fields, max_rows=500, SQL content
  - `TestMapTraceGraphRows` — 15 tests: basic mapping, dedup, empty state, link type mapping (all 8 types), upstream/downstream counts, cycle safety, node defaults
  - `TestGetMassBalanceSpec` — 10 tests: QuerySpec fields, ORDER BY, SQL content
  - `TestMapMassBalanceRows` — 17 tests: totals computation, balance_qty mapping, delta sign, UOM, unresolved count, null handling, movement category mapping (5 cases)

Key invariants tested:
- Leading zeros in material_id are preserved through the mapping layer
- Stock status priority order: blocked > quality-inspection > returns > transit > unrestricted
- `balance_qty` maps directly to `runningBalance` (no computation)
- Null `balance_qty` increments `unresolvedMovements` and defaults `runningBalance` to 0.0
- Cycle-like lineage input (A→B and B→A) produces 2 nodes, 2 edges, no error
- Unknown link_type and movement_category both have safe fallbacks

---

## Next Steps

In priority order:

1. **Resolve ADR-024 open question #1** — Statement API vs SQL Connector
2. **Resolve ADR-024 open question #7** — cache backend
3. **Verify `gold_batch_summary_v` column names** — run `DESCRIBE TABLE` and remove TODO comments
4. **Verify `gold_batch_mass_balance_v` WHERE column names** — confirm `material_id` and `batch_id` filter columns
5. **Implement real Databricks client** to replace `NotImplementedDatabricksClient`
6. **Wire `POST /api/trace2/batch-header`** to call `QueryExecutor` with user OAuth (parallel validation against browser-verified V1 response possible)
7. **Create routes for `getTraceGraph` and `getMassBalanceSummary`** once client is live
8. **Add TypeScript `Trace2DatabricksApiAdapter`** once routes are live
9. **Validate depth=1 trace graph** against live `gold_batch_lineage` data before implementing recursive traversal
