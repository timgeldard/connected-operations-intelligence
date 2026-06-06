# Trace Native — Browser Verification Checklist

**Date:** 2026-05-18 — q.txt: `POST /api/trace2/trace-graph` route wired; e.txt: link-type legend, TraceQueryForm, final route mounted  
**Status:** T2 **BROWSER-VERIFIED 2026-05-18** (HTTP 200, UC GRANT applied). T2-UI (C13) **BROWSER-VERIFIED 2026-05-18** (green `source: databricks-api` badge). T2-UI full screen (C14) **BROWSER-VERIFIED 2026-05-18** (gold_batch_lineage, databricks-api, depth=1, truncated=No). T2-Shell (C15) **BROWSER-VERIFIED 2026-05-18** (same data confirmed on final workspace route). C16 (WITH RECURSIVE) **BROWSER-VERIFIED 2026-05-18** (HTTP 200, 7 nodes, 7 edges, depthReached=1, no warnings, no timeout). C16-UI **BROWSER-VERIFIED 2026-05-18 commit `518d9bb`** — graph fills full width after `?workspace=traceability-workspace` layout fixes (hide action sidebar for trace-tree view + `gridColumn: '1 / -1'` to span EvidenceGrid columns). T1 (batch-header) and T3 (mass-balance) still blocked on DDL verification.  
**App URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Reference:**  
- `docs/audit/trace-native-column-verification-checklist.md` — DDL verification (must complete first)
- `docs/migration/trace-native-batch-header-lineage-plan.md` — implementation decisions

---

## Prerequisites

Before running any check:
- DDL verification in `trace-native-column-verification-checklist.md` must be COMPLETE
- All blocking TODOs in `apps/api/adapters/trace2/trace2_databricks_adapter.py` must be resolved
- Routes must be wired to Databricks in `apps/api/routes/trace2.py`
- UAT app must be RUNNING: `databricks apps get connectio-v2` → state = RUNNING
- `BACKEND_ADAPTER_MODE=databricks-api` confirmed in `apps/api/app.yaml`
- `TRACE_CATALOG=connected_plant_uat` must be set in `apps/api/app.yaml`
- Authenticated as a Databricks user with `sql` scope in `effective_user_api_scopes`

---

## Verification Surfaces

### A — API verification
Route: `POST /api/trace2/trace-graph`  
Purpose: verifies backend route, OAuth, Databricks config, UC grants, query execution, and response shape.

### B — Dedicated UI verification (primary surface) — Traceability Investigation Screen
URL: `https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=trace-graph-verify`  
Purpose: Complete Traceability investigation screen (c.txt, 2026-05-18). Verifies: direction/depth/edges controls, investigation header, edge detail (all gold_batch_lineage fields), node detail, timeline, exposure indicators, source banner, no mock fallback.  
Test values: `materialId=20052009`, `batchId=0008602411`, `plantId=C061`, `direction=both`, `maxDepth=2`, `maxEdges=100`

> **Material ID format note:** `gold_batch_lineage` stores material IDs **without** SAP ALPHA leading zeros — `20052009`, not `000000000020052009`. The verify page default was corrected to `20052009` (b.txt, 2026-05-18). Do not assume SAP ALPHA padding behaviour until input normalization is implemented.

### C — Final user-facing Trace workspace (d.txt, 2026-05-18)
URL: `/?workspace=traceability-workspace&view=trace-tree`  
Purpose: verifies the real Traceability workspace route (not the verify page). Includes form, native graph, batch header context. No mock fallback.  
**Status: BROWSER-VERIFIED 2026-05-18, commit `518d9bb`** — graph renders real Databricks data and fills the full content width after two g.txt/h.txt layout fixes:
- `55171f3` — hide `TraceActionsPanel` action sidebar for `trace-tree` view (sidebar had `minWidth: 200` and all buttons were permanently disabled because `context=null` without V1 backend).
- `518d9bb` — add `gridColumn: '1 / -1'` to `TraceTreeView` outer div so it spans every EvidenceGrid column (was occupying col 1 only at typical viewports).  
**Note:** URL param is `?view=` (not `?tab=`). `tab=` is deprecated. `view=trace-tree` is the correct view ID.  
**Note:** Bare `?workspace=traceability-workspace` (no view param) defaults to `view=trace-tree` (changed from `overview` in d.txt to avoid OverviewView mock fallback on cold load).

