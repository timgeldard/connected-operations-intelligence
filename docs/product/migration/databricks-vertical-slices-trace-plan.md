# Databricks Vertical Slices — Trace Investigation: Implementation Plan

**Date:** 2026-05-16  
**Scope:** Native Databricks data-access slices for Trace Investigation using the ADR-024 QuerySpec/QueryExecutor pattern  
**Reference:** ADR-024, `docs/migration/trace2-functional-parity-audit.md`, `docs/migration/trace2-functional-parity-matrix.md`

---

## Gold View Confirmation

Gold views and column names below are confirmed from the V1 Trace2 source (`trace2-functional-parity-audit.md` §3):

| View | Confirmed columns | Used by |
|------|------------------|---------|
| `gold_batch_lineage` | `parent_material_id`, `parent_batch_id`, `parent_plant_id`, `child_material_id`, `child_batch_id`, `child_plant_id`, `link_type` | trace tree, bottom-up, top-down |
| `gold_material` | `material_id`, `material_name`, `language_id` | trace tree, bottom-up, top-down |
| `gold_plant` | `plant_id`, `plant_name` | all pages |
| `gold_batch_summary_v` | manufacture/expiry dates, shelf-life status (column names TODO) | batch header, recall |
| `gold_batch_stock_v` | `material_id`, `batch_id`, `unrestricted`, `blocked`, `quality_inspection`, `restricted`, `transit`, `total_stock` | summary, recall |
| `gold_batch_mass_balance_v` | `posting_date`, `movement_type`, `movement_category`, `abs_quantity`, `uom`, `balance_qty` | mass balance |
| `gold_batch_delivery_v` | `delivery`, `customer_id`, `customer_name`, `country_id`, `city`, `abs_quantity` | recall, impact |

Note: Column names above are from V1 source inspection. V2 Databricks catalog may use lower-case or minor naming variants — every column reference in the QuerySpec SQL is marked with a TODO comment until confirmed via `DESCRIBE TABLE`.

---

## Summary Decision Table

| Slice | Method | Source views | Decision |
|-------|--------|-------------|---------|
| Trace batch header | `getBatchHeaderSummary` | `gold_batch_stock_v` + `gold_batch_summary_v` + `gold_plant` + `gold_material` | **Implement** |
| Trace graph (depth=1) | `getTraceGraph` | `gold_batch_lineage` + `gold_material` + `gold_plant` | **Implement** |
| Mass balance | `getMassBalanceSummary` | `gold_batch_mass_balance_v` | **Implement** |
| Customer exposure | `getCustomerExposureSummary` | `gold_batch_delivery_v` | **Defer** — mapping complexity |

---

## Slice 1 — `getBatchHeaderSummary`

**Slice name:** `trace2.get_batch_header_summary`

**User value:** Investigators see live batch status, stock breakdown, and manufacturing dates from Databricks instead of mock data. This is the highest-value slice because `getBatchHeaderSummary` is already browser-verified via the legacy-api path — parallel validation is possible.

**Existing V2 panel/adapter method:** `getBatchHeaderSummary` in `Trace2Adapter` (mock) and `Trace2LegacyApiAdapter` (browser-verified at `POST /api/trace2/batch-header`)

**Existing V2 contract:** `BatchHeaderSummarySchema` in `packages/data-contracts/src/schemas/trace-investigation.ts`
- Required: `materialId`, `materialDescription`, `batchId`, `plantId`, `plantName`, `batchStatus`, `stockStatus`, `qualityStatus`, `releaseStatus`
- Optional: `quantity`, `uom`, `manufactureDate`, `expiryDate`, `processOrderId`

**Existing mock data source:** `domain-integrations/traceability/src/adapters/trace2-mock-data.ts`

**Existing legacy-api status:** Browser-verified at `POST /api/trace2/batch-header` against live V1 Trace2 (2024-03-08). The V1 response shape is known from `Trace2LegacyApiAdapter`.

**Proposed Databricks source:**
- Primary: `gold_batch_stock_v` (stock quantities, batch ID, material ID)
- Supplement: `gold_batch_summary_v` (manufacture date, expiry date, batch status)
- Dimension joins: `gold_material` (material description), `gold_plant` (plant name)

**Required input parameters:**
- `material_id: str` — SAP material number (preserve leading zeros)
- `batch_id: str` — SAP batch/lot number (preserve leading zeros)

**Required output fields (maps to BatchHeaderSummarySchema):**
- `materialId` ← `material_id` (leading zeros preserved)
- `materialDescription` ← `material_name` from `gold_material`
- `batchId` ← `batch_id`
- `plantId` ← `plant_id`
- `plantName` ← `plant_name` from `gold_plant`
- `batchStatus` ← derived from `gold_batch_summary_v` status column
- `quantity` ← `total_stock` from `gold_batch_stock_v`
- `uom` ← from `gold_batch_summary_v`
- `manufactureDate` ← from `gold_batch_summary_v` (ISO datetime)
- `expiryDate` ← from `gold_batch_summary_v` (ISO datetime)
- `processOrderId` ← from `gold_batch_summary_v` (optional)
- `stockStatus` ← derived from stock columns (unrestricted/blocked/quality_inspection/restricted/transit priority logic)
- `qualityStatus` ← derived from stock columns
- `releaseStatus` ← derived from stock columns

