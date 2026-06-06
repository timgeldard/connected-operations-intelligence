# Warehouse 360 Domain Reference

**Domain:** `warehouse`
**Workspace:** `warehouse-360-overview`
**Owner:** `di-warehouse`
**Lifecycle:** `pilot`
**Route:** `/warehouse/warehouse-360-overview`
**Date updated:** 2026-05-16

---

## Purpose

The Warehouse 360 Overview workspace gives warehouse managers, inventory controllers, and operations supervisors a consolidated view of stock status, open holds, goods movements, replenishment needs, near-expiry batches, IM/WM reconciliation exceptions, and location capacity across a warehouse.

The workspace preserves the original WH360 app's core workflow: stock visibility, exception management, goods movement audit trail, and replenishment monitoring. It wraps that capability in the V2 evidence-panel architecture.

---

## Supported Roles

| Role | Primary use |
|------|-------------|
| `warehouse-manager` | Monitor stock, exceptions, expiry; manage holds |
| `inventory-controller` | Review reconciliation exceptions; trace goods movements |
| `operations-supervisor` | Capacity overview; replenishment triggers |
| `plant-manager` | Summary KPIs; hold impact on batch release |
| `logistics-coordinator` | Goods movements; delivery context |

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `warehouse.overview.read` | View stock overview, holds, goods movements, replenishment needs, near-expiry batches, and reconciliation exceptions |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | `warehouse-360-overview` |
| displayName | Warehouse 360 Overview |
| domainId | `warehouse` |
| ownerDomain | `warehouse` |
| lifecycle | `pilot` |
| route | `/warehouse/warehouse-360-overview` |
| telemetryId | `warehouse.warehouse-360-overview` |

---

## Views

### 1. Warehouse Overview (`warehouse-overview`)

Default landing view. Shows warehouse KPI summary and open holds requiring attention.

**Panels:** `Warehouse360SummaryPanel`, `OpenHoldsPanel`

---

### 2. Goods Movements (`goods-movements`)

Individual goods movement events and inbound/outbound summary counts.

**Panels:** `GoodsMovementActivityPanel`, `InboundOutboundSummaryPanel`

---

### 3. Stock Status (`stock-status`)

Zone-level stock overview, near-expiry batches, IM/WM reconciliation exceptions, and location capacities.

**Panels:** `StockOverviewPanel`, `NearExpiryStockPanel`, `WarehouseReconciliationExceptionsPanel`, `ExceptionStockSummaryPanel`, `LocationCapacityPanel`

---

### 4. Replenishment (`replenishment`)

Materials at or below reorder point, urgency classification, and open purchase orders.

**Panels:** `ReplenishmentNeedsPanel`

---

### 5. Holds Management (`holds-management`)

Full list of open holds with reasons, age, quantities, and linked workspace.

**Panels:** `OpenHoldsPanel`

---

## Panels

| Panel ID | Component | Adapter method | Description |
|---|---|---|---|
| `warehouse-360-summary` | `Warehouse360SummaryPanel` | `getWarehouse360Summary()` | KPIs: totalStockLines, holdLines, QI lines, GR/GI counts, transfers, capacity utilization, replenishment needs |
| `open-holds` | `OpenHoldsPanel` | `getOpenHolds()` | Open holds: holdId, material, batch, location, holdReason, qty, ageHours, linkedWorkspace |
| `goods-movement-activity` | `GoodsMovementActivityPanel` | `getGoodsMovements()` | Individual movement events: GR, GI, TO, ST, return, adjustment; icon + colour per type |
| `inbound-outbound-summary` | `InboundOutboundSummaryPanel` | `getGoodsMovements()` | Count tiles per movementType + latest movements rows |
| `stock-overview` | `StockOverviewPanel` | `getStockOverview()` | Zone aggregates: zoneType, capacityPercent, holdPercent, stockLines |
| `near-expiry-stock` | `NearExpiryStockPanel` | `getNearExpiryStock()` | Batches by expiry horizon: urgency (expired/critical/warning/caution), daysUntilExpiry, holdStatus |
| `warehouse-reconciliation-exceptions` | `WarehouseReconciliationExceptionsPanel` | `getWarehouseExceptions()` | IM/WM mismatches: exceptionType, material, batch, IM qty, WM qty, discrepancy, age, severity, resolution |
| `exception-stock-summary` | `ExceptionStockSummaryPanel` | `getStockOverview()` | Blocked locations count + per-zone hold% — zone-level exception summary |
| `replenishment-needs` | `ReplenishmentNeedsPanel` | `getReplenishmentNeeds()` | needId, material, currentStock, reorderPoint, targetQty, urgency, openPO, expectedDelivery |
| `location-capacity` | `LocationCapacityPanel` | `getLocationCapacities()` | Per-location: zoneId, capacity units, utilization%, isBlocked, blockReason |

---

## Adapter Methods

All methods are on `Warehouse360Adapter` in `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`. `getWarehouse360Summary` is wired to V1 via `Warehouse360LegacyApiAdapter` (not yet browser-verified). All other methods return mock data.

