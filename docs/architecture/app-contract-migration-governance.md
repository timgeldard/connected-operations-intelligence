# App Contract Migration Governance

Warehouse360 is the only active governed-contract migration pilot. Other apps must remain planning-only until the migration registry explicitly approves them for candidate scaffolding or runtime work.

This governance model is offline-safe. It does not require Databricks access and does not claim DEV, UAT, or production validation for any app.

## Control Files

| File | Purpose |
|---|---|
| `data-products/io-reporting/contracts/app_migration_registry.yml` | Machine-readable migration status and runtime guard approvals. |
| `data-products/io-reporting/contracts/_templates/` | Reusable templates for future app migration evidence packs. |
| `scripts/ci/check_app_migration_registry_guard.py` | CI guard that blocks accidental non-approved runtime governed-contract behavior. |
| `data-products/io-reporting/evidence/README.md` | Convention for storing future validation evidence. |

## Status Model

| Status | Meaning | Runtime governed contracts allowed |
|---|---|---|
| `not_started` | No migration inventory or validation pack exists. | No |
| `inventory_only` | Route/source inventory may exist, but no runtime migration is approved. | No |
| `candidate_scaffold` | Candidate contracts/views may be drafted for approved offline validation prep. | Only if registry allows |
| `dev_validation_pack_ready` | DEV execution pack is ready to run, but live validation is still pending unless evidence says otherwise. | Only if registry allows |
| `dev_validated` | DEV validation evidence has been accepted by the owner. | Only if registry allows |
| `uat_ready` | UAT migration planning can begin after accepted DEV evidence and smoke testing. | Only if registry allows |

## Current Rule

Warehouse360 is the pilot and may contain governed-contract runtime scaffolding. Process Order History, Trace2, Quality / Connected Quality, SPC, and EnvMon must not be repointed to governed contracts until all of the following are true:

- Warehouse360 DEV validation evidence has been accepted.
- The app has completed route-to-contract inventory.
- The app has a reviewed source object and source column validation plan.
- The registry marks the app as approved for candidate scaffolding or runtime work.
- CI guardrails pass with the registry entry in place.

## Blocked Until Approval

For non-approved apps, do not add:

- `*_SOURCE_MODE` values that enable `governed_contracts`.
- Runtime `QuerySpec(contract_id=...)` behavior in app adapters.
- Adapter references to `vw_consumption_*` source views.
- Contracts marked `route-covered`, `active`, `dev_validated`, or `uat_ready`.

Planning-only route inventories and naming guidance are allowed when they explicitly state that no validation has been run and no runtime repointing is authorized.

## Evidence Discipline

Validation evidence must be recorded as evidence, not as claims in prose. A future live execution pack should capture:

- execution date/time and Git SHA,
- target catalog/schema,
- source object and source column checks,
- candidate view compile results,
- key/grain checks,
- row-level security checks,
- app smoke-test results,
- blocking issues and accepted exceptions.

Until those artifacts exist and are accepted, the app remains unvalidated.
