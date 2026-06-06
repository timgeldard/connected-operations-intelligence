# Warehouse360 API Hardening and Product Readiness Implementation Note

This document summarizes the current native API groundwork status, required parameters, and planned hardening updates for the **Warehouse360** domain. These updates prepare the API surface for UAT/Databricks verification by Claude.

---

## 🔍 1. Current State Audit

### Current Endpoints & Required Parameters
All five native endpoints reside in `apps/api/routes/warehouse360.py` and are gated under `BACKEND_ADAPTER_MODE=databricks-api` mode checks. They require an active OAuth token and only expect a single parameter:
1. `GET /api/warehouse360/overview` — Requires `warehouse_id: str`
2. `GET /api/warehouse360/inbound` — Requires `warehouse_id: str` (SQL uses `:max_rows` with default parameter)
3. `GET /api/warehouse360/outbound` — Requires `warehouse_id: str` (SQL uses `:max_rows` with default parameter)
4. `GET /api/warehouse360/staging` — Requires `warehouse_id: str` (SQL uses `:max_rows` with default parameter)
5. `GET /api/warehouse360/exceptions` — Requires `warehouse_id: str` (SQL uses `:max_rows` with default parameter)

---

## 🗄️ 2. Databricks Source Objects & Column Mappings

The native endpoints query the following confirmed Unity Catalog views:

| Target View | Selected Columns | Date Columns | Plant ID Column | Warehouse ID Column |
|---|---|---|---|---|
| `wh360_cockpit_summary_v` | `PLANT_ID`, `WAREHOUSE_ID`, various summary counts | None | `PLANT_ID` | `WAREHOUSE_ID` |
| `wh360_inbound_v` | `DOCUMENT_TYPE`, `PURCHASE_ORDER_ID`, `STOCK_TRANSPORT_ORDER_ID`, `ITEM_ID`, `VENDOR_ID`, `SUPPLYING_PLANT_ID`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `BATCH_ID`, `PLANT_ID`, `STORAGE_LOCATION`, `WAREHOUSE_NUMBER`, `EXPECTED_DATE`, `RECEIVED_DATE`, `QUANTITY`, `UNIT_OF_MEASURE`, `STATUS`, `EXCEPTION_REASON` | `EXPECTED_DATE`, `RECEIVED_DATE` | `PLANT_ID` | `WAREHOUSE_NUMBER` |
| `wh360_deliveries_v` | `DELIVERY_ID`, `DELIVERY_ITEM_ID`, `CUSTOMER_ID`, `SALES_ORDER_ID`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `BATCH_ID`, `PLANT_ID`, `STORAGE_LOCATION`, `WAREHOUSE_NUMBER`, `PLANNED_GOODS_ISSUE_DATE`, `ACTUAL_GOODS_ISSUE_DATE`, `QUANTITY`, `UNIT_OF_MEASURE`, `STATUS`, `EXCEPTION_REASON` | `PLANNED_GOODS_ISSUE_DATE`, `ACTUAL_GOODS_ISSUE_DATE` | `PLANT_ID` | `WAREHOUSE_NUMBER` |
| `staging_orders_v` | `PROCESS_ORDER_ID`, `RESERVATION_ID`, `RESERVATION_ITEM_ID`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `BATCH_ID`, `PLANT_ID`, `STORAGE_LOCATION`, `WAREHOUSE_NUMBER`, `REQUIREMENT_DATE`, `REQUIRED_QUANTITY`, `STAGED_QUANTITY`, `OPEN_QUANTITY`, `UNIT_OF_MEASURE`, `STAGING_STATUS`, `EXCEPTION_REASON` | `REQUIREMENT_DATE` | `PLANT_ID` | `WAREHOUSE_NUMBER` |
| `wh360_imwm_exceptions_v` | `EXCEPTION_TYPE`, `SEVERITY`, `MATERIAL_ID`, `BATCH_ID`, `PLANT_ID`, `STORAGE_LOCATION`, `WAREHOUSE_NUMBER`, `QUANTITY`, `UNIT_OF_MEASURE`, `EXPIRY_DATE`, `DAYS_TO_EXPIRY`, `DOCUMENT_ID`, `PROCESS_ORDER_ID`, `DELIVERY_ID`, `PURCHASE_ORDER_ID`, `REASON`, `RECOMMENDED_REVIEW_ACTION` | `EXPIRY_DATE` | `PLANT_ID` | `WAREHOUSE_NUMBER` |

---

## ⚙️ 3. Gap Analysis: Known Missing Filters & Enhancements

Currently, none of the native QuerySpecs support additional filters (like plant selection, date bounds, or custom limit caps). To achieve complete production readiness without UAT access, we can safely implement:

### A. What Can Be Safely Fixed / Hardened (No UAT Required)
1. **Query Parameters Extension:** Add `plant_id`, `date_from`, `date_to`, and `limit` to route handlers.
2. **Defensive Validation:** 
   - Reject empty/blank `warehouse_id` with HTTP 422.
   - Enforce `limit` bounds between `1` and `500` (default `100`).
   - Trim string parameters safely.
3. **Stronger Dataclasses & QuerySpecs:** 
   - Extend `WarehouseOverviewRequest` and other requests to hold all optional filters.
   - Inject optional `PLANT_ID = :plant_id` filter dynamically when provided.
   - Inject optional date filters dynamically on the confirmed date columns (e.g. `EXPECTED_DATE` for inbound, `PLANNED_GOODS_ISSUE_DATE` for outbound, `REQUIREMENT_DATE` for staging, `EXPIRY_DATE` for exceptions).
   - Accept date filters on the overview endpoint for contract compatibility, but do not apply them (documented as ignored pending source confirmation).
   - Replace the legacy `:max_rows` query parameter with a strictly bounded integer literal interpolation `{request.limit}` (matching the `envmon` package's clean and safe implementation).
4. **Stronger Data Contracts & Mappers:**
   - Extend TypeScript and Python Zod contracts to ensure nulls are handled defensively and IDs preserve leading zeros.
   - Hardcode exception severity mappings based on deterministic `daysToExpiry` math.
5. **Frontend Adapter Alignment:**
   - Update `Warehouse360LegacyApiAdapter` to forward all query parameters dynamically in `GET` fetch requests.
6. **Claude's Verification Help Doc:**
   - Build a comprehensive `warehouse360-native-browser-verification.md` guide for Claude.

### B. What Must Wait for UAT Verification by Claude
- Confirming whether `PLANT_ID` columns contain exact standard codes (e.g. `C061`, `IE10`) across all views.
- Validating the exact date formats stored in Databricks (e.g., standard SQL date versus datetime strings).
- Final end-to-end integration tests connecting browser panels to live Unity Catalog views.
