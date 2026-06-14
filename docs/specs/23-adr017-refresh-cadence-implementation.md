# Spec 23 — Implement ADR 017 (refresh cadence + gold incrementalisation)

Read `docs/specs/_conventions.md` and `data-products/io-reporting/docs/adr/017-refresh-cadence-and-gold-incrementalisation.md` first.
Branch: `feature/adr017-cadence`.

## Objective

Enact ADR 017's decisions as concrete, build-ready artefacts. ADR 017 is **Accepted**; this spec
turns its five decisions and the sequencing gates into code/config. The cadence *cutover itself*
(decision 3) is **execution-gated** — it incurs cost and depends on a pilot SLA — so this spec
**stages** it (config ready, off by default) and **builds the gates that must clear first**.
Everything else (the observability report, the maintenance regime, the VACUUM guard) is buildable
now, is cost-light, and is the actual unblocking work.

Do NOT change the live refresh frequency in this build. The pipelines are paused for the
cost-observation baseline (see memory `cost-observation-period`); flipping cadence now would both
defeat that baseline and pre-empt the pilot-SLA gate. This build delivers the *instruments and
the staged switch*, not the flip.

## Work item 1 — Quiet-day Enzyme fallback report (sequencing gate 5a — HIGHEST VALUE)

The standing observability artefact ADR 017 makes a prerequisite for any cadence change. Build a
reporting script (`data-products/io-reporting/scripts/enzyme_fallback_report.py`, runnable via the
Statement Execution API / a notebook job) that, against the **gold pipeline event log**, produces
per-materialized-view:
- the **planning mode** of the most recent update (NO_OP / ROW_BASED incremental /
  COMPLETE_RECOMPUTE), and
- where a flow fell back to COMPLETE_RECOMPUTE, the **event-log fallback *reason*** (Enzyme emits a
  reason in the `flow_progress`/`planning_information` event detail — surface it, don't infer from
  SQL shape; that is ADR 017's explicit instruction in gate 5a).

Output a tidy table (mv_name, last_planning_mode, fallback_reason, rows_affected, run_ts) sorted by
recompute cost. This is the data that drives the flow-rewrite candidate list (journey events, SPC
subgroup, QM lot tables, event ledger — ADR 017 Consequences). Ground the event-log schema against
the actual gold pipeline event log (don't guess column names); document the query in the script.
Acceptance: report runs against the UAT gold pipeline event log and emits the per-MV table; a
short `docs/runbooks/enzyme-fallback-report.md` explains how/when to pull it (quiet day, post-cost-baseline).

## Work item 2 — Systematic table maintenance regime (ADR 017 decision 6)

Today `pipelines.maintenance.disabled: true` + predictive optimization disabled means **nothing
compacts silver tables**. Adopt a durable regime:
- Prefer **Predictive Optimization** enablement on the silver/gold schemas if the workspace
  supports it (UC `ALTER SCHEMA ... ENABLE PREDICTIVE OPTIMIZATION`); otherwise a **scheduled
  maintenance job** (`resources/maintenance.job.yml`) running `OPTIMIZE` + `REORG TABLE … APPLY
  (PURGE)` across the silver tables on a low-frequency cadence (e.g. weekly, off-peak).
- The job/enablement must be **paused/disabled by default** in dev and only armed per-target where
  cost policy allows (mirror the refresh-cadence job's pause posture).
- Do NOT touch VACUUM retention here (see work item 3).
Acceptance: the maintenance mechanism exists as committed config, defaults to off, and is
documented in `data-products/io-reporting/docs/runbook.md` (maintenance section). Validate the
bundle (`databricks bundle validate -t dev --profile TG`).

## Work item 3 — VACUUM retention guard (ADR 017 decision 6, hard rule)

ADR 017 prohibits aggressive VACUUM retention because silver tables serve **CDF to downstream
incremental consumers** — shortened retention destroys unconsumed change history. Add a CI guard
(`scripts/ci/check_vacuum_retention.py`, wired into `ci.yml`) that fails if any pipeline/job/SQL
artefact sets `VACUUM … RETAIN` below the default (168 h) or sets a non-default
`delta.deletedFileRetentionDuration`/`logRetentionDuration` on a silver table without an
allowlist entry carrying a reviewed reason. Pattern-match the existing determinism/freshness
guards' structure. Acceptance: guard passes on current main and fails on a planted short-retention
VACUUM.

## Work item 4 — Stage the 15-minute triggered cadence (decision 3 — STAGED, OFF)

Prepare but do not arm the cutover:
- In `resources/refresh_cadence.job.yml`, add (commented or behind a per-target variable defaulting
  to the current daily schedule) the **15-minute triggered** schedule for silver fast with **gold
  chained in the same job** (the job already runs slow→quality→gold in sequence; the change is the
  trigger interval + ensuring gold is chained off the fast run for the pilot path).
- Document the arming procedure + its two gates (cost baseline complete; pilot SLA defined with
  floor users) in the runbook, and that continuous mode is the *escalation-only* path (decision 3).
- Add a one-line note that any single-table streaming-table conversion requires the
  three-part test (persistently COMPLETE_RECOMPUTE **and** material cost **and** genuine sub-15-min
  SLA — decision 1).
Acceptance: the staged config validates, the live cadence is unchanged, and the runbook states the
gates. **No pipeline is started by this build.**

## Out of scope (record, don't do)
- The `reservation_requirement` 747 B/row root-cause investigation (ADR 017 decision 6 — explicitly
  a lower-priority backlog item; readers prune via liquid clustering).
- Any pipeline split (decision 4 — not justified at 3–7 min total runtime).
- Actually flipping cadence or un-pausing pipelines (gated on cost baseline + pilot SLA).

## Acceptance (whole spec)
- Enzyme fallback report runs + documented; maintenance regime committed (off by default) +
  documented; VACUUM guard green on main and wired into CI; 15-min cadence staged but inert; live
  cadence and pause posture unchanged. Bundle validates on dev. No live pipeline run triggered.
