# Databricks Vertical Slices — POH and CQ Lab: Implementation Plan

**Date:** 2026-05-16  
**Scope:** First native Databricks data-access slices for Process Order History (POH) and Connected Quality Lab (CQ)  
**Reference:** ADR-024 (`docs/adr/ADR-024-native-databricks-data-access-architecture.md`)

---

## Summary Decision Table

| Slice | Method | Source | Decision |
|-------|--------|--------|----------|
| POH — order header | `getProcessOrderHeader` | `vw_gold_process_order` | **Implement** |
| POH — operations | `getOrderOperations` | `vw_gold_process_order_phase` | **Implement** |
| CQ — lab plants | `getLabPlants` | `gold_plant` | **Implement** |
| CQ — lab failures | `getLabFailures` | `vw_gold_quality_result_enriched` + `vw_gold_process_order_plan` | **Defer — blocked** |

---

## Slice 1 — POH: `getProcessOrderHeader`

**Slice name:** `poh.get_process_order_header`

**User value:** Supervisors and line managers see live process order header data (status, quantities, dates) from Databricks instead of mock data. Eliminates the risk of presenting stale or fictional operational context during pilot.

**Existing V2 panel/adapter method:** `getProcessOrderHeader` in `ProcessOrderReviewAdapter` (mock) and `ProcessOrderReviewLegacyApiAdapter` (wired, not browser-verified)

**Existing V2 contract:** `ProcessOrderHeaderSchema` in `packages/data-contracts/src/schemas/process-order-review.ts`
- Required: `processOrderId`, `orderType`, `materialId`, `materialDescription`, `plantId`, `plannedQuantity`, `confirmedQuantity`, `uom`, `plannedStart`, `plannedFinish`, `orderStatus`
- Optional: `batchId`, `productionLine`, `scrapQuantity`, `actualStart`, `actualFinish`

**Existing mock data source:** `domain-integrations/operations/src/adapters/process-order-review-mock-data.ts`

**Existing legacy-api status:** Wired — `POST /api/por/order-header` exists in `apps/api/routes/process_order.py`. Not browser-verified.

**Proposed Databricks source:** `vw_gold_process_order` in `connected_plant_uat`  
Per `docs/adapters/poh-adapter-migration-strategy.md`.

**Required input parameters:**
- `process_order_id: str` — SAP order number (AUFNR)
- `plant_id: str | None` — optional plant filter (WERKS)

**Required output fields (maps to ProcessOrderHeaderSchema):**
- `process_order_id` → `processOrderId`
- `order_type` → `orderType` (enum: must map SAP AUART codes to V2 enum values)
- `material_id` → `materialId` (MATNR)
- `material_description` → `materialDescription` (MAKTX)
- `batch_id` → `batchId` (CHARG, optional)
- `plant_id` → `plantId` (WERKS)
- `production_line` → `productionLine` (ARBPL, optional)
- `planned_quantity` → `plannedQuantity` (GAMNG)
- `confirmed_quantity` → `confirmedQuantity` (WEMNG)
- `uom` → `uom` (GMEIN)
- `planned_start` / `planned_finish` → ISO datetime
- `actual_start` / `actual_finish` → ISO datetime, optional
- `order_status` → `orderStatus` (enum mapping required)

**User OAuth requirement:** Yes — all Databricks reads use the authenticated user's OAuth token. `QueryExecutor.execute()` calls `identity.require_user_oauth()` before any query.

**Cache policy:** `PER_USER_60S` — order status changes during a shift; per-user caching prevents stale status leaking across users.

**Query tags:** `["poh", "process-order", "header"]`

**Test strategy:**
- Unit test `get_process_order_header_spec()`: verify QuerySpec fields (name, module, endpoint, cache_policy, tags)
- Verify plant_id filter: when plant_id set, SQL contains `AND werks = :plant_id` and params includes `plant_id`
- Verify no plant_id: SQL does not contain `AND werks` and params does not include `plant_id`
- Integration test (future): execute against `connected_plant_uat` with known order ID, validate response shape against `ProcessOrderHeaderSchema`

