# Offline Pre-UAT Smoke Checks

This document explains the purpose and limitations of the offline pre-UAT smoke checks added for the first-wave journeys.

## What These Checks Are

These checks use fixtures and mocked responses to prove the UI journeys behave truthfully when the backend returns known governed states, without needing live Databricks access. They validate that:

- Loading states are not conflated with empty evidence.
- Source errors are not rendered as “no data”.
- Missing or unknown values (e.g., `null`, `unknown`, `not-evaluated`) render truthfully as unavailable, unknown, or not evaluated.
- Governance-pending and blocked states are visible.
- No forbidden labels (e.g., "safe", "approved", "released") appear improperly when source data does not explicitly assert them.
- This serves as a rehearsal before live UAT evidence capture.

## What These Checks Are Not

- **They do not prove source correctness.** The data is mocked and not sourced from a live system.
- **They do not count as browser UAT evidence.** These are offline pre-UAT checks only.
- **Live Databricks-backed evidence is still required.** Real evidence folders with live source verification remain a prerequisite for production-readiness claims.

## Scope

The offline pre-UAT smoke checks cover the following first-wave journeys:

1. Trace batch header + customer exposure
2. Trace supplier exposure + mass balance
3. Quality usage decision evidence
4. POH process-order header
5. SPC chart data
6. Warehouse inbound
7. Warehouse staging
8. Warehouse exceptions

## Shared Assertions

A shared test-only utility, `expectNoForbiddenClaims`, is provided by `@connectio/test-support` to centralize forbidden-claim checks across all domain offline UAT tests.
