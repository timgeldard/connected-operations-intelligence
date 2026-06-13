# Spec 13 — Route response-model ↔ adapter-output CI guard

Read `docs/specs/_conventions.md` first. Branch: `feature/route-model-guard` off main.
No Databricks/deploys. **Disjoint from the data-product files** (only `scripts/ci/` + CI yaml +
test) — parallelizes safely with all other in-flight builds.

## Objective

Close the failure class that produced a runtime 500 on the order-readiness route this week: the
FastAPI response model (`WmOrderReadinessItem`, `extra='forbid'`) was missing five fields the
adapter mapped, so `ResponseValidationError` fired at request time — and **passed every offline
guard** (the contract-id guard checks adapter columns ↔ manifest, nothing checks adapter output ↔
the pydantic response model). Add a guard that asserts an adapter's mapped output keys are all
declared in the route's response model, and that a `forbid`-extra model can't be 500'd by an extra
mapped field.

## What it must catch

SCOPE: the guard only validates routes that **declare an explicit `response_model=`**. The
dynamically generated `SIMPLE_DATASETS` routes return raw `list[dict]` with **no** response model
(see `routes/wm_operations.py` — `_make_simple_route` omits `response_model`), so they are out of
scope and skipped — they can't 500 on an unexpected key. (Expect roughly 12 checked / 36 skipped.)

For every route that DOES declare a response model and maps rows to it:
1. Every key the adapter emits (the `columns` list in `SIMPLE_DATASETS` when that dataset is served
   through a typed route, and any explicit mapper dict keys / camelCase output keys) has a
   corresponding field on the response model.
2. If the model sets `model_config = {"extra": "forbid"}` (or `class Config: extra='forbid'`), an
   adapter output key NOT on the model is a HARD failure (this is exactly the 500 that occurred).
3. Required model fields (no default) are actually produced by the adapter (best-effort — flag
   required fields never present in the mapped columns).

## Implementation
`scripts/ci/check_route_response_models.py`:
- Read `apps/api/adapters/wm_operations/wm_operations_databricks_adapter.py` (the `SIMPLE_DATASETS`
  registry: each entry has `contract`, `columns`, type tuples) and the route files in
  `apps/api/routes/` to associate each dataset/route with its pydantic response model
  (`response_model=...` on the route decorator, or the `WmXxxItem` model the mapper returns). Use
  AST — do not import the app (avoid import-time side effects / Spark). Inspect class fields from the
  AST (annotations) and `model_config`/`Config.extra`.
- Account for the camelCase boundary: adapter `columns` are snake_case DB columns; the pydantic
  models are camelCase. There is an existing snake→camel mapping convention in the codebase — find
  how the adapter/serializer converts (e.g. a `to_camel`/alias generator) and apply the SAME
  transform when comparing, so the comparison is apples-to-apples. If models use pydantic alias
  generators, read aliases. Document the matching rule.
- Where the static association is genuinely ambiguous (hand-written routes not in SIMPLE_DATASETS),
  cover what is reliably resolvable and clearly report what was skipped (no silent passes — a
  skipped route must be logged), rather than guessing.
- Emit clear errors: `route/dataset X: adapter emits 'foo' not declared on model Y (extra=forbid →
  runtime 500)`.

Wire into `.github/workflows/ci.yml` as a job (pyyaml not needed; stdlib `ast`).

## Validation + acceptance
- Run the guard on current main — it MUST pass now (the readiness model was fixed). 
- Prove it WOULD catch the regression: in a scratch/test, temporarily add an undeclared column to a
  SIMPLE_DATASETS `columns` for a `forbid` model and confirm the guard fails (then revert) — OR
  ship a unit test (`pytest`) with a fixture model+adapter pair exercising: missing field (fail),
  extra-on-forbid (fail), all-aligned (pass), camelCase alias (pass). The unit test is the durable
  proof.
- py_compile + ruff on the guard; the guard self-runs green; CI job added.

## Gotchas
- AST-only, no app import (Spark/side effects). 
- The snake_case(adapter) ↔ camelCase(model) boundary is the crux — get the transform right or the
  guard is either noisy or useless; reuse the codebase's existing converter, don't reinvent.
- No vacuous assertions (the `or True` lesson — `_conventions.md`): the unit test's failing cases
  must actually fail without the guard fix.
- Scope: wm_operations first (where SIMPLE_DATASETS is structured); extend to other adapters only if
  cleanly resolvable — log, don't guess.
