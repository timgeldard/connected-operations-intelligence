# Customer Exposure Depth Slice — Implementation Plan

**Domain:** `domain-integrations/traceability`  
**Created:** 2026-05-19  
**Status:** Plan only — not implemented  
**Closes (partially):** TRACE-P0-003  
**Prerequisite:** `gold_batch_delivery_v` column verification (see `docs/migration/databricks-column-verification-queries.md`)

> **Implementation constraint:** Do not implement this slice until `gold_batch_delivery_v` column names have been verified against a live Databricks catalog. The plan below documents the intended design; no application code should be written from it until the verification step is complete.

---

## Problem

`maxExposureDepth` is schema/code-ready in `CustomerExposureSummarySchema` and `InvestigationSummary.tsx` severity logic can use it, but no Databricks slice populates the field. This means depth-aware severity tiering (TRACE-P0-003) is always in conservative fallback mode: any `shippedQuantity > 0` triggers CRITICAL regardless of whether the shipment is direct (depth=1) or a multi-hop indirect exposure (depth≥2).

---

## Source Views Required

| View | Status | Used for |
|------|--------|----------|
| `gold_batch_lineage` | Confirmed (recursive graph query in place) | Lineage traversal to reach customer-delivery nodes |
| `gold_batch_delivery_v` | **Unverified — column names are unknown** | Customer ID, delivery ID, shipped quantity, country |

`gold_batch_lineage` is already used in `get_trace_graph_recursive_spec` and its column names are confirmed from V1 source inspection. The WITH RECURSIVE graph traversal already assigns a `depth` value to each node. `gold_batch_delivery_v` is named in the deferred-slices comment in `trace2_databricks_adapter.py` but no columns have been confirmed.

---

## Keys Required

The customer-exposure slice must be keyed on the same anchor as the trace graph:

- `material_id` (anchor batch)
- `batch_id` (anchor batch)

The lineage graph traversal already uses `material_id + batch_id` as the anchor. Delivery lookups should join on whichever foreign key `gold_batch_delivery_v` exposes for the shipped batch — likely `material_id + batch_id` or a `delivery_id` that links back through the lineage. **This join key must be confirmed against the live catalog before implementation.**

---

## How to Compute `CustomerExposureSummary` Fields

### `affectedCustomers`

Count distinct customer IDs across all customer-delivery nodes reachable from the anchor batch in the downstream direction. A "customer-delivery node" is any node in the lineage graph where `type = 'customer-delivery'` (or equivalent `LINK_TYPE` value confirmed from live data).

```sql
-- Pseudocode only — column names unverified
SELECT COUNT(DISTINCT d.customer_id)
FROM gold_batch_lineage_traversal t
JOIN gold_batch_delivery_v d ON t.batch_id = d.batch_id   -- join key unverified
WHERE t.anchor_material_id = :material_id
  AND t.anchor_batch_id    = :batch_id
  AND t.direction          = 'downstream'
  AND t.link_type          = 'CUSTOMER_DELIVERY'           -- link type value unverified
```

### `shippedQuantity`

Sum of delivery quantities across all downstream customer-delivery nodes:

```sql
-- Pseudocode only — column names unverified
SELECT SUM(d.delivery_quantity)
FROM gold_batch_lineage_traversal t
JOIN gold_batch_delivery_v d ON t.batch_id = d.batch_id
WHERE t.anchor_material_id = :material_id
  AND t.anchor_batch_id    = :batch_id
  AND t.direction          = 'downstream'
  AND t.link_type          = 'CUSTOMER_DELIVERY'
```

### `maxExposureDepth`

The minimum hop count from the anchor batch to the closest customer-delivery node. This value is already available on each node in the recursive graph query as `depth`. The implementation is:

```sql
-- The recursive CTE already computes depth per node.
-- maxExposureDepth = MIN(depth) where link_type = 'CUSTOMER_DELIVERY'
SELECT MIN(t.depth) AS max_exposure_depth
FROM gold_batch_lineage_traversal t
WHERE t.anchor_material_id = :material_id
  AND t.anchor_batch_id    = :batch_id
  AND t.direction          = 'downstream'
  AND t.link_type          = 'CUSTOMER_DELIVERY'
```

