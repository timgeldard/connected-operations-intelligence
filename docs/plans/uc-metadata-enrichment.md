# UC Metadata Enrichment — Silver & Gold base tables

**Date:** 2026-06-13 · **Owner:** Tim Geldard · **Goal:** every table in silver and above is
fully metadata-enriched to the highest Unity Catalog standard.

## Definition of "highest UC standard"

For every **silver** and **gold** base table/MV:
1. A meaningful **table `COMMENT`** (business purpose, grain, source provenance, gating/caveats).
2. A **`COMMENT` on every output column** (business meaning + SAP source field where applicable).
3. Governance **`TAGS`**: layer (silver/gold), domain/product_area, source SAP tables, gating
   status, data-classification, PII flag where relevant.
4. Coverage **enforced by CI** — a table or column with no comment fails the build.

**Already done (out of scope):** the consumer-facing **consumption views** are fully enriched
(view+column comments + tags) by `scripts/generate_contract_metadata_sql.py` from the manifest.
This initiative covers the **base silver + gold tables underneath**, which today have table
comments only.

## Design principle — extend the existing pattern, don't reinvent

The repo's house pattern is **single source → generator → env SQL → CI guard** (manifest→OKF,
GOLD_TABLES→security SQL, site_config CSV→guard, manifest→contract_metadata SQL). We mirror it:

```
metadata source (per-domain YAML)  ──►  generate_base_metadata_sql.py  ──►  {silver,gold}_metadata_{dev,uat,prod}.sql
                │                                                                    (COMMENT ON TABLE/COLUMN + ALTER TABLE SET TAGS)
                └──►  check_base_metadata_coverage.py (CI guard)  ◄── column truth parsed from the .py .alias() outputs
```

- **UC syntax** (base tables/MVs, not views): `COMMENT ON TABLE <cat>.<schema>.<tbl> IS '…'`,
  `COMMENT ON COLUMN <tbl>.<col> IS '…'`, `ALTER TABLE <tbl> SET TAGS (k=v, …)`. (The existing
  view generator uses COMMENT ON VIEW + ALTER VIEW SET TAGS — confirm MV/streaming-table tag
  support in the audit; fall back to COMMENT-only if SET TAGS is unsupported on a given object.)
- **Re-runnable & idempotent** (COMMENT/SET TAGS overwrite); applied post-deploy like
  `contract_metadata_{env}.sql`. Add to the post-deploy SQL-application runbook.

## Source of truth (decided pending audit confirmation)

A **per-domain metadata YAML** under `data-products/io-reporting/metadata/` (e.g.
`silver_<module>.metadata.yml`, `gold_<module>.metadata.yml`), each: `table → {comment, tags{}, columns{col: comment}}`.
Single source; hand-authored (the descriptions are the value); generator is a pure downstream
artefact. Rationale over alternatives: inline-in-`.py` can't carry tags cleanly and scatters the
source; deriving from `.alias()` `#` comments is lossy/fragile. **Reuse existing material to seed
it fast** (not from scratch):
- inline `# …` comments next to `.alias()` lines → column descriptions,
- `silver/design_spec.md` + `gold/design_spec.md` table catalogues → table comments,
- the **manifest** field descriptions → base columns whose names match consumption columns,
- **`source-contracts/silver_stage_gate_inventory.yml`** → tags (source_tables, gating_category,
  current_status, product_area) — already-curated TAG material, especially for silver.

## CI coverage guard (`check_base_metadata_coverage.py`)

Offline-verifiable (no live catalog): parse each silver/gold `.py` for output table names
(`@dlt.table`/`create_streaming_table`/`apply_changes` target) and output columns (the
`.alias("…")` in the final select/return, excluding `_`-prefixed internal aliases that are
dropped). Assert every table + every output column has a non-empty entry in the metadata YAML;
**no vacuous descriptions** (reject empty, "TODO", or comment == column-name). Report
coverage % and the exact missing (table, column) pairs. Known false-positive risks to handle:
internal `_`-aliases, dynamically-built selects (`stack`/`*`), conditionally-registered tables
(guard with the same `bronze_columns_exist` gating) — the audit enumerates these.

## Phasing & execution

- **P0 — Mechanism + guard (bootstrap mode).** Build `generate_base_metadata_sql.py` +
  `check_base_metadata_coverage.py`. Guard starts in **report-only/allow-missing** mode (prints
  coverage, exits 0) so it can land before backfill. Seed the metadata YAML skeletons (tables +
  column lists auto-extracted from the `.alias()` aliases, descriptions blank). One PR.
- **P1 — Gold backfill.** Fill gold table+column comments + tags (consumer-proximate; reuse the
  manifest descriptions for columns that surface to consumption views). Per-gold-module agents.
- **P2 — Silver backfill.** Fill silver table+column comments + tags, per silver module
  (`warehouse_fast`, `warehouse_flow`, `reference`, `inbound`, `process_order`, `quality`,
  `quality_lab`, `traceability`). Reuse inline `#` comments + design_spec + stage-gate inventory.
  Parallel per-module agents (each module is an independent YAML — no cross-file conflict).
- **P3 — Tags pass.** Apply governance tags from the stage-gate inventory (gating/product_area/
  source SAP tables) + data-classification/PII where known.
- **P4 — Enforce.** Flip the coverage guard to **deny-missing** (fail CI on any uncommented
  table/column), add it to `.github/workflows/ci.yml`, and document the standard in
  `_conventions.md` (every new silver/gold table ships its metadata YAML entry).

## Execution model

Orchestrator (me): design, build the mechanism+guard (P0), then fan out **per-module backfill
agents** (P1/P2) — each owns ONE metadata YAML so they never conflict; column truth comes from
the `.py` `.alias()` aliases (verify, don't invent). I review each against the no-vacuous rule
before merge. The guard's coverage % is the burn-down metric.

## Post-merge (orchestrator)

Apply `{silver,gold}_metadata_{env}.sql` after each deploy (UC admin, idempotent) — same step
class as `contract_metadata_{env}.sql`. No pipeline run needed (metadata is applied to existing
objects); add to the post-deploy SQL checklist.

## Acceptance

- Coverage guard reports 100% (every silver+gold table + output column has a non-vacuous comment).
- `{silver,gold}_metadata_{env}.sql` generated for all 3 envs; applies idempotently.
- Tags present (layer, domain/product_area, source tables, gating). Guard flipped to deny-missing
  and wired into CI; `_conventions.md` documents the standard.
