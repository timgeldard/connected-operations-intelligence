# Warehouse Parity Remediation Backlog

**Date:** 2026-05-16
**Scope:** Warehouse 360 Overview (`di-warehouse`) + Production Staging
**Reference:** `docs/migration/warehouse-functional-parity-matrix.md`

---

## Group A — Must Fix for Functional Parity

### A1. Browser-verify `getWarehouse360Summary` against V1

- **User impact:** The warehouse summary KPIs are the first thing a warehouse manager sees. An unverified mapping may silently show wrong counts.
- **Current problem:** `Warehouse360LegacyApiAdapter.getWarehouse360Summary()` calls `POST /api/wh360/warehouse-summary` and maps V1 snake_case fields. The mapping is written from field name assumptions — not yet browser-verified against a live V1 instance.
- **Proposed fix:** Browser-verify against V1 for at least one plant. Confirm `total_stock_lines`, `hold_lines`, `qi_lines`, `open_gr`, `open_gi`, `open_transfers`, `capacity_pct` map correctly. Fix any field name mismatches.
- **Source/data dependency:** V1 `/api/wh360/warehouse-summary` endpoint live
- **Implementation risk:** Low — mapping already written; risk is field name divergence
- **Effort:** 0.5 day (verification + any field name fix)
- **Priority:** Critical

---

### A2. Wire `getNearExpiryStock()` to V1 endpoint

- **User impact:** Near-expiry stock is a daily operational concern. Without real data, operators cannot identify which batches to prioritise for use or disposal.
- **Current problem:** `getNearExpiryStock()` returns 4 mock batches. Urgency bands and expiry dates are fixtures.
- **Original behaviour to preserve:** `GET /api/wh360/inventory/near-expiry` queried `wh360_near_expiry_batches_v` with configurable `days_horizon` (default 30).
- **Proposed V2 fix:** Add `Warehouse360LegacyApiAdapter.getNearExpiryStock()` override calling `GET /api/wh360/inventory/near-expiry?warehouse_id=...&days_horizon=30`. Implement FastAPI proxy route.
- **Source/data dependency:** V1 `GET /api/wh360/inventory/near-expiry` endpoint
- **Implementation risk:** Low — `NearExpiryBatch` schema covers expected V1 fields
- **Effort:** 2–3 days (FastAPI route + adapter override + contract tests + browser verification)
- **Priority:** High

---

### A3. Wire `getWarehouseExceptions()` to V1 endpoint

- **User impact:** IM/WM reconciliation exceptions are the primary data quality signal for a warehouse manager. Mock exceptions have no relation to real plant state.
- **Current problem:** `getWarehouseExceptions()` returns 3 hardcoded exceptions. All are IE10 Emmental/Rennet/Cheddar — not real.
- **Original behaviour to preserve:** `GET /api/wh360/imwm/exceptions` queried `wh360_imwm_exceptions_v`. Included exception type, IM qty, WM qty, discrepancy, detection timestamp, resolution status.
- **Proposed V2 fix:** Add `Warehouse360LegacyApiAdapter.getWarehouseExceptions()` override. Implement FastAPI proxy. Map snake_case V1 fields to V2 `WarehouseReconciliationException` schema.
- **Source/data dependency:** V1 `GET /api/wh360/imwm/exceptions`
- **Implementation risk:** Medium — V1 field names for IM/WM may differ from V2 schema field names
- **Effort:** 3–4 days
- **Priority:** High

---

### A4. Add bin-level stock detail

- **User impact:** Warehouse managers need to see stock at the bin/shelf level — not just zone aggregates. The current `StockOverviewPanel` shows zones but no individual bin content.
- **Current problem:** `StockOverview` aggregates by zone. No `BinStockItem` type, no `getBinStock()` method, no bin-level panel.
- **Original behaviour to preserve:** `GET /api/wh360/inventory/bins` returned `wh360_bin_stock_v` with per-bin: materialId, batchId, qty, stockType (unrestricted/QI/blocked), blockReason, zoneId, binId.
- **Proposed V2 fix:** Add `BinStockItem` schema. Add `getBinStock()` method. Add `BinStockPanel` with filter by zone/hold-type. Add to `stock-status-view.tsx`.
- **Source/data dependency:** V1 `GET /api/wh360/inventory/bins`
- **Implementation risk:** Medium — large dataset; filtering/pagination may be needed
- **Effort:** 4–5 days
- **Priority:** High

---

