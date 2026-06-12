# ADR 017: Refresh cadence, gold incrementalisation, and the factory-floor latency path

Status: Accepted (2026-06-12, Tim Geldard — converged with an independent external
architecture review after three correction rounds)

## Context

The product currently refreshes on a single daily cadence (silver fast → reference/quality
→ gold, ~18 min end-to-end, 05:30 BST). The target state includes factory-floor wall
displays (worklists, exceptions, staging pace) where stale data means missed picks and
blocked lines. An external review proposed (v1) a three-tier architecture with a
continuous "gold streaming" tier of hand-built CDF streaming tables, and (v2, after
discovering Enzyme) a split of gold by Enzyme planning mode plus continuous silver.

Empirical facts established 2026-06-12:

- The gold pipeline runs with **Enzyme (Advanced)** incremental MV maintenance and CDF on
  all silver tables. A same-day run showed ~73% of flows NO_OP, ~4% ROW_BASED incremental,
  ~23% COMPLETE_RECOMPUTE — but that day included first-ever materialisations and the
  QM estate-gate expansion (505k → 9M lots), so the recompute share is an upper bound,
  not steady state.
- Full gold refresh (100+ MVs) completes in 3–7 minutes serverless.
- `pipelines.maintenance.disabled: true` + predictive optimization disabled means NOTHING
  compacts silver tables: `reservation_requirement` reached 786 bytes/row (19.6× bloat,
  103 accumulated deletion vectors) before manual OPTIMIZE.
- Quality-data freshness is ceilinged by source replication, not by our cadence
  (QAMR stalled for 3 of 4 QM plants at the time of writing).

## Decision

1. **Enzyme-managed materialized views are the incrementalisation mechanism.** We do NOT
   hand-build CDF streaming tables for gold objects. Rationale: Enzyme automates exactly
   the delta-propagation that `apply_changes` pipelines would hand-roll; the estate's
   heavy gold objects are multi-source joins/unions where hand-built streaming brings
   watermark complexity and checkpoint fragility (an interrupted-full-refresh truncated
   tables twice in June 2026); snapshot-MV semantics give self-correcting windows (window
   conf changes need no checkpoint surgery). A specific table may be converted to a
   streaming table only when measurement shows it (a) persistently COMPLETE_RECOMPUTE,
   (b) material in cost, AND (c) subject to a genuine sub-15-minute SLA.
2. **Gold frequency tracks silver frequency — they change together.** Increasing gold
   cadence over an unchanged silver cadence produces NO_OP runs; the lever is silver.
3. **The pilot-cutover cadence is 15-minute TRIGGERED silver fast with gold chained,
   in one job.** Continuous mode is the escalation path only if a measured SLA demands
   sub-5-minute latency; triggered serverless costs nothing between runs and avoids the
   always-on cluster.
4. **Any future pipeline split follows the dlt.read dependency graph, not Enzyme planning
   modes.** Intra-pipeline `dlt.read()` edges (trace anchor ← lineage, event ledger ←
   lineage, benchmark ← yield) make planning-mode-labelled splits sever dependencies. At
   3–7 min total runtime a split is not currently justified at any plausible frequency.
5. **Sequencing gates (in order):** (a) complete the cost-observation baseline and pull a
   QUIET-DAY Enzyme report — per-flow planning modes AND event-log fallback *reasons*;
   (b) define per-surface latency SLAs with actual pilot floor users; (c) only then change
   cadence. Flow rewrites for Enzyme compatibility are driven by the fallback-reason data,
   not by guessing from SQL shape.
6. **Table maintenance becomes systematic:** for deletion-vector bloat the correct
   operation is `REORG TABLE ... APPLY (PURGE)` — plain OPTIMIZE no-ops when files are
   well-sized but DV-laden (verified on `reservation_requirement` 2026-06-12: OPTIMIZE
   changed nothing at 51 MB/file; REORG PURGE is the executed fix). Durable regime:
   Predictive Optimization (or a scheduled maintenance job if PO is unavailable) so
   DV/file bloat cannot recur.
   **VACUUM stays at default retention** — silver tables serve CDF to downstream
   incremental consumers; aggressive retention (e.g. `RETAIN 24 HOURS`) can destroy
   unconsumed change history and is prohibited without a specific reviewed reason.

## Rejected alternatives

- **Three-tier model with a continuous hand-built streaming gold tier** (review v1):
  redundant with Enzyme; fights the platform; checkpoint fragility; cost model was
  anchored on `gold_batch_quality_result_v` (345M rows) which is a LEGACY-schema plain
  view outside every pipeline — its "refresh cost" is zero, so savings computed on it
  were savings on a phantom.
- **Splitting gold by Enzyme planning mode** (review v2): severs dlt.read dependencies;
  measurement it was based on was contaminated by first-materialisation day.
- **Continuous silver fast as the default**: pays an always-on cluster for a latency
  class that 15-minute triggered also delivers; contradicts the established UAT cost
  policy; remains available as a measured escalation.
- **Removing the `_secured`/`_live` view tiers as "triplication"**: `_secured` is the
  RLS serving architecture (ADRs 005/012); `_live` exists because MVs cannot carry
  wall-clock expressions — query-time date-relative columns live there. Both are
  refresh-cost-free wrappers.

## Consequences

- Floor-facing latency (<20 min end-to-end) is achievable by cadence configuration alone,
  at modest cost, once the pilot SLA justifies it — no re-architecture required.
- The quiet-day Enzyme fallback report becomes a standing observability artefact; the
  candidate flow-rewrite list (journey events, SPC subgroup, QM lot tables, event ledger)
  is revisited against it.
- The SPC Phase 1 merge decision (large result-grain scans) inherits this ADR's
  measurement-first protocol and the maintenance regime.
- QM freshness work routes to the replication escalation, not to pipeline cadence.
