# `wh360_inbound_v` source-verification — Gate Item 1

> **Status**: source-verification PR. **Not** an implementation PR. No runtime
> code is changed by this document. The next implementation PR is described
> in [§5](#5-recommended-next-implementation-pr).

## 1. Why this document exists

The [WarehouseOperationalSnapshot gating spec](../app-data-layer/data-products/warehouse-operational-snapshot.md)
lists five non-negotiable prerequisite gates that must close before any L3
implementation work on the Warehouse data product can proceed. **Gate 1** is
the `wh360_inbound_v` column-name mismatch:

- The current `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`
  `get_warehouse_inbound_spec` SQL selects column names that do not exist in
  the live view.
- `GET /api/warehouse360/inbound` therefore returns HTTP 500 against live
  Databricks with `UNRESOLVED_COLUMN: A column with name DOCUMENT_TYPE cannot be resolved`.

This doc closes Gate 1 by recording the **actual** column shape of
`wh360_inbound_v`, the recommended **backend-adapt** mapping path, and the
next safe implementation PR.

## 2. Verification method used

**Source of truth**: the prior live verification recorded in
[`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md)
(2026-05-19, `connected_plant_uat.wh360.wh360_inbound_v`, end-user OAuth
through the Statement API).

This PR does **not** re-run `DESCRIBE TABLE` or a sample query — the prior
verification is recent and complete enough to drive the mapping decision.
If the view DDL has changed since 2026-05-19, the implementation PR (§5)
must re-verify before it lands.

| Item                       | Value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Catalog / schema / view    | `connected_plant_uat.wh360.wh360_inbound_v`                                                       |
| Verification date          | 2026-05-19 (prior) — **not** re-verified in this PR                                               |
| Verification environment   | UAT                                                                                               |
| Verification method        | `DESCRIBE TABLE` + sample query through end-user OAuth                                            |
| Source of truth in this PR | [`warehouse360-overview-contract-alignment.md` §3](./warehouse360-overview-contract-alignment.md) |

## 3. Source-verification mapping table

Every field in `Warehouse360InboundItemSchema`
([`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts)
line 221) mapped against:

- the column name the current adapter SQL references (broken)
- the actual column name in `wh360_inbound_v`
- the mapper transformation required when the adapter is rewritten

