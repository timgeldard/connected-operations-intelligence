# Warehouse near-expiry threshold rule — Gate Item 4

> **Status**: governance-pending source-verification doc. **Not** an
> implementation PR. No runtime code is changed by this document. The
> `nearExpiryCount` field in `Warehouse360OverviewSchema` remains
> blocked until the threshold rule, source mapping, and stock-category
> filter are governed.

## 1. Why this document exists

The [WarehouseOperationalSnapshot gating spec](../app-data-layer/data-products/warehouse-operational-snapshot.md)
lists `nearExpiryCount` as Gate 4. The contract field is required
(`z.number().int().min(0)`) but its rule has never been agreed:

- What threshold defines "near"? (30 days, 60 days, plant-specific?)
- Which stock categories are included or excluded?
- How are null expiry dates handled?
- Is the rule global, plant-specific, material-specific, or per
  product family?

Without these answers, any implementation would either invent a default
threshold (e.g. 30 days — the most common guess) or default the count
to 0. Both are unsafe per the WarehouseOperationalSnapshot spec §8.

This doc records the governance questions, identifies the verified source
fields available today, and lists the smallest safe implementation PR
that can land once governance has answered.

## 2. Verification method used

**Source of truth for available columns**: the prior live verification
in [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md)
(2026-05-19, `connected_plant_uat.wh360.wh360_near_expiry_batches_v`,
end-user OAuth through the Statement API).

This PR does **not** re-run `DESCRIBE TABLE` — the verified columns are
already documented. It also does **not** introduce a threshold default;
governance must do that.

| Item                       | Value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Contract field             | `Warehouse360OverviewSchema.nearExpiryCount` (`z.number().int().min(0)` — required)               |
| Candidate source view      | `connected_plant_uat.wh360.wh360_near_expiry_batches_v`                                           |
| Verification date          | 2026-05-19 (prior) — column shape verified                                                        |
| Verification environment   | UAT                                                                                               |
| Verification method        | `DESCRIBE TABLE` + sample query through end-user OAuth                                            |
| Source of truth in this PR | [`warehouse360-overview-contract-alignment.md` §3](./warehouse360-overview-contract-alignment.md) |

## 3. Source-verification mapping table

Even though the rule is undefined, the source-field availability is
documented so a future implementation PR can land quickly once
governance resolves the threshold.

| Question                                  | Source field today                                 | Type    | Notes                                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the batch close to expiry?             | `wh360_near_expiry_batches_v.days_to_expiry` (int) | int     | Live UAT data spans -3505 (long-expired) to +90 days. View name suggests it has already been filtered, but the wide range shows it has NOT been filtered to "near" — the threshold must be applied per query. |
| What is the expiry date?                  | `expiry_date`                                      | date    | Available.                                                                                                                                                                                                    |
| What is the manufacture date?             | `manufacture_date`                                 | date    | Available.                                                                                                                                                                                                    |
| What stock is currently held?             | `total_stock`                                      | numeric | Available — non-zero stock is a precondition for "near expiry" being operationally meaningful.                                                                                                                |
| What unit?                                | `uom`                                              | string  | Available.                                                                                                                                                                                                    |
| Material identity                         | `material_id`, `material_name`                     | string  | Available — needed for material-specific threshold variants.                                                                                                                                                  |
| Plant identity                            | `plant_id`, `plant_name`                           | string  | Available — needed for plant-specific threshold variants.                                                                                                                                                     |
| Batch identity                            | `batch_id`                                         | string  | Available.                                                                                                                                                                                                    |
| When was the last movement?               | `last_movement_date`                               | date    | Available — may inform "stale" vs "moving toward expiry" semantics.                                                                                                                                           |
| How long has the batch been on the shelf? | `aged_days`                                        | int     | Available — may inform aged-but-not-expired filtering.                                                                                                                                                        |

### 3.1 Stock categories — explicitly NOT clarified by the source

The view does not break out QI / blocked / restricted / unrestricted
quantities. The contract field `nearExpiryCount` is meant to be an
operational warning count, but it is unclear whether it should:

