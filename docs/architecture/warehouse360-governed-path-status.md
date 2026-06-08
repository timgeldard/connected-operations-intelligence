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
| DEV consumption view live validation | **7/7 create (revalidated 2026-06-08, Gold update `73ebef43`)**: overview (543/0/0), outbound_backlog (2.16M), im_wm_reconciliation (198,860 aggregate), inbound_backlog (1,112,080 PO-line), shortfalls (1,788 material-grain) — all 0 dup PK / 0 null plant; staging_workload + stock_exceptions created-empty (DEV shakedown sources have 0 rows). DEV technical shape only — RLS/entitlement NOT proven, 2 views not data-validated. | [DEV live-validation results](warehouse360-dev-live-validation-results.md) | UAT gate (see below) — NOT app cutover |
| Missing-column / grain decisions | Decided (proposed) — D3/D4 available-upstream columns implemented (PR #43) | [ADR-0004](../decisions/ADR-0004-warehouse360-backlog-grain-and-missing-columns.md) | ratify + implement remaining scoped PRs (D1/D2 Gold models, D4/D5/D6 contract reduction, D7 overview DQ) |
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
3. Do not make runtime changes.

### If Databricks access is available
1. Run the DEV validation runbook.
2. Capture validation evidence.
3. Fix any view creation or contract-shape blockers.
4. Only then proceed to UAT validation.

## UAT readiness gate

DEV reached **7/7 views create** (2026-06-08). Do **not** begin UAT — and certainly not app cutover —
until all of these hold:

- [x] DEV SQL sequence (security → serving → consumption) runs cleanly and all 7 first-wave views create.
- [x] PK-duplicate counts are 0 and required plant/key nulls are 0 on the views that have data.
- [ ] The two **created-empty** views (`staging_workload`, `stock_exceptions`) are validated against a
  data-bearing environment (DEV gold_process_order_staging / gold_stock_expiry_risk are 0 rows in the shakedown).
- [ ] **RLS / entitlement proven** with representative identities (DEV `*_secured` views are pass-throughs;
  the `gold_security` apply/verify job — `resources/gold_security_job.job.yml` — run/scheduled as a gate).
- [ ] **OAuth identity header verification** completed (or explicitly separated from cutover) — see
  `docs/audit/databricks-apps-oauth-header-verification.md`.
- [ ] Type-compatibility + freshness checks reviewed against `information_schema` in UAT.
- [ ] Status docs reflect current state.

Only then the next plan is `chore(uat): validate Warehouse360 governed consumption views in UAT` — **not**
app cutover, and **not** setting `WAREHOUSE360_SOURCE_MODE=governed_contracts`.
