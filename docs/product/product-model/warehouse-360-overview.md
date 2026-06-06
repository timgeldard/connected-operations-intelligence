# Warehouse 360 Overview Workspace

## Purpose

The **Warehouse 360 Overview** workspace is a Phase 5 addition to the warehouse domain. It gives warehouse managers, inventory controllers, and operations supervisors a complete view of stock status, open holds, goods movements, replenishment needs, and location capacity across a warehouse.

A warehouse manager should think:

> "What is in my warehouse right now, what is on hold and why, where are replenishment risks, and which locations are filling up?" — not "Check WMS for stock, then the hold report, then the capacity dashboard."

The workspace is owned by `di-warehouse` within the `warehouse` domain. In Phase 5 it connects to mock data representing Kerry Listowel Main Warehouse (WH-IE10-MAIN).

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | warehouse-360-overview |
| displayName | Warehouse 360 Overview |
| domainId | warehouse |
| ownerDomain | warehouse |
| lifecycle | pilot |
| route | /warehouse/warehouse-360-overview |
| telemetryId | warehouse.warehouse-360-overview |

---

## Supported Roles

- warehouse-manager
- inventory-controller
- operations-supervisor
- plant-manager
- logistics-coordinator

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `warehouse.overview.read` | View stock overview, holds, goods movements, replenishment needs, and location capacity |

---

## Supported Scopes

- `plant` (default) — monitors the main warehouse for a plant
- `warehouse` — scoped directly to a specific warehouse
- `storageLocation` — scoped to a specific storage location

---

## Views

### 1. Warehouse Overview (`warehouse-overview`)

Default landing view. Shows warehouse KPI summary, stock zone overview, and open holds.

**Panels:** Warehouse 360 Summary, Stock Overview, Open Holds

### 2. Stock Status (`stock-status`)

Detailed stock overview by zone with location capacity utilisation.

**Panels:** Stock Overview, Location Capacity

### 3. Holds Management (`holds-management`)

All open holds with reason, age, quantity, and batch reference.

**Panels:** Open Holds, Warehouse 360 Summary

### 4. Goods Movements (`goods-movements`)

Recent goods movements — receipts, issues, transfers, and adjustments.

**Panels:** Goods Movement Activity, Warehouse 360 Summary

### 5. Replenishment (`replenishment`)

Materials at or below reorder point requiring replenishment with urgency rating.

**Panels:** Replenishment Needs, Stock Overview

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `warehouse-360-summary` | warehouse | KPI tiles — total stock lines, unrestricted, hold %, open transfers, capacity utilisation |
| `stock-overview` | warehouse | Zone-by-zone stock table with capacity bars and hold percentages |
| `open-holds` | warehouse | Open holds with hold reason, batch, material, quantity, and age |
| `goods-movement-activity` | warehouse | Recent goods movements with type icon, material, quantity, and timestamp |
| `replenishment-needs` | warehouse | Materials below reorder point with urgency rating and target quantity |
| `location-capacity` | warehouse | Storage location utilisation bars by zone with blocked location indicators |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Raise Hold Inquiry | Raise Hold Inquiry button | Records a hold inquiry for a specific batch with hold type and contact details |
| Request Replenishment | Request Replenishment button | Creates a replenishment request for a material with urgency and target quantity |
| Open Batch Release | Link action | Navigates to Quality Batch Release workspace for holds requiring release decision |
| Open Production Staging | Link action | Navigates to Production Staging workspace for staging-related holds |
| Open Trace Investigation | Link action | Navigates to Trace Investigation workspace for investigation holds |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Batch Release | quality-batch-release | batch-decision | batch, warehouse |
| Open Production Staging | production-staging | staging-overview | warehouse |
| Open Trace Investigation | trace-investigation | overview | batch |

---

## Data Source

**WMS / ERP** (mock data in Phase 5) — `systemName: wms`. Represents stock and movement data for Kerry Listowel Main Warehouse WH-IE10-MAIN.