**User OAuth requirement:** Yes

**Cache policy:** `PER_USER_60S` — batch status can change during a shift (release, block).

**Source badge:** `view:gold_batch_summary_v` (primary view)

**Query tags:** `["trace2", "batch-header", "summary"]`

**Test strategy:**
- Unit test QuerySpec: confirm name, module, endpoint, cache_policy, tags
- Unit test `map_batch_header_rows`: representative row with all fields → verify contract shape
- Leading zeros preserved: `material_id="0000020582002"` → `materialId="0000020582002"`
- Missing optional fields (no expiry_date) → `expiryDate` absent
- Stock status priority: blocked > quality_inspection > restricted > transit > unrestricted
- Batch status mapping: numeric/string raw values → enum

**Risk:** Low — column names partially confirmed (stock view). Parallel validation possible against browser-verified V1 response.

**Decision: IMPLEMENT**

---

## Slice 2 — `getTraceGraph` (depth=1 first pass)

**Slice name:** `trace2.get_trace_graph`

**User value:** Investigators see live batch lineage graph from Databricks. The trace graph is the core differentiator of the Trace Investigation workspace. Even a depth=1 pass showing direct parents/children is valuable for pilot validation.

**Existing V2 panel/adapter method:** `getTraceGraph` in `Trace2Adapter` (mock only; no legacy-api override)

**Existing V2 contract:** `TraceGraphSchema` — requires `nodes`, `edges`, `direction`, `depth`, `rootBatch`, `upstreamCount`, `downstreamCount`, `unresolvedNodeCount`

**Existing mock data source:** `domain-integrations/traceability/src/adapters/trace2-mock-data.ts`

**Existing legacy-api status:** No legacy-api override. Mock only.

**Proposed Databricks source:** `gold_batch_lineage` + `gold_material` (descriptions) + `gold_plant` (names)

**Confirmed columns:** `parent_material_id`, `parent_batch_id`, `parent_plant_id`, `child_material_id`, `child_batch_id`, `child_plant_id`, `link_type`

**Required input parameters:**
- `material_id: str`
- `batch_id: str`

**Required output fields (TraceGraphSchema):**
- Nodes: `id`, `type`, `materialId`, `materialDescription`, `batchId`, `plantId` (per `TraceNodeSchema`)
- Edges: `id`, `source`, `target`, `relationshipType` (per `TraceEdgeSchema`)
- Graph meta: `direction="both"`, `depth=1`, `rootBatch`, `upstreamCount`, `downstreamCount`, `unresolvedNodeCount=0`

**LINK_TYPE mapping:**

| V1 LINK_TYPE | TraceEdge.relationshipType |
|---|---|
| `PRODUCTION` | `produced-from` |
| `BATCH_TRANSFER` | `transferred-to` |
| `STO_TRANSFER` | `transferred-to` |
| `VENDOR_RECEIPT` | `component-of` |
| `CONSUMPTION` | `component-of` |
| `DELIVERY` | `delivered-to` |
| `SPLIT` | `split-from` |
| `MERGE` | `merged-into` |
| (unknown) | `component-of` |

**Deduplication rules:**
- Nodes: keyed by `(material_id, batch_id)` — same batch appearing as parent in one row and child in another must not produce duplicate nodes
- Edges: keyed by `(source_batch_id, target_batch_id, relationship_type)` — same pair with same type from multiple rows is one edge

**Recursion scope:** Depth=1 only — returns all rows where `parent_batch_id = :batch_id OR child_batch_id = :batch_id`. Full recursive traversal deferred.

**Cycle safety:** No traversal at depth=1 — cycles cannot occur in a flat select. The deduplication key prevents duplicate nodes if a batch appears as both parent and child.

**Empty state:** If no rows returned, return `{ nodes: [], edges: [], direction: "both", depth: 1, rootBatch: batch_id, upstreamCount: 0, downstreamCount: 0, unresolvedNodeCount: 0 }`.

**Node type default:** `"intermediate"` — `gold_batch_lineage` does not confirm a material type column. Full node type classification deferred until `gold_material` material-type column is confirmed.

**User OAuth requirement:** Yes

**Cache policy:** `PER_USER_60S`

**Source badge:** `view:gold_batch_lineage`

**Query tags:** `["trace2", "trace-graph", "lineage"]`

**Test strategy:**
- QuerySpec: name, module, endpoint, tags, max_rows=500
- `map_trace_graph_rows` with known lineage rows → verify nodes and edges
- Duplicate parent/child rows → deduplicated
- Cycle-like input (row A→B and row B→A) → two edges, two nodes, no crash
- Empty rows → empty graph state
- Unknown link_type → `"component-of"` (safe fallback)
- Root batch appears in both parent and child rows → counted in both up/downstream

