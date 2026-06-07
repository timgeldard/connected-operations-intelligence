# Site / plant stage-gate contract (Bronze → Silver)

**Status:** Phase 1 (foundation + WM/MM reference enforcement). Author: data-product architecture, 2026-06-07.

> **DEV verification status (2026-06-07):** the gate is code-deployed and **passes DLT graph analysis**
> (config read + gate joins resolve, no fail-loud error); the CI guard passes (40/40 classified); the
> gate **effect** is measured (see `ioreporting-dev-deployment-profile.md` §(l) — C061/208 is ~3–6% of
> bronze). **Re-materialisation of the gated tables in DEV is DEFERRED** — a cold full silver_fast rerun
> is dominated by the heavy *ungated* `process_order` backfill, so the leak-checks
> (`validation/silver_stage_gate_validation.sql` §3) pass only after the next full run. Gating
> `process_order` (Phase 2) removes that bottleneck.

## Principle

- **Bronze is raw and unfiltered.** No plant/site filtering is ever applied to Bronze.
- **Silver is stage-gated.** All *operational* Bronze → Silver processing is scoped to plants/sites
  approved by the governed stage-gate config **before** data enters Silver. Repo-wide, not only Warehouse360.
- **Gold and serving views inherit Silver scope.** They do not re-open the gate.
- **User security is separate.** Secured/serving views (row-level security, masking) handle *user access*;
  they do **not** replace plant onboarding inclusion. A plant absent from the gate is absent from Silver
  regardless of who queries.

## Source of truth (canonical gate)

| Concern | Canonical table | Key fields |
|---|---|---|
| Plant inclusion | `site_config_plant` | `plant_code`, `is_active`, `go_live_status`, `wm_enabled_flag`, `qm_enabled_flag`, `batch_managed_flag`, `process_manufacturing_flag`, `hu_enabled_flag`, `valid_from`/`valid_to`, `last_validated_at` |
| Warehouse → plant mapping (LGNUM → WERKS) | `site_config_warehouse` | `warehouse_number`, `plant_code`, `is_active`, `relationship_type` |

Both are governed Silver tables built by the **slow tier** (`silver/tables/reference.py`) from the seeded
config (or the embedded bootstrap seed). They are read by the gate helper via the
`site_config_plant_table` / `site_config_warehouse_table` Spark confs (already set on the slow pipeline;
added to the fast pipeline in this change). **There is no second source** — `warehouse_plant_mapping`
(T320) is a SAP-derived reference, not the governed gate; the governed mapping is `site_config_warehouse`.

## Logical contract → physical mapping

The recommended logical fields map onto the **existing** `site_config_plant` columns (no schema change in
Phase 1 — derived in `silver/_plant_gate.py`):

| Logical field | Physical derivation |
|---|---|
| `plant_id` / `plant_code` | `site_config_plant.plant_code` |
| `warehouse_number` | `site_config_warehouse.warehouse_number` (mapped to `plant_code`) |
| `active_for_ioreporting` | `is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED')` |
| `active_for_warehouse360` | `active_for_ioreporting AND wm_enabled_flag` |
| `active_for_process_order` | `active_for_ioreporting AND process_manufacturing_flag` |
| `active_for_quality` | `active_for_ioreporting AND qm_enabled_flag` |
| `active_for_stock` | `active_for_ioreporting AND batch_managed_flag` |
| `stage_gate_status` | `go_live_status` (e.g. PRODUCTION, PILOT, BLOCKED) |
| `valid_from` / `valid_to` | `site_config_plant.valid_from` / `valid_to` |
| `technical_validated` | **Not yet a first-class column.** Closest signal: `deployment_mode` (dev_shakedown vs full_validation) + `last_validated_at`. **Phase-2 schema addition** — NOT silently assumed true. |
| `business_validated` | **Not yet a first-class column** (see above). DEV shakedown ≠ business-validated; UAT is the first business validation. **Phase-2 schema addition.** |

## How a plant enters / leaves Silver

- **Enters:** an active row in `site_config_plant` (`is_active = true`, non-blocked `go_live_status`) and,
  for the relevant product area, the corresponding `*_enabled_flag = true`. For WM flows it must also have
  an active `site_config_warehouse` row mapping its warehouse(s).
- **Leaves:** set `is_active = false` (or `valid_to` in the past, or `go_live_status` to a blocked value).
  The gate self-heals on the next run — no code change.
