# Trace V1 Recursive Query — Recovery and V2 Reconstruction

**Status:** V2 reconstruction (q.txt, 2026-05-18)  
**Approach:** Iterative Python expansion over `gold_batch_lineage`  
**Reference:** `docs/audit/trace-recursive-query-column-verification.md`

---

## V1 Query Recovery Status

The V1 trace recursive SQL was searched in the V1 source tree. No single canonical recursive CTE was recovered — V1 appears to have built lineage traversal at the application level (DAL/service layer) rather than in SQL, using iterative graph expansion similar to what V2 now implements.

This document therefore describes the **V2 reconstruction** of recursive trace semantics based on the confirmed `gold_batch_lineage` DDL.

---

## V2 Iterative Expansion Algorithm

### Why iterative, not recursive CTE

`WITH RECURSIVE` CTE support under the Databricks Statement API cannot be confirmed without live DDL execution in UAT. The iterative approach:

- Does not depend on `WITH RECURSIVE` support
- Produces identical multi-hop results
- Allows per-hop edge cap enforcement (hard `max_edges` limit)
- Is auditable — each hop is a separate QuerySpec logged with `X-Query-Name`
- Is safe to implement now without blocking on DDL execution

If `WITH RECURSIVE` is confirmed in UAT, a future optimisation could replace the iterative Python loop with a single recursive CTE. The response contract and test suite would remain unchanged.

### Algorithm

```
anchor_key = node_key(material_id, batch_id, plant_id)
seen_node_keys = {anchor_key}
seen_edge_keys = {}
tagged_rows = []
frontier = []

# Hop 0 — anchor spec (named bound params, user input)
rows0 = execute(get_trace_graph_anchor_spec(request))
for each row in rows0:
    if edges >= max_edges: truncated = True; break
    classify edge direction (downstream if parent==anchor, upstream if child==anchor)
    dedupe by edge_key
    add to tagged_rows
    add new endpoint to frontier

# Hops 1..max_depth-1 — hop spec (embedded tuple literals, server values)
for hop in 1..max_depth-1:
    if frontier is empty or truncated: break
    rows_n = execute(get_trace_graph_hop_spec(frontier, direction))
    for each row in rows_n:
        if both endpoints already in seen_node_keys: skip (cycle)
        classify direction (downstream if parent in seen, upstream if child in seen)
        dedupe by edge_key
        add to tagged_rows
        add new endpoint to next_frontier

result = map_trace_graph(tagged_rows, request, depth_reached, truncated)
```

### Direction semantics

| direction | Anchor hop WHERE | Subsequent hop WHERE | Frontier grows from |
|---|---|---|---|
| `downstream` | `PARENT = anchor` | `PARENT IN (frontier)` | CHILD of each edge |
| `upstream` | `CHILD = anchor` | `CHILD IN (frontier)` | PARENT of each edge |
| `both` | `PARENT = anchor OR CHILD = anchor` | `PARENT IN (frontier) OR CHILD IN (frontier)` | New endpoint of each edge |

### Cycle prevention

A `seen_node_keys` set of `material_id:batch_id:plant_id` strings tracks all nodes added to the graph. At each hop, any edge where **both** endpoints are already in `seen_node_keys` is skipped. This prevents traversal re-entering already-explored subgraphs.

Note: the edge key includes hop depth (`parent|child|link_type|doc_num|hop`), so the same physical edge at different depths is treated as distinct if somehow revisited.

### Frontier IN-clause safety

Subsequent hop queries embed the frontier as SQL tuple literals:

```sql
WHERE (PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID)
  IN (('MAT_A', 'BATCH_A', 'C061'), ('MAT_B', 'BATCH_B', 'C061'))
```

The values in the IN-clause are **server-generated** — produced by the previous hop's Databricks query result, not from user input. Single-quotes within values are escaped by doubling (`'` → `''`) via `_sql_str()`. User-supplied values (material_id, batch_id, plant_id) only appear in the hop-0 anchor spec as named bound params (`:material_id`, `:batch_id`, `:plant_id`).

---

## V1 Semantics Comparison

| Dimension | V1 (inferred) | V2 implementation |
|---|---|---|
| Direction handling | `upstream`, `downstream`, `both` | Same |
| Max depth | Unknown — likely 6–10 | Default 6, max 10 |
| Cycle prevention | Application-level dedup | `seen_node_keys` set |
| Duplicate edge handling | Deduped in result | `seen_edge_keys` set |
| Anchor inclusion | Anchor node always in result | Always included as `isAnchor: true` |
| Output: nodes | Batch nodes | `nodeKey`, `materialId`, `batchId`, `plantId`, `depth`, `directions`, `isAnchor` |
| Output: edges | Edges with context | All 18 `gold_batch_lineage` columns preserved |
| Vendor/customer on edges | Unknown | SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID, SALES_ORDER_ID on each edge |
| Vendor/customer as fake batch nodes | Unknown | No — vendor/customer context is on edges only |
| Material descriptions | Joined from gold_material | **Deferred** — language_id column unverified; labels use materialId/batchId |

---

## Response Contract Differences from V1

The V2 response shape (q.txt) differs from the existing `TraceGraphSchema` in `packages/data-contracts`:

| Field | Old TraceGraphSchema | V2 q.txt shape |
|---|---|---|
| Direction values | `forward`, `reverse`, `both` | `upstream`, `downstream`, `both` |
| Root/anchor | `rootBatch: string` | `anchor: {materialId, batchId, plantId, nodeKey}` |
| Node id | `id: string` | `nodeKey: string` (3-tuple including plant) |
| Node type | Enum (raw-material, intermediate...) | Not present (no type info in gold_batch_lineage) |
| Depth tracking | `depth: number` (single value) | `depthReached: number` + per-node `depth` |
| Truncation | Not present | `truncated: boolean` + `warnings[]` |
| Edge fields | `relationshipType` enum | `linkType` string + all 18 DDL columns |

Frontend wiring is deferred — see `docs/migration/trace-lineage-to-graph-contract-map.md`.

---

## Stop Conditions (none triggered)

- [x] `gold_batch_lineage` object resolver works via `resolve_domain_object("trace2", "gold_batch_lineage")`
- [x] Iterative expansion avoids `WITH RECURSIVE` dependency
- [x] Response size capped by `max_edges` (default 1000, max 5000)
- [x] No SQL in React or route handlers
- [x] No mock/legacy/SPN/PAT fallback
