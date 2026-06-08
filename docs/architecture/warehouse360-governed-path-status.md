# Warehouse360 Governed Path Status

## Status summary

| Area | Status | Evidence | Next action |
|---|---|---|---|
| Duplicate/overlap review | Complete | PR #30 | Done |
| Duplicate Gold DLT definitions | Fixed | PR #31 | Done |
| DEV Gold pipeline | Built and ran | PR #32 | Done |
| Secured/live boundary | Fixed | PR #33 | Done |
| Consumption SQL static alignment | Fixed | PR #34 | Done |
| Validation SQL/runbook | Merged | PR #35 | Done |
| DLT duplicate-name guard | Merged | PR #36 | Done |
| Secured/live ownership CI guard | Merged | PR #36 | Done |
| DEV consumption view live validation | Blocked — 1/7 views create; naming reconciled (PR #40); D3/D4 same-grain Gold fields implemented; remaining = carrier/grain/data-quality; not yet live revalidated | [DEV live-validation results](warehouse360-dev-live-validation-results.md) | implement remaining ADR-0004 Gold/contract PRs |
| Missing-column / grain decisions | Decided (proposed) + partially implemented | [ADR-0004](../decisions/ADR-0004-warehouse360-backlog-grain-and-missing-columns.md) | ratify + implement remaining Gold PRs |
| UAT validation | Not done | Requires Databricks | After DEV |
| Entitlement/RLS proof | Not done | Requires Databricks | After view validation |
| App governed-mode cutover | Not started | Requires validation | Later |
| Legacy wh360 deprecation | Not started | Requires governed cutover | Later |

## What is proven

* DEV Gold has compiled/run successfully.
* Duplicate Gold DLT dataset definitions have been removed.
* `_secured` and `_live` ownership boundaries have been corrected.
* Warehouse360 consumption SQL has been statically aligned for `plant_code AS plant_id`.

## What is not proven

* `vw_consumption_warehouse360_*` views create successfully in DEV.
* Actual view columns match contracts.
* Row counts are correct.
* Primary keys are unique.
* `plant_id` is non-null.
* Freshness is acceptable.
* User/plant entitlement is enforced.
* UAT is ready.
* The app can safely run in `governed_contracts` mode.

> [!WARNING]
> Do not switch `WAREHOUSE360_SOURCE_MODE=governed_contracts` until DEV and UAT validation have passed and entitlement/RLS has been proven.

## Next actions

### If no Databricks access
1. Merge/complete offline documentation and CI guardrail PRs.
2. Keep generated validation SQL current.
3. Do not switch source mode or claim governed readiness without live DEV/UAT validation.

### If Databricks access is available
1. Run the DEV validation runbook.
2. Capture validation evidence.
3. Fix any view creation or contract-shape blockers.
4. Only then proceed to UAT validation.
