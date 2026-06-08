# UAT Remediation Backlog

Every item is tied to direct evidence in [`docs/deployment/uat-evidence-ledger.md`](../deployment/uat-evidence-ledger.md).
No generic backlog noise. Items are ordered by priority within each domain.

**Priority taxonomy**
- **P0** — blocks route/screen verification (route currently fails).
- **P1** — blocks credible UAT use (works, but message/scope is misleading).
- **P2** — product hardening (would improve trust/observability).
- **P3** — future parity (out of current tranche scope).

**Owner taxonomy**
- **Claude** — UAT/debug required (live Databricks access, browser, DDL probes).
- **Gemini** — UI/product hardening that's safe without UAT access.
- **Codex** — isolated backend/docs/test work that's safe without UAT access.

---

## Warehouse360

### P0 — WH-001 — Rewrite `get_inbound` adapter for actual `wh360_inbound_v` schema

- **Evidence:** UAT inbound returns HTTP 502 with `[UNRESOLVED_COLUMN.WITH_SUGGESTION] WAREHOUSE_NUMBER cannot be resolved`. Direct `DESCRIBE TABLE` (2026-05-18) shows 19 columns: `po_id, po_item, doc_type, doc_cat, vendor_id, vendor_name, plant_id, storage_loc, material_id, material_name, ordered_qty, gr_qty, uom, delivery_date, po_date, delivery_complete, open_qty, qa_lot_id, qa_status`. There is **no warehouse column at all**.
- **Likely cause:** Adapter was written against a different (probably hypothetical) inbound schema that included `WAREHOUSE_NUMBER`, `PURCHASE_ORDER_ID`, `STOCK_TRANSPORT_ORDER_ID`, etc. The actual UAT view is a flat PO-tracking view, plant-filtered only.
- **Recommended fix:** Rewrite `get_warehouse_inbound_spec` SELECT clause to use real columns (`po_id`, `po_item`, `doc_type`, `vendor_id`, `material_id`, `ordered_qty`, `gr_qty`, `open_qty`, `delivery_date`, `po_date`, `qa_lot_id`, `qa_status`). Drop `warehouse_id` filter — view does not track warehouse. Rewrite `map_warehouse_inbound_rows` to match the actual fields. Update API contract to remove `warehouse_number` from the response. Adjust UI cockpit to either drop the warehouse filter on this list or warn that inbound is plant-only.
- **UAT access required:** Yes (verify column values after rewrite).
- **Owner:** Claude.

### P0 — WH-002 — Rewrite `get_outbound` adapter for actual `wh360_deliveries_v` schema

- **Evidence:** UAT outbound returns HTTP 502 (`WAREHOUSE_NUMBER` not found). `DESCRIBE TABLE` shows 20 columns: `delivery_id, delivery_type, plant_id, customer_id, customer_name, carrier, lgnum, planned_gi_date, actual_gi_date, loading_date, delivery_date, gross_weight, weight_uom, packages, wm_status, mins_to_cutoff, pick_pct, line_count, risk, shipped`.
- **Likely cause:** Adapter expects `WAREHOUSE_NUMBER`, `PLANNED_GOODS_ISSUE_DATE`, `ACTUAL_GOODS_ISSUE_DATE`, `DELIVERY_ITEM_ID`, `SALES_ORDER_ID`, `MATERIAL_ID`, `STORAGE_LOCATION`, `STATUS`, `EXCEPTION_REASON`. Actual view uses `lgnum` for warehouse (commented "Warehouse Number / Warehouse Complex") and totally different column set.
- **Recommended fix:** Rewrite `get_warehouse_outbound_spec` SELECT clause. Use `lgnum` as warehouse filter column. Drop `material_id`, `storage_location`, `delivery_item_id`, `sales_order_id` from contract (or join from another view if available). Replace `planned_goods_issue_date` → `planned_gi_date`, etc. Rewrite `map_warehouse_outbound_rows`. Update contract.
- **UAT access required:** Yes.
- **Owner:** Claude.

### P0 — WH-003 — Identify replacement for non-existent `staging_orders_v`