- include all stock regardless of category (Inventory team to confirm);
- exclude `blocked` stock (blocked won't move out anyway);
- exclude `quality_inspection` stock (might fail QC and be destroyed
  before expiry);
- exclude `restricted` stock.

If the categorical breakdown is needed, the implementation PR will need
to JOIN `wh360_near_expiry_batches_v` to `wh360_stock_v` or similar on
`(material_id, batch_id, plant_id)`. That is **out of scope** for
implementation until governance answers §6.

## 4. Gate decision

**Gate 4 status**: `governance-pending`.

This is **not** a backend-adapt gate — the source columns are sufficient
to compute _any_ near-expiry rule. The gate is open because the
business / Inventory team has not specified which rule to compute.

| Decision dimension                    | Outcome                                                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommended fix path                  | **Inventory team must define the rule.** Backend cannot adapt around an unspecified business rule without inventing a threshold (forbidden by spec §8).                                                                                 |
| Data-platform requests still required | None — the source columns are sufficient.                                                                                                                                                                                               |
| Contract changes required             | Possibly: if the threshold becomes a request parameter (e.g. `?nearExpiryDays=30`), `Warehouse360OverviewRequest` must add an optional `nearExpiryDays` field. Defer until governance lands.                                            |
| Owner                                 | Inventory team (rule definition) + Backend (subsequent implementation)                                                                                                                                                                  |
| Blocker for L3?                       | Yes — `nearExpiryCount` is a required field on `Warehouse360OverviewSchema`. Until the rule lands, `response_model` on `/overview` cannot be re-enabled (would force the mapper to emit a number invented under no business authority). |

## 5. Governance questions for the Inventory team

Before any implementation PR lands, the following must be answered in
writing (ADR, backlog ticket, or comment thread):

1. **What does "near-expiry" mean operationally?** Specifically: "the
   batch will expire within N days from today, AND stock is still on
   hand, AND stock is movable (not blocked / not in QC failure)."
   Confirm or correct.
2. **What is N?** Is it 30 days, 60 days, 90 days, or material-specific?
3. **Is N global, plant-specific, material-specific, or product-family-specific?**
   If not global: where is the per-plant/material/family mapping stored?
4. **Should the threshold become a request parameter** so the cockpit
   can show "stock expiring in next 7 / 30 / 60 days" toggles?
5. **Which stock categories count?** All? `unrestricted` only?
   `unrestricted + quality_inspection`? Excluding `blocked` and
   `restricted`?
6. **How are null `expiry_date` rows handled?** Source-truthful default:
   they do NOT count as near-expiry. Confirm or correct.
7. **How are already-expired rows (`days_to_expiry < 0`) counted?**
   - Option A: include in `nearExpiryCount` (they are critically
     near-expiry — actually past it)
   - Option B: exclude — they belong to a separate `expiredStockCount`
     field
   - Option C: surface them in a sibling `expiredCount` field added to
     the contract
8. **Is `aged_days` (how long the batch has been on the shelf) a
   secondary trigger** that should bump the count even when
   `days_to_expiry` is comfortable?
9. **Should the implementation also surface a `nearExpiryStockQuantity`
   total** (sum of `total_stock`) alongside the count? The contract
   today has only the count; the operational decision often hinges on
   how much is at risk.

If governance cannot answer (a) and (b) at minimum, the field should be
removed from `Warehouse360OverviewSchema` — leaving it required but
unimplementable is the worst of both worlds.

## 6. Recommended next implementation PR (when governance lands)

Scope (single PR):

1. Capture the governance decision in an ADR (e.g.
   `docs/architecture-decisions/0XXX-warehouse-near-expiry-rule.md`).
2. If the threshold is per-request, extend
   `Warehouse360OverviewRequestSchema` with an optional `nearExpiryDays`
   parameter (default `null`, mapper must NOT default to 30).
3. Implement the count derivation in the overview mapper:
   `COUNT(DISTINCT material_id, batch_id, plant_id) WHERE
days_to_expiry BETWEEN 0 AND :nearExpiryDays AND total_stock > 0
AND plant_id = :plant_id`.
4. If expired rows are included (Option A), document the inclusion in
   the schema's `[classification:]` and surface a `warnings` entry.
5. Regenerate `apps/api/contracts/generated.py`.
6. Re-enable `response_model=Warehouse360Overview` on `/overview` (the
   route currently has it disabled — see spec §3.3).
7. Add direct mapper tests covering:
   - happy path with mixed expiry windows
   - null `expiry_date` rows excluded (or included if Option A)
   - zero-stock rows excluded
   - blocked / restricted / QI categories excluded if required
   - already-expired rows behaviour matches the chosen option
8. Capture browser-UAT evidence per
   [`route-readiness-standard.md`](../app-data-layer/route-readiness-standard.md).

## 7. Items unresolved (governance-pending)

| Item                                                 | Why unresolved                                                 | Whose decision           |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------ |
| Threshold value (`N` days)                           | No business rule recorded.                                     | Inventory team           |
| Threshold scope (global / plant / material / family) | No business rule recorded.                                     | Inventory team           |
| Stock-category inclusion (blocked / QI / restricted) | No business rule recorded.                                     | Inventory team           |
| Null-expiry handling                                 | Default would be source-truthful (exclude) but needs sign-off. | Inventory team           |
| Already-expired handling (Option A / B / C above)    | No business rule recorded.                                     | Inventory team           |
| `aged_days` as secondary trigger                     | No business rule recorded.                                     | Inventory team           |
| Sibling `nearExpiryStockQuantity` field              | Operational request — UI would benefit.                        | Inventory team + UI      |
| Threshold as request parameter vs config             | Architecture decision.                                         | Backend + Inventory team |

## 8. Forbidden until the rule is governed

Per the WarehouseOperationalSnapshot gating spec §8 — repeated here so
this doc is self-contained:

- **No** implementation of `nearExpiryCount` in the overview mapper.
- **No** default of `0` for `nearExpiryCount` ("all good" is not
  source-truthful when we don't know).
- **No** invented threshold (30 / 60 / 90 days).
- **No** treatment of `nearExpiryCount` as safety / release / recall
  signal.
- **No** UI panel rendering `nearExpiryCount` from the live route.
- **No** re-enablement of `response_model=Warehouse360Overview` on
  `/overview` until governance lands.
- **No** production-readiness claim. **No** browser-UAT claim.
- **No** runtime code change in this PR.

## 9. Cross-references

- [`docs/app-data-layer/data-products/warehouse-operational-snapshot.md`](../app-data-layer/data-products/warehouse-operational-snapshot.md) — gating spec (this doc tracks Gate 4)
- [`docs/data-layer/warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md) — Gate 1 (companion pattern)
- [`docs/data-layer/warehouse360-staging-source-verification.md`](./warehouse360-staging-source-verification.md) — Gate 2
- [`docs/data-layer/warehouse360-imwm-exceptions-source-verification.md`](./warehouse360-imwm-exceptions-source-verification.md) — Gate 3
- [`docs/data-layer/warehouse360-overview-contract-alignment.md`](./warehouse360-overview-contract-alignment.md) — original live verification (2026-05-19)
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — the contract file
