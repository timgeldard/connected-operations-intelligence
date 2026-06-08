# Warehouse360 UAT Validation Results

First UAT validation attempt of the governed io-reporting Silver→Gold→consumption path.

> [!WARNING]
> **UAT data-shape validation did NOT complete, and RLS/entitlement is NOT proven.** No app cutover
> decision can be made from this result. The governed secured-view boundary remains mandatory. No app
> source-mode change was made; legacy `wh360` is untouched.

## Execution metadata

| Field | Value |
|---|---|
| Date/time | 2026-06-08 |
| Workspace | `adb-604667594731808.8.azuredatabricks.net` (UAT) |
| Catalog / schema | `connected_plant_uat` / `gold_io_reporting` (+ `silver_io_reporting`) |
| SQL warehouse | `connected_plant_uat` (id `e76480b94bea6ed5`) |
| Bundle target | `uat` (mode: **production**) |
| Executed by | `tim.geldard@kerry.com` (profile `DEFAULT`) |
| Gold pipeline | not run (blocked — see below) |

## What was run

This was a **first-time deployment** of the io-reporting Silver+Gold stack to UAT — no
`silver_io_reporting` / `gold_io_reporting` schema or pipelines existed beforehand.

1. `databricks bundle deploy -t uat` — created 4 pipelines + 4 jobs.
2. **Silver Reference (slow)** pipeline — completed (~6 min); built `site_config_*`, reference data.
3. **Silver Fast (continuous)** pipeline — started; partial C061-scoped backfill, then **stopped**.
4. Gold pipeline, security/harden SQL, serving + consumption views, contract-validation SQL — **NOT run.**
5. The deployment was **torn down** (`bundle destroy -t uat` + dropped both io-reporting schemas), leaving
   UAT in its pre-deploy state.

## Findings

### A. Stage-gate leak (BLOCKER — fixed) — `fix/warehouse360-stage-gate-inbound-outbound-p817`

Several operational Silver flows were **not plant-gated** and materialised all plants:

| Silver table | UAT result | Expected (C061-gated) |
|---|---|---|
| `purchase_order` | **640 plants / 18.8M rows** (ungated) | C061 only |
| `outbound_delivery`, `reservation_requirement` | ungated (not yet backfilled when stopped) | C061 only |
| `physical_inventory_document`, `handling_unit` | ungated | C061 only |
| `goods_movement` | 4.34M rows, **C061 only** ✓ | C061 only |
| `process_order` | 224k rows, **C061 only** ✓ | C061 only |
| `batch_stock` | 684k rows, **C061 only** ✓ | C061 only |

The gated tables (`goods_movement`/`process_order`/`batch_stock`) confirm the gate mechanism works; the
ungated tables (`inbound.py`, `warehouse_flow.py`) were classified `NEEDS_MAPPING` (backlog), so the
coverage guard did not catch them. Fixed by gating them and reclassifying `ENFORCED`.

### B. Warehouse→plant config bug (fixed in the same PR)

The stage-gate seed mis-mapped **C061 → warehouse 208**. SAP T320 (`warehouseforplant_t320`) and T300
(`warehousemaster_t300`) confirm **C061 → 104**, and **208 belongs to P817** (Jackson [MFG], US). The
warehouse gate now derives the relationship from T320 (not the hand-maintained seed); the seed and the
`storage_type_role_mapping` APPROVED set were corrected; **P817 (Jackson [MFG], US) was onboarded.**

### C. RLS / entitlement NOT proven — needs the validation security modes + test identities

The secured views filter on `current_user()` against `published_uat.security.model` (owner
`jens.michels@kerry.com`). The validating user has **read (`SELECT`) access** to that table (via
`grp_admin_connected_plant_uat`) but **no write access**, and — as the deployer — **owns the Gold
objects**. Therefore RLS/entitlement cannot be proven by this user:

- Cannot provision representative test-identity rows (no write to `published_uat.security.model`).
- Cannot observe the "`users` group lacks base-table SELECT" negative (the deployer is the owner, not a
  `users`-group member).

> UAT governed-view validation could not prove RLS/entitlement because **write access to
> `published_uat.security.model` is unavailable to the validating user, and the deployer owns the Gold
> objects** (so neither the positive plant-scoping case nor the base-table-revoke negative can be observed
> from this session). The governed secured-view boundary remains mandatory. **No app cutover decision can
> be made from this result.**

This motivates explicit **UAT validation security modes** (`validation_open` for data-shape validation
without the corporate security model; `validation_fixture` for representative entitlement testing with a
local fixture) — see `docs/runbooks/warehouse360-uat-migration-readiness.md`.

## Outcome — Outcome A (blockers found), now remediated; re-validation pending

- Findings A and B are fixed in `fix/warehouse360-stage-gate-inbound-outbound-p817` (not yet
  runtime-validated — the slow-tier `inbound.py` gate needs a DEV pipeline run to confirm DLT ordering).
- Data-shape validation of the 7 consumption views was **not completed** (Gold/views/validation SQL not
  run). It should be re-attempted after the gate fix is DEV-validated, using `validation_open` mode so it
  does not depend on the corporate security model.
- RLS/entitlement remains **not proven** — requires non-owner test identities provisioned in
  `published_uat.security.model` by its owner, or fixture-based testing.

## Next gate

1. DEV pipeline run to validate the stage-gate fix (gate ordering + C061-only scope for the newly-gated
   flows; P817 if DEV onboards it).
2. Re-deploy + run UAT, then run Gate A (data-shape, `validation_open`) once the security modes exist.
3. Gate B (fixture RLS) / Gate C (strict RLS with `published_uat.security.model`) for entitlement proof.
