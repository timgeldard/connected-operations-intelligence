# POH Parity Remediation Backlog

**Date:** 2026-05-16
**Scope:** Process Order Review (`di-operations`) + Operations Plan Risk
**Reference:** `docs/migration/poh-functional-parity-matrix.md`

---

## Group A — Must Fix for Functional Parity

### A1. Browser-verify `getProcessOrderHeader` against V1

- **User impact:** Process order header KPIs drive release decisions and production tracking. An unverified field mapping may silently show wrong quantities or dates.
- **Current problem:** `ProcessOrderReviewLegacyApiAdapter.getProcessOrderHeader()` calls `POST /por/order-header` and maps snake_case V1 fields. Mapping written from field name assumptions — not browser-verified against live V1.
- **Proposed fix:** Browser-verify for at least one plant and order. Confirm `process_order_id`, `material_id`, `planned_qty`, `confirmed_qty`, `planned_start`, `planned_end`, `order_status` map correctly to V2 camelCase schema. Fix any mismatches.
- **Source/data dependency:** V1 `/por/order-header` endpoint live
- **Effort:** 0.5 day (verification + any field name fix)
- **Priority:** Critical

---

### A2. Wire `getOrderOperations()` to V1 endpoint

- **User impact:** Operations/phases are the core of order execution tracking. Without real data, operators cannot see which phase is currently running or how long each phase took.
- **Current problem:** `getOrderOperations()` returns 8 mock operations. Phase completion and duration actuals are fixtures.
- **Original V1 source:** `GET /por/order-phases?order_id=...` → `vw_gold_process_order_phase` (AFPO)
- **V1 fields to map:** `phase_number` → `operationNumber`, `phase_desc` → `operationText`, `work_centre` → `workCentre`, `plan_start`, `plan_end`, `actual_start`, `actual_end`, `plan_duration_min`, `actual_duration_min`, `status_code` → `status`
- **Implementation risk:** Low — schema covers expected V1 fields
- **Effort:** 2–3 days (proxy route + adapter override + tests + verification)
- **Priority:** High

---

### A3. Wire `getOrderConfirmations()` to V1 endpoint

- **User impact:** Confirmations are the operator's record of what was actually produced — yield, scrap, and process durations. Mock confirmations are misleading for quality review.
- **Current problem:** `getOrderConfirmations()` returns 7 mock confirmations. Yield, scrap, and variance values are fixtures.
- **Original V1 source:** `GET /por/confirmations?order_id=...` → `vw_gold_confirmation` (AFVC/AFVV)
- **V1 fields to map:** `conf_yield`, `scrap_qty`, `rework_qty`, `setup_dur_min`, `machine_dur_min`, `clean_dur_min`, `confirmed_by`, `conf_timestamp`, `is_final`
- **Implementation risk:** Medium — confirmation schemas in V1 vary by plant; some fields may be null for older confirmations
- **Effort:** 3–4 days
- **Priority:** High

---

### A4. Wire `getOrderGoodsMovements()` to V1 endpoint

- **User impact:** Goods movements are the audit trail for what materials went into and came out of the order. Mock movements show wrong materials and quantities.
- **Current problem:** `getOrderGoodsMovements()` returns 4 mock movements. All are IE10 Emmental fixtures.
- **Original V1 source:** `GET /por/goods-movements?order_id=...` → `vw_gold_adp_movement` (MSEG) — types 101 (GR) and 261 (GI)
- **V1 fields to map:** `movement_type` → both movementType and direction, `material_id`, `material_desc`, `batch_id`, `movement_qty`, `movement_uom`, `posting_date`, `posting_user`, `reference_doc`, `storage_location`
- **Implementation risk:** Low — direction mapping from SAP type codes is deterministic
- **Effort:** 2–3 days
- **Priority:** High

---

## Group B — Should Fix for Credible Pilot/Demo

### B1. Add order search / selection surface

- **User impact:** Users need to find orders by process order ID, batch, material, plant, or date range. Without a search surface the workspace can only be opened via direct URL or drill-through from another workspace.
- **Current problem:** No `ProcessOrderListPanel` or order search adapter method exists. The workspace requires `processOrderId` injected via scope context.
- **Proposed fix:** Add `ProcessOrderSearchAdapter.getOrderList()` method. Create `ProcessOrderListPanel` showing recent/open orders. Add an order-selection view to the workspace.
- **Source/data dependency:** V1 `GET /por/orders` → `vw_gold_order_summary`
- **Effort:** 4–5 days (search state management, list panel, pagination)
- **Priority:** Medium

---

### B2. Add inspection characteristic results panel

- **User impact:** Quality reviewers need to see individual inspection results — which characteristics passed, which failed, and the measured values — not just the pass/fail summary.
- **Current problem:** `OrderQualityContextPanel` shows inspection lot ID, usage decision, and SPC signal count. No characteristic-level results panel.
- **Proposed fix:** Add `InspectionCharacteristic` schema. Add `getInspectionResults()` method. Create `InspectionResultsPanel`.
- **Source/data dependency:** V1 `GET /por/inspection-results?lot_id=...` → `vw_gold_inspection_result`
- **Effort:** 3–4 days
- **Priority:** Medium

---

### B3. Add operator notes / shift comments panel

- **User impact:** Operators and shift managers leave notes on each order for handover and incident tracking. Without notes, the execution timeline is missing narrative context.
- **Current problem:** No notes panel, no adapter method, no schema for notes.
- **Proposed fix:** Add `OrderNote` schema. Add `getOrderNotes()` method. Create `OrderNotesPanel`.
- **Source/data dependency:** V1 `GET /por/notes?order_id=...` → `vw_gold_logs_notes_and_comments`
- **Effort:** 2–3 days
- **Priority:** Medium

---

### B4. Add per-order downtime events panel

- **User impact:** Downtime events explain yield losses and duration overruns visible in the execution timeline. Without downtime context the deviation and variance data has no cause.
- **Current problem:** Downtime is captured at plan level in OPR workspace but not per order in Process Order Review.
- **Proposed fix:** Add `OrderDowntimeEvent` schema. Add `getOrderDowntimeEvents()` method. Create `OrderDowntimePanel`. Add to `execution-timeline-view`.
- **Source/data dependency:** V1 `GET /por/downtime?order_id=...` → `vw_gold_downtime_and_issues`
- **Effort:** 2–3 days
- **Priority:** Medium

---

## Group C — Backlog / Later

### C1. Planning board view

- **User impact:** Production planners need a weekly view of orders by line to confirm capacity allocation and expected completion.
- **Proposed fix:** New workspace or view showing orders by line/week. Requires plan-level adapter, not per-order.
- **Effort:** 5–7 days
- **Priority:** Low

### C2. Lineside monitor view

- **User impact:** Operators at the line need a simplified current-order view with the active operation, expected finish, and staging status.
- **Proposed fix:** New view in Process Order Review workspace for operator role. Filtered to current order and operation.
- **Effort:** 3–4 days
- **Priority:** Low

### C3. Equipment history per order

- **User impact:** Maintenance teams need to correlate downtime and maintenance work orders with production orders.
- **Source/data dependency:** V1 `vw_gold_equipment_history`
- **Effort:** 2–3 days
- **Priority:** Low

---

## Constraint Reminder

> All new adapter methods must return `AdapterResult<T>` using the `ok()` helper. No direct `fetch()` calls in panels. New schemas added to `@connectio/data-contracts`. No speculative FastAPI routes — route only added when V1 endpoint field names are confirmed.