## Group B — Should Fix for Credible Pilot/Demo

### B1. Add outbound delivery panel

- **User impact:** Warehouse managers need to track outbound deliveries — expected departure, load status, carrier reference. Without this the workspace has no outbound view.
- **Current problem:** No delivery panel or adapter method. `getGoodsMovements()` captures individual goods-issue events but not delivery-level aggregation.
- **Proposed V2 fix:** Add `OutboundDelivery` schema. Add `getOpenDeliveries()` adapter method. Create `OpenDeliveriesPanel`. Add to `goods-movements-view.tsx`.
- **Source/data dependency:** V1 `GET /api/wh360/deliveries` → `wh360_deliveries_v`
- **Effort:** 3–4 days
- **Priority:** Medium

---

### B2. Add inbound PO panel

- **User impact:** Goods receiving teams need to see open POs and expected arrivals. Without inbound data, the goods-receipt movements appear without context.
- **Proposed V2 fix:** Add `InboundPurchaseOrder` schema. Add `getOpenInboundOrders()` adapter method. Create `InboundOrdersPanel`. Add to `goods-movements-view.tsx`.
- **Source/data dependency:** V1 `GET /api/wh360/inbound` → `wh360_inbound_v`
- **Effort:** 3–4 days
- **Priority:** Medium

---

### B3. Add cockpit / shift summary view

- **User impact:** The original WH360 cockpit was the default landing page for shift managers — a condensed at-a-glance view with open order counts, exception count, and capacity alert.
- **Current problem:** `warehouse-overview-view.tsx` shows summary + holds but no order-status breakdown or drill-down.
- **Proposed V2 fix:** Add `warehouse-cockpit` view with a compact order status tile grid. Wire to `getWarehouse360Summary` data (extends existing summary schema or adds cockpit-specific fields).
- **Source/data dependency:** V1 `GET /api/wh360/wh-cockpit` (partially covered by existing summary endpoint)
- **Effort:** 2–3 days
- **Priority:** Medium

---

### B4. Wire plant selector to warehouse context

- **User impact:** Operators should see their warehouse name and plant ID — not just a hardcoded mock context.
- **Current problem:** `mockWarehouse360Context` has `warehouseId: 'WH-IE10-MAIN'`, `plantId: 'IE10'` regardless of authenticated user.
- **Proposed V2 fix:** Pass `plantId` from workspace context into `Warehouse360AdapterRequest`. Wire `getWarehouse360Context()` to `/api/wh360/plants` to retrieve the correct warehouse for the plant.
- **Source/data dependency:** V1 `GET /api/wh360/plants`
- **Effort:** 1–2 days (V2 context wiring; no new panel required)
- **Priority:** Medium

---

## Group C — Backlog / Later

### C1. IM/WM exception aging analytics

- **User impact:** Quality and warehouse managers want to see how long exceptions have been open — a histogram of exception age by type helps prioritise resolution.
- **Current problem:** Individual exceptions have `ageHours` but no aggregate view.
- **Proposed V2 fix:** Add `ExceptionAgingPanel` with age distribution by `exceptionType`.
- **Source/data dependency:** V1 `GET /api/wh360/imwm/analytics/aging` → `wh360_imwm_aging_v`
- **Effort:** 2–3 days
- **Priority:** Low

---

### C2. Dispensary queue

- **User impact:** Dispensary teams use the pick queue for batching and prioritisation of small-quantity dispensing orders.
- **Proposed V2 fix:** Add `DispensaryOrder` schema + adapter method + panel. Add to a new `dispensary` view.
- **Source/data dependency:** V1 `GET /api/wh360/dispensary` → `wh360_dispensary_v`
- **Effort:** 3 days
- **Priority:** Low

---

### C3. Line-side replenishment detail

- **User impact:** Production line operators need to see line-side bin replenishment status per work centre.
- **Current problem:** `ReplenishmentNeedsPanel` shows warehouse-level replenishment needs, not line-side bins.
- **Proposed V2 fix:** Extend or supplement `ReplenishmentNeedsPanel` with a line-side view sourced from `wh360_lineside_v`.
- **Source/data dependency:** V1 `GET /api/wh360/inventory/lineside`
- **Effort:** 2 days
- **Priority:** Low

---

## Constraint Reminder

> All new characteristic/stock lists must come from adapter methods, never hardcoded in view or panel components. Plant IDs and warehouse IDs in mock data are fixture values — do not reference them from views.