**Risk:** Medium — column names in `vw_gold_process_order` are unverified (SAP naming conventions assumed). SQL tagged with TODO on every column; must be verified before route wiring goes live.

**Decision: IMPLEMENT** (QuerySpec + adapter + tests only; route wiring deferred until column names verified and legacy-api browser-verified)

---

## Slice 2 — POH: `getOrderOperations`

**Slice name:** `poh.get_order_operations`

**User value:** Supervisors see the operation-by-operation breakdown of a process order — what has been confirmed, what is in progress, what is pending. This is the primary tactical view for shift handover.

**Existing V2 panel/adapter method:** `getOrderOperations` in `ProcessOrderReviewAdapter` (mock only; no legacy-api override)

**Existing V2 contract:** `ProcessOrderOperationSchema` in `packages/data-contracts/src/schemas/process-order-review.ts`
- Required: `operationId`, `operationNumber`, `operationText`, `workCentre`, `plannedStart`, `plannedFinish`, `status`, `plannedDurationMinutes`, `confirmationStatus`, `confirmed`, `hasException`
- Optional: `resource`, `actualStart`, `actualFinish`, `actualDurationMinutes`

**Existing mock data source:** `domain-integrations/operations/src/adapters/process-order-review-mock-data.ts`

**Existing legacy-api status:** No legacy-api override exists. Mock only.

**Proposed Databricks source:** `vw_gold_process_order_phase` in `connected_plant_uat`  
Per `docs/adapters/poh-adapter-migration-strategy.md` — maps to SAP AFVO (operation) data.

**Required input parameters:**
- `process_order_id: str` — SAP order number (AUFNR)

**Required output fields:**
- `operation_number` → `operationNumber` (VORNR — 4-digit op sequence)
- `operation_text` → `operationText` (LTXA1)
- `work_centre` → `workCentre` (ARBPL)
- `planned_start` / `planned_finish` → ISO datetime (FSAVD/FSAED)
- `actual_start` / `actual_finish` → ISO datetime, optional (ISDD/IEDD)
- `status_raw` → `status` (enum mapping: pending/in-progress/confirmed/skipped)
- `planned_duration_minutes` → `plannedDurationMinutes` (DAUNO)
- `actual_duration_minutes` → `actualDurationMinutes`, optional (IAUNO)
- `has_confirmation` → `confirmed`, `hasException`

**User OAuth requirement:** Yes

**Cache policy:** `PER_USER_60S` — operation status updates as confirmations are posted during the shift.

**Query tags:** `["poh", "process-order", "operations"]`

**Test strategy:**
- Unit test `get_order_operations_spec()`: verify QuerySpec fields
- Verify params contains `process_order_id`
- Verify SQL contains `ORDER BY vornr` (operation sequence ordering)
- Integration test (future): execute against `connected_plant_uat`, validate each row against `ProcessOrderOperationSchema`

**Risk:** Medium — column names unverified. No legacy-api baseline available for parallel validation.

**Decision: IMPLEMENT** (QuerySpec + adapter + tests only; route wiring deferred)

---

## Slice 3 — CQ: `getLabPlants`

**Slice name:** `cq.get_lab_plants`

**User value:** The Lab Board plant selector is populated from Databricks instead of mock data. Users see only plants that actually have inspection data published, preventing selection of invalid plants.

**Existing V2 panel/adapter method:** `getLabPlants` in `ConnectedQualityLabAdapter` (mock) and `ConnectedQualityLabLegacyApiAdapter` (wired, not browser-verified)

**Existing V2 contract:** `ConnectedQualityLabPlantsResponseSchema` in `packages/data-contracts/src/schemas/connected-quality-lab.ts`
- Response: `{ plants: ConnectedQualityLabPlant[] }`
- Per plant: `plantId: string`, `plantName: string`
- V1 field names: `plant_id`, `plant_name`

