# UAT Smoke-Test Checklist — ConnectIO V2

**Environment:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`
**Last updated:** 2026-05-18 (g.txt + h.txt + i.txt sweep, commit `491c6a6`)

> **Authoritative status: see [`uat-evidence-ledger.md`](./uat-evidence-ledger.md)** and remediation in [`uat-remediation-backlog.md`](../migration/uat-remediation-backlog.md).
> This checklist remains the historical log of each f.txt → i.txt tranche.

---

## g.txt + h.txt + i.txt sweep (2026-05-18, commit `491c6a6`)

| Domain | API BV | UI BV | Notes |
|---|---|---|---|
| Trace `trace-graph` (C16) | ✅ PASSED | ✅ PASSED | 7 nodes/edges, depth=1. UI layout fixed (`55171f3`, `518d9bb`) — graph now fills full width. |
| EnvMon `site-summary` (C17) | ✅ PASSED | ✅ PASSED | 12-key payload, complianceRate=0 truthful empty. |
| EnvMon `swab-results` (C17) | ✅ PASSED | ✅ PASSED | 0 rows truthful empty. |
| WH360 `overview` (C18) | ✅ PASSED | — | 12-key global KPI snapshot (no warehouse filter — P1 copy fix WH-005). |
| WH360 `inbound` (C19) | ❌ schema-blocked | — | View `wh360_inbound_v` has no warehouse col; entire schema is PO-tracking. P0 WH-001. |
| WH360 `outbound` (C20) | ❌ schema-blocked | — | View uses `lgnum` for warehouse + different col names (`planned_gi_date` etc.). P0 WH-002. |
| WH360 `staging` (C21) | ❌ source-blocked | — | `staging_orders_v` does not exist. Candidate replacement: `wh360_process_orders_v`. P0 WH-003. |
| WH360 `exceptions` (C22) | ❌ source-blocked | — | Actual view name is `imwm_exceptions_v`, schema also different. P0 WH-004. |
| POH `order-header` (C23) | ✅ SQL OK | ⏳ pending user | Order 7006965038 plant is C113, not IE10 (h.txt brief was wrong). |
| POH `order-operations` (C24) | ✅ SQL OK | ⏳ pending user | 11–13 rows on real orders. |
| POH `order-confirmations` (C25) | ✅ SQL OK | ⏳ pending user | View has 1,711 total rows, 15 visible for order 7006965039. |
| POH `order-goods-movements` (C26) | ✅ SQL OK | ⏳ pending user | View has 5,933 total rows, 901 for order 7006965479 (MOVEMENT_TYPE=261). |
| SPC banner (C27) | n/a | ⏳ pending tab-walk | Code: `SPCSandboxBanner` rendered in all 6 view files. |

**Tranche fixes landed (small, evidence-driven):**
- `b6813b3` — rebuilt static assets to include PR #18 SPC banner + PR #19 POH changes.
- `55171f3` — hide action sidebar on `trace-tree` view.
- `518d9bb` — `gridColumn: '1 / -1'` on `TraceTreeView` outer div.
- `7f572d9` — `npm run deploy:databricks` with force restart (bundle deploy alone was not restarting the app).
- `491c6a6` — server-side log of actual `DatabricksQueryError.detail` so future UAT diagnostics surface the real SQL error.

---

---

## f.txt Pre-flight baseline (2026-05-18)

**Commit tested:** `0b9d86895dd0ad0e68e02cf56ba2553c5c36e9a1` (Merge PR #16 — EnvMon scope seeding fix)

**Local tests run before UAT:**
```
npm exec nx -- run-many -t test --all --passWithNoTests   → 12 projects, all PASS
cd apps/api && python -m pytest tests/ -x -q              → 682 passed
```

**Deployment config verified from `app.yaml`:**
- `BACKEND_ADAPTER_MODE=databricks-api` ✓
- `DATABRICKS_HOST=https://adb-604667594731808.8.azuredatabricks.net` ✓
- `SQL_WAREHOUSE_ID=e76480b94bea6ed5` ✓
- `TRACE_CATALOG=connected_plant_uat`, `TRACE_SCHEMA=gold` ✓
- `POH_CATALOG=connected_plant_uat`, `CQ_CATALOG=connected_plant_uat` ✓
- `WH360_CATALOG` — **NOT SET** — all 5 WH360 routes will return 503 until configured
- `WH360_SCHEMA` — **NOT SET** — defaults to `"wh360"` in object_resolver.py
- `user_api_scopes: [sql]` ✓ — no SPN/PAT config ✓

