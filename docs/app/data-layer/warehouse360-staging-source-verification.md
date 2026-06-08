# Warehouse staging orders source-verification — Gate Item 2

> **Status**: source-verification PR. **Not** an implementation PR. No runtime
> code is changed by this document. The next implementation PR is described
> in [§5](#5-recommended-next-implementation-pr).

## 1. Why this document exists

The [WarehouseOperationalSnapshot gating spec](../app-data-layer/data-products/warehouse-operational-snapshot.md)
lists five non-negotiable prerequisite gates. **Gate 2** is the
`staging_orders_v` view-existence gap:

- The current `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`
  `get_warehouse_staging_spec` SQL targets `connected_plant_uat.wh360.staging_orders_v`.
- That view **does not exist** in UAT. `GET /api/warehouse360/staging`
  therefore returns HTTP 500 against live Databricks.
- The closest available staging-relevant view is
  `connected_plant_uat.wh360.wh360_process_orders_v`.

This doc closes Gate 2 by recording the mapping path from the actual
`wh360_process_orders_v` columns into `Warehouse360StagingItemSchema`,
the items where governance is still required, and the next safe
implementation PR.

## 2. Verification method used

**Source of truth**: the prior live verification recorded in
[`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md)
(2026-05-19, `connected_plant_uat`, end-user OAuth through the Statement API).

This PR does **not** re-run `DESCRIBE TABLE` or a sample query — the prior
verification is the source of truth for `wh360_process_orders_v` column
shape. The implementation PR (§5) must re-verify before it lands.

| Item                       | Value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Expected adapter view      | `connected_plant_uat.wh360.staging_orders_v`                                                      |
| Expected view status       | **does not exist in UAT** (per 2026-05-22 audit)                                                  |
| Closest available view     | `connected_plant_uat.wh360.wh360_process_orders_v`                                                |
| Verification date          | 2026-05-19 (prior) — **not** re-verified in this PR                                               |
| Verification environment   | UAT                                                                                               |
| Verification method        | `DESCRIBE TABLE` + sample query through end-user OAuth                                            |
| Source of truth in this PR | [`warehouse360-overview-contract-alignment.md` §3](./warehouse360-overview-contract-alignment.md) |

## 3. Source-verification mapping table

Every field in `Warehouse360StagingItemSchema`
([`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts)
line 273) mapped against:

