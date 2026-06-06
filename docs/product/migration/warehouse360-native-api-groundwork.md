# Warehouse360 Native API Groundwork Notes

This document provides a technical audit and source-mapping analysis of the **Warehouse360** domain to lay a safe, read-only native API foundation.

---

## 🔍 1. Current State Audit

### Current API Endpoints (Backend)
- `POST /api/wh360/warehouse-summary`
  - Status: Thin proxy route to V1. Active in code but unverified against live V1.

### Current Frontend Adapter Methods (`Warehouse360Adapter` & `ProductionStagingAdapter`)
- **`Warehouse360Adapter`**:
  - `getWarehouse360Context` (mock)
  - `getWarehouse360Summary` (legacy-api, proxies `/api/wh360/warehouse-summary` - unverified)
  - `getStockOverview` (mock)
  - `getOpenHolds` (mock)
  - `getGoodsMovements` (mock)
  - `getReplenishmentNeeds` (mock)
  - `getLocationCapacities` (mock)
  - `getNearExpiryStock` (mock)
  - `getWarehouseExceptions` (mock)
- **`ProductionStagingAdapter`**:
  - `getProductionStagingContext` (mock)
  - `getStagingReadinessSummary` (mock)
  - `getStagingOrderSummaries` (mock)
  - `getStagingPickTasks` (mock)
  - `getStagingZoneCapacity` (mock)
  - `getStagingShortfalls` (mock)
  - `getStagingMoveRequests` (mock)
  - `getStagingPickingWaves` (mock)
  - `getStagingAlerts` (mock)

---

## 🗄️ 2. Databricks Source Object Mapping

Since we are doing **read-only groundwork** without direct UAT access, we classify all required tables based on V1 source blueprints.

| Target V2 Endpoint / Query | Databricks Source View | Classification | Notes |
|---|---|---|---|
| `GET /api/warehouse360/overview` | `wh360.wh360_cockpit_summary_v` / `wh360_kpis_v` | confirmed-v1, referenced-only | High-level summary count views |
| `GET /api/warehouse360/inbound` | `wh360.wh360_inbound_v` | confirmed-v1, referenced-only | PO/STO receipt document details |
| `GET /api/warehouse360/outbound` | `wh360.wh360_deliveries_v` | confirmed-v1, referenced-only | Outbound delivery lines |
| `GET /api/warehouse360/staging` | `wh360.staging_orders_v` | confirmed-v1, referenced-only | Staging order demand and quantities |
| `GET /api/warehouse360/exceptions` | `wh360.wh360_imwm_exceptions_v` | confirmed-v1, referenced-only | Reconciliation & inventory mismatch details |
| - | `wh360.wh360_near_expiry_batches_v` | confirmed-v1, referenced-only | Backup for expiry exceptions |

> **Blockade Note:** Schema `wh360` is a separate catalog schema in Unity Catalog. The backend object resolver `object_resolver.py` must support the `wh360` domain explicitly to direct queries to `WH360_CATALOG` and `WH360_SCHEMA`.

---

## 🚀 3. Recommended API Groundwork Sequence (COMPLETE & HARDENED — 2026-05-18)

We have fully implemented, hardened, and unit-tested all steps of the recommended sequence:

1. **Object Resolver Alignment:** Wired the `wh360` domain explicitly in `object_resolver.py` to target `WH360_CATALOG` and `WH360_SCHEMA`. (COMPLETE)
2. **Data Contracts Expansion:** Added robust schemas in `packages/data-contracts` for `Warehouse360Overview`, `Warehouse360InboundItem`, `Warehouse360OutboundItem`, `Warehouse360StagingItem`, and `Warehouse360ExceptionItem` with defensive `.nullable().optional()` fallbacks for maximum resilience. (COMPLETE)
3. **QuerySpec Factories & Row Mappers:** Created `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` supporting dynamic filters (`plant_id`, `date_from`, `date_to`) and secure bounded literal limit casting for maximum safety and efficiency. (COMPLETE)
4. **FastAPI Route Shell:** Implemented dynamic query param parsing, validation and routing shell in `apps/api/routes/warehouse360.py` with standard `422 Unprocessable Entity` validations. (COMPLETE)
5. **Frontend Adapter Foundations:** Extended client adapter layer in `warehouse-360-adapter.ts` and `warehouse-360-legacy-api-adapter.ts` to seamlessly forward user-supplied query filters to the backend. (COMPLETE)
6. **Robust Test Verification:** Wrote extensive Vitest and Pytest validation tests ensuring correct parameter bounding and query forwarding. (COMPLETE)