**Pre-flight findings:**
- SPC: `SPCSandboxBanner` was absent from 4 of 6 view tabs (active-signals, capability, alarm-history, chart-configuration-readonly). Fixed pre-UAT based on code audit — UAT to confirm by tab-walking each view.
- Trace: WITH RECURSIVE implementation merged on main — prior BV (C12–C15) was against iterative approach; fresh verification required.
- WH360: Config-blocked — `WH360_CATALOG` unknown from available sources. Cannot be derived from `databricks.yml`, `app.yaml`, or docs. User must supply the UAT catalog name before WH360 routes can be tested.

---

## Section A — Deployment smoke test (PASSED 2026-05-17)

These tests confirm the app deploys, starts, and serves its static UI. No data connectivity is required.

- [x] `databricks apps get connectio-v2` shows `state: RUNNING`
- [x] Root URL loads (`https://connectio-v2-604667594731808.8.azure.databricksapps.com`)
- [x] React shell renders (workspace navigation visible)
- [x] Static assets load (JS, CSS, fonts — no 404s in browser network tab)
- [ ] `/health` responds `{"status": "ok"}` — **not yet manually confirmed** (endpoint exists in code; confirm in browser)

---

## Section B — Legacy-api smoke test (PENDING — blocked by V1 apps STOPPED)

These tests confirm the V2 → V1 proxy path works end-to-end. Requires V1 Databricks Apps to be running.

**Prerequisite:** Start the V1 apps. Contact the V1 team or restart via:
```bash
databricks apps start trace2          # or whichever app name applies
databricks apps start connectedquality
databricks apps start poh
databricks apps start wh360
```

Once V1 apps are running, verify each route in sequence.

### B1 — Trace2 batch header

```bash
curl -s -X POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/batch-header \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"material_id": "<known-id>", "batch_id": "<known-id>"}' | jq .
```

- [ ] Returns HTTP 200 with data (not mock, not 503)
- [ ] `source` field in response is `legacy-api`
- [ ] No 502 (would indicate firewall/private-link issue between Apps network and V1)

### B2 — CQ lab plants

```bash
curl -s https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/cq/lab/plants \
  -H "Cookie: <auth-cookie-from-browser>" | jq .
```

- [ ] Returns HTTP 200 with plant list
- [ ] `source` field is `legacy-api`

### B3 — POH order header

```bash
curl -s -X POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-header \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"process_order_id": "<known-id>"}' | jq .
```

- [ ] Returns HTTP 200 with order header
- [ ] `source` field is `legacy-api`

### B4 — Expected failures while V1 STOPPED

While V1 apps are STOPPED, all routes above should return:
- HTTP 503 with `{"detail": "..."}` — not a V2 defect, expected behaviour

| Route | HTTP status while V1 stopped | Notes |
|---|---|---|
| `POST /api/trace2/batch-header` | Expected 503 | |
| `GET /api/cq/lab/plants` | Expected 503 | |
| `POST /api/por/order-header` | Expected 503 | |
| `POST /api/wh360/warehouse-summary` | Expected 503 | |

---

## Section C — Native Databricks smoke test (ACTIVE — browser verification pending)

These tests confirm V2 can query Databricks directly using end-user OAuth.