`depth=1` means the anchor batch was shipped directly to a customer. `depth≥2` means the shipment passed through at least one intermediate node before reaching a customer. Per the schema comment, `maxExposureDepth=1` → direct exposure; `maxExposureDepth≥2` → multi-hop indirect.

### `affectedDeliveries`

Count distinct delivery document IDs:

```sql
SELECT COUNT(DISTINCT d.delivery_id)   -- delivery_id column name unverified
FROM ...
```

### `blockedDeliveries`

Count deliveries where a stock block is in effect. The blocking status field name in `gold_batch_delivery_v` is unverified.

### `countries`

Distinct ship-to country codes from delivery rows. Country field name in `gold_batch_delivery_v` is unverified.

### `highestSeverity`

Derived in application code from `maxExposureDepth` and `shippedQuantity` using the existing severity chain in `InvestigationSummary.tsx`. The Databricks slice should not derive severity — it only provides the raw counts and depth.

### `recallRecommended`

Reserved for application logic or future policy rules. The Databricks slice should not set this field.

---

## Guarding Against Missing Data = Zero Exposure

This is the most safety-critical constraint in this slice.

**Rule:** If `gold_batch_delivery_v` returns zero rows, the adapter must **not** infer that zero customers were affected. It must return `null` for the customer exposure summary and the UI must treat `null` as UNKNOWN (existing TRACE-P0-001 fix).

Implementation:

```python
def map_customer_exposure_rows(rows: list[dict]) -> Optional[dict]:
    if not rows:
        # Zero rows means the delivery view returned nothing.
        # This could be: no shipments, or missing delivery data.
        # We cannot distinguish without a verified null-delivery pattern.
        # Return None → UI displays UNKNOWN severity, not Low Risk.
        return None
    ...
```

Additionally, the query should include a sentinel: if a row is returned with `customer_id IS NULL` or `delivery_quantity IS NULL`, those rows should be excluded from counts but their presence should be flagged in the `warnings` field of `TraceGraphSchema` or logged.

---

## Direct vs Indirect Exposure

| `maxExposureDepth` | Meaning | Severity mapping |
|---|---|---|
| `1` | Direct shipment to customer | CRITICAL if shipped |
| `2` | One intermediate node (e.g. distribution centre) | HIGH if shipped, MEDIUM if not shipped |
| `3+` | Multi-hop indirect | HIGH if shipped, MEDIUM if not shipped (≥2 rule) |
| `undefined` | Depth not yet populated | Conservative CRITICAL fallback |

This mapping is already implemented in `InvestigationSummary.tsx`. The Databricks slice only needs to populate `maxExposureDepth` with the correct integer.

---

## Integration Point

The slice should be implemented as a new QuerySpec factory in `trace2_databricks_adapter.py`:

```python
def get_customer_exposure_spec(request: Trace2CustomerExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getCustomerExposureSummary.

    Sources: gold_batch_lineage (confirmed) + gold_batch_delivery_v (UNVERIFIED)
    Contract: CustomerExposureSummarySchema (packages/data-contracts)
    Cache: PER_USER_60S
    
    IMPORTANT: gold_batch_delivery_v column names are unverified.
    Do not activate this slice until column verification is complete.
    """
    ...
```

The route is `POST /trace2/customer-exposure` (does not exist yet — must be created). The frontend adapter call is `getCustomerExposureSummary()` in `trace2-adapter.ts`.

---

## Column Verification Required Before Implementation

Before writing any SQL:

1. Run `DESCRIBE TABLE <catalog>.<schema>.gold_batch_delivery_v` in a Databricks notebook.
2. Confirm: customer ID column name, delivery ID column name, shipped quantity column name, country column name, shipment date column name.
3. Confirm the join key between `gold_batch_lineage` and `gold_batch_delivery_v`.
4. Confirm the `LINK_TYPE` value used for customer-delivery edges (expected: `'CUSTOMER_DELIVERY'` or `'DELIVERED_TO'`).
5. Record results in `docs/migration/databricks-column-verification-queries.md` and update TODOs in adapter.