- the column name the current adapter SQL references (broken — view doesn't exist)
- the actual column in `wh360_process_orders_v` (the recommended replacement source)
- the mapper transformation required when the adapter is rewritten

| Contract field              | Current adapter SQL reference (broken — staging_orders_v missing) | Actual source column (`wh360_process_orders_v`)                     | Source type   | Transformation                                                                                                                 | Confidence | Verification status                                         | Notes                                                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `processOrderId`            | `PROCESS_ORDER_ID`                                                | `order_id` (or `sap_order`)                                         | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      | `wh360_process_orders_v` carries both `order_id` (internal) and `sap_order`. Pick `sap_order` for SAP-facing identifiers; document the choice.                                                                                                              |
| `reservationId`             | `RESERVATION_ID`                                                  | `reservation_no`                                                    | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `reservationItemId`         | `RESERVATION_ITEM_ID`                                             | **absent**                                                          | n/a           | Default `null`                                                                                                                 | Medium     | unresolved-pending-source                                   | `wh360_process_orders_v` exposes the reservation header but not the reservation line. If line-level granularity is needed, the data platform must add a reservation-item column or expose a separate view.                                                  |
| `materialId` (**required**) | `MATERIAL_ID`                                                     | `material_id`                                                       | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `materialDescription`       | `MATERIAL_DESCRIPTION`                                            | `material_name`                                                     | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `batchId`                   | `BATCH_ID`                                                        | `batch_id`                                                          | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `plantId`                   | `PLANT_ID`                                                        | `plant_id`                                                          | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `storageLocation`           | `STORAGE_LOCATION`                                                | **absent**                                                          | n/a           | Default `null`                                                                                                                 | Medium     | unresolved-pending-source                                   | The process-orders view operates at order header level and does not break out staging storage location. If the panel needs SL per row, the data platform must add the column or surface a sibling view.                                                     |
| `warehouseNumber`           | `WAREHOUSE_NUMBER`                                                | **absent**                                                          | n/a           | Default `null`                                                                                                                 | High       | verified-data-platform-change-needed-OR-contract-relaxation | The view has no LGNUM. Same gap as in Gate 1 inbound: the `warehouseNumber` filter requirement should be made nullable in the request, not faked at the mapper.                                                                                             |
| `requirementDate`           | `REQUIREMENT_DATE`                                                | `sched_start` (or `planned_start`)                                  | date/datetime | Rename + ISO-format                                                                                                            | Medium     | verified-backend-adapt                                      | The contract field is ambiguous. `sched_start` is the scheduled production-order start (which staging must precede); `planned_start` is the planned start (less operationally meaningful). Use `sched_start` for the cockpit panel and document the choice. |
| `requiredQuantity`          | `REQUIRED_QUANTITY`                                               | `order_qty`                                                         | numeric       | Direct                                                                                                                         | Medium     | verified-backend-adapt                                      | `order_qty` is the production-order quantity. Strictly speaking that is the order requirement, not the staging requirement; a multi-component order may stage multiple materials. Document the choice and flag for governance.                              |
| `stagedQuantity`            | `STAGED_QUANTITY`                                                 | **derived** from `staging_pct * order_qty`                          | numeric       | Derive: `staging_pct * order_qty`; classify as `application-heuristic`                                                         | Medium     | verified-backend-adapt                                      | `staging_pct` is the only staging-progress field on `wh360_process_orders_v`. Treat the resulting numeric as a derived/heuristic value, not a source-of-truth quantity.                                                                                     |
| `openQuantity`              | `OPEN_QUANTITY`                                                   | **derived** from `(1 - staging_pct) * order_qty`                    | numeric       | Derive                                                                                                                         | Medium     | verified-backend-adapt                                      | Same caveat as `stagedQuantity`.                                                                                                                                                                                                                            |
| `unitOfMeasure`             | `UNIT_OF_MEASURE`                                                 | `uom`                                                               | string        | Rename                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                             |
| `stagingStatus`             | `STAGING_STATUS`                                                  | **derived** from `staging_pct` (+ `to_items_done`/`to_items_total`) | string        | Derive: `'open'` if `staging_pct < 1`, `'staged'` if `staging_pct >= 1`, `null` otherwise; classify as `application-heuristic` | Medium     | verified-data-platform-change-needed-OR-contract-relaxation | The source has no explicit staging status column. Splitting `stagingStatus` (heuristic) from `risk` (source-field) would be cleaner; tracked as a follow-up.                                                                                                |
| `exceptionReason`           | `EXCEPTION_REASON`                                                | **absent**                                                          | n/a           | Default `null`                                                                                                                 | High       | verified-data-platform-change-needed-OR-contract-relaxation | Same gap as in Gate 1 inbound: exceptions belong to `imwm_exceptions_v`, not here. Recommend dropping `exceptionReason` from `Warehouse360StagingItemSchema`.                                                                                               |

### 3.1 Filter parameters (WHERE clause)

| Adapter param           | Current SQL reference (broken)                   | Actual column                               | Transformation                       | Notes                                                                    |
| ----------------------- | ------------------------------------------------ | ------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `warehouse_id`          | `WAREHOUSE_NUMBER = :warehouse_id`               | **absent**                                  | Drop filter (or remap to `plant_id`) | Blocks API signature change — see [§4](#4-gate-decision).                |
| `plant_id`              | `PLANT_ID = :plant_id`                           | `plant_id`                                  | Case-only                            | Works once the SQL is rewritten with lower-case column names + new view. |
| `date_from` / `date_to` | `REQUIREMENT_DATE >= :date_from` / `<= :date_to` | `sched_start >= :date_from` / `<= :date_to` | Rename                               | Works once SQL rewritten.                                                |

## 4. Gate decision

**Gate 2 status**: `verified-backend-adapt` (with three `unresolved-pending-source` / `verified-data-platform-change-needed` sub-items).

| Decision dimension                    | Outcome                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommended fix path                  | **Backend adapter rewrite** to consume `wh360_process_orders_v`. The view exists with the right shape; we do not need to ask the data platform to create a new `staging_orders_v`.                                                                                                                                            |
| Data-platform requests still required | (a) Decide whether reservation-line granularity (`reservationItemId`) is needed; if yes, add a column or expose a sibling view. (b) Decide whether storage-location-per-row is needed; same options. (c) Decide whether `wh360_process_orders_v` should carry LGNUM, or whether the staging contract drops `warehouseNumber`. |
| Contract changes required             | (a) Make `warehouseNumber` optional/nullable in the request — the view does not expose LGNUM. (b) Drop `exceptionReason` from `Warehouse360StagingItemSchema` — exceptions belong to the exceptions route. (c) Reclassify derived `stagingStatus` / `stagedQuantity` / `openQuantity` as `application-heuristic`.             |
| Owner                                 | Backend (adapter rewrite) + Inventory team for staging-line granularity + LGNUM governance                                                                                                                                                                                                                                    |
| Blocker for L3?                       | This PR alone does not unblock L3; it documents Gate 2. The actual unblock is the implementation PR in §5.                                                                                                                                                                                                                    |

## 5. Recommended next implementation PR

Scope (single PR, do not split):

1. Rewrite `get_warehouse_staging_spec` SQL to consume
   `connected_plant_uat.wh360.wh360_process_orders_v` (resolved via
   `resolve_domain_object("wh360", "wh360_process_orders_v")` once the
   object resolver knows about it).
2. Rewrite `map_warehouse_staging_rows` per the mapping table in
   [§3](#3-source-verification-mapping-table). The derived
   `stagedQuantity` / `openQuantity` / `stagingStatus` MUST be classified
   as `application-heuristic` in their docstring.
3. Update `Warehouse360StagingItemSchema` per [§4](#4-gate-decision):
   - `warehouseNumber` → nullable in the request signature
   - drop `exceptionReason`
   - add classification markers for the derived fields
4. Regenerate `apps/api/contracts/generated.py`.
5. Keep `response_model=list[Warehouse360StagingItem]` on the route.
6. Update `apps/api/tests/routes/test_warehouse360_routes.py` and
   `apps/api/tests/adapters/warehouse360/test_warehouse360_adapter.py`
   to exercise the new column-name flow.
7. Add direct mapper unit tests covering the three derived branches
   (open / staged / null).
8. Capture browser-UAT evidence per
   [`route-readiness-standard.md`](../app-data-layer/route-readiness-standard.md).

Until this PR lands:

- `GET /api/warehouse360/staging` continues to return HTTP 500 against live UAT.
- `response_model` stays as-is; no behaviour change in this PR.
- No UI panel may render against the live route.
- Default-to-zero or default-to-empty behaviour is forbidden by the
  WarehouseOperationalSnapshot spec §8.

## 6. Items still unresolved pending source / governance

| Item                                                                                                                    | Why unresolved                                                                                                                                 | Whose decision                 |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Is reservation-line granularity (`reservationItemId`) required for the staging cockpit?                                 | `wh360_process_orders_v` carries only the reservation header (`reservation_no`).                                                               | Inventory team                 |
| Is per-row storage location (`storageLocation`) required?                                                               | Not carried by `wh360_process_orders_v`.                                                                                                       | Inventory team + data platform |
| Should the staging contract distinguish `stagingStatus` (heuristic) from `risk` (source-field)?                         | The current contract collapses them. The source carries an explicit `risk` column that is potentially more governable than the derived status. | Inventory team                 |
| Is `order_qty` an acceptable proxy for `requiredQuantity`, or does the cockpit need component-level staging quantities? | A multi-component process order may stage multiple materials; `order_qty` represents the finished good, not the component being staged.        | Inventory team                 |
| Is `sched_start` the right `requirementDate`?                                                                           | `sched_start` and `planned_start` differ; the staging-by date is implicit.                                                                     | Inventory team                 |

## 7. Forbidden until the implementation PR lands

Per the WarehouseOperationalSnapshot gating spec §8 — repeated here so this
doc is self-contained:

- **No** mass-rewriting of the staging mapper without the contract changes in [§4](#4-gate-decision).
- **No** invented staging status or open/overdue rules.
- **No** UI panel wired against the live route.
- **No** default-to-zero or default-to-empty on counts / lists.
- **No** UOM conversion across `wh360_process_orders_v.uom` and child material UOMs.
- **No** production-readiness claim. **No** browser-UAT claim.
- **No** runtime code change in this PR — this is documentation only.

## 8. Cross-references

- [`docs/app-data-layer/data-products/warehouse-operational-snapshot.md`](../app-data-layer/data-products/warehouse-operational-snapshot.md) — gating spec (this doc closes Gate 2)
- [`docs/data-layer/warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md) — Gate 1 (companion pattern)
- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md) — original live verification (2026-05-19)
- [`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`](../../apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py) — the adapter file the next PR rewrites
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — the contract file the next PR updates