**Current state (2026-05-17):**
- `BACKEND_ADAPTER_MODE=databricks-api` — native reads active for CQ lab plants and POH order header
- `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, `POH_CATALOG`, `CQ_CATALOG` set as literals in `app.yaml`
- `sql` OAuth scope added to app (`effective_user_api_scopes: ["sql", "iam.current-user:read", "iam.access-control:read"]`)
- All SQL column names confirmed from live DDL (connected_plant_uat, 2026-05-17)
- CLI-based curl tests cannot verify end-to-end — CLI tokens bypass the Databricks Apps OAuth consent flow and don't carry the `sql` scope. **Browser testing required.**

### C1 — Prerequisites (COMPLETE)

- [x] `BACKEND_ADAPTER_MODE=databricks-api` set in `app.yaml`
- [x] `DATABRICKS_HOST` set to `https://adb-604667594731808.8.azuredatabricks.net`
- [x] `SQL_WAREHOUSE_ID` set to `e76480b94bea6ed5`
- [x] `POH_CATALOG` and `CQ_CATALOG` set to `connected_plant_uat`
- [x] `sql` OAuth scope in `effective_user_api_scopes`
- [x] App service principal has READ on `connectio-v2` secret scope
- [x] App deployed and `state: RUNNING`

### C2 — OAuth header verification (CONFIRMED 2026-05-17)

- [x] `token_present: true` — `x-forwarded-access-token` is being injected
- [x] `user_header_present: true` — `x-forwarded-user` is being injected
- [x] `email_header_present: true` — `x-forwarded-email` is being injected
- [x] `token_length_bucket: "long"` — token is a real OAuth JWT
- [x] `gap-auth` response header confirms authenticated user identity
- [x] `ENABLE_AUTH_DIAGNOSTICS` removed from `app.yaml` (disabled 2026-05-17)

### C3 — CQ lab plants (native Databricks) ✓ PASSED 2026-05-17

```
GET /api/cq/lab/plants
```

- [x] Returns HTTP 200 with plant list
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Adapter-Mode: databricks-api` present
- [x] No SPN/PAT token used — query executes as the end user's identity

### C4 — POH order header (native Databricks) ✓ PASSED 2026-05-17

Tested with process order `7006965038` (plant C113, MIXED BERRY FLV LQD 70373871, status: closed).

```
POST /api/por/order-header
{"process_order_id": "7006965038"}
```

- [x] Returns HTTP 200 with order data
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_process_order_header` present
- [x] Fields not in the view (`plannedQuantity`, `confirmedQuantity`, `uom`, dates) return zero/empty defaults — expected, by design

### C5 — Auth failure cases ✓ PASSED 2026-05-17

- [x] Without auth (no cookie / expired session): returns HTTP 401 — Databricks Apps gateway rejects before reaching FastAPI
- [x] Confirmed no 200 with mock data when token is absent

### C6 — No SPN/PAT fallback ✓ PASSED 2026-05-17

- [x] `databricks apps logs connectio-v2` — zero entries containing `service_principal`, `client_secret`, or `DATABRICKS_TOKEN`
- [x] `X-Data-Source` header confirmed `databricks-api` on C3 and C4

---

### C7 — POH order operations (native Databricks) ✓ PASSED 2026-05-17

`GET /api/por/order-operations?process_order_id=7006965038`

- [x] Returns HTTP 200 with array — 11 operations returned for PO 7006965038
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_order_operations` present
- [x] `operationId`, `operationNumber`, `operationText` are strings
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/poh-native-slices-browser-verification.md` for full checklist and troubleshooting.

---

### C8 — POH order confirmations (native Databricks) ✓ PASSED 2026-05-18

`GET /api/por/order-confirmations?process_order_id=7006967130`

**Status: BROWSER-VERIFIED** — HTTP 200, 2.6s, 2 confirmations. `confirmationId=100001669`, `confirmedYield=646.88 KG`. `X-Query-Name: poh.get_order_confirmations`. No SPN/PAT token used.

- [x] Returns HTTP 200 with JSON array
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_order_confirmations` present
- [x] Each item has `confirmationId`, `operationId`, `confirmedYield`, `uom`, `confirmedAt`
- [x] `operationText` and `isFinalConfirmation` absent — not in `vw_gold_confirmation` by design
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/poh-native-slices-browser-verification.md` for full pass criteria and troubleshooting.

---

### C9 — POH goods movements (native Databricks) ✓ PASSED 2026-05-18

