# Route Readiness Standard

No route should be added solely because a UI screen needs data. A route exposes a governed data product.

> [!NOTE]
> While backend routes are governed strictly by data-product specs, frontend features are structured to progress iteratively. See the [Consumer-Grade App Direction](../product-operating-model/consumer-grade-app-direction.md) for details on the two-axis operating model.


## Required Before Route Implementation

Before writing the FastAPI route or Databricks adapter query, the following must be documented:

- Data product name
- Business object
- Pattern
- Grain (e.g., one row per batch per plant)
- Source objects (verified tables/views)
- Filters
- Direct fields
- Derived fields
- Heuristic fields
- Unavailable fields
- Governance-pending fields
- Contract definition
- Expected error / unavailable states
- Test plan

## Route Readiness States

A route's lifecycle is tracked via these states:

- `not-started`
- `source-mapped`
- `contract-defined`
- `implemented`
- `response-model-enforced`
- `tested`
- `browser-uat-pending`
- `browser-uat-captured`
- `passed-with-caveats`
- `production-blocked`
- `production-ready`

### State definitions

- **`not-started`** — No work has begun.
- **`source-mapped`** — Verified source objects, grain, filters, and
  field classifications are documented.
- **`contract-defined`** — Zod / Pydantic contract published in
  `@connectio/data-contracts` and / or `apps/api`.
- **`implemented`** — Route handler and mapper written; happy path
  reachable.
- **`response-model-enforced`** — Route declares `response_model=`
  with `extra='forbid'`; runtime validation cannot leak unknown
  fields.
- **`tested`** — Mapper-level tests, route-level tests, and
  reference-consumer alignment tests are passing in CI.
- **`browser-uat-pending`** — All code-level gates above are closed,
  but no browser UAT evidence has been captured yet against the
  intended environment. Use this state by default for any route that
  is technically complete.
- **`browser-uat-captured`** — A browser UAT run completed and the
  evidence pack exists under
  `docs/app-data-layer/evidence/YYYY-MM-DD/<app-or-data-product>/`
  per [`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md).
  This is **not** the same as production-ready — it only means the
  end-to-end browser behaviour has been recorded once.
- **`passed-with-caveats`** — Browser UAT captured and the run was
  acceptable, but caveats are listed in the evidence pack (e.g.
  partially-governed fields, source-coverage gaps, governance-pending
  rules). The caveats must be closed before the route advances.
- **`production-blocked`** — A specific prerequisite blocks production
  promotion. The blocker is named in the catalogue entry (e.g.
  _Warehouse Gates 4 and 5_, _governed reconciliation rule_,
  _governed recall-recommendation rule_).
- **`production-ready`** — All of the following are true:
  - source verified (no fabricated table / view references)
  - contract enforced (`response_model` + zod parse)
  - mapper-level and route-level tests passing
  - reference-consumer alignment tests passing
  - browser UAT evidence captured against the intended environment
  - governance closure for any `governance-pending` semantics
    referenced by the contract

### What `browser-uat-captured` is **not**

`browser-uat-captured` is _not_ a synonym for _production-ready_. A
captured browser UAT is one piece of evidence in a broader readiness
judgement. The other gates (source verification, contract enforcement,
mapper tests, route tests, reference-consumer alignment, governance
closure) must already be in place before a browser UAT is meaningful.

Governance-pending fields may be shown in the UI **only** with clear
caveats (e.g. a "governance-pending" banner). They must not be allowed
to advance a data product to `production-ready`.

## Related documents

- [`uat-entry-plan.md`](./uat-entry-plan.md)
  — defines which data products are allowed into UAT, first-wave
  candidates, blocked items, allowed caveats, and required evidence.
- [`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md)
  — minimum standard for marking a route or data product as
  browser-UAT captured.
- [`browser-uat-evidence-template.md`](./browser-uat-evidence-template.md)
  — fill-in template for evidence packs.
- `browser-uat-checklists/<app>.md` — per-app journey checklists
  (Trace, Quality, SPC, POH, Warehouse).
- [`domain-data-product-catalog.md`](./domain-data-product-catalog.md)
  — current per-data-product readiness status.
