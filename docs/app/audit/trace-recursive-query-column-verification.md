# Trace Recursive Query — Column Verification

**Status:** confirmed-ddl (2026-05-18 — q.txt)  
**Source table:** `connected_plant_uat.gold.gold_batch_lineage`  
**DDL source:** Confirmed by data engineering team via q.txt brief

---

## Table Purpose

`gold_batch_lineage` is the canonical edge table for batch genealogy in the ConnectIO gold layer.

Each row represents a single directed lineage edge:

```
PARENT_MATERIAL_ID / PARENT_BATCH_ID / PARENT_PLANT_ID
    →
CHILD_MATERIAL_ID / CHILD_BATCH_ID / CHILD_PLANT_ID
```

A PARENT produced, transferred, or supplied the CHILD.  
Downstream traversal starts from a known PARENT and follows edges to CHILD nodes.  
Upstream traversal starts from a known CHILD and follows edges back to PARENT nodes.

---

## Confirmed DDL — All 18 Columns

| Column | Type | Notes |
|---|---|---|
| `PARENT_MATERIAL_ID` | STRING | SAP material number of the parent node |
| `PARENT_BATCH_ID` | STRING | SAP batch number of the parent node |
| `PARENT_PLANT_ID` | STRING | SAP plant code of the parent node |
| `CHILD_MATERIAL_ID` | STRING | SAP material number of the child node |
| `CHILD_BATCH_ID` | STRING | SAP batch number of the child node |
| `CHILD_PLANT_ID` | STRING | SAP plant code of the child node |
| `LINK_TYPE` | STRING | Edge classification (see below) |
| `PROCESS_ORDER_ID` | STRING | Process order that created this edge (nullable) |
| `MATERIAL_DOCUMENT_NUMBER` | STRING | SAP material document reference (nullable) |
| `PURCHASE_ORDER_ID` | STRING | Purchase order reference for vendor receipt edges (nullable) |
| `SUPPLIER_ID` | STRING | SAP vendor/supplier ID for external receipt edges (nullable) |
| `CUSTOMER_ID` | STRING | SAP customer ID for delivery edges (nullable) |
| `DELIVERY_ID` | STRING | SAP delivery document ID (nullable) |
| `SALES_ORDER_ID` | STRING | SAP sales order reference (nullable) |
| `QUANTITY` | DECIMAL | Quantity transferred along this edge (nullable) |
| `BASE_UNIT_OF_MEASURE` | STRING | UOM for QUANTITY (nullable) |
| `POSTING_DATE` | DATE | Date the movement was posted in SAP (nullable) |
| `MOVEMENT_TYPE` | STRING | SAP movement type code (nullable) |

**Clustering:** `CHILD_MATERIAL_ID`, `CHILD_BATCH_ID`  
Clustering optimises upstream traversal (filter by child) and also benefits downstream queries via partition pruning on the child side of joins.

---

## LINK_TYPE Values

LINK_TYPE describes the relationship between parent and child. Known values from V1 source:

| LINK_TYPE | Relationship semantics |
|---|---|
| `PRODUCTION` | Parent material was consumed in a process order to produce the child |
| `BATCH_TRANSFER` | Batch transferred between storage locations or plants |
| `STO_TRANSFER` | Stock transport order between plants |
| `VENDOR_RECEIPT` | External receipt — parent is a supplier lot, child is the received batch |
| `CONSUMPTION` | Parent batch consumed as a component |
| `DELIVERY` | Child batch delivered to a customer |
| `SPLIT` | Parent batch split into child batch(es) |
| `MERGE` | Child batch created by merging parent batches |

Unknown LINK_TYPE values are preserved on the edge — the adapter does not drop edges for unrecognised types.

---

## Graph Properties

- **Complete graph structure derivable from this table alone** — no join to a node table is required.
- **Exposure summaries** can use `CUSTOMER_ID`, `SUPPLIER_ID`, `DELIVERY_ID`, `SALES_ORDER_ID`, `PURCHASE_ORDER_ID`, but these are deferred in the q.txt tranche.
- **Multi-hop traversal** requires iterating edges: the table has no depth column, so depth is computed by the traversal algorithm.

---

## Traversal Implementation

### Approach chosen: iterative Python expansion

`WITH RECURSIVE` CTE support under the Databricks Statement API cannot be verified without live DDL execution. The q.txt tranche implements **iterative expansion**: one QuerySpec call per hop depth, orchestrated in Python in the route handler.

See `docs/migration/trace-v1-recursive-query-recovery.md` for algorithm details.

### QuerySpec factories

| Factory | Hop | Params style |
|---|---|---|
| `get_trace_graph_anchor_spec(request)` | 0 | Named bound params (`:material_id`, `:batch_id`, `:plant_id`) — user input |
| `get_trace_graph_hop_spec(frontier, direction)` | 1..N | Embedded tuple literals — server-generated values from prior query |

### Cycle prevention

`seen_node_keys` set in the route handler tracks all discovered `material_id:batch_id:plant_id` tuples. Edges where both endpoints are already seen are skipped without being added to the result.

---

## Adapter location

`apps/api/adapters/trace2/trace2_databricks_adapter.py`  
Functions: `get_trace_graph_anchor_spec`, `get_trace_graph_hop_spec`, `map_trace_graph`

Route: `apps/api/routes/trace2.py` — `POST /api/trace2/trace-graph`

---

## Deferred

- `gold_batch_summary_v` column names: still unverified (TODO markers in `get_batch_header_summary_spec`)
- `gold_material.language_id`: still unverified — no joins to gold_material in the trace-graph slice
- Mass balance, customer exposure, supplier exposure, recall workflow: explicitly deferred in q.txt