`GET /api/por/order-goods-movements?process_order_id=7006965479`

**Status: BROWSER-VERIFIED** — HTTP 200, 1.6s, 901 movements. `direction=input` confirmed for MOVEMENT_TYPE=261. `X-Query-Name: poh.get_order_goods_movements`. No SPN/PAT token used.

- [x] Returns HTTP 200 with JSON array
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_order_goods_movements` present
- [x] All `direction` values are `"input"`, `"output"`, or `"unknown"` — never null
- [x] `materialDescription` absent — no material master join in `vw_gold_adp_movement` by design
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/poh-native-slices-browser-verification.md` for full pass criteria and troubleshooting.

---

### C10 — EnvMon site summary (native Databricks) ✓ PASSED 2026-05-18

`GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18`

**Status: BROWSER-VERIFIED** — HTTP 200, all 12 schema keys present, `gap-auth: tim.geldard@kerry.com` confirms end-user identity.

Actual response (C061, 2026-01-01 → 2026-05-18):
```json
{"plantId":"C061","plantName":"","zonesMonitored":0,"zonesWithAlerts":0,"positiveCount":0,"positiveRate":0.0,"openCorrectiveActions":0,"overdueActions":0,"complianceRate":0.0,"riskStatus":"unknown","highestSeverity":"low","confidence":0.0}
```

- [x] Returns HTTP 200 with JSON object
- [x] All 12 EnvMonSiteSummarySchema keys present
- [x] `plantName` is `""` — placeholder by design
- [x] `openCorrectiveActions` / `overdueActions` are `0` — contract compat by design
- [x] `riskStatus: "unknown"` — valid enum value
- [x] `highestSeverity: "low"` with `positiveCount: 0` — consistent (inspection lots with low-severity classifications exist; none rate as positives)
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/envmon-native-browser-verification.md` for full pass criteria and troubleshooting.

---

### C11 — EnvMon swab results (native Databricks) ✓ PASSED 2026-05-18

`GET /api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18&limit=100`

**Status: BROWSER-VERIFIED** — HTTP 200 confirmed. Route wired (p.txt, 2026-05-17), DDL confirmed for same three Group A SAP QM views as site-summary, 56 new adapter + route tests passing.

- [x] Returns HTTP 200
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/envmon-native-browser-verification.md` (swab-results section) for full pass criteria and troubleshooting.

---

### C11a — EnvMon read-only monitoring UI (native Databricks) ✓ PASSED 2026-05-18

**Status: BROWSER-VERIFIED 2026-05-18** — real data returned via `/api/envmon/site-summary` and `/api/envmon/swab-results`. Routing fix (f.txt) corrected default view from mock `scope-overview` to `native-monitoring`. Numeric schema widening deployed — Databricks DECIMAL/FLOAT fields now accepted as strings.

Primary URL:
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=envmon-monitoring
```

Test values: `plant_id=C061`, `period_start=2026-01-01`, `period_end=2026-05-18`, `limit=100`.

- [x] Inputs visible: plant ID, period start, period end, limit, Run / Refresh, Reset
- [x] Site Summary renders from `/api/envmon/site-summary` or shows honest empty/error
- [x] Swab Results Table renders from `/api/envmon/swab-results` or shows honest empty/error
- [x] Result Detail renders after selecting a row
- [x] Derived Indicators render from returned swab rows only
- [x] Source and Limitations banner visible
- [x] CAPA is stated as out of scope, not implemented
- [x] Spatial/floorplan/zoning/heatmap is stated as deferred, not implemented
- [x] No mock heatmap, mock CAPA, or mock alert workflow appears on the primary path

---

### C12 — Trace graph (native Databricks, multi-hop) ✓ PASSED 2026-05-18

```http
POST /api/trace2/trace-graph
Content-Type: application/json