---

## Test Anchor

| Field | Value |
|---|---|
| material_id | `20052009` (stored key — no SAP ALPHA leading zeros in `gold_batch_lineage`) |
| batch_id | `0008602411` |
| plant_id | `C061` |

If this anchor has no rows, identify an alternate batch from `gold_batch_lineage` with known rows.

---

## Check T1 — POST /api/trace2/batch-header (Databricks native)

**UI route:** Navigate to Trace Investigation workspace → enter material/batch → Batch Header panel.

**Direct API call:**
```http
POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/batch-header
Content-Type: application/json

{
  "material_id": "000000000020052009",
  "batch_id": "0008602411"
}
```

**Expected response headers (databricks-api mode):**
```http
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: trace2.get_batch_header_summary
```

**Expected response body shape:**
```json
{
  "materialId": "000000000020052009",
  "materialDescription": "<string from gold_material.material_name>",
  "batchId": "0008602411",
  "plantId": "<string from gold_batch_summary_v.plant_id>",
  "plantName": "<string from gold_plant.plant_name>",
  "batchStatus": "active" | "blocked" | "archived" | "deleted",
  "stockStatus": "unrestricted" | "blocked" | "quality-inspection" | "returns" | "transit",
  "qualityStatus": "pending" | "not-applicable",
  "releaseStatus": "released" | "blocked" | "restricted" | "not-released" | "unknown",
  "quantity": <number>,
  "uom": "<string>",
  "manufactureDate": "<date string or absent>",
  "expiryDate": "<date string or absent>",
  "processOrderId": "<string or absent>"
}
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: trace2.get_batch_header_summary` header present
- [ ] Response is a JSON object (not array)
- [ ] `materialId` matches request `material_id` (leading zeros preserved)
- [ ] `batchId` matches request `batch_id`
- [ ] `batchStatus` is a known enum value (not null)
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|---|---|---|
| 503 (mode) | `BACKEND_ADAPTER_MODE` not `databricks-api` | Check `app.yaml` |
| 503 (catalog) | `TRACE_CATALOG` not set | Add `TRACE_CATALOG=connected_plant_uat` to `app.yaml` |
| 401 | OAuth token missing or `sql` scope absent | Re-deploy bundle; check `user_api_scopes: [sql]` |
| 403 | User lacks SELECT on gold views | Grant UC access: `GRANT SELECT ON VIEW connected_plant_uat.gold.gold_batch_summary_v TO <user>` |
| 404 | Batch not found in `gold_batch_stock_v` | Try alternate test anchor |
| 502 | Query error — likely wrong column name | Check adapter TODO columns; check `databricks apps logs connectio-v2` |
| 429 | Rate limit | Retry after 30 seconds |
| 504 | Timeout | Check warehouse health; retry |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Blocked — DDL verification incomplete |

---

## Check T2 — POST /api/trace2/trace-graph (multi-hop, q.txt)

**Status:** Route wired (q.txt, 2026-05-18) — executable, awaiting browser verification.  
**Note:** T2 can be browser-verified independently of T1 (batch-header) — gold_batch_lineage DDL is confirmed; no joins to unverified views.

**Direct API call:**
```http
POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/trace-graph
Content-Type: application/json
Authorization: Bearer <user-oauth-token>

{
  "material_id": "000000000020052009",
  "batch_id": "0008602411",
  "plant_id": "C061",
  "direction": "both",
  "max_depth": 6,
  "max_edges": 1000
}
```

**Expected response headers:**
```http
X-Data-Source: view:gold_batch_lineage
X-Adapter-Mode: databricks-api
X-Query-Name: trace2.get_trace_graph
```

