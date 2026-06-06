# Warehouse Functional Parity Audit

**Date:** 2026-05-16
**Domain:** `di-warehouse` / `warehouse-360-overview`, `production-staging`
**V1 source:** `C:/Users/tgeldard/Documents/GitHub/wh360` (FastAPI + React + Databricks)
**V2 source:** `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2`

---

## V1 Application Overview

The original WH360 application was a standalone FastAPI + React app that connected directly to Databricks SQL via 15 gold views. It provided warehouse managers and inventory controllers with a real-time view of stock status, goods movements, holds, open purchase orders/deliveries, and IM/WM reconciliation state.

### V1 Routers and Endpoints

| Router | Endpoints | Purpose |
|---|---|---|
| `wh_cockpit` | `GET /api/wh360/wh-cockpit`, `GET /api/wh360/wh-cockpit/{order_id}` | Warehouse cockpit KPIs + order detail |
| `deliveries` | `GET /api/wh360/deliveries`, `GET /api/wh360/deliveries/{delivery_id}` | Outbound delivery list and detail |
| `inbound` | `GET /api/wh360/inbound`, `GET /api/wh360/inbound/{po_id}` | Inbound PO list and detail |
| `inventory_bins` | `GET /api/wh360/inventory/bins/summary`, `GET /api/wh360/inventory/bins` | Bin-level stock summary and detail |
| `inventory_lineside` | `GET /api/wh360/inventory/lineside` | Line-side replenishment stock |
| `inventory_near_expiry` | `GET /api/wh360/inventory/near-expiry` | Batches within expiry horizon |
| `imwm` | `GET /api/wh360/imwm/stock`, `GET /api/wh360/imwm/movements`, `GET /api/wh360/imwm/exceptions`, `GET /api/wh360/imwm/analytics/aging` | IM/WM stock, movement feed, reconciliation exceptions, aging |
| `dispensary` | `GET /api/wh360/dispensary` | Dispensary order queue |
| `kpis` | `GET /api/wh360/kpis` | Plant-level warehouse KPIs |
| `plants` | `GET /api/wh360/plants` | Plant/warehouse configuration |

### V1 Gold Views

| View | Purpose |
|---|---|
| `wh360_bin_stock_v` | Current bin-level stock by material/batch/storage location |
| `wh360_near_expiry_batches_v` | Batches within configurable expiry horizon (30 days default) |
| `wh360_imwm_stock_v` | IM vs WM stock quantities side-by-side |
| `wh360_imwm_movements_v` | Individual goods movement events (GI, GR, TO, ST, return, adjustment) |
| `wh360_imwm_exceptions_v` | Quantity/location/status mismatches between IM and WM |
| `wh360_imwm_aging_v` | Exception age distribution (days open, by exception type) |
| `wh360_deliveries_v` | Outbound delivery lines with status |
| `wh360_inbound_v` | Inbound PO lines with GR status |
| `wh360_lineside_v` | Line-side bin replenishment status per work centre |
| `wh360_dispensary_v` | Dispensary order queue with priority |
| `wh360_kpis_v` | Aggregate KPI tiles |
| `wh360_cockpit_summary_v` | High-level cockpit metrics |
| `wh360_cockpit_orders_v` | Open order lines for cockpit drill-down |
| `staging_orders_v` | Production staging order readiness |
| `staging_pick_tasks_v` | Pick task queue per staging order |

### V1 Key Behaviours

1. **Plant selector** — `plant_id` passed as query parameter on every request; `/api/wh360/plants` returns available warehouses.
2. **Near-expiry horizon** — configurable days threshold (default 30); batches sorted by `daysUntilExpiry` ascending; expired batches included with negative days.
3. **IM/WM reconciliation exceptions** — `wh360_imwm_exceptions_v` surfaces quantity mismatches, missing-in-WM, missing-in-IM, and duplicate postings. Exception age tracked from `detected_at`.
4. **Goods movement feed** — individual movement events with `mvt_type`, material, batch, qty, source/destination location, reference document. Rendered as a scrollable activity feed.
5. **Bin-level detail** — per-bin stock with `block_reason`, `hold_type`, `stock_type` (unrestricted/QI/blocked). Sortable/filterable.
6. **Delivery + inbound detail** — full delivery lines, expected arrival, open GR status, carrier/vehicle reference.
7. **Cockpit view** — condensed summary for a shift manager: open orders by status, exceptions count, capacity alert.
8. **Dispensary queue** — pick orders for the production dispensary with priority and pick-by time.