{
  "material_id": "20052009",
  "batch_id": "0008602411",
  "plant_id": "C061",
  "direction": "both",
  "max_depth": 2,
  "max_edges": 100
}
```

**Status: BROWSER-VERIFIED** — HTTP 200, `ok: true`. UC GRANT applied to `tim.geldard@kerry.com` on `connected_plant_uat.gold`. Route wired (q.txt, 2026-05-18), gold_batch_lineage DDL confirmed (18 columns), iterative multi-hop expansion, 47 new adapter + route tests (655 total).

- [x] Returns HTTP 200 with JSON object
- [x] No SPN/PAT token used — query executes as end-user identity
- [x] No mock or legacy-api fallback on Databricks error (returns 502/503/etc.)

See `docs/deployment/trace-native-browser-verification.md` (Check T2) for full pass criteria and troubleshooting.

---

### C13 — Trace Graph UI (frontend wiring) ✓ PASSED 2026-05-18

**Status: BROWSER-VERIFIED** — green `source: databricks-api` badge confirmed; nodes and edges rendered. Tested with `materialId=20052009` (stored key — leading zeros absent in `gold_batch_lineage`), `batchId=0008602411`, `plantId=C061`.

**Note on material ID:** The page default was `000000000020052009` (SAP ALPHA format) at time of BV. User edited to `20052009` (stored gold format) to get a populated graph. Default has since been corrected to `20052009`.

**Primary URL:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=trace-graph-verify
```

- [x] Page renders at `?workspace=trace-graph-verify` without crash
- [x] Input fields visible (Material ID, Batch ID, Plant ID)
- [x] Trace Graph panel renders after clicking Run Trace
- [x] `source: databricks-api` shown in panel source badge (green)
- [x] Nodes and edges visible for `materialId=20052009, batchId=0008602411`
- [ ] Node click shows material/batch details — not separately confirmed
- [ ] Edge click shows relationship type, quantity, document reference — not separately confirmed
- [ ] Direction toggle (Both / Upstream / Downstream) filters nodes — not separately confirmed
- [ ] Warnings banner for truncated/max-depth-reached — not separately confirmed
- [ ] `?workspace=traceability-workspace` shell integration — not separately confirmed

See `docs/deployment/trace-native-browser-verification.md` (Check T2-UI) for full pass criteria and troubleshooting.

---

### C14 — Complete Traceability Investigation Screen (c.txt + e.txt, 2026-05-18)

**Status: BROWSER-VERIFIED 2026-05-18** — Source: `gold_batch_lineage`, Execution: `databricks-api`, Query: `trace2.get_trace_graph`, Depth reached: 1, Truncated: No. No mock fallback confirmed.

**Primary URL:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=trace-graph-verify
```

Test anchor: `materialId=20052009`, `batchId=0008602411`, `plantId=C061`, `direction=both`, `maxDepth=2`, `maxEdges=100`

- [x] Direction dropdown (both/upstream/downstream) visible and wired to backend
- [x] Max depth dropdown (1/2/3/4) visible and wired to backend
- [x] Max edges dropdown (100/500/1000) visible and wired to backend
- [x] Investigation header shows materialId, batchId, plantId, node/edge count, depth, truncated, source
- [x] Source banner: `gold_batch_lineage`, `trace2.get_trace_graph`, depth=1, truncated=No
- [x] Real Databricks data returned — no mock fallback

---

---

### C15 — Final Traceability workspace route (native Databricks, d.txt + e.txt, 2026-05-18)

**Status: BROWSER-VERIFIED 2026-05-18** — TraceQueryForm embedded in TraceTreeView; `traceability-workspace` default view `trace-tree`. Same data as C14 confirmed: Source: `gold_batch_lineage`, Execution: `databricks-api`, Query: `trace2.get_trace_graph`, Depth reached: 1, Truncated: No.

**Primary URL:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=traceability-workspace&view=trace-tree
```

