# Warehouse360 DEV Validation Summary

Evidence returned by a Databricks-connected execution of the Warehouse360 DEV
validation pack. Full detail and pasted query output: see
[`warehouse360-dev-profile.md`](./warehouse360-dev-profile.md).

## Next validation attempt prerequisites (added 2026-06-06)

This pack has **not** been rerun since the original BLOCKED result below. Before
it can be, the IOReporting governed source layer must exist in
`connected_plant_dev.gold_io_reporting`. Status: a first DEV deployment baseline
is in place (bundle validated + deployed — see
[`ioreporting-dev-deployment-profile.md`](./ioreporting-dev-deployment-profile.md)
and ADR `docs/architecture/adr-ioreporting-dev-deployment-baseline.md`), but the
Silver → Gold pipeline **runs** remain blocked on DEV `central_services`
reference-data sourcing. Sequence to unblock: resolve central_services → run
Silver/Gold per the runbook → confirm 7/7 via
`validation/warehouse360_dev_source_layer_preflight.sql` → then rerun this pack.

## Execution Details

| Field | Value |
|---|---|
| Executed by | tim.geldard@kerry.com |
| Execution date/time | 2026-06-06 18:46 UTC |
| Databricks workspace | `https://adb-3548637138127338.18.azuredatabricks.net` (DEV) |
| SQL warehouse | `connected_plant_dev` — serverless PRO, id `8fae28f1808dbf75` |
| CLI profile | `TG` |
| Catalog | `connected_plant_dev` |
| Schema | `gold_io_reporting` (target — not present in DEV) |
| Git branch | `fix/imported-code-review` |
| Git commit SHA | `8cba60e3a51b6df1e3ba7fc9de8e5be00d4570c1` |

## Overall Result

**BLOCKED at the source-object gate.** The governed DEV gold source layer is not
deployed; consumption views were therefore not deployed (per the runbook gate),
and all downstream checks are blocked rather than failed.

| Area | Status | Notes |
|---|---|---|
| Source object validation | **Fail** | 0 / 7 source objects FOUND — all MISSING |
| Source column validation | **Fail** | All 82 expected columns MISSING (sources absent) |
| Consumption view deployment | **Not run (gated)** | Stopped per "missing sources → do not deploy" rule |
| Schema validation | **Not run (blocked)** | No views exist to introspect |
| Primary key validation | **Not run (blocked)** | Key uniqueness unprovable |
| Data quality validation | **Not run (blocked)** | `plant_id` / freshness unprovable |
| Contract compatibility validation | **Not run (blocked)** | Field presence/types unprovable |

## Blocking Issues

| Issue | Severity | Owner | Resolution required |
|---|---|---|---|
| `connected_plant_dev.gold_io_reporting` (and `gold_dev`) schema not present; 0/7 governed source objects exist anywhere in the catalog. | Blocking | Data platform / IO-reporting gold team | Deploy DEV gold layer (gold pipeline + `gold_serving_views_dev.sql` + `gold_security_dev.sql`). |
| Source-schema mismatch: DEV gold build + bundle config target `gold_dev`; `warehouse360_consumption_views_dev.sql` reads `gold_io_reporting`. | Blocking | Architecture / product owner | Decide DEV standard (`gold_io_reporting` vs `gold_dev`) before re-run. |

## Contract Decisions Required

| Contract | Decision needed | Owner |
|---|---|---|
| All 7 active Warehouse360 contracts | Confirm DEV source schema (`gold_io_reporting` vs `gold_dev`); grain/PK decisions deferred until views can be profiled. | Tim / product owner |
| `warehouse360.dispensary_queue` | Confirm real governed source + grain before any Wave 1 inclusion (remains `not_runtime_ready`). | Tim / product owner |

## Answers to Required Questions

- **Which contracts are ready for DEV app testing?** None. All 7 remain
  candidate/blocked; `dispensary_queue` stays `not_runtime_ready`.
- **Which contracts remain blocked?** All 7 active contracts (+ dispensary_queue).
- **Is `plant_id` safe for row-level filtering?** Unproven — no data exists to
  test null counts; treated as blocking until re-run.
- **Are primary keys valid?** Unproven — no rows to test for duplicates.
- **Is freshness sufficient?** Unproven — no `snapshot_ts` data exists.
- **Product-owner grain decisions required?** Yes, but deferred — they cannot be
  assessed until the source layer is built and views are profiled.

## Recommendation

```text
Do not promote.

Next actions (in order):
1. Deploy the DEV governed gold source layer (gold pipeline + gold_serving_views_dev.sql
   + gold_security_dev.sql) so the 7 governed sources materialise.
2. Resolve the DEV source-schema decision (gold_io_reporting vs gold_dev).
3. Re-run the full validation pack via the TG profile (warehouse 8fae28f1808dbf75).
4. Re-assess per-contract readiness against the decision rules.
```