**Expected response body shape (data exists):**
```json
{
  "anchor": {
    "materialId": "000000000020052009",
    "batchId": "0008602411",
    "plantId": "C061",
    "nodeKey": "000000000020052009:0008602411:C061"
  },
  "nodes": [
    {
      "nodeKey": "000000000020052009:0008602411:C061",
      "materialId": "000000000020052009",
      "batchId": "0008602411",
      "plantId": "C061",
      "label": "000000000020052009 / 0008602411",
      "depth": 0,
      "directions": ["anchor"],
      "isAnchor": true
    }
  ],
  "edges": [
    {
      "id": "<parent_key>|<child_key>|<link_type>|<doc_num>|<hop>",
      "source": "<parent_node_key>",
      "target": "<child_node_key>",
      "linkType": "PRODUCTION",
      "processOrderId": "<string or null>",
      "materialDocumentNumber": "<string or null>",
      "quantity": <number or null>,
      "baseUnitOfMeasure": "<string or null>",
      "postingDate": "<date or null>",
      "movementType": "<string or null>",
      "depth": 0,
      "direction": "downstream"
    }
  ],
  "depthReached": 1,
  "truncated": false,
  "warnings": []
}
```

**Acceptable empty response (anchor exists, no lineage edges):**
```json
{
  "anchor": { "materialId": "000000000020052009", "batchId": "0008602411", "plantId": "C061", "nodeKey": "..." },
  "nodes": [{ "isAnchor": true, ... }],
  "edges": [],
  "depthReached": 0,
  "truncated": false,
  "warnings": ["no_edges_found"]
}
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: view:gold_batch_lineage` header present
- [ ] `X-Adapter-Mode: databricks-api` header present
- [ ] `X-Query-Name: trace2.get_trace_graph` header present
- [ ] Response has `anchor`, `nodes`, `edges`, `depthReached`, `truncated`, `warnings` keys
- [ ] Anchor node is present in `nodes` with `isAnchor: true`
- [ ] `anchor.materialId` = `"000000000020052009"` (leading zeros preserved)
- [ ] `anchor.batchId` = `"0008602411"` (leading zeros preserved)
- [ ] If edges exist: all edge `source`/`target` values correspond to `nodeKey` values in `nodes`
- [ ] No duplicate `nodeKey` values in `nodes`
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|---|---|---|
| 503 (mode) | `BACKEND_ADAPTER_MODE` ≠ `databricks-api` | Check `app.yaml` |
| 503 (catalog) | `TRACE_CATALOG` not set | Add to `app.yaml` |
| 401 | OAuth token missing or `sql` scope absent | Re-deploy bundle; check `user_api_scopes: [sql]` |
| 403 | Stale OAuth token (session expired) | Hard-refresh browser or log out and back in to get a fresh token |
| 403 | No SELECT on `gold_batch_lineage` | `GRANT SELECT ON TABLE connected_plant_uat.gold.gold_batch_lineage TO <user>` |
| 422 | Invalid `direction` value | Use `upstream`, `downstream`, or `both` |
| 502 | SQL execution error | Check `databricks apps logs connectio-v2` |
| Empty graph (`no_edges_found` warning) | Anchor has no lineage edges | Expected for some batches — try alternate anchor |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [x] **PASSED** | 2026-05-18 | HTTP 200 — `ok: true`. UC GRANT applied to `tim.geldard@kerry.com` on `connected_plant_uat.gold`. Test anchor: `material_id=20052009`, `batch_id=0008602411`, `plant_id=C061`, `direction=both`, `max_depth=2`. |
| [x] **PASSED (WITH RECURSIVE)** | 2026-05-18 | Refactored to single WITH RECURSIVE query (504 fix). `material_id=20052009, batch_id=0008602411, direction=both, max_depth=4` → HTTP 200, 3.2s, 7 nodes, 7 edges, nodeKey=2-tuple. Dense anchor `20732244/0008545768, depth=3` → HTTP 200, 3.7s, 299 nodes, 307 edges. No timeout. Note: gold_batch_lineage stores material_id WITHOUT leading zeros. |

