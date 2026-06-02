# IOReporting Hardening Plan — active sprint tracker

Full plan: see the hardening plan brief (12 phases). This file is the **live scope guard** — what
the current sprint is doing, and what is explicitly frozen. Security/access redesign is **out of
scope** for the whole plan.

## Current sprint objective (Sprint 1 — Truth & consistency)
Make the repo self-describing and accurate to **current `main`** before any new functional scope:
README architecture, Gold status labels, data contracts for every implemented Gold table, and
honest caveats (including the production/test schema divergence and pilot-grade outputs). No new
Gold tables, no pipeline-logic changes.

## Explicitly deferred (do NOT start under this plan)
- **Security / access-control model redesign** (row filters, Gold access model) — separate workstream.
- New functional domains / additional SAP source ingestion, unless required to make an **existing**
  model truthful.
- Full build of: shift calendar, detailed IM/WM reconciliation, true inbound GR status — these are
  **design-first** (ADRs 008/009 + Phase 9/10/11) and gated on source/config decisions.

## Sequencing (one PR per sprint; code phases kept small for CI + bot review)
1. **Sprint 1 — Truth & consistency** (this PR): README, `gold/design_spec.md`, `docs/data_contracts.md`,
   status labels, source dependency map, pilot caveats.
2. **Sprint 2 — Correctness**: resolve the production/test divergence (Phase 2 — a design choice:
   live serving view vs daily snapshot for date-relative columns), schema-contract tests, warehouse
   Gold unit tests, `docs/business_rules.md` + validation views.
3. **Sprint 3 — Freshness & operability**: multi-table `gold_data_freshness_status` + critical gate,
   runbook, `gold_data_product_status`.
4. **Sprint 4 — Design next**: inbound receipt status, detailed reconciliation, shift calendar — design docs only.

## Known correctness item carried into Sprint 2 (do not silently "fix" in Sprint 1)
PRs #24/#25 moved `current_date()`-derived columns out of the production MV path to keep MVs
incrementally refreshable, re-adding them only in test mode. So production currently **omits**:
`gold_lineside_stock.min_days_to_expiry`; `gold_delivery_pick_status.days_to_goods_issue`,
`risk_band`; `gold_process_order_staging.days_to_start`, `risk_band`; and the
`gold_stock_expiry_risk` bucket/flag columns. Sprint 1 **documents** this; Sprint 2 resolves it
(live serving view over the MV — parallels the ADR 012 secured-view pattern — vs computing in the
snapshot job; the live-vs-daily read path is the user's call).
