# ADR 016: Traceability data product — history window, estate scope, and two-tier security

Status: Accepted (2026-06-11, Tim Geldard)

## Context
The governed traceability rebuild (replacing legacy `gold_batch_lineage`: 168M edges, ~390 plants,
16 years of history, ungated) must decide how much history to serve, which plants' data may be
served at all, and how Unity Catalog security can authorise trace queries without amputating
cross-plant traversal results. Food-traceability legislation referenced by the business requires
records reaching back 7 years. SAP has run for 16 years; the estate includes closed plants, sold
plants, and divested businesses that continue to operate on Kerry's SAP (no SAP attribute marks
these lifecycles; a "DNU" name prefix was the historical heuristic).

## Decision
1. **History window: a configurable PARAMETER** (`trace_lookback_years` pipeline conf, default 5 —
   the same self-correcting snapshot-MV mechanism as `qm_lookback_years`; the business may settle on
   3). Lookbacks beyond the product window (up to the statutory 7 years and the full 16-year SAP
   history) are explicitly REFERRED BACK TO SAP / the source layer — a documented procedure, not an
   app feature. (Tim Geldard 2026-06-11: legislation references 7 years; 5 acceptable now, possibly
   3 later; 4–7 years = refer to SAP.)
2. **Estate scope via a governed `lifecycle_status`** on `site_config_plant`
   (ACTIVE / CLOSED / SOLD / DIVESTED_ON_SAP, with validity dates; bootstrapped from movement
   recency + T001W names + company-code analysis, business-reviewed):
   - ACTIVE: anchorable (subject to user entitlement) and visible in traversals.
   - CLOSED: NOT anchorable, but VISIBLE as pass-through nodes — chain continuity for Kerry's own
     history must not break where a trace runs through a since-closed plant.
   - SOLD / DIVESTED_ON_SAP: excluded outright — their edges are dropped at build time. Data
     belonging to divested businesses that still post to Kerry's SAP is not Kerry's to serve.
3. **Two-tier Unity Catalog security**, identical for every consumption surface (app, Power BI,
   Databricks dashboards) because both tiers are pure UC objects:
   - **Anchor tier (row-level)**: batch/material search and anchor views are RLS-secured per user —
     a trace may only be INITIATED from a batch/material/plant the user is entitled to.
   - **Traversal tier (capability-level)**: the lineage edge product and node-enrichment views are
     granted to a `traceability-readers` UC group as a whole. Holding the trace capability means
     seeing the full connected supply chain from an authorised anchor, including plants the user
     cannot otherwise access. Row filters on the edge product are explicitly REJECTED: they would
     silently truncate graphs mid-traversal — worse than no security, because it presents an
     incomplete trace as complete.
4. **Quality follows trace relevance**: sites that appear in traces need QM context; the quality
   gate's eventual scope is therefore the trace-relevant estate (per-plant qm_enabled_flag flips
   under the existing two-tier QM/SPC gating), not the WM-onboarded pilot set.

## Consequences
- The governed edge product is dramatically smaller than legacy (5-year window × lifecycle-gated
  estate) while remaining estate-wide — it is NOT gated to the WM pilot plants.
- Traces involving SOLD/DIVESTED plants truncate at those boundaries by design; CLOSED plants
  appear as non-anchorable pass-through nodes.
- The lifecycle dimension is new governed master data owned by Kerry (review-listed, not derived
  solely from SAP); divested-on-SAP detection requires business confirmation since activity data
  cannot distinguish it.
- A 7-year statutory request is a documented manual/source procedure, not an app feature.

## Naming and transition
The new workspace launches as **"Final Trace"** (workspace id `final-trace`) alongside the legacy
trace workspaces. It is renamed/re-identified to `trace` ONLY when the legacy trace surfaces are
explicitly dropped — by instruction, or at the production deployment. Until then both run in
parallel; contracts are NOT shared between old and new (clean drop, per the migration brief).

## Review-state mapping (bootstrap CSV → conformed statuses)
`resources/config/site_lifecycle_review.csv` carries evidence-triage labels in `proposed_lifecycle`;
these are NOT the conformed statuses. The business review resolves them into the four conformed
values via `confirmed_lifecycle`:
- ACTIVE → ACTIVE (no review needed unless contradicted).
- SOLD_OR_CLOSED_REVIEW (DNU-named) → reviewer chooses SOLD, CLOSED, or DIVESTED_ON_SAP.
- REVIEW_RECENT_DORMANT (no postings since 2025-06) → reviewer chooses ACTIVE (seasonal/slow) or CLOSED.
Until a row is confirmed, the effective status defaults CONSERVATIVELY: ACTIVE proposals behave as
ACTIVE; both review states behave as CLOSED (visible pass-through, not anchorable, edges retained).
SOLD/DIVESTED exclusion — the destructive outcome — only ever takes effect from an EXPLICIT
confirmed_lifecycle, never from a default.

