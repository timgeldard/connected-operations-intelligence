# Main Branch Health Check — 2026-05-24

## Purpose

Pre-UAT baseline check of the main branch. Recorded before Week 1 PR work begins on the controlled UAT readiness plan.

---

## Test Baseline

```
1374 passed, 1 failed
```

### Known failing test

**`tests/architecture/test_architecture_guardrails.py::TestQuerySpecObjectQualification::test_adapter_sql_uses_qualified_objects`**

- **Status:** Pre-existing failure on main. Not introduced by recent work.
- **Cause:** Quality and Trace adapters contain SQL references that do not use fully-qualified `<catalog>.<schema>.<table>` syntax. The guardrail enforces this for all adapters.
- **Impact:** Non-blocking for UAT candidate journeys (Warehouse, POH, SPC are not affected). Does not block merge of active PRs.
- **Action:** Track in technical debt register. Fix in a dedicated quality/trace SQL hardening PR.

---

## Lint

```
All files pass linting (data-contracts, design-system)
```

No new lint failures introduced by recent PRs.

---

## TypeScript Typecheck

```
data-contracts: pass
design-system: pass
di-warehouse: pass
```

---

## Generated Contract Drift

### contracts.json

Running `sync-pydantic` on main produces a `contracts.json` diff that is **formatting-only** — no semantic changes to field names, types, or enums. The difference is expanded array formatting (one enum value per line) vs. compact single-line arrays in the committed file. This is a `zod-to-json-schema` serialisation variation.

**Resolution:** Do not regenerate `contracts.json` on main independently. This formatting drift resolves automatically when PR 1 (`fix/poh-spc-contracts-sentinel-semantics`) is merged, which commits consistently formatted output.

### generated.py

Running `sync-pydantic` on main (without the `--no-use-union-operator` fix from PR 1) would replace the committed `Union["AdditionalProperties", None]` with `"AdditionalProperties" | None` — the incompatible Python 3.11 forward-reference syntax documented in `docs/app-data-layer/contract-generation.md`.

**Resolution:** Do not run `sync-pydantic` on main independently until PR 1 (`fix/poh-spc-contracts-sentinel-semantics`) is merged. PR 1 adds `--no-use-union-operator` to `sync_contracts.py` and commits a safe regenerated output.

---

## Drift Check Status

| Artifact | Status | Resolution |
|---|---|---|
| `dist-schema/contracts.json` | Formatting drift only | Resolves on PR 1 merge |
| `apps/api/contracts/generated.py` | Committed file is safe; regeneration on main without PR 1 would introduce Python 3.11 incompatibility | Do not regenerate independently |

---

## Open PRs (Week 1 readiness)

| Branch | PR | Status |
|---|---|---|
| `fix/poh-spc-contracts-sentinel-semantics` | PR 1 | Pushed, ready for review |
| `feat/evidence-panel-truthfulness-primitives` | PR 2 | Pushed, ready for review |
| `adr/evidence-route-caching-freshness-policy` | PR 3 | Pushed, ready for review |
| `fix/warehouse-overview-blocked-state` | PR 4 | Pushed, ready for review |

---

## Summary

Main branch is stable for UAT candidate work with one known non-blocking test failure (`test_adapter_sql_uses_qualified_objects`). Generated contract drift is documented and resolves on PR 1 merge. No hidden CI/lint baseline issue blocks Week 1 PRs.
