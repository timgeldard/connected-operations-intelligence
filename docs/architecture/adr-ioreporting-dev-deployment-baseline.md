# ADR: IOReporting DEV deployment baseline & DEV gold serving schema

## Status

Accepted (implementation in progress — see "What remains blocked").

## Context

The IOReporting data product (`data-products/io-reporting/`) — Silver pipelines,
the Gold pipeline, serving/security SQL, and the Warehouse360 governed contract
pilot — **has never been deployed to DEV or UAT**. The Warehouse360 DEV
validation evidence (PR #18) failed at the source-object gate: **0 of 7**
governed source objects existed in `connected_plant_dev`, and neither
`gold_io_reporting` nor `gold_dev` schema was present. That is a
first-deployment / bootstrap problem, not a Warehouse360 data-quality problem.

Preflight checks against the DEV workspace (`adb-3548637138127338.18`, profile
`TG`) surfaced two distinct, independent gaps that both block the bootstrap:

1. **Gold serving schema split.** The bundle `dev_*` targets and the gold
   serving/security SQL generators targeted `connected_plant_dev.gold_dev`,
   while the Warehouse360 consumption views and the entire validation pack read
   from `connected_plant_dev.gold_io_reporting`. The `check_warehouse360_migration_static.py`
   guard also *mandates* `connected_plant_dev.gold_io_reporting` for governed
   Warehouse360 SQL and forbids `gold_dev`. UAT/PROD are already internally
   consistent on `gold_io_reporting`.

2. **DEV source wiring.** Neither dev target could read a source that actually
   exists in the DEV workspace:
   - `dev_uat_source` reads `source_catalog: connected_plant_uat` — **not bound
     in the DEV workspace** (`SHOW CATALOGS` via `TG` does not list it).
   - `dev_sample` reads `connected_plant_dev.sap_sample` — **that schema does not
     exist** (only `connected_plant_dev.sap` exists, with 131 SAP tables).

   So even with the schema fixed, the Silver pipelines would find no source,
   Gold would get no input, and the 7 governed objects would never materialise.

3. **DEV reference-data (`central_services`) wiring** *(discovered during the
   deploy attempt)*. The Silver reference (slow) pipeline reads
   `central_services`, seeded by `resources/sql/sample_central_services_dev.sql`,
   which copies **from `published_uat.central_services.*`** — and `published_uat`
   is **not bound in the DEV workspace** either. The DEV-native equivalent is
   `published_dev.central_services` (present, 120 tables), but it is missing 2 of
   the 11 tables the seed needs: `handlingunit_vekp` and `handlingunit_vepo` (HU
   reconciliation inputs). Resolving this is a data-team decision (source the HU
   tables, or scope HU recon out of the DEV baseline), so it is documented rather
   than guessed here.

## Decision

### 1. DEV governed serving schema = `connected_plant_dev.gold_io_reporting`

Align DEV with UAT/PROD. Concretely:
- `databricks.yml`: `gold_schema` default and the `dev_*` targets → `gold_io_reporting`.
- `scripts/generate_gold_serving_views_sql.py` and
  `scripts/generate_gold_security_sql.py`: the `dev` environment `gold_schema` →
  `gold_io_reporting`; regenerate `gold_serving_views_dev.sql`,
  `gold_security_dev.sql`, `gold_security_harden_dev.sql`.
- Warehouse360 consumption views are unchanged — they already read
  `gold_io_reporting`, so the mismatch resolves without touching app-facing SQL.

`gold_dev` is retired for IOReporting in DEV. No wrapper layer is introduced
(the alternative below was rejected).

### 2. Silver schema stays `silver_dev` in DEV (documented asymmetry)

Only the **gold/serving** layer moves to the `*_io_reporting` convention. DEV
Silver remains `silver_dev` (UAT/PROD use `silver_io_reporting`). This is a
deliberate minimal change: the Warehouse360 source layer and the static guard
are gold-scoped, and moving Silver too would widen blast radius with no benefit
to this bootstrap. Revisit only if a later decision standardises all DEV schemas.

### 3. New DEV-native bundle target `dev` (reads `connected_plant_dev.sap`)

Add a `dev` target (now `default: true`) that reads the real, populated DEV SAP
source and writes the governed layer:

| Variable | Value |
|---|---|
| `catalog` | `connected_plant_dev` |
| `schema` (silver) | `silver_dev` |
| `gold_schema` | `gold_io_reporting` |
| `source_catalog` / `source_schema` | `connected_plant_dev` / `sap` |
| `published_catalog` / `published_schema` | `connected_plant_dev` / `central_services` (self-contained) |

Existing targets are **left semantically intact** (only their `gold_schema` is
aligned): `dev_uat_source` still means "dev compute against the live UAT
source" (usable only from a workspace where `connected_plant_uat` is bound);
`dev_sample` still means "fully isolated sample environment". `default: true`
moved from `dev_uat_source` to `dev` because `dev_uat_source` is non-functional
in the actual DEV workspace.

### Alternatives considered

- **Keep `gold_dev` + add wrapper views in `gold_io_reporting`.** Rejected:
  adds a permanent indirection layer purely to paper over a naming split,
  contradicts the static guard's intent, and diverges from UAT/PROD. The clean
  fix is to build directly into `gold_io_reporting`.
- **Repoint `dev_sample` or `dev_uat_source` to `connected_plant_dev.sap`.**
  Rejected: silently changes the meaning of an existing target. Adding an
  explicit `dev` target is additive and self-documenting.

## How Warehouse360 depends on the IOReporting governed source layer

Warehouse360 consumption views (`vw_consumption_warehouse360_*`) read the 7
governed source objects in `gold_io_reporting`. Provenance / build order:

| # | Governed source object | Created by |
|---|---|---|
| base | `gold_transfer_requirement_backlog`, `gold_warehouse_exceptions`, base `gold_*` (kpi snapshot, delivery_pick_status, process_order_staging, stock_expiry_risk, inbound_po_backlog_enhanced) | **Gold pipeline** (`gold/*.py`) + `warehouse_snapshot` job (point-in-time KPI snapshot) |
| secured | `gold_warehouse_kpi_snapshot_secured` (+ other `*_secured`) | `resources/sql/gold_security_dev.sql` |
| live | `gold_inbound_po_backlog_enhanced_live`, `gold_delivery_pick_status_live`, `gold_process_order_staging_live`, `gold_stock_expiry_risk_live` | `resources/sql/gold_serving_views_dev.sql` (built on the `*_secured` views) |

Deployment order: **Silver → Gold (+ snapshot job) → security SQL → serving SQL
→ Warehouse360 source/column validation → consumption views → full WH360 pack.**

## Status of the baseline (as executed 2026-06-06, profile TG)

- ✅ Bundle **validates** and **deploys** to DEV (`-t dev`): 4 pipelines + 3 jobs
  created in `adb-3548637138127338.18`. A real first-deploy bug was fixed en
  route — the Gold pipeline library glob `../gold/*.py` (single `*`, rejected by
  Databricks) → `../gold/**`.
- ⛔ Pipeline **runs not executed**: blocked by gap #3 above
  (`central_services` reference data cannot be seeded in the DEV workspace until
  the `published_dev` sourcing / missing HU-table decision is made). Silver
  reference → Silver fast → Gold therefore cannot run yet, so the 7 governed
  objects do not exist and Warehouse360 validation cannot be rerun.

## What remains blocked

- Resolve DEV `central_services` sourcing (gap #3), then run Silver → Gold (+
  snapshot job) → security/serving SQL per the runbook.
- No Warehouse360 contract is promoted; all remain candidate/draft.
- DEV app readiness is **not** claimed; the full validation pack has not passed
  (it has not been rerun — sources do not yet exist).

## Rollback / transition notes

- The schema/wiring change is config + generated SQL only; revert via
  `git revert` and regenerate. No app runtime behaviour changes (apps consume
  `gold_io_reporting` already).
- The deployed bundle is reversible with `databricks bundle destroy -t dev
  --profile TG` (removes pipeline/job definitions; does not drop materialised
  tables — drop `connected_plant_dev.gold_io_reporting` / `silver_dev` manually
  if a clean teardown is required).
- Cross-reference: ADR 0003 (deployment targets), and the Warehouse360 evidence
  in `data-products/io-reporting/contracts/warehouse360-dev-profile.md`.
