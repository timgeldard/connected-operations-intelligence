# Warehouse IM/WM exceptions source-verification — Gate Item 3

> **Status**: source-verification PR. **Not** an implementation PR. No runtime
> code is changed by this document. The next implementation PR is described
> in [§5](#5-recommended-next-implementation-pr).

## 1. Why this document exists

The [WarehouseOperationalSnapshot gating spec](../app-data-layer/data-products/warehouse-operational-snapshot.md)
lists five non-negotiable prerequisite gates. **Gate 3** is the
`wh360_imwm_exceptions_v` view-existence gap:

- The current `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`
  `get_warehouse_exceptions_spec` SQL targets
  `connected_plant_uat.wh360.wh360_imwm_exceptions_v`.
- That view **does not exist** in UAT. The actual name is `imwm_exceptions_v`
  (no `wh360_` prefix). `GET /api/warehouse360/exceptions` therefore returns
  HTTP 500 against live Databricks
  (`TABLE_OR_VIEW_NOT_FOUND: connected_plant_uat.wh360.wh360_imwm_exceptions_v`).

This doc closes Gate 3 by recording the column-by-column mapping path from
the actual `imwm_exceptions_v` shape into `Warehouse360ExceptionItemSchema`,
the items where governance is still required, and the next safe
implementation PR.

## 2. Verification method used

**Source of truth**: the prior live verification recorded in
[`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md)
(2026-05-19, `connected_plant_uat`, end-user OAuth through the Statement API).

This PR does **not** re-run `DESCRIBE TABLE` or a sample query — the prior
verification is the source of truth for `imwm_exceptions_v` column shape.
The implementation PR (§5) must re-verify before it lands.

| Item                       | Value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Expected adapter view      | `connected_plant_uat.wh360.wh360_imwm_exceptions_v`                                               |
| Expected view status       | **does not exist in UAT** (`TABLE_OR_VIEW_NOT_FOUND`)                                             |
| Actual view name           | `connected_plant_uat.wh360.imwm_exceptions_v` (no `wh360_` prefix)                                |
| Verification date          | 2026-05-19 (prior) — **not** re-verified in this PR                                               |
| Verification environment   | UAT                                                                                               |
| Verification method        | `DESCRIBE TABLE` + sample query through end-user OAuth                                            |
| Source of truth in this PR | [`warehouse360-overview-contract-alignment.md` §3](./warehouse360-overview-contract-alignment.md) |

## 3. Source-verification mapping table

Every field in `Warehouse360ExceptionItemSchema`
([`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts)
line 298) mapped against:

- the column name the current adapter SQL references (broken — view name wrong)
- the actual column in `imwm_exceptions_v`
- the mapper transformation required