- **Evidence:** `SHOW TABLES IN connected_plant_uat.wh360 LIKE 'staging*'` returns 0 rows. View does not exist.
- **Candidate replacement:** `wh360_process_orders_v` exists in the same schema but its DDL has not yet been probed. Could plausibly be the staging-equivalent.
- **Recommended fix:** Run `DESCRIBE TABLE connected_plant_uat.wh360.wh360_process_orders_v`. If it has the required staging fields (process_order_id, material_id, planned/required dates, quantities), rewrite `get_warehouse_staging_spec` to point at it and update mapper. Otherwise, record route as permanently blocked until a staging view is delivered.
- **UAT access required:** Yes.
- **Owner:** Claude.

### P0 — WH-004 — Fix exceptions view name + rewrite schema

- **Evidence:** `wh360_imwm_exceptions_v` does not exist. `imwm_exceptions_v` (without prefix) exists with 13 columns: `exception_type, severity (int), sla_hours, material_id, material_name, plant_id, storage_loc, storage_loc_name, qty, batch_id, bin_id, detail_text, detected_date`.
- **Likely cause:** Hypothetical view name and schema in adapter. Real view is much simpler.
- **Recommended fix:** Update `object_resolver` mapping or adapter to reference `imwm_exceptions_v`. Rewrite SELECT clause for real columns. `severity` is `int` (not string — drop the string severity mapper). Drop `WAREHOUSE_NUMBER` filter (no warehouse column). Drop `EXPIRY_DATE / DAYS_TO_EXPIRY / DOCUMENT_ID / PROCESS_ORDER_ID / DELIVERY_ID / PURCHASE_ORDER_ID / REASON / RECOMMENDED_REVIEW_ACTION` (none exist). Update contract.
- **UAT access required:** Yes.
- **Owner:** Claude.

### P1 — WH-005 — Correct UI/docs: overview is global, not warehouse-filtered

- **Evidence:** `wh360_kpi_snapshot_v` is a single-row global view. The adapter has `params={}` and no `WHERE`. The `warehouse_id` parameter in the URL is ignored. UI shows the same numbers for any warehouse_id input.
- **Recommended fix:** UI copy on the cockpit: "Overview KPI snapshot is a global/site-level snapshot, not filtered by warehouse." Remove or grey-out the `warehouse_id` from the overview-only call, or annotate it as not applied. Update `warehouse360-native-browser-verification.md` to make this explicit.
- **UAT access required:** No (copy change).
- **Owner:** Gemini.

---

## Trace

### P2 — TR-001 — Other Trace tabs still use mock context

- **Evidence:** Only the `trace-tree` view is wired to native `get_trace_graph`. `overview`, `mass-balance`, `customer-exposure`, `supplier-exposure`, `timeline-events`, `recall-readiness` still use mock data from `trace2-mock-data`.
- **Recommended fix:** Either label these views as "mock/demo only" with a banner, or implement native fetches per view. Out of scope for current tranche.
- **UAT access required:** Yes for native; No for labels.
- **Owner:** Claude (native) or Gemini (labels).

### P3 — TR-002 — `RiskSignalsPanel` adapter method not wired

- **Evidence:** `trace-tree-view.tsx` deliberately omits `RiskSignalsPanel` because `getRiskSignals` returns mock regardless of `batchId`. Documented in the file's `@remarks`.
- **Recommended fix:** Implement `getRiskSignals` for `databricks-api` mode. Out of scope for this tranche.
- **UAT access required:** Yes.
- **Owner:** Claude.

---

## EnvMon

### P3 — EM-001 — Floorplan / L4 zoning / heatmap not in scope

- **Evidence:** g.txt §4 and h.txt §4 explicitly mark these as deferred. Current native monitoring screen has none of them. Confirmed honest scope.
- **Recommended fix:** None — out of scope.
- **Owner:** n/a.

---

## Process Order History

### P1 — POH-001 — Browser-verify HTTP/UI layer