| Contract field                                | Current adapter SQL reference (broken) | Actual source column                                  | Source type | Transformation                                                                                                                                                                                        | Confidence | Verification status                                         | Notes                                                                                                                                                                                              |
| --------------------------------------------- | -------------------------------------- | ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentType` (`'PO' \| 'STO' \| 'unknown'`) | `DOCUMENT_TYPE`                        | `doc_type` (+ `doc_cat`)                              | string      | Normalise: `'PO'` if `doc_type` ∈ {`PO`, purchase}, `'STO'` if `doc_type` ∈ {`STO`, transport}, else `'unknown'`. Current mapper logic already does this — only the source column changes.            | High       | verified-backend-adapt                                      | `doc_cat` provides ancillary categorisation; not required for the enum.                                                                                                                            |
| `purchaseOrderId`                             | `PURCHASE_ORDER_ID`                    | `po_id`                                               | string      | Direct rename                                                                                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `stockTransportOrderId`                       | `STOCK_TRANSPORT_ORDER_ID`             | **absent**                                            | n/a         | Default `null` until source confirms an STO id column.                                                                                                                                                | Medium     | unresolved-pending-source                                   | `wh360_inbound_v` may only carry PO documents; STO docs may live in another view. Flag as data-platform follow-up.                                                                                 |
| `itemId`                                      | `ITEM_ID`                              | `po_item`                                             | string      | Direct rename                                                                                                                                                                                         | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `vendorId`                                    | `VENDOR_ID`                            | `vendor_id`                                           | string      | Case-only rename                                                                                                                                                                                      | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `supplyingPlantId`                            | `SUPPLYING_PLANT_ID`                   | **absent**                                            | n/a         | Default `null`. The view is plant-scoped via `plant_id`; the supplying plant of an STO is not modelled.                                                                                               | Medium     | unresolved-pending-source                                   | Tied to the same STO gap as above.                                                                                                                                                                 |
| `materialId` (**required**)                   | `MATERIAL_ID`                          | `material_id`                                         | string      | Case-only rename                                                                                                                                                                                      | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `materialDescription`                         | `MATERIAL_DESCRIPTION`                 | `material_name`                                       | string      | Rename                                                                                                                                                                                                | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `batchId`                                     | `BATCH_ID`                             | **absent**                                            | n/a         | Default `null`. Inbound PO lines do not have a goods-receipt batch until receipt happens; batch id lives downstream.                                                                                  | High       | verified-backend-adapt                                      | Behavioural change vs. broken adapter: `batchId` becomes `null` instead of throwing.                                                                                                               |
| `plantId`                                     | `PLANT_ID`                             | `plant_id`                                            | string      | Case-only rename                                                                                                                                                                                      | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `storageLocation`                             | `STORAGE_LOCATION`                     | `storage_loc`                                         | string      | Rename                                                                                                                                                                                                | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `warehouseNumber`                             | `WAREHOUSE_NUMBER`                     | **absent**                                            | n/a         | Default `null`. The view has `plant_id` and `storage_loc` but no LGNUM. Filter by warehouse number must be removed from the WHERE clause — or remapped to a plant filter.                             | High       | verified-data-platform-change-needed-OR-contract-relaxation | The current adapter rejects calls without a `warehouse_id` filter; the contract may need to drop that as a required input.                                                                         |
| `expectedDate`                                | `EXPECTED_DATE`                        | `delivery_date`                                       | date        | Rename + ISO-format                                                                                                                                                                                   | High       | verified-backend-adapt                                      | Used by the overview spec as the date filter; same column carries `due` / `overdue` semantics there.                                                                                               |
| `receivedDate`                                | `RECEIVED_DATE`                        | **derive from `delivery_complete` + `delivery_date`** | n/a         | When `delivery_complete = 'Y'` the line is received; otherwise `null`. The view does not carry a separate received-on timestamp.                                                                      | Medium     | verified-backend-adapt                                      | Strictly speaking we don't know **when** the GR posted — only that it has been posted. Surface as `null` if that distinction matters; otherwise echo `delivery_date` when complete.                |
| `quantity`                                    | `QUANTITY`                             | `open_qty` (+ `ordered_qty`, `gr_qty`)                | numeric     | The contract field is ambiguous — it might mean "ordered", "received", or "open". Map to `open_qty` (the still-due quantity) because that is what the inbound panel cares about; document the choice. | Medium     | verified-backend-adapt                                      | Recommend renaming the contract field to `openQuantity` in a follow-up, with sibling `orderedQuantity` / `receivedQuantity` as optional source-truthful fields.                                    |
| `unitOfMeasure`                               | `UNIT_OF_MEASURE`                      | `uom`                                                 | string      | Rename                                                                                                                                                                                                | High       | verified-backend-adapt                                      |                                                                                                                                                                                                    |
| `status`                                      | `STATUS`                               | **derived** from `delivery_complete` + `qa_status`    | string      | `'open'` if `delivery_complete != 'Y'` and `open_qty > 0`; `'received'` if `delivery_complete = 'Y'`; `qa_status` carries lot-disposition (`'on-hold'` etc.) but is not the document status.          | Low        | verified-data-platform-change-needed                        | Without an explicit document status column, a derived status is a heuristic. Mark as `application-heuristic` in the contract or split into `documentStatus` (derived) + `qaStatus` (source-field). |
| `exceptionReason`                             | `EXCEPTION_REASON`                     | **absent**                                            | n/a         | Default `null`. `wh360_inbound_v` does not carry an exception-reason column. Exceptions live in `imwm_exceptions_v`.                                                                                  | High       | verified-data-platform-change-needed-OR-contract-relaxation | The contract field is misplaced — exceptions belong to the exceptions route, not the inbound route. Recommend dropping from `Warehouse360InboundItemSchema`.                                       |

### 3.1 Filter parameters (WHERE clause)

| Adapter param           | Current SQL reference (broken)                | Actual column                                 | Transformation                     | Notes                                                         |
| ----------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `warehouse_id`          | `WAREHOUSE_NUMBER = :warehouse_id`            | **absent**                                    | Drop filter or remap to `plant_id` | Blocks API signature change — see [§4](#4-gate-decision).     |
| `plant_id`              | `PLANT_ID = :plant_id`                        | `plant_id`                                    | Case-only                          | Works once the SQL is rewritten with lower-case column names. |
| `date_from` / `date_to` | `EXPECTED_DATE >= :date_from` / `<= :date_to` | `delivery_date >= :date_from` / `<= :date_to` | Rename                             | Works once the SQL is rewritten.                              |

## 4. Gate decision

**Gate 1 status**: `verified-backend-adapt` (with two `unresolved-pending-source` items and one `verified-data-platform-change-needed-OR-contract-relaxation` item).

| Decision dimension                    | Outcome                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommended fix path                  | **Backend adapter rewrite** to consume actual view columns. Do not request data-platform column additions for the renamed fields — that would block on a different team and the renames are non-controversial.                                                                                                      |
| Data-platform requests still required | (a) Decide whether STO documents live in `wh360_inbound_v` or in a sibling view (`stockTransportOrderId`, `supplyingPlantId`). (b) Decide whether a governed `status` column should be added to `wh360_inbound_v` or whether the contract should split into `documentStatus` (derived) + `qaStatus` (source-field). |
| Contract changes required             | (a) Make `warehouseNumber` optional/nullable in the request — the view does not have LGNUM. (b) Drop `exceptionReason` from `Warehouse360InboundItemSchema` — exceptions belong to the exceptions route. (c) Optional: rename `quantity` → `openQuantity` and add `orderedQuantity` / `receivedQuantity` siblings.  |
| Owner                                 | Backend (adapter rewrite) + Inventory team (governance decisions for the two `unresolved-pending-source` items)                                                                                                                                                                                                     |
| Blocker for L3?                       | This PR alone does not unblock L3; it documents Gate 1. The actual unblock is the implementation PR in §5.                                                                                                                                                                                                          |

## 5. Recommended next implementation PR

Scope (single PR, do not split):

1. Rewrite the adapter SQL in `get_warehouse_inbound_spec` to consume the
   actual `wh360_inbound_v` column names (mapping in [§3](#3-source-verification-mapping-table)).
2. Rewrite `map_warehouse_inbound_rows` to apply the column renames and
   the derived `status` / `receivedDate` rules.
3. Update `Warehouse360InboundItemSchema` per [§4](#4-gate-decision):
   - `warehouseNumber` → nullable in the request
   - drop `exceptionReason`
   - classify the new derived `status` as `application-heuristic` (or
     split as described)
4. Regenerate `apps/api/contracts/generated.py`.
5. Re-enable `response_model=list[Warehouse360InboundItem]` on the route.
6. Update `apps/api/tests/routes/test_warehouse360_routes.py` to exercise
   the new column-name flow.
7. Add direct mapper unit tests covering the derived-status branch and
   the open-vs-received case split.
8. Capture browser-UAT evidence per
   [`route-readiness-standard.md`](../app-data-layer/route-readiness-standard.md).

Until this PR lands:

- `GET /api/warehouse360/inbound` continues to return HTTP 500 against live UAT.
- `response_model` on the route stays disabled.
- No UI panel may render against the live route.
- Default-to-zero or default-to-empty behaviour is **forbidden** by the
  WarehouseOperationalSnapshot spec §8.

## 6. Items still unresolved pending source / governance

| Item                                                                                                                                                               | Why unresolved                                                                                                           | Whose decision                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Where do STO documents live in the warehouse data?                                                                                                                 | `wh360_inbound_v` columns suggest a PO-only view; `stockTransportOrderId` and `supplyingPlantId` have no obvious source. | Data platform                  |
| Is the derived `status` (`'open'` / `'received'`) governance-acceptable, or should the contract distinguish `documentStatus` (heuristic) from `qaStatus` (source)? | The current contract collapses both into `status`; the live view exposes them separately.                                | Inventory team + data platform |
| Should `quantity` mean "open", "ordered", or "received"?                                                                                                           | All three are present in the source; the contract has only one field.                                                    | Inventory team                 |
| Is the `warehouseNumber` filter requirement appropriate when the view exposes only `plant_id` + `storage_loc`?                                                     | The current adapter signature blocks calls without `warehouse_id`. The live view has no LGNUM.                           | Backend + Inventory team       |

## 7. Forbidden until the implementation PR lands

Per the WarehouseOperationalSnapshot gating spec §8 — repeated here so this
doc is self-contained:

- **No** mass-rewriting of the inbound mapper without the contract changes in [§4](#4-gate-decision).
- **No** re-enablement of `response_model` on `/api/warehouse360/inbound`.
- **No** wiring of a frontend panel against the live route.
- **No** default-to-zero or default-to-empty on counts / lists — that reads
  as "all good" when actually we don't know.
- **No** `nearExpiryCount` / `reconciliationExceptionCount` derivation
  changes; those are out of scope for Gate 1.
- **No** `due` / `overdue` business rules invented — Gates 4 and 5 cover
  those thresholds and must close before the rules are encoded.
- **No** production-readiness claim. **No** browser-UAT claim.

## 8. Cross-references

- [`docs/app-data-layer/data-products/warehouse-operational-snapshot.md`](../app-data-layer/data-products/warehouse-operational-snapshot.md) — gating spec (this doc closes Gate 1)
- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md) — original live verification (2026-05-19)
- [`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`](../../apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py) — the adapter file the next PR rewrites
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — the contract file the next PR updates