| Method | Request fields used | Returns |
|---|---|---|
| `getWarehouse360Context` | warehouseId, plantId | `Warehouse360OverviewContext` |
| `getWarehouse360Summary` | warehouseId, plantId | `Warehouse360Summary` |
| `getStockOverview` | warehouseId, plantId | `StockOverview` |
| `getOpenHolds` | warehouseId, plantId | `OpenHoldItem[]` |
| `getGoodsMovements` | warehouseId, plantId | `GoodsMovementEvent[]` |
| `getReplenishmentNeeds` | warehouseId, plantId | `ReplenishmentNeed[]` |
| `getLocationCapacities` | warehouseId, plantId | `LocationCapacity[]` |
| `getNearExpiryStock` | warehouseId, plantId | `NearExpiryBatch[]` |
| `getWarehouseExceptions` | warehouseId, plantId | `WarehouseReconciliationException[]` |

---

## Data Contracts

All types are in `packages/data-contracts/src/schemas/warehouse-360-overview.ts` and exported from `@connectio/data-contracts`.

| Type | Description |
|---|---|
| `Warehouse360OverviewContext` | Workspace context: warehouseId, warehouseName, plantId, KPI snapshot |
| `Warehouse360Summary` | Plant-level KPI aggregate |
| `StockZone` | Zone aggregate: zoneType, stockLines, capacityPercent, holdPercent |
| `StockOverview` | All zones + total/occupied/blocked location counts |
| `OpenHoldItem` | Hold record: holdId, material, batch, reason, qty, ageHours, linkedWorkspaceId |
| `GoodsMovementEvent` | Individual movement: movementType, material, batch, qty, source/dest location, ref doc |
| `ReplenishmentNeed` | Replenishment: material, currentStock, reorderPoint, targetQty, urgency, openPO |
| `LocationCapacity` | Per-location capacity: zoneId, totalCapacityUnits, usedCapacityUnits, isBlocked |
| `NearExpiryBatch` | Near-expiry: batchId, material, expiryDate, daysUntilExpiry, qty, urgency, holdStatus |
| `WarehouseReconciliationException` | IM/WM mismatch: exceptionType, imQuantity, wmsQuantity, discrepancyQuantity, severity, resolution |

---

## Near-Expiry Urgency Bands

| Urgency | Condition | Colour |
|---|---|---|
| `expired` | `daysUntilExpiry < 0` | `#D32F2F` (red) |
| `critical` | `daysUntilExpiry ≤ 2` | `#F57C00` (deep orange) |
| `warning` | `3 ≤ daysUntilExpiry ≤ 7` | `#D97706` (amber) |
| `caution` | `8 ≤ daysUntilExpiry ≤ 30` | `#388E3C` (green) |

---

## Reconciliation Exception Types

| exceptionType | Description |
|---|---|
| `quantity-mismatch` | IM and WM show different quantities for the same material/batch/location |
| `location-mismatch` | Material/batch recorded in different locations in IM vs WM |
| `status-mismatch` | Stock type (unrestricted/QI/blocked) differs between IM and WM |
| `missing-in-wms` | Material/batch present in IM but no WM stock record |
| `missing-in-im` | Material/batch present in WM but no IM stock record |
| `duplicate-posting` | Same movement posted twice in either IM or WM |

---

## Mock Data Scope

| Field | Mock value | Origin |
|---|---|---|
| warehouseId | `WH-IE10-MAIN` | Fixture |
| plantId | `IE10` (Kerry Listowel) | Fixture |
| Near-expiry batches | SC-240308-0003, RM-240301-0021, CH-240225-0018, CH-240228-0033 | Fixture |
| Reconciliation exceptions | RECON-2024-00047, RECON-2024-00046, RECON-2024-00044 | Fixture |
| Characteristics | Emmental Block, Cheddar Block, Starter Culture, Rennet | Fixture — not architecture |

---

## Parity Status (2026-05-16)

| Capability | Status |
|---|---|
| Warehouse KPI summary | partially-preserved (legacy-api wired, unverified) |
| Stock zone overview | preserved (mock) |
| Near-expiry batch list | partially-preserved (mock) |
| IM/WM reconciliation exceptions | partially-preserved (mock) |
| Goods movement feed | preserved (mock) |
| Open holds | preserved (mock) |
| Replenishment needs | preserved (mock) |
| Location capacities | preserved (mock) |
| Bin-level stock detail | missing |
| Outbound deliveries | missing |
| Inbound PO list | missing |
| Dispensary queue | missing |

See `docs/migration/warehouse-functional-parity-matrix.md` for full matrix.

---

## Known Limitations

1. No V1 API browser-verified — `getWarehouse360Summary` is wired but not confirmed against live V1.
2. All other adapter methods return mock data. Mock data uses Kerry Listowel fixtures.
3. No plant selector — warehouseId is fixed in the adapter request.
4. Bin-level stock detail is not implemented; only zone-level aggregates are available.
5. No outbound delivery or inbound PO panels yet.
