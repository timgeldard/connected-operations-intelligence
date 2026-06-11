# CQ Lab — Databricks-API Blockers

**Date:** 2026-05-17 (updated m.txt — column names confirmed-v1 for getLabPlants)  
**Reference:** ADR-024, `docs/audit/integration-readiness-report-2026-05-16.md` §4  
**Implementation plan:** `docs/migration/databricks-vertical-slices-poh-cq-plan.md`

---

## `getLabFailures` — BLOCKED

### Reason

The `line` field in `ConnectedQualityLabFailureSchema` is **required** (`z.string()`, non-optional).
The only gold view that provides production-line enrichment for inspection results is
`vw_gold_process_order_plan` in `csm_process_order_history` — **this view does not exist**.

Without `vw_gold_process_order_plan`, every `getLabFailures` row would have a missing `line`
value, which fails the required `z.string()` constraint at runtime. The databricks-api slice
cannot be implemented until the view exists.

### Schema constraint

```typescript
// packages/data-contracts/src/schemas/connected-quality-lab.ts
export const ConnectedQualityLabFailureSchema = z.object({
  mat: z.string(),
  matNo: z.string(),
  lot: z.string(),
  batch: z.string(),
  line: z.string(),   // ← REQUIRED — every row must carry a production-line value
  char: z.string(),
  // ...
})
```

### Why workarounds are not acceptable

| Option | Why rejected |
|--------|-------------|
| Make `line` optional in the schema | Out of scope — contract change requires product owner approval and affects all V2 consumers |
| Use a different table for line enrichment | No alternative in `connected_plant_uat` joins inspection results to lines at lot/batch level without `vw_gold_process_order_plan` |
| Hardcode a placeholder | Violates `CLAUDE.md` no-mock-only-parity-claims rule — a databricks-api badge on silently-incomplete data is worse than mock |

### Unblocking criteria

1. `vw_gold_process_order_plan` created in `csm_process_order_history`
2. View confirmed available in the correct catalog
3. Test query confirms `line` is non-null for known failure records via the join path

### Current legacy-api status

`getLabFailures` is wired at `GET /api/cq/lab/fails` (proxy to V1 CQ backend) but not
browser-verified. The legacy-api path remains the active route until the databricks-api
slice is unblocked.

---

## `getLabPlants` — UNBLOCKED

`getLabPlants` has **no blockers**. It requires only `gold_plant` (plant dimension table),
available in `connected_plant_uat`.

QuerySpec implemented at: `apps/api/adapters/cq/cq_databricks_adapter.py`

**Column names confirmed-v1 (m.txt):** V1 source uses `PLANT_ID` and `PLANT_NAME` (not SAP `werks`/`name1`).
V2 `get_lab_plants_spec()` updated to match. Table qualified as `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` per V1.

Remaining pre-production requirement: live DDL confirmation (`DESCRIBE TABLE connected_plant_uat.gold.gold_plant`)
to upgrade status from `confirmed-v1` to `confirmed-ddl`. See ADR-024 open question #7.
