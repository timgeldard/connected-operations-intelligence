# Plant Onboarding Runbook

Audience: ops / data-platform engineer.
Scope: adding a plant to the io-reporting data product (silver config + pipelines).
Does NOT cover wm-operations gold/manifest/frontend (those are separate, parallelisable).

---

## Overview

Onboarding a plant into io-reporting makes it visible to all silver stage-gated tables and,
via those, to all gold aggregates and the WH360 app.  The seed in
`silver/tables/reference.py` **is** the live plant config — a wrong edit immediately
changes what flows through every silver gate on the next pipeline run.  Validate thoroughly
before committing.

The canonical data source is `data-products/io-reporting/resources/config/site_config_plant.csv`.
The reference.py fallback seed is a DLT bootstrap that must stay byte-for-equivalent with
that CSV.  The CI guard `scripts/ci/check_site_config_plant_seed.py` enforces parity.

---

## Prerequisites

- Python 3.11+, `pyyaml` installed: `pip install pyyaml`
- Access to the target Databricks workspace (UAT or prod) for the live-validation steps.
- At minimum: read access to the SAP Bronze source catalog and the silver schema.

---

## Step 1 — Author the plant config YAML

Create a YAML file (can be a throwaway, e.g. `tmp_plant.yml`) with one entry per new plant.
Every field is required. Field reference:

| Field | Type | Notes |
|---|---|---|
| `plant_code` | string | SAP WERKS: 1 uppercase letter + 3 digits (e.g. C061) |
| `plant_name` | string | Human-readable label including `[MFG]` suffix |
| `country` | string | ISO 2-letter country code |
| `region` | string | e.g. Europe, Americas |
| `business_unit` | string | e.g. Operations |
| `timezone` | string | IANA timezone (e.g. Europe/London) |
| `sap_system_id` | string | e.g. ECC |
| `go_live_status` | string | PRODUCTION / PILOT / SHADOW / BLOCKED / DECOMMISSIONED / SUSPENDED |
| `wm_enabled_flag` | boolean | true = WM (Transfer Orders/Requirements) data is active |
| `hu_enabled_flag` | boolean | true = Handling Unit data is active |
| `qm_enabled_flag` | boolean | true = QM (Quality Inspection Lots/UD) data is active |
| `spc_enabled_flag` | boolean | true = SPC tier active (requires qm_enabled_flag = true) |
| `lifecycle_status` | string | **ADR 016 vocabulary only**: ACTIVE / CLOSED / SOLD / DIVESTED_ON_SAP. Distinct from go_live_status. Onboarded plants are ACTIVE by definition. |
| `batch_managed_flag` | boolean | true = plant uses batch management (MCHB/batch_stock active) |
| `process_manufacturing_flag` | boolean | true = plant has PP/PI process orders |
| `default_language_code` | string | EN |
| `valid_from` | date | YYYY-MM-DD; start of config validity window |
| `valid_to` | date | YYYY-MM-DD; end of validity (9999-12-31 for indefinite) |
| `is_active` | boolean | true for a live onboarding; false to temporarily exclude |
| `config_owner` | string | e.g. wm-config-owner |
| `last_validated_at` | date | YYYY-MM-DD; today's date |

Example:

```yaml
- plant_code: X999
  plant_name: "Newtown [MFG]"
  country: GB
  region: Europe
  business_unit: Operations
  timezone: Europe/London
  sap_system_id: ECC
  go_live_status: PRODUCTION
  wm_enabled_flag: true
  hu_enabled_flag: true
  qm_enabled_flag: true
  spc_enabled_flag: true
  lifecycle_status: ACTIVE
  batch_managed_flag: true
  process_manufacturing_flag: true
  default_language_code: EN
  valid_from: "2026-01-01"
  valid_to: "9999-12-31"
  is_active: true
  config_owner: wm-config-owner
  last_validated_at: "2026-06-13"
```