---

## Tests Required

When implementation begins, add:

1. `test_map_customer_exposure_rows_returns_none_for_empty_rows` — empty rows → `None` (not zero)
2. `test_map_customer_exposure_max_depth_from_minimum_delivery_depth` — two deliveries at depths 1 and 3 → `maxExposureDepth=1`
3. `test_map_customer_exposure_direct_and_indirect_counts_separated` — depth=1 vs depth=2 deliveries produce correct `affectedCustomers`
4. `test_map_customer_exposure_null_customer_id_excluded_from_count` — null customer IDs do not inflate `affectedCustomers`
5. TypeScript tests in `InvestigationSummary.test.tsx` for `maxExposureDepth=3` (≥2 indirect rule already tested at depth=2)

---

## UAT Scenarios Required

| Scenario | What to validate |
|---|---|
| Direct shipment batch (depth=1) | `maxExposureDepth=1` → CRITICAL severity in cockpit |
| Multi-hop indirect batch (depth=2) | `maxExposureDepth=2` → `High Indirect Exposure` label in cockpit |
| Batch where delivery view returns no rows | `customerExposure=null` → UNKNOWN severity, "do not assume containment" banner. **Note:** zero rows cannot be distinguished from missing delivery data until a confirmed-zero sentinel pattern is verified in a live session — do not interpret as Low Risk. |
| Batch with confirmed zero deliveries (sentinel validated) | After a confirmed-zero sentinel is implemented and verified: `CustomerExposureSummary.shippedQuantity=0` may map to Low Risk. Requires explicit implementation and UAT sign-off before this scenario is trusted. |
| Batch with mixed depth=1 and depth=2 deliveries | `maxExposureDepth=1` (min depth) → CRITICAL |

---

## Readiness Checklist Links

- Readiness row 1.4: `TRACE-P0-003` — Schema/code-ready; population pending this slice
- Defect backlog: `TRACE-P0-003 — Severity tiering is binary, not depth-based`

---

## Lineage-Only First Slice (Implemented 2026-05-20)

**Status:** Code-ready. Requires UAT validation.

This section documents a deviation from the original "do not implement until gold_batch_delivery_v verified" constraint. The lineage-only slice is a strictly smaller implementation that does NOT use `gold_batch_delivery_v` at all.

**Deviation rationale:**
- `gold_batch_lineage` columns confirmed live 2026-05-19 (all 18 columns, including CUSTOMER_ID, DELIVERY_ID, LINK_TYPE).
- The lineage-only slice uses only verified columns from a verified source.
- `gold_batch_delivery_v` is still required for countries, blockedDeliveries, and customer names — those fields remain deferred.
- The zero-rows → 404 semantics ensure no false "no exposure" signals regardless of CUSTOMER_ID sparsity.

**What was implemented (2026-05-20):**
- `Trace2CustomerExposureRequest` dataclass
- `get_customer_exposure_spec()` — downstream WITH RECURSIVE CTE on gold_batch_lineage, LINK_TYPE='DELIVERY' filter
- `map_customer_exposure_rows()` — zero rows → None; non-zero → aggregate counts + depth
- `POST /api/trace2/customer-exposure` route (databricks-api mode only)
- `getCustomerExposureSummary()` override in `Trace2LegacyApiAdapter`
- Panel: countries disclaimer when countries=[] and deliveries > 0; depth language when maxExposureDepth present
- Source mapping doc: `customer-exposure-source-mapping.md`

**What was NOT implemented (still requires gold_batch_delivery_v):**
- `countries` — always `[]` in this slice
- `blockedDeliveries` — always `0` in this slice
- Customer names and country details

**UAT validation required before production use:**
1. Confirm LINK_TYPE='DELIVERY' edges exist with CUSTOMER_ID populated for a known shipped batch
2. Confirm affectedCustomers / affectedDeliveries counts are plausible
3. Confirm maxExposureDepth=1 for a batch with direct customer shipment
4. Confirm 404 response for a batch with no downstream deliveries (interpret as "no records" not "no exposure")
