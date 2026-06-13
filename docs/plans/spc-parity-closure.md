# SPC Parity-Closure Plan

**Date:** 2026-06-13 · **Owner:** Tim Geldard · derived from the SPC functional-parity audit
(spc-consumer monorepo vs legacy `GitHub/spc`).

## Guiding principle

spc-consumer's statistical engine **already matches or exceeds** the legacy app — chart types
(I-MR / X̄-R / X̄-S / EWMA / CUSUM / capability), Cp/Cpk/Pp/Ppk **incl. non-parametric + 95% CI**,
Shapiro-Wilk, WECO + Nelson. So parity closure is **wiring verified-present MVs, going live, UX
completeness, and honesty/governance — NOT rebuilding analytics.** Most "gaps" are
source-verified-but-UNWIRED (the MVs exist).

**Hard external blocker (parked):** QAMR result-grain replication is stalled AND the grain is not
yet standardised by the business. Result-level breadth therefore stays C351-mostly; everything
off-C351 degrades to `Unknown` (honestly). We do NOT chase this technically — it waits on the
business standardising the QAMR grain. Every result-grain-dependent item below is scoped to
"works where data exists, Unknown elsewhere".

## Phase A — Go-live + truthfulness (small, unblocks live value; do first)

- **A1 — Flip live mode for the core loop.** Enable `databricks-api` for subgroups + chart-data
  (governed serving views + adapters already exist), capture browser-UAT evidence. Moves the
  default off `mock`.
- **A2 — Fix the Genie truthfulness issue.** `domain-integrations/spc/src/spc-consumer-workspace.tsx:42` `cleanGenieText`
  rewrites "mock"→"Databricks API", presenting a LOCAL rule engine as a Databricks Genie call.
  Relabel the "Conversational Insights" tab honestly as a local heuristic (or gate it off) until a
  real Genie Space is wired. (Repo honesty convention — no faked source provenance.)
- **A3 — Fix the window mismatch.** 730-day route cap vs hardcoded 2-year UI default — align both
  and add a real date-range control (feeds B1).

## Phase B — Navigation & UX completeness (wire existing + UI)

- **B1 — Date-range (presets + custom) + stratification (plant/lot/operation).** The subgroup MV
  already supports the window (≤730d) and carries plant/operation columns; this is UI + query params.
- **B2 — Cursor pagination.** Lift the single-page LIMIT-200 cap (legacy uses a composite cursor).
- **B3 — Exports (CSV first, then Excel/PDF).**

## Phase C — Surface verified-but-unwired analytics MVs (the bulk)

Each is a route + contract + UI over an MV confirmed present in UAT:
- **C1 — All-MIC capability scorecard** ← `spc_quality_metrics` (ooc_rate / sigma_within); Cp/Cpk
  client-computed (the absent `spc_capability_detail_mv` is NOT needed — client path is the advantage).
- **C2 — Attribute charts P/nP/C/U** ← `spc_attribute_subgroup_mv` (point-logic scaffolding already
  in `domain-integrations/spc/src/utils/calculations.ts`). ⚠ Coverage limited by the QAMR grain where attribute/result data is thin —
  surface per-plant, `Unknown` where absent (ties to the parked blocker).
- **C3 — Process-flow DAG ("the graph")** ← `spc_lineage_graph_mv` + `spc_process_flow_source_mv`
  (replace the current mock "Process Context" tab with the real lineage DAG).
- **C4 — (Optional, low priority) Governed correlation / Hotelling T²** ← `spc_correlation_source_mv`
  for a proper F-distribution UCL (the consumer currently computes client-side with a coarser
  chi-square UCL). Keep client-side as fallback; only move if the governed source is cheap to wire.

## Phase D — Governance (move beyond `inventory_only`)

- **D1 — Govern the SPC surface.** SPC is absent from `data-products/io-reporting/contracts/app_contract_manifest.yml`. Add
  `vw_consumption_spc_*` consumption views + manifest namespace + OKF, and advance
  `data-products/io-reporting/contracts/app_migration_registry.yml` status. (Serving views + migrated state tables already exist in
  `gold_io_reporting` — this formalises the contract.)
- **D2 — SPC UAT validation pack + RLS verification** (golden plant/material/MIC; per-user RLS
  through the governed views).

## Phase E — Parked / blocked (do NOT attempt; record why; promote explicitly)

- **E1 — QAMR result-grain breadth — BLOCKED ON BUSINESS.** Replication stalled + grain not
  standardised. Result-level capability/attribute depth stays C351-mostly until the business
  standardises the QAMR grain. No technical workaround; degrade to `Unknown` off-C351.
- **E2 — `spc_capability_detail_mv` (migration 013) + `spc_nelson_rule_flags_mv` (migration 012)**
  absent in UAT — NOT needed (client-side computes capability + Nelson). Flip only if server-side
  parity is later wanted. Low priority.
- **E3 — Real Genie Space API, locked-limit write-back, exclusion write-back, MSA / Gauge R&R** —
  governance-gated (write-backs) or larger scope (MSA). Promote explicitly when approved.

## Sequence rationale

A (cheap, fixes the two audit flags + unlocks live value) → B (UX the analyst loop) → C (the
analytic surfaces — the bulk of the gap, all source-verified) → D (make it an official governed
pilot) → E parked. C2's breadth and any result-grain depth ride behind E1 (business).

## Intentional non-goals (not gaps)

Traceability is the separate `trace2` domain (not owed to spc-consumer); write-backs are
deliberately withheld pending governance; the consumer's contract-first Zod + source-truthfulness
layer is an EXTRA to keep, not a legacy pattern to replicate.