---

## Check T2-UI — Trace Graph Panel (frontend wiring) — EXECUTABLE, UI BV pending

**Status:** Frontend wiring complete (u.txt, 2026-05-18). Shell routing fixed (a.txt, 2026-05-18) — verification page added and `traceability-workspace` placeholder removed. UI browser verification pending after next UAT deploy.

**What changed (a.txt, 2026-05-18):**
- `traceability-workspace` in `WorkspaceViews.tsx` now renders `TraceInvestigationWorkspace` — no longer hits the "implementation pending" placeholder
- New `trace-graph-verify` page added at `?workspace=trace-graph-verify` — form with materialId/batchId/plantId inputs and Run Trace button; renders `TraceGraphPanel` with the submitted request; no mock fallback

**Prerequisites:** T2 API check must be PASSED first.

**Primary URL for UI BV:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=trace-graph-verify
```

**Test anchor (pre-filled in form):**
- Material ID: `20052009` (stored key — corrected from `000000000020052009` in b.txt 2026-05-18)
- Batch ID: `0008602411`
- Plant ID: `C061`

**Steps:**
1. Navigate to `/?workspace=trace-graph-verify`
2. Confirm inputs are pre-filled with test anchor values
3. Click **Run Trace**
4. Verify the graph panel renders with data from the backend

**Pass criteria — complete Traceability investigation screen (c.txt, 2026-05-18):**
- [ ] Page loads at `?workspace=trace-graph-verify` without crash
- [ ] Material ID, Batch ID, Plant ID inputs pre-filled; Direction/Max depth/Max edges dropdowns visible
- [ ] Click **Run Trace** — graph panel appears
- [ ] ReactFlow canvas visible with at least the anchor node
- [ ] `source: databricks-api` badge visible (green) — NOT `source: mock`
- [ ] Investigation header visible: materialId, batchId, plantId, node count, edge count, depth reached, truncated, source
- [ ] Node count and edge count match T2 API response
- [ ] Click any node → detail panel shows materialId, batchId, plantId, depth, isAnchor, inbound/outbound edge counts
- [ ] Click any edge → detail panel shows link type, movement type, posting date, quantity, source batch, target batch, plus any available: processOrderId, materialDocumentNumber, purchaseOrderId, deliveryId, salesOrderId, supplierId, customerId
- [ ] Direction dropdown (both/upstream/downstream) wired to backend — re-submit with "upstream" returns only upstream nodes
- [ ] Max depth dropdown (1/2/3/4) wired to backend
- [ ] Max edges dropdown (100/500/1000) wired to backend
- [ ] Timeline section visible: "Timeline from lineage edges" label, dated events sorted by posting date, or "No dated events available" if none
- [ ] Exposure indicators section visible: distinct customer/supplier/delivery/PO/process-order counts
- [ ] Source banner visible: gold_batch_lineage, trace2.get_trace_graph, depth, truncated
- [ ] Warnings banner appears when backend returns `truncated: true` or `max_depth_reached`
- [ ] Empty state message (`No lineage edges found for this material/batch/plant.`) when no edges
- [ ] No mock data shown on failure — error state only

**Also verify (Option A — shell fix):**
- [ ] `?workspace=traceability-workspace` and `?workspace=traceability-workspace&view=trace-tree` render the Traceability Investigation screen with query form — not the "implementation pending (Phase 3+)" placeholder
- [ ] See Check T2-Shell below for full pass criteria

**Troubleshooting:**

| Symptom | Likely cause | Fix |
|---|---|---|
| `?workspace=trace-graph-verify` returns NotFound | Build does not include a.txt changes | Redeploy UAT bundle |
| Green badge not showing | `VITE_ADAPTER_MODE` not `legacy-api` in build | Check Vite build config |
| Panel shows mock nodes only | `getTraceGraph` not calling backend | Check adapter factory — mode must be `legacy-api` |
| React Flow crash | `undefined` on `node.type` or `edge.relationshipType` | Fixed in u.txt — check build includes latest panel |
| Empty nodes/edges from a batch that T2 returned data for | Mapper bug | Check `mapBackendTraceGraph` output vs raw response |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [x] **PASSED** | 2026-05-18 | Green `source: databricks-api` badge confirmed. ReactFlow canvas rendered with nodes and edges. `materialId=20052009` (user-edited from long-form default). Node click, edge click, direction toggle, warnings, and traceability-workspace shell integration not separately confirmed — remaining items pending. |

---

## Check T3 — POST /api/trace2/mass-balance (deferred)

Route not yet wired — `gold_batch_mass_balance_v` WHERE column names unverified.

Run DDL check first:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v;
```

