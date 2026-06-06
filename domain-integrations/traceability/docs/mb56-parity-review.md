# MB56 Behaviour Gap Analysis — V2 Traceability Engine

**Status:** Gap Analysis (Requirements Identification)
**Scope:** Compares V2 `di-traceability` mock data and component behaviour against the reference Python SQL engine in `ConnectIO-RAD/libs/shared-trace/src/shared_trace/dal.py`
**Constraint:** No parity claims are made here. V2 data is mock-only at time of writing; browser-verified parity against live legacy-api or Databricks gold views has not been established.

---

## What MB56 Does (Reference Implementation)

SAP MB56 (Where-Used / Where-From) is the transactional basis for batch lineage tracing. The reference Python backend (`TraceCoreDal`) replicates this through recursive SQL CTEs over Databricks gold views:

- **`fetch_bottom_up()`** — "where-from" walk: follows upstream production inputs using `COALESCE(CHILD_PLANT_ID, '') = COALESCE(plant_id, '')` for cross-plant boundary awareness
- **`fetch_top_down()`** — "where-to" walk: follows downstream outputs, filtered to `LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER', 'STO_TRANSFER')`
- **`fetch_trace_tree()`** — bidirectional recursive CTE anchored to a production plant subquery; uses path-string cycle detection (`path NOT LIKE '%' || batch_id || '%'`) to prevent infinite loops on rework or re-use

---

## V2 Coverage vs. Reference Behaviour

### Covered in V2 Mock

| Behaviour | Reference | V2 Status |
|---|---|---|
| Batch header aggregation (material, plant, status, qty) | `_batch_header_cte()` over gold views | Mock only — `BatchHeaderSummarySchema` fields aligned |
| Customer delivery exposure (shipped qty, affected customers, countries) | `gold_batch_delivery_v` | Mock only — schema aligned |
| Mass balance (input/output/variance) | `gold_batch_mass_balance_v` | Mock only — schema aligned |
| Supplier upstream validation (vendor receipts) | `LINK_TYPE='VENDOR_RECEIPT'` recursive walk | Mock only — `SupplierExposureSummarySchema` fields aligned |
| CoA release status | `gold_batch_quality_*` | Mock only — `CoAReleaseStatusSchema` fields aligned |
| Trace graph (nodes/edges, upstream/downstream counts) | `fetch_trace_tree()` bidirectional CTE | Mock only — `TraceGraphSchema` fields aligned |

### Gaps — Not Yet Covered in V2

| Gap | Reference Behaviour | V2 Gap |
|---|---|---|
| **Plant-aware lineage joins** | `COALESCE(e.CHILD_PLANT_ID, '') = COALESCE(w.plant_id, '')` ensures correct plant boundary traversal across multi-plant batches | V2 `TraceGraph` has no per-node plant identifier; plant context lost after root anchor |
| **Cycle detection** | Path-string deduplication prevents rework / re-use loops in the CTE | V2 trace graph mock has no cycle metadata; `unresolvedNodeCount` exists in schema but not validated |
| **Link type discrimination** | Top-down restricted to PRODUCTION/BATCH_TRANSFER/STO_TRANSFER; vendor receipts separate from internal moves | `linkType` passthrough added to `TraceEdgeSchema` (PR #26); `relationshipType` enum expanded with `vendor-receipt` and `consumed-by`. Live `LINK_TYPE` column value verification against Databricks gold views still pending UAT. |
| **Recall depth-based risk tiering** | `fetch_recall_readiness()` assigns CRITICAL at depth=1, HIGH at depth=2+ with shipped exposure, MEDIUM at depth=2 | V2 severity is computed in `InvestigationSummary.tsx` from binary shipped/unrestricted flags only — no depth dimension |
| **Truncation signalling** | `TraceGraph.truncated` boolean (schema exists) is never set to `true` in mock; real graph truncation at configurable depth limit | No UI surfacing of truncation state |
| **Data freshness metadata** | All reference queries attach `data_freshness_seconds` from gold view materialization timestamps | V2 has no equivalent — staleness invisible to investigator |
| **`TraceNotFound` guard** | All reference queries raise `TraceNotFound` if batch header missing — prevents partial results masking a bad lookup | V2 adapter returns `ok: false` on null header, but frontend panels do not all surface this as a distinct error state (vs. loading) |

---

## Priority for V2 Hardening

Ordered by investigator risk (misleading result > missing result):

1. **Link type on edges** — without this, V2 cannot distinguish vendor receipts from internal batch transfers in the graph view, making supplier exposure analysis unreliable
2. **Depth-based recall tiering** — current binary severity understates risk for multi-hop indirect exposure
3. **Truncation UI signal** — investigator must know when the displayed graph is a subset of the full lineage
4. **Plant ID on trace graph nodes** — required for cross-plant investigations (common in Kerry's multi-site network)
5. **Data freshness** — downstream of gold view materialization; low implementation risk, high audit value

---

## Schema Changes Required Before Hardening

These changes to `@connectio/data-contracts` are prerequisites (update Zod schemas first, then adapters, then UI):

```
TraceGraphNode  → add plantId?: string
TraceGraphEdge  → add linkType?: 'PRODUCTION' | 'BATCH_TRANSFER' | 'STO_TRANSFER' | 'VENDOR_RECEIPT' | string
TraceGraph      → truncated field already present (ensure adapter sets it from backend response)
AdapterMetadata → add dataFreshnessSeconds?: number (or attach to each AdapterResult)
```

No schema changes are made in this branch. These are requirements only.