**Also verify bare URL (defaults to trace-tree):**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=traceability-workspace
```

- [x] Page loads at `?workspace=traceability-workspace` without crash
- [x] No "implementation pending (Phase 3+)" placeholder
- [x] Trace Investigation form visible with correct defaults
- [x] Click **Run Trace** → TraceGraphPanel renders with Databricks graph
- [x] `source: databricks-api` confirmed — same data as C14
- [x] No mock graph data on failure

See `docs/deployment/trace-native-browser-verification.md` (Check T2-Shell) for full pass criteria.

---

### C16 — Trace graph (WITH RECURSIVE, fresh BV) ✓ PASSED 2026-05-18

**Status: BROWSER-VERIFIED 2026-05-18** — WITH RECURSIVE implementation confirmed working. HTTP 200, 7 nodes, 7 edges, depthReached=1, no timeout.

Test anchor: `material_id=20052009`, `batch_id=0008602411`, `plant_id=C061`, `direction=both`, `max_depth=2`, `max_edges=100`

Actual response (fetch from UAT browser console, 2026-05-18):
- `x-data-source: view:gold_batch_lineage`
- `x-query-name: trace2.get_trace_graph`
- Anchor: `nodeKey=20052009:0008602411` (2-tuple format confirmed — no plant in key)
- 7 nodes: 1 anchor (directions: anchor+downstream+upstream), 1 downstream, 5 upstream
- 7 edges: all `linkType=PRODUCTION`, `movementType=261`, `postingDate=2024-08-27`
- `depthReached=1`, `truncated=false`, `warnings=[]`

- [x] Returns HTTP 200
- [x] `x-data-source: view:gold_batch_lineage` present
- [x] `x-query-name: trace2.get_trace_graph` present
- [x] Body has `anchor`, `nodes`, `edges`, `depthReached`, `truncated`, `warnings`
- [x] No mock data
- [x] No 504 timeout — WITH RECURSIVE avoids iterative round-trips

See `docs/deployment/trace-native-browser-verification.md` (T2 manual result table) for full evidence.

---

### C17–C21 — Warehouse360 native routes — PENDING RE-TEST

**Status: PENDING RE-TEST** — Config set, source views fixed, LIMIT fix deployed. Awaiting browser re-test after second deploy (2026-05-18).

**Config confirmed (2026-05-18):**
- `WH360_CATALOG=connected_plant_uat` set in `app.yaml` ✓
- `WH360_SCHEMA=wh360` (default — confirmed correct for UAT) ✓
- Known warehouse IDs: **104**, **105** ✓

**Source view fixes (2026-05-18):**
- Overview: `wh360_cockpit_summary_v` **does not exist** — replaced with `wh360_kpi_snapshot_v` (global single-row KPI snapshot, confirmed via DESCRIBE + SELECT). No WHERE clause (no warehouse_id column). 11-column SELECT: `orders_total, orders_red, orders_amber, trs_open, tos_open, deliveries_today, deliveries_at_risk, inbound_open, bins_blocked, bins_total, bin_util_pct`.
- `LIMIT :max_rows` **rejected by Databricks SQL** — all 4 list routes (inbound/outbound/staging/exceptions) returned HTTP 502 in first test. Fixed by embedding `LIMIT 1000` literal directly in SQL and removing `max_rows` from params dict.
- `connected_plant_uat.wh360.wh360_inbound_v` — **exists** ✓ (confirmed first test round)

**First test result (pre-LIMIT fix, 2026-05-18):**
- `GET /api/warehouse360/overview?warehouse_id=104` — **HTTP 200** ✓ (after source view fix)
- `GET /api/warehouse360/inbound?warehouse_id=104` — **HTTP 502** ✗ (LIMIT :max_rows rejected)
- `GET /api/warehouse360/outbound?warehouse_id=104` — **HTTP 502** ✗
- `GET /api/warehouse360/staging?warehouse_id=104` — **HTTP 502** ✗
- `GET /api/warehouse360/exceptions?warehouse_id=104` — **HTTP 502** ✗

Second deploy with LIMIT fix completed 2026-05-18. Re-test pending.

- [x] `WH360_CATALOG` set in `app.yaml`
- [x] `warehouse_id` known for UAT (104, 105)
- [x] Overview view name confirmed (`wh360_kpi_snapshot_v`)
- [x] `LIMIT :max_rows` fixed (literal `LIMIT 1000` embedded in SQL)
- [x] C17: Overview — **HTTP 200** ✓ (`wh360_kpi_snapshot_v`, LIMIT 1, no warehouse_id filter)
- [ ] C18: Inbound — **PENDING RE-TEST** (`wh360_inbound_v` exists, LIMIT 1000 fix deployed)
- [ ] C19: Outbound — **DDL-BLOCKED** (`wh360_deliveries_v` has no `WAREHOUSE_NUMBER` column — need `DESCRIBE TABLE` to find correct filter column)
- [ ] C20: Staging — **SOURCE-BLOCKED** (`staging_orders_v` does not exist in `connected_plant_uat.wh360` — need `SHOW VIEWS` to find alternative)
- [ ] C21: Exceptions — **SOURCE-BLOCKED** (`wh360_imwm_exceptions_v` does not exist in `connected_plant_uat.wh360` — need `SHOW VIEWS` to find alternative)
- [ ] `x-data-source: databricks-api` on each unblocked route

---

### C22 — SPC sandbox/demo labelling & Verification Status Banner

**Status: HARDENED & STANDARDIZED** — `VerificationStatusBanner` is integrated on the SPC chart-overview tab. `SPCSandboxBanner` remains present as a warning on all 6 tabs to ensure no view claims native Databricks or live production data.

**UAT: tab-walk each view tab at `?workspace=spc-monitoring` to confirm banner visibility.**

- [ ] `chart-overview` tab — `VerificationStatusBanner` renders at the top with `SANDBOX / MOCK DEMO` status, showing the 4 active mock routes and `spc_quality_metrics_v` source object.
- [ ] No view claims native Databricks or live production data.
- [ ] Charts load without crash (demo data).

---

### C23 — POH Cockpit View & Verification Status Banner

Verify that the dashboard view renders cleanly at `?workspace=process-order-review` with the new interactive `order-history` view as default.

**Primary URL:**
```text
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=process-order-review
```

- [ ] Page loads cleanly without crashing.
- [ ] `VerificationStatusBanner` is visible at the top with `EXECUTABLE PENDING BV` status. Clicking the banner expands the Specifications Drawer listing the 4 active routes and `vw_gold_` source objects.
- [ ] "Load Demo-Only Fixture" button replaces the generic "Load Demo Preset" label.
- [ ] Clicking "Load Demo-Only Fixture" successfully loads offline mock data and displays a warning banner stating: "Mock fixture selected — values are demo-only and are not known UAT data. Run against a real UAT process order before claiming browser verification."
- [ ] Typing a real UAT process order (e.g. `7006965038`) and plant (e.g. `IE10`), and clicking "Run / Refresh" loads live Databricks-sourced data.
- [ ] The "Max Rows Limit" and "Posting Date" inputs are grouped inside a dashed warning container labeled "⚠️ Diagnostic / planned filters — not applied by current native routes".
- [ ] Each of the 4 cards (Header Context, Operations, Confirmations, Goods Movements) renders a dynamic source status badge (e.g., `DATABRICKS-API` or `MOCK FIXTURE - NOT LIVE`) matching the exact query result source.
- [ ] In the event of a query failure, an explicit route error card (red border/background with error code and details) is rendered within that specific section instead of collapsing into a generic "no rows" empty state.
- [ ] Collapsible technical diagnostics displays the correct endpoints, query payloads, and explicit notes explaining that date/limit parameters are not currently passed to the backend.
- [ ] No SAP close or closing operations write-back buttons are present on the screen.

---

## Notes

- CQ Lab failures (`/api/cq/lab/fails`) is blocked pending `vw_gold_process_order_plan` availability — do not test until that view is confirmed in `connected_plant_uat`.
- `vw_gold_process_order_phase` DDL is confirmed (2026-05-17). No column-name blockers for order-operations route.
- `vw_gold_confirmation` DDL confirmed 2026-05-17 — confirmations route is implemented and executable.
- `vw_gold_adp_movement` DDL confirmed 2026-05-17 — goods movements route is implemented and executable.
- C12–C15 BV rows remain in the checklist for historical record but are superseded by C16 (WITH RECURSIVE fresh BV).
- All tests in this checklist require a human in the loop with valid Databricks workspace access. Do not attempt to automate against live Databricks in CI.