---

## V2 Application Overview

The V2 warehouse domain has two workspaces:

### Warehouse 360 Overview (`warehouse-360-overview`)

`domain-integrations/warehouse/src/` — 5 views, 7 adapter methods (all mock except `getWarehouse360Summary` which is wired to V1 but not browser-verified).

| View | Panels |
|---|---|
| `warehouse-overview` | `Warehouse360SummaryPanel`, `OpenHoldsPanel` |
| `goods-movements` | `GoodsMovementActivityPanel`, `InboundOutboundSummaryPanel` |
| `stock-status` | `StockOverviewPanel`, `NearExpiryStockPanel` (new), `WarehouseReconciliationExceptionsPanel` (new), `LocationCapacityPanel` |
| `replenishment` | `ReplenishmentNeedsPanel` |
| `holds-management` | `OpenHoldsPanel` (full view) |

### Production Staging (`production-staging`)

`domain-integrations/warehouse/src/` — 6 views, 9 adapter methods (all mock).

| View | Panels |
|---|---|
| `staging-overview` | `StagingReadinessSummaryPanel`, `StagingAlertsPanel` |
| `order-staging` | `StagingOrderListPanel`, `StagingPickTasksPanel` |
| `shortfalls` | `StagingShortfallsPanel` |
| `zone-capacity` | `StagingZoneCapacityPanel` |
| `picking-waves` | `StagingPickingWavesPanel` |
| `move-requests` | `StagingMoveRequestsPanel` |

---

## Parity Gap Analysis

### Previously missing — fixed in this tranche

| Gap | Fix applied |
|---|---|
| Near-expiry batch list (`wh360_near_expiry_batches_v`) not in V2 | Added `NearExpiryBatch` schema + `getNearExpiryStock()` + `NearExpiryStockPanel` |
| IM/WM reconciliation exceptions (`wh360_imwm_exceptions_v`) not surfaced as individual exception records | Added `WarehouseReconciliationException` schema + `getWarehouseExceptions()` + `WarehouseReconciliationExceptionsPanel` |
| No FastAPI native routes for WH360 | Added 5 native Databricks-API endpoints (`overview`, `inbound`, `outbound`, `staging`, `exceptions`) with dynamic filters, robust query parameter validation, and robust error handling |

### Remaining gaps

| Gap | Severity | V1 source |
|---|---|---|
| Bin-level stock detail absent (only zone aggregates) | High | `wh360_bin_stock_v` |
| Delivery detail panel absent | Medium | `wh360_deliveries_v` |
| Inbound PO detail panel absent | Medium | `wh360_inbound_v` |
| Dispensary queue absent | Low | `wh360_dispensary_v` |
| Line-side replenishment absent | Low | `wh360_lineside_v` |
| IM/WM exception aging analytics absent | Low | `wh360_imwm_aging_v` |
| Plant selector not wired | High | `/api/wh360/plants` |
| `getWarehouse360Summary` not browser-verified | High | `/api/wh360/wh-cockpit` |

---

## Architecture Constraints Confirmed

- All panels use `EvidencePanel` + `useEvidencePanel` pattern.
- All adapter methods return `AdapterResult<T>`.
- No direct `fetch()` / `axios()` calls in panels.
- No hardcoded plant IDs or warehouse IDs in view layer (request-driven).
- New schemas are additive — no existing schemas modified.
- `ExceptionStockSummaryPanel` (zone-aggregate hold view) retained unchanged alongside new `WarehouseReconciliationExceptionsPanel`.

---

## Test Coverage (this tranche)

| File | New tests |
|---|---|
| `warehouse-360-adapter.test.ts` | +10 (getNearExpiryStock × 5, getWarehouseExceptions × 5) |
| `near-expiry-stock-panel.test.tsx` | 9 (new) |
| `warehouse-reconciliation-exceptions-panel.test.tsx` | 8 (new) |
| **Total new** | **27** |

All existing tests continue to pass.