**Important lifecycle vocabulary note:** `lifecycle_status` must be one of the ADR 016
`site_lifecycle` values: `ACTIVE`, `CLOSED`, `SOLD`, `DIVESTED_ON_SAP`.  It is intentionally
**distinct** from `go_live_status` (PRODUCTION/PILOT/etc.).  Onboarded plants are `ACTIVE`.

---

## Step 2 — Validate and emit outputs

```bash
python scripts/onboarding/onboard_plant.py tmp_plant.yml
```

The script:
- Validates all fields, types, vocabularies, valid_from <= valid_to.
- Detects duplicates against the existing `resources/config/site_config_plant.csv`.
- On success: emits the CSV row, the Python Row() snippet, and the live-validation checklist.
- On failure: lists all errors and exits 1.  Fix and re-run before touching any code.

---

## Step 3 — Apply the config edits (code review required)

**3a. Append the CSV row** emitted by the script to:
```
data-products/io-reporting/resources/config/site_config_plant.csv
```
(Append after the last data row; do not add a new header.)

**3b. Add the Python Row()** emitted by the script to the `data = [...]` list in
`site_config_plant()` inside `data-products/io-reporting/silver/tables/reference.py`,
before the closing `]`.

**3c. Regenerate governed SQL:**
```bash
python data-products/io-reporting/scripts/generate_readiness_config_sql.py
git add data-products/io-reporting/resources/sql/site_config_*.sql
```

**3d. Run the CI guard** (must exit 0 before committing):
```bash
python scripts/ci/check_site_config_plant_seed.py
```

Commit with a message like:
```
feat(silver): onboard <PLANT_CODE> <plant_name>
```

---

## Step 4 — Run the LIVE-VALIDATION CHECKLIST (orchestrator)

The script printed a set of SQL probes.  Run each in Databricks (SQL warehouse) against the
target catalog **before** starting any pipeline runs.

Key probes (see full checklist from the script for exact SQL):

1. **T001W** — plant exists in SAP plant master.
2. **T320** — warehouse number(s) for this plant.  The LGNUM from T320 is authoritative —
   never guess. (Precedents: C061→104, P817→208, P806→190, C351→105.)
3. **T300** — warehouse exists in warehouse master.
4. **AUFK** — process order rows exist (AUTYP='40'; AUTYP='10' returns zero in Kerry config).
5. **MCHB** — batch stock rows exist.
6. **LTAP/LTBK** — WM transfer order/requirement rows if `wm_enabled_flag = true`.
7. **QALS/QAVE** — QM lot/UD rows if `qm_enabled_flag = true`.
   Note: QAVE.VWERKS = 'R001' (central plant) — always gate via QALS.WERKS, not QAVE.VWERKS.

Stop at the first failing probe.  A missing plant in T001W means replication has not reached
the target catalog — do not proceed until it does.

---

## Step 5 — Deploy the data bundle

```bash
# Validate first
databricks bundle validate -t uat --profile DEFAULT

# Deploy
databricks bundle deploy -t uat --profile DEFAULT
```

---

## Step 6 — Run the slow (reference) pipeline

The slow pipeline builds `site_config_plant` (and other reference tables) from the seed.
It **must complete** before the fast pipeline runs — the fast pipeline reads `site_config_plant`
for its stage gate (fail-loud if the table is absent).

```bash
databricks pipelines start-update <silver-slow-pipeline-id> --profile DEFAULT
```

Wait for the run to complete and confirm `site_config_plant` now includes the new plant.

Confirm via the probe in the checklist (probe 10):
```sql
SELECT plant_code, go_live_status, is_active
FROM <catalog>.silver.site_config_plant
WHERE plant_code = '<PLANT_CODE>';
```

---

## Step 7 — Run the fast pipeline (and quality/gold if applicable)

With the slow pipeline having rebuilt `site_config_plant`, the fast pipeline will now
include the new plant in its stage gate on next refresh.  Trigger or wait for the next
refresh-cadence run, or start a manual update.

If `qm_enabled_flag = true`, also run the quality pipeline.  Then run gold.

---

## Step 8 — Check silver row counts (live-validation probe 11)

