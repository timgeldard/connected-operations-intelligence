# Warehouse reconciliation exception rule — Gate Item 5

> **Status**: governance-pending source-verification doc. **Not** an
> implementation PR. No runtime code is changed by this document. The
> `reconciliationExceptionCount` field in `Warehouse360OverviewSchema`
> remains blocked until the rule, source comparison, tolerance, and
> exception-type filter are governed.

## 1. Why this document exists

The [WarehouseOperationalSnapshot gating spec](../app-data-layer/data-products/warehouse-operational-snapshot.md)
lists `reconciliationExceptionCount` as Gate 5. The contract field is
required (`z.number().int().min(0)`) but the rule is undefined and the
available sources do not map cleanly to a single answer:

- `imwm_exceptions_v` exists with 13 columns, but ~90% of rows are
  `EXPIRED_BATCH_WITH_STOCK` — those are expiry events, not
  IM-vs-WM quantity mismatches.
- `imwm_stock_comparison_v` exists with `unrestricted_qty`,
  `qi_qty`, `blocked_qty`, `restricted_qty`, `interim_qty`,
  `im_total_qty`, `wm_total_qty`, `delta_qty`, `mismatch_kind` —
  this looks like the right source for **quantitative**
  reconciliation, but the rule (tolerance, kind filter) is undefined.

Without governance, any implementation would either:

- Count every row in `imwm_exceptions_v` (90% expiry — operationally
  meaningless for "reconciliation"), or
- Filter to a guessed `mismatch_kind` (no business authority), or
- Default the count to 0 (forbidden per spec §8).

This doc records the open governance questions, identifies the two
candidate source paths, and lists the smallest safe implementation PR
that can land once governance has answered.

## 2. Verification method used

**Source of truth for available columns**: the prior live verification
in [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md)
(2026-05-19, `connected_plant_uat.wh360.imwm_exceptions_v` and
`imwm_stock_comparison_v`, end-user OAuth through the Statement API).

This PR does **not** re-run `DESCRIBE TABLE`, **does not** sample data
beyond what the prior audit recorded, and **does not** introduce a
default tolerance. Governance must do that.

| Item                       | Value                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Contract field             | `Warehouse360OverviewSchema.reconciliationExceptionCount` (`z.number().int().min(0)` — required)   |
| Candidate source view A    | `connected_plant_uat.wh360.imwm_exceptions_v` (verified — 90% rows are `EXPIRED_BATCH_WITH_STOCK`) |
| Candidate source view B    | `connected_plant_uat.wh360.imwm_stock_comparison_v` (verified — IM-vs-WM quantity comparison)      |
| Verification date          | 2026-05-19 (prior) — column shape verified                                                         |
| Verification environment   | UAT                                                                                                |
| Verification method        | `DESCRIBE TABLE` + sample query through end-user OAuth                                             |
| Source of truth in this PR | [`warehouse360-overview-contract-alignment.md` §3](./warehouse360-overview-contract-alignment.md)  |

## 3. Source-verification mapping table

The contract field name says "reconciliation exception" — that strongly
suggests the IM-vs-WM quantity comparison (view B) rather than the
mixed-exception bag (view A). Both candidate sources are documented here
so governance can choose.

### 3.1 Candidate source A — `imwm_exceptions_v`

| Column                             | Type    | Notes                                                                                            |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `exception_type`                   | string  | Dominated by `EXPIRED_BATCH_WITH_STOCK` in UAT (~90%). Other values not enumerated in the audit. |
| `severity`                         | int     | Numeric; no governed int→enum mapping yet (see Gate 3 doc).                                      |
| `sla_hours`                        | numeric | Available.                                                                                       |
| `material_id` / `material_name`    | string  | Available.                                                                                       |
| `plant_id`                         | string  | Available — filter dimension.                                                                    |
| `storage_loc` / `storage_loc_name` | string  | Available.                                                                                       |
| `qty`                              | numeric | Quantity associated with the exception.                                                          |
| `batch_id`                         | string  | Available.                                                                                       |
| `bin_id`                           | string  | Available.                                                                                       |
| `detail_text`                      | string  | Free-text reason.                                                                                |
| `detected_date`                    | date    | Available — needed for time-window filtering.                                                    |

**Mismatch concern**: contract field name says "reconciliation
exception", but most rows in this view are expiry events. Using this
view without a filter would conflate two operationally distinct
exception classes. If Inventory team wants a unified count, the field
should be renamed (e.g. `inventoryExceptionCount`); if Inventory team
wants only IM-vs-WM mismatches, view B is the right source.

### 3.2 Candidate source B — `imwm_stock_comparison_v`

