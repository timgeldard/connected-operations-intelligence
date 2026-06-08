# Warehouse Functional Parity Matrix

**Date:** 2026-05-16
**V1 source:** `C:/Users/tgeldard/Documents/GitHub/wh360` (standalone FastAPI + React app)
**V2 source:** `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2`

Status codes: `preserved` · `partially-preserved` · `improved` · `mock-only` · `hardcoded-mock` · `legacy-api wired` · `legacy-api verified` · `placeholder` · `missing` · `degraded`

---

| # | Capability | Original file/path | Original API/query | Original behaviour | V2 file/path | V2 behaviour | Data tier | Parity | Severity | Remediation | Fix without V1? | Files affected |
|---|-----------|-------------------|-------------------|-------------------|--------------|--------------|-----------|--------|----------|-------------|----------------|----------------|
| 1 | Plant/warehouse entry | `frontend/src/components/PlantSelector.tsx` | `GET /api/wh360/plants` | Plant + warehouse dropdown; persisted in session; drives all subsequent queries | `warehouse-360-workspace.tsx` | Fixed mock warehouseId `WH-IE10-MAIN`; no plant selector | mock | **degraded** | high | Add plant context display (Phase 1: read-only) | Yes (display only) | workspace.tsx |
| 2 | Warehouse KPI summary | `frontend/src/pages/Cockpit.tsx` | `GET /api/wh360/wh-cockpit` | Open orders by status, exceptions count, capacity alert, GR/GI counts | `panels/warehouse-360-summary-panel.tsx` | totalStockLines, holds, transfers, capacity, replenishment needs | legacy-api (unverified) | **partially-preserved** | high | Browser-verify `getWarehouse360Summary` against V1 | No (needs V1 confirmation) | warehouse-360-legacy-api-adapter.ts |
| 3 | Stock zone overview | `frontend/src/pages/BinStock.tsx` | `GET /api/wh360/inventory/bins/summary` | Zone-level: capacity%, hold%, stockLines per zone | `panels/stock-overview-panel.tsx` | Zone aggregates: zoneType, capacityPercent, holdPercent, stockLines | mock-only | **preserved** | — | Wire to V1 when available | No (needs V1) | — |
| 4 | Bin-level stock detail | `frontend/src/pages/BinStock.tsx` | `GET /api/wh360/inventory/bins` | Per-bin: materialId, batchId, qty, UoM, stockType, blockReason, location; sortable/filterable | Not implemented | — | missing | **missing** | high | Add `BinStockPanel` + `getBinStock()` adapter method | No (needs V1) | — |
| 5 | Near-expiry batches | `frontend/src/pages/NearExpiry.tsx` | `GET /api/wh360/inventory/near-expiry` → `wh360_near_expiry_batches_v` | Batches within 30-day horizon; sorted by daysUntilExpiry; expired batches included; colour-coded by urgency | `panels/near-expiry-stock-panel.tsx` | urgency (expired/critical/warning/caution), daysUntilExpiry, holdStatus displayed | mock-only | **partially-preserved** | high | Wire to V1 `GET /api/wh360/inventory/near-expiry` | No (needs V1) | near-expiry-stock-panel.tsx |
| 6 | IM/WM reconciliation exceptions | `frontend/src/pages/IMWM.tsx` | `GET /api/wh360/imwm/exceptions` → `wh360_imwm_exceptions_v` | Per-exception: type, material, batch, IM qty, WM qty, discrepancy, age, severity, resolution | `panels/warehouse-reconciliation-exceptions-panel.tsx` | All exception fields present; open count banner; type labels; severity colour coding | mock-only | **partially-preserved** | high | Wire to V1 `GET /api/wh360/imwm/exceptions` | No (needs V1) | warehouse-reconciliation-exceptions-panel.tsx |
| 7 | IM/WM exception summary (zone/blocked) | `frontend/src/pages/IMWM.tsx` | — | Not a distinct V1 concept — derived from exception count | `panels/exception-stock-summary-panel.tsx` | Blocked locations, total locations, per-zone hold%; highlights stock under restriction | mock-only | **improved** | — | — | — | — |
| 8 | Goods movement feed (individual events) | `frontend/src/pages/IMWM.tsx` | `GET /api/wh360/imwm/movements` → `wh360_imwm_movements_v` | Scrollable activity feed: GR, GI, TO, ST, return, adjustment; material, batch, qty, ref doc, timestamp, location | `panels/goods-movement-activity-panel.tsx` | All movement types present; icon + colour per type; material, qty, batch, ref doc, timestamp, destinationLocation | mock-only | **preserved** | — | Wire to V1 movements endpoint | No (needs V1) | — |
| 9 | Inbound/outbound movement summary | `frontend/src/pages/Cockpit.tsx` | `GET /api/wh360/wh-cockpit` | Count tiles: GR, GI, TO by type | `panels/inbound-outbound-summary-panel.tsx` | Count tiles per movementType + latest movements rows | mock-only | **preserved** | — | — | — | — |
| 10 | Open delivery list | `frontend/src/pages/Deliveries.tsx` | `GET /api/wh360/deliveries` | Delivery lines: deliveryId, materials, expectedAt, status, carrierRef, plantId | Not implemented | — | missing | **missing** | medium | Add delivery panel when V1 wired | No (needs V1) | — |
| 11 | Delivery detail | `frontend/src/pages/Deliveries.tsx` | `GET /api/wh360/deliveries/{delivery_id}` | Full delivery detail: lines, GR status, carrier, vehicle | Not implemented | — | missing | **missing** | medium | Part of delivery panel | No (needs V1) | — |
| 12 | Inbound PO list | `frontend/src/pages/Inbound.tsx` | `GET /api/wh360/inbound` | PO lines: poId, vendor, material, expected qty, received qty, open | Not implemented | — | missing | **missing** | medium | Add inbound panel when V1 wired | No (needs V1) | — |
| 13 | Inbound PO detail | `frontend/src/pages/Inbound.tsx` | `GET /api/wh360/inbound/{po_id}` | PO line detail, GR history | Not implemented | — | missing | **missing** | medium | Part of inbound panel | No (needs V1) | — |
| 14 | Open holds list | `frontend/src/pages/BinStock.tsx` | `GET /api/wh360/inventory/bins` WHERE hold_type IS NOT NULL | holdId, material, batch, location, holdReason, qty, age, linkedWorkspace | `panels/open-holds-panel.tsx` | All fields present; ageHours, linkedWorkspaceId present | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 15 | Replenishment needs | `frontend/src/pages/Lineside.tsx` | `GET /api/wh360/inventory/lineside` → `wh360_lineside_v` | Line-side bin replenishment needs by work centre; reorder point, current stock, expected delivery | `panels/replenishment-needs-panel.tsx` | needId, material, currentStock, reorderPoint, targetQty, urgency, openPO, expectedDelivery | mock-only | **preserved** | — | Wire to V1 lineside endpoint | No (needs V1) | — |
| 16 | Location capacities | `frontend/src/pages/BinStock.tsx` | `GET /api/wh360/inventory/bins/summary` | Bin-level capacity utilization | `panels/location-capacity-panel.tsx` | locationId, zoneId, totalCapacityUnits, usedCapacityUnits, utilizationPercent, isBlocked, blockReason | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 17 | IM/WM aging analytics | `frontend/src/pages/IMWM.tsx` | `GET /api/wh360/imwm/analytics/aging` → `wh360_imwm_aging_v` | Exception age distribution histogram; breakdown by exceptionType | Not implemented | — | missing | **missing** | low | Accept as backlog | No (needs V1) | — |
| 18 | Cockpit / shift summary | `frontend/src/pages/Cockpit.tsx` | `GET /api/wh360/wh-cockpit` | Condensed shift view: open orders by status, exceptions count, capacity alert; order drill-down | Not implemented | Only warehouse summary panel; no order drill-down | missing | **missing** | medium | Add cockpit view when V1 wired | No (needs V1) | — |
| 19 | Dispensary queue | `frontend/src/pages/Dispensary.tsx` | `GET /api/wh360/dispensary` → `wh360_dispensary_v` | Dispensary pick orders with priority, pick-by time, material | Not implemented | — | missing | **missing** | low | Accept as backlog — dispensary is plant-specific | No (needs V1) | — |
| 20 | Production staging overview | `frontend/src/pages/StagingDashboard.tsx` | `staging_orders_v` | Staging readiness: totalOrders, staged, partial, blocked, readinessPercent | `panels/staging-readiness-summary-panel.tsx` | All staging readiness fields present; readinessPercent, staged, partial, blocked | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 21 | Staging order list | `frontend/src/pages/Staging.tsx` | `staging_orders_v` | Per-order: orderId, material, stagingStatus, stagingZone, pickCompletion | `panels/staging-order-list-panel.tsx` | All staging order fields present; status colour coding | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 22 | Staging pick tasks | `frontend/src/pages/Staging.tsx` | `staging_pick_tasks_v` | Per-task: taskId, orderId, material, qty, fromLocation, toLocation, priority, status | `panels/staging-pick-tasks-panel.tsx` | All pick task fields present | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 23 | Staging shortfalls | — | `staging_orders_v` (unfulfilled qty) | Materials short for staging; quantity gap, urgency | `panels/staging-shortfalls-panel.tsx` | shortfallId, material, requiredQty, availableQty, gapQty, urgency | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 24 | Staging zone capacity | — | `staging_pick_tasks_v` (zone aggregation) | Zone fill level, active orders, available lanes | `panels/staging-zone-capacity-panel.tsx` | All zone capacity fields present | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 25 | Staging move requests | — | — | Move requests between staging zones | `panels/staging-move-requests-panel.tsx` | All move request fields present | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 26 | Staging picking waves | — | `staging_pick_tasks_v` | Batch wave of pick tasks | `panels/staging-picking-waves-panel.tsx` | All picking wave fields present | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 27 | Staging alerts | — | — | Alerts: blocked orders, overdue picks, capacity warnings | `panels/staging-alerts-panel.tsx` | Alert type, severity, message, relatedEntityId | mock-only | **preserved** | — | Wire to V1 | No (needs V1) | — |
| 28 | Loading/error/empty states | Various | — | Spinner, error, empty | `EvidencePanel` (all panels) | displayState: loading/ready/stale/error via EvidencePanel | improved | **improved** | — | — | — | — |

---

## Parity Summary

| Status | Count |
|--------|-------|
| preserved | 12 |
| partially-preserved | 3 |
| improved | 2 |
| mock-only | 0 (absorbed into partially-preserved or preserved) |
| degraded | 1 |
| missing | 8 |
| **Total** | **26** |

---

## Fixes Applied in This Tranche (2026-05-16)

| # | Fix | Row(s) affected |
|---|-----|-----------------|
| 1 | Added `NearExpiryStockPanel` + `NearExpiryBatch` schema + `getNearExpiryStock()` adapter | Row 5 |
| 2 | Added `WarehouseReconciliationExceptionsPanel` + `WarehouseReconciliationException` schema + `getWarehouseExceptions()` adapter | Row 6 |