**Existing mock data source:** `domain-integrations/quality/src/adapters/connected-quality-lab-mock-data.ts`

**Existing legacy-api status:** Wired — `GET /api/cq/lab/plants` exists in `apps/api/routes/connected_quality_lab.py`. Not browser-verified.

**Proposed Databricks source:** `gold_plant` table in `connected_plant_uat`  
Simple dimension lookup. SAP T001W plant master table equivalent.

**Required input parameters:** None

**Required output fields:**
- `werks` (or `plant_id`) → `plantId`
- `name1` (or `plant_name`) → `plantName`

**User OAuth requirement:** Yes

**Cache policy:** `GLOBAL_300S` — plant list is a slow-moving dimension; 5-minute global cache reduces Databricks load.

**Query tags:** `["cq", "lab", "plants"]`

**Test strategy:**
- Unit test `get_lab_plants_spec()`: verify QuerySpec fields, cache_policy=GLOBAL_300S, empty params
- Verify SQL contains `ORDER BY werks`
- Integration test (future): execute against `connected_plant_uat`, validate each row against `ConnectedQualityLabPlantSchema`

**Risk:** Low — `gold_plant` is a standard dimension table with SAP T001W semantics. Column names are the most likely point of variance.

**Decision: IMPLEMENT** (QuerySpec + adapter + tests only; route wiring deferred)

---

## Slice 4 — CQ: `getLabFailures` (DEFERRED)

**Slice name:** `cq.get_lab_failures`

**User value:** Lab Board failure cards show live inspection failures from Databricks. Eliminates the need for the V1 CQ backend proxy once verified.

**Existing V2 panel/adapter method:** `getLabFailures` in `ConnectedQualityLabAdapter` (mock) and `ConnectedQualityLabLegacyApiAdapter` (wired, not browser-verified)

**Existing V2 contract:** `ConnectedQualityLabFailuresResponseSchema`
- Per failure: `mat`, `matNo`, `lot`, `batch`, `line` **(REQUIRED)**, `char`, `text`, `res`, `lo`, `hi`, `units`, `sev`, `ts`, `lotType`
- The `line` field is `z.string()` (non-optional) — must be populated for every failure row

**Existing mock data source:** `domain-integrations/quality/src/adapters/connected-quality-lab-mock-data.ts`

**Existing legacy-api status:** Wired — `GET /api/cq/lab/fails` exists. Not browser-verified.

**Proposed Databricks source:** `vw_gold_quality_result_enriched` (for inspection result data) + `vw_gold_process_order_plan` (for `line` enrichment)

**Blocker:** `vw_gold_process_order_plan` does not exist in `csm_process_order_history`. The `line` field cannot be sourced without this view. Since `line` is required in the V2 contract (non-optional `z.string()`), the schema cannot be satisfied from available gold views.

**Risk:** High — view missing, field required, no workaround without schema change. Schema change is out of scope for this tranche.

**Decision: DEFER** — See `docs/migration/cq-lab-databricks-blockers.md` for the full blocker analysis.

---

## Implementation Scope (This Tranche)

**What IS in scope:**
1. `apps/api/shared/query_service/` — QuerySpec/QueryExecutor infrastructure (Python)
2. `apps/api/adapters/poh/poh_databricks_adapter.py` — QuerySpec functions for slices 1 and 2
3. `apps/api/adapters/cq/cq_databricks_adapter.py` — QuerySpec function for slice 3
4. Unit tests for all of the above
5. `docs/migration/cq-lab-databricks-blockers.md` — getLabFailures blocker documented

**What is NOT in scope (deferred):**
- Route wiring: modifying `apps/api/routes/process_order.py` or `connected_quality_lab.py` to call QueryExecutor — deferred until column names are verified against live views and ADR-024 open questions #1/#7 are resolved
- TypeScript `DatabricksApiAdapter` classes — deferred until routes are wired (nothing to call)
- `getLabFailures` Databricks slice — blocked on missing view
- Any new workspaces, governance screens, or pilot phases
