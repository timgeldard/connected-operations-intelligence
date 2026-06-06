# App Migration Execution Pack

This execution pack is an offline-safe checklist for preparing a future Databricks-connected validation run. It is not evidence that validation has run.

## App

| Field | Value |
|---|---|
| App key |  |
| Contract namespace |  |
| View prefix |  |
| Target DEV schema |  |
| Registry status |  |

## Required Artifacts

| Artifact | Path | Status |
|---|---|---|
| Migration registry entry | `data-products/io-reporting/contracts/app_migration_registry.yml` |  |
| Route inventory | `docs/architecture/<app>-route-contract-inventory-template.md` |  |
| View expectations | `data-products/io-reporting/contracts/apps/<app>/view_expectations.yml` |  |
| DEV profile | `data-products/io-reporting/contracts/apps/<app>/dev_profile.md` |  |
| Validation summary | `data-products/io-reporting/contracts/apps/<app>/validation_summary.md` |  |

## Offline Checks Before Live Execution

| Check | Expected result | Status |
|---|---|---|
| Registry permits candidate scaffold | App is not planning-only |  |
| CI guard passes | No accidental runtime migration |  |
| Source object list reviewed | No unresolved source ambiguity |  |
| Required columns classified | Source vs derived fields are documented |  |
| Smoke-test routes identified | Routes and expected contract IDs are listed |  |

## Live Execution Inputs

```text
Paste SQL, CLI command, or executor instructions here after approval.
```

## Evidence Drop Location

```text
data-products/io-reporting/evidence/<app>/dev/
```
