# Spec 05 — Shortage projection board (new build)

Read `docs/specs/_conventions.md` first. Branch: `feature/shortage-projection`.

## Objective

Order readiness answers "is this order short NOW". The shortage projection board answers
"WHEN does an order go short": for each upcoming order component, project available supply
(current stock + expected inbound) against demand (open reservations) on the time axis,
and surface orders whose start date lands after their projected short date.

## Design — deterministic projection, no forecasting

This is arithmetic, not ML. Per `plant_code × material_code`:

```
projected_available(t) = on_hand_now
                       + Σ expected_inbound with expected_date ≤ t
                       - Σ open_demand with demand_date ≤ t
```

An order's component is AT_RISK if projected_available(demand_date) < open required qty
at its demand date (i.e. the running balance goes negative at or before its slot).

1. **Gold** (two tables in `gold/wm_operations_gold.py`):
   a. `gold_wm_supply_demand_ledger` — the dated ledger, one row per supply/demand event:
      - SUPPLY/on-hand: `silver.batch_stock` aggregated to plant×material (unrestricted
        qty; verify aliases), as a single t=NULL "current stock" row per plant×material.
      - SUPPLY/inbound: open PO lines from the purchase-order silver (the inbound/PO
        backlog gold already reads it — find that table's source and reuse the open-line
        predicate + expected/delivery date column; verify in `silver/tables/` (EKPO/EKET
        family) and in the existing inbound gold) + inbound deliveries not yet received
        (the #94 inbound-deliveries gold has expected_receipt_date / is_received — read it;
        avoid double counting PO vs delivery for the same supply: prefer the delivery when
        one exists for the PO line if linkage columns exist, else document the
        double-count caveat honestly and pick ONE source for v1 — deliveries).
      - DEMAND: open reservations from `silver.reservation_requirement`
        (required_quantity − withdrawn_quantity > 0, not deletion-flagged, movement family
        261 — copy the component-variance filters exactly), dated by the reservation's
        requirement date (verify the date column alias; RESB BDTER) with order linkage.
   b. `gold_wm_order_shortage_projection` — order grain: for each open order component,
      the running-balance computation via window functions ORDER BY event date per
      plant×material (no wall-clock — dates compare at query time in the view):
      `projected_balance_at_demand`, `is_projected_short` derivable, `first_short_date`
      per material carried onto affected orders, supply/demand context columns.
      Window functions are deterministic with explicit ordering — add date+tiebreaker
      ordering (event date, then source type, then document number) and document it.
2. **Consumption views + contracts + adapter** per house pattern
   (`wm_operations.supply_demand_ledger`, `wm_operations.shortage_projection`).
3. **Frontend:** new "Shortage Projection" view (Plan group): KPI strip (orders at risk
   ≤7d / ≤14d, materials short), at-risk order table (order, material, demand date,
   projected balance, first short date) with Order Journey deep link, and a per-material
   ledger drill (table of dated events with running balance — no charts needed for v1).

## Gotchas

- UOM discipline: ledger rows must be same-material only (no cross-material aggregation);
  PO quantities may be in order UOM vs base UOM — check whether the silver PO line carries
  a base-UOM quantity (the MARM/material_uom_conversion work exists in silver); if
  conversion is non-trivial, v1 restricts inbound supply to rows already in base UOM and
  reports the limitation.
- Open-order scope: only orders with `actual_finish_date IS NULL` and release evidence
  rules consistent with readiness (date-evidence, NOT PHAS flags — see spec 04 Part A).
- Two new gold tables ⇒ generator + ALL variants + dataset-name check.

## Acceptance

- Ledger balances are reproducible by hand for a fixture; window ordering deterministic.
- An order with sufficient stock never flags; an order whose material goes negative before
  its demand date always flags (PySpark fixture tests for both + inbound-rescue case where
  a PO receipt before demand date saves it).
- Honest caveats in table comments: snapshot-era inbound data quality, UOM scope.