- **Evidence:** SQL verified directly by Claude for all 4 routes against `vw_gold_process_order`, `vw_gold_process_order_phase`, `vw_gold_confirmation`, `vw_gold_adp_movement`. Real data found (e.g. order 7006965039 with 13 ops, 15 confirmations). HTTP/UI not yet browser-tested in current session — user said "look at later".
- **Recommended fix:** Run the 4 fetches and tab-walk `?workspace=process-order-review` to confirm: default view is `order-history`, form visible, real UAT order can run, panels render, no write-back.
- **UAT access required:** Yes.
- **Owner:** Claude (next session).

### P1 — POH-002 — Verify `dateFrom/dateTo/limit` controls are applied (or label as planned)

- **Evidence:** h.txt §6 explicitly calls this out. Status unknown until UI is walked.
- **Recommended fix:** Either wire the controls to the request payload, or label them "planned/diagnostic only" so users do not believe they filter data. Quick UI inspection will tell which is needed.
- **UAT access required:** No (code-level read).
- **Owner:** Gemini or Codex.

### P2 — POH-003 — h.txt test order plant value was wrong

- **Evidence:** h.txt §6 says `7006965038 / IE10`. Actual UAT data shows the order's plant is `C113`. Test scripts/docs that assume `IE10` will fail or return empty.
- **Recommended fix:** Update example fixtures and any test scripts that hard-code `IE10` for this order. Annotate the example with the actual plant.
- **UAT access required:** No.
- **Owner:** Codex.

---

## SPC

### P3 — SPC-001 — UI tab-walk verification

- **Evidence:** Code-level confirms `SPCSandboxBanner` rendered in all 6 view files. UI tab-walk not yet performed.
- **Recommended fix:** Once-over the 6 tabs in browser to confirm the banner is visually prominent on each. Low priority because the code is conclusive.
- **UAT access required:** Yes (browser only — no DDL).
- **Owner:** Claude or user.

### Out of scope — SPC native build

- Explicitly excluded by non-negotiables. Do not start in this or the next tranche.

---

## Cross-cutting

### P2 — XC-001 — `databricks bundle deploy` does not force-restart the app

- **Evidence:** During this tranche, `databricks bundle deploy --target uat` succeeded but the running container kept serving the previous snapshot. A `databricks apps stop && databricks apps start` was required to pick up new files.
- **Fix landed this tranche:** Added `npm run deploy:databricks` (and `--deploy` flag to `prepare-databricks-app.mjs`) which chains build + bundle deploy + stop + start (commits `7f572d9`).
- **Status:** Resolved.

### P2 — XC-002 — Hidden SQL errors made WH360 debugging slow

- **Evidence:** Pre-fix, the FastAPI route returned `{"detail":"Databricks query execution failed"}` with the actual SQL exception (`UNRESOLVED_COLUMN` etc.) hidden in `exc.detail` but never logged. UAT diagnostics were stuck until logging was added.
- **Fix landed this tranche:** `routes/_databricks.py` now logs `query_name` and `detail` at ERROR level for `DatabricksQueryError`. Client response stays generic. Commit `491c6a6`.
- **Status:** Resolved.

---

## Summary

| Priority | Count | Domains |
|---|---|---|
| **P0** | 4 | All Warehouse360 list routes |
| **P1** | 4 | WH360 overview wording, POH HTTP/UI BV, POH date controls clarity, POH plant fixture |
| **P2** | 2 | Trace other-tabs labelling, SPC visual sweep (+ 2 already resolved this tranche) |
| **P3** | 2 | Trace risk-signals native, EnvMon floorplan |

**Next tranche recommendation (evidence-based):**
- Top priority: **Warehouse360 schema-alignment tranche** — rewrite 4 adapters (WH-001..004) against the real `wh360_inbound_v` / `wh360_deliveries_v` / `wh360_process_orders_v` / `imwm_exceptions_v` views. This is broad enough to need its own tranche — not "small fix" territory.
- Second priority: **POH HTTP/UI BV closure** — quick browser pass to confirm what's already SQL-validated.
- Third: copy-only fixes (WH-005, POH-002, TR-001 labels).