When wired, test:
```http
POST /api/trace2/mass-balance
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```

Expected headers: `X-Query-Name: trace2.get_mass_balance`

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Blocked — DDL verification incomplete |

---

---

## Check T2-Shell — Final user-facing Trace workspace (d.txt, 2026-05-18)

**Status: BROWSER-VERIFIED 2026-05-18** — route mounted, default view `trace-tree`, TraceQueryForm embedded. Source: `gold_batch_lineage`, Execution: `databricks-api`, Query: `trace2.get_trace_graph`, Depth reached: 1, Truncated: No.

**Primary URL:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=traceability-workspace&view=trace-tree
```

**Also test bare URL (should now default to trace-tree):**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=traceability-workspace
```

**Test anchor:** Enter manually — `materialId=20052009`, `batchId=0008602411`, `plantId=C061`, `direction=both`, `maxDepth=2`, `maxEdges=100` — then click Run Trace.

**Pass criteria:**
- [ ] Page loads without crash
- [ ] Trace Investigation form visible (Material ID, Batch ID, Plant ID, Direction, Max depth, Max edges)
- [ ] Form pre-filled with defaults (20052009 / 0008602411 / C061)
- [ ] No panels visible before Run Trace is clicked
- [ ] Click **Run Trace** — TraceGraphPanel appears with real Databricks graph
- [ ] `source: databricks-api` badge visible (green) — NOT `source: mock`
- [ ] Reset to test case button resets inputs
- [ ] Copy payload button copies JSON payload for direct API use
- [ ] After submission, "Technical details — last request payload" collapsible section visible
- [ ] BatchHeaderPanel visible below graph (calls legacy-api — may show error if V1 stopped, expected)
- [ ] RiskSignalsPanel is NOT rendered (excluded — adapter not yet wired, mock-only)
- [ ] No "implementation pending (Phase 3+)" text anywhere on page
- [ ] No mock graph data on empty/error

**Known gaps:**
- BatchHeaderPanel calls V1 legacy-api for batch header data — may show 503 if V1 apps stopped (expected, not a defect)
- RiskSignalsPanel intentionally excluded — will be added when databricks-api adapter override exists for getRiskSignals
- OverviewView (other views in TraceInvestigationWorkspace) still contain mock-backed panels — only `trace-tree` view is verified clean

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [x] **PASSED** | 2026-05-18 | Source: `gold_batch_lineage`. Execution: `databricks-api`. Query: `trace2.get_trace_graph`. Depth reached: 1. Truncated: No. Same data confirmed on both `?workspace=trace-graph-verify` (C14) and `?workspace=traceability-workspace&view=trace-tree` (C15). No mock fallback. |

---

## Verification Sequence

1. Complete `trace-native-column-verification-checklist.md`
2. Implement and wire routes (following POH dual-mode pattern)
3. Deploy to UAT
4. Run Check T1 → if passed, proceed to Check T2
5. Run Check T2 → if passed, document `getTraceGraph` as browser-verified
6. Run Check T2-UI (verify page) — primary trace investigation screen
7. Run Check T2-Shell (final workspace route) — confirms shell integration
8. Run Check T3 when wired
9. Update `docs/audit/adapter-source-status-matrix.md` after each pass

Do not mark any check as passed unless manually tested in Databricks Apps UAT.  
Do not claim browser verification for V1 legacy-api path — only for native Databricks routes.