| Contract field                                           | Current adapter SQL reference (broken) | Actual source column (`imwm_exceptions_v`)       | Source type | Transformation                                                                                                                                                                                                                                                                            | Confidence | Verification status                                         | Notes                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exceptionType`                                          | `EXCEPTION_TYPE`                       | `exception_type`                                 | string      | Case-only rename                                                                                                                                                                                                                                                                          | High       | verified-backend-adapt                                      | Live data dominated by `EXPIRED_BATCH_WITH_STOCK`. The contract field is string-typed (not an enum) so the raw value passes through.                                                                                                                          |
| `severity` (`'critical' \| 'high' \| 'medium' \| 'low'`) | derived from `SEVERITY`                | `severity` (int) + `sla_hours` + `detected_date` | int → enum  | The view's `severity` is numeric. The existing `_map_exception_severity` helper derives the contract enum from `days_to_expiry` (when present) or a free-text severity string. Re-evaluate: with `severity: int`, decide the int→enum mapping (e.g. 1=critical, 2=high, 3=medium, 4=low). | Medium     | verified-data-platform-change-needed-OR-contract-relaxation | The contract enum is governance-controlled. Without an authoritative int↔enum table from Inventory team, the only safe default is `null` (i.e. contract relaxation to `nullable`). Document the int values seen and ask Inventory team to govern the mapping. |
| `materialId` (**required**)                              | `MATERIAL_ID`                          | `material_id`                                    | string      | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                               |
| `batchId`                                                | `BATCH_ID`                             | `batch_id`                                       | string      | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                               |
| `plantId`                                                | `PLANT_ID`                             | `plant_id`                                       | string      | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                               |
| `storageLocation`                                        | `STORAGE_LOCATION`                     | `storage_loc` (+ `storage_loc_name`)             | string      | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      | `storage_loc_name` is a human-readable label — surface as separate field only if needed.                                                                                                                                                                      |
| `warehouseNumber`                                        | `WAREHOUSE_NUMBER`                     | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | High       | verified-data-platform-change-needed-OR-contract-relaxation | Same gap as Gates 1 and 2: the view has no LGNUM. Make `warehouseNumber` filter optional/nullable in the request.                                                                                                                                             |
| `quantity`                                               | `QUANTITY`                             | `qty`                                            | numeric     | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      |                                                                                                                                                                                                                                                               |
| `unitOfMeasure`                                          | `UNIT_OF_MEASURE`                      | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | High       | verified-backend-adapt                                      | `imwm_exceptions_v` does not carry UOM directly; the sibling `imwm_stock_comparison_v` has `uom` if a join is desired (out of scope for this PR).                                                                                                             |
| `expiryDate`                                             | derived from `DAYS_TO_EXPIRY`          | `detected_date` is **not** the expiry date       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | The view exposes `detected_date` (when the exception was detected), not the batch expiry date. For `EXPIRED_BATCH_WITH_STOCK` rows the expiry is implicit but not surfaced; for other exception types it may not apply. Inventory team to confirm.            |
| `daysToExpiry`                                           | `DAYS_TO_EXPIRY`                       | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | Same gap. The `wh360_near_expiry_batches_v` view has `days_to_expiry` for batches; a JOIN would surface it but is out of scope.                                                                                                                               |
| `documentId`                                             | `DOCUMENT_ID`                          | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | The view has no document linkage. Whether the exceptions cockpit needs document drill-through is an Inventory-team decision.                                                                                                                                  |
| `processOrderId`                                         | `PROCESS_ORDER_ID`                     | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | Same — no PO linkage on `imwm_exceptions_v`.                                                                                                                                                                                                                  |
| `deliveryId`                                             | `DELIVERY_ID`                          | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | Same.                                                                                                                                                                                                                                                         |
| `purchaseOrderId`                                        | `PURCHASE_ORDER_ID`                    | **absent**                                       | n/a         | Default `null`                                                                                                                                                                                                                                                                            | Medium     | unresolved-pending-source                                   | Same.                                                                                                                                                                                                                                                         |
| `reason`                                                 | `REASON`                               | `detail_text`                                    | string      | Rename                                                                                                                                                                                                                                                                                    | High       | verified-backend-adapt                                      | The view's free-text detail acts as the reason.                                                                                                                                                                                                               |
| `recommendedReviewAction`                                | application-heuristic                  | n/a                                              | n/a         | Keep as null until a governed rule engine exists                                                                                                                                                                                                                                          | High       | not-applicable                                              | This is an `application-heuristic` field per the schema. Leave `null` rather than invent.                                                                                                                                                                     |

### 3.1 Filter parameters (WHERE clause)

| Adapter param           | Current SQL reference (broken)              | Actual column                                 | Transformation | Notes                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------- | --------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `warehouse_id`          | `WAREHOUSE_NUMBER = :warehouse_id`          | **absent**                                    | Drop filter    | Blocks API signature change — same gap as Gates 1 and 2.                                                                                                                                     |
| `plant_id`              | `PLANT_ID = :plant_id`                      | `plant_id`                                    | Case-only      | Works once SQL rewritten with lower-case column names + new view.                                                                                                                            |
| `date_from` / `date_to` | `EXPIRY_DATE >= :date_from` / `<= :date_to` | `detected_date >= :date_from` / `<= :date_to` | Rename         | The current SQL filters on `EXPIRY_DATE`; the actual view exposes `detected_date`. Document the semantic shift — these filters now mean "detected within range", not "expires within range". |

## 4. Gate decision

**Gate 3 status**: `verified-backend-adapt` (with 6 `unresolved-pending-source` sub-items and 1 governance ask on `severity` int→enum).

| Decision dimension                    | Outcome                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommended fix path                  | **Backend adapter rewrite** to consume `imwm_exceptions_v` (drop the `wh360_` prefix). The view exists; we do not need to ask the data platform to rename it.                                                                                                                                                       |
| Data-platform requests still required | (a) Define the int→enum mapping for `severity` (or relax the contract to nullable). (b) Decide whether `daysToExpiry` / `expiryDate` / document linkage are needed; if yes, add columns or join paths. (c) Decide whether `EXPIRED_BATCH_WITH_STOCK` rows count toward `reconciliationExceptionCount` — see Gate 5. |
| Contract changes required             | (a) Make `warehouseNumber` optional/nullable in the request. (b) Allow `severity` to be nullable until the int→enum mapping is governed (it is already `nullable().optional()` in the schema). (c) Document `expiryDate` / `daysToExpiry` / document linkage as "absent on source" rather than expected fields.     |
| Owner                                 | Backend (adapter rewrite) + Inventory team (severity int→enum, exception-type semantics)                                                                                                                                                                                                                            |
| Blocker for L3?                       | This PR alone does not unblock L3; it documents Gate 3. The actual unblock is the implementation PR in §5. Note that Gate 5 (`reconciliationExceptionCount` filter rule) is a separate governance question and remains open.                                                                                        |

## 5. Recommended next implementation PR

Scope (single PR, do not split):

1. Update `resolve_domain_object` to map `"wh360_imwm_exceptions_v"`
   to the actual `imwm_exceptions_v` view name (or simpler: change the
   adapter call to `resolve_domain_object("wh360", "imwm_exceptions_v")`).
2. Rewrite `get_warehouse_exceptions_spec` SQL to consume the actual
   columns (`exception_type`, `severity`, `sla_hours`, `material_id`,
   `material_name`, `plant_id`, `storage_loc`, `storage_loc_name`,
   `qty`, `batch_id`, `bin_id`, `detail_text`, `detected_date`).
3. Rewrite `map_warehouse_exceptions_rows` per the mapping table in
   [§3](#3-source-verification-mapping-table). The derived `severity`
   stays `null` until Inventory team confirms the int→enum mapping
   (the existing `_map_exception_severity` helper falls back to
   `'low'`, which is governance-unsafe — change to `null`).
4. Re-enable `response_model=list[Warehouse360ExceptionItem]` on the
   route — it is already declared today, so no toggle is needed.
5. Update `apps/api/tests/routes/test_warehouse360_routes.py` and
   `apps/api/tests/adapters/warehouse360/test_warehouse360_adapter.py`
   to exercise the new column-name flow and pin the source-truthful
   `null` fields.
6. Add direct mapper unit tests covering:
   - happy-path `EXPIRED_BATCH_WITH_STOCK` row
   - unknown `exception_type` value
   - `severity` int passes through as null (no invented enum)
   - absent fields (warehouseNumber, expiryDate, daysToExpiry, etc.)
     surface as `null`, not empty strings
   - `recommendedReviewAction` stays `null`
7. Capture browser-UAT evidence per
   [`route-readiness-standard.md`](../app-data-layer/route-readiness-standard.md).

Until this PR lands:

- `GET /api/warehouse360/exceptions` continues to return HTTP 500 against live UAT.
- No UI panel may render against the live route.
- `reconciliationExceptionCount` remains gated (Gate 5) — separate issue.
- `_map_exception_severity` continues to default to `'low'` in code, but
  the route never executes so the value never reaches the wire today.

## 6. Items still unresolved pending source / governance

| Item                                                                                                                                         | Why unresolved                                                                                                                                            | Whose decision               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `severity` int → enum mapping                                                                                                                | View carries `severity: int`; contract enum is `'critical'/'high'/'medium'/'low'`.                                                                        | Inventory team               |
| Is `EXPIRED_BATCH_WITH_STOCK` an IM/WM "reconciliation" exception?                                                                           | 90%+ of `imwm_exceptions_v` rows are this type. Including them inflates `reconciliationExceptionCount` past the operational meaning Inventory team wants. | Inventory team (also Gate 5) |
| Should the exceptions cockpit surface `expiryDate` / `daysToExpiry`?                                                                         | Source view does not carry these directly; a join to `wh360_near_expiry_batches_v` would surface them but increases query cost.                           | Inventory team               |
| Should documents (PO / SO / process order / delivery) link from exception rows?                                                              | Source view has none. Inventory team to confirm whether the cockpit panel needs drill-through.                                                            | Inventory team               |
| Is `detected_date` an acceptable proxy for the `date_from`/`date_to` filter, given the contract field name is currently `expiryDate`-shaped? | The semantic shift is real. Either rename the filter parameters, or change the SQL filter, or accept the shift and document it.                           | Backend + Inventory team     |
| Should `recommendedReviewAction` ever be populated, or stay perpetually null?                                                                | The schema classifies it as `application-heuristic` — needs a governed rule engine before it is populated.                                                | Inventory team               |

## 7. Forbidden until the implementation PR lands

Per the WarehouseOperationalSnapshot gating spec §8 — repeated here so this
doc is self-contained:

- **No** mass-rewriting of the exceptions mapper without the contract
  changes in [§4](#4-gate-decision).
- **No** invented `severity` enum values.
- **No** invented `recommendedReviewAction` text.
- **No** UI panel wired against the live route.
- **No** default-to-zero on exception counts.
- **No** inference of root cause.
- **No** inference of inventory accuracy failure without a governed rule.
- **No** treatment of exceptions as recall / safety risk.
- **No** production-readiness claim. **No** browser-UAT claim.
- **No** runtime code change in this PR — this is documentation only.

## 8. Cross-references

- [`docs/app-data-layer/data-products/warehouse-operational-snapshot.md`](../app-data-layer/data-products/warehouse-operational-snapshot.md) — gating spec (this doc closes Gate 3)
- [`docs/data-layer/warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md) — Gate 1 (companion pattern)
- [`docs/data-layer/warehouse360-staging-source-verification.md`](./warehouse360-staging-source-verification.md) — Gate 2 (companion pattern)
- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md) — original live verification (2026-05-19)
- [`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`](../../apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py) — the adapter file the next PR rewrites
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — the contract file the next PR may update