**Risk:** Low-Medium — gold view confirmed, column names partially verified. No legacy-api baseline available for parallel validation (only mock exists).

**Decision: IMPLEMENT** (depth=1 first pass)

---

## Slice 3 — `getMassBalanceSummary`

**Slice name:** `trace2.get_mass_balance`

**User value:** Mass balance panel shows live input/output/variance from Databricks with per-day movement history. Currently mock-only.

**Existing V2 panel/adapter method:** `getMassBalanceSummary` in `Trace2Adapter` (mock only)

**Existing V2 contract:** `MassBalanceSummarySchema` + `MassBalanceMovementSchema`
- `MassBalanceMovement.runningBalance: z.number()` is **REQUIRED**

**Proposed Databricks source:** `gold_batch_mass_balance_v`

**Confirmed columns:** `posting_date`, `movement_type`, `movement_category`, `abs_quantity`, `uom`, `balance_qty`

Note: `balance_qty` is the running balance per row — directly maps to the required `runningBalance` field. No window function needed.

**Required input parameters:**
- `material_id: str`
- `batch_id: str`

**MOVEMENT_CATEGORY mapping:**

| V1 MOVEMENT_CATEGORY | MassBalanceMovement.category |
|---|---|
| `PRODUCTION` | `production` |
| `SHIPMENT` | `shipment` |
| `CONSUMPTION` | `consumption` |
| `ADJUSTMENT` | `adjustment` |
| (unknown) | `adjustment` |

**Totals computation:**
- `inputQuantity` = sum of `abs_quantity` where category is `production`
- `outputQuantity` = sum of `abs_quantity` where category is `shipment` or `consumption`
- `varianceQuantity` = inputQuantity − outputQuantity
- `variancePercent` = (varianceQuantity / inputQuantity × 100) if inputQuantity > 0 else 0.0
- `uom` = from first row (all rows assumed same UOM for one batch)
- `confidence` = 1.0 (data from gold view assumed complete)
- `unresolvedMovements` = count of rows with null `balance_qty`

**User OAuth requirement:** Yes

**Cache policy:** `PER_USER_60S`

**Source badge:** `view:gold_batch_mass_balance_v`

**Query tags:** `["trace2", "mass-balance"]`

**Test strategy:**
- QuerySpec: name, endpoint, max_rows ordered by posting_date
- `map_mass_balance_rows` with sample rows → totals, movements array
- Empty rows → empty movements, zero totals
- `balance_qty` maps directly to `runningBalance`
- `abs_quantity` maps to `quantity`; delta = signed version
- UOM from first row

**Risk:** Low — all column names confirmed. No legacy-api baseline (mock only), but parity is straightforward.

**Decision: IMPLEMENT**

---

## Slice 4 — `getCustomerExposureSummary` (DEFERRED)

**Slice name:** `trace2.get_customer_exposure`

**User value:** Investigators see live customer delivery exposure.

**Proposed source:** `gold_batch_delivery_v` (`delivery`, `customer_id`, `customer_name`, `country_id`, `city`, `abs_quantity`)

**Blockers:**

1. **`highestSeverity` has no source column** — `CustomerExposureSummarySchema.highestSeverity` requires enum `['none', 'low', 'medium', 'high', 'critical']`. The delivery view has no severity column. Business logic for severity is domain knowledge (not derivable from stock quantities alone).

2. **`recallRecommended` is a business decision** — `z.boolean()` requires a rule: "recommend recall if X customers affected OR shipped to Y countries OR…" — not in scope.

3. **`blockedDeliveries` requires delivery status** — `gold_batch_delivery_v` columns confirmed don't include a delivery status or block flag.

**Risk:** High — complex business logic required for required fields.

**Decision: DEFER** — Implement after severity mapping rules are agreed with domain owner.

---

## Implementation Scope (This Tranche)

**In scope:**
1. `apps/api/adapters/trace2/trace2_databricks_adapter.py` — QuerySpec factories + row mapping functions
2. `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py` — mapping tests (representative rows)
3. `docs/migration/databricks-vertical-slices-trace-plan.md` (this file)
4. `docs/audit/databricks-vertical-slices-trace-architecture-check.md`
5. `docs/adapters/trace2-adapter-migration-strategy.md` (new)

**Not in scope (deferred):**
- Route wiring: existing `POST /api/trace2/batch-header` remains a V1 proxy. Databricks routing requires ADR-024 #1/#7 resolved + column names confirmed.
- TypeScript `Trace2DatabricksApiAdapter` — deferred until routes are wired
- Recursive trace graph (depth > 1) — deferred
- `getCustomerExposureSummary` databricks slice — deferred (mapping complexity)
- Any new workspaces, panels, or governance screens
