# Data Product Spec — `WarehouseOperationalSnapshot`

> **Status: gating document.** This product is **L1/L2** under
> [`data-product-maturity-model.md`](../data-product-maturity-model.md) —
> source DDL is partially verified, the contract is defined but does not
> match the actual mapper output today, and 3 of 4 sibling warehouse
> routes are **broken in production** against live Databricks. This spec
> exists to gate any further implementation work until the prerequisites
> in [§7](#7-prerequisite-gate-must-close-before-l3-implementation-work)
> close.

## 1. At a glance

| Aspect               | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Business object      | **Plant warehouse operational state** (cross-batch, cross-material aggregates and exception lists)                              |
| Data product pattern | `Snapshot` (state at a specific point in time; see [`data-product-patterns.md`](../data-product-patterns.md))                   |
| Owner domain         | Warehouse / Inventory                                                                                                           |
| Lifecycle            | `concept-lab` (effective — contract exists, but route is misaligned with source)                                                |
| Maturity (today)     | **L1/L2** — source mapping partial, contract diverged from mapper, response_model intentionally disabled, sibling routes broken |
| Production readiness | **Blocked at the gate** — see [§7](#7-prerequisite-gate-must-close-before-l3-implementation-work)                               |
| Read-only            | Yes — no SAP write-back, no replenishment trigger, no goods-movement posting                                                    |

## 2. Why this data product exists

A plant warehouse coordinator's first question is "what should I be
looking at right now?" — across inbound receipts due / overdue, outbound
deliveries due / overdue, staging open / overdue, near-expiry stock,
reconciliation exceptions, and blocked stock. That's a Snapshot pattern:
**aggregate counts + per-domain exception lists, scoped to a plant**.

The product exists; the wiring to make it source-truthful does not.

## 3. What's defined today

### 3.1 Contract — `Warehouse360OverviewSchema`

File: `packages/data-contracts/src/schemas/warehouse-360-overview.ts`
Symbol: `Warehouse360OverviewSchema`

13 fields:

- Identifiers: `plantId`, `warehouseId` (both required strings)
- 9 KPI counts: `inboundDueCount`, `inboundOverdueCount`,
  `outboundDueCount`, `outboundOverdueCount`, `stagingOpenCount`,
  `stagingOverdueCount`, `nearExpiryCount`, `reconciliationExceptionCount`,
  `blockedStockCount` (all required ints ≥ 0)
- Metadata: `source` (optional string), `warnings` (optional string[])

There are also 4 supporting list contracts (`Warehouse360InboundItemSchema`,
`Warehouse360OutboundItemSchema`, `Warehouse360StagingItemSchema`,
`Warehouse360ExceptionItemSchema`) each carrying per-row detail for the
respective sibling routes.

### 3.2 Route — broken in 4 places

| Method · path                      | Status                               | Problem                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/warehouse360/overview`   | Returns V1 KPI shape                 | Mapper emits `ordersTotal`/`trsOpen`/`binsBlocked` etc.; frontend silently maps every count → 0                                                                                                 |
| `GET /api/warehouse360/inbound`    | **HTTP 500 against live Databricks** | Adapter SQL references columns that don't exist in `wh360_inbound_v` (`DOCUMENT_TYPE`, `PURCHASE_ORDER_ID`, `WAREHOUSE_NUMBER`, etc.). Live source uses `po_id`, `doc_type`, `delivery_date`, … |
| `GET /api/warehouse360/staging`    | **HTTP 500 against live Databricks** | Adapter references `connected_plant_uat.wh360.staging_orders_v` which **does not exist**. Closest available view is `wh360_process_orders_v`                                                    |
| `GET /api/warehouse360/exceptions` | **HTTP 500 against live Databricks** | Adapter references `wh360_imwm_exceptions_v` which **does not exist**. Correct view name is `imwm_exceptions_v` (no `wh360_` prefix)                                                            |
| `GET /api/warehouse360/outbound`   | Probably works                       | View `wh360_deliveries_v` exists with the right shape; not yet end-to-end verified                                                                                                              |

The audit recorded all four problems live against UAT in
[`docs/data-layer/warehouse360-overview-contract-alignment.md`](../../data-layer/warehouse360-overview-contract-alignment.md)
on 2026-05-22 with `connected_plant_uat` warehouse `e76480b94bea6ed5`.

### 3.3 `response_model` deliberately disabled

In PR #71 (backend contract enforcement), `GET /api/warehouse360/overview`
was **skipped** from `response_model` enforcement because the mapper
output doesn't satisfy `Warehouse360Overview`. The contract violation is
silent today; mock tests pass. Live Databricks reveals the truth.

Per the audit, `response_model` MUST NOT be re-enabled on this route
until the prerequisite gate in [§7](#7-prerequisite-gate-must-close-before-l3-implementation-work)
closes — re-enabling earlier would 500 every request.

## 4. Source mapping (target state)

Once the gate clears, the overview field-by-field mapping is **already
identified** (per `warehouse360-overview-contract-alignment.md`).

| Contract field                 | Target source view            | Derivation                                                                                                            | Confidence                                          |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `plantId`                      | request parameter             | Echo back from request                                                                                                | code-inferred                                       |
| `warehouseId`                  | request parameter             | Echo back from request                                                                                                | code-inferred                                       |
| `inboundDueCount`              | `wh360_inbound_v`             | `COUNT(*) WHERE delivery_date >= CURRENT_DATE AND delivery_complete != 'Y' AND open_qty > 0 AND plant_id = :plant_id` | DDL-confirmed; business rule **governance-pending** |
| `inboundOverdueCount`          | `wh360_inbound_v`             | Same with `delivery_date < CURRENT_DATE`                                                                              | DDL-confirmed; **governance-pending**               |
| `outboundDueCount`             | `wh360_deliveries_v`          | `COUNT(DISTINCT delivery_id) WHERE shipped = false AND delivery_date >= CURRENT_DATE AND plant_id = :plant_id`        | DDL-confirmed; **governance-pending**               |
| `outboundOverdueCount`         | `wh360_deliveries_v`          | Same with `planned_gi_date < CURRENT_DATE`                                                                            | DDL-confirmed; **governance-pending**               |
| `stagingOpenCount`             | `wh360_process_orders_v`      | `COUNT(*) WHERE staging_pct < 1 AND plant_id = :plant_id`                                                             | DDL-confirmed; **governance-pending**               |
| `stagingOverdueCount`          | `wh360_process_orders_v`      | `COUNT(*) WHERE sched_start < CURRENT_DATE AND staging_pct < 1 AND plant_id = :plant_id`                              | DDL-confirmed; **governance-pending**               |
| `nearExpiryCount`              | `wh360_near_expiry_batches_v` | `COUNT(*) WHERE days_to_expiry BETWEEN 0 AND ?`                                                                       | **Blocked — threshold unknown**                     |
| `reconciliationExceptionCount` | `imwm_exceptions_v`           | `COUNT(*) WHERE plant_id = :plant_id [AND exception_type IN …]`                                                       | **Blocked — exception-type filter unconfirmed**     |
| `blockedStockCount`            | `imwm_stock_comparison_v`     | `COUNT(*) WHERE blocked_qty > 0 AND plant_id = :plant_id`                                                             | DDL-confirmed and semantically clear                |
| `source`                       | adapter constant              | Hardcode `"databricks-api"`                                                                                           | code-inferred                                       |
| `warnings`                     | adapter constant              | Empty array unless aggregation degrades                                                                               | code-inferred                                       |

**7 of 9 counts are derivable from already-DDL-confirmed views.** Two
(`nearExpiryCount`, `reconciliationExceptionCount`) require governance
decisions before they can be honestly populated.

## 5. Governance gates

### 5.1 `nearExpiryCount` — threshold undefined

`wh360_near_expiry_batches_v` contains all batches with `days_to_expiry`
ranging from **-3505** (expired 9+ years ago) to **+90**. The view name
suggests a "near expiry" filter exists at the view level. It does not.

> A `COUNT(*)` against this view today would conflate truly expired
> stock with "due in 90 days" — misleading at the snapshot level.

**Governance question:** what `days_to_expiry` window defines "near
expiry" for this KPI? (30 days? 45? 90? plant-specific?)

Until answered, the mapper MUST emit `null` for `nearExpiryCount` and a
`warnings` entry. The schema must accept `null`. **Do not invent a
default threshold.**

### 5.2 `reconciliationExceptionCount` — exception type semantics

`imwm_exceptions_v` in UAT is dominated by `EXPIRED_BATCH_WITH_STOCK`
exceptions — 33K–50K rows per plant across 109 plants. These are not
IM/WM quantity reconciliation mismatches; they record stock present
against an expired batch.

**Governance question:** should `reconciliationExceptionCount` include
the full `imwm_exceptions_v` or only specific `exception_type` values
(excluding `EXPIRED_BATCH_WITH_STOCK`)?

Until answered, the mapper MUST emit `null` for
`reconciliationExceptionCount` and a `warnings` entry. **Do not return
the unfiltered count.**

### 5.3 Six "due / overdue" business rules

The seven derivable counts use date comparisons against `CURRENT_DATE`.
"Due today" / "overdue" semantics are domain decisions:

- Does "due today" include or exclude `delivery_date = CURRENT_DATE`?
- Does "overdue" count records with `delivery_date = '0000-00-00'` /
  null? The current draft SQL excludes them — confirm with the
  Inventory team.
- Is "open" measured by `open_qty > 0` (line-level) or `delivery_complete
!= 'Y'` (header-level)? Mixing both is OK; using only one needs
  governance.

These are tractable governance questions. None is a blocker once the
business owner records the rule.

## 6. Sibling list contracts

The four sibling routes feed into the snapshot's drill-throughs:

| Route                              | Sibling contract            | Target source                                                                         | Status                                |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| `GET /api/warehouse360/inbound`    | `Warehouse360InboundItem`   | `wh360_inbound_v`                                                                     | **SQL column-name mismatch** — broken |
| `GET /api/warehouse360/outbound`   | `Warehouse360OutboundItem`  | `wh360_deliveries_v`                                                                  | Probably works; unverified end-to-end |
| `GET /api/warehouse360/staging`    | `Warehouse360StagingItem`   | `wh360_process_orders_v` (intended) or non-existent `staging_orders_v` (actual SQL)   | **View missing** — broken             |
| `GET /api/warehouse360/exceptions` | `Warehouse360ExceptionItem` | `imwm_exceptions_v` (intended) or non-existent `wh360_imwm_exceptions_v` (actual SQL) | **View missing** — broken             |

The data product is the snapshot. The four sibling routes are **drill-through evidence**, not the data product themselves. They must be repaired in lock-step with the snapshot route — a snapshot count whose drill-through is broken is worse than no snapshot at all.

## 7. Prerequisite gate — must close before L3 implementation work

These are the **non-negotiable** prerequisites. Each is its own PR (or a
data-platform request). No SQL rewrite, no contract change, no
`response_model` re-enablement, no UI wiring may proceed until **all
five** close.

| #   | Gate                                              | Status                                                                                                                                                                                                                | Owner                                                                         | Action to close                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fix `wh360_inbound_v` column-name mismatch**    | **closed — backend adapt landed** (2 sub-items still governance-pending — see [`warehouse360-inbound-source-verification.md`](../../data-layer/warehouse360-inbound-source-verification.md))                          | Backend (adapter rewrite landed) + Inventory team for STO + status governance | `get_warehouse_inbound_spec` SQL + `map_warehouse_inbound_rows` now consume actual `wh360_inbound_v` columns (`po_id`, `doc_type`, `delivery_date`, `open_qty`, …). Contract was already permissive (nullable `warehouseNumber`, `exceptionReason`, `status`) so no schema change was needed. Mapper emits `null` for `warehouseNumber`, `stockTransportOrderId`, `supplyingPlantId`, `exceptionReason` (absent in source) and derives `status` ∈ {`'open'`, `'received'`, `null`} from `delivery_complete` + `open_qty`. Sub-items still pending: STO document source location, governed `status` taxonomy.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | **Create or alias `staging_orders_v`**            | **closed — backend adapt landed** (3 sub-items still pending source / governance — see [`warehouse360-staging-source-verification.md`](../../data-layer/warehouse360-staging-source-verification.md))                 | Backend (adapter rewrite landed) + Inventory team                             | `get_warehouse_staging_spec` + `map_warehouse_staging_rows` now consume actual `wh360_process_orders_v` columns (`order_id`, `sap_order`, `reservation_no`, `material_id`, `material_name`, `batch_id`, `plant_id`, `uom`, `order_qty`, `sched_start`, `staging_pct`, …). `processOrderId` prefers `sap_order` over `order_id`; `stagedQuantity` / `openQuantity` derived from `order_qty * staging_pct` (application-derived); `stagingStatus` derived from `staging_pct` (application-heuristic). Mapper emits `null` for `warehouseNumber`, `reservationItemId`, `storageLocation`, `exceptionReason` (absent in source). Contract was already permissive enough — no schema change required. Sub-items still pending: reservation-line granularity, per-row storage location, governed staging-status taxonomy.                                                                                                                                                                                                       |
| 3   | **Create or alias `wh360_imwm_exceptions_v`**     | **closed — backend adapt landed** (6 sub-items still pending source / governance — see [`warehouse360-imwm-exceptions-source-verification.md`](../../data-layer/warehouse360-imwm-exceptions-source-verification.md)) | Backend (adapter rewrite landed) + Inventory team                             | `get_warehouse_exceptions_spec` + `map_warehouse_exceptions_rows` now consume actual `imwm_exceptions_v` columns (no `wh360_` prefix): `exception_type`, `severity` (int), `sla_hours`, `material_id`, `material_name`, `plant_id`, `storage_loc`, `qty`, `batch_id`, `bin_id`, `detail_text`, `detected_date`. Date filter target shifted from non-existent `EXPIRY_DATE` to `detected_date` (documented semantic shift). New `_map_exception_severity_v2` returns `null` for any int (no governed int→enum mapping); accepts only governed string severities. Mapper emits `null` for `warehouseNumber`, `expiryDate`, `daysToExpiry`, `documentId`, `processOrderId`, `deliveryId`, `purchaseOrderId`, `unitOfMeasure`, `recommendedReviewAction` (all absent in source or governance-pending). Contract was already permissive — no schema change required. Sub-items still pending: severity int→enum mapping, expiry/document linkage, detected_date semantics, `EXPIRED_BATCH_WITH_STOCK` inclusion (also Gate 5). |
| 4   | **Confirm `nearExpiryCount` threshold**           | **governance-pending** — source columns verified; rule undefined (see [`warehouse360-near-expiry-rule.md`](../../data-layer/warehouse360-near-expiry-rule.md))                                                        | Inventory team (business)                                                     | Source view `wh360_near_expiry_batches_v` is verified (columns: `days_to_expiry`, `expiry_date`, `total_stock`, `material_id`, `batch_id`, `plant_id`, `uom`, `aged_days`, `last_movement_date`). Pending Inventory-team decision on: (a) threshold value, (b) threshold scope (global / plant / material / family), (c) stock-category inclusion (blocked / QI / restricted), (d) null-expiry handling, (e) already-expired (`days_to_expiry < 0`) inclusion, (f) `aged_days` as secondary trigger, (g) sibling `nearExpiryStockQuantity` field, (h) threshold as request param vs config.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | **Confirm `reconciliationExceptionCount` filter** | **governance-pending** — two candidate sources verified; rule undefined (see [`warehouse360-reconciliation-exception-rule.md`](../../data-layer/warehouse360-reconciliation-exception-rule.md))                       | Inventory team (business)                                                     | Two candidate source views are verified: (A) `imwm_exceptions_v` (mixed bag, 90% `EXPIRED_BATCH_WITH_STOCK`), (B) `imwm_stock_comparison_v` (IM-vs-WM quantity comparison with `delta_qty` and `mismatch_kind`). Pending Inventory-team decision on: (1) definition of "reconciliation exception" (A / B / combined), (2) tolerance (absolute / percent / per-material), (3) tolerance scope, (4) time window, (5) open-TO handling, (6) cross-UOM comparison, (7) `EXPIRED_BATCH_WITH_STOCK` inclusion if view A, (8) drill-through column list, (9) severity-breakdown / value sibling fields, (10) field rename if view A.                                                                                                                                                                                                                                                                                                                                                                                             |

## 8. Forbidden until gate closes

PRs that touch this product before all five prerequisites close **must
not**:

- Add `response_model=Warehouse360Overview` back to the overview route
- Change the mapper from the V1 KPI shape to the contract shape (the V1
  shape at least returns something; the contract shape would silently
  return 0 for every count)
- Surface counts in the UI without per-count source-truthfulness markers
- Default `nearExpiryCount` or `reconciliationExceptionCount` to 0 — that
  reads as "all good" when actually we don't know
- Wire a frontend panel that consumes `Warehouse360Overview` against
  the live route — every count would be 0
- Add new fields to `Warehouse360OverviewSchema` (the schema is already
  ahead of the mapper; widening makes the gap worse)
- Mark this product as L3+ in the catalogue without evidence that all
  five prerequisites have closed

## 9. What L3 looks like (when the gate clears)

When the gate clears, the implementation is a **single PR**, no smaller
than the full re-mapping:

1. Rewrite `map_warehouse_overview_rows` to consume `wh360_inbound_v`,
   `wh360_deliveries_v`, `wh360_process_orders_v`, `imwm_stock_comparison_v`
   via a single multi-subquery SQL.
2. Emit `nearExpiryCount` and `reconciliationExceptionCount` with the
   governed thresholds/filters from §7.4 and §7.5.
3. Re-enable `response_model=Warehouse360Overview` on the route.
4. Update `apps/api/tests/routes/test_warehouse360_routes.py` to
   exercise the contract shape (the existing test asserting V1 KPI keys
   becomes a deprecation regression).
5. Add direct mapper unit tests covering each count derivation +
   edge cases (zero rows, single plant, blank inputs).
6. Update the frontend adapter and the consuming UI to render the
   counts (currently silently mapped to 0).
7. Capture browser UAT evidence per
   [`route-readiness-standard.md`](../route-readiness-standard.md).

## 10. Cross-references

- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](../../data-layer/warehouse360-overview-contract-alignment.md) — the live Databricks verification + Option C analysis
- [`docs/data-layer/backend-contract-enforcement-plan.md`](../../data-layer/backend-contract-enforcement-plan.md) — records the `response_model` skip
- [`docs/app-data-layer/data-product-maturity-model.md`](../data-product-maturity-model.md) — L1/L2 definitions
- [`docs/app-data-layer/route-readiness-standard.md`](../route-readiness-standard.md) — readiness vocabulary
- [`docs/app-data-layer/domain-data-product-catalog.md`](../domain-data-product-catalog.md) (entry #10) — catalogue row
- [`docs/app-data-layer/data-products/quality-usage-decision-evidence.md`](./quality-usage-decision-evidence.md) — companion data-product spec
