# CQ Lab — Databricks-API Blocker: `getLabFailures`

**Status:** BLOCKED  
**Recorded:** 2026-05-16  
**Reference:** ADR-024, `docs/audit/integration-readiness-report-2026-05-16.md` §4

---

## Blocker

`getLabFailures` cannot be migrated to the Databricks-api tier because the `line`
field in `ConnectedQualityLabFailureSchema` is **required** (`z.string()`, non-optional),
and the only available gold view that provides production-line enrichment for inspection
results is `vw_gold_process_order_plan` — which **does not exist** in the
`csm_process_order_history` catalog.

### Schema requirement

```typescript
// packages/data-contracts/src/schemas/connected-quality-lab.ts
export const ConnectedQualityLabFailureSchema = z.object({
  ...
  line: z.string(),   // ← REQUIRED — every failure row must carry a line value
  ...
})
```

### Available gold views

| View | Catalog | Contains `line` data? |
|------|---------|----------------------|
| `vw_gold_quality_result_enriched` | `connected_plant_uat` | No — inspection results only |
| `vw_gold_process_order_plan` | `csm_process_order_history` | Yes — but **view does not exist** |

---

## Why This Cannot Be Worked Around

Options considered and rejected:

1. **Make `line` optional in the schema** — out of scope for this tranche. Changing the
   `ConnectedQualityLabFailureSchema` Zod type is a data-contract change that affects every V2
   consumer of `getLabFailures`. Requires explicit product owner approval and contract-change
   review per governance rules.

2. **Use a JOIN to another table** — no alternative table in `connected_plant_uat` reliably links
   inspection results to production lines at the lot/batch level without `vw_gold_process_order_plan`.

3. **Hardcode a placeholder value** — violates the no-mock-only-parity-claims rule in `CLAUDE.md`.
   A databricks-api badge on data that silently omits a required field is worse than mock data.

---

## Unblocking Criteria

`getLabFailures` can be implemented once:

1. `vw_gold_process_order_plan` is created in `csm_process_order_history` with at least
   the columns needed to join inspection results to production lines (by `aufnr`, `matnr`,
   `werks`, or `charg`).
2. The view is confirmed available in `connected_plant_uat` (or the correct catalog is
   documented).
3. A test query confirms the join produces a non-null `line` value for known failure records.

---

## `getLabPlants` is Unblocked

`getLabPlants` is **not blocked**. It requires only `gold_plant` (plant dimension table),
which is available in `connected_plant_uat`. Its QuerySpec is implemented in
`apps/api/adapters/cq/cq_databricks_adapter.py`.