- **Never** by editing transformation code or hard-coding plant lists.

## Warehouse → plant rule (do NOT assume LGNUM = WERKS)

WM flows (LTAP/LTAK, LTBP/LTBK, LAGP, …) are gated on **`warehouse_number` ∈ active warehouses** via
`site_config_warehouse`, and enriched with a governed **`plant_id`** from that mapping. Evidence
(2026-06-07): warehouse `208` carries 393,612 transfer-order rows but only 369,694 carry `LTAK.WERKS = C061`
— so raw WERKS on WM headers is **not** a reliable plant. The raw WERKS is preserved as `plant_code`
(SAP-faithful) but the **governed** plant is `plant_id` from the mapping. Plant-keyed MM flows (MSEG, MCHB,
MARD, …) are gated **directly** on `WERKS` (`plant_code`), where WERKS is the true plant.

## DEV shakedown vs UAT / full validation

- **DEV** gate currently admits exactly **one** plant: `C061` (Portbury), warehouse `208`,
  `go_live_status = PRODUCTION`, all flags true. DEV bronze is **multi-plant** (P223, P509, …), so the gate
  is a **real filter** in DEV: operational Silver is scoped to C061/208 only (~3–6% of bronze rows).
  DEV is a **technical shakedown** — it proves the gate wiring runs and scopes correctly; it does **not**
  business-validate any plant.
- **UAT** is the first **full business validation**; the gate config there is the authoritative onboarding
  list. **PROD** likewise.

## Onboarding a new plant

1. Add/activate the plant in the governed `site_config_plant` seed (and `site_config_warehouse` for WM),
   with the correct `*_enabled_flag`s and a non-blocked `go_live_status`.
2. Re-run the slow pipeline (rebuilds the gate tables), then the operational pipelines.
3. Verify with `validation/silver_stage_gate_validation.sql` (active plants/warehouses, before/after counts,
   no unapproved plants leaking into operational Silver).
4. No transformation-code change is required.

## Fail-loud / no-silent-drop guarantees

- The gate config is read **unconditionally** (no `relation_exists` guard) — a **missing** config table
  **raises** at pipeline start (slow-before-fast deploy order, same as `recipe_process_line`). A guard would
  bake an empty-gate fallback into a continuous plan for the life of an update.
- An **empty** active set (table present, 0 active plants) is a misconfiguration that yields empty
  operational Silver. This is **not silent**: `silver_stage_gate_validation.sql` asserts
  `active_plants_in_gate > 0` and reports before/after row counts, so any drop-all is visible in validation
  evidence. (A future hard pre-flight may promote this to a raise.)

## Deploy-order dependency

The slow pipeline must build `site_config_plant` / `site_config_warehouse` **before** the continuous fast
pipeline starts (identical to the existing `recipe_process_line` dependency). On first deploy: run slow once,
then start fast.

## Exemptions

Global master/reference/config tables (no plant dimension) are **exempt** — see
`source-contracts/silver_stage_gate_inventory.yml`, where every Silver output is classified
`ENFORCED` / `EXEMPT` / `BLOCKED` / `NEEDS_MAPPING` with an `exempt_reason` for every exemption. A Silver
output absent from that inventory fails CI (`scripts/ci/check_silver_stage_gate_coverage.py`).

## Identifier fidelity

Gating must not normalise SAP identifiers. Preserve raw fields for keys/joins (`*_raw`). In particular
`CHARG` (batch) must keep `batch_number_raw`; the display-normalised `strip_zeros` value must not be the
sole key (see the §E1 batch_stock follow-up in `sap_unresolved_sources.yml` — the natural key should move to
the raw batch). The CI guard enforces "raw CHARG preserved" rather than banning normalisation outright.

## Phase plan

- **Phase 1 (this change):** contract + full 40-table inventory + central helper + **enforcement on the
  runnable WM/MM reference set** (goods_movement, batch_stock = direct plant gate; warehouse_transfer_order,
  warehouse_transfer_requirement = warehouse gate) + validation SQL + inventory-driven CI guard + docs.
- **Phase 2+ (tracked in the inventory):** enforce on the slow/quality/inbound operational flows; resolve
  `BLOCKED` / `NEEDS_MAPPING` tables; promote `technical_validated` / `business_validated` to first-class
  config columns; move the batch natural key to raw CHARG.