| Column                                            | Type    | Notes                                                                                            |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `material_id` / `material_name` / `material_type` | string  | Available.                                                                                       |
| `uom`                                             | string  | Available — needed for UOM-consistent comparison.                                                |
| `plant_id` / `plant_name`                         | string  | Available — filter dimension.                                                                    |
| `storage_loc` / `storage_loc_name`                | string  | Available.                                                                                       |
| `unrestricted_qty`                                | numeric | IM-side unrestricted.                                                                            |
| `qi_qty`                                          | numeric | IM-side quality inspection.                                                                      |
| `blocked_qty`                                     | numeric | IM-side blocked.                                                                                 |
| `restricted_qty`                                  | numeric | IM-side restricted.                                                                              |
| `interim_qty`                                     | numeric | IM-side interim / in-transit.                                                                    |
| `im_total_qty`                                    | numeric | IM total.                                                                                        |
| `wm_total_qty`                                    | numeric | WM total.                                                                                        |
| `delta_qty`                                       | numeric | IM - WM delta. **The key field for "is there a mismatch".**                                      |
| `inventory_value_eur`                             | numeric | EUR value of the position.                                                                       |
| `batch_count`                                     | numeric | Available.                                                                                       |
| `open_tos`                                        | numeric | Open transfer orders — may explain in-flight mismatches.                                         |
| `mismatch_kind`                                   | string  | **The key categorical field.** Values not enumerated in the audit — Inventory team must confirm. |
| `abc_class`                                       | string  | ABC classification (A/B/C).                                                                      |

**This is the source-truthful candidate** for `reconciliationExceptionCount`:
the field name matches the contract field name, and the `delta_qty` /
`mismatch_kind` columns let us define a precise filter rather than
counting heterogeneous exceptions.

### 3.3 Combined approach

Some teams use BOTH views (count comparison rows where `delta_qty ≠ 0`
AND join `imwm_exceptions_v` for an exception-type filter). That's the
most flexible but also the highest implementation cost. Decision belongs
to Inventory team.

## 4. Gate decision

**Gate 5 status**: `governance-pending`.

The source columns are sufficient — both candidate views are verified.
The gate is open because the business / Inventory team has not specified
which view to use, what counts as a "reconciliation exception", what
tolerance applies, and what time window matters.

| Decision dimension                    | Outcome                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommended fix path                  | **Inventory team must define the rule.** Backend cannot adapt without inventing a comparison rule (forbidden by spec §8).                                             |
| Data-platform requests still required | None — sources verified. Possibly an enumeration of `mismatch_kind` values from the data platform if Inventory team needs the list.                                   |
| Contract changes required             | Possibly: rename to `inventoryExceptionCount` if view A is chosen (broader scope). If view B is chosen, the field name stays correct.                                 |
| Owner                                 | Inventory team (rule definition) + Backend (subsequent implementation)                                                                                                |
| Blocker for L3?                       | Yes — `reconciliationExceptionCount` is a required field on `Warehouse360OverviewSchema`. Until the rule lands, `response_model` on `/overview` cannot be re-enabled. |

## 5. Governance questions for the Inventory team

Before any implementation PR lands, the following must be answered in
writing (ADR, backlog ticket, or comment thread):

1. **What is a reconciliation exception, operationally?** Candidate
   definitions:
   - "An IM-vs-WM quantity mismatch exceeding the tolerance" (view B).
   - "Any inventory anomaly recorded by the IM/WM exception engine"
     (view A).
   - "An IM-vs-WM mismatch AND an open transfer order that doesn't
     explain it" (combined).
2. **Which view is the source?** A, B, or combined?
3. **What tolerance applies to `delta_qty`?**
   - Absolute (e.g. `|delta_qty| > 0.001`)?
   - Percent of `im_total_qty` (e.g. `|delta_qty| / im_total_qty > 0.01`)?
   - UOM-specific?
4. **Is the tolerance material/plant/UOM-specific?** If yes: where is
   the per-X mapping stored?
5. **What time window applies?** All time, last 24h / 7d / 30d, or
   "open" (no resolution date yet)?
6. **How are open transfer orders handled?** Many IM-vs-WM mismatches
   are explained by in-flight TOs. Should `open_tos > 0` rows be
   excluded from the count?
7. **How are UOM conversions handled when comparing across rows?**
   The `uom` column is per-row; no governance-approved cross-UOM
   conversion exists today.
8. **If view A is chosen — which `exception_type` values count?**
   Specifically: should `EXPIRED_BATCH_WITH_STOCK` be included
   (today: 90% of rows) or excluded (only "true" reconciliation
   mismatches)? Inventory team to confirm or correct.
9. **What does the user need to drill through to?** The detail
   panel will need the underlying rows — what columns are required?
10. **Is severity required on the count?** A simple "5 exceptions"
    is less useful than "3 critical / 2 medium". Should the contract
    add a severity-breakdown sibling field?
11. **Should the implementation surface a `reconciliationExceptionValue`
    (sum of `inventory_value_eur`)** alongside the count? The
    operational decision often hinges on how much money is at risk.

