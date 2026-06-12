# Spec 01 — Worklist: TO priority scoring

Read `docs/specs/_conventions.md` first. Branch: `feature/worklist-priority-scoring`.

## Objective

The staging/picking worklist (`?workspace=wm-operations`, worklist view) currently orders
work by creation time. Warehouse supervisors need it ranked by **demand-wave urgency**: a
TO feeding an order that starts in 30 minutes outranks one feeding tomorrow's order,
regardless of when the TO was created.

## Design

1. **Gold:** extend the worklist gold table in `gold/wm_operations_gold.py` (find the table
   that feeds `vw_consumption_wm_operations_worklist` — read the consumption SQL to identify
   it, then the gold function) with:
   - `demand_due_ts` — when the demand wants the material: the linked order's scheduled
     start (TR → `source_reference_number` → `process_order.scheduled_start_date`; verify
     the TR linkage columns against `silver/tables/warehouse_fast.py` and the existing
     `tr_by_order` / `TR_ORDER_REFERENCE_TYPE` patterns in `wm_operations_gold.py`).
     Fall back to the TR's own required/planned date column if the order linkage is absent
     (verify what date columns `warehouse_transfer_requirement` actually carries).
   - `priority_score` — deterministic integer, higher = more urgent. Banding, not false
     precision: overdue (demand_due_ts in the past) = 100; due within 2h = 80; within 8h
     = 60; within 24h = 40; later = 20; no demand date = 10. Add +10 if the item's status
     is PARKED or NO_STOCK (needs intervention). Document the bands in the table comment.
     No wall-clock in gold: compute the band AT QUERY TIME in the consumption view
     (`CASE WHEN demand_due_ts < current_timestamp() ...`) — gold carries only
     `demand_due_ts` and the static +10 intervention flag; the view computes the band.
     (This mirrors the `receipt_band` query-time pattern in the inbound deliveries view.)
2. **Consumption views** (`wm_operations_consumption_views_{dev,uat,prod}.sql`): add
   `demand_due_ts`, `priority_score` (query-time CASE as above), keep existing columns.
3. **Contract:** add the two fields to `wm_operations.worklist` in the manifest (bump
   version minor; `priority_score` is `integer` — CASE literal, not an aggregation;
   descriptions required — they publish to UC).
4. **Adapter:** add the two columns to the worklist `SIMPLE_DATASETS` entry
   (`integer=("priority_score",)` addition; verify the tuple merge with existing entries).
5. **Frontend** (`domain-integrations/wm-operations/src/views/` worklist view): default sort
   by `priority_score` DESC then `demand_due_ts` ASC; a small priority chip (colour by band:
   ≥100 red, ≥80 amber, ≥60 yellow, else neutral); keep all existing filters/persisted
   state working (the worklist has persisted filters — read the view before touching it).

## Gotchas specific to this item

- The worklist gold has dispensary vs manual pick status semantics (`direct_pick_status`
  vs `manual_pick_status`) — do not disturb the status derivation; scoring is additive.
- TRs without order linkage are common (snapshot-era data) — the score must degrade
  gracefully (band 10), never filter rows out.
- The TR→order join is the same axis the journey/staging code uses — reuse
  `TR_ORDER_REFERENCE_TYPE`, do not invent a new linkage.

## Acceptance (orchestrator will verify post-merge in UAT)

- Worklist rows carry sensible `demand_due_ts` for order-linked TRs; unlinked rows band 10.
- View ordering changes visibly; no row-count change vs before (scoring never filters).
- PySpark tests: order-linked scoring, fallback path, intervention bump, null-safety.