```sql
SELECT '<PLANT_CODE>' AS plant_code,
  (SELECT COUNT(*) FROM <catalog>.silver.process_order WHERE plant_code = '<PLANT_CODE>') AS process_orders,
  (SELECT COUNT(*) FROM <catalog>.silver.batch_stock   WHERE plant_code = '<PLANT_CODE>') AS batch_stock_rows
  -- add transfer_order/requirement if wm_enabled; quality_inspection_lot if qm_enabled
;
```

Expected: > 0 for each enabled data area.  Zero count = the stage gate is not including
the plant or the source data is not replicated.

---

## Step 9 — Smoke test

- Open the WH360 app in the target environment.
- Navigate to the plant (plant picker must include the new code).
- Verify the readiness / worklist views show data for the plant.
- If the plant has WM enabled, confirm WM panels load.
- If QM enabled, confirm QM panels load.

---

## Known gotchas

**The seed is the live config.**  Adding a plant to reference.py is not a test change —
it immediately changes what the slow pipeline builds into `site_config_plant`, which
controls the gate for all silver and gold tables.  Validate before committing.

**Gate ordering matters.**  Fast pipeline reads `site_config_plant` from the silver
schema (Spark conf: `site_config_plant_table`).  If the slow pipeline has not run yet,
or has not been deployed yet, fast will FAIL-LOUD at startup.  Always run slow first
on first deploy.

**UAT fixture mode RLS.**  In UAT the row-level security model uses a validation-fixture
mode (no corporate-model / `users`-group lookup needed — the app passes user identity
through and the fixture anchors on known test users).  A new plant will be visible to
fixture users immediately; actual user-level access requires the governed RLS config to be
updated (a separate step not covered here).

**DNU plants must not be seeded.**  C350 (Kielce) was briefly onboarded 2026-06-11 by
mistake and revoked the same day — it is decommissioned (last process order 2021-12, zero
TR/TO in warehouse 132).  Verify with the plant team before seeding.

**Interrupted full-refresh.**  If a pipeline run is cancelled mid-full-refresh, affected
streaming tables will have empty data with a HEAD checkpoint.  Fix via a
`triggered-mode full_refresh_selection` (see UAT pipeline cost policy in project memory).

**spc_enabled_flag ordering.**  The `spc_enabled_flag` column must exist in silver
`site_config_plant` before any SPC-gated flow runs.  If you deploy an SPC-area flow
against a materialisation that predates the column, it will RAISE at filter time
(fail-loud, not a silent pass).  Run slow first.

**lifecycle_status vs go_live_status.**  These are two distinct axes:
- `go_live_status` controls whether a plant is in-scope for io-reporting pipelines
  (PRODUCTION = include; BLOCKED/DECOMMISSIONED/SUSPENDED = exclude).
- `lifecycle_status` is the ADR 016 estate-wide lifecycle (ACTIVE/CLOSED/SOLD/
  DIVESTED_ON_SAP) used by the trace product.  Onboarded plants are ACTIVE.
  Do NOT set lifecycle_status = PRODUCTION — that will fail the CI guard.

---

## Rollback

If you need to remove a plant after onboarding:

1. Set `is_active = false` in the CSV row (and reference.py Row()) — this immediately
   excludes it from the stage gate without deleting the entry.
2. Regenerate governed SQL and redeploy.
3. Run the slow pipeline to rebuild `site_config_plant`.
4. On next fast pipeline run, the plant will be excluded from all silver gates.

To permanently remove, delete the row from the CSV and the Row() from reference.py,
regenerate, and re-run.

---

## References

- `silver/tables/reference.py` — site_config_plant() fallback seed (~L843)
- `resources/config/site_config_plant.csv` — canonical CSV source
- `silver/_plant_gate.py` — gate logic and product-area flag semantics
- `scripts/onboarding/onboard_plant.py` — validation + emit script
- `scripts/ci/check_site_config_plant_seed.py` — CI guard (CSV/seed parity)
- `docs/adr/016-*.md` — ADR 016: site lifecycle dimension
- `source-contracts/site_stage_gate_contract.md` — stage gate design contract