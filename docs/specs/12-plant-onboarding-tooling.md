# Spec 12 — Plant-onboarding tooling

Read `docs/specs/_conventions.md` first. Branch: `feature/plant-onboarding-tooling` off main.
No Databricks/deploys — build the tool + runbook; live validation steps are documented for the
orchestrator to run (you have no workspace access).

## Objective

Onboarding a plant into the data product is currently a manual, memory-dependent edit of the plant
config + a sequence of checks. Turn it into a **scripted, validated, documented** flow so estate
rollout doesn't depend on tribal knowledge. This is operational TOOLING (a script + runbook + a CI
sanity guard), NOT a gold/app feature — it touches `silver/tables/reference.py`'s config seed,
`scripts/`, and `docs/runbooks/`; it should NOT touch the wm_operations gold/manifest/frontend.

## How onboarding works today (verified — ground the tool in this)
- The governed plant dimension is `site_config_plant` (`silver/tables/reference.py` ~L827), read
  from the `site_config_plant_table` Spark conf when set, ELSE a **fallback seed** in reference.py
  (~L642 / L846) that is the LIVE plant config (per project memory: the seed IS what's used; the
  site_config SQL path is dead for plant/warehouse). Each plant entry carries: plant_code,
  plant_name, country, business_unit, region, warehouse number(s), and the gate flags
  `wm_enabled_flag`, `qm_enabled_flag`, `hu_enabled_flag`, `go_live_status`, valid_from/to, etc.
  READ the exact seed entry shape in reference.py and mirror it — do not invent fields.
- Silver stage-gates (`silver/_plant_gate.py` + `silver_stage_gate_inventory.yml`) scope tables to
  onboarded plants via these flags. Adding a plant = adding a correct seed entry; the gates then
  include it on the next run.
- Precedent: P806 + C351 were onboarded 2026-06-11; C350 = DNU/decommissioned.

## Build
1. **Config schema + onboarding script** `scripts/onboarding/onboard_plant.py`:
   - Input: a small plant-config file (YAML/JSON) — one entry per plant with the seed fields above.
   - VALIDATE offline: required fields present, flag types correct, plant_code format, warehouse
     number format, no duplicate plant_code, go_live_status in the allowed set, valid_from ≤ valid_to,
     lifecycle consistent with the site_lifecycle dimension vocabulary (ACTIVE/CLOSED/SOLD/
     DIVESTED_ON_SAP — cross-check the values used in `gold/trace_gold.py` / site_lifecycle).
   - EMIT: the exact Python seed-entry snippet (or, preferably, refactor the reference.py seed to
     read from a checked-in `resources/config/site_config_plant_seed.yml` so onboarding is a data
     edit, not a code edit — IF that refactor is clean and keeps the fallback behaviour identical;
     otherwise generate the code snippet for manual paste and say so). Whichever: the seed remains
     the single source; do not create a parallel config.
   - Print a LIVE-VALIDATION CHECKLIST (for the orchestrator, who has Databricks) — the SQL probes to
     confirm before go-live: plant exists in T001W (`published_*.…t001w`/plant master), warehouse
     number in T320, the plant has SAP rows in the key sources (process_order/AUFK, batch_stock/MCHB,
     QM QALS if qm_enabled), and the stage-gate will include it. Provide the probe SQL as text; do
     NOT run it.
2. **CI guard** `scripts/ci/check_site_config_plant_seed.py`: validates the seed (or the config
   file) is well-formed (schema, no dup plant_code, flag types, lifecycle vocabulary) — fails CI on
   a malformed/duplicate entry. Wire into `.github/workflows/ci.yml`.
3. **Runbook** `docs/runbooks/plant-onboarding.md`: the end-to-end sequence — author config → run
   `onboard_plant.py` (validate + emit) → review diff → deploy data bundle → run slow/reference
   pipeline (rebuilds site_config_plant) → run the live-validation checklist → run fast/quality/gold
   → smoke. Capture the known gotchas (seed is the live config; gates read site_config_plant intra-
   pipeline so ordering matters; flags drive which silver tables include the plant; DNU plants are
   excluded; UAT fixture-mode RLS). Reference [[plant-onboarding-mechanics]] knowledge.

## Validation (offline) + acceptance
py_compile + ruff on the script + guard; run the new guard against the current seed (must PASS);
if the seed→YAML refactor is done, a py_compile/import of reference.py + a unit test that the
generated config reproduces the current seed entries byte-for-equivalent (no behaviour change);
the onboarding script's validation unit-tested with good + bad configs. Acceptance (orchestrator):
dry-run onboard a test plant config → script validates + emits the correct seed entry + prints the
live checklist; CI guard catches a deliberately-malformed entry.

## Gotchas
- The seed is the LIVE plant config — a wrong edit changes what flows through every silver gate.
  The refactor (if done) MUST preserve the exact current behaviour; pin it with a test.
- Do NOT touch wm_operations gold/manifest/frontend — this is silver-config + scripts + docs only,
  so it parallelizes safely with the other in-flight builds.
- No live validation by the agent (no Databricks) — emit the checklist as text for the orchestrator.
- Lifecycle vocabulary must match `site_lifecycle` (ACTIVE/CLOSED/SOLD/DIVESTED_ON_SAP), distinct
  from go_live_status (PRODUCTION/…).