If governance cannot answer (1) and (3) at minimum, the field should be
removed from `Warehouse360OverviewSchema` rather than leaving it
required-but-unimplementable.

## 6. Recommended next implementation PR (when governance lands)

Scope (single PR):

1. Capture the governance decision in an ADR (e.g.
   `docs/architecture-decisions/0XXX-warehouse-reconciliation-exception-rule.md`).
2. Implement the count derivation in the overview mapper. Pseudo-SQL
   if view B is chosen with a `delta_qty` absolute tolerance:
   ```sql
   COUNT(DISTINCT material_id, batch_id, plant_id)
   FROM imwm_stock_comparison_v
   WHERE plant_id = :plant_id
     AND ABS(delta_qty) > :tolerance
     -- Optionally: AND mismatch_kind IN (...)
     -- Optionally: AND open_tos = 0
   ```
3. If tolerance is per-request, extend `Warehouse360OverviewRequestSchema`
   with an optional `reconciliationToleranceQty` parameter.
4. Regenerate `apps/api/contracts/generated.py`.
5. Re-enable `response_model=Warehouse360Overview` on `/overview` (the
   route currently has it disabled — see spec §3.3).
6. Add direct mapper tests covering:
   - delta within tolerance → not counted
   - delta outside tolerance → counted
   - open transfer orders behaviour matches the chosen option
   - UOM-mismatched rows behave per the governed rule (most likely
     surfaced in a warning, not silently included)
   - empty source → 0 count (the ONLY legitimate zero default,
     because empty source means no comparison rows exist for the plant)
7. Capture browser-UAT evidence per
   [`route-readiness-standard.md`](../app-data-layer/route-readiness-standard.md).

## 7. Items unresolved (governance-pending)

| Item                                                               | Why unresolved                       | Whose decision                 |
| ------------------------------------------------------------------ | ------------------------------------ | ------------------------------ |
| Definition of "reconciliation exception" (A / B / combined)        | No business rule recorded.           | Inventory team                 |
| Tolerance value (absolute / percent / per-material)                | No business rule recorded.           | Inventory team                 |
| Tolerance scope (global / plant / material / UOM)                  | No business rule recorded.           | Inventory team                 |
| Time window                                                        | No business rule recorded.           | Inventory team                 |
| Open-transfer-order handling                                       | No business rule recorded.           | Inventory team                 |
| Cross-UOM comparison handling                                      | No governed conversion exists today. | Inventory team + data platform |
| `EXPIRED_BATCH_WITH_STOCK` inclusion (if view A chosen)            | Not specified.                       | Inventory team                 |
| Drill-through column list                                          | UX-driven.                           | Inventory team + UI            |
| Severity-breakdown sibling field                                   | Contract change.                     | Inventory team + Backend       |
| `reconciliationExceptionValue` sibling field                       | Contract change.                     | Inventory team + Backend       |
| Whether to rename to `inventoryExceptionCount` if view A is chosen | Contract change.                     | Backend + Inventory team       |

## 8. Forbidden until the rule is governed

Per the WarehouseOperationalSnapshot gating spec §8 — repeated here so
this doc is self-contained:

- **No** implementation of `reconciliationExceptionCount` in the
  overview mapper.
- **No** default of `0` for `reconciliationExceptionCount` ("all clear"
  is not source-truthful when we don't know).
- **No** invented tolerance threshold.
- **No** inference of root cause.
- **No** inference of inventory accuracy failure without a governed rule.
- **No** comparison of quantities across UOM without a governed conversion.
- **No** treatment of reconciliation exceptions as recall / safety risk.
- **No** emission of operational status as healthy / unhealthy.
- **No** UI panel rendering `reconciliationExceptionCount` from the live
  route.
- **No** re-enablement of `response_model=Warehouse360Overview` on
  `/overview` until governance lands.
- **No** production-readiness claim. **No** browser-UAT claim.
- **No** runtime code change in this PR.

## 9. Cross-references

- [`docs/app-data-layer/data-products/warehouse-operational-snapshot.md`](../app-data-layer/data-products/warehouse-operational-snapshot.md) — gating spec (this doc tracks Gate 5)
- [`docs/data-layer/warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md) — Gate 1
- [`docs/data-layer/warehouse360-staging-source-verification.md`](./warehouse360-staging-source-verification.md) — Gate 2
- [`docs/data-layer/warehouse360-imwm-exceptions-source-verification.md`](./warehouse360-imwm-exceptions-source-verification.md) — Gate 3 (`imwm_exceptions_v` content overlap)
- [`docs/data-layer/warehouse360-near-expiry-rule.md`](./warehouse360-near-expiry-rule.md) — Gate 4 (companion governance-pending pattern)
- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md) — original live verification (2026-05-19)
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — the contract file
